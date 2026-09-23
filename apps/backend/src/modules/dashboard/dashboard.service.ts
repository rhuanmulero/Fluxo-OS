import { Inject, Injectable } from '@nestjs/common';
import { TaskResponseDto } from '../task/dto/task-response.dto';
import { PomodoroService } from '../pomodoro/pomodoro.service';
import { EventService } from '../event/event.service';
import { HabitService } from '../habit/habit.service';
import { DASHBOARD_REPOSITORY, DashboardRepository } from './dashboard.repository.interface';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';
import {
  DashboardResponseDto,
  PendingHabitDto,
  ProjectMetrics,
  UpcomingEventDto,
} from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DASHBOARD_REPOSITORY) private readonly dashboard: DashboardRepository,
    private readonly pomodoro: PomodoroService,
    private readonly events: EventService,
    private readonly habits: HabitService,
  ) {}

  async of(
    workspaceId: string,
    userId: string,
    filter: DashboardFilterDto,
  ): Promise<DashboardResponseDto> {
    const allProjectIds = await this.dashboard.projectIdsOf(workspaceId);
    const projectIds = filter.projectId
      ? allProjectIds.filter((id) => id === filter.projectId)
      : allProjectIds;

    const [start, end] = this.today();

    const [dueToday, counts, columns] = await Promise.all([
      this.dashboard.tasksDueBetween(projectIds, start, end),
      this.dashboard.countsByColumn(projectIds),
      this.dashboard.columnsOf(projectIds),
    ]);

    const doneColumnIds = columns
      .filter((column) => column.status === 'DONE')
      .map((column) => column.id);

    const [overdue, pomodoro] = await Promise.all([
      this.dashboard.overdueCount(projectIds, start, doneColumnIds),
      this.pomodoro.summaryOf(userId),
    ]);

    const done = new Set(doneColumnIds);
    const byProject = new Map<string, ProjectMetrics>();
    let completed = 0;
    let pending = 0;

    for (const row of counts) {
      const isDone = done.has(row.kanbanColumnId);
      const bucket = byProject.get(row.projectId) ?? {
        projectId: row.projectId,
        completed: 0,
        pending: 0,
      };

      if (isDone) {
        bucket.completed += row.count;
        completed += row.count;
      } else {
        bucket.pending += row.count;
        pending += row.count;
      }

      byProject.set(row.projectId, bucket);
    }

    const windowEnd = this.inDays(7);

    const [upcoming, allHabits] = await Promise.all([
      this.events.list(workspaceId, userId, {
        from: start.toISOString(),
        to: windowEnd.toISOString(),
      }),
      this.habits.list(workspaceId, userId, false),
    ]);

    const upcomingEvents = upcoming
      .filter((event) => event.startsAt >= start && event.startsAt <= windowEnd)
      .map(
        (event) =>
          new UpcomingEventDto(event.id, event.title, event.startsAt, event.allDay, event.projectId),
      );

    const pendingHabits = allHabits
      .filter((habit) => !habit.doneToday)
      .map((habit) => new PendingHabitDto(habit.id, habit.name, habit.targetPerPeriod));

    return new DashboardResponseDto(
      dueToday.map(TaskResponseDto.from),
      { completed, pending, overdue },
      { focusMinutes: pomodoro.focusMinutes, completedCycles: pomodoro.completedCycles },
      [...byProject.values()],
      upcomingEvents,
      pendingHabits,
    );
  }

  private today(): [Date, Date] {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    return [start, end];
  }

  private inDays(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);

    return date;
  }
}
