import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KanbanColumn, ProjectMember } from '@prisma/client';
import { TaskService } from './task.service';
import {
  NewTask,
  TaskChanges,
  TaskFilter,
  TaskRepository,
  TaskWithColumn,
} from './task.repository.interface';
import { KanbanColumnRepository } from '../kanban-column/kanban-column.repository.interface';
import { ProjectRepository } from '../project/project.repository.interface';

const column: KanbanColumn = {
  id: 'c1',
  projectId: 'p1',
  name: 'A Fazer',
  position: 0,
  color: null,
  status: 'TODO',
  createdAt: new Date(),
  updatedAt: new Date(),
};

class FakeTaskRepository implements TaskRepository {
  tasks: TaskWithColumn[] = [];
  moved: [string, string, number] | null = null;

  findManyByProject(projectId: string, _filter: TaskFilter): Promise<TaskWithColumn[]> {
    return Promise.resolve(this.tasks.filter((t) => t.projectId === projectId));
  }

  findById(id: string): Promise<TaskWithColumn | null> {
    return Promise.resolve(this.tasks.find((t) => t.id === id) ?? null);
  }

  create(data: NewTask): Promise<TaskWithColumn> {
    const task = {
      id: `t${this.tasks.length + 1}`,
      shortDescription: null,
      description: null,
      folder: null,
      assigneeId: null,
      dueDate: null,
      estimatedHours: null,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      kanbanColumn: { id: column.id, name: column.name, status: column.status },
    } as unknown as TaskWithColumn;
    this.tasks.push(task);
    return Promise.resolve(task);
  }

  update(id: string, changes: TaskChanges): Promise<TaskWithColumn> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new Error('não encontrada');
    Object.assign(task, changes);
    return Promise.resolve(task);
  }

  delete(id: string): Promise<void> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    return Promise.resolve();
  }

  move(id: string, columnId: string, position: number): Promise<TaskWithColumn> {
    this.moved = [id, columnId, position];
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new Error('não encontrada');
    return Promise.resolve(task);
  }

  nextPosition(): Promise<number> {
    return Promise.resolve(this.tasks.length);
  }
}

function columnsWith(found: KanbanColumn | null): KanbanColumnRepository {
  return { findById: () => Promise.resolve(found) } as unknown as KanbanColumnRepository;
}

function projectsWith(member: ProjectMember | null): ProjectRepository {
  return { findMembership: () => Promise.resolve(member) } as unknown as ProjectRepository;
}

const membership: ProjectMember = {
  id: 'pm1',
  projectId: 'p1',
  userId: 'u2',
  addedAt: new Date(),
};

const validTask = {
  title: 'Escrever a spec',
  priority: 'HIGH' as const,
  type: 'FEATURE' as const,
  kanbanColumnId: 'c1',
};

describe('TaskService', () => {
  it('cria a tarefa na coluna informada', async () => {
    const tasks = new FakeTaskRepository();
    const service = new TaskService(tasks, columnsWith(column), projectsWith(null));

    const task = await service.create('p1', 'u1', validTask);

    expect(task.columnId).toBe('c1');
    expect(task.status).toBe('TODO');
  });

  it('recusa coluna de outro projeto', async () => {
    const service = new TaskService(
      new FakeTaskRepository(),
      columnsWith({ ...column, projectId: 'p2' }),
      projectsWith(null),
    );

    await expect(service.create('p1', 'u1', validTask)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('recusa responsável que não participa do projeto', async () => {
    const service = new TaskService(
      new FakeTaskRepository(),
      columnsWith(column),
      projectsWith(null),
    );

    await expect(
      service.create('p1', 'u1', { ...validTask, assigneeId: 'u2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aceita responsável que participa do projeto', async () => {
    const service = new TaskService(
      new FakeTaskRepository(),
      columnsWith(column),
      projectsWith(membership),
    );

    const task = await service.create('p1', 'u1', { ...validTask, assigneeId: 'u2' });

    expect(task.assigneeId).toBe('u2');
  });

  it('move a tarefa para outra coluna', async () => {
    const tasks = new FakeTaskRepository();
    const service = new TaskService(tasks, columnsWith(column), projectsWith(null));
    const created = await service.create('p1', 'u1', validTask);

    await service.move('p1', created.id, { columnId: 'c1', position: 2 });

    expect(tasks.moved).toEqual([created.id, 'c1', 2]);
  });

  it('recusa mexer em tarefa de outro projeto', async () => {
    const tasks = new FakeTaskRepository();
    const service = new TaskService(tasks, columnsWith(column), projectsWith(null));
    const created = await service.create('p1', 'u1', validTask);

    await expect(service.find('p2', created.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
