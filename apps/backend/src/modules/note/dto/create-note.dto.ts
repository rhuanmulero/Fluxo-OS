import {
  IsBoolean,
  IsHexColor,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SanitizeRichText } from '../../../common/validation/html-sanitizer';

export class CreateNoteDto {
  @IsString()
  @MinLength(1, { message: 'Título da nota é obrigatório.' })
  @MaxLength(120, { message: 'Título deve ter no máximo 120 caracteres.' })
  title!: string;

  @SanitizeRichText()
  @IsString()
  @MinLength(1, { message: 'A nota precisa de ao menos 1 caractere.' })
  @MaxLength(7000, { message: 'A nota deve ter no máximo 7000 caracteres.' })
  body!: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'Projeto inválido.' })
  projectId?: string;

  @IsOptional()
  @IsHexColor({ message: 'Cor da nota deve ser um hexadecimal.' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}
