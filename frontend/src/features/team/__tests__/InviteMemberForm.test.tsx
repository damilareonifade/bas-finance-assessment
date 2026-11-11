import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithProviders } from '@/test/renderWithProviders';
import { InviteMemberForm } from '../components/InviteMemberForm';

afterEach(() => vi.restoreAllMocks());

describe('InviteMemberForm', () => {
  it('invites an officer and shows the one-time link', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          invitation: { invitationId: 'INVT-1', email: 'ada@lender.test', role: 'LOAN_OFFICER', status: 'PENDING', expiresAt: '2026-01-22T00:00:00Z', createdAt: '2026-01-15T00:00:00Z' },
          inviteLink: 'http://localhost:5173/accept-invite?token=abc123',
        },
        201,
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<InviteMemberForm />);
    await user.type(screen.getByLabelText('Email'), 'ada@lender.test');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByDisplayValue('http://localhost:5173/accept-invite?token=abc123')).toBeInTheDocument();
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument();
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as unknown;
    expect(body).toEqual({ email: 'ada@lender.test', role: 'LOAN_OFFICER' });
  });

  it('puts a server error on the email field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ statusCode: 422, code: 'VALIDATION_FAILED', message: 'Validation failed', errors: [{ field: 'email', message: 'email must be an email' }] }, 422),
    );
    const user = userEvent.setup();
    renderWithProviders(<InviteMemberForm />);
    await user.type(screen.getByLabelText('Email'), 'ada@lender.test');
    await user.click(screen.getByRole('button', { name: /send invite/i }));
    expect(await screen.findByText('email must be an email')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects an invalid email without calling the server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderWithProviders(<InviteMemberForm />);
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.click(screen.getByRole('button', { name: /send invite/i }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
