import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/AppProviders';
import { jsonResponse } from '@/test/renderWithProviders';
import { RequireAuth, RequireRole } from '../components/RequireAuth';

afterEach(() => vi.restoreAllMocks());

function renderRoutes(initialPath: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>Login screen</p> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/collections', element: <p>Collections screen</p> },
          { element: <RequireRole roles={['ADMIN']} />, children: [{ path: '/team', element: <p>Team screen</p> }] },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

const officer = { userId: 'USR-2', email: 'ada@lender.test', fullName: 'Ada', role: 'LOAN_OFFICER' };
const admin = { ...officer, userId: 'USR-1', role: 'ADMIN' };

describe('route guards', () => {
  it('sends a signed-out visitor to /login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ statusCode: 401, code: 'UNAUTHENTICATED', message: 'Authentication required' }, 401));
    renderRoutes('/collections');
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });

  it('lets a signed-in user through', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ user: officer }));
    renderRoutes('/collections');
    expect(await screen.findByText('Collections screen')).toBeInTheDocument();
  });

  it('bounces a loan officer away from admin-only pages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ user: officer }));
    renderRoutes('/team');
    expect(await screen.findByText('Collections screen')).toBeInTheDocument();
    expect(screen.queryByText('Team screen')).not.toBeInTheDocument();
  });

  it('admits an administrator to admin-only pages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ user: admin }));
    renderRoutes('/team');
    expect(await screen.findByText('Team screen')).toBeInTheDocument();
  });
});
