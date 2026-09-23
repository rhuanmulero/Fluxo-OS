import { Injectable } from '@nestjs/common';
import { Note, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { NewNote, NoteChanges, NoteQuery, NoteRepository } from './note.repository.interface';

@Injectable()
export class PrismaNoteRepository implements NoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVisible(query: NoteQuery): Promise<Note[]> {
    const where: Prisma.NoteWhereInput = {
      workspaceId: query.workspaceId,
      projectId: query.projectId,
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { body: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      AND: {
        OR: [
          { authorId: query.authorId },
          { visibility: 'PROJECT', projectId: { in: query.visibleProjectIds } },
        ],
      },
    };

    return this.prisma.note.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  findById(id: string): Promise<Note | null> {
    return this.prisma.note.findUnique({ where: { id } });
  }

  create(data: NewNote): Promise<Note> {
    return this.prisma.note.create({ data });
  }

  update(id: string, changes: NoteChanges): Promise<Note> {
    return this.prisma.note.update({ where: { id }, data: changes });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.note.delete({ where: { id } });
  }
}
