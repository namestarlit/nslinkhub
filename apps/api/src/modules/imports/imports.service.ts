import { Injectable, NotFoundException } from "@nestjs/common";
import { isPublicLinkHost } from "@nslinkhub/types";
import { ResourceKind } from "src/common/enums/resource-kind.enum";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { canonicalizeUrl } from "src/common/utils/url.util";
import { PrismaService } from "src/database/prisma.service";
import { appError } from "../../common/errors/app-exception";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import { HubsService } from "../hubs/hubs.service";
import { requestLinkMetadata } from "../resources/link-metadata";
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
      throw appError("invalid_import");
    }

    const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
    const urlIdx = headers.indexOf("url");
    const titleIdx = headers.indexOf("title");

    if (urlIdx < 0) {
      throw appError("invalid_import");
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
      select: { position: true, url: true },
    });

    const maxPosition = existingResources.reduce(
      (max, resource) => Math.max(max, resource.position),
      -1,
    );
    let nextPosition = maxPosition + 1;
    const existingUrls = new Set(
      existingResources.map((resource) => resource.url).filter(Boolean) as string[],
    );

    let importedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; reason: string; value: string }> = [];

    for (const row of rows) {
      try {
        // Same address limit as Save a link (and within the metadata index).
        if (row.url.length > 2048) {
          errors.push({ row: row.index, reason: "url_too_long", value: row.url.slice(0, 128) });
          continue;
        }
        const url = canonicalizeUrl(row.url);
        if (!isPublicLinkHost(new URL(url).hostname)) {
          errors.push({ row: row.index, reason: "not_public_url", value: row.url.slice(0, 128) });
          continue;
        }

        if (existingUrls.has(url)) {
          skippedCount += 1;
          continue;
        }

        // A source title is ignored: titles come from the page (ADR-0012), so a
        // lookup is requested with the link in the same savepoint.
        await this.prisma.withSavepoint(async (tx) => {
          await tx.resource.create({
            data: {
              collectionId,
              kind: ResourceKind.EXTERNAL_LINK,
              url,
              position: nextPosition,
            },
          });
          await requestLinkMetadata(tx, [url]);
        });

        existingUrls.add(url);
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
      throw appError("invalid_import");
    }
    const candidate = file as { buffer?: Buffer; size?: number };
    if (!candidate.buffer || typeof candidate.size !== "number") {
      throw appError("invalid_import");
    }
    if (candidate.size > MAX_IMPORT_SIZE_BYTES) {
      throw appError("payload_too_large");
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
      throw appError("invalid_import");
    }
    if (!dto.collectionTitle || !dto.collectionSlug) {
      throw appError("invalid_import");
    }

    const hubId = await this.hubs.getUserHubId(user.userId);
    if (!hubId) {
      throw appError("hub_unavailable");
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
