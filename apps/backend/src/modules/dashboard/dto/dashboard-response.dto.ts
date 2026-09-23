import { TaskResponseDto } from '../../task/dto/task-response.dto';

export interface TaskMetrics {
  completed: number;
  pending: number;
  overdue: number;
}

export interface PomodoroMetrics {
  focusMinutes: number;
  completedCycles: number;
}

export interface ProjectMetrics {
  projectId: string;
  completed: number;
  pending: number;
}

export class UpcomingEventDto {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly startsAt: Date,
    readonly allDay: boolean,
    readonly projectId: string | null,
  ) {}
}

export class PendingHabitDto {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly targetPerPeriod: number,
  ) {}
}

export class DashboardResponseDto {
  constructor(
    readonly todayTasks: TaskResponseDto[],
    readonly metrics: TaskMetrics,
    readonly pomodoro: PomodoroMetrics,
    readonly byProject: ProjectMetrics[],
    readonly upcomingEvents: UpcomingEventDto[],
    readonly pendingHabits: PendingHabitDto[],
  ) {}
}
