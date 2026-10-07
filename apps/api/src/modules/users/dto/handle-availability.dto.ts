import { IsString, MaxLength } from "class-validator";

export class HandleAvailabilityDto {
  @IsString()
  @MaxLength(60)
  handle: string;
}
