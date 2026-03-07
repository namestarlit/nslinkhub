import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { RepositoryVisibility } from 'src/common/enums/repository-visibility.enum';

export class ImportTargetDto {
  @IsOptional()
  @IsUUID()
  targetRepositoryId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return value;
  })
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
