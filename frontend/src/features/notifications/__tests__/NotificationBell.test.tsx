import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/AppProviders';
import { formatRelativeTime } from '@/lib/dates/calendarDate';
import { jsonResponse } from '@/test/renderWithProviders';
import { NotificationBell } from '../components/NotificationBell';

afterEach(() => vi.restoreAllMocks());

const now = new Date().toISOString();
const unread = { notificationId: 'NTF-2', kind: 'APPLICATION_SUBMITTED', title: 'New loan application', body: 'Chidi applied for ₦1,200,000.00.', link: '/applications/APP-000001', createdAt: now, readAt: null };
const read = { notificationId: 'NTF-1', kind: 'CUSTOMER_ASSIGNED', title: 'New customer assigned to you', body: 'Amaka is now in your book.', link: '/customers/CUS-2', createdAt: now, readAt: now };

function Where() {
  return <p>At {useLocation().pathname}</p>;
}

function renderBell() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/']}>
        <NotificationBell />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('NotificationBell', () => {
  it('shows the unread count and the list', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ unreadCount: 1, items: [unread, read] }));
    const user = userEvent.setup();
    renderBell();
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    await user.click(bell);
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByText(/New loan application/)).toBeInTheDocument();
    expect(within(panel).getByText('(unread)')).toBeInTheDocument();
    expect(within(panel).getByText('New customer assigned to you')).toBeInTheDocument();
  });

  it('opening a notification marks it read and goes to what it is about', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).includes('/read') ? jsonResponse({ unreadCount: 0, items: [{ ...unread, readAt: now }, read] }) : jsonResponse({ unreadCount: 1, items: [unread, read] }),
    );
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole('button', { name: /notifications, 1 unread/i }));
    await user.click(screen.getByRole('button', { name: /new loan application/i }));
    expect(await screen.findByText('At /applications/APP-000001')).toBeInTheDocument();
    await waitFor(() => expect(fetchSpy.mock.calls.some(([input, init]) => String(input).endsWith('/notifications/NTF-2/read') && init?.method === 'POST')).toBe(true));
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('marks everything as read', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/read-all') ? jsonResponse({ unreadCount: 0, items: [{ ...unread, readAt: now }] }) : jsonResponse({ unreadCount: 1, items: [unread] }),
    );
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole('button', { name: /1 unread/i }));
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument());
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith('/notifications/read-all'))).toBe(true);
  });

  it('says so when there is nothing new', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ unreadCount: 0, items: [] }));
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
  });
});

describe('formatRelativeTime', () => {
  const at = new Date('2026-11-11T12:00:00Z');
  it.each([
    ['2026-11-11T11:59:40Z', 'just now'],
    ['2026-11-11T11:48:00Z', '12 min ago'],
    ['2026-11-11T09:00:00Z', '3 h ago'],
    ['2026-11-10T11:00:00Z', '1 day ago'],
    ['2026-11-08T12:00:00Z', '3 days ago'],
    ['2026-10-01T12:00:00Z', '2026-10-01'],
  ])('%s → %s', (iso, expected) => expect(formatRelativeTime(iso, at)).toBe(expected));
});
