import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { PrismaService } from "src/database/prisma.service";
import { Collection, ExportJob } from "src/generated/prisma/client";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import { HubsService } from "../hubs/hubs.service";
import { buildMarkdown } from "./export-markdown.util";

export interface ExportJobView {
  id: string;
  hubId: string;
  collectionId: string;
  requestedByUserId: string | null;
  format: "pdf";
  status: "queued" | "running" | "completed" | "failed";
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
    private readonly policy: CollectionPolicyService,
    @InjectQueue("exports")
    private readonly exportsQueue: Queue,
  ) {}

  async exportMarkdown(collectionId: string, user: AuthUser) {
    const collection = await this.requireReadableCollection(collectionId, user);

    const resources = await this.prisma.resource.findMany({
      where: { collectionId: collection.id },
      include: {
        linkedCollection: true,
      },
      orderBy: { position: "asc" },
    });

    const markdown = buildMarkdown(collection, resources);
    return { collectionId, format: "markdown", content: markdown };
  }

  async exportPdf(collectionId: string, user: AuthUser) {
    const collection = await this.requireReadableCollection(collectionId, user);

    const saved = await this.prisma.exportJob.create({
      data: {
        hubId: collection.hubId,
        collectionId,
        requestedByUserId: user.userId,
        format: "pdf",
        status: "queued",
        outputRef: null,
        errorMessage: null,
      },
    });

    await this.exportsQueue.add(
      "generate-pdf",
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
      throw new NotFoundException("Export job not found");
    }

    // Export jobs belong to the hub owner.
    await this.hubs.requireHubOwner(job.hubId, user);

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
      throw new NotFoundException("Collection not found");
    }
    await this.policy.requireRead(collection, user);
    return collection;
  }

  private toView(job: ExportJob): ExportJobView {
    return {
      id: job.id,
      hubId: job.hubId,
      collectionId: job.collectionId,
      requestedByUserId: job.requestedByUserId,
      format: job.format as ExportJobView["format"],
      status: job.status as ExportJobView["status"],
      outputRef: job.outputRef,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
