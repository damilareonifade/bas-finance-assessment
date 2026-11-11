import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/AppProviders';
import type { SessionUser } from '@/features/auth';
import { jsonResponse } from '@/test/renderWithProviders';
import { Sidebar } from '../Sidebar';
import { TopBar } from '../TopBar';
import { initialsOf } from '../UserMenu';

afterEach(() => vi.restoreAllMocks());

const admin: SessionUser = { userId: 'USR-1', email: 'admin@lender.test', fullName: 'Ada Okoye', role: 'ADMIN' };

function renderWithRouter(ui: React.ReactElement, path = '/') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </AppProviders>,
  );
}

describe('Sidebar', () => {
  it('lists the admin destinations and marks the current page', () => {
    renderWithRouter(<Sidebar role="ADMIN" />, '/customers/CUS-1');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Team' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Customers' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Loans' })).not.toHaveAttribute('aria-current');
  });

  it('shows loan officers only what they may open', () => {
    renderWithRouter(<Sidebar role="LOAN_OFFICER" />);
    expect(screen.queryByRole('link', { name: 'Team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Loan products' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Collections' })).toBeInTheDocument();
  });

  it('collapses and expands a group', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Sidebar role="ADMIN" />);
    const lending = screen.getByRole('button', { name: 'Lending' });
    expect(lending).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Invoices' })).toBeVisible();

    await user.click(lending);
    expect(lending).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Invoices' })).not.toBeInTheDocument();

    await user.click(lending);
    expect(screen.getByRole('link', { name: 'Invoices' })).toBeVisible();
  });

  it('tells the mobile drawer a link was followed', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderWithRouter(<Sidebar role="ADMIN" onNavigate={onNavigate} />);
    await user.click(screen.getByRole('link', { name: 'Team' }));
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe('TopBar and account menu', () => {
  it('shows only the logo and the account menu — no navigation links', () => {
    renderWithRouter(<TopBar user={admin} isDrawerOpen={false} onToggleDrawer={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'BAS Finance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ada okoye/i })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('opens with name, email, Settings and Sign out, and closes on Escape', async () => {
    const user = userEvent.setup();
    renderWithRouter(<TopBar user={admin} isDrawerOpen={false} onToggleDrawer={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /ada okoye/i }));
    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(within(menu).getByText('admin@lender.test')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('signs out through the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 204 }));
    const user = userEvent.setup();
    renderWithRouter(<TopBar user={admin} isDrawerOpen={false} onToggleDrawer={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /ada okoye/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await vi.waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith('/auth/logout'))).toBe(true));
  });

  it('the menu button on small screens toggles the drawer', async () => {
    const onToggleDrawer = vi.fn();
    const user = userEvent.setup();
    renderWithRouter(<TopBar user={admin} isDrawerOpen={false} onToggleDrawer={onToggleDrawer} />);
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(onToggleDrawer).toHaveBeenCalled();
  });
});

describe('initialsOf', () => {
  it.each([
    ['Ada Okoye', 'AO'],
    ['Administrator', 'A'],
    ['  bola  adeyemi  ', 'BA'],
    ['Ngozi Chioma Umeh', 'NU'],
    ['', '?'],
  ])('%j → %s', (name, expected) => expect(initialsOf(name)).toBe(expected));
});

// keep jsonResponse referenced so the shared helper stays exercised by this suite's imports
void jsonResponse;
