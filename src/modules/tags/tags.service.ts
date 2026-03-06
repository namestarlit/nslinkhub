import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { Repository } from 'typeorm';
import { EntryEntity } from '../entries/entities/entry.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { AttachTagDto } from './dto/attach-tag.dto';
import { EntryTagEntity } from './entities/entry-tag.entity';
import { RepositoryTagEntity } from './entities/repository-tag.entity';
import { TagEntity } from './entities/tag.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(TagEntity)
    private readonly tagsRepo: Repository<TagEntity>,
    @InjectRepository(RepositoryEntity)
    private readonly repositoriesRepo: Repository<RepositoryEntity>,
    @InjectRepository(EntryEntity)
    private readonly entriesRepo: Repository<EntryEntity>,
    @InjectRepository(RepositoryTagEntity)
    private readonly repositoryTagsRepo: Repository<RepositoryTagEntity>,
    @InjectRepository(EntryTagEntity)
    private readonly entryTagsRepo: Repository<EntryTagEntity>,
  ) {}

  async attachToRepository(
    repositoryId: string,
    user: AuthUser,
    dto: AttachTagDto,
  ) {
    const repository = await this.requireWritableRepository(repositoryId, user);
    const tag = await this.getOrCreateTag(dto.name);

    const exists = await this.repositoryTagsRepo.exists({
      where: {
        repositoryId: repository.id,
        tagId: tag.id,
      },
    });

    if (!exists) {
      const relation = this.repositoryTagsRepo.create({
        repositoryId: repository.id,
        tagId: tag.id,
      });
      await this.repositoryTagsRepo.save(relation);
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
    const tag = await this.tagsRepo.findOne({ where: { name: tagName.toLowerCase() } });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.repositoryTagsRepo.delete({
      repositoryId: repository.id,
      tagId: tag.id,
    });

    return {
      repositoryId: repository.id,
      tag: tag.name,
      removed: true,
    };
  }

  async attachToEntry(entryId: string, user: AuthUser, dto: AttachTagDto) {
    const entry = await this.entriesRepo.findOne({ where: { id: entryId } });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    await this.requireWritableRepository(entry.repositoryId, user);
    const tag = await this.getOrCreateTag(dto.name);

    const exists = await this.entryTagsRepo.exists({
      where: {
        entryId: entry.id,
        tagId: tag.id,
      },
    });

    if (!exists) {
      const relation = this.entryTagsRepo.create({
        entryId: entry.id,
        tagId: tag.id,
      });
      await this.entryTagsRepo.save(relation);
    }

    return {
      entryId: entry.id,
      tag: { id: tag.id, name: tag.name },
    };
  }

  async removeFromEntry(entryId: string, user: AuthUser, tagName: string) {
    const entry = await this.entriesRepo.findOne({ where: { id: entryId } });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    await this.requireWritableRepository(entry.repositoryId, user);

    const tag = await this.tagsRepo.findOne({ where: { name: tagName.toLowerCase() } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.entryTagsRepo.delete({
      entryId: entry.id,
      tagId: tag.id,
    });

    return {
      entryId: entry.id,
      tag: tag.name,
      removed: true,
    };
  }

  private async getOrCreateTag(rawName: string) {
    const normalized = rawName.trim().replace(/\s+/g, ' ').toLowerCase();

    let tag = await this.tagsRepo.findOne({ where: { name: normalized } });
    if (!tag) {
      tag = this.tagsRepo.create({ name: normalized });
      tag = await this.tagsRepo.save(tag);
    }

    return tag;
  }

  private async requireWritableRepository(repositoryId: string, actor: AuthUser) {
    const repository = await this.repositoriesRepo.findOne({ where: { id: repositoryId } });
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    if (actor.role !== UserRole.ADMIN && repository.ownerId !== actor.userId) {
      throw new ForbiddenException('Forbidden');
    }

    return repository;
  }
}
