import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/database/prisma.service';
import { RepositoryVisibility } from 'src/common/enums/repository-visibility.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { ExportJob } from 'src/generated/prisma/client';
import { buildMarkdown } from './export-markdown.util';

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
    private readonly prisma: PrismaService,
    @InjectQueue('exports')
    private readonly exportsQueue: Queue,
  ) {}

  async exportMarkdown(repositoryId: string, user: AuthUser) {
    const repository = await this.requireReadableRepository(repositoryId, user);

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
    return {
      repositoryId,
      format: 'markdown',
      content: markdown,
    };
  }

  async exportPdf(repositoryId: string, user: AuthUser) {
    await this.requireReadableRepository(repositoryId, user);

    const saved = await this.prisma.exportJob.create({
      data: {
        repositoryId,
        requestedByUserId: user.userId,
        format: 'pdf',
        status: 'queued',
        outputRef: null,
        errorMessage: null,
      },
    });

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
    const job = await this.prisma.exportJob.findUnique({
      where: { id: jobId },
      include: { repository: true },
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
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    if (
      (repository.visibility as RepositoryVisibility) ===
      RepositoryVisibility.PUBLIC
    ) {
      return repository;
    }

    if (user.role === UserRole.ADMIN || user.userId === repository.ownerId) {
      return repository;
    }

    throw new ForbiddenException('Forbidden');
  }

  private toView(job: ExportJob): ExportJobView {
    return {
      id: job.id,
      repositoryId: job.repositoryId,
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
