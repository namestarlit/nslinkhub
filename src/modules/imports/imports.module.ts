import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntryEntity } from '../entries/entities/entry.entity';
import { LinkEntity } from '../links/entities/link.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RepositoryEntity, EntryEntity, LinkEntity]),
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService],
})
export class ImportsModule {}
