import { ModerationStatus, Snippet, SnippetVisibility } from '@prisma/client';

export class SnippetResponseDto {
  constructor(
    readonly id: string,
    readonly workspaceId: string,
    readonly projectId: string | null,
    readonly authorId: string,
    readonly name: string,
    readonly folder: string,
    readonly language: string,
    readonly code: string,
    readonly visibility: SnippetVisibility,
    readonly moderationStatus: ModerationStatus,
    readonly updatedAt: Date,
  ) {}

  static from(snippet: Snippet): SnippetResponseDto {
    return new SnippetResponseDto(
      snippet.id,
      snippet.workspaceId,
      snippet.projectId,
      snippet.authorId,
      snippet.name,
      snippet.folder,
      snippet.language,
      snippet.code,
      snippet.visibility,
      snippet.moderationStatus,
      snippet.updatedAt,
    );
  }
}
