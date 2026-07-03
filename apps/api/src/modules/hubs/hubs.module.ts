import { Global, Module } from '@nestjs/common';
import { HubsService } from './hubs.service';

// Global so collections, resources, tags, imports, and exports can all inject
// HubsService without repeating the import wiring.
@Global()
@Module({
  providers: [HubsService],
  exports: [HubsService],
})
export class HubsModule {}
