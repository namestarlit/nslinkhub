import { createHash, randomBytes } from "node:crypto";
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
import { parseIfMatchVersion, toVersionEtag } from "src/common/utils/etag.util";
import { normalizeTags } from "src/common/utils/tags.util";
import { PrismaService } from "src/database/prisma.service";
import { Collection, Hub } from "src/generated/prisma/client";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import { HubsService } from "../hubs/hubs.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { CreateShareDto } from "./dto/create-share.dto";
import { NestCollectionDto } from "./dto/nest-collection.dto";
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

  // Nest an existing collection into another as a section. This is the single
  // way to create nesting: a collection must exist first, then it is added into
  // a container. Nesting is one relationship with two faces — the structural
  // parent link and the section entry in the container — created atomically.
  async nestCollection(containerId: string, user: AuthUser, dto: NestCollectionDto) {
    const container = await this.requireCollection(containerId, "Collection not found");
    await this.policy.requireManage(container, user); // owner-only

    if (dto.collectionId === container.id) {
      throw new BadRequestException("A collection cannot be nested in itself");
    }

    const target = await this.requireCollection(dto.collectionId, "Collection not found");
    // Same hub — since the caller owns the container's hub, this is their hub.
    if (target.hubId !== container.hubId) {
      throw new BadRequestException("Both collections must be in your hub");
    }
    // Two-level rules (also enforced by the check_collection_hierarchy trigger).
    if (container.parentCollectionId) {
      throw new BadRequestException("A section cannot contain collections (two-level limit)");
    }
    if (target.parentCollectionId) {
      throw new BadRequestException("That collection is already nested in another collection");
    }
    const targetSections = await this.prisma.collection.count({
      where: { parentCollectionId: target.id },
    });
    if (targetSections > 0) {
      throw new BadRequestException("A collection that has its own sections cannot be nested");
    }

    const maxPositionResult = await this.prisma.resource.aggregate({
      where: { collectionId: container.id },
      _max: { position: true },
    });
    const nextPosition = (maxPositionResult._max.position ?? -1) + 1;

    await this.prisma.$transaction([
      this.prisma.collection.update({
        where: { id: target.id },
        data: { parentCollectionId: container.id },
      }),
      this.prisma.resource.create({
        data: {
          collectionId: container.id,
          kind: ResourceKind.COLLECTION_LINK,
          linkedCollectionId: target.id,
          position: nextPosition,
          titleOverride: target.title,
        },
      }),
    ]);

    return { containerId: container.id, collectionId: target.id, position: nextPosition };
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

    // Nesting is not changed here — it is managed only by nestCollection /
    // removing a section entry, so there is one way to nest and un-nest.
    const saved = await this.prisma.collection.update({
      where: { id: collection.id },
      data: {
        slug: dto.slug ?? collection.slug,
        title: dto.title ?? collection.title,
        description: dto.description ?? collection.description,
        ...(dto.tags !== undefined ? { tags: normalizeTags(dto.tags) } : {}),
        published: dto.published ?? collection.published,
        version: { increment: 1 },
      },
    });
    return this.toPublicCollection(saved);
  }

  async remove(id: string, user: AuthUser) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);
    await this.prisma.collection.delete({ where: { id: collection.id } });
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
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return shares.map((share) => ({
      userId: share.userId,
      displayName: share.user.name,
      // Display names are not unique, so direct shares echo back the email the
      // owner shared with. Link-source viewers never gave the owner their
      // email, so it is not exposed for them.
      email: share.source === "direct" ? share.user.email : null,
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

    // Only a top-level collection can be transferred — it moves with its whole
    // subtree (sections). Transferring a section alone would strand the parent's
    // section link and split third parties' inherited access.
    if (collection.parentCollectionId) {
      throw new BadRequestException(
        "Only a top-level collection can be transferred (it moves with its sections)",
      );
    }

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
    if (share?.role !== "editor") {
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
    return this.buildHubPage(hub, query);
  }

  // Handle resolution for /@handle pages. The handle is the handy way in; the
  // payload carries the immutable hubId, which is what clients keep. Handle
  // semantics stay in the hubs module.
  async getHubPageByHandle(handle: string, query: CursorQueryDto) {
    const hub = await this.hubs.getHubByHandle(handle);
    return this.buildHubPage(hub, query);
  }

  private async buildHubPage(hub: Hub | null, query: CursorQueryDto) {
    if (!hub) {
      throw new NotFoundException("Hub not found");
    }
    const collections = await this.listPublishedCollections(query, { hubId: hub.id });
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
    return this.readCollectionView(collection, viewer, shareToken);
  }

  // Durable lookup by the immutable collection id — the reference that
  // survives a slug rename (hub+slug is the pretty URL, this is the permalink).
  async getById(id: string, viewer: AuthUser | null, shareToken?: string) {
    const collection = await this.requireCollection(id);
    return this.readCollectionView(collection, viewer, shareToken);
  }

  private async readCollectionView(
    collection: Collection,
    viewer: AuthUser | null,
    shareToken?: string,
  ) {
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

  async getChildren(id: string, viewer: AuthUser | null, shareToken: string | undefined) {
    const parent = await this.requireCollection(id);
    await this.policy.requireRead(parent, viewer, shareToken);

    // Access inherits down the ancestor chain, so any grant that reads the
    // parent covers every child — no per-child policy check. Sections are
    // human-curated and bounded by the two-level cap, so the list is small
    // and unpaginated; section *order* lives in the parent's resources.
    const children = await this.prisma.collection.findMany({
      where: { parentCollectionId: id },
      orderBy: { updatedAt: "desc" },
    });
    return children.map((child) => this.toPublicCollection(child));
  }

  // --- internals ----------------------------------------------------------

  // Collections are always created as top-level. Nesting is a separate action
  // on an existing collection (nestCollection).
  private async createInHub(user: AuthUser, hubId: string, dto: CreateCollectionDto) {
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
        tags: normalizeTags(dto.tags),
        published: dto.published ?? false,
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
      tags: collection.tags,
      published: collection.published,
      linkSharingEnabled: collection.linkSharingEnabled,
      parentCollectionId: collection.parentCollectionId,
      version: Number(collection.version),
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }
}
