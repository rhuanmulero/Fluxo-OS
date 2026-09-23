import {
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { HabitFrequency } from '@prisma/client';

export class CreateHabitDto {
  @IsString({ message: 'Nome deve ser um texto.' })
  @MinLength(1, { message: 'Nome deve ter ao menos 1 caractere.' })
  @MaxLength(80, { message: 'Nome deve ter no máximo 80 caracteres.' })
  name!: string;

  @IsOptional()
  @IsIn(['DAILY', 'WEEKLY'], { message: 'Frequência deve ser DAILY ou WEEKLY.' })
  frequency?: HabitFrequency;

  @IsOptional()
  @IsInt({ message: 'Meta por período deve ser um inteiro.' })
  @Min(1, { message: 'Meta por período deve ser de ao menos 1.' })
  @Max(50, { message: 'Meta por período deve ser de no máximo 50.' })
  targetPerPeriod?: number;

  @IsOptional()
  @IsHexColor({ message: 'Cor deve ser um código hexadecimal válido.' })
  color?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Projeto inválido.' })
  projectId?: string;
}
