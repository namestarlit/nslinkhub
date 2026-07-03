import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CursorQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Browser-friendly share token (?s=<token>); read directly by controllers.
  // Whitelisted here so the global forbidNonWhitelisted pipe does not reject
  // share links on token-accepting read routes.
  @IsOptional()
  @IsString()
  s?: string;
}
