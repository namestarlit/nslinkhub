import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { AuthGuard } from "src/common/guards/auth.guard";
import type { AuthUser } from "src/common/interfaces/auth-user.interface";
import { apiOk } from "src/common/utils/response.util";
import { ChangeRoleDto } from "./dto/change-role.dto";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { TransferOwnershipDto } from "./dto/transfer-ownership.dto";
import { HubInvitationsService } from "./hub-invitations.service";
import { HubMembersService } from "./hub-members.service";

@ApiTags("hub-members")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("api/v1/hubs")
export class HubMembersController {
  constructor(
    private readonly members: HubMembersService,
    private readonly invitations: HubInvitationsService,
  ) {}

  @Get(":hubId/members")
  async listMembers(
    @Param("hubId", new ParseUUIDPipe()) hubId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return apiOk(await this.members.listMembers(hubId, user));
  }

  @Patch(":hubId/members/:userId")
  async changeRole(
    @Param("hubId", new ParseUUIDPipe()) hubId: string,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeRoleDto,
  ) {
    return apiOk(await this.members.changeRole(hubId, user, userId, dto.role));
  }

  @Delete(":hubId/members/:userId")
  async removeMember(
    @Param("hubId", new ParseUUIDPipe()) hubId: string,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return apiOk(await this.members.removeMember(hubId, user, userId));
  }

  @Post(":hubId/transfer-ownership")
  async transferOwnership(
    @Param("hubId", new ParseUUIDPipe()) hubId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: TransferOwnershipDto,
  ) {
    return apiOk(await this.members.transferOwnership(hubId, user, dto.userId));
  }

  @Post(":hubId/invitations")
  async createInvitation(
    @Param("hubId", new ParseUUIDPipe()) hubId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return apiOk(await this.invitations.create(hubId, user, dto));
  }

  @Get(":hubId/invitations")
  async listInvitations(
    @Param("hubId", new ParseUUIDPipe()) hubId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return apiOk(await this.invitations.list(hubId, user));
  }

  @Delete(":hubId/invitations/:invitationId")
  async revokeInvitation(
    @Param("hubId", new ParseUUIDPipe()) hubId: string,
    @Param("invitationId", new ParseUUIDPipe()) invitationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return apiOk(await this.invitations.revoke(hubId, user, invitationId));
  }
}
