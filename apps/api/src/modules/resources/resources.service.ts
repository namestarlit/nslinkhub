import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CursorQueryDto } from "src/common/dto/cursor-query.dto";
import { ResourceKind } from "src/common/enums/resource-kind.enum";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { decodeCursor, encodeCursor } from "src/common/utils/cursor.util";
import { normalizeTags } from "src/common/utils/tags.util";
import { canonicalizeUrl } from "src/common/utils/url.util";
import { PrismaService } from "src/database/prisma.service";
import { Collection, Resource } from "src/generated/prisma/client";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import { CreateExternalResourceDto } from "./dto/create-external-resource.dto";
import { ReorderResourcesDto } from "./dto/reorder-resources.dto";
import { UpdateResourceDto } from "./dto/update-resource.dto";

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: CollectionPolicyService,
  ) {}

  async createExternal(collectionId: string, user: AuthUser, dto: CreateExternalResourceDto) {
    const collection = await this.requireWritableCollection(collectionId, user);
    await this.ensurePositionAvailable(collection.id, dto.position);

    const url = canonicalizeUrl(dto.url);
    const duplicate = await this.prisma.resource.findFirst({
      where: { collectionId: collection.id, url },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException("Link already exists in this collection");
    }

    const saved = await this.prisma.resource.create({
      data: {
        collectionId: collection.id,
        kind: ResourceKind.EXTERNAL_LINK,
        url,
        titleOverride: dto.titleOverride ?? null,
        tags: normalizeTags(dto.tags),
        position: dto.position,
      },
    });

    return this.toPublicResource(saved);
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
    if (query.cursor && (cursor === null || typeof cursor.p !== "number")) {
      throw new BadRequestException("Invalid cursor");
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

    return {
      items: items.map((item) => this.toPublicResource(item)),
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
      throw new ConflictException("Version mismatch");
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
        titleOverride: dto.titleOverride ?? resource.titleOverride,
        ...(dto.tags !== undefined ? { tags: normalizeTags(dto.tags) } : {}),
        version: { increment: 1 },
      },
    });

    return this.toPublicResource(saved);
  }

  async remove(collectionId: string, resourceId: string, user: AuthUser) {
    await this.requireWritableCollection(collectionId, user);

    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, collectionId },
    });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }

    await this.prisma.resource.delete({ where: { id: resource.id } });

    // A section entry and the child's structural parent link are two faces of
    // one relationship: removing the entry un-nests the collection (it becomes
    // a top-level collection again, staying in the same hub).
    if (resource.kind === ResourceKind.COLLECTION_LINK && resource.linkedCollectionId) {
      await this.prisma.collection.update({
        where: { id: resource.linkedCollectionId },
        data: { parentCollectionId: null },
      });
    }

    return { id: resource.id, deleted: true };
  }

  async reorder(collectionId: string, user: AuthUser, dto: ReorderResourcesDto) {
    await this.requireWritableCollection(collectionId, user);

    const resources = await this.prisma.resource.findMany({
      where: { collectionId },
    });
    if (resources.length !== dto.items.length) {
      throw new BadRequestException("Reorder payload must include all resources");
    }

    const resourceIdSet = new Set(resources.map((r) => r.id));
    const payloadIdSet = new Set(dto.items.map((item) => item.resourceId));

    if (resourceIdSet.size !== payloadIdSet.size) {
      throw new BadRequestException("Duplicate resource IDs in reorder payload");
    }

    for (const payloadId of payloadIdSet) {
      if (!resourceIdSet.has(payloadId)) {
        throw new BadRequestException("Unknown resource ID in reorder payload");
      }
    }

    const positions = dto.items.map((item) => item.position).sort((a, b) => a - b);
    for (let i = 0; i < positions.length; i += 1) {
      if (positions[i] !== i) {
        throw new BadRequestException("Positions must be contiguous from 0..n-1");
      }
    }

    const byId = new Map(resources.map((r) => [r.id, r]));
    for (const item of dto.items) {
      const resource = byId.get(item.resourceId);
      if (!resource) {
        throw new BadRequestException("Unknown resource ID in reorder payload");
      }
      if (Number(resource.version) !== item.version) {
        throw new ConflictException("Version mismatch");
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
    // Content write: hub members and direct-share editors.
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
      await this.policy.recordLinkAccess(
        access.linkSourceCollectionId ?? collection.id,
        viewer.userId,
      );
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
      throw new ConflictException("Position is already used in this collection");
    }
  }

  private toPublicResource(resource: Resource) {
    return {
      id: resource.id,
      collectionId: resource.collectionId,
      kind: resource.kind,
      url: resource.url ?? undefined,
      linkedCollectionId: resource.linkedCollectionId,
      titleOverride: resource.titleOverride,
      tags: resource.tags,
      position: resource.position,
      version: Number(resource.version),
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    };
  }
}
