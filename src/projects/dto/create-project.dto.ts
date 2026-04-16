import { IsNotEmpty, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase kebab-case' })
  @MaxLength(150)
  slug!: string;

  @IsUUID()
  organizationId!: string;
}
