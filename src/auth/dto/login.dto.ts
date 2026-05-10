import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MaxLength(72) // bcrypt silently truncates at 72 bytes — cap input to match
  password: string;
}
