import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoadmapDto {
  @IsString()
  @MinLength(1, { message: 'Título do roadmap é obrigatório.' })
  @MaxLength(120, { message: 'Título deve ter no máximo 120 caracteres.' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Descrição deve ter no máximo 2000 caracteres.' })
  description?: string;
}
