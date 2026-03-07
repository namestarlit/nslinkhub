import {
  BadRequestException,
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
import { EntryEntity } from '../entries/entities/entry.entity';
import { LinkEntity } from '../links/entities/link.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ImportTargetDto } from './dto/import-target.dto';

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ImportsService {
  constructor(
    @InjectRepository(RepositoryEntity)
    private readonly repositoriesRepo: Repository<RepositoryEntity>,
    @InjectRepository(EntryEntity)
    private readonly entriesRepo: Repository<EntryEntity>,
    @InjectRepository(LinkEntity)
    private readonly linksRepo: Repository<LinkEntity>,
  ) {}

  async importCsv(user: AuthUser, file: unknown, dto: ImportTargetDto) {
    const repository = await this.resolveTargetRepository(user, dto);
    this.ensureValidFile(file);

    const text = file.buffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    const headers = lines[0]
      .split(',')
      .map((header) => header.trim().toLowerCase());
    const urlIdx = headers.indexOf('url');
    const titleIdx = headers.indexOf('title');
    const descriptionIdx = headers.indexOf('description');
    const noteIdx = headers.indexOf('note');

    if (urlIdx < 0) {
      throw new BadRequestException('CSV must contain url column');
    }

    const rows = lines.slice(1);
    return this.ingestRows(
      repository.id,
      rows.map((row, index) => {
        const columns = row.split(',').map((column) => column.trim());
        return {
          index: index + 2,
          url: columns[urlIdx] ?? '',
          title: titleIdx >= 0 ? columns[titleIdx] : undefined,
          description:
            descriptionIdx >= 0 ? columns[descriptionIdx] : undefined,
          note: noteIdx >= 0 ? columns[noteIdx] : undefined,
        };
      }),
    );
  }

  async importBookmarksHtml(
    user: AuthUser,
    file: unknown,
    dto: ImportTargetDto,
  ) {
    const repository = await this.resolveTargetRepository(user, dto);
    this.ensureValidFile(file);

    const text = file.buffer.toString('utf8');
    const linkRegex = /<A\s+[^>]*HREF="([^"]+)"[^>]*>(.*?)<\/A>/gi;
    const rows: Array<{ index: number; url: string; title?: string }> = [];

    let match: RegExpExecArray | null;
    let i = 1;
    while ((match = linkRegex.exec(text)) !== null) {
      rows.push({
        index: i,
        url: match[1],
        title: stripHtml(match[2]),
      });
      i += 1;
    }

    return this.ingestRows(repository.id, rows);
  }

  async importWhatsappTxt(user: AuthUser, file: unknown, dto: ImportTargetDto) {
    const repository = await this.resolveTargetRepository(user, dto);
    this.ensureValidFile(file);

    const utf8 = file.buffer.toString('utf8');
    const text = utf8.includes('\uFFFD')
      ? file.buffer.toString('latin1')
      : utf8;
    const urlRegex = /https?:\/\/[^\s<>()]+/gi;
    const rows: Array<{ index: number; url: string }> = [];

    const lines = text.split(/\r?\n/);
    lines.forEach((line, lineIndex) => {
      const matches = line.match(urlRegex);
      if (matches) {
        for (const url of matches) {
          rows.push({ index: lineIndex + 1, url });
        }
      }
    });

    return this.ingestRows(repository.id, rows);
  }

  private async ingestRows(
    repositoryId: string,
    rows: Array<{
      index: number;
      url: string;
      title?: string;
      description?: string;
      note?: string;
    }>,
  ) {
    const existingEntries = await this.entriesRepo.find({
      where: { repositoryId },
      relations: { link: true },
    });

    let nextPosition = existingEntries.length;
    const existingHashes = new Set(
      existingEntries
        .map((entry) => entry.link?.urlHash)
        .filter(Boolean) as string[],
    );

    let importedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; reason: string; value: string }> = [];

    for (const row of rows) {
      try {
        const canonicalUrl = canonicalizeUrl(row.url);
        const urlHash = createHash('sha256').update(canonicalUrl).digest('hex');

        if (existingHashes.has(urlHash)) {
          skippedCount += 1;
          continue;
        }

        let link = await this.linksRepo.findOne({ where: { urlHash } });
        if (!link) {
          link = this.linksRepo.create({ canonicalUrl, urlHash });
          link = await this.linksRepo.save(link);
        }

        const entry = this.entriesRepo.create({
          repositoryId,
          kind: EntryKind.EXTERNAL_LINK,
          linkId: link.id,
          titleOverride: row.title ?? null,
          description: row.description ?? null,
          note: row.note ?? null,
          position: nextPosition,
        });
        await this.entriesRepo.save(entry);

        existingHashes.add(urlHash);
        importedCount += 1;
        nextPosition += 1;
      } catch {
        errors.push({
          row: row.index,
          reason: 'invalid_or_unsupported_url',
          value: row.url.slice(0, 128),
        });
      }
    }

    return {
      total_rows: rows.length,
      processed_rows: rows.length,
      imported_count: importedCount,
      skipped_count: skippedCount,
      error_count: errors.length,
      errors,
    };
  }

  private ensureValidFile(
    file: unknown,
  ): asserts file is { buffer: Buffer; size: number } {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const candidate = file as { buffer?: Buffer; size?: number };
    if (!candidate.buffer || typeof candidate.size !== 'number') {
      throw new BadRequestException('Invalid upload payload');
    }

    if (candidate.size > MAX_IMPORT_SIZE_BYTES) {
      throw new BadRequestException('File exceeds 10MB limit');
    }
  }

  private async resolveTargetRepository(user: AuthUser, dto: ImportTargetDto) {
    if (dto.targetRepositoryId) {
      const repository = await this.repositoriesRepo.findOne({
        where: { id: dto.targetRepositoryId },
      });

      if (!repository) {
        throw new NotFoundException('Target repository not found');
      }

      if (user.role !== UserRole.ADMIN && repository.ownerId !== user.userId) {
        throw new ForbiddenException('Forbidden');
      }

      return repository;
    }

    if (!dto.createRepository) {
      throw new BadRequestException(
        'Provide targetRepositoryId or set createRepository=true',
      );
    }

    if (!dto.repositoryTitle || !dto.repositorySlug) {
      throw new BadRequestException(
        'repositoryTitle and repositorySlug are required when createRepository=true',
      );
    }

    const repository = this.repositoriesRepo.create({
      ownerId: user.userId,
      title: dto.repositoryTitle,
      slug: dto.repositorySlug,
      visibility: dto.visibility ?? RepositoryVisibility.PRIVATE,
    });

    return this.repositoriesRepo.save(repository);
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

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').trim();
}
