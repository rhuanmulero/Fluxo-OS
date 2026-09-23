import { BadRequestException } from '@nestjs/common';
import { PomodoroSession } from '@prisma/client';
import { PomodoroService } from './pomodoro.service';
import { NewSession, PomodoroRepository, SessionQuery } from './pomodoro.repository.interface';

class FakePomodoroRepository implements PomodoroRepository {
  sessions: PomodoroSession[] = [];

  create(data: NewSession): Promise<PomodoroSession> {
    const session: PomodoroSession = {
      id: `s${this.sessions.length + 1}`,
      userId: data.userId,
      projectId: data.projectId ?? null,
      taskId: data.taskId ?? null,
      mode: data.mode,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      durationMinutes: data.durationMinutes,
      createdAt: new Date(),
    };
    this.sessions.push(session);
    return Promise.resolve(session);
  }

  findMany(query: SessionQuery): Promise<PomodoroSession[]> {
    return Promise.resolve(this.sessions.filter((s) => s.userId === query.userId));
  }
}

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

describe('PomodoroService', () => {
  let repository: FakePomodoroRepository;
  let service: PomodoroService;

  beforeEach(() => {
    repository = new FakePomodoroRepository();
    service = new PomodoroService(repository);
  });

  it('registra um ciclo concluído', async () => {
    const session = await service.record('u1', {
      mode: 'FOCUS',
      startedAt: oneHourAgo.toISOString(),
      endedAt: halfHourAgo.toISOString(),
      durationMinutes: 30,
    });

    expect(session.durationMinutes).toBe(30);
    expect(session.mode).toBe('FOCUS');
  });

  it('recusa fim anterior ao início', async () => {
    await expect(
      service.record('u1', {
        mode: 'FOCUS',
        startedAt: halfHourAgo.toISOString(),
        endedAt: oneHourAgo.toISOString(),
        durationMinutes: 30,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa duração incompatível com o intervalo', async () => {
    await expect(
      service.record('u1', {
        mode: 'FOCUS',
        startedAt: oneHourAgo.toISOString(),
        endedAt: halfHourAgo.toISOString(),
        durationMinutes: 120,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soma os minutos de foco por tarefa', async () => {
    await service.record('u1', {
      mode: 'FOCUS',
      startedAt: oneHourAgo.toISOString(),
      endedAt: halfHourAgo.toISOString(),
      durationMinutes: 30,
      taskId: 't1',
    });
    await service.record('u1', {
      mode: 'SHORT_BREAK',
      startedAt: fiveMinutesAgo.toISOString(),
      endedAt: new Date().toISOString(),
      durationMinutes: 5,
      taskId: 't1',
    });

    const summary = await service.summaryOf('u1');

    expect(summary.focusMinutes).toBe(30);
    expect(summary.breakMinutes).toBe(5);
    expect(summary.completedCycles).toBe(1);
    expect(summary.byTask.t1).toBe(30);
  });
});
