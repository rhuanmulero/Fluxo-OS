import { NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  it('recusa marcar como lida uma notificação de outro usuário', async () => {
    const repository = { markRead: jest.fn().mockResolvedValue(null) };
    const service = new NotificationService(repository as never);

    await expect(service.markRead('user-1', 'notificacao-de-outro')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('devolve apenas as não lidas quando pedido', async () => {
    const repository = { listOf: jest.fn().mockResolvedValue([]) };
    const service = new NotificationService(repository as never);

    await service.list('user-1', true);

    expect(repository.listOf).toHaveBeenCalledWith('user-1', true);
  });

  it('traduz a linha do banco para o DTO de resposta', async () => {
    const row = {
      id: 'notificacao-1',
      userId: 'user-1',
      type: 'TASK_DUE_SOON',
      title: 'Prazo próximo',
      body: 'A tarefa vence amanhã.',
      taskId: 'task-1',
      referenceKey: 'task-due:task-1:2026-09-10',
      readAt: null,
      createdAt: new Date('2026-09-09T08:00:00.000Z'),
    };
    const repository = { listOf: jest.fn().mockResolvedValue([row]) };
    const service = new NotificationService(repository as never);

    const [dto] = await service.list('user-1', false);

    expect(dto).toEqual({
      id: 'notificacao-1',
      type: 'TASK_DUE_SOON',
      title: 'Prazo próximo',
      body: 'A tarefa vence amanhã.',
      taskId: 'task-1',
      readAt: null,
      createdAt: new Date('2026-09-09T08:00:00.000Z'),
    });
    expect(dto).not.toHaveProperty('referenceKey');
    expect(dto).not.toHaveProperty('userId');
  });

  it('marcar todas como lidas delega ao repositório', async () => {
    const repository = { markAllRead: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationService(repository as never);

    await service.markAllRead('user-1');

    expect(repository.markAllRead).toHaveBeenCalledWith('user-1');
  });
});
