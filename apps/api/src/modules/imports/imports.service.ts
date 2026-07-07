import { createHash } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResourceKind } from "src/common/enums/resource-kind.enum";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { canonicalizeUrl } from "src/common/utils/url.util";
import { PrismaService } from "src/database/prisma.service";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import { HubsService } from "../hubs/hubs.service";
import { ImportTargetDto } from "./dto/import-target.dto";

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hubs: HubsService,
    private readonly policy: CollectionPolicyService,
  ) {}

  async importCsv(user: AuthUser, file: unknown, dto: ImportTargetDto) {
    const collection = await this.resolveTargetCollection(user, dto);
    this.ensureValidFile(file);

    const text = file.buffer.toString("utf8");
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      throw new BadRequestException("CSV file is empty");
    }

    const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
    const urlIdx = headers.indexOf("url");
    const titleIdx = headers.indexOf("title");

    if (urlIdx < 0) {
      throw new BadRequestException("CSV must contain url column");
    }

    const rows = lines.slice(1);
    return this.ingestRows(
      collection.id,
      rows.map((row, index) => {
        const columns = row.split(",").map((column) => column.trim());
        return {
          index: index + 2,
          url: columns[urlIdx] ?? "",
          title: titleIdx >= 0 ? columns[titleIdx] : undefined,
        };
      }),
    );
  }

  async importBookmarksHtml(user: AuthUser, file: unknown, dto: ImportTargetDto) {
    const collection = await this.resolveTargetCollection(user, dto);
    this.ensureValidFile(file);

    const text = file.buffer.toString("utf8");
    const linkRegex = /<A\s+[^>]*HREF="([^"]+)"[^>]*>(.*?)<\/A>/gi;
    const rows: Array<{ index: number; url: string; title?: string }> = [];

    let i = 1;
    let match = linkRegex.exec(text);
    while (match !== null) {
      rows.push({ index: i, url: match[1], title: stripHtml(match[2]) });
      i += 1;
      match = linkRegex.exec(text);
    }

    return this.ingestRows(collection.id, rows);
  }

  async importWhatsappTxt(user: AuthUser, file: unknown, dto: ImportTargetDto) {
    const collection = await this.resolveTargetCollection(user, dto);
    this.ensureValidFile(file);

    const utf8 = file.buffer.toString("utf8");
    const text = utf8.includes("�") ? file.buffer.toString("latin1") : utf8;
    const urlRegex = /https?:\/\/[^\s<>()]+/gi;
    const rows: Array<{ index: number; url: string }> = [];

    const lines = text.split(/\r?\n/);
    lines.forEach((line, lineIndex) => {
      const matches = line.match(urlRegex);
      if (matches) {
        for (const url of matches) {
          rows.push({ index: lineIndex + 1, url });
        }
      }
    });

    return this.ingestRows(collection.id, rows);
  }

  private async ingestRows(
    collectionId: string,
    rows: Array<{
      index: number;
      url: string;
      title?: string;
    }>,
  ) {
    const existingResources = await this.prisma.resource.findMany({
      where: { collectionId },
      include: { link: true },
    });

    const maxPosition = existingResources.reduce(
      (max, resource) => Math.max(max, resource.position),
      -1,
    );
    let nextPosition = maxPosition + 1;
    const existingHashes = new Set(
      existingResources.map((resource) => resource.link?.urlHash).filter(Boolean) as string[],
    );

    let importedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; reason: string; value: string }> = [];

    for (const row of rows) {
      try {
        const canonicalUrl = canonicalizeUrl(row.url);
        const urlHash = createHash("sha256").update(canonicalUrl).digest("hex");

        if (existingHashes.has(urlHash)) {
          skippedCount += 1;
          continue;
        }

        let link = await this.prisma.link.findUnique({ where: { urlHash } });
        if (!link) {
          link = await this.prisma.link.create({
            data: { canonicalUrl, urlHash },
          });
        }

        await this.prisma.resource.create({
          data: {
            collectionId,
            kind: ResourceKind.EXTERNAL_LINK,
            linkId: link.id,
            titleOverride: row.title ?? null,
            position: nextPosition,
          },
        });

        existingHashes.add(urlHash);
        importedCount += 1;
        nextPosition += 1;
      } catch {
        errors.push({
          row: row.index,
          reason: "invalid_or_unsupported_url",
          value: row.url.slice(0, 128),
        });
      }
    }

    return {
      totalRows: rows.length,
      processedRows: rows.length,
      importedCount,
      skippedCount,
      errorCount: errors.length,
      errors,
    };
  }

  private ensureValidFile(file: unknown): asserts file is { buffer: Buffer; size: number } {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    const candidate = file as { buffer?: Buffer; size?: number };
    if (!candidate.buffer || typeof candidate.size !== "number") {
      throw new BadRequestException("Invalid upload payload");
    }
    if (candidate.size > MAX_IMPORT_SIZE_BYTES) {
      throw new BadRequestException("File exceeds 10MB limit");
    }
  }

  private async resolveTargetCollection(user: AuthUser, dto: ImportTargetDto) {
    if (dto.targetCollectionId) {
      const collection = await this.prisma.collection.findUnique({
        where: { id: dto.targetCollectionId },
      });
      if (!collection) {
        throw new NotFoundException("Target collection not found");
      }
      // Importing is content write: hub members and direct-share editors.
      await this.policy.requireWriteContent(collection, user);
      return collection;
    }

    if (!dto.createCollection) {
      throw new BadRequestException("Provide targetCollectionId or set createCollection=true");
    }
    if (!dto.collectionTitle || !dto.collectionSlug) {
      throw new BadRequestException(
        "collectionTitle and collectionSlug are required when createCollection=true",
      );
    }

    const hubId = await this.hubs.getUserHubId(user.userId);
    if (!hubId) {
      throw new BadRequestException("No hub available for this user");
    }

    return this.prisma.collection.create({
      data: {
        hubId,
        title: dto.collectionTitle,
        slug: dto.collectionSlug,
      },
    });
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}
