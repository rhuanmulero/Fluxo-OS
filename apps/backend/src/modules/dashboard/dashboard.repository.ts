import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { TaskWithColumn } from '../task/task.repository.interface';
import {
  ColumnCount,
  ColumnStatus,
  DashboardRepository,
} from './dashboard.repository.interface';

const withColumn = {
  kanbanColumn: { select: { id: true, name: true, status: true } },
};

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async projectIdsOf(workspaceId: string): Promise<string[]> {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      select: { id: true },
    });

    return projects.map((project) => project.id);
  }

  tasksDueBetween(projectIds: string[], from: Date, to: Date): Promise<TaskWithColumn[]> {
    return this.prisma.task.findMany({
      where: { projectId: { in: projectIds }, dueDate: { gte: from, lte: to } },
      include: withColumn,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  }

  async countsByColumn(projectIds: string[]): Promise<ColumnCount[]> {
    const grouped = await this.prisma.task.groupBy({
      by: ['projectId', 'kanbanColumnId'],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });

    return grouped.map((row) => ({
      projectId: row.projectId,
      kanbanColumnId: row.kanbanColumnId,
      count: row._count._all,
    }));
  }

  columnsOf(projectIds: string[]): Promise<ColumnStatus[]> {
    return this.prisma.kanbanColumn.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true, status: true },
    });
  }

  overdueCount(
    projectIds: string[],
    before: Date,
    doneColumnIds: string[],
  ): Promise<number> {
    return this.prisma.task.count({
      where: {
        projectId: { in: projectIds },
        dueDate: { lt: before },
        kanbanColumnId: { notIn: doneColumnIds },
      },
    });
  }

  assignedDoneCount(userId: string, doneColumnIds: string[]): Promise<number> {
    return this.prisma.task.count({
      where: { assigneeId: userId, kanbanColumnId: { in: doneColumnIds } },
    });
  }

  async allDoneColumnIds(): Promise<string[]> {
    const columns = await this.prisma.kanbanColumn.findMany({
      where: { status: 'DONE' },
      select: { id: true },
    });

    return columns.map((column) => column.id);
  }

  async activeDaysOf(userId: string): Promise<number> {
    const sessions = await this.prisma.pomodoroSession.findMany({
      where: { userId },
      select: { startedAt: true },
    });

    const days = new Set(
      sessions.map((session) => session.startedAt.toISOString().slice(0, 10)),
    );

    return days.size;
  }
}
