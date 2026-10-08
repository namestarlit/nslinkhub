import { Injectable, NotFoundException } from "@nestjs/common";
import type { Resource as WireResource } from "@nslinkhub/types";
import { CursorQueryDto } from "src/common/dto/cursor-query.dto";
import { ResourceKind } from "src/common/enums/resource-kind.enum";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { decodeCursor, encodeCursor } from "src/common/utils/cursor.util";
import { normalizeTags } from "src/common/utils/tags.util";
import { publicLinkUrl } from "src/common/utils/url.util";
import { PrismaService } from "src/database/prisma.service";
import { Collection, Resource } from "src/generated/prisma/client";
import { appError } from "../../common/errors/app-exception";
import { wireToken } from "../../common/utils/wire-token";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import {
  CreateCollectionResourceDto,
  CreateHeadingResourceDto,
} from "./dto/create-collection-resource.dto";
import { CreateExternalResourceDto } from "./dto/create-external-resource.dto";
import { ReorderResourcesDto } from "./dto/reorder-resources.dto";
import { UpdateResourceDto } from "./dto/update-resource.dto";
import { type LinkMeta, metadataFor, readLinkMetadata, requestLinkMetadata } from "./link-metadata";

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: CollectionPolicyService,
  ) {}

  async createExternal(collectionId: string, user: AuthUser, dto: CreateExternalResourceDto) {
    const collection = await this.requireWritableCollection(collectionId, user);
    await this.ensurePositionAvailable(collection.id, dto.position);

    const url = publicLinkUrl(dto.url);
    const duplicate = await this.prisma.resource.findFirst({
      where: { collectionId: collection.id, url },
      select: { id: true },
    });
    if (duplicate) {
      throw appError("duplicate_resource");
    }

    const saved = await this.insertExternal(collection.id, url, dto.tags ?? [], dto.position);
    return this.toPublicResource(saved, await readLinkMetadata(this.prisma, [url]));
  }

  // Inserts a canonical, non-duplicate link into a collection the caller has
  // already authorized, and requests its page metadata in the same
  // transaction; the worker looks it up once the save commits.
  async insertExternal(collectionId: string, url: string, tags: string[], position: number) {
    const saved = await this.prisma.resource.create({
      data: {
        collectionId,
        kind: ResourceKind.EXTERNAL_LINK,
        url,
        tags: normalizeTags(tags),
        position,
      },
    });
    await requestLinkMetadata(this.prisma, [url]);
    return saved;
  }

  async createCollectionLink(
    collectionId: string,
    user: AuthUser,
    dto: CreateCollectionResourceDto,
  ) {
    const collection = await this.requireWritableCollection(collectionId, user);
    const target = await this.prisma.collection.findUnique({
      where: { id: dto.linkedCollectionId },
    });
    if (!target) throw new NotFoundException("Collection not found");
    await this.policy.requireRead(target, user);
    await this.ensurePositionAvailable(collection.id, dto.position);
    if (
      await this.prisma.resource.findFirst({
        where: { collectionId, linkedCollectionId: target.id },
      })
    )
      throw appError("duplicate_resource");
    const resource = await this.prisma.resource.create({
      data: {
        collectionId,
        kind: ResourceKind.COLLECTION_LINK,
        linkedCollectionId: target.id,
        position: dto.position,
        tags: normalizeTags(dto.tags),
      },
    });
    return this.resourceView(resource, user);
  }

  async createHeading(collectionId: string, user: AuthUser, dto: CreateHeadingResourceDto) {
    await this.requireWritableCollection(collectionId, user);
    await this.ensurePositionAvailable(collectionId, dto.position);
    return this.toPublicResource(
      await this.prisma.resource.create({
        data: {
          collectionId,
          kind: ResourceKind.HEADING,
          titleOverride: dto.title.trim(),
          position: dto.position,
        },
      }),
    );
  }

  async getByCollection(
    collectionId: string,
    viewer: AuthUser | null,
    shareToken: string | undefined,
    query: CursorQueryDto,
  ) {
    await this.requireReadableCollection(collectionId, viewer, shareToken);

    const limit = query.limit ?? 20;
    const cursor = query.cursor ? decodeCursor<{ p: number }>(query.cursor) : null;
    if (
      query.cursor &&
      (cursor === null ||
        typeof cursor.p !== "number" ||
        !Number.isInteger(cursor.p) ||
        cursor.p < 0 ||
        cursor.p > 2147483647)
    ) {
      throw appError("invalid_cursor");
    }

    const rows = await this.prisma.resource.findMany({
      where: {
        collectionId,
        ...(cursor ? { position: { gt: cursor.p } } : {}),
      },
      orderBy: { position: "asc" },
      take: limit + 1,
    });

    const items = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? encodeCursor({ p: items[items.length - 1].position }) : null;

    const metadata = await readLinkMetadata(this.prisma, linkUrls(items));
    return {
      items: await Promise.all(items.map((item) => this.resourceView(item, viewer, metadata))),
      meta: { limit, nextCursor },
    };
  }

  async update(collectionId: string, resourceId: string, user: AuthUser, dto: UpdateResourceDto) {
    await this.requireWritableCollection(collectionId, user);

    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, collectionId },
    });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }

    if (Number(resource.version) !== dto.version) {
      throw appError("version_conflict");
    }

    let position = resource.position;
    if (dto.position !== undefined && dto.position !== resource.position) {
      await this.ensurePositionAvailable(collectionId, dto.position, resource.id);
      position = dto.position;
    }

    const saved = await this.prisma.resource.update({
      where: { id: resource.id },
      data: {
        position,
        ...(dto.tags !== undefined ? { tags: normalizeTags(dto.tags) } : {}),
        version: { increment: 1 },
      },
    });

    return this.resourceView(saved, user, await readLinkMetadata(this.prisma, linkUrls([saved])));
  }

  async remove(collectionId: string, resourceId: string, user: AuthUser) {
    await this.requireWritableCollection(collectionId, user);

    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, collectionId },
    });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }

    await this.prisma.resource.delete({ where: { id: resource.id, collectionId } });

    return { id: resource.id, deleted: true };
  }

  async reorder(collectionId: string, user: AuthUser, dto: ReorderResourcesDto) {
    await this.requireWritableCollection(collectionId, user);

    const resources = await this.prisma.resource.findMany({
      where: { collectionId },
    });
    if (resources.length !== dto.items.length) {
      throw appError("invalid_reorder");
    }

    const resourceIdSet = new Set(resources.map((r) => r.id));
    const payloadIdSet = new Set(dto.items.map((item) => item.resourceId));

    if (resourceIdSet.size !== payloadIdSet.size) {
      throw appError("invalid_reorder");
    }

    for (const payloadId of payloadIdSet) {
      if (!resourceIdSet.has(payloadId)) {
        throw appError("invalid_reorder");
      }
    }

    const positions = dto.items.map((item) => item.position).sort((a, b) => a - b);
    for (let i = 0; i < positions.length; i += 1) {
      if (positions[i] !== i) {
        throw appError("invalid_reorder");
      }
    }

    const byId = new Map(resources.map((r) => [r.id, r]));
    for (const item of dto.items) {
      const resource = byId.get(item.resourceId);
      if (!resource) {
        throw appError("invalid_reorder");
      }
      if (Number(resource.version) !== item.version) {
        throw appError("version_conflict");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Avoid transient unique conflicts on (collection_id, position) by
      // writing temporary positions first, then final positions.
      const offset = resources.length + 1024;

      for (const item of dto.items) {
        await tx.resource.updateMany({
          where: { id: item.resourceId, collectionId },
          data: { position: item.position + offset },
        });
      }
      for (const item of dto.items) {
        await tx.resource.updateMany({
          where: { id: item.resourceId, collectionId },
          data: { position: item.position },
        });
      }
    });

    return { reordered: true, count: dto.items.length };
  }

  private async requireWritableCollection(
    collectionId: string,
    user: AuthUser,
  ): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });
    if (!collection) {
      throw new NotFoundException("Collection not found");
    }
    // Content write: hub owners and direct-share editors.
    await this.policy.requireWriteContent(collection, user);
    return collection;
  }

  private async requireReadableCollection(
    collectionId: string,
    viewer: AuthUser | null,
    shareToken: string | undefined,
  ): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });
    if (!collection) {
      throw new NotFoundException("Collection not found");
    }
    const access = await this.policy.requireRead(collection, viewer, shareToken);
    if (access.viaLinkToken && viewer) {
      await this.policy.recordLinkAccess(collection.id, viewer.userId);
    }
    return collection;
  }

  private async ensurePositionAvailable(
    collectionId: string,
    position: number,
    ignoreResourceId?: string,
  ) {
    const existing = await this.prisma.resource.findUnique({
      where: { collectionId_position: { collectionId, position } },
      select: { id: true },
    });
    if (existing && existing.id !== ignoreResourceId) {
      throw appError("position_conflict");
    }
  }

  private async resourceView(
    resource: Resource,
    viewer: AuthUser | null,
    metadata = new Map<string, LinkMeta>(),
  ): Promise<WireResource> {
    const base = this.toPublicResource(resource, metadata);
    if (resource.kind !== ResourceKind.COLLECTION_LINK) return base;
    const target = resource.linkedCollectionId
      ? await this.prisma.collection.findUnique({ where: { id: resource.linkedCollectionId } })
      : null;
    const readable = target && (await this.policy.resolve(target, viewer)).canRead;
    // Never forward the containing collection's share token or expose unreadable
    // metadata: an unreadable target's id and any stored title (which may have
    // been copied from it) stay out of the response.
    if (!readable)
      return { ...base, linkedCollectionId: null, title: null, linkedCollection: null };
    return {
      ...base,
      title: target.title,
      linkedCollection: { id: target.id, title: target.title },
    };
  }

  // A link's title, description and site name come from its page metadata; a
  // section's title is its text; a reference's title is its target's (above).
  private toPublicResource(
    resource: Resource,
    metadata = new Map<string, LinkMeta>(),
  ): WireResource {
    const link = resource.kind === ResourceKind.EXTERNAL_LINK;
    const meta = metadataFor(metadata, resource.url);
    return {
      id: resource.id,
      collectionId: resource.collectionId,
      kind: wireToken(resource.kind, ["external_link", "collection_link", "heading"]),
      url: resource.url ?? undefined,
      linkedCollectionId: resource.linkedCollectionId,
      title: link
        ? meta.title
        : resource.kind === ResourceKind.HEADING
          ? resource.titleOverride
          : null,
      description: link ? meta.description : null,
      siteName: link ? meta.siteName : null,
      tags: resource.tags,
      position: resource.position,
      version: Number(resource.version),
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
    };
  }
}

function linkUrls(items: Resource[]) {
  return items
    .filter((item) => item.kind === ResourceKind.EXTERNAL_LINK && item.url)
    .map((item) => item.url as string);
}
