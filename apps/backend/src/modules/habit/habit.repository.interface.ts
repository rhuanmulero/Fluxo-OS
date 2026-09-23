import { Habit, HabitFrequency, HabitLog } from '@prisma/client';

export const HABIT_REPOSITORY = Symbol('HabitRepository');

export interface NewHabit {
  workspaceId: string;
  userId: string;
  projectId?: string;
  name: string;
  frequency: HabitFrequency;
  targetPerPeriod: number;
  color?: string;
}

export interface HabitChanges {
  name?: string;
  frequency?: HabitFrequency;
  targetPerPeriod?: number;
  color?: string;
  projectId?: string | null;
  archivedAt?: Date | null;
}

export interface HabitRepository {
  findManyFor(workspaceId: string, userId: string, includeArchived: boolean): Promise<Habit[]>;
  findById(id: string): Promise<Habit | null>;
  create(data: NewHabit): Promise<Habit>;
  update(id: string, changes: HabitChanges): Promise<Habit>;
  delete(id: string): Promise<void>;
  findLogs(habitId: string, from: Date, to: Date): Promise<HabitLog[]>;
  findLogsOfDay(habitIds: string[], date: Date): Promise<HabitLog[]>;
  upsertLog(habitId: string, date: Date, value: number, note?: string): Promise<HabitLog>;
  deleteLog(habitId: string, date: Date): Promise<void>;
}
