import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { ResourceKind } from 'src/common/enums/resource-kind.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { CursorQueryDto } from 'src/common/dto/cursor-query.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { decodeCursor, encodeCursor } from 'src/common/utils/cursor.util';
import { parseIfMatchVersion, toVersionEtag } from 'src/common/utils/etag.util';
import { Collection } from 'src/generated/prisma/client';
import { CollectionPolicyService } from '../hubs/collection-policy.service';
import { HubsService } from '../hubs/hubs.service';
import { CreateChildCollectionDto } from './dto/create-child-collection.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { CreateShareDto } from './dto/create-share.dto';
import { SetLinkSharingDto } from './dto/set-link-sharing.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hubs: HubsService,
    private readonly policy: CollectionPolicyService,
  ) {}

  // --- creation -----------------------------------------------------------

  async create(user: AuthUser, dto: CreateCollectionDto) {
    const hubId = await this.requirePrimaryHub(user);
    return this.createInHub(user, hubId, dto);
  }

  async createChild(
    parentId: string,
    user: AuthUser,
    dto: CreateChildCollectionDto,
  ) {
    const parent = await this.requireCollection(
      parentId,
      'Parent collection not found',
    );
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

  async update(
    id: string,
    user: AuthUser,
    dto: UpdateCollectionDto,
    ifMatch?: string,
  ) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);

    const versionFromHeader = parseIfMatchVersion(ifMatch);
    if (
      versionFromHeader !== null &&
      versionFromHeader !== Number(collection.version)
    ) {
      throw new ConflictException('Version mismatch');
    }
    if (Number(dto.version) !== Number(collection.version)) {
      throw new ConflictException('Version mismatch');
    }

    if (dto.slug && dto.slug !== collection.slug) {
      const exists = await this.prisma.collection.findUnique({
        where: { hubId_slug: { hubId: collection.hubId, slug: dto.slug } },
        select: { id: true },
      });
      if (exists) {
        throw new ConflictException('Collection slug already exists');
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
          throw new BadRequestException(
            'Collection cannot be parent of itself',
          );
        }
        const parent = await this.requireCollection(
          dto.parentCollectionId,
          'Parent collection not found',
        );
        if (parent.hubId !== collection.hubId) {
          throw new BadRequestException(
            'Parent collection must be in the same hub',
          );
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
      token = randomBytes(24).toString('base64url');
      shareTokenHash = createHash('sha256').update(token).digest('hex');
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
      select: { id: true, username: true },
    });
    if (!target) {
      throw new NotFoundException('No account found for that email');
    }

    const role = dto.role ?? 'reader';
    await this.prisma.collectionShare.upsert({
      where: {
        collectionId_userId: { collectionId: collection.id, userId: target.id },
      },
      update: { role, source: 'direct' },
      create: {
        collectionId: collection.id,
        userId: target.id,
        role,
        source: 'direct',
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
      include: { user: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return shares.map((share) => ({
      userId: share.userId,
      username: share.user.username,
      role: share.role,
      source: share.source,
    }));
  }

  // --- saves --------------------------------------------------------------

  async save(id: string, user: AuthUser) {
    const collection = await this.requireCollection(id);
    if (!collection.published) {
      throw new BadRequestException('Only published collections can be saved');
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
      orderBy: { createdAt: 'desc' },
    });
    // Link-sourced access is valid only while link sharing stays enabled.
    return shares
      .filter((s) => s.source === 'direct' || s.collection.linkSharingEnabled)
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
      orderBy: { savedAt: 'desc' },
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
      throw new NotFoundException('Hub not found');
    }
    const collections = await this.listPublishedCollections(query, { hubId });
    return {
      hub: { id: hub.id, name: hub.name, description: hub.description },
      collections: collections.items,
      meta: collections.meta,
    };
  }

  async listHubCollections(
    hubId: string,
    viewer: AuthUser | null,
    query: CursorQueryDto,
  ) {
    const hub = await this.prisma.hub.findUnique({
      where: { id: hubId },
      select: { id: true },
    });
    if (!hub) {
      throw new NotFoundException('Hub not found');
    }

    const isMember =
      viewer !== null &&
      (viewer.role === UserRole.ADMIN ||
        (await this.hubs.isMember(hubId, viewer.userId)));

    // Members see every collection; everyone else sees the published subset.
    return this.listCollectionsKeyset(query, {
      hubId,
      ...(isMember ? {} : { published: true }),
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
      throw new NotFoundException('Collection not found');
    }

    const access = await this.policy.requireRead(
      collection,
      viewer,
      shareToken,
    );
    if (access.viaLinkToken && viewer) {
      await this.policy.recordLinkAccess(collection.id, viewer.userId);
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
      orderBy: { updatedAt: 'desc' },
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

  private async createInHub(
    user: AuthUser,
    hubId: string,
    dto: CreateCollectionDto,
  ) {
    if (dto.parentCollectionId) {
      const parent = await this.requireCollection(
        dto.parentCollectionId,
        'Parent collection not found',
      );
      if (parent.hubId !== hubId) {
        throw new BadRequestException(
          'Parent collection must be in the same hub',
        );
      }
    }

    const exists = await this.prisma.collection.findUnique({
      where: { hubId_slug: { hubId, slug: dto.slug } },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException('Collection slug already exists');
    }

    const saved = await this.prisma.collection.create({
      data: {
        hubId,
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        published: dto.published ?? false,
        parentCollectionId: dto.parentCollectionId ?? null,
      },
    });
    return this.toPublicCollection(saved);
  }

  private async listPublishedCollections(
    query: CursorQueryDto,
    extraWhere: { hubId?: string },
  ) {
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
    const cursor = query.cursor
      ? decodeCursor<{ u: string; id: string }>(query.cursor)
      : null;
    if (
      query.cursor &&
      (cursor === null ||
        typeof cursor.u !== 'string' ||
        typeof cursor.id !== 'string' ||
        Number.isNaN(Date.parse(cursor.u)))
    ) {
      throw new BadRequestException('Invalid cursor');
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
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
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

  private async requirePrimaryHub(user: AuthUser): Promise<string> {
    const hubId = await this.hubs.getPrimaryHubId(user.userId);
    if (!hubId) {
      throw new BadRequestException('No hub available for this user');
    }
    return hubId;
  }

  private async requireCollection(
    id: string,
    message = 'Collection not found',
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
