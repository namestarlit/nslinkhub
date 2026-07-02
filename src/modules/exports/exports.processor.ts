import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { buildMarkdown } from './export-markdown.util';

@Injectable()
@Processor('exports')
export class ExportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ exportJobId: string; repositoryId: string }>) {
    const exportJob = await this.prisma.exportJob.findUnique({
      where: { id: job.data.exportJobId },
    });

    if (!exportJob) {
      this.logger.warn(`Export job not found: ${job.data.exportJobId}`);
      return;
    }

    await this.prisma.exportJob.update({
      where: { id: exportJob.id },
      data: { status: 'running', errorMessage: null },
    });

    try {
      const repository = await this.prisma.repository.findUnique({
        where: { id: job.data.repositoryId },
      });
      if (!repository) {
        throw new Error('Repository not found for export processing');
      }

      const entries = await this.prisma.entry.findMany({
        where: { repositoryId: repository.id },
        include: {
          link: true,
          linkedRepository: true,
          entryTags: { include: { tag: true } },
        },
        orderBy: { position: 'asc' },
      });

      const markdown = buildMarkdown(repository, entries);
      await this.prisma.exportJob.update({
        where: { id: exportJob.id },
        data: {
          status: 'completed',
          outputRef: `pdf://generated/${exportJob.id}?sourceLength=${markdown.length}`,
          errorMessage: null,
        },
      });
    } catch (error) {
      await this.prisma.exportJob.update({
        where: { id: exportJob.id },
        data: {
          status: 'failed',
          errorMessage:
            error instanceof Error
              ? error.message.slice(0, 1000)
              : 'Unknown error',
        },
      });
      throw error;
    }
  }
}
