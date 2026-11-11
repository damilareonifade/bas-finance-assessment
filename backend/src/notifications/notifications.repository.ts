import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Notification as NotificationRow } from '../generated/prisma/client';

export type NotificationKind =
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_ASSIGNED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'DOCUMENT_SUBMITTED'
  | 'CUSTOMER_ASSIGNED';

export interface NotificationView {
  notificationId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** In-app path the notification opens, e.g. /applications/APP-000001. */
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

const toView = (row: NotificationRow): NotificationView => ({
  notificationId: row.id,
  kind: row.kind as NotificationKind,
  title: row.title,
  body: row.body,
  link: row.link,
  createdAt: row.createdAt,
  readAt: row.readAt,
});

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(userId: string, input: { kind: NotificationKind; title: string; body: string; link?: string }, createdAt: string): Promise<void> {
    const id = await this.prisma.nextId('NTF');
    await this.prisma.db.notification.create({ data: { id, userId, kind: input.kind, title: input.title, body: input.body, link: input.link ?? null, createdAt } });
  }

  async listFor(userId: string, limit: number, unreadOnly: boolean): Promise<NotificationView[]> {
    const rows = await this.prisma.db.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map(toView);
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.db.notification.count({ where: { userId, readAt: null } });
  }

  /** Only the owner can mark their notification; returns false when it is not theirs. Already-read keeps its first read time. */
  async markRead(notificationId: string, userId: string, readAt: string): Promise<boolean> {
    const owned = await this.prisma.db.notification.findFirst({ where: { id: notificationId, userId }, select: { readAt: true } });
    if (!owned) return false;
    if (owned.readAt === null) await this.prisma.db.notification.updateMany({ where: { id: notificationId, userId, readAt: null }, data: { readAt } });
    return true;
  }

  async markAllRead(userId: string, readAt: string): Promise<void> {
    await this.prisma.db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt } });
  }
}
