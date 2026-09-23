import { KanbanColumn, TaskStatus } from '@prisma/client';

export const KANBAN_COLUMN_REPOSITORY = Symbol('KanbanColumnRepository');

export interface NewColumn {
  projectId: string;
  name: string;
  position: number;
  color?: string;
  status: TaskStatus;
}

export interface ColumnChanges {
  name?: string;
  color?: string;
  status?: TaskStatus;
}

export interface KanbanColumnRepository {
  listByProject(projectId: string): Promise<KanbanColumn[]>;
  findById(id: string): Promise<KanbanColumn | null>;
  create(data: NewColumn): Promise<KanbanColumn>;
  update(id: string, changes: ColumnChanges): Promise<KanbanColumn>;
  delete(id: string): Promise<void>;
  reorder(projectId: string, orderedIds: string[]): Promise<KanbanColumn[]>;
  countTasks(columnId: string): Promise<number>;
  nextPosition(projectId: string): Promise<number>;
}
