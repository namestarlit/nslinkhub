import { IsString, Matches, MaxLength } from "class-validator";

export class AttachTagDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9]+$/)
  @MaxLength(80)
  name: string;
}
