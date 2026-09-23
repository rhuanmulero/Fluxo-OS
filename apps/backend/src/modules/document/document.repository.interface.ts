import { Document, KnowledgeScope } from '@prisma/client';

export const DOCUMENT_REPOSITORY = Symbol('DocumentRepository');

export interface KnowledgeQuery {
  workspaceId: string;
  authorId: string;
  visibleProjectIds: string[];
  projectId?: string;
  folder?: string;
  scope?: KnowledgeScope;
  q?: string;
}

export interface NewDocument {
  workspaceId: string;
  authorId: string;
  projectId?: string;
  name: string;
  folder: string;
  scope: KnowledgeScope;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}

export interface DocumentChanges {
  name?: string;
  folder?: string;
  scope?: KnowledgeScope;
  projectId?: string | null;
}

export interface DocumentRepository {
  findVisible(query: KnowledgeQuery): Promise<Document[]>;
  findById(id: string): Promise<Document | null>;
  create(data: NewDocument): Promise<Document>;
  update(id: string, changes: DocumentChanges): Promise<Document>;
  delete(id: string): Promise<void>;
}
