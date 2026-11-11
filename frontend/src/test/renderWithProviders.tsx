import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/AppProviders';

export function renderWithProviders(ui: ReactElement, initialRoute = '/') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </AppProviders>,
  );
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
