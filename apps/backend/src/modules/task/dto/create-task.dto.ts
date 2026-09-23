import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RecurrenceRule, TaskPriority, TaskType } from '@prisma/client';
import { SanitizeRichText } from '../../../common/validation/html-sanitizer';

export class CreateTaskDto {
  @IsUUID(undefined, { message: 'Coluna inválida.' })
  kanbanColumnId!: string;

  @IsString()
  @MinLength(1, { message: 'Título da tarefa é obrigatório.' })
  @MaxLength(120, { message: 'Título deve ter no máximo 120 caracteres.' })
  title!: string;

  @IsEnum(TaskPriority, { message: 'Prioridade deve ser LOW, MEDIUM ou HIGH.' })
  priority!: TaskPriority;

  @IsEnum(TaskType, { message: 'Tipo deve ser FEATURE, BUG, DESIGN, REFACTOR ou OTHER.' })
  type!: TaskType;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Resumo deve ter no máximo 200 caracteres.' })
  shortDescription?: string;

  @IsOptional()
  @SanitizeRichText()
  @IsString()
  @MaxLength(20000, { message: 'Descrição deve ter no máximo 20000 caracteres.' })
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true, message: 'Cada etiqueta deve ter no máximo 40 caracteres.' })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Pasta deve ter no máximo 60 caracteres.' })
  folder?: string;

  @IsOptional()
  @IsString({ message: 'Responsável inválido.' })
  @Length(1, 64, { message: 'Responsável inválido.' })
  assigneeId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Prazo deve ser uma data válida.' })
  dueDate?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Estimativa deve ser um número.' })
  @Min(0, { message: 'Estimativa não pode ser negativa.' })
  @Max(999, { message: 'Estimativa deve ser menor que 1000 horas.' })
  estimatedHours?: number;

  @IsOptional()
  @IsEnum(RecurrenceRule, { message: 'Repetição inválida.' })
  recurrence?: RecurrenceRule;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}
