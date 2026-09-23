import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PomodoroMode } from '@prisma/client';

export class RecordSessionDto {
  @IsEnum(PomodoroMode, { message: 'Modo deve ser FOCUS, SHORT_BREAK ou LONG_BREAK.' })
  mode!: PomodoroMode;

  @IsDateString({}, { message: 'Início deve ser uma data válida.' })
  startedAt!: string;

  @IsDateString({}, { message: 'Fim deve ser uma data válida.' })
  endedAt!: string;

  @IsInt({ message: 'Duração deve ser um inteiro de minutos.' })
  @Min(1, { message: 'Duração deve ser de ao menos 1 minuto.' })
  @Max(180, { message: 'Duração deve ser de no máximo 180 minutos.' })
  durationMinutes!: number;

  @IsOptional()
  @IsUUID(undefined, { message: 'Projeto inválido.' })
  projectId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'Tarefa inválida.' })
  taskId?: string;
}
