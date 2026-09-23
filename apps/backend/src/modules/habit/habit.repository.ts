import { Injectable } from '@nestjs/common';
import { Habit, HabitLog } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import {
  HabitChanges,
  HabitRepository,
  NewHabit,
} from './habit.repository.interface';

@Injectable()
export class PrismaHabitRepository implements HabitRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyFor(workspaceId: string, userId: string, includeArchived: boolean): Promise<Habit[]> {
    return this.prisma.habit.findMany({
      where: {
        workspaceId,
        userId,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<Habit | null> {
    return this.prisma.habit.findUnique({ where: { id } });
  }

  create(data: NewHabit): Promise<Habit> {
    return this.prisma.habit.create({ data });
  }

  update(id: string, changes: HabitChanges): Promise<Habit> {
    return this.prisma.habit.update({ where: { id }, data: changes });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.habit.delete({ where: { id } });
  }

  findLogs(habitId: string, from: Date, to: Date): Promise<HabitLog[]> {
    return this.prisma.habitLog.findMany({
      where: { habitId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
  }

  findLogsOfDay(habitIds: string[], date: Date): Promise<HabitLog[]> {
    return this.prisma.habitLog.findMany({
      where: { habitId: { in: habitIds }, date },
    });
  }

  upsertLog(habitId: string, date: Date, value: number, note?: string): Promise<HabitLog> {
    return this.prisma.habitLog.upsert({
      where: { habitId_date: { habitId, date } },
      create: { habitId, date, value, note },
      update: { value, note },
    });
  }

  async deleteLog(habitId: string, date: Date): Promise<void> {
    await this.prisma.habitLog.deleteMany({ where: { habitId, date } });
  }
}
