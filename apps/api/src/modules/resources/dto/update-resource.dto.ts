import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateResourceDto {
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

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsInt()
  @Min(1)
  version: number;
}
