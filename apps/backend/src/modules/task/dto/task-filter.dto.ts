import { IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { TaskPriority, TaskType } from '@prisma/client';

export class TaskFilterDto {
  @IsOptional()
  @IsString({ message: 'Responsável inválido.' })
  @Length(1, 64, { message: 'Responsável inválido.' })
  assigneeId?: string;

  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Prioridade deve ser LOW, MEDIUM ou HIGH.' })
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID(undefined, { message: 'Coluna inválida.' })
  columnId?: string;

  @IsOptional()
  @IsEnum(TaskType, { message: 'Tipo inválido.' })
  type?: TaskType;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Busca deve ter no máximo 80 caracteres.' })
  q?: string;
}
