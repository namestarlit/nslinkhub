import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { EntryKind } from 'src/common/enums/entry-kind.enum';
import { RepositoryVisibility } from 'src/common/enums/repository-visibility.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { Repository } from 'typeorm';
import { LinkEntity } from '../links/entities/link.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { CreateExternalEntryDto } from './dto/create-external-entry.dto';
import { CreateRepositoryLinkEntryDto } from './dto/create-repository-link-entry.dto';
import { ReorderEntriesDto } from './dto/reorder-entries.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { EntryEntity } from './entities/entry.entity';

@Injectable()
export class EntriesService {
  constructor(
    @InjectRepository(EntryEntity)
    private readonly entriesRepo: Repository<EntryEntity>,
    @InjectRepository(LinkEntity)
    private readonly linksRepo: Repository<LinkEntity>,
    @InjectRepository(RepositoryEntity)
    private readonly repositoriesRepo: Repository<RepositoryEntity>,
  ) {}

  async createExternal(
    repositoryId: string,
    user: AuthUser,
    dto: CreateExternalEntryDto,
  ) {
    const repository = await this.requireWritableRepository(repositoryId, user);
    await this.ensurePositionAvailable(repository.id, dto.position);

    const canonicalUrl = canonicalizeUrl(dto.url);
    const urlHash = createHash('sha256').update(canonicalUrl).digest('hex');

    let link = await this.linksRepo.findOne({ where: { canonicalUrl } });
    if (!link) {
      link = this.linksRepo.create({ canonicalUrl, urlHash });
      link = await this.linksRepo.save(link);
    }

    const duplicate = await this.entriesRepo.exists({
      where: {
        repositoryId: repository.id,
        linkId: link.id,
      },
    });
    if (duplicate) {
      throw new ConflictException('Link already exists in this repository');
    }

    const entry = this.entriesRepo.create({
      repositoryId: repository.id,
      linkId: link.id,
      kind: EntryKind.EXTERNAL_LINK,
      titleOverride: dto.titleOverride ?? null,
      description: dto.description ?? null,
      note: dto.note ?? null,
      position: dto.position,
    });

    const saved = await this.entriesRepo.save(entry);
    return this.toPublicEntry(saved, link.canonicalUrl);
  }

  async createRepositoryLink(
    repositoryId: string,
    user: AuthUser,
    dto: CreateRepositoryLinkEntryDto,
  ) {
    const repository = await this.requireWritableRepository(repositoryId, user);
    await this.ensurePositionAvailable(repository.id, dto.position);

    const linkedRepository = await this.repositoriesRepo.findOne({
      where: { id: dto.linkedRepositoryId },
    });
    if (!linkedRepository) {
      throw new NotFoundException('Linked repository not found');
    }

    if (linkedRepository.id === repository.id) {
      throw new BadRequestException('Repository cannot link to itself');
    }

    const entry = this.entriesRepo.create({
      repositoryId: repository.id,
      kind: EntryKind.REPOSITORY_LINK,
      linkedRepositoryId: linkedRepository.id,
      titleOverride: dto.titleOverride ?? linkedRepository.title,
      description: dto.description ?? null,
      note: dto.note ?? null,
      position: dto.position,
    });

    const saved = await this.entriesRepo.save(entry);
    return this.toPublicEntry(saved);
  }

  async getByRepository(
    repositoryId: string,
    viewer: AuthUser | null,
    shareToken: string | undefined,
    query: PaginationQueryDto,
  ) {
    await this.requireReadableRepository(repositoryId, viewer, shareToken);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.entriesRepo.findAndCount({
      where: { repositoryId },
      relations: { link: true, linkedRepository: true },
      order: { position: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((item) =>
        this.toPublicEntry(item, item.link?.canonicalUrl),
      ),
      meta: { page, limit, total },
    };
  }

  async update(
    repositoryId: string,
    entryId: string,
    user: AuthUser,
    dto: UpdateEntryDto,
  ) {
    await this.requireWritableRepository(repositoryId, user);

    const entry = await this.entriesRepo.findOne({
      where: { id: entryId, repositoryId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    if (Number(entry.version) !== dto.version) {
      throw new ConflictException('Version mismatch');
    }

    if (dto.position !== undefined && dto.position !== entry.position) {
      await this.ensurePositionAvailable(repositoryId, dto.position, entry.id);
      entry.position = dto.position;
    }

    entry.titleOverride = dto.titleOverride ?? entry.titleOverride;
    entry.description = dto.description ?? entry.description;
    entry.note = dto.note ?? entry.note;

    const saved = await this.entriesRepo.save(entry);
    return this.toPublicEntry(saved);
  }

  async remove(repositoryId: string, entryId: string, user: AuthUser) {
    await this.requireWritableRepository(repositoryId, user);

    const entry = await this.entriesRepo.findOne({
      where: { id: entryId, repositoryId },
    });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    await this.entriesRepo.remove(entry);
    return { id: entry.id, deleted: true };
  }

  async reorder(repositoryId: string, user: AuthUser, dto: ReorderEntriesDto) {
    await this.requireWritableRepository(repositoryId, user);

    const entries = await this.entriesRepo.find({ where: { repositoryId } });
    if (entries.length !== dto.items.length) {
      throw new BadRequestException('Reorder payload must include all entries');
    }

    const entryIdSet = new Set(entries.map((entry) => entry.id));
    const payloadIdSet = new Set(dto.items.map((item) => item.entryId));

    if (entryIdSet.size !== payloadIdSet.size) {
      throw new BadRequestException('Duplicate entry IDs in reorder payload');
    }

    for (const payloadId of payloadIdSet) {
      if (!entryIdSet.has(payloadId)) {
        throw new BadRequestException('Unknown entry ID in reorder payload');
      }
    }

    const positions = dto.items
      .map((item) => item.position)
      .sort((a, b) => a - b);
    for (let i = 0; i < positions.length; i += 1) {
      if (positions[i] !== i) {
        throw new BadRequestException(
          'Positions must be contiguous from 0..n-1',
        );
      }
    }

    const stale = entries.some(
      (entry) => Number(entry.version) !== dto.version,
    );
    if (stale) {
      throw new ConflictException('Version mismatch');
    }

    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    await this.entriesRepo.manager.transaction(async (manager) => {
      for (const item of dto.items) {
        const entry = byId.get(item.entryId)!;
        entry.position = item.position;
        await manager.save(entry);
      }
    });

    return { reordered: true, count: dto.items.length };
  }

  private async requireWritableRepository(
    repositoryId: string,
    user: AuthUser,
  ) {
    const repository = await this.repositoriesRepo.findOne({
      where: { id: repositoryId },
    });
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    if (user.role !== UserRole.ADMIN && repository.ownerId !== user.userId) {
      throw new ForbiddenException('Forbidden');
    }

    return repository;
  }

  private async requireReadableRepository(
    repositoryId: string,
    viewer: AuthUser | null,
    shareToken: string | undefined,
  ) {
    const repository = await this.repositoriesRepo.findOne({
      where: { id: repositoryId },
    });
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    if (repository.visibility === RepositoryVisibility.PUBLIC) {
      return repository;
    }

    if (
      viewer &&
      (viewer.role === UserRole.ADMIN || viewer.userId === repository.ownerId)
    ) {
      return repository;
    }

    if (repository.visibility === RepositoryVisibility.UNLISTED) {
      if (!shareToken || !repository.shareTokenHash) {
        throw new ForbiddenException('Invalid or missing share token');
      }

      const hash = createHash('sha256').update(shareToken).digest('hex');
      if (hash === repository.shareTokenHash) {
        return repository;
      }

      throw new ForbiddenException('Invalid or missing share token');
    }

    throw new ForbiddenException('Forbidden');
  }

  private async ensurePositionAvailable(
    repositoryId: string,
    position: number,
    ignoreEntryId?: string,
  ) {
    const existing = await this.entriesRepo.findOne({
      where: {
        repositoryId,
        position,
      },
    });

    if (existing && existing.id !== ignoreEntryId) {
      throw new ConflictException(
        'Position is already used in this repository',
      );
    }
  }

  private toPublicEntry(entry: EntryEntity, canonicalUrl?: string) {
    return {
      id: entry.id,
      repositoryId: entry.repositoryId,
      kind: entry.kind,
      linkId: entry.linkId,
      linkedRepositoryId: entry.linkedRepositoryId,
      url: canonicalUrl,
      titleOverride: entry.titleOverride,
      description: entry.description,
      note: entry.note,
      position: entry.position,
      version: Number(entry.version),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}

function canonicalizeUrl(url: string) {
  const parsed = new URL(url);

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
  ) {
    parsed.port = '';
  }

  if (parsed.pathname === '') {
    parsed.pathname = '/';
  }

  const params = [...parsed.searchParams.entries()]
    .filter(
      ([key]) =>
        !/^utm_/i.test(key) && !['fbclid', 'gclid'].includes(key.toLowerCase()),
    )
    .sort(([a], [b]) => a.localeCompare(b));

  parsed.search = '';
  for (const [key, value] of params) {
    parsed.searchParams.append(key, value);
  }

  return parsed.toString();
}
