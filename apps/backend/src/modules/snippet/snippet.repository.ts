import { Injectable } from '@nestjs/common';
import { Prisma, Snippet } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import {
  NewSnippet,
  SnippetChanges,
  SnippetQuery,
  SnippetRepository,
} from './snippet.repository.interface';

@Injectable()
export class PrismaSnippetRepository implements SnippetRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVisible(query: SnippetQuery): Promise<Snippet[]> {
    const where: Prisma.SnippetWhereInput = {
      workspaceId: query.workspaceId,
      folder: query.folder,
      language: query.language,
      OR: query.includePending
        ? [
            { authorId: query.authorId },
            { visibility: 'PUBLIC' },
            { moderationStatus: 'PENDING' },
          ]
        : [{ authorId: query.authorId }, { visibility: 'PUBLIC' }],
    };

    if (query.q) {
      where.AND = [
        {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { code: { contains: query.q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return this.prisma.snippet.findMany({
      where,
      orderBy: [{ folder: 'asc' }, { name: 'asc' }],
    });
  }

  findById(id: string): Promise<Snippet | null> {
    return this.prisma.snippet.findUnique({ where: { id } });
  }

  create(data: NewSnippet): Promise<Snippet> {
    return this.prisma.snippet.create({ data });
  }

  update(id: string, changes: SnippetChanges): Promise<Snippet> {
    return this.prisma.snippet.update({ where: { id }, data: changes });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.snippet.delete({ where: { id } });
  }
}
