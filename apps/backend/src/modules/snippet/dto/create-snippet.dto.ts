import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateSnippetDto {
  @IsString()
  @MinLength(1, { message: 'Nome do snippet é obrigatório.' })
  @MaxLength(120, { message: 'Nome deve ter no máximo 120 caracteres.' })
  name!: string;

  @IsString()
  @MinLength(1, { message: 'Pasta é obrigatória.' })
  @MaxLength(60, { message: 'Pasta deve ter no máximo 60 caracteres.' })
  folder!: string;

  @IsString()
  @MinLength(1, { message: 'Linguagem é obrigatória.' })
  @MaxLength(40, { message: 'Linguagem deve ter no máximo 40 caracteres.' })
  language!: string;

  @IsString()
  @MinLength(1, { message: 'O código é obrigatório.' })
  @MaxLength(50000, { message: 'O código deve ter no máximo 50000 caracteres.' })
  code!: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'Projeto inválido.' })
  projectId?: string;
}
