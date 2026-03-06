import { IsBoolean, IsOptional } from 'class-validator';

export class CreateShareLinkDto {
  @IsOptional()
  @IsBoolean()
  rotate?: boolean = false;
}
