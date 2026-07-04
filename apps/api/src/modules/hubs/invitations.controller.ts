import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import type { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { apiOk } from 'src/common/utils/response.util';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { HubInvitationsService } from './hub-invitations.service';

@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v1/invitations')
export class InvitationsController {
  constructor(private readonly invitations: HubInvitationsService) {}

  // Token is submitted in the body, never a path parameter.
  @Post('accept')
  async accept(
    @CurrentUser() user: AuthUser,
    @Body() dto: AcceptInvitationDto,
  ) {
    return apiOk(await this.invitations.accept(user, dto.token));
  }
}
