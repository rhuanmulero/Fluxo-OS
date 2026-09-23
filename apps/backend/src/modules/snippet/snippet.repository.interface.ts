import { ModerationStatus, Snippet, SnippetVisibility } from '@prisma/client';

export const SNIPPET_REPOSITORY = Symbol('SnippetRepository');

export interface NewSnippet {
  workspaceId: string;
  authorId: string;
  projectId?: string;
  name: string;
  folder: string;
  language: string;
  code: string;
  visibility: SnippetVisibility;
  moderationStatus: ModerationStatus;
}

export interface SnippetChanges {
  name?: string;
  folder?: string;
  language?: string;
  code?: string;
  visibility?: SnippetVisibility;
  moderationStatus?: ModerationStatus;
  reviewedById?: string | null;
  reviewedAt?: Date | null;
}

export interface SnippetQuery {
  workspaceId: string;
  authorId: string;
  includePending?: boolean;
  folder?: string;
  language?: string;
  q?: string;
}

export interface SnippetRepository {
  findVisible(query: SnippetQuery): Promise<Snippet[]>;
  findById(id: string): Promise<Snippet | null>;
  create(data: NewSnippet): Promise<Snippet>;
  update(id: string, changes: SnippetChanges): Promise<Snippet>;
  delete(id: string): Promise<void>;
}
