import { IsOptional, IsUUID } from 'class-validator';

export class DashboardFilterDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'Projeto inválido.' })
  projectId?: string;
}
