import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from "class-validator";

export class CreateCollectionLinkResourceDto {
  @IsUUID()
  linkedCollectionId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  titleOverride?: string;

  @IsInt()
  @Min(0)
  position: number;
}
