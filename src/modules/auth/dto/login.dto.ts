import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(255)
  usernameOrEmail: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
