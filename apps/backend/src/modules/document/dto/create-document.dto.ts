import { KnowledgeScope } from '@prisma/client';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1, { message: 'Nome do documento é obrigatório.' })
  @MaxLength(120, { message: 'Nome deve ter no máximo 120 caracteres.' })
  name!: string;

  @IsString()
  @MinLength(1, { message: 'Pasta é obrigatória.' })
  @MaxLength(60, { message: 'Pasta deve ter no máximo 60 caracteres.' })
  folder!: string;

  @IsIn(['PRIVATE', 'PROJECT', 'WORKSPACE'], { message: 'Escopo inválido.' })
  scope!: KnowledgeScope;

  @IsOptional()
  @IsUUID(undefined, { message: 'Projeto inválido.' })
  projectId?: string;
}
