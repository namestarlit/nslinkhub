import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';

@Module({
  controllers: [EntriesController],
  providers: [EntriesService, AuthGuard, OptionalAuthGuard],
  exports: [EntriesService],
})
export class EntriesModule {}
