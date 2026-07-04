import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";

export class CreateShareDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @IsIn(["reader", "editor"])
  role?: "reader" | "editor";
}
