import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @IsUUID()
  entryId: string;

  @IsInt()
  @Min(0)
  position: number;
}

export class ReorderEntriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: ReorderItemDto) => item.entryId)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];

  @IsInt()
  @Min(1)
  version: number;
}
