import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RoadmapStageStatus } from '@prisma/client';

export class UpdateStageDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Título da etapa é obrigatório.' })
  @MaxLength(120, { message: 'Título deve ter no máximo 120 caracteres.' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Descrição deve ter no máximo 2000 caracteres.' })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Meta deve ter no máximo 500 caracteres.' })
  goal?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Prazo deve ser uma data válida.' })
  dueDate?: string | null;

  @IsOptional()
  @IsInt({ message: 'Pontos devem ser um número inteiro.' })
  @Min(0, { message: 'Pontos não podem ser negativos.' })
  @Max(100, { message: 'Pontos devem ser no máximo 100.' })
  points?: number;

  @IsOptional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'DONE'], { message: 'Status inválido.' })
  status?: RoadmapStageStatus;
}
