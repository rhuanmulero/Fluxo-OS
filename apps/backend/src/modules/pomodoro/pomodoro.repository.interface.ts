import { PomodoroMode, PomodoroSession } from '@prisma/client';

export const POMODORO_REPOSITORY = Symbol('PomodoroRepository');

export interface NewSession {
  userId: string;
  projectId?: string;
  taskId?: string;
  mode: PomodoroMode;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
}

export interface SessionQuery {
  userId: string;
  from?: Date;
  to?: Date;
  taskId?: string;
}

export interface PomodoroRepository {
  create(data: NewSession): Promise<PomodoroSession>;
  findMany(query: SessionQuery): Promise<PomodoroSession[]>;
}
