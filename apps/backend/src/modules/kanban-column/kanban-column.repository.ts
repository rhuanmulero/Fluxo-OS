import { Injectable } from '@nestjs/common';
import { KanbanColumn } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import {
  ColumnChanges,
  KanbanColumnRepository,
  NewColumn,
} from './kanban-column.repository.interface';

@Injectable()
export class PrismaKanbanColumnRepository implements KanbanColumnRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByProject(projectId: string): Promise<KanbanColumn[]> {
    return this.prisma.kanbanColumn.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
  }

  findById(id: string): Promise<KanbanColumn | null> {
    return this.prisma.kanbanColumn.findUnique({ where: { id } });
  }

  create(data: NewColumn): Promise<KanbanColumn> {
    return this.prisma.kanbanColumn.create({ data });
  }

  update(id: string, changes: ColumnChanges): Promise<KanbanColumn> {
    return this.prisma.kanbanColumn.update({ where: { id }, data: changes });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.kanbanColumn.delete({ where: { id } });
  }

  async reorder(projectId: string, orderedIds: string[]): Promise<KanbanColumn[]> {
    await this.prisma.$transaction(
      orderedIds.map((id, position) =>
        this.prisma.kanbanColumn.update({ where: { id }, data: { position } }),
      ),
    );

    return this.listByProject(projectId);
  }

  countTasks(columnId: string): Promise<number> {
    return this.prisma.task.count({ where: { kanbanColumnId: columnId } });
  }

  async nextPosition(projectId: string): Promise<number> {
    const last = await this.prisma.kanbanColumn.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return last ? last.position + 1 : 0;
  }
}
