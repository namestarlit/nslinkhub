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

  async process(job: Job<{ exportJobId: string; collectionId: string }>) {
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
      const collection = await this.prisma.collection.findUnique({
        where: { id: job.data.collectionId },
      });
      if (!collection) {
        throw new Error('Collection not found for export processing');
      }

      const resources = await this.prisma.resource.findMany({
        where: { collectionId: collection.id },
        include: {
          link: true,
          linkedCollection: true,
          resourceTags: { include: { tag: true } },
        },
        orderBy: { position: 'asc' },
      });

      const markdown = buildMarkdown(collection, resources);
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
