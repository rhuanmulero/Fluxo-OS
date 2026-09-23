import { KnowledgeScope } from '@prisma/client';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class DocumentFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  folder?: string;

  @IsOptional()
  @IsIn(['PRIVATE', 'PROJECT', 'WORKSPACE'], { message: 'Escopo inválido.' })
  scope?: KnowledgeScope;

  @IsOptional()
  @IsUUID(undefined, { message: 'Projeto inválido.' })
  projectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Busca deve ter no máximo 80 caracteres.' })
  q?: string;
}
