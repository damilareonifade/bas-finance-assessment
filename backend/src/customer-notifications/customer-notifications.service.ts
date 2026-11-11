import { Injectable } from '@nestjs/common';
import { Clock } from '../common/clock/clock';
import { NotFoundError } from '../common/errors/app-errors';
import { PrismaService } from '../database/prisma.service';
import type { CustomerNotification as CustomerNotificationRow } from '../generated/prisma/client';

export type CustomerNotificationKind = 'DOCUMENT_REQUESTED' | 'DOCUMENT_REVIEWED' | 'APPLICATION_RECEIVED' | 'APPLICATION_APPROVED' | 'APPLICATION_REJECTED';

export interface CustomerNotificationMessage {
  readonly kind: CustomerNotificationKind;
  readonly title: string;
  readonly body: string;
  /** Portal path, e.g. /portal/documents. */
  readonly link?: string;
}

export interface CustomerNotificationView {
  notificationId: string;
  kind: CustomerNotificationKind;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface CustomerInbox {
  unreadCount: number;
  items: CustomerNotificationView[];
}

const toView = (row: CustomerNotificationRow): CustomerNotificationView => ({
  notificationId: row.id,
  kind: row.kind as CustomerNotificationKind,
  title: row.title,
  body: row.body,
  link: row.link,
  createdAt: row.createdAt,
  readAt: row.readAt,
});

/**
 * The portal bell. Written in the same transaction as the event (it throws outside one), like staff notifications.
 * Customers without a portal account still collect them, so they see their history when they first sign in.
 */
@Injectable()
export class CustomerNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async notify(customerId: string, message: CustomerNotificationMessage): Promise<void> {
    const transaction = this.prisma.requireTransaction('CustomerNotificationsService.notify');
    const id = await this.prisma.nextId('CNT');
    await transaction.customerNotification.create({
      data: { id, customerId, kind: message.kind, title: message.title, body: message.body, link: message.link ?? null, createdAt: this.clock.nowIso() },
    });
  }

  async inbox(customerId: string, limit = 20): Promise<CustomerInbox> {
    const [unreadCount, rows] = await Promise.all([
      this.prisma.db.customerNotification.count({ where: { customerId, readAt: null } }),
      this.prisma.db.customerNotification.findMany({ where: { customerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit }),
    ]);
    return { unreadCount, items: rows.map(toView) };
  }

  /** Only the owner can mark it; an already-read one keeps its first read time. */
  async markRead(customerId: string, notificationId: string): Promise<CustomerInbox> {
    const found = await this.prisma.transaction(async () => {
      const owned = await this.prisma.db.customerNotification.findFirst({ where: { id: notificationId, customerId }, select: { id: true } });
      if (owned) await this.prisma.db.customerNotification.updateMany({ where: { id: notificationId, readAt: null }, data: { readAt: this.clock.nowIso() } });
      return owned !== null;
    });
    if (!found) throw new NotFoundError('NOTIFICATION_NOT_FOUND', 'Notification not found');
    return this.inbox(customerId);
  }

  async markAllRead(customerId: string): Promise<CustomerInbox> {
    await this.prisma.transaction(() => this.prisma.db.customerNotification.updateMany({ where: { customerId, readAt: null }, data: { readAt: this.clock.nowIso() } }));
    return this.inbox(customerId);
  }
}
