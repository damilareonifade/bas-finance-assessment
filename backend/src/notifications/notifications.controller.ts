import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/auth.decorators';
import { NotificationsService } from './notifications.service';

class InboxQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  unreadOnly?: 'true' | 'false';

  @IsOptional()
  @IsIn(['10', '20', '50'])
  limit?: '10' | '20' | '50';
}

/** Every signed-in user sees only their own notifications. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  inbox(@Query() query: InboxQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.inbox(user.userId, Number(query.limit ?? '20'), query.unreadOnly === 'true');
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.userId);
  }

  @Post(':notificationId/read')
  @HttpCode(200)
  markRead(@Param('notificationId') notificationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(user.userId, notificationId);
  }
}
