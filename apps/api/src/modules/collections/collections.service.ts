import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { HubsService } from '../hubs/hubs.service';
import { CreateChildCollectionDto } from './dto/create-child-collection.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hubs: HubsService,
  ) {}

  async create(user: AuthUser, dto: CreateCollectionDto) {
    const hubId = await this.requirePrimaryHub(user);
    return this.createInHub(user, hubId, dto);
  }

  async getPublic(query: CursorQueryDto) {
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

    // Keyset on (updatedAt desc, id desc); id breaks updatedAt ties.
    const rows = await this.prisma.collection.findMany({
      where: {
        published: true,
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

  async getByOwnerAndSlug(
    owner: string,
    slug: string,
    viewer: AuthUser | null,
    shareToken?: string,
  ) {
    // Interim: resolve the owner's personal hub, then the slug within it.
    // Phase C replaces this with GET /hubs/:hubId/collections/:slug.
    const ownerUser = await this.prisma.user.findUnique({
      where: { username: owner },
      select: { id: true },
    });
    if (!ownerUser) {
      throw new NotFoundException('Collection not found');
    }

    const hubId = await this.hubs.getPrimaryHubId(ownerUser.id);
    const collection = hubId
      ? await this.prisma.collection.findUnique({
          where: { hubId_slug: { hubId, slug } },
        })
      : null;

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    await this.ensureReadAccess(collection, viewer, shareToken);

    return {
      collection: this.toPublicCollection(collection),
      etag: toVersionEtag(Number(collection.version)),
      lastModified: collection.updatedAt.toUTCString(),
    };
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpdateCollectionDto,
    ifMatch?: string,
  ) {
    const collection = await this.requireCollection(id);
    await this.hubs.assertMember(collection.hubId, user);

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
    await this.hubs.assertMember(collection.hubId, user);
    await this.prisma.collection.delete({ where: { id: collection.id } });
    return { id, deleted: true };
  }

  async createOrRotateShareLink(id: string, user: AuthUser) {
    const collection = await this.requireCollection(id);
    await this.hubs.assertMember(collection.hubId, user);

    const rawToken = randomBytes(24).toString('base64url');
    const hashed = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.collection.update({
      where: { id: collection.id },
      data: {
        shareTokenHash: hashed,
        linkSharingEnabled: true,
        version: { increment: 1 },
      },
    });

    return {
      collectionId: collection.id,
      token: rawToken,
      queryParam: `?s=${rawToken}`,
    };
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
    await this.hubs.assertMember(parent.hubId, user);

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

  async getChildren(
    id: string,
    viewer: AuthUser | null,
    shareToken: string | undefined,
    query: PaginationQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const parent = await this.requireCollection(id);
    await this.ensureReadAccess(parent, viewer, shareToken);

    const children = await this.prisma.collection.findMany({
      where: { parentCollectionId: id },
      orderBy: { updatedAt: 'desc' },
    });

    const visibleChildren: Collection[] = [];
    for (const child of children) {
      if (await this.canRead(child, viewer, shareToken)) {
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

  private async ensureReadAccess(
    collection: Collection,
    viewer: AuthUser | null,
    shareToken?: string,
  ): Promise<void> {
    if (!(await this.canRead(collection, viewer, shareToken))) {
      throw new ForbiddenException('Forbidden');
    }
  }

  // Access resolution (interim; Phase C moves this into the policy service):
  // published -> anyone; admin/member -> yes; active link + token -> read.
  private async canRead(
    collection: Collection,
    viewer: AuthUser | null,
    shareToken?: string,
  ): Promise<boolean> {
    if (collection.published) {
      return true;
    }
    if (viewer) {
      if (viewer.role === UserRole.ADMIN) {
        return true;
      }
      if (await this.hubs.isMember(collection.hubId, viewer.userId)) {
        return true;
      }
    }
    if (
      collection.linkSharingEnabled &&
      collection.shareTokenHash &&
      shareToken
    ) {
      const hash = createHash('sha256').update(shareToken).digest('hex');
      if (hash === collection.shareTokenHash) {
        return true;
      }
    }
    return false;
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
