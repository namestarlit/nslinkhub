import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsUUID,
} from "class-validator";
import type { ExportFormat } from "../export-document";
import { EXPORT_FORMATS } from "../export-document";

export class CreateExportDto {
  @ApiProperty({ enum: EXPORT_FORMATS })
  @IsIn(EXPORT_FORMATS)
  format!: ExportFormat;

  @ApiProperty({ type: [String], description: "Collections to export (one document each)" })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID("all", { each: true })
  collectionIds!: string[];

  @ApiPropertyOptional({
    default: true,
    description:
      "Expand sub-collections as sections (default). When false they collapse to a single line.",
  })
  @IsOptional()
  @IsBoolean()
  expand?: boolean;
}
