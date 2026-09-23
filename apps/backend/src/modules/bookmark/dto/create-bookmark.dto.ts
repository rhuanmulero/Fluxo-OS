import { KnowledgeScope } from '@prisma/client';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBookmarkDto {
  @IsString()
  @MinLength(1, { message: 'Nome do link é obrigatório.' })
  @MaxLength(120, { message: 'Nome deve ter no máximo 120 caracteres.' })
  name!: string;

  @IsString()
  @MinLength(1, { message: 'Pasta é obrigatória.' })
  @MaxLength(60, { message: 'Pasta deve ter no máximo 60 caracteres.' })
  folder!: string;

  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Informe um endereço que comece com http:// ou https://.' },
  )
  @MaxLength(2048, { message: 'O endereço é longo demais.' })
  url!: string;

  @IsIn(['PRIVATE', 'PROJECT', 'WORKSPACE'], { message: 'Escopo inválido.' })
  scope!: KnowledgeScope;

  @IsOptional()
  @IsUUID(undefined, { message: 'Projeto inválido.' })
  projectId?: string;
}
