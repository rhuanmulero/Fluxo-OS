import { TaskStatus } from '@prisma/client';
import { TaskWithColumn } from '../task/task.repository.interface';

export const DASHBOARD_REPOSITORY = Symbol('DashboardRepository');

export interface ColumnCount {
  projectId: string;
  kanbanColumnId: string;
  count: number;
}

export interface ColumnStatus {
  id: string;
  status: TaskStatus;
}

export interface DashboardRepository {
  projectIdsOf(workspaceId: string): Promise<string[]>;
  tasksDueBetween(projectIds: string[], from: Date, to: Date): Promise<TaskWithColumn[]>;
  countsByColumn(projectIds: string[]): Promise<ColumnCount[]>;
  columnsOf(projectIds: string[]): Promise<ColumnStatus[]>;
  overdueCount(projectIds: string[], before: Date, doneColumnIds: string[]): Promise<number>;
  assignedDoneCount(userId: string, doneColumnIds: string[]): Promise<number>;
  allDoneColumnIds(): Promise<string[]>;
  activeDaysOf(userId: string): Promise<number>;
}
