import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

export interface DueTask {
  id: string;
  title: string;
  dueDate: Date;
  assigneeId: string;
  project: { name: string };
}

@Injectable()
export class DeadlineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async dueBetween(from: Date, to: Date): Promise<DueTask[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        dueDate: { gte: from, lte: to },
        assigneeId: { not: null },
        kanbanColumn: { status: { not: 'DONE' } },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assigneeId: true,
        project: { select: { name: true } },
      },
    });

    return tasks.flatMap((task) =>
      task.dueDate === null || task.assigneeId === null
        ? []
        : [
            {
              id: task.id,
              title: task.title,
              dueDate: task.dueDate,
              assigneeId: task.assigneeId,
              project: task.project,
            },
          ],
    );
  }
}
