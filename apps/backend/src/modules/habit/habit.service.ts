import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Habit } from '@prisma/client';
import { CreateHabitDto } from './dto/create-habit.dto';
import { HabitLogResponseDto } from './dto/habit-log-response.dto';
import { HabitResponseDto } from './dto/habit-response.dto';
import { MarkHabitDto } from './dto/mark-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { HABIT_REPOSITORY, HabitRepository } from './habit.repository.interface';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class HabitService {
  constructor(@Inject(HABIT_REPOSITORY) private readonly habits: HabitRepository) {}

  async list(
    workspaceId: string,
    userId: string,
    includeArchived: boolean,
  ): Promise<HabitResponseDto[]> {
    const habits = await this.habits.findManyFor(workspaceId, userId, includeArchived);
    const today = this.dayOf(this.todayIso());
    const logs = await this.habits.findLogsOfDay(
      habits.map((habit) => habit.id),
      today,
    );
    const done = new Set(logs.map((log) => log.habitId));

    return habits.map((habit) => HabitResponseDto.from(habit, done.has(habit.id)));
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateHabitDto,
  ): Promise<HabitResponseDto> {
    const habit = await this.habits.create({
      workspaceId,
      userId,
      projectId: dto.projectId,
      name: dto.name,
      frequency: dto.frequency ?? 'DAILY',
      targetPerPeriod: dto.targetPerPeriod ?? 1,
      color: dto.color,
    });

    return HabitResponseDto.from(habit, false);
  }

  async update(
    workspaceId: string,
    userId: string,
    habitId: string,
    dto: UpdateHabitDto,
  ): Promise<HabitResponseDto> {
    await this.require(workspaceId, userId, habitId);

    const archivedAt =
      dto.archived === undefined ? undefined : dto.archived ? new Date() : null;

    const habit = await this.habits.update(habitId, {
      name: dto.name,
      frequency: dto.frequency,
      targetPerPeriod: dto.targetPerPeriod,
      color: dto.color,
      projectId: dto.projectId,
      archivedAt,
    });

    return HabitResponseDto.from(habit, false);
  }

  async remove(workspaceId: string, userId: string, habitId: string): Promise<void> {
    await this.require(workspaceId, userId, habitId);
    await this.habits.delete(habitId);
  }

  async logs(
    workspaceId: string,
    userId: string,
    habitId: string,
    from: string,
    to: string,
  ): Promise<HabitLogResponseDto[]> {
    await this.require(workspaceId, userId, habitId);

    const found = await this.habits.findLogs(habitId, this.dayOf(from), this.dayOf(to));

    return found.map(HabitLogResponseDto.from);
  }

  async mark(
    workspaceId: string,
    userId: string,
    habitId: string,
    date: string,
    dto: MarkHabitDto,
  ): Promise<HabitLogResponseDto> {
    await this.require(workspaceId, userId, habitId);

    const log = await this.habits.upsertLog(
      habitId,
      this.dayOf(date),
      dto.value ?? 1,
      dto.note,
    );

    return HabitLogResponseDto.from(log);
  }

  async unmark(
    workspaceId: string,
    userId: string,
    habitId: string,
    date: string,
  ): Promise<void> {
    await this.require(workspaceId, userId, habitId);
    await this.habits.deleteLog(habitId, this.dayOf(date));
  }

  private dayOf(date: string): Date {
    if (!ISO_DATE.test(date)) {
      throw new BadRequestException('Data deve estar no formato AAAA-MM-DD.');
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('Data inválida.');
    }

    return parsed;
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async require(
    workspaceId: string,
    userId: string,
    habitId: string,
  ): Promise<Habit> {
    const habit = await this.habits.findById(habitId);

    if (!habit || habit.workspaceId !== workspaceId || habit.userId !== userId) {
      throw new NotFoundException('Hábito não encontrado.');
    }

    return habit;
  }
}
