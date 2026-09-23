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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { PermissionGuard } from '../../common/authorization/permission.guard';
import { RequireWorkspaceRole } from '../../common/authorization/require-workspace-role.decorator';
import { CreateHabitDto } from './dto/create-habit.dto';
import { HabitLogResponseDto } from './dto/habit-log-response.dto';
import { HabitResponseDto } from './dto/habit-response.dto';
import { MarkHabitDto } from './dto/mark-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { HabitService } from './habit.service';

@Controller('workspaces/:workspaceId/habits')
@UseGuards(AuthGuard, PermissionGuard)
@RequireWorkspaceRole('MEMBER')
export class HabitController {
  constructor(private readonly habits: HabitService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<HabitResponseDto[]> {
    return this.habits.list(workspaceId, user.id, includeArchived === 'true');
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateHabitDto,
  ): Promise<HabitResponseDto> {
    return this.habits.create(workspaceId, user.id, dto);
  }

  @Get(':habitId/logs')
  logs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('habitId') habitId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<HabitLogResponseDto[]> {
    return this.habits.logs(workspaceId, user.id, habitId, from, to);
  }

  @Put(':habitId/logs/:date')
  mark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('habitId') habitId: string,
    @Param('date') date: string,
    @Body() dto: MarkHabitDto,
  ): Promise<HabitLogResponseDto> {
    return this.habits.mark(workspaceId, user.id, habitId, date, dto);
  }

  @Delete(':habitId/logs/:date')
  @HttpCode(HttpStatus.NO_CONTENT)
  unmark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('habitId') habitId: string,
    @Param('date') date: string,
  ): Promise<void> {
    return this.habits.unmark(workspaceId, user.id, habitId, date);
  }

  @Patch(':habitId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('habitId') habitId: string,
    @Body() dto: UpdateHabitDto,
  ): Promise<HabitResponseDto> {
    return this.habits.update(workspaceId, user.id, habitId, dto);
  }

  @Delete(':habitId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('habitId') habitId: string,
  ): Promise<void> {
    return this.habits.remove(workspaceId, user.id, habitId);
  }
}
