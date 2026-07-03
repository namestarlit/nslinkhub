import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { EntryKind } from 'src/common/enums/entry-kind.enum';
import { RepositoryVisibility } from 'src/common/enums/repository-visibility.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { canonicalizeUrl } from 'src/common/utils/url.util';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Entry } from 'src/generated/prisma/client';
import { CreateExternalEntryDto } from './dto/create-external-entry.dto';
import { CreateRepositoryLinkEntryDto } from './dto/create-repository-link-entry.dto';
import { ReorderEntriesDto } from './dto/reorder-entries.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';

@Injectable()
export class EntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async createExternal(
    repositoryId: string,
    user: AuthUser,
    dto: CreateExternalEntryDto,
  ) {
    const repository = await this.requireWritableRepository(repositoryId, user);
    await this.ensurePositionAvailable(repository.id, dto.position);

    const canonicalUrl = canonicalizeUrl(dto.url);
    const urlHash = createHash('sha256').update(canonicalUrl).digest('hex');

    let link = await this.prisma.link.findUnique({ where: { canonicalUrl } });
    if (!link) {
      link = await this.prisma.link.create({ data: { canonicalUrl, urlHash } });
    }

    const duplicate = await this.prisma.entry.findFirst({
      where: {
        repositoryId: repository.id,
        linkId: link.id,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Link already exists in this repository');
    }

    const saved = await this.prisma.entry.create({
      data: {
        repositoryId: repository.id,
        linkId: link.id,
        kind: EntryKind.EXTERNAL_LINK,
        titleOverride: dto.titleOverride ?? null,
        description: dto.description ?? null,
        note: dto.note ?? null,
        position: dto.position,
      },
    });

    return this.toPublicEntry(saved, link.canonicalUrl);
  }

  async createRepositoryLink(
    repositoryId: string,
    user: AuthUser,
    dto: CreateRepositoryLinkEntryDto,
  ) {
    const repository = await this.requireWritableRepository(repositoryId, user);
    await this.ensurePositionAvailable(repository.id, dto.position);

    const linkedRepository = await this.prisma.repository.findUnique({
      where: { id: dto.linkedRepositoryId },
    });
    if (!linkedRepository) {
      throw new NotFoundException('Linked repository not found');
    }

    if (linkedRepository.id === repository.id) {
      throw new BadRequestException('Repository cannot link to itself');
    }

    const saved = await this.prisma.entry.create({
      data: {
        repositoryId: repository.id,
        kind: EntryKind.REPOSITORY_LINK,
        linkedRepositoryId: linkedRepository.id,
        titleOverride: dto.titleOverride ?? linkedRepository.title,
        description: dto.description ?? null,
        note: dto.note ?? null,
        position: dto.position,
      },
    });

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
    const [items, total] = await this.prisma.$transaction([
      this.prisma.entry.findMany({
        where: { repositoryId },
        include: { link: true, linkedRepository: true },
        orderBy: { position: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.entry.count({ where: { repositoryId } }),
    ]);

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

    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, repositoryId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    if (Number(entry.version) !== dto.version) {
      throw new ConflictException('Version mismatch');
    }

    let position = entry.position;
    if (dto.position !== undefined && dto.position !== entry.position) {
      await this.ensurePositionAvailable(repositoryId, dto.position, entry.id);
      position = dto.position;
    }

    const saved = await this.prisma.entry.update({
      where: { id: entry.id },
      data: {
        position,
        titleOverride: dto.titleOverride ?? entry.titleOverride,
        description: dto.description ?? entry.description,
        note: dto.note ?? entry.note,
        version: { increment: 1 },
      },
    });

    return this.toPublicEntry(saved);
  }

  async remove(repositoryId: string, entryId: string, user: AuthUser) {
    await this.requireWritableRepository(repositoryId, user);

    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, repositoryId },
    });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    await this.prisma.entry.delete({ where: { id: entry.id } });
    return { id: entry.id, deleted: true };
  }

  async reorder(repositoryId: string, user: AuthUser, dto: ReorderEntriesDto) {
    await this.requireWritableRepository(repositoryId, user);

    const entries = await this.prisma.entry.findMany({
      where: { repositoryId },
    });
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

    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    for (const item of dto.items) {
      const entry = byId.get(item.entryId)!;
      if (Number(entry.version) !== item.version) {
        throw new ConflictException('Version mismatch');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Avoid transient unique conflicts on (repository_id, position) by
      // writing temporary positions first, then final positions.
      const offset = entries.length + 1024;

      for (const item of dto.items) {
        await tx.entry.updateMany({
          where: { id: item.entryId, repositoryId },
          data: { position: item.position + offset },
        });
      }

      for (const item of dto.items) {
        await tx.entry.updateMany({
          where: { id: item.entryId, repositoryId },
          data: { position: item.position },
        });
      }
    });

    return { reordered: true, count: dto.items.length };
  }

  private async requireWritableRepository(
    repositoryId: string,
    user: AuthUser,
  ) {
    const repository = await this.prisma.repository.findUnique({
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
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
    });
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    const visibility = repository.visibility as RepositoryVisibility;
    if (visibility === RepositoryVisibility.PUBLIC) {
      return repository;
    }

    if (
      viewer &&
      (viewer.role === UserRole.ADMIN || viewer.userId === repository.ownerId)
    ) {
      return repository;
    }

    if (visibility === RepositoryVisibility.UNLISTED) {
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
    const existing = await this.prisma.entry.findUnique({
      where: {
        repositoryId_position: { repositoryId, position },
      },
      select: { id: true },
    });

    if (existing && existing.id !== ignoreEntryId) {
      throw new ConflictException(
        'Position is already used in this repository',
      );
    }
  }

  private toPublicEntry(entry: Entry, canonicalUrl?: string) {
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
