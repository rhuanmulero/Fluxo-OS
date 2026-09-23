import { TaskWithColumn } from '../task/task.repository.interface';
import { PomodoroService } from '../pomodoro/pomodoro.service';
import { EventService } from '../event/event.service';
import { HabitService } from '../habit/habit.service';
import { DashboardService } from './dashboard.service';
import {
  ColumnCount,
  ColumnStatus,
  DashboardRepository,
} from './dashboard.repository.interface';

const columns: ColumnStatus[] = [
  { id: 'c-todo', status: 'TODO' },
  { id: 'c-doing', status: 'IN_PROGRESS' },
  { id: 'c-done', status: 'DONE' },
];

function taskIn(columnId: string, status: string): TaskWithColumn {
  return {
    id: `t-${columnId}`,
    projectId: 'p1',
    kanbanColumnId: columnId,
    title: 'Tarefa',
    shortDescription: null,
    description: null,
    priority: 'HIGH',
    type: 'FEATURE',
    tags: [],
    folder: null,
    assigneeId: 'u1',
    dueDate: new Date(),
    estimatedHours: null,
    recurrence: 'NONE',
    isPinned: false,
    position: 0,
    createdById: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    kanbanColumn: { id: columnId, name: 'Coluna', status },
  } as unknown as TaskWithColumn;
}

function repositoryWith(counts: ColumnCount[], due: TaskWithColumn[]): DashboardRepository {
  return {
    projectIdsOf: () => Promise.resolve(['p1']),
    tasksDueBetween: () => Promise.resolve(due),
    countsByColumn: () => Promise.resolve(counts),
    columnsOf: () => Promise.resolve(columns),
    overdueCount: () => Promise.resolve(2),
    assignedDoneCount: () => Promise.resolve(0),
    allDoneColumnIds: () => Promise.resolve(['c-done']),
    activeDaysOf: () => Promise.resolve(0),
  };
}

function pomodoroReturning(focusMinutes: number, completedCycles: number): PomodoroService {
  return {
    summaryOf: () =>
      Promise.resolve({ focusMinutes, breakMinutes: 0, completedCycles, byTask: {} }),
  } as unknown as PomodoroService;
}

function asEventService(stub: { list: jest.Mock }): EventService {
  return stub as unknown as EventService;
}

function asHabitService(stub: { list: jest.Mock }): HabitService {
  return stub as unknown as HabitService;
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date;
}

describe('DashboardService', () => {
  let events: { list: jest.Mock };
  let habits: { list: jest.Mock };

  beforeEach(() => {
    events = { list: jest.fn().mockResolvedValue([]) };
    habits = { list: jest.fn().mockResolvedValue([]) };
  });

  it('separa concluídas de pendentes usando o status da coluna', async () => {
    const service = new DashboardService(
      repositoryWith(
        [
          { projectId: 'p1', kanbanColumnId: 'c-todo', count: 4 },
          { projectId: 'p1', kanbanColumnId: 'c-doing', count: 3 },
          { projectId: 'p1', kanbanColumnId: 'c-done', count: 5 },
        ],
        [],
      ),
      pomodoroReturning(50, 2),
      asEventService(events),
      asHabitService(habits),
    );

    const dashboard = await service.of('w1', 'u1', {});

    expect(dashboard.metrics.completed).toBe(5);
    expect(dashboard.metrics.pending).toBe(7);
    expect(dashboard.metrics.overdue).toBe(2);
  });

  it('lista as tarefas do dia', async () => {
    const service = new DashboardService(
      repositoryWith([], [taskIn('c-todo', 'TODO'), taskIn('c-doing', 'IN_PROGRESS')]),
      pomodoroReturning(0, 0),
      asEventService(events),
      asHabitService(habits),
    );

    const dashboard = await service.of('w1', 'u1', {});

    expect(dashboard.todayTasks).toHaveLength(2);
    expect(dashboard.todayTasks[0]?.status).toBe('TODO');
  });

  it('inclui o resumo de pomodoro do usuário', async () => {
    const service = new DashboardService(
      repositoryWith([], []),
      pomodoroReturning(75, 3),
      asEventService(events),
      asHabitService(habits),
    );

    const dashboard = await service.of('w1', 'u1', {});

    expect(dashboard.pomodoro.focusMinutes).toBe(75);
    expect(dashboard.pomodoro.completedCycles).toBe(3);
  });

  it('quebra as métricas por projeto', async () => {
    const service = new DashboardService(
      repositoryWith(
        [
          { projectId: 'p1', kanbanColumnId: 'c-done', count: 2 },
          { projectId: 'p1', kanbanColumnId: 'c-todo', count: 1 },
        ],
        [],
      ),
      pomodoroReturning(0, 0),
      asEventService(events),
      asHabitService(habits),
    );

    const dashboard = await service.of('w1', 'u1', {});

    expect(dashboard.byProject).toEqual([{ projectId: 'p1', completed: 2, pending: 1 }]);
  });

  it('devolve zeros quando o workspace não tem tarefa', async () => {
    const service = new DashboardService(
      repositoryWith([], []),
      pomodoroReturning(0, 0),
      asEventService(events),
      asHabitService(habits),
    );

    const dashboard = await service.of('w1', 'u1', {});

    expect(dashboard.metrics.completed).toBe(0);
    expect(dashboard.metrics.pending).toBe(0);
    expect(dashboard.todayTasks).toEqual([]);
  });

  it('traz apenas eventos dos próximos sete dias', async () => {
    events.list.mockResolvedValue([
      { id: 'e1', title: 'Hoje', startsAt: daysFromNow(0), allDay: false, projectId: null },
      { id: 'e2', title: 'Em 3 dias', startsAt: daysFromNow(3), allDay: false, projectId: null },
      { id: 'e3', title: 'Em 20 dias', startsAt: daysFromNow(20), allDay: false, projectId: null },
    ]);

    const service = new DashboardService(
      repositoryWith([], []),
      pomodoroReturning(0, 0),
      asEventService(events),
      asHabitService(habits),
    );

    const dashboard = await service.of('w1', 'u1', {});

    expect(dashboard.upcomingEvents.map((event) => event.id)).toEqual(['e1', 'e2']);
  });

  it('lista como pendente apenas o hábito sem log de hoje', async () => {
    habits.list.mockResolvedValue([
      { id: 'h1', name: 'Ler', targetPerPeriod: 1, doneToday: false },
      { id: 'h2', name: 'Correr', targetPerPeriod: 1, doneToday: true },
    ]);

    const service = new DashboardService(
      repositoryWith([], []),
      pomodoroReturning(0, 0),
      asEventService(events),
      asHabitService(habits),
    );

    const dashboard = await service.of('w1', 'u1', {});

    expect(dashboard.pendingHabits.map((habit) => habit.id)).toEqual(['h1']);
  });

  it('não quebra quando não há eventos nem hábitos', async () => {
    events.list.mockResolvedValue([]);
    habits.list.mockResolvedValue([]);

    const service = new DashboardService(
      repositoryWith([], []),
      pomodoroReturning(0, 0),
      asEventService(events),
      asHabitService(habits),
    );

    const dashboard = await service.of('w1', 'u1', {});

    expect(dashboard.upcomingEvents).toEqual([]);
    expect(dashboard.pendingHabits).toEqual([]);
  });
});
