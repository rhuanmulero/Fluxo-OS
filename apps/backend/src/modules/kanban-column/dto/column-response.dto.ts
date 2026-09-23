import { KanbanColumn, TaskStatus } from '@prisma/client';

export class ColumnResponseDto {
  constructor(
    readonly id: string,
    readonly projectId: string,
    readonly name: string,
    readonly position: number,
    readonly color: string | null,
    readonly status: TaskStatus,
  ) {}

  static from(column: KanbanColumn): ColumnResponseDto {
    return new ColumnResponseDto(
      column.id,
      column.projectId,
      column.name,
      column.position,
      column.color,
      column.status,
    );
  }
}
