import { Note, NoteVisibility } from '@prisma/client';

export class NoteResponseDto {
  constructor(
    readonly id: string,
    readonly workspaceId: string,
    readonly authorId: string,
    readonly projectId: string | null,
    readonly title: string,
    readonly body: string,
    readonly color: string | null,
    readonly isPinned: boolean,
    readonly visibility: NoteVisibility,
    readonly updatedAt: Date,
  ) {}

  static from(note: Note): NoteResponseDto {
    return new NoteResponseDto(
      note.id,
      note.workspaceId,
      note.authorId,
      note.projectId,
      note.title,
      note.body,
      note.color,
      note.isPinned,
      note.visibility,
      note.updatedAt,
    );
  }
}
