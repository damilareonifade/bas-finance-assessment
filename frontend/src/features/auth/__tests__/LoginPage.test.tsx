import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithProviders } from '@/test/renderWithProviders';
import LoginPage from '../pages/LoginPage';

afterEach(() => vi.restoreAllMocks());

describe('LoginPage', () => {
  it('validates before calling the server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ code: 'UNAUTHENTICATED', message: 'x' }, 401));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith('/auth/login'))).toBe(false);
  });

  it('shows the server message for wrong credentials and sends the session cookie option', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/auth/login')
        ? jsonResponse({ statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' }, 401)
        : jsonResponse({ code: 'UNAUTHENTICATED', message: 'Authentication required' }, 401),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.type(screen.getByLabelText('Email address'), 'admin@lender.test');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Incorrect email or password')).toBeInTheDocument();
    const loginCall = fetchSpy.mock.calls.find(([input]) => String(input).endsWith('/auth/login'));
    expect(loginCall?.[1]?.credentials).toBe('include');
    expect(JSON.parse(String(loginCall?.[1]?.body))).toEqual({ email: 'admin@lender.test', password: 'wrong-password', rememberMe: false });
  });

  it('sends rememberMe when the box is ticked', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' }, 401));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.type(screen.getByLabelText('Email address'), 'admin@lender.test');
    await user.type(screen.getByLabelText('Password'), 'whatever-1');
    await user.click(screen.getByLabelText('Remember me'));
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await screen.findByText('Incorrect email or password');
    const loginCall = fetchSpy.mock.calls.find(([input]) => String(input).endsWith('/auth/login'));
    expect(JSON.parse(String(loginCall?.[1]?.body)).rememberMe).toBe(true);
  });

  it('toggles password visibility', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ code: 'UNAUTHENTICATED', message: 'x' }, 401));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('explains what to do when the password is forgotten, and shows the BAS logo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ code: 'UNAUTHENTICATED', message: 'x' }, 401));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('img', { name: 'BAS Finance' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(screen.getByText(/ask your BAS Finance administrator/i)).toBeInTheDocument();
  });
});
