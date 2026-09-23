import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class MarkHabitDto {
  @IsOptional()
  @IsInt({ message: 'Valor deve ser um inteiro.' })
  @Min(1, { message: 'Valor deve ser de ao menos 1.' })
  value?: number;

  @IsOptional()
  @IsString({ message: 'Nota deve ser um texto.' })
  @MaxLength(280, { message: 'Nota deve ter no máximo 280 caracteres.' })
  note?: string;
}
