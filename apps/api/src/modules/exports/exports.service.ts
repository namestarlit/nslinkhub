import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/database/prisma.service';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { Collection, ExportJob } from 'src/generated/prisma/client';
import { HubsService } from '../hubs/hubs.service';
import { buildMarkdown } from './export-markdown.util';

export interface ExportJobView {
  id: string;
  hubId: string;
  collectionId: string;
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
    private readonly prisma: PrismaService,
    private readonly hubs: HubsService,
    @InjectQueue('exports')
    private readonly exportsQueue: Queue,
  ) {}

  async exportMarkdown(collectionId: string, user: AuthUser) {
    const collection = await this.requireReadableCollection(collectionId, user);

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
    return { collectionId, format: 'markdown', content: markdown };
  }

  async exportPdf(collectionId: string, user: AuthUser) {
    const collection = await this.requireReadableCollection(collectionId, user);

    const saved = await this.prisma.exportJob.create({
      data: {
        hubId: collection.hubId,
        collectionId,
        requestedByUserId: user.userId,
        format: 'pdf',
        status: 'queued',
        outputRef: null,
        errorMessage: null,
      },
    });

    await this.exportsQueue.add(
      'generate-pdf',
      { exportJobId: saved.id, collectionId },
      { jobId: saved.id, removeOnComplete: 100, removeOnFail: 500 },
    );

    return { jobId: saved.id, status: saved.status };
  }

  async getJob(jobId: string, user: AuthUser): Promise<ExportJobView> {
    const job = await this.prisma.exportJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    if (user.role !== UserRole.ADMIN) {
      await this.hubs.assertMember(job.hubId, user);
    }

    return this.toView(job);
  }

  private async requireReadableCollection(
    collectionId: string,
    user: AuthUser,
  ): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (collection.published || user.role === UserRole.ADMIN) {
      return collection;
    }
    if (await this.hubs.isMember(collection.hubId, user.userId)) {
      return collection;
    }
    throw new ForbiddenException('Forbidden');
  }

  private toView(job: ExportJob): ExportJobView {
    return {
      id: job.id,
      hubId: job.hubId,
      collectionId: job.collectionId,
      requestedByUserId: job.requestedByUserId,
      format: job.format as ExportJobView['format'],
      status: job.status as ExportJobView['status'],
      outputRef: job.outputRef,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
