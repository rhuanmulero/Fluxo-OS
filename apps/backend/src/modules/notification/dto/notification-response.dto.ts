import { Notification, NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  constructor(
    readonly id: string,
    readonly type: NotificationType,
    readonly title: string,
    readonly body: string,
    readonly taskId: string | null,
    readonly readAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static from(notification: Notification): NotificationResponseDto {
    return new NotificationResponseDto(
      notification.id,
      notification.type,
      notification.title,
      notification.body,
      notification.taskId,
      notification.readAt,
      notification.createdAt,
    );
  }
}
