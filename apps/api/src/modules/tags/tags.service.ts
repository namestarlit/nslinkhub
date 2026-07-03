import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { AttachTagDto } from './dto/attach-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async attachToRepository(
    repositoryId: string,
    user: AuthUser,
    dto: AttachTagDto,
  ) {
    const repository = await this.requireWritableRepository(repositoryId, user);
    const tag = await this.getOrCreateTag(dto.name);

    const exists = await this.prisma.repositoryTag.findUnique({
      where: {
        repositoryId_tagId: {
          repositoryId: repository.id,
          tagId: tag.id,
        },
      },
    });

    if (!exists) {
      await this.prisma.repositoryTag.create({
        data: {
          repositoryId: repository.id,
          tagId: tag.id,
        },
      });
    }

    return {
      repositoryId: repository.id,
      tag: { id: tag.id, name: tag.name },
    };
  }

  async removeFromRepository(
    repositoryId: string,
    user: AuthUser,
    tagName: string,
  ) {
    const repository = await this.requireWritableRepository(repositoryId, user);
    const tag = await this.prisma.tag.findUnique({
      where: { name: tagName.toLowerCase() },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.prisma.repositoryTag.deleteMany({
      where: {
        repositoryId: repository.id,
        tagId: tag.id,
      },
    });

    return {
      repositoryId: repository.id,
      tag: tag.name,
      removed: true,
    };
  }

  async attachToEntry(entryId: string, user: AuthUser, dto: AttachTagDto) {
    const entry = await this.prisma.entry.findUnique({
      where: { id: entryId },
    });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    await this.requireWritableRepository(entry.repositoryId, user);
    const tag = await this.getOrCreateTag(dto.name);

    const exists = await this.prisma.entryTag.findUnique({
      where: {
        entryId_tagId: {
          entryId: entry.id,
          tagId: tag.id,
        },
      },
    });

    if (!exists) {
      await this.prisma.entryTag.create({
        data: {
          entryId: entry.id,
          tagId: tag.id,
        },
      });
    }

    return {
      entryId: entry.id,
      tag: { id: tag.id, name: tag.name },
    };
  }

  async removeFromEntry(entryId: string, user: AuthUser, tagName: string) {
    const entry = await this.prisma.entry.findUnique({
      where: { id: entryId },
    });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    await this.requireWritableRepository(entry.repositoryId, user);

    const tag = await this.prisma.tag.findUnique({
      where: { name: tagName.toLowerCase() },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.prisma.entryTag.deleteMany({
      where: {
        entryId: entry.id,
        tagId: tag.id,
      },
    });

    return {
      entryId: entry.id,
      tag: tag.name,
      removed: true,
    };
  }

  private async getOrCreateTag(rawName: string) {
    const normalized = rawName.trim().replace(/\s+/g, ' ').toLowerCase();

    let tag = await this.prisma.tag.findUnique({
      where: { name: normalized },
    });
    if (!tag) {
      tag = await this.prisma.tag.create({ data: { name: normalized } });
    }

    return tag;
  }

  private async requireWritableRepository(
    repositoryId: string,
    actor: AuthUser,
  ) {
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
    });
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    if (actor.role !== UserRole.ADMIN && repository.ownerId !== actor.userId) {
      throw new ForbiddenException('Forbidden');
    }

    return repository;
  }
}
