import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RepositoryVisibility } from 'src/common/enums/repository-visibility.enum';

export class UpdateRepositoryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MinLength(2)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(RepositoryVisibility)
  visibility?: RepositoryVisibility;

  @IsOptional()
  @IsString()
  parentRepositoryId?: string | null;

  @IsInt()
  @Min(1)
  version: number;
}
