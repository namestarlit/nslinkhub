import { IsBoolean, IsOptional } from "class-validator";

export class SetLinkSharingDto {
  @IsBoolean()
  enabled: boolean;

  // Only meaningful when enabling: mint a fresh token, invalidating the old.
  @IsOptional()
  @IsBoolean()
  rotate?: boolean;
}
