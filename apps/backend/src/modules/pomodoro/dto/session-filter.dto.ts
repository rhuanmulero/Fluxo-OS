import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class SessionFilterDto {
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial inválida.' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data final inválida.' })
  to?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'Tarefa inválida.' })
  taskId?: string;
}
