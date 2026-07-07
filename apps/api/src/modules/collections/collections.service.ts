import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CursorQueryDto } from "src/common/dto/cursor-query.dto";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";
import { ResourceKind } from "src/common/enums/resource-kind.enum";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { decodeCursor, encodeCursor } from "src/common/utils/cursor.util";
import { parseIfMatchVersion, toVersionEtag } from "src/common/utils/etag.util";
import { PrismaService } from "src/database/prisma.service";
import { Collection } from "src/generated/prisma/client";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import { HubsService } from "../hubs/hubs.service";
import { pruneOrphanTags } from "../tags/tag-cleanup";
import { CreateChildCollectionDto } from "./dto/create-child-collection.dto";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { CreateShareDto } from "./dto/create-share.dto";
import { SetLinkSharingDto } from "./dto/set-link-sharing.dto";
import { TransferCollectionDto } from "./dto/transfer-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hubs: HubsService,
    private readonly policy: CollectionPolicyService,
  ) {}

  // --- creation -----------------------------------------------------------

  async create(user: AuthUser, dto: CreateCollectionDto) {
    const hubId = await this.requireUserHub(user);
    return this.createInHub(user, hubId, dto);
  }

  async createChild(parentId: string, user: AuthUser, dto: CreateChildCollectionDto) {
    const parent = await this.requireCollection(parentId, "Parent collection not found");
    await this.policy.requireManage(parent, user);

    const child = await this.createInHub(user, parent.hubId, {
      ...dto,
      parentCollectionId: parent.id,
    });

    const maxPositionResult = await this.prisma.resource.aggregate({
      where: { collectionId: parent.id },
      _max: { position: true },
    });
    const nextPosition = (maxPositionResult._max.position ?? -1) + 1;

    await this.prisma.resource.create({
      data: {
        collectionId: parent.id,
        kind: ResourceKind.COLLECTION_LINK,
        linkedCollectionId: child.id,
        position: nextPosition,
        titleOverride: child.title,
      },
    });

    return child;
  }

  // --- settings / lifecycle ----------------------------------------------

  async update(id: string, user: AuthUser, dto: UpdateCollectionDto, ifMatch?: string) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);

    const versionFromHeader = parseIfMatchVersion(ifMatch);
    if (versionFromHeader !== null && versionFromHeader !== Number(collection.version)) {
      throw new ConflictException("Version mismatch");
    }
    if (Number(dto.version) !== Number(collection.version)) {
      throw new ConflictException("Version mismatch");
    }

    if (dto.slug && dto.slug !== collection.slug) {
      const exists = await this.prisma.collection.findUnique({
        where: { hubId_slug: { hubId: collection.hubId, slug: dto.slug } },
        select: { id: true },
      });
      if (exists) {
        throw new ConflictException("Collection slug already exists");
      }
    }

    let parentCollectionId = collection.parentCollectionId;
    if (
      dto.parentCollectionId !== undefined &&
      dto.parentCollectionId !== collection.parentCollectionId
    ) {
      if (dto.parentCollectionId === null) {
        parentCollectionId = null;
      } else {
        if (dto.parentCollectionId === collection.id) {
          throw new BadRequestException("Collection cannot be parent of itself");
        }
        const parent = await this.requireCollection(
          dto.parentCollectionId,
          "Parent collection not found",
        );
        if (parent.hubId !== collection.hubId) {
          throw new BadRequestException("Parent collection must be in the same hub");
        }
        parentCollectionId = dto.parentCollectionId;
      }
    }

    const saved = await this.prisma.collection.update({
      where: { id: collection.id },
      data: {
        slug: dto.slug ?? collection.slug,
        title: dto.title ?? collection.title,
        description: dto.description ?? collection.description,
        published: dto.published ?? collection.published,
        parentCollectionId,
        version: { increment: 1 },
      },
    });
    return this.toPublicCollection(saved);
  }

  async remove(id: string, user: AuthUser) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);
    await this.prisma.collection.delete({ where: { id: collection.id } });
    // The delete cascades through nested collections, their resources, and all
    // tag-join rows to an unknowable depth, so prune every orphaned tag rather
    // than trying to enumerate the affected ones.
    await pruneOrphanTags(this.prisma);
    return { id, deleted: true };
  }

  async setPublished(id: string, user: AuthUser, published: boolean) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);
    const saved = await this.prisma.collection.update({
      where: { id: collection.id },
      data: { published, version: { increment: 1 } },
    });
    return this.toPublicCollection(saved);
  }

  async setLinkSharing(id: string, user: AuthUser, dto: SetLinkSharingDto) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);

    if (!dto.enabled) {
      // Disabling clears the token so an old link can never be resurrected.
      await this.prisma.collection.update({
        where: { id: collection.id },
        data: {
          linkSharingEnabled: false,
          shareTokenHash: null,
          version: { increment: 1 },
        },
      });
      return { collectionId: collection.id, linkSharingEnabled: false };
    }

    const needsToken = !collection.shareTokenHash || dto.rotate === true;
    let token: string | undefined;
    let shareTokenHash = collection.shareTokenHash ?? undefined;
    if (needsToken) {
      token = randomBytes(24).toString("base64url");
      shareTokenHash = createHash("sha256").update(token).digest("hex");
    }

    await this.prisma.collection.update({
      where: { id: collection.id },
      data: {
        linkSharingEnabled: true,
        shareTokenHash,
        version: { increment: 1 },
      },
    });

    return {
      collectionId: collection.id,
      linkSharingEnabled: true,
      // Raw token is shown once, only when freshly minted.
      ...(token ? { token, queryParam: `?s=${token}` } : {}),
    };
  }

  // --- direct sharing -----------------------------------------------------

  async createShare(id: string, user: AuthUser, dto: CreateShareDto) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);

    const target = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException("No account found for that email");
    }

    const role = dto.role ?? "reader";
    await this.prisma.collectionShare.upsert({
      where: {
        collectionId_userId: { collectionId: collection.id, userId: target.id },
      },
      update: { role, source: "direct" },
      create: {
        collectionId: collection.id,
        userId: target.id,
        role,
        source: "direct",
      },
    });

    return { collectionId: collection.id, userId: target.id, role };
  }

  async removeShare(id: string, user: AuthUser, targetUserId: string) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);
    await this.prisma.collectionShare.deleteMany({
      where: { collectionId: collection.id, userId: targetUserId },
    });
    return { collectionId: collection.id, userId: targetUserId, removed: true };
  }

  async listShares(id: string, user: AuthUser) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);
    const shares = await this.prisma.collectionShare.findMany({
      where: { collectionId: collection.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return shares.map((share) => ({
      userId: share.userId,
      displayName: share.user.name,
      role: share.role,
      source: share.source,
    }));
  }

  // --- ownership transfer -------------------------------------------------

  // Google-Drive ownership transfer: only the current owner can transfer, and
  // only to a user who is already an editor. The collection subtree moves into
  // the recipient's hub (their "MyDrive"); the previous owner keeps editor
  // access (lands in their shared/); the immutable creator is untouched.
  async transfer(id: string, user: AuthUser, dto: TransferCollectionDto) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user); // owner-only

    const recipient = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!recipient) {
      throw new NotFoundException("No account found for that email");
    }
    if (recipient.id === user.userId) {
      throw new BadRequestException("You already own this collection");
    }

    // Drive rule: the recipient must already be an editor on the collection.
    const share = await this.prisma.collectionShare.findUnique({
      where: { collectionId_userId: { collectionId: collection.id, userId: recipient.id } },
      select: { role: true },
    });
    if (!share || share.role !== "editor") {
      throw new BadRequestException("Recipient must already be an editor on this collection");
    }

    const recipientHub = await this.prisma.hub.findUnique({
      where: { ownerUserId: recipient.id },
      select: { id: true },
    });
    if (!recipientHub) {
      throw new BadRequestException("Recipient has no hub");
    }

    const subtreeIds = await this.collectSubtreeIds(collection.id);

    // The recipient's hub cannot already hold a collection whose slug collides
    // with one in the moving subtree ((hubId, slug) is unique).
    const subtree = await this.prisma.collection.findMany({
      where: { id: { in: subtreeIds } },
      select: { slug: true },
    });
    const conflict = await this.prisma.collection.findFirst({
      where: {
        hubId: recipientHub.id,
        slug: { in: subtree.map((c) => c.slug) },
        id: { notIn: subtreeIds },
      },
      select: { slug: true },
    });
    if (conflict) {
      throw new ConflictException(
        `The recipient already has a collection with slug '${conflict.slug}'`,
      );
    }

    const previousOwnerId = user.userId;
    await this.prisma.$transaction(async (tx) => {
      // Move the whole subtree into the recipient's hub.
      await tx.collection.updateMany({
        where: { id: { in: subtreeIds } },
        data: { hubId: recipientHub.id, version: { increment: 1 } },
      });
      // Detach the transferred root from its old parent (which stayed behind).
      await tx.collection.update({
        where: { id: collection.id },
        data: { parentCollectionId: null },
      });
      // The recipient now owns the subtree, so their shares on it are redundant.
      await tx.collectionShare.deleteMany({
        where: { collectionId: { in: subtreeIds }, userId: recipient.id },
      });
      // Give the previous owner editor access across the subtree (their shared/).
      await tx.collectionShare.deleteMany({
        where: { collectionId: { in: subtreeIds }, userId: previousOwnerId },
      });
      await tx.collectionShare.createMany({
        data: subtreeIds.map((collectionId) => ({
          collectionId,
          userId: previousOwnerId,
          role: "editor",
          source: "direct",
        })),
      });
    });

    return {
      collectionId: collection.id,
      transferredTo: recipient.id,
      previousOwner: previousOwnerId,
      movedCollections: subtreeIds.length,
    };
  }

  // Collect a collection and all its descendants (bounded by the depth-8
  // hierarchy trigger, so the iteration terminates quickly).
  private async collectSubtreeIds(rootId: string): Promise<string[]> {
    const ids = [rootId];
    let frontier = [rootId];
    while (frontier.length > 0) {
      const children = await this.prisma.collection.findMany({
        where: { parentCollectionId: { in: frontier } },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length === 0) {
        break;
      }
      ids.push(...childIds);
      frontier = childIds;
    }
    return ids;
  }

  // --- saves --------------------------------------------------------------

  async save(id: string, user: AuthUser) {
    const collection = await this.requireCollection(id);
    if (!collection.published) {
      throw new BadRequestException("Only published collections can be saved");
    }
    await this.prisma.collectionSave.upsert({
      where: {
        collectionId_userId: {
          collectionId: collection.id,
          userId: user.userId,
        },
      },
      update: {},
      create: { collectionId: collection.id, userId: user.userId },
    });
    return { collectionId: collection.id, saved: true };
  }

  async unsave(id: string, user: AuthUser) {
    await this.prisma.collectionSave.deleteMany({
      where: { collectionId: id, userId: user.userId },
    });
    return { collectionId: id, saved: false };
  }

  // --- user surfaces ------------------------------------------------------

  async listShared(user: AuthUser) {
    const shares = await this.prisma.collectionShare.findMany({
      where: { userId: user.userId },
      include: { collection: true },
      orderBy: { createdAt: "desc" },
    });
    // Link-sourced access is valid only while link sharing stays enabled.
    return shares
      .filter((s) => s.source === "direct" || s.collection.linkSharingEnabled)
      .map((s) => ({
        ...this.toPublicCollection(s.collection),
        shareRole: s.role,
        shareSource: s.source,
      }));
  }

  async listSaved(user: AuthUser) {
    const saves = await this.prisma.collectionSave.findMany({
      where: { userId: user.userId },
      include: { collection: true },
      orderBy: { savedAt: "desc" },
    });
    // Dormant handling: an unpublished save stays listed but marked
    // unavailable, and revives when the collection is republished.
    return saves.map((s) => ({
      ...this.toPublicCollection(s.collection),
      savedAt: s.savedAt,
      available: s.collection.published,
    }));
  }

  // --- discovery / lookup -------------------------------------------------

  async explore(query: CursorQueryDto) {
    return this.listPublishedCollections(query, {});
  }

  async getHubPage(hubId: string, query: CursorQueryDto) {
    const hub = await this.prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) {
      throw new NotFoundException("Hub not found");
    }
    const collections = await this.listPublishedCollections(query, { hubId });
    return {
      hub: { id: hub.id, handle: hub.handle, description: hub.description },
      collections: collections.items,
      meta: collections.meta,
    };
  }

  async listHubCollections(hubId: string, viewer: AuthUser | null, query: CursorQueryDto) {
    const hub = await this.prisma.hub.findUnique({
      where: { id: hubId },
      select: { id: true },
    });
    if (!hub) {
      throw new NotFoundException("Hub not found");
    }

    const isOwner = viewer !== null && (await this.hubs.isOwner(hubId, viewer.userId));

    // The owner sees every collection; everyone else sees the published subset.
    return this.listCollectionsKeyset(query, {
      hubId,
      ...(isOwner ? {} : { published: true }),
    });
  }

  async getHubCollectionBySlug(
    hubId: string,
    slug: string,
    viewer: AuthUser | null,
    shareToken?: string,
  ) {
    const collection = await this.prisma.collection.findUnique({
      where: { hubId_slug: { hubId, slug } },
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

    return {
      collection: this.toPublicCollection(collection),
      etag: toVersionEtag(Number(collection.version)),
      lastModified: collection.updatedAt.toUTCString(),
    };
  }

  async getChildren(
    id: string,
    viewer: AuthUser | null,
    shareToken: string | undefined,
    query: PaginationQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const parent = await this.requireCollection(id);
    await this.policy.requireRead(parent, viewer, shareToken);

    const children = await this.prisma.collection.findMany({
      where: { parentCollectionId: id },
      orderBy: { updatedAt: "desc" },
    });

    const visibleChildren: Collection[] = [];
    for (const child of children) {
      const access = await this.policy.resolve(child, viewer, shareToken);
      if (access.canRead) {
        visibleChildren.push(child);
      }
    }

    const start = (page - 1) * limit;
    const pagedChildren = visibleChildren.slice(start, start + limit);
    return {
      items: pagedChildren.map((child) => this.toPublicCollection(child)),
      meta: { page, limit, total: visibleChildren.length },
    };
  }

  // --- internals ----------------------------------------------------------

  private async createInHub(user: AuthUser, hubId: string, dto: CreateCollectionDto) {
    if (dto.parentCollectionId) {
      const parent = await this.requireCollection(
        dto.parentCollectionId,
        "Parent collection not found",
      );
      if (parent.hubId !== hubId) {
        throw new BadRequestException("Parent collection must be in the same hub");
      }
    }

    const exists = await this.prisma.collection.findUnique({
      where: { hubId_slug: { hubId, slug: dto.slug } },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException("Collection slug already exists");
    }

    const saved = await this.prisma.collection.create({
      data: {
        hubId,
        // Immutable creator/provenance: unchanged if ownership is later
        // transferred (the owning hubId changes, the creator does not).
        creatorUserId: user.userId,
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        published: dto.published ?? false,
        parentCollectionId: dto.parentCollectionId ?? null,
      },
    });
    return this.toPublicCollection(saved);
  }

  private async listPublishedCollections(query: CursorQueryDto, extraWhere: { hubId?: string }) {
    return this.listCollectionsKeyset(query, {
      published: true,
      ...extraWhere,
    });
  }

  private async listCollectionsKeyset(
    query: CursorQueryDto,
    where: { hubId?: string; published?: boolean },
  ) {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? decodeCursor<{ u: string; id: string }>(query.cursor) : null;
    if (
      query.cursor &&
      (cursor === null ||
        typeof cursor.u !== "string" ||
        typeof cursor.id !== "string" ||
        Number.isNaN(Date.parse(cursor.u)))
    ) {
      throw new BadRequestException("Invalid cursor");
    }

    const rows = await this.prisma.collection.findMany({
      where: {
        ...where,
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: new Date(cursor.u) } },
                { updatedAt: new Date(cursor.u), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > limit && last
        ? encodeCursor({ u: last.updatedAt.toISOString(), id: last.id })
        : null;

    return {
      items: items.map((item) => this.toPublicCollection(item)),
      meta: { limit, nextCursor },
    };
  }

  private async requireUserHub(user: AuthUser): Promise<string> {
    const hubId = await this.hubs.getUserHubId(user.userId);
    if (!hubId) {
      throw new BadRequestException("No hub available for this user");
    }
    return hubId;
  }

  private async requireCollection(
    id: string,
    message = "Collection not found",
  ): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });
    if (!collection) {
      throw new NotFoundException(message);
    }
    return collection;
  }

  private toPublicCollection(collection: Collection) {
    return {
      id: collection.id,
      hubId: collection.hubId,
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      published: collection.published,
      linkSharingEnabled: collection.linkSharingEnabled,
      parentCollectionId: collection.parentCollectionId,
      version: Number(collection.version),
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }
}
