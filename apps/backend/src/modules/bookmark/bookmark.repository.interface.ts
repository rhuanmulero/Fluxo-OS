import { Bookmark, KnowledgeScope } from '@prisma/client';
import { KnowledgeQuery } from '../document/document.repository.interface';

export const BOOKMARK_REPOSITORY = Symbol('BookmarkRepository');

export interface NewBookmark {
  workspaceId: string;
  authorId: string;
  projectId?: string;
  name: string;
  folder: string;
  url: string;
  scope: KnowledgeScope;
}

export interface BookmarkChanges {
  name?: string;
  folder?: string;
  url?: string;
  scope?: KnowledgeScope;
  projectId?: string | null;
}

export interface BookmarkRepository {
  findVisible(query: KnowledgeQuery): Promise<Bookmark[]>;
  findById(id: string): Promise<Bookmark | null>;
  create(data: NewBookmark): Promise<Bookmark>;
  update(id: string, changes: BookmarkChanges): Promise<Bookmark>;
  delete(id: string): Promise<void>;
}
