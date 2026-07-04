import { Global, Module } from '@nestjs/common';
import { CollectionPolicyService } from './collection-policy.service';
import { HubsService } from './hubs.service';

// Global so collections, resources, tags, imports, and exports can all inject
// the hub authority services without repeating the import wiring.
@Global()
@Module({
  providers: [HubsService, CollectionPolicyService],
  exports: [HubsService, CollectionPolicyService],
})
export class HubsModule {}
