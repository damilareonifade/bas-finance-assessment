import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@/components/ui/icons';
import { formatRelativeTime } from '@/lib/dates/calendarDate';
import { cn } from '@/lib/utils/cn';
import { useInboxQuery, useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation } from '../api/notificationsApi';
import type { AppNotification } from '../schemas/notification';

const KIND_DOT: Readonly<Record<AppNotification['kind'], string>> = {
  APPLICATION_SUBMITTED: 'bg-brand',
  APPLICATION_ASSIGNED: 'bg-chart-cyan',
  APPLICATION_APPROVED: 'bg-success',
  APPLICATION_REJECTED: 'bg-danger',
  DOCUMENT_SUBMITTED: 'bg-orange',
  CUSTOMER_ASSIGNED: 'bg-teal',
};

/** Topbar bell: unread count, the latest 20, click to open (and mark read), "Mark all as read". */
export function NotificationBell() {
  const navigate = useNavigate();
  const inboxQuery = useInboxQuery();
  const markRead = useMarkNotificationReadMutation();
  const markAllRead = useMarkAllNotificationsReadMutation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const unreadCount = inboxQuery.data?.unreadCount ?? 0;
  const items = inboxQuery.data?.items ?? [];

  const openNotification = (notification: AppNotification) => {
    if (!notification.readAt) markRead.mutate(notification.notificationId);
    setIsOpen(false);
    if (notification.link) navigate(notification.link);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
        className="relative grid size-10 place-items-center rounded-full text-ink-muted transition-colors hover:bg-line/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
      >
        <BellIcon size={21} />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className="absolute top-0.5 right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger px-1 text-xs leading-none font-semibold text-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div id={panelId} role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unreadCount > 0 ? (
              <button type="button" onClick={() => markAllRead.mutate()} className="text-xs font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                Mark all as read
              </button>
            ) : null}
          </div>
          {inboxQuery.isError ? <p className="px-4 py-6 text-center text-sm text-danger">Could not load notifications.</p> : null}
          {inboxQuery.isSuccess && items.length === 0 ? <p className="px-4 py-8 text-center text-sm text-ink-muted">You're all caught up.</p> : null}
          {items.length > 0 ? (
            <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
              {items.map((notification) => (
                <li key={notification.notificationId}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand', !notification.readAt && 'bg-brand-soft/40')}
                  >
                    <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', notification.readAt ? 'bg-line' : KIND_DOT[notification.kind])} />
                    <span className="min-w-0">
                      <span className={cn('block text-sm text-ink', !notification.readAt && 'font-semibold')}>
                        {notification.title}
                        {!notification.readAt ? <span className="sr-only"> (unread)</span> : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-muted">{notification.body}</span>
                      <span className="mt-1 block text-xs text-ink-muted/80">{formatRelativeTime(notification.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
