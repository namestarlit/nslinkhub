import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { ExploreController } from './explore.controller';
import { HubsController } from './hubs.controller';
import { MeController } from './me.controller';
import { CollectionsService } from './collections.service';

@Module({
  controllers: [
    CollectionsController,
    ExploreController,
    HubsController,
    MeController,
  ],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
