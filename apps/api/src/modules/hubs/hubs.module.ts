import { Global, Module } from '@nestjs/common';
import { CollectionPolicyService } from './collection-policy.service';
import { HubInvitationsService } from './hub-invitations.service';
import { HubMembersController } from './hub-members.controller';
import { HubMembersService } from './hub-members.service';
import { HubsService } from './hubs.service';
import { InvitationsController } from './invitations.controller';

// Global so collections, resources, tags, imports, and exports can all inject
// the hub authority services without repeating the import wiring.
@Global()
@Module({
  controllers: [HubMembersController, InvitationsController],
  providers: [
    HubsService,
    CollectionPolicyService,
    HubMembersService,
    HubInvitationsService,
  ],
  exports: [HubsService, CollectionPolicyService],
})
export class HubsModule {}
