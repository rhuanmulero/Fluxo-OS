import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeadlineRepository } from './deadline.repository';
import { DeadlineScanner } from './deadline-scanner.service';
import { NotificationController } from './notification.controller';
import { PrismaNotificationRepository } from './notification.repository';
import { NOTIFICATION_REPOSITORY } from './notification.repository.interface';
import { NotificationService } from './notification.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    DeadlineRepository,
    DeadlineScanner,
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
  ],
  exports: [NotificationService, NOTIFICATION_REPOSITORY, DeadlineScanner],
})
export class NotificationModule {}
