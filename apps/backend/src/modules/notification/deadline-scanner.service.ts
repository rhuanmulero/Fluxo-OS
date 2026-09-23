import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { DeadlineRepository, DueTask } from './deadline.repository';
import {
  NewNotification,
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from './notification.repository.interface';

export const DUE_SOON_WINDOW_HOURS = 48;

const DAILY_AT_EIGHT = '0 0 8 * * *';
const TIME_ZONE = 'America/Sao_Paulo';

@Injectable()
export class DeadlineScanner {
  private readonly logger = new Logger(DeadlineScanner.name);

  constructor(
    private readonly deadlines: DeadlineRepository,
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
  ) {}

  @Cron(DAILY_AT_EIGHT, { timeZone: TIME_ZONE })
  async runDaily(): Promise<void> {
    const created = await this.scan(new Date());

    this.logger.log(`Varredura de prazos concluída: ${created} avisos criados.`);
  }

  async scan(now: Date): Promise<number> {
    const limit = new Date(now.getTime() + DUE_SOON_WINDOW_HOURS * 60 * 60 * 1000);
    const tasks = await this.deadlines.dueBetween(now, limit);

    if (tasks.length === 0) {
      return 0;
    }

    return this.notifications.createMany(tasks.map((task) => this.describe(task)));
  }

  private describe(task: DueTask): NewNotification {
    const day = task.dueDate.toISOString().slice(0, 10);

    return {
      userId: task.assigneeId,
      type: NotificationType.TASK_DUE_SOON,
      title: 'Prazo próximo',
      body: `A tarefa "${task.title}", do projeto ${task.project.name}, vence em ${this.format(task.dueDate)}.`,
      taskId: task.id,
      referenceKey: `task-due:${task.id}:${day}`,
    };
  }

  private format(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE }).format(date);
  }
}
