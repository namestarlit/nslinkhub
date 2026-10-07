import { IsIn, IsInt, IsString, IsUUID, MaxLength, Min } from "class-validator";
export class VersionDto {
  @IsUUID() operationId!: string;
  @IsInt() @Min(1) version!: number;
}
export class InviteDto {
  @IsUUID() operationId!: string;
  @IsString() @MaxLength(254) email!: string;
}
export class InviteCommandDto extends VersionDto {
  @IsIn(["resend", "cancel"]) action!: "resend" | "cancel";
}
