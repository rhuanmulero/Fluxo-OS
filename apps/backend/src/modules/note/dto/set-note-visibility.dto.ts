import { IsEnum } from 'class-validator';
import { NoteVisibility } from '@prisma/client';

export class SetNoteVisibilityDto {
  @IsEnum(NoteVisibility, { message: 'Visibilidade deve ser PRIVATE ou PROJECT.' })
  visibility!: NoteVisibility;
}
