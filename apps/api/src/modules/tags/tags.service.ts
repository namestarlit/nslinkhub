import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { PrismaService } from "src/database/prisma.service";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import { AttachTagDto } from "./dto/attach-tag.dto";

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: CollectionPolicyService,
  ) {}

  async attachToCollection(collectionId: string, user: AuthUser, dto: AttachTagDto) {
    const collection = await this.requireWritableCollection(collectionId, user);
    const tag = await this.getOrCreateTag(dto.name);

    const exists = await this.prisma.collectionTag.findUnique({
      where: {
        collectionId_tagId: { collectionId: collection.id, tagId: tag.id },
      },
    });
    if (!exists) {
      await this.prisma.collectionTag.create({
        data: { collectionId: collection.id, tagId: tag.id },
      });
    }

    return {
      collectionId: collection.id,
      tag: { id: tag.id, name: tag.name },
    };
  }

  async removeFromCollection(collectionId: string, user: AuthUser, tagName: string) {
    const collection = await this.requireWritableCollection(collectionId, user);
    const tag = await this.prisma.tag.findUnique({
      where: { name: tagName.toLowerCase() },
    });
    if (!tag) {
      throw new NotFoundException("Tag not found");
    }

    await this.prisma.collectionTag.deleteMany({
      where: { collectionId: collection.id, tagId: tag.id },
    });

    return { collectionId: collection.id, tag: tag.name, removed: true };
  }

  async attachToResource(resourceId: string, user: AuthUser, dto: AttachTagDto) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }

    await this.requireWritableCollection(resource.collectionId, user);
    const tag = await this.getOrCreateTag(dto.name);

    const exists = await this.prisma.resourceTag.findUnique({
      where: { resourceId_tagId: { resourceId: resource.id, tagId: tag.id } },
    });
    if (!exists) {
      await this.prisma.resourceTag.create({
        data: { resourceId: resource.id, tagId: tag.id },
      });
    }

    return {
      resourceId: resource.id,
      tag: { id: tag.id, name: tag.name },
    };
  }

  async removeFromResource(resourceId: string, user: AuthUser, tagName: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }

    await this.requireWritableCollection(resource.collectionId, user);

    const tag = await this.prisma.tag.findUnique({
      where: { name: tagName.toLowerCase() },
    });
    if (!tag) {
      throw new NotFoundException("Tag not found");
    }

    await this.prisma.resourceTag.deleteMany({
      where: { resourceId: resource.id, tagId: tag.id },
    });

    return { resourceId: resource.id, tag: tag.name, removed: true };
  }

  private async getOrCreateTag(rawName: string) {
    const normalized = rawName.trim().replace(/\s+/g, " ").toLowerCase();
    let tag = await this.prisma.tag.findUnique({ where: { name: normalized } });
    if (!tag) {
      tag = await this.prisma.tag.create({ data: { name: normalized } });
    }
    return tag;
  }

  private async requireWritableCollection(collectionId: string, actor: AuthUser) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });
    if (!collection) {
      throw new NotFoundException("Collection not found");
    }
    // Content write: hub members and direct-share editors.
    await this.policy.requireWriteContent(collection, actor);
    return collection;
  }
}
