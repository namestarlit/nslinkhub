import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

// Only what people add to an item is editable (tags, position). What belongs
// to it — a link's address and resolved title, a reference's target, a
// heading's text — is fixed: to change it, remove the item and add it again.
export class UpdateResourceDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsInt()
  @Min(1)
  version: number;
}
