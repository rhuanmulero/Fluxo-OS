import { Notification, NotificationType } from '@prisma/client';

export const NOTIFICATION_REPOSITORY = Symbol('NotificationRepository');

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId?: string;
  referenceKey: string;
}

export interface NotificationRepository {
  listOf(userId: string, unreadOnly: boolean): Promise<Notification[]>;
  createMany(items: NewNotification[]): Promise<number>;
  markRead(userId: string, id: string): Promise<Notification | null>;
  markAllRead(userId: string): Promise<void>;
  countUnread(userId: string): Promise<number>;
}
