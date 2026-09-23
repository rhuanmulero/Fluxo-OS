import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import {
  NewTask,
  TaskChanges,
  TaskFilter,
  TaskRepository,
  TaskWithColumn,
} from './task.repository.interface';

const withColumn = {
  kanbanColumn: { select: { id: true, name: true, status: true } },
};

@Injectable()
export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByProject(projectId: string, filter: TaskFilter): Promise<TaskWithColumn[]> {
    const where: Prisma.TaskWhereInput = {
      projectId,
      assigneeId: filter.assigneeId,
      priority: filter.priority,
      kanbanColumnId: filter.columnId,
      type: filter.type,
    };

    if (filter.q) {
      where.OR = [
        { title: { contains: filter.q, mode: 'insensitive' } },
        { shortDescription: { contains: filter.q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.task.findMany({
      where,
      include: withColumn,
      orderBy: [{ kanbanColumnId: 'asc' }, { position: 'asc' }],
    });
  }

  findById(id: string): Promise<TaskWithColumn | null> {
    return this.prisma.task.findUnique({ where: { id }, include: withColumn });
  }

  create(data: NewTask): Promise<TaskWithColumn> {
    return this.prisma.task.create({ data, include: withColumn });
  }

  update(id: string, changes: TaskChanges): Promise<TaskWithColumn> {
    return this.prisma.task.update({ where: { id }, data: changes, include: withColumn });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.task.delete({ where: { id } });
  }

  move(id: string, columnId: string, position: number): Promise<TaskWithColumn> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUniqueOrThrow({ where: { id } });

      await tx.task.updateMany({
        where: { kanbanColumnId: task.kanbanColumnId, position: { gt: task.position } },
        data: { position: { decrement: 1 } },
      });

      await tx.task.updateMany({
        where: { kanbanColumnId: columnId, position: { gte: position } },
        data: { position: { increment: 1 } },
      });

      return tx.task.update({
        where: { id },
        data: { kanbanColumnId: columnId, position },
        include: withColumn,
      });
    });
  }

  async nextPosition(columnId: string): Promise<number> {
    const last = await this.prisma.task.findFirst({
      where: { kanbanColumnId: columnId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return last ? last.position + 1 : 0;
  }
}
