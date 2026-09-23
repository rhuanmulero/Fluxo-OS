import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateEventDto } from './create-event.dto';

export class UpdateEventDto extends PartialType(
  OmitType(CreateEventDto, ['projectId'] as const),
) {
  @IsOptional()
  @IsUUID('4', { message: 'Projeto inválido.' })
  projectId?: string | null;
}
