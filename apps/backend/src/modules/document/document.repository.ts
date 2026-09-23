import { Injectable } from '@nestjs/common';
import { Document } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import {
  DocumentChanges,
  DocumentRepository,
  KnowledgeQuery,
  NewDocument,
} from './document.repository.interface';

@Injectable()
export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVisible(query: KnowledgeQuery): Promise<Document[]> {
    return this.prisma.document.findMany({
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

  findById(id: string): Promise<Document | null> {
    return this.prisma.document.findUnique({ where: { id } });
  }

  create(data: NewDocument): Promise<Document> {
    return this.prisma.document.create({ data });
  }

  update(id: string, changes: DocumentChanges): Promise<Document> {
    return this.prisma.document.update({ where: { id }, data: changes });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.document.delete({ where: { id } });
  }
}
