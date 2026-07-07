import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from "class-validator";

export class CreateExternalResourceDto {
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  url: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  titleOverride?: string;

  @IsInt()
  @Min(0)
  position: number;
}
