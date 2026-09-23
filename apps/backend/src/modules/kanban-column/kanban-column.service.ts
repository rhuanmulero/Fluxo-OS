import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { KanbanColumn } from '@prisma/client';
import { ColumnResponseDto } from './dto/column-response.dto';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import {
  KANBAN_COLUMN_REPOSITORY,
  KanbanColumnRepository,
} from './kanban-column.repository.interface';

@Injectable()
export class KanbanColumnService {
  constructor(
    @Inject(KANBAN_COLUMN_REPOSITORY) private readonly columns: KanbanColumnRepository,
  ) {}

  async list(projectId: string): Promise<ColumnResponseDto[]> {
    const columns = await this.columns.listByProject(projectId);

    return columns.map(ColumnResponseDto.from);
  }

  async create(projectId: string, dto: CreateColumnDto): Promise<ColumnResponseDto> {
    const position = await this.columns.nextPosition(projectId);
    const column = await this.columns.create({ projectId, position, ...dto });

    return ColumnResponseDto.from(column);
  }

  async update(
    projectId: string,
    columnId: string,
    dto: UpdateColumnDto,
  ): Promise<ColumnResponseDto> {
    await this.requireIn(projectId, columnId);

    return ColumnResponseDto.from(await this.columns.update(columnId, dto));
  }

  async remove(projectId: string, columnId: string): Promise<void> {
    await this.requireIn(projectId, columnId);

    const tasks = await this.columns.countTasks(columnId);

    if (tasks > 0) {
      throw new BadRequestException('Mova as tarefas para outra coluna antes de excluir esta.');
    }

    await this.columns.delete(columnId);
  }

  async reorder(projectId: string, dto: ReorderColumnsDto): Promise<ColumnResponseDto[]> {
    const current = await this.columns.listByProject(projectId);
    const currentIds = new Set(current.map((column) => column.id));
    const requested = new Set(dto.orderedIds);

    if (currentIds.size !== requested.size || [...requested].some((id) => !currentIds.has(id))) {
      throw new BadRequestException('A ordenação deve conter exatamente as colunas do projeto.');
    }

    const reordered = await this.columns.reorder(projectId, dto.orderedIds);

    return reordered.map(ColumnResponseDto.from);
  }

  private async requireIn(projectId: string, columnId: string): Promise<KanbanColumn> {
    const column = await this.columns.findById(columnId);

    if (!column || column.projectId !== projectId) {
      throw new NotFoundException('Coluna não encontrada neste projeto.');
    }

    return column;
  }
}
