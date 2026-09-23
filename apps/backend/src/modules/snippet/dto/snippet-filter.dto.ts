import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SnippetFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  folder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Busca deve ter no máximo 80 caracteres.' })
  q?: string;
}
