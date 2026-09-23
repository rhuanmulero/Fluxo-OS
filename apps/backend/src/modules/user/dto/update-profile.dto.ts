import {
  IsArray,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Cargo deve ter no máximo 80 caracteres.' })
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Bio deve ter no máximo 500 caracteres.' })
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true, message: 'Cada tecnologia deve ter no máximo 40 caracteres.' })
  stack?: string[];

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'Banner deve ser uma URL válida.' })
  bannerUrl?: string;

  @IsOptional()
  @IsHexColor({ message: 'Cor do tema deve ser um hexadecimal.' })
  themeColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Vibe deve ter no máximo 60 caracteres.' })
  vibe?: string;

  @IsOptional()
  @IsEnum(UserStatus, { message: 'Status inválido.' })
  status?: UserStatus;
}
