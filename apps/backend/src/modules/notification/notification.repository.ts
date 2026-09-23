import { Injectable } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { NewNotification, NotificationRepository } from './notification.repository.interface';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  listOf(userId: string, unreadOnly: boolean): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  createMany(items: NewNotification[]): Promise<number> {
    return this.prisma.notification
      .createMany({ data: items, skipDuplicates: true })
      .then((result) => result.count);
  }

  markRead(userId: string, id: string): Promise<Notification | null> {
    return this.prisma.notification
      .updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } })
      .then(() => this.prisma.notification.findFirst({ where: { id, userId } }));
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }
}
