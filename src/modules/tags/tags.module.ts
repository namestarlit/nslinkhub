import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntryEntity } from '../entries/entities/entry.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { EntryTagEntity } from './entities/entry-tag.entity';
import { RepositoryTagEntity } from './entities/repository-tag.entity';
import { TagEntity } from './entities/tag.entity';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TagEntity,
      RepositoryEntity,
      EntryEntity,
      RepositoryTagEntity,
      EntryTagEntity,
    ]),
  ],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
