import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { RepositoryVisibility } from 'src/common/enums/repository-visibility.enum';

export class ImportTargetDto {
  @IsOptional()
  @IsUUID()
  targetRepositoryId?: string;

  @IsOptional()
  @IsBoolean()
  createRepository?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  repositoryTitle?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MaxLength(120)
  repositorySlug?: string;

  @IsOptional()
  @IsEnum(RepositoryVisibility)
  visibility?: RepositoryVisibility;
}
