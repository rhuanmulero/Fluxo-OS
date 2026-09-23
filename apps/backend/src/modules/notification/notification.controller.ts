import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationService } from './notification.service';

@Controller('me/notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: string,
  ): Promise<NotificationResponseDto[]> {
    return this.notifications.list(user.id, unreadOnly === 'true');
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    return this.notifications.markRead(user.id, id);
  }
}
