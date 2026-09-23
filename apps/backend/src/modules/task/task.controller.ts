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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Action } from '../../common/authorization/action';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { ModulePermissionGuard } from '../../common/authorization/module-permission.guard';
import { ProjectModule } from '../../common/authorization/project-module';
import { RequirePermission } from '../../common/authorization/require-permission.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

@Controller('projects/:projectId/tasks')
@UseGuards(AuthGuard, ModulePermissionGuard)
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  @Get()
  @RequirePermission(ProjectModule.TASKS, Action.READ)
  list(
    @Param('projectId') projectId: string,
    @Query() filter: TaskFilterDto,
  ): Promise<TaskResponseDto[]> {
    return this.tasks.list(projectId, filter);
  }

  @Post()
  @RequirePermission(ProjectModule.TASKS, Action.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasks.create(projectId, user.id, dto);
  }

  @Get(':taskId')
  @RequirePermission(ProjectModule.TASKS, Action.READ)
  find(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ): Promise<TaskResponseDto> {
    return this.tasks.find(projectId, taskId);
  }

  @Patch(':taskId/move')
  @RequirePermission(ProjectModule.TASKS, Action.UPDATE)
  move(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasks.move(projectId, taskId, dto);
  }

  @Patch(':taskId')
  @RequirePermission(ProjectModule.TASKS, Action.UPDATE)
  update(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasks.update(projectId, taskId, dto);
  }

  @Delete(':taskId')
  @RequirePermission(ProjectModule.TASKS, Action.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    return this.tasks.remove(projectId, taskId);
  }
}
