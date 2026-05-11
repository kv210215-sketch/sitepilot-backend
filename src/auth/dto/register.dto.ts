import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt silently truncates at 72 bytes — cap input to match
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
