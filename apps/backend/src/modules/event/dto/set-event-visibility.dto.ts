import { IsIn } from 'class-validator';

export class SetEventVisibilityDto {
  @IsIn(['PRIVATE', 'PROJECT'], { message: 'Visibilidade deve ser PRIVATE ou PROJECT.' })
  visibility!: 'PRIVATE' | 'PROJECT';
}
