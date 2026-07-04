import { IsIn, IsString } from "class-validator";

export class ChangeRoleDto {
  @IsString()
  @IsIn(["member", "admin"])
  role: "member" | "admin";
}
