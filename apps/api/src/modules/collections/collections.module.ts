import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionLookupController } from './collection-lookup.controller';
import { CollectionsService } from './collections.service';

@Module({
  controllers: [CollectionsController, CollectionLookupController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
