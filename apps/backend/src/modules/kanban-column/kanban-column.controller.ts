import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Action } from '../../common/authorization/action';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { ModulePermissionGuard } from '../../common/authorization/module-permission.guard';
import { ProjectModule } from '../../common/authorization/project-module';
import { RequirePermission } from '../../common/authorization/require-permission.decorator';
import { ColumnResponseDto } from './dto/column-response.dto';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { KanbanColumnService } from './kanban-column.service';

@Controller('projects/:projectId/columns')
@UseGuards(AuthGuard, ModulePermissionGuard)
export class KanbanColumnController {
  constructor(private readonly columns: KanbanColumnService) {}

  @Get()
  @RequirePermission(ProjectModule.KANBAN, Action.READ)
  list(@Param('projectId') projectId: string): Promise<ColumnResponseDto[]> {
    return this.columns.list(projectId);
  }

  @Post()
  @RequirePermission(ProjectModule.KANBAN, Action.CREATE)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateColumnDto,
  ): Promise<ColumnResponseDto> {
    return this.columns.create(projectId, dto);
  }

  @Patch('order')
  @RequirePermission(ProjectModule.KANBAN, Action.UPDATE)
  reorder(
    @Param('projectId') projectId: string,
    @Body() dto: ReorderColumnsDto,
  ): Promise<ColumnResponseDto[]> {
    return this.columns.reorder(projectId, dto);
  }

  @Patch(':columnId')
  @RequirePermission(ProjectModule.KANBAN, Action.UPDATE)
  update(
    @Param('projectId') projectId: string,
    @Param('columnId') columnId: string,
    @Body() dto: UpdateColumnDto,
  ): Promise<ColumnResponseDto> {
    return this.columns.update(projectId, columnId, dto);
  }

  @Delete(':columnId')
  @RequirePermission(ProjectModule.KANBAN, Action.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('columnId') columnId: string,
  ): Promise<void> {
    return this.columns.remove(projectId, columnId);
  }
}
