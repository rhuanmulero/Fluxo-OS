import { Inject, Injectable } from '@nestjs/common';
import {
  DASHBOARD_REPOSITORY,
  DashboardRepository,
} from '../dashboard/dashboard.repository.interface';
import { PomodoroService } from '../pomodoro/pomodoro.service';

export interface UserStats {
  completedTasks: number;
  pomodoroCycles: number;
  focusMinutes: number;
  activeDays: number;
}

@Injectable()
export class UserStatsService {
  constructor(
    @Inject(DASHBOARD_REPOSITORY) private readonly dashboard: DashboardRepository,
    private readonly pomodoro: PomodoroService,
  ) {}

  async of(userId: string): Promise<UserStats> {
    const doneColumnIds = await this.dashboard.allDoneColumnIds();

    const [completedTasks, activeDays, summary] = await Promise.all([
      this.dashboard.assignedDoneCount(userId, doneColumnIds),
      this.dashboard.activeDaysOf(userId),
      this.pomodoro.summaryOf(userId),
    ]);

    return {
      completedTasks,
      pomodoroCycles: summary.completedCycles,
      focusMinutes: summary.focusMinutes,
      activeDays,
    };
  }
}
