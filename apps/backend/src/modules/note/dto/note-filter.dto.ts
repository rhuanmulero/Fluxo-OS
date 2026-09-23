import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class NoteFilterDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'Projeto inválido.' })
  projectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Busca deve ter no máximo 80 caracteres.' })
  q?: string;
}
