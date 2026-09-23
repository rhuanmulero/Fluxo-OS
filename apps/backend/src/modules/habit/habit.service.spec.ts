import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Habit, HabitFrequency, HabitLog } from '@prisma/client';
import { HabitService } from './habit.service';
import {
  HabitChanges,
  HabitRepository,
  NewHabit,
} from './habit.repository.interface';

class FakeHabitRepository implements HabitRepository {
  habits: Habit[] = [];
  logs: HabitLog[] = [];

  findManyFor(workspaceId: string, userId: string, includeArchived: boolean): Promise<Habit[]> {
    return Promise.resolve(
      this.habits.filter(
        (habit) =>
          habit.workspaceId === workspaceId &&
          habit.userId === userId &&
          (includeArchived || habit.archivedAt === null),
      ),
    );
  }

  findById(id: string): Promise<Habit | null> {
    return Promise.resolve(this.habits.find((habit) => habit.id === id) ?? null);
  }

  create(data: NewHabit): Promise<Habit> {
    const habit: Habit = {
      id: `h${this.habits.length + 1}`,
      workspaceId: data.workspaceId,
      userId: data.userId,
      projectId: data.projectId ?? null,
      name: data.name,
      frequency: data.frequency,
      targetPerPeriod: data.targetPerPeriod,
      color: data.color ?? null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.habits.push(habit);
    return Promise.resolve(habit);
  }

  update(id: string, changes: HabitChanges): Promise<Habit> {
    const habit = this.habits.find((h) => h.id === id);

    if (!habit) {
      throw new Error('Hábito não encontrado no fake.');
    }

    if (changes.name !== undefined) habit.name = changes.name;
    if (changes.frequency !== undefined) habit.frequency = changes.frequency;
    if (changes.targetPerPeriod !== undefined) habit.targetPerPeriod = changes.targetPerPeriod;
    if (changes.color !== undefined) habit.color = changes.color;
    if (changes.projectId !== undefined) habit.projectId = changes.projectId;
    if (changes.archivedAt !== undefined) habit.archivedAt = changes.archivedAt;
    habit.updatedAt = new Date();

    return Promise.resolve(habit);
  }

  delete(id: string): Promise<void> {
    this.habits = this.habits.filter((habit) => habit.id !== id);
    this.logs = this.logs.filter((log) => log.habitId !== id);
    return Promise.resolve();
  }

  findLogs(habitId: string, from: Date, to: Date): Promise<HabitLog[]> {
    return Promise.resolve(
      this.logs.filter(
        (log) =>
          log.habitId === habitId &&
          log.date.getTime() >= from.getTime() &&
          log.date.getTime() <= to.getTime(),
      ),
    );
  }

  findLogsOfDay(habitIds: string[], date: Date): Promise<HabitLog[]> {
    return Promise.resolve(
      this.logs.filter(
        (log) => habitIds.includes(log.habitId) && log.date.getTime() === date.getTime(),
      ),
    );
  }

  upsertLog(habitId: string, date: Date, value: number, note?: string): Promise<HabitLog> {
    const existing = this.logs.find(
      (log) => log.habitId === habitId && log.date.getTime() === date.getTime(),
    );

    if (existing) {
      existing.value = value;
      existing.note = note ?? null;
      return Promise.resolve(existing);
    }

    const log: HabitLog = {
      id: `l${this.logs.length + 1}`,
      habitId,
      date,
      value,
      note: note ?? null,
      createdAt: new Date(),
    };
    this.logs.push(log);
    return Promise.resolve(log);
  }

  deleteLog(habitId: string, date: Date): Promise<void> {
    this.logs = this.logs.filter(
      (log) => !(log.habitId === habitId && log.date.getTime() === date.getTime()),
    );
    return Promise.resolve();
  }
}

describe('HabitService', () => {
  let repository: FakeHabitRepository;
  let service: HabitService;

  beforeEach(() => {
    repository = new FakeHabitRepository();
    service = new HabitService(repository);
  });

  it('marcar o mesmo dia duas vezes não cria dois registros', async () => {
    const habit = await service.create('w1', 'u1', { name: 'Ler', frequency: 'DAILY' as HabitFrequency });

    await service.mark('w1', 'u1', habit.id, '2026-09-08', {});
    await service.mark('w1', 'u1', habit.id, '2026-09-08', {});

    const logs = await service.logs('w1', 'u1', habit.id, '2026-09-01', '2026-09-30');

    expect(logs).toHaveLength(1);
  });

  it('desmarcar um dia sem log não quebra', async () => {
    const habit = await service.create('w1', 'u1', { name: 'Ler', frequency: 'DAILY' as HabitFrequency });

    await expect(service.unmark('w1', 'u1', habit.id, '2026-09-08')).resolves.toBeUndefined();
  });

  it('normaliza a data do log para meia-noite UTC', async () => {
    const habit = await service.create('w1', 'u1', { name: 'Ler', frequency: 'DAILY' as HabitFrequency });

    const log = await service.mark('w1', 'u1', habit.id, '2026-09-08', {});

    expect(log.date.toISOString()).toBe('2026-09-08T00:00:00.000Z');
  });

  it('recusa data de log em formato inválido', async () => {
    const habit = await service.create('w1', 'u1', { name: 'Ler', frequency: 'DAILY' as HabitFrequency });

    await expect(
      service.mark('w1', 'u1', habit.id, '08/09/2026', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa data de log inexistente no calendário (2026-02-30)', async () => {
    const habit = await service.create('w1', 'u1', { name: 'Ler', frequency: 'DAILY' as HabitFrequency });

    await expect(
      service.mark('w1', 'u1', habit.id, '2026-02-30', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa data de log inexistente no calendário (2026-04-31)', async () => {
    const habit = await service.create('w1', 'u1', { name: 'Ler', frequency: 'DAILY' as HabitFrequency });

    await expect(
      service.mark('w1', 'u1', habit.id, '2026-04-31', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('esconde hábito arquivado da listagem padrão e mostra quando pedido', async () => {
    const habit = await service.create('w1', 'u1', { name: 'Correr', frequency: 'DAILY' as HabitFrequency });

    await service.update('w1', 'u1', habit.id, { archived: true });

    expect(await service.list('w1', 'u1', false)).toHaveLength(0);
    expect(await service.list('w1', 'u1', true)).toHaveLength(1);
  });

  it('recusa mexer no hábito de outro usuário', async () => {
    const habit = await service.create('w1', 'u2', { name: 'Meditar', frequency: 'DAILY' as HabitFrequency });

    await expect(
      service.mark('w1', 'u1', habit.id, '2026-09-08', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa hábito de outro workspace', async () => {
    const habit = await service.create('w1', 'u1', { name: 'Meditar', frequency: 'DAILY' as HabitFrequency });

    await expect(
      service.update('w2', 'u1', habit.id, { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa remover hábito de outro usuário', async () => {
    const habit = await service.create('w1', 'u2', { name: 'Meditar', frequency: 'DAILY' as HabitFrequency });

    await expect(service.remove('w1', 'u1', habit.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('arquivar mantém o hábito, remover o apaga de fato', async () => {
    const archived = await service.create('w1', 'u1', { name: 'Correr', frequency: 'DAILY' as HabitFrequency });
    const removed = await service.create('w1', 'u1', { name: 'Nadar', frequency: 'DAILY' as HabitFrequency });

    await service.update('w1', 'u1', archived.id, { archived: true });
    await service.remove('w1', 'u1', removed.id);

    const all = await service.list('w1', 'u1', true);
    const ids = all.map((habit) => habit.id);

    expect(ids).toContain(archived.id);
    expect(ids).not.toContain(removed.id);
  });
});
