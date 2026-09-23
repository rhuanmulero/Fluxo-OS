import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KanbanColumn } from '@prisma/client';
import { KanbanColumnService } from './kanban-column.service';
import {
  ColumnChanges,
  KanbanColumnRepository,
  NewColumn,
} from './kanban-column.repository.interface';

class FakeColumnRepository implements KanbanColumnRepository {
  columns: KanbanColumn[] = [];
  taskCounts = new Map<string, number>();

  listByProject(projectId: string): Promise<KanbanColumn[]> {
    return Promise.resolve(
      this.columns
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => a.position - b.position),
    );
  }

  findById(id: string): Promise<KanbanColumn | null> {
    return Promise.resolve(this.columns.find((c) => c.id === id) ?? null);
  }

  create(data: NewColumn): Promise<KanbanColumn> {
    const column: KanbanColumn = {
      id: `c${this.columns.length + 1}`,
      projectId: data.projectId,
      name: data.name,
      position: data.position,
      color: data.color ?? null,
      status: data.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.columns.push(column);
    return Promise.resolve(column);
  }

  update(id: string, changes: ColumnChanges): Promise<KanbanColumn> {
    const column = this.columns.find((c) => c.id === id);
    if (!column) throw new Error('não encontrada');
    Object.assign(column, changes);
    return Promise.resolve(column);
  }

  delete(id: string): Promise<void> {
    this.columns = this.columns.filter((c) => c.id !== id);
    return Promise.resolve();
  }

  reorder(projectId: string, orderedIds: string[]): Promise<KanbanColumn[]> {
    orderedIds.forEach((id, position) => {
      const column = this.columns.find((c) => c.id === id);
      if (column) column.position = position;
    });
    return this.listByProject(projectId);
  }

  countTasks(columnId: string): Promise<number> {
    return Promise.resolve(this.taskCounts.get(columnId) ?? 0);
  }

  nextPosition(projectId: string): Promise<number> {
    return Promise.resolve(this.columns.filter((c) => c.projectId === projectId).length);
  }
}

describe('KanbanColumnService', () => {
  let repository: FakeColumnRepository;
  let service: KanbanColumnService;

  beforeEach(() => {
    repository = new FakeColumnRepository();
    service = new KanbanColumnService(repository);
  });

  it('acrescenta a coluna no fim do quadro', async () => {
    await service.create('p1', { name: 'A Fazer', status: 'TODO' });
    const segunda = await service.create('p1', { name: 'Revisão', status: 'IN_PROGRESS' });

    expect(segunda.position).toBe(1);
  });

  it('recusa excluir coluna que ainda tem tarefas', async () => {
    const column = await service.create('p1', { name: 'A Fazer', status: 'TODO' });
    repository.taskCounts.set(column.id, 3);

    await expect(service.remove('p1', column.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exclui coluna vazia', async () => {
    const column = await service.create('p1', { name: 'A Fazer', status: 'TODO' });

    await service.remove('p1', column.id);

    await expect(service.list('p1')).resolves.toHaveLength(0);
  });

  it('recusa coluna de outro projeto', async () => {
    const column = await service.create('p1', { name: 'A Fazer', status: 'TODO' });

    await expect(service.remove('p2', column.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reordena as colunas', async () => {
    const a = await service.create('p1', { name: 'A', status: 'TODO' });
    const b = await service.create('p1', { name: 'B', status: 'IN_PROGRESS' });

    const ordered = await service.reorder('p1', { orderedIds: [b.id, a.id] });

    expect(ordered.map((c) => c.id)).toEqual([b.id, a.id]);
  });

  it('recusa reordenação que não contenha exatamente as colunas do projeto', async () => {
    const a = await service.create('p1', { name: 'A', status: 'TODO' });
    await service.create('p1', { name: 'B', status: 'IN_PROGRESS' });

    await expect(service.reorder('p1', { orderedIds: [a.id] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
