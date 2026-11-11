import { z } from 'zod';

export const notificationKindSchema = z.enum([
  'APPLICATION_SUBMITTED',
  'APPLICATION_ASSIGNED',
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',
  'DOCUMENT_SUBMITTED',
  'CUSTOMER_ASSIGNED',
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const notificationSchema = z.object({
  notificationId: z.string(),
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

export const inboxSchema = z.object({ unreadCount: z.number().int().nonnegative(), items: z.array(notificationSchema) });
export type Inbox = z.infer<typeof inboxSchema>;
