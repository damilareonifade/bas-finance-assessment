import { Injectable } from '@nestjs/common';
import { Clock } from '../common/clock/clock';
import { NotFoundError } from '../common/errors/app-errors';
import { PrismaService } from '../database/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { NotificationKind, NotificationsRepository, NotificationView } from './notifications.repository';

export interface NotificationMessage {
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly link?: string;
}

export interface NotificationInbox {
  unreadCount: number;
  items: NotificationView[];
}

/** In-app notifications. Written in the same transaction as the event that caused them, so they never describe something that rolled back. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository,
    private readonly users: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  /**
   * Sends to each distinct recipient except the person who caused the event. Null/undefined ids are ignored.
   * Must run inside the event's transaction (it throws otherwise), so a notification never describes something that rolled back.
   */
  async notify(recipientIds: ReadonlyArray<string | null | undefined>, message: NotificationMessage, actorUserId?: string): Promise<void> {
    this.prisma.requireTransaction('NotificationsService.notify');
    const recipients = new Set(recipientIds.filter((userId): userId is string => Boolean(userId) && userId !== actorUserId));
    const createdAt = this.clock.nowIso();
    for (const userId of recipients) await this.repository.insert(userId, message, createdAt);
  }

  async activeAdminIds(): Promise<string[]> {
    return (await this.users.listUsers('ADMIN')).filter((user) => user.status === 'ACTIVE').map((user) => user.userId);
  }

  async inbox(userId: string, limit: number, unreadOnly: boolean): Promise<NotificationInbox> {
    const [unreadCount, items] = await Promise.all([this.repository.unreadCount(userId), this.repository.listFor(userId, limit, unreadOnly)]);
    return { unreadCount, items };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationInbox> {
    const marked = await this.prisma.transaction(() => this.repository.markRead(notificationId, userId, this.clock.nowIso()));
    if (!marked) throw new NotFoundError('NOTIFICATION_NOT_FOUND', 'Notification not found');
    return this.inbox(userId, 20, false);
  }

  async markAllRead(userId: string): Promise<NotificationInbox> {
    await this.prisma.transaction(() => this.repository.markAllRead(userId, this.clock.nowIso()));
    return this.inbox(userId, 20, false);
  }
}
