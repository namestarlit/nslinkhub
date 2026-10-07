import { Transform } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class AvatarQueryDto {
  @Transform(({ value }) =>
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN,
  )
  @IsInt()
  @Min(16)
  @Max(512)
  size: number = 64;
}
