import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class EventFilterDto {
  @IsOptional()
  @IsISO8601({}, { message: 'Data inicial do filtro inválida.' })
  from?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Data final do filtro inválida.' })
  to?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Projeto inválido.' })
  projectId?: string;
}
