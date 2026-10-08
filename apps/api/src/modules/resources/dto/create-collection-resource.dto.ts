import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class CreateHeadingResourceDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(255)
  title: string;

  @IsInt()
  @Min(0)
  position: number;
}
// A reference's title is its target collection's title, never an input.
export class CreateCollectionResourceDto {
  @IsUUID()
  linkedCollectionId: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  tags?: string[];

  @IsInt()
  @Min(0)
  position: number;
}
