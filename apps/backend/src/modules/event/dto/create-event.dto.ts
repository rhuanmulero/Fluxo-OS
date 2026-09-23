import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1, { message: 'Informe um título para o evento.' })
  @MaxLength(120, { message: 'Título deve ter no máximo 120 caracteres.' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Descrição deve ter no máximo 2000 caracteres.' })
  description?: string;

  @IsISO8601({}, { message: 'Data de início inválida.' })
  startsAt!: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Data de término inválida.' })
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'Projeto inválido.' })
  projectId?: string;

  @IsOptional()
  @IsArray({ message: 'Participantes devem ser uma lista.' })
  @ArrayMaxSize(50, { message: 'No máximo 50 participantes por evento.' })
  @IsString({ each: true, message: 'Participante inválido.' })
  participantIds?: string[];
}
