import { Bookmark, KnowledgeScope } from '@prisma/client';

export class BookmarkResponseDto {
  constructor(
    readonly id: string,
    readonly workspaceId: string,
    readonly projectId: string | null,
    readonly authorId: string,
    readonly name: string,
    readonly folder: string,
    readonly url: string,
    readonly scope: KnowledgeScope,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static from(bookmark: Bookmark): BookmarkResponseDto {
    return new BookmarkResponseDto(
      bookmark.id,
      bookmark.workspaceId,
      bookmark.projectId,
      bookmark.authorId,
      bookmark.name,
      bookmark.folder,
      bookmark.url,
      bookmark.scope,
      bookmark.createdAt,
      bookmark.updatedAt,
    );
  }
}
