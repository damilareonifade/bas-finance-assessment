import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon } from '@/components/ui/icons';
import { formatRelativeTime } from '@/lib/dates/calendarDate';
import { cn } from '@/lib/utils/cn';
import { usePortalInboxQuery, usePortalMarkAllReadMutation } from '../api/portalApi';

/** The portal bell: decisions, document requests and reviews. Opening one follows its link. */
export function PortalNotifications() {
  const inboxQuery = usePortalInboxQuery();
  const markAllRead = usePortalMarkAllReadMutation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const unreadCount = inboxQuery.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
        className="relative grid size-10 place-items-center rounded-full text-ink hover:bg-line/50 focus-visible:outline-2 focus-visible:outline-brand"
      >
        <BellIcon size={20} />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-surface">{unreadCount}</span>
        ) : null}
      </button>
      {isOpen ? (
        <div id={panelId} role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unreadCount > 0 ? (
              <button type="button" onClick={() => markAllRead.mutate()} className="text-xs font-medium text-brand hover:underline">
                Mark all as read
              </button>
            ) : null}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {(inboxQuery.data?.items ?? []).length === 0 ? <li className="px-4 py-6 text-center text-sm text-ink-muted">Nothing new yet.</li> : null}
            {(inboxQuery.data?.items ?? []).map((item) => (
              <li key={item.notificationId} className={cn('border-b border-line/60 last:border-0', item.readAt === null && 'bg-brand-soft/40')}>
                <Link to={item.link ?? '/portal'} onClick={() => setIsOpen(false)} className="block px-4 py-3 hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-brand">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{item.body}</p>
                  <p className="mt-1 text-xs text-ink-muted">{formatRelativeTime(item.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
