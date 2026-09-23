import { Note, NoteVisibility } from '@prisma/client';

export const NOTE_REPOSITORY = Symbol('NoteRepository');

export interface NewNote {
  workspaceId: string;
  authorId: string;
  projectId?: string;
  title: string;
  body: string;
  color?: string;
  isPinned: boolean;
}

export interface NoteChanges {
  title?: string;
  body?: string;
  color?: string;
  isPinned?: boolean;
  projectId?: string | null;
  visibility?: NoteVisibility;
}

export interface NoteQuery {
  workspaceId: string;
  authorId: string;
  visibleProjectIds: string[];
  projectId?: string;
  q?: string;
}

export interface NoteRepository {
  findVisible(query: NoteQuery): Promise<Note[]>;
  findById(id: string): Promise<Note | null>;
  create(data: NewNote): Promise<Note>;
  update(id: string, changes: NoteChanges): Promise<Note>;
  delete(id: string): Promise<void>;
}
