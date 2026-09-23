import { Prisma, RecurrenceRule, Task, TaskPriority, TaskType } from '@prisma/client';

export const TASK_REPOSITORY = Symbol('TaskRepository');

export interface TaskFilter {
  assigneeId?: string;
  priority?: TaskPriority;
  columnId?: string;
  type?: TaskType;
  q?: string;
}

export interface NewTask {
  projectId: string;
  kanbanColumnId: string;
  title: string;
  shortDescription?: string;
  description?: string;
  priority: TaskPriority;
  type: TaskType;
  tags: string[];
  folder?: string;
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: Prisma.Decimal | number;
  recurrence: RecurrenceRule;
  position: number;
  createdById: string;
}

export interface TaskChanges {
  title?: string;
  shortDescription?: string;
  description?: string;
  priority?: TaskPriority;
  type?: TaskType;
  tags?: string[];
  folder?: string;
  assigneeId?: string | null;
  dueDate?: Date | null;
  estimatedHours?: Prisma.Decimal | number | null;
  recurrence?: RecurrenceRule;
  isPinned?: boolean;
}

export type TaskWithColumn = Task & {
  kanbanColumn: { id: string; name: string; status: string };
};

export interface TaskRepository {
  findManyByProject(projectId: string, filter: TaskFilter): Promise<TaskWithColumn[]>;
  findById(id: string): Promise<TaskWithColumn | null>;
  create(data: NewTask): Promise<TaskWithColumn>;
  update(id: string, changes: TaskChanges): Promise<TaskWithColumn>;
  delete(id: string): Promise<void>;
  move(id: string, columnId: string, position: number): Promise<TaskWithColumn>;
  nextPosition(columnId: string): Promise<number>;
}
