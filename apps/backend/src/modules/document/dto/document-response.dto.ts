import { Document, KnowledgeScope } from '@prisma/client';

export class DocumentResponseDto {
  constructor(
    readonly id: string,
    readonly workspaceId: string,
    readonly projectId: string | null,
    readonly authorId: string,
    readonly name: string,
    readonly folder: string,
    readonly scope: KnowledgeScope,
    readonly fileName: string,
    readonly mimeType: string,
    readonly sizeBytes: number,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static from(document: Document): DocumentResponseDto {
    return new DocumentResponseDto(
      document.id,
      document.workspaceId,
      document.projectId,
      document.authorId,
      document.name,
      document.folder,
      document.scope,
      document.fileName,
      document.mimeType,
      document.sizeBytes,
      document.createdAt,
      document.updatedAt,
    );
  }
}
