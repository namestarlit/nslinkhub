import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { EntryKind } from 'src/common/enums/entry-kind.enum';
import { RepositoryVisibility } from 'src/common/enums/repository-visibility.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { Repository } from 'typeorm';
import { EntryEntity } from '../entries/entities/entry.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ExportJobEntity } from './entities/export-job.entity';

export interface ExportJobView {
  id: string;
  repositoryId: string;
  requestedByUserId: string | null;
  format: 'pdf';
  status: 'queued' | 'running' | 'completed' | 'failed';
  outputRef: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ExportsService {
  constructor(
    @InjectRepository(RepositoryEntity)
    private readonly repositoriesRepo: Repository<RepositoryEntity>,
    @InjectRepository(EntryEntity)
    private readonly entriesRepo: Repository<EntryEntity>,
    @InjectRepository(ExportJobEntity)
    private readonly exportJobsRepo: Repository<ExportJobEntity>,
    @InjectQueue('exports')
    private readonly exportsQueue: Queue,
  ) {}

  async exportMarkdown(repositoryId: string, user: AuthUser) {
    const repository = await this.requireReadableRepository(repositoryId, user);

    const entries = await this.entriesRepo.find({
      where: { repositoryId: repository.id },
      relations: {
        link: true,
        linkedRepository: true,
        entryTags: { tag: true },
      },
      order: { position: 'ASC' },
    });

    const markdown = buildMarkdown(repository, entries);
    return {
      repositoryId,
      format: 'markdown',
      content: markdown,
    };
  }

  async exportPdf(repositoryId: string, user: AuthUser) {
    await this.requireReadableRepository(repositoryId, user);

    const exportJob = this.exportJobsRepo.create({
      repositoryId,
      requestedByUserId: user.userId,
      format: 'pdf',
      status: 'queued',
      outputRef: null,
      errorMessage: null,
    });

    const saved = await this.exportJobsRepo.save(exportJob);

    await this.exportsQueue.add(
      'generate-pdf',
      {
        exportJobId: saved.id,
        repositoryId,
      },
      {
        jobId: saved.id,
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    return {
      jobId: saved.id,
      status: saved.status,
    };
  }

  async getJob(jobId: string, user: AuthUser): Promise<ExportJobView> {
    const job = await this.exportJobsRepo.findOne({
      where: { id: jobId },
      relations: { repository: true },
    });

    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    if (
      user.role !== UserRole.ADMIN &&
      job.repository.ownerId !== user.userId
    ) {
      throw new ForbiddenException('Forbidden');
    }

    return this.toView(job);
  }

  private async requireReadableRepository(
    repositoryId: string,
    user: AuthUser,
  ) {
    const repository = await this.repositoriesRepo.findOne({
      where: { id: repositoryId },
      relations: { owner: true },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    if (repository.visibility === RepositoryVisibility.PUBLIC) {
      return repository;
    }

    if (user.role === UserRole.ADMIN || user.userId === repository.ownerId) {
      return repository;
    }

    throw new ForbiddenException('Forbidden');
  }

  private toView(job: ExportJobEntity): ExportJobView {
    return {
      id: job.id,
      repositoryId: job.repositoryId,
      requestedByUserId: job.requestedByUserId,
      format: job.format,
      status: job.status,
      outputRef: job.outputRef,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}

function buildMarkdown(repository: RepositoryEntity, entries: EntryEntity[]) {
  const lines: string[] = [];
  lines.push(`# ${repository.title}`);

  if (repository.description) {
    lines.push('');
    lines.push(repository.description);
  }

  lines.push('');
  lines.push(`- Visibility: ${repository.visibility}`);
  lines.push(`- Updated: ${repository.updatedAt.toISOString()}`);

  lines.push('');
  lines.push('## Resources');

  for (const entry of entries) {
    if (entry.kind === EntryKind.EXTERNAL_LINK) {
      const title =
        entry.titleOverride ?? entry.link?.canonicalUrl ?? 'Untitled Link';
      const url = entry.link?.canonicalUrl ?? '';
      lines.push(`- [${title}](${url})`);
    } else {
      const title =
        entry.titleOverride ?? entry.linkedRepository?.title ?? 'Repository';
      lines.push(`- [Repository] ${title}`);
    }

    if (entry.description) {
      lines.push(`  - Description: ${entry.description}`);
    }

    if (entry.note) {
      lines.push(`  - Note: ${entry.note}`);
    }

    const tagNames = entry.entryTags
      ?.map((tag) => tag.tag?.name)
      .filter(Boolean);
    if (tagNames && tagNames.length > 0) {
      lines.push(`  - Tags: ${tagNames.join(', ')}`);
    }
  }

  return lines.join('\n');
}
