import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  KANBAN_COLUMN_REPOSITORY,
  KanbanColumnRepository,
} from '../kanban-column/kanban-column.repository.interface';
import { PROJECT_REPOSITORY, ProjectRepository } from '../project/project.repository.interface';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TASK_REPOSITORY, TaskRepository, TaskWithColumn } from './task.repository.interface';

@Injectable()
export class TaskService {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(KANBAN_COLUMN_REPOSITORY) private readonly columns: KanbanColumnRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
  ) {}

  async list(projectId: string, filter: TaskFilterDto): Promise<TaskResponseDto[]> {
    const tasks = await this.tasks.findManyByProject(projectId, filter);

    return tasks.map(TaskResponseDto.from);
  }

  async find(projectId: string, taskId: string): Promise<TaskResponseDto> {
    return TaskResponseDto.from(await this.requireIn(projectId, taskId));
  }

  async create(projectId: string, userId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    await this.requireColumnIn(projectId, dto.kanbanColumnId);
    await this.requireAssigneeInProject(projectId, dto.assigneeId);

    const position = await this.tasks.nextPosition(dto.kanbanColumnId);

    const task = await this.tasks.create({
      projectId,
      createdById: userId,
      kanbanColumnId: dto.kanbanColumnId,
      title: dto.title,
      shortDescription: dto.shortDescription,
      description: dto.description,
      priority: dto.priority,
      type: dto.type,
      tags: dto.tags ?? [],
      folder: dto.folder,
      assigneeId: dto.assigneeId,
      dueDate: dto.dueDate === undefined ? undefined : new Date(dto.dueDate),
      estimatedHours: dto.estimatedHours,
      recurrence: dto.recurrence ?? 'NONE',
      position,
    });

    return TaskResponseDto.from(task);
  }

  async update(projectId: string, taskId: string, dto: UpdateTaskDto): Promise<TaskResponseDto> {
    await this.requireIn(projectId, taskId);
    await this.requireAssigneeInProject(projectId, dto.assigneeId);

    const task = await this.tasks.update(taskId, {
      ...dto,
      dueDate: dto.dueDate === undefined ? undefined : new Date(dto.dueDate),
    });

    return TaskResponseDto.from(task);
  }

  async remove(projectId: string, taskId: string): Promise<void> {
    await this.requireIn(projectId, taskId);
    await this.tasks.delete(taskId);
  }

  async move(projectId: string, taskId: string, dto: MoveTaskDto): Promise<TaskResponseDto> {
    await this.requireIn(projectId, taskId);
    await this.requireColumnIn(projectId, dto.columnId);

    return TaskResponseDto.from(await this.tasks.move(taskId, dto.columnId, dto.position));
  }

  private async requireIn(projectId: string, taskId: string): Promise<TaskWithColumn> {
    const task = await this.tasks.findById(taskId);

    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Tarefa não encontrada neste projeto.');
    }

    return task;
  }

  private async requireColumnIn(projectId: string, columnId: string): Promise<void> {
    const column = await this.columns.findById(columnId);

    if (!column || column.projectId !== projectId) {
      throw new NotFoundException('Coluna não encontrada neste projeto.');
    }
  }

  private async requireAssigneeInProject(
    projectId: string,
    assigneeId: string | undefined,
  ): Promise<void> {
    if (!assigneeId) {
      return;
    }

    const membership = await this.projects.findMembership(projectId, assigneeId);

    if (!membership) {
      throw new BadRequestException('O responsável precisa participar do projeto.');
    }
  }
}
