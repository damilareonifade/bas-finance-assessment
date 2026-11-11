import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithProviders } from '@/test/renderWithProviders';
import { ChangePasswordForm } from '../components/ChangePasswordForm';

afterEach(() => vi.restoreAllMocks());

async function fill(user: ReturnType<typeof userEvent.setup>, current: string, next: string, repeat: string) {
  await user.type(screen.getByLabelText('Current password'), current);
  await user.type(screen.getByLabelText('New password'), next);
  await user.type(screen.getByLabelText('Repeat new password'), repeat);
  await user.click(screen.getByRole('button', { name: /save password/i }));
}

describe('ChangePasswordForm', () => {
  it('checks the new password locally before calling the server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordForm />);
    await fill(user, 'OldPass123!', 'short', 'different');
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends only the current and new passwords, then confirms and clears the form', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 204 }));
    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordForm />);
    await fill(user, 'OldPass123!', 'BrandNewPass2!', 'BrandNewPass2!');
    expect(await screen.findByText('Password changed.')).toBeInTheDocument();
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({ currentPassword: 'OldPass123!', newPassword: 'BrandNewPass2!' });
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('puts "current password is incorrect" on that field', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse({ statusCode: 422, code: 'VALIDATION_FAILED', message: 'Validation failed', errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }] }, 422),
    );
    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordForm />);
    await fill(user, 'WrongPass123!', 'BrandNewPass2!', 'BrandNewPass2!');
    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');
  });
});
