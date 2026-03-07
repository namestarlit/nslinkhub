import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import { LinkEntity } from '../links/entities/link.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { EntryEntity } from './entities/entry.entity';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EntryEntity, LinkEntity, RepositoryEntity]),
  ],
  controllers: [EntriesController],
  providers: [EntriesService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [EntriesService],
})
export class EntriesModule {}
