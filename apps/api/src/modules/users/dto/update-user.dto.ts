import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateUserDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  showNameOnHub?: boolean;

  // Account holder full name; separate from the hub public display name.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(255)
  hubName?: string;

  // The hub handle (mutable public identity). Format is re-validated in the
  // service and by a DB CHECK constraint.
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  @MinLength(3)
  @MaxLength(60)
  handle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  hubDescription?: string;
}
