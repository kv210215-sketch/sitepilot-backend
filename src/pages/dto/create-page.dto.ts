import { IsBoolean, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  path!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsBoolean()
  published = false;

  @IsUUID()
  projectId!: string;
}
