import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { EntryKind } from 'src/common/enums/entry-kind.enum';
import { RepositoryVisibility } from 'src/common/enums/repository-visibility.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { parseIfMatchVersion, toVersionEtag } from 'src/common/utils/etag.util';
import { Repository } from 'src/generated/prisma/client';
import { CreateChildRepositoryDto } from './dto/create-child-repository.dto';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';

@Injectable()
export class RepositoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreateRepositoryDto) {
    if (dto.visibility === RepositoryVisibility.UNLISTED) {
      throw new BadRequestException(
        'Create repository as private/public first, then create share link and switch to unlisted',
      );
    }

    if (dto.parentRepositoryId) {
      const parent = await this.prisma.repository.findUnique({
        where: { id: dto.parentRepositoryId },
      });

      if (!parent) {
        throw new NotFoundException('Parent repository not found');
      }

      this.ensureWriteAccess(user, parent.ownerId);
    }

    const exists = await this.prisma.repository.findUnique({
      where: {
        ownerId_slug: { ownerId: user.userId, slug: dto.slug },
      },
      select: { id: true },
    });

    if (exists) {
      throw new ConflictException('Repository slug already exists');
    }

    const saved = await this.prisma.repository.create({
      data: {
        ownerId: user.userId,
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        visibility: dto.visibility ?? RepositoryVisibility.PRIVATE,
        parentRepositoryId: dto.parentRepositoryId ?? null,
      },
    });

    return this.toPublicRepository(saved);
  }

  async getPublic(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { visibility: RepositoryVisibility.PUBLIC as string };
    const [items, count] = await this.prisma.$transaction([
      this.prisma.repository.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.repository.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toPublicRepository(item)),
      meta: {
        page,
        limit,
        total: count,
      },
    };
  }

  async getByOwnerAndSlug(
    owner: string,
    slug: string,
    viewer: AuthUser | null,
    shareToken?: string,
  ) {
    const repository = await this.prisma.repository.findFirst({
      where: {
        slug,
        owner: { username: owner },
      },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    this.ensureReadAccess(repository, viewer, shareToken);

    return {
      repository: this.toPublicRepository(repository),
      etag: toVersionEtag(Number(repository.version)),
      lastModified: repository.updatedAt.toUTCString(),
    };
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpdateRepositoryDto,
    ifMatch?: string,
  ) {
    const repository = await this.prisma.repository.findUnique({
      where: { id },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    this.ensureWriteAccess(user, repository.ownerId);

    const versionFromHeader = parseIfMatchVersion(ifMatch);
    if (
      versionFromHeader !== null &&
      versionFromHeader !== Number(repository.version)
    ) {
      throw new ConflictException('Version mismatch');
    }

    if (Number(dto.version) !== Number(repository.version)) {
      throw new ConflictException('Version mismatch');
    }

    if (dto.slug && dto.slug !== repository.slug) {
      const exists = await this.prisma.repository.findUnique({
        where: {
          ownerId_slug: { ownerId: repository.ownerId, slug: dto.slug },
        },
        select: { id: true },
      });

      if (exists) {
        throw new ConflictException('Repository slug already exists');
      }
    }

    let parentRepositoryId = repository.parentRepositoryId;
    if (
      dto.parentRepositoryId !== undefined &&
      dto.parentRepositoryId !== repository.parentRepositoryId
    ) {
      if (dto.parentRepositoryId === null) {
        parentRepositoryId = null;
      } else {
        if (dto.parentRepositoryId === repository.id) {
          throw new BadRequestException(
            'Repository cannot be parent of itself',
          );
        }

        const parent = await this.prisma.repository.findUnique({
          where: { id: dto.parentRepositoryId },
        });

        if (!parent) {
          throw new NotFoundException('Parent repository not found');
        }

        this.ensureWriteAccess(user, parent.ownerId);
        parentRepositoryId = dto.parentRepositoryId;
      }
    }

    const nextVisibility = (dto.visibility ??
      repository.visibility) as RepositoryVisibility;
    if (
      nextVisibility === RepositoryVisibility.UNLISTED &&
      !repository.shareTokenHash
    ) {
      throw new BadRequestException(
        'Unlisted repository requires share token, create it first via share-link endpoint',
      );
    }

    const saved = await this.prisma.repository.update({
      where: { id: repository.id },
      data: {
        slug: dto.slug ?? repository.slug,
        title: dto.title ?? repository.title,
        description: dto.description ?? repository.description,
        visibility: nextVisibility,
        parentRepositoryId,
        version: { increment: 1 },
      },
    });

    return this.toPublicRepository(saved);
  }

  async remove(id: string, user: AuthUser) {
    const repository = await this.prisma.repository.findUnique({
      where: { id },
    });
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    this.ensureWriteAccess(user, repository.ownerId);
    await this.prisma.repository.delete({ where: { id: repository.id } });

    return { id, deleted: true };
  }

  async createOrRotateShareLink(id: string, user: AuthUser) {
    const repository = await this.prisma.repository.findUnique({
      where: { id },
    });
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    this.ensureWriteAccess(user, repository.ownerId);

    const rawToken = randomBytes(24).toString('base64url');
    const hashed = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.repository.update({
      where: { id: repository.id },
      data: {
        shareTokenHash: hashed,
        version: { increment: 1 },
      },
    });

    return {
      repositoryId: repository.id,
      token: rawToken,
      queryParam: `?s=${rawToken}`,
    };
  }

  async createChild(
    parentId: string,
    user: AuthUser,
    dto: CreateChildRepositoryDto,
  ) {
    const parent = await this.prisma.repository.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      throw new NotFoundException('Parent repository not found');
    }

    this.ensureWriteAccess(user, parent.ownerId);

    const child = await this.create(user, {
      ...dto,
      parentRepositoryId: parent.id,
    });

    const maxPositionResult = await this.prisma.entry.aggregate({
      where: { repositoryId: parent.id },
      _max: { position: true },
    });

    const nextPosition = (maxPositionResult._max.position ?? -1) + 1;

    await this.prisma.entry.create({
      data: {
        repositoryId: parent.id,
        kind: EntryKind.REPOSITORY_LINK,
        linkedRepositoryId: child.id,
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
    const parent = await this.prisma.repository.findUnique({
      where: { id },
    });

    if (!parent) {
      throw new NotFoundException('Repository not found');
    }

    this.ensureReadAccess(parent, viewer, shareToken);

    const children = await this.prisma.repository.findMany({
      where: { parentRepositoryId: id },
      orderBy: { updatedAt: 'desc' },
    });

    const visibleChildren = children.filter((child) => {
      try {
        this.ensureReadAccess(child, viewer, shareToken, true);
        return true;
      } catch {
        return false;
      }
    });

    const start = (page - 1) * limit;
    const pagedChildren = visibleChildren.slice(start, start + limit);

    return {
      items: pagedChildren.map((child) => this.toPublicRepository(child)),
      meta: {
        page,
        limit,
        total: visibleChildren.length,
      },
    };
  }

  private ensureWriteAccess(user: AuthUser, ownerId: string) {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (user.userId !== ownerId) {
      throw new ForbiddenException('Forbidden');
    }
  }

  private ensureReadAccess(
    repository: Repository,
    viewer: AuthUser | null,
    shareToken?: string,
    failClosed = false,
  ) {
    const visibility = repository.visibility as RepositoryVisibility;
    if (visibility === RepositoryVisibility.PUBLIC) {
      return;
    }

    if (viewer) {
      if (
        viewer.role === UserRole.ADMIN ||
        viewer.userId === repository.ownerId
      ) {
        return;
      }
    }

    if (visibility === RepositoryVisibility.UNLISTED) {
      if (!repository.shareTokenHash || !shareToken) {
        throw new ForbiddenException('Invalid or missing share token');
      }

      const providedHash = createHash('sha256')
        .update(shareToken)
        .digest('hex');
      if (providedHash === repository.shareTokenHash) {
        return;
      }

      throw new ForbiddenException('Invalid or missing share token');
    }

    if (failClosed) {
      throw new ForbiddenException('Forbidden');
    }

    throw new ForbiddenException('Forbidden');
  }

  private toPublicRepository(repository: Repository) {
    return {
      id: repository.id,
      ownerId: repository.ownerId,
      slug: repository.slug,
      title: repository.title,
      description: repository.description,
      visibility: repository.visibility,
      parentRepositoryId: repository.parentRepositoryId,
      version: Number(repository.version),
      createdAt: repository.createdAt,
      updatedAt: repository.updatedAt,
    };
  }
}
