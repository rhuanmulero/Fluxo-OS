import { Injectable } from '@nestjs/common';
import { Bookmark } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { KnowledgeQuery } from '../document/document.repository.interface';
import {
  BookmarkChanges,
  BookmarkRepository,
  NewBookmark,
} from './bookmark.repository.interface';

@Injectable()
export class PrismaBookmarkRepository implements BookmarkRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVisible(query: KnowledgeQuery): Promise<Bookmark[]> {
    return this.prisma.bookmark.findMany({
      where: {
        workspaceId: query.workspaceId,
        ...(query.folder ? { folder: query.folder } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.scope ? { scope: query.scope } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { folder: { contains: query.q, mode: 'insensitive' } },
                { url: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
        AND: {
          OR: [
            { scope: 'PRIVATE', authorId: query.authorId },
            { scope: 'PROJECT', projectId: { in: query.visibleProjectIds } },
            { scope: 'WORKSPACE' },
          ],
        },
      },
      orderBy: [{ folder: 'asc' }, { name: 'asc' }],
    });
  }

  findById(id: string): Promise<Bookmark | null> {
    return this.prisma.bookmark.findUnique({ where: { id } });
  }

  create(data: NewBookmark): Promise<Bookmark> {
    return this.prisma.bookmark.create({ data });
  }

  update(id: string, changes: BookmarkChanges): Promise<Bookmark> {
    return this.prisma.bookmark.update({ where: { id }, data: changes });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.bookmark.delete({ where: { id } });
  }
}
