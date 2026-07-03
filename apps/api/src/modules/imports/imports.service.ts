import {
  BadRequestException,
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
import { ImportTargetDto } from './dto/import-target.dto';

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const text = utf8.includes('�') ? file.buffer.toString('latin1') : utf8;
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
    const existingEntries = await this.prisma.entry.findMany({
      where: { repositoryId },
      include: { link: true },
    });

    const maxPosition = existingEntries.reduce(
      (max, entry) => Math.max(max, entry.position),
      -1,
    );
    let nextPosition = maxPosition + 1;
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

        let link = await this.prisma.link.findUnique({ where: { urlHash } });
        if (!link) {
          link = await this.prisma.link.create({
            data: { canonicalUrl, urlHash },
          });
        }

        await this.prisma.entry.create({
          data: {
            repositoryId,
            kind: EntryKind.EXTERNAL_LINK,
            linkId: link.id,
            titleOverride: row.title ?? null,
            description: row.description ?? null,
            note: row.note ?? null,
            position: nextPosition,
          },
        });

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
      const repository = await this.prisma.repository.findUnique({
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

    return this.prisma.repository.create({
      data: {
        ownerId: user.userId,
        title: dto.repositoryTitle,
        slug: dto.repositorySlug,
        visibility: dto.visibility ?? RepositoryVisibility.PRIVATE,
      },
    });
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').trim();
}
