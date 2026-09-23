import { RecurrenceRule, TaskPriority, TaskType } from '@prisma/client';
import { TaskWithColumn } from '../task.repository.interface';

export class TaskResponseDto {
  constructor(
    readonly id: string,
    readonly projectId: string,
    readonly columnId: string,
    readonly status: string,
    readonly title: string,
    readonly shortDescription: string | null,
    readonly description: string | null,
    readonly priority: TaskPriority,
    readonly type: TaskType,
    readonly tags: string[],
    readonly folder: string | null,
    readonly assigneeId: string | null,
    readonly dueDate: Date | null,
    readonly estimatedHours: number | null,
    readonly recurrence: RecurrenceRule,
    readonly isPinned: boolean,
    readonly position: number,
  ) {}

  static from(task: TaskWithColumn): TaskResponseDto {
    return new TaskResponseDto(
      task.id,
      task.projectId,
      task.kanbanColumnId,
      task.kanbanColumn.status,
      task.title,
      task.shortDescription,
      task.description,
      task.priority,
      task.type,
      task.tags,
      task.folder,
      task.assigneeId,
      task.dueDate,
      task.estimatedHours === null ? null : Number(task.estimatedHours),
      task.recurrence,
      task.isPinned,
      task.position,
    );
  }
}
