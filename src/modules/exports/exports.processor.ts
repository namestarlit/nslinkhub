import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntryEntity } from '../entries/entities/entry.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ExportJobEntity } from './entities/export-job.entity';

@Injectable()
@Processor('exports')
export class ExportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportsProcessor.name);

  constructor(
    @InjectRepository(ExportJobEntity)
    private readonly exportJobsRepo: Repository<ExportJobEntity>,
    @InjectRepository(RepositoryEntity)
    private readonly repositoriesRepo: Repository<RepositoryEntity>,
    @InjectRepository(EntryEntity)
    private readonly entriesRepo: Repository<EntryEntity>,
  ) {
    super();
  }

  async process(job: Job<{ exportJobId: string; repositoryId: string }>) {
    const exportJob = await this.exportJobsRepo.findOne({
      where: { id: job.data.exportJobId },
    });

    if (!exportJob) {
      this.logger.warn(`Export job not found: ${job.data.exportJobId}`);
      return;
    }

    exportJob.status = 'running';
    exportJob.errorMessage = null;
    await this.exportJobsRepo.save(exportJob);

    try {
      const repository = await this.repositoriesRepo.findOne({
        where: { id: job.data.repositoryId },
      });
      if (!repository) {
        throw new Error('Repository not found for export processing');
      }

      const entries = await this.entriesRepo.find({
        where: { repositoryId: repository.id },
        relations: { link: true, linkedRepository: true, entryTags: { tag: true } },
        order: { position: 'ASC' },
      });

      const markdown = buildMarkdown(repository, entries);
      exportJob.status = 'completed';
      exportJob.outputRef = `pdf://generated/${exportJob.id}?sourceLength=${markdown.length}`;
      exportJob.errorMessage = null;
      await this.exportJobsRepo.save(exportJob);
    } catch (error) {
      exportJob.status = 'failed';
      exportJob.errorMessage =
        error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error';
      await this.exportJobsRepo.save(exportJob);
      throw error;
    }
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
    if (entry.kind === 'external_link') {
      const title = entry.titleOverride ?? entry.link?.canonicalUrl ?? 'Untitled Link';
      const url = entry.link?.canonicalUrl ?? '';
      lines.push(`- [${title}](${url})`);
    } else {
      const title = entry.titleOverride ?? entry.linkedRepository?.title ?? 'Repository';
      lines.push(`- [Repository] ${title}`);
    }

    if (entry.description) {
      lines.push(`  - Description: ${entry.description}`);
    }

    if (entry.note) {
      lines.push(`  - Note: ${entry.note}`);
    }

    const tagNames = entry.entryTags?.map((tag) => tag.tag?.name).filter(Boolean);
    if (tagNames && tagNames.length > 0) {
      lines.push(`  - Tags: ${tagNames.join(', ')}`);
    }
  }

  return lines.join('\n');
}
