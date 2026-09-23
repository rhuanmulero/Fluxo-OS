import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationResponseDto } from './dto/notification-response.dto';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from './notification.repository.interface';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
  ) {}

  async list(userId: string, unreadOnly: boolean): Promise<NotificationResponseDto[]> {
    const rows = await this.notifications.listOf(userId, unreadOnly);

    return rows.map(NotificationResponseDto.from);
  }

  async markRead(userId: string, id: string): Promise<NotificationResponseDto> {
    const notification = await this.notifications.markRead(userId, id);

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    return NotificationResponseDto.from(notification);
  }

  markAllRead(userId: string): Promise<void> {
    return this.notifications.markAllRead(userId);
  }
}
