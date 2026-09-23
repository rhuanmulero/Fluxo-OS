import { PomodoroService } from '../pomodoro/pomodoro.service';
import { DashboardRepository } from '../dashboard/dashboard.repository.interface';
import { UserStatsService } from './user-stats.service';

function repositoryWith(done: number, activeDays: number): DashboardRepository {
  return {
    allDoneColumnIds: () => Promise.resolve(['c-done']),
    assignedDoneCount: () => Promise.resolve(done),
    activeDaysOf: () => Promise.resolve(activeDays),
  } as unknown as DashboardRepository;
}

function pomodoroReturning(focusMinutes: number, completedCycles: number): PomodoroService {
  return {
    summaryOf: () =>
      Promise.resolve({ focusMinutes, breakMinutes: 0, completedCycles, byTask: {} }),
  } as unknown as PomodoroService;
}

describe('UserStatsService', () => {
  it('reúne as métricas reais do usuário', async () => {
    const service = new UserStatsService(repositoryWith(12, 5), pomodoroReturning(300, 12));

    const stats = await service.of('u1');

    expect(stats).toEqual({
      completedTasks: 12,
      pomodoroCycles: 12,
      focusMinutes: 300,
      activeDays: 5,
    });
  });

  it('devolve zeros para um usuário novo', async () => {
    const service = new UserStatsService(repositoryWith(0, 0), pomodoroReturning(0, 0));

    const stats = await service.of('u1');

    expect(stats).toEqual({
      completedTasks: 0,
      pomodoroCycles: 0,
      focusMinutes: 0,
      activeDays: 0,
    });
  });
});
