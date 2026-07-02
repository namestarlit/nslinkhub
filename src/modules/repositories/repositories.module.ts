import { Module } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { RepositoryLookupController } from './repository-lookup.controller';
import { RepositoriesService } from './repositories.service';

@Module({
  controllers: [RepositoriesController, RepositoryLookupController],
  providers: [RepositoriesService],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
