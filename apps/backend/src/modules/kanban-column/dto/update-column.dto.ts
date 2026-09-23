import {
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class UpdateColumnDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Nome da coluna é obrigatório.' })
  @MaxLength(40, { message: 'Nome da coluna deve ter no máximo 40 caracteres.' })
  name?: string;

  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Status deve ser TODO, IN_PROGRESS ou DONE.' })
  status?: TaskStatus;

  @IsOptional()
  @IsHexColor({ message: 'Cor da coluna deve ser um hexadecimal.' })
  color?: string;
}
