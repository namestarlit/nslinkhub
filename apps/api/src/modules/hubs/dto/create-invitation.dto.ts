import { IsEmail, IsIn, IsString } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  // owner is reachable only via transfer-ownership, never invitation.
  @IsString()
  @IsIn(['member', 'admin'])
  role: 'member' | 'admin';
}
