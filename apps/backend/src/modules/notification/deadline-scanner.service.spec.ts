import { DeadlineScanner } from './deadline-scanner.service';

describe('DeadlineScanner', () => {
  const agora = new Date('2026-09-09T08:00:00.000Z');

  const tarefa = {
    id: 'task-1',
    title: 'Entregar o relatório',
    dueDate: new Date('2026-09-10T12:00:00.000Z'),
    assigneeId: 'user-1',
    project: { name: 'TCC' },
  };

  it('procura na janela de 48 horas a partir de agora', async () => {
    const deadlines = { dueBetween: jest.fn().mockResolvedValue([]) };
    const notifications = { createMany: jest.fn().mockResolvedValue(0) };
    const scanner = new DeadlineScanner(deadlines as never, notifications as never);

    await scanner.scan(agora);

    expect(deadlines.dueBetween).toHaveBeenCalledWith(
      agora,
      new Date('2026-09-11T08:00:00.000Z'),
    );
  });

  it('cria um aviso por tarefa, com chave derivada da tarefa e do prazo', async () => {
    const deadlines = { dueBetween: jest.fn().mockResolvedValue([tarefa]) };
    const notifications = { createMany: jest.fn().mockResolvedValue(1) };
    const scanner = new DeadlineScanner(deadlines as never, notifications as never);

    await scanner.scan(agora);

    expect(notifications.createMany).toHaveBeenCalledWith([
      {
        userId: 'user-1',
        type: 'TASK_DUE_SOON',
        title: 'Prazo próximo',
        body: 'A tarefa "Entregar o relatório", do projeto TCC, vence em 10/09/2026.',
        taskId: 'task-1',
        referenceKey: 'task-due:task-1:2026-09-10',
      },
    ]);
  });

  it('é idempotente: a segunda varredura no mesmo dia não cria nada', async () => {
    const deadlines = { dueBetween: jest.fn().mockResolvedValue([tarefa]) };
    const notifications = {
      createMany: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    };
    const scanner = new DeadlineScanner(deadlines as never, notifications as never);

    expect(await scanner.scan(agora)).toBe(1);
    expect(await scanner.scan(agora)).toBe(0);
  });

  it('não consulta o repositório de avisos quando não há tarefa vencendo', async () => {
    const deadlines = { dueBetween: jest.fn().mockResolvedValue([]) };
    const notifications = { createMany: jest.fn() };
    const scanner = new DeadlineScanner(deadlines as never, notifications as never);

    expect(await scanner.scan(agora)).toBe(0);
    expect(notifications.createMany).not.toHaveBeenCalled();
  });
});
