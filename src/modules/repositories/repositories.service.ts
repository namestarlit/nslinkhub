import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository as TypeOrmRepository } from 'typeorm';
import { EntryKind } from 'src/common/enums/entry-kind.enum';
import { RepositoryVisibility } from 'src/common/enums/repository-visibility.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { parseIfMatchVersion, toVersionEtag } from 'src/common/utils/etag.util';
import { EntryEntity } from '../entries/entities/entry.entity';
import { CreateChildRepositoryDto } from './dto/create-child-repository.dto';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import { RepositoryEntity } from './entities/repository.entity';

@Injectable()
export class RepositoriesService {
  constructor(
    @InjectRepository(RepositoryEntity)
    private readonly repositoriesRepo: TypeOrmRepository<RepositoryEntity>,
    @InjectRepository(EntryEntity)
    private readonly entriesRepo: TypeOrmRepository<EntryEntity>,
  ) {}

  async create(user: AuthUser, dto: CreateRepositoryDto) {
    if (dto.visibility === RepositoryVisibility.UNLISTED) {
      throw new BadRequestException(
        'Create repository as private/public first, then create share link and switch to unlisted',
      );
    }

    if (dto.parentRepositoryId) {
      const parent = await this.repositoriesRepo.findOne({
        where: { id: dto.parentRepositoryId },
      });

      if (!parent) {
        throw new NotFoundException('Parent repository not found');
      }

      this.ensureWriteAccess(user, parent.ownerId);
    }

    const exists = await this.repositoriesRepo.exists({
      where: {
        ownerId: user.userId,
        slug: dto.slug,
      },
    });

    if (exists) {
      throw new ConflictException('Repository slug already exists');
    }

    const repository = this.repositoriesRepo.create({
      ownerId: user.userId,
      slug: dto.slug,
      title: dto.title,
      description: dto.description,
      visibility: dto.visibility ?? RepositoryVisibility.PRIVATE,
      parentRepositoryId: dto.parentRepositoryId ?? null,
    });

    const saved = await this.repositoriesRepo.save(repository);
    return this.toPublicRepository(saved);
  }

  async getPublic(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, count] = await this.repositoriesRepo.findAndCount({
      where: { visibility: RepositoryVisibility.PUBLIC },
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

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
    const repository = await this.repositoriesRepo.findOne({
      where: {
        slug,
        owner: { username: owner },
      },
      relations: {
        owner: true,
      },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    this.ensureReadAccess(repository, viewer, shareToken);

    return {
      repository: this.toPublicRepository(repository),
      etag: toVersionEtag(repository.version),
      lastModified: repository.updatedAt.toUTCString(),
    };
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpdateRepositoryDto,
    ifMatch?: string,
  ) {
    const repository = await this.repositoriesRepo.findOne({ where: { id } });

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
      const exists = await this.repositoriesRepo.exists({
        where: { ownerId: repository.ownerId, slug: dto.slug },
      });

      if (exists) {
        throw new ConflictException('Repository slug already exists');
      }
    }

    if (
      dto.parentRepositoryId !== undefined &&
      dto.parentRepositoryId !== repository.parentRepositoryId
    ) {
      if (dto.parentRepositoryId === null) {
        repository.parentRepositoryId = null;
      } else {
        if (dto.parentRepositoryId === repository.id) {
          throw new BadRequestException(
            'Repository cannot be parent of itself',
          );
        }

        const parent = await this.repositoriesRepo.findOne({
          where: { id: dto.parentRepositoryId },
        });

        if (!parent) {
          throw new NotFoundException('Parent repository not found');
        }

        this.ensureWriteAccess(user, parent.ownerId);
      }
    }

    Object.assign(repository, {
      slug: dto.slug ?? repository.slug,
      title: dto.title ?? repository.title,
      description: dto.description ?? repository.description,
      visibility: dto.visibility ?? repository.visibility,
      parentRepositoryId:
        dto.parentRepositoryId === undefined
          ? repository.parentRepositoryId
          : dto.parentRepositoryId,
    });

    if (
      repository.visibility === RepositoryVisibility.UNLISTED &&
      !repository.shareTokenHash
    ) {
      throw new BadRequestException(
        'Unlisted repository requires share token, create it first via share-link endpoint',
      );
    }

    const saved = await this.repositoriesRepo.save(repository);
    return this.toPublicRepository(saved);
  }

  async remove(id: string, user: AuthUser) {
    const repository = await this.repositoriesRepo.findOne({ where: { id } });
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    this.ensureWriteAccess(user, repository.ownerId);
    await this.repositoriesRepo.remove(repository);

    return { id, deleted: true };
  }

  async createOrRotateShareLink(id: string, user: AuthUser) {
    const repository = await this.repositoriesRepo.findOne({ where: { id } });
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    this.ensureWriteAccess(user, repository.ownerId);

    const rawToken = randomBytes(24).toString('base64url');
    const hashed = createHash('sha256').update(rawToken).digest('hex');

    repository.shareTokenHash = hashed;
    await this.repositoriesRepo.save(repository);

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
    const parent = await this.repositoriesRepo.findOne({
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

    const childRepository = await this.repositoriesRepo.findOneOrFail({
      where: { id: child.id },
    });

    const maxPositionResult = await this.entriesRepo
      .createQueryBuilder('entry')
      .select('COALESCE(MAX(entry.position), -1)', 'max')
      .where('entry.repository_id = :repositoryId', { repositoryId: parent.id })
      .getRawOne<{ max: string }>();

    const nextPosition = Number(maxPositionResult?.max ?? -1) + 1;

    const linkEntry = this.entriesRepo.create({
      repositoryId: parent.id,
      kind: EntryKind.REPOSITORY_LINK,
      linkedRepositoryId: childRepository.id,
      position: nextPosition,
      titleOverride: childRepository.title,
    });

    await this.entriesRepo.save(linkEntry);
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
    const parent = await this.repositoriesRepo.findOne({
      where: { id },
    });

    if (!parent) {
      throw new NotFoundException('Repository not found');
    }

    this.ensureReadAccess(parent, viewer, shareToken);

    const children = await this.repositoriesRepo.find({
      where: { parentRepositoryId: id },
      order: { updatedAt: 'DESC' },
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
    repository: RepositoryEntity,
    viewer: AuthUser | null,
    shareToken?: string,
    failClosed = false,
  ) {
    if (repository.visibility === RepositoryVisibility.PUBLIC) {
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

    if (repository.visibility === RepositoryVisibility.UNLISTED) {
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

  private toPublicRepository(repository: RepositoryEntity) {
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
