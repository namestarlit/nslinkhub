import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRepositoryLinkEntryDto {
  @IsUUID()
  linkedRepositoryId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  titleOverride?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  note?: string;

  @IsInt()
  @Min(0)
  position: number;
}
