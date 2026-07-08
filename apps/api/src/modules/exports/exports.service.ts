import { Injectable, NotFoundException } from "@nestjs/common";
import { zipSync } from "fflate";
import { ResourceKind } from "src/common/enums/resource-kind.enum";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { PrismaService } from "src/database/prisma.service";
import { Collection, Resource } from "src/generated/prisma/client";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import { CreateExportDto } from "./dto/create-export.dto";
import {
  EXPORT_CONTENT_TYPES,
  EXPORT_FILE_EXTENSIONS,
  ExportDocument,
  ExportFormat,
  ExportItem,
  ExportLink,
} from "./export-document";
import { renderDocx } from "./renderers/docx.renderer";
import { renderMarkdown } from "./renderers/markdown.renderer";
import { renderPdf } from "./renderers/pdf.renderer";

export interface ExportFile {
  filename: string;
  contentType: string;
  body: Buffer;
}

// Export is synchronous: authorize every collection, build one document per
// collection, render the requested format, and hand the file back in the same
// response. One collection returns the file itself; several return a zip.
// Rendering is programmatic (pdfkit/docx/markdown) — milliseconds even for
// large collections — so there is no queue, no job table, and no artifact
// storage to clean up.
@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: CollectionPolicyService,
  ) {}

  async export(user: AuthUser, dto: CreateExportDto): Promise<ExportFile> {
    const ids = [...new Set(dto.collectionIds)];
    const collections = await this.prisma.collection.findMany({ where: { id: { in: ids } } });
    const byId = new Map(collections.map((collection) => [collection.id, collection]));

    // Authorize everything up front; the whole request fails before any
    // rendering if a single collection is missing or unreadable.
    for (const id of ids) {
      const collection = byId.get(id);
      if (!collection) {
        throw new NotFoundException(`Collection not found: ${id}`);
      }
      await this.policy.requireRead(collection, user);
    }

    const expand = dto.expand ?? true;
    const extension = EXPORT_FILE_EXTENSIONS[dto.format];
    const files: Array<{ name: string; body: Buffer }> = [];
    const usedNames = new Set<string>();

    for (const id of ids) {
      const collection = byId.get(id) as Collection;
      const document = await this.buildDocument(collection, expand);
      const body = await this.render(dto.format, document);
      files.push({ name: this.uniqueName(usedNames, collection.slug, extension), body });
    }

    if (files.length === 1) {
      return {
        filename: files[0].name,
        contentType: EXPORT_CONTENT_TYPES[dto.format],
        body: files[0].body,
      };
    }

    const zipped = zipSync(
      Object.fromEntries(files.map((file) => [file.name, new Uint8Array(file.body)])),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `collections-export-${stamp}.zip`,
      contentType: "application/zip",
      body: Buffer.from(zipped),
    };
  }

  // Build the format-agnostic document: root collection = title + description,
  // sub-collections expand into sections (or collapse to a line). Sections
  // never nest further — the two-level cap guarantees their resources are all
  // external links.
  private async buildDocument(collection: Collection, expand: boolean): Promise<ExportDocument> {
    const resources = await this.prisma.resource.findMany({
      where: { collectionId: collection.id },
      include: { linkedCollection: true },
      orderBy: { position: "asc" },
    });

    const items: ExportItem[] = [];
    for (const resource of resources) {
      if (resource.kind === ResourceKind.COLLECTION_LINK && resource.linkedCollection) {
        const title = resource.titleOverride ?? resource.linkedCollection.title;
        if (!expand) {
          items.push({ kind: "collection_ref", title });
          continue;
        }
        const sectionResources = await this.prisma.resource.findMany({
          where: { collectionId: resource.linkedCollection.id },
          orderBy: { position: "asc" },
        });
        items.push({
          kind: "section",
          title,
          description: resource.linkedCollection.description ?? undefined,
          links: sectionResources.filter((child) => child.url).map((child) => this.toLink(child)),
        });
      } else {
        items.push(this.toLink(resource));
      }
    }

    return {
      title: collection.title,
      description: collection.description ?? undefined,
      items,
    };
  }

  private toLink(resource: Resource): ExportLink {
    const url = resource.url ?? "";
    return { kind: "link", title: resource.titleOverride ?? (url || "Untitled"), url };
  }

  private render(format: ExportFormat, document: ExportDocument): Promise<Buffer> {
    switch (format) {
      case "markdown":
        return Promise.resolve(renderMarkdown(document));
      case "pdf":
        return renderPdf(document);
      case "docx":
        return renderDocx(document);
    }
  }

  // Slugs are unique per hub, but an export can span hubs (shared/published
  // collections), so zip entry names still need dedup.
  private uniqueName(used: Set<string>, slug: string, extension: string): string {
    let name = `${slug}.${extension}`;
    let counter = 2;
    while (used.has(name)) {
      name = `${slug}-${counter}.${extension}`;
      counter += 1;
    }
    used.add(name);
    return name;
  }
}
