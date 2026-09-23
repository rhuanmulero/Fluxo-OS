import { PomodoroMode, PomodoroSession } from '@prisma/client';

export class SessionResponseDto {
  constructor(
    readonly id: string,
    readonly mode: PomodoroMode,
    readonly startedAt: Date,
    readonly endedAt: Date,
    readonly durationMinutes: number,
    readonly projectId: string | null,
    readonly taskId: string | null,
  ) {}

  static from(session: PomodoroSession): SessionResponseDto {
    return new SessionResponseDto(
      session.id,
      session.mode,
      session.startedAt,
      session.endedAt,
      session.durationMinutes,
      session.projectId,
      session.taskId,
    );
  }
}

export interface PomodoroSummary {
  focusMinutes: number;
  breakMinutes: number;
  completedCycles: number;
  byTask: Record<string, number>;
}
