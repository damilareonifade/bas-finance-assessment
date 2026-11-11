import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithProviders } from '@/test/renderWithProviders';
import { DocumentsPanel } from '../components/DocumentsPanel';
import { checkSubmission } from '../schemas/document';

afterEach(() => vi.restoreAllMocks());

const pdf = (size = 100) => new File([new Uint8Array(size)], 'statement.pdf', { type: 'application/pdf' });

describe('checkSubmission (mirrors the server rules)', () => {
  it('needs an 11-digit BVN / NIN', () => {
    expect(checkSubmission('BVN', '', null)).toEqual({ identifier: 'Enter the BVN' });
    expect(checkSubmission('NIN', '1234', null)).toEqual({ identifier: 'NIN must be exactly 11 digits' });
    expect(checkSubmission('BVN', '222 1234 5678', null)).toEqual({});
  });
  it('needs a file for statements, and only PDF / PNG / JPEG up to 5 MB', () => {
    expect(checkSubmission('BANK_STATEMENT', '', null)).toEqual({ file: 'Attach the bank statement' });
    expect(checkSubmission('BANK_STATEMENT', '', new File(['x'], 'a.txt', { type: 'text/plain' }))).toEqual({ file: 'Upload a PDF, PNG or JPEG file' });
    expect(checkSubmission('BANK_STATEMENT', '', pdf(5 * 1024 * 1024 + 1))).toEqual({ file: 'Files must be 5 MB or smaller' });
    expect(checkSubmission('BANK_STATEMENT', '', pdf())).toEqual({});
  });
  it('needs a number or a file for everything else', () => {
    expect(checkSubmission('PASSPORT', '', null)).toEqual({ identifier: 'Enter the document number or attach a file' });
    expect(checkSubmission('PASSPORT', 'A0123', null)).toEqual({});
  });
});

const person = { userId: 'USR-1', fullName: 'Administrator' };
const submittedBvn = {
  documentId: 'DOC-1', customerId: 'CUS-1', type: 'BVN', typeLabel: 'BVN', status: 'SUBMITTED', identifierMasked: '222••••••78', hasFile: false,
  fileName: null, fileSize: null, requestNote: 'Before approval', requestedBy: person, requestedAt: '2026-11-01T09:00:00Z', submittedBy: person, submittedByCustomer: false,
  submittedAt: '2026-11-02T09:00:00Z', reviewedBy: null, reviewedAt: null, reviewNote: null,
};
const statement = { ...submittedBvn, documentId: 'DOC-2', type: 'BANK_STATEMENT', typeLabel: 'Bank statement', status: 'VERIFIED', identifierMasked: null, hasFile: true, fileName: 'statement.pdf', reviewedBy: person, reviewedAt: '2026-11-03T09:00:00Z' };

describe('DocumentsPanel', () => {
  it('shows masked numbers, reveals the full one on request, and links the file', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/documents/DOC-1') ? jsonResponse({ ...submittedBvn, identifier: '22212345678' }) : jsonResponse([submittedBvn, statement]),
    );
    const user = userEvent.setup();
    renderWithProviders(<DocumentsPanel customerId="CUS-1" />);
    expect(await screen.findByText('222••••••78')).toBeInTheDocument();
    expect(screen.queryByText('22212345678')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'statement.pdf' })).toHaveAttribute('href', expect.stringContaining('/customers/CUS-1/documents/DOC-2/file'));

    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(await screen.findByText('22212345678')).toBeInTheDocument();
  });

  it('verifies a submitted document', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/review') ? jsonResponse({ ...submittedBvn, status: 'VERIFIED', reviewedBy: person, reviewedAt: '2026-11-04T09:00:00Z' }) : jsonResponse([submittedBvn]),
    );
    const user = userEvent.setup();
    renderWithProviders(<DocumentsPanel customerId="CUS-1" />);
    await user.click(await screen.findByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith('/documents/DOC-1/review'))).toBe(true));
    const reviewCall = fetchSpy.mock.calls.find(([input]) => String(input).endsWith('/review'));
    expect(JSON.parse(String(reviewCall?.[1]?.body))).toEqual({ decision: 'VERIFIED' });
    expect(await screen.findByText('BVN verified')).toBeInTheDocument();
  });

  it('asks why before rejecting, and sends the reason', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/review') ? jsonResponse({ ...submittedBvn, status: 'REJECTED', reviewNote: 'Name mismatch' }) : jsonResponse([submittedBvn]),
    );
    const user = userEvent.setup();
    renderWithProviders(<DocumentsPanel customerId="CUS-1" />);
    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    await user.type(screen.getByLabelText('Why is it rejected?'), 'Name mismatch');
    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' });
    await user.click(rejectButtons[rejectButtons.length - 1] as HTMLElement);
    await waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith('/review'))).toBe(true));
    const reviewCall = fetchSpy.mock.calls.find(([input]) => String(input).endsWith('/review'));
    expect(JSON.parse(String(reviewCall?.[1]?.body))).toEqual({ decision: 'REJECTED', note: 'Name mismatch' });
  });

  it('checks a BVN before uploading anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse([]));
    const user = userEvent.setup();
    renderWithProviders(<DocumentsPanel customerId="CUS-1" />);
    await user.click(await screen.findByRole('button', { name: /record a submission/i }));
    const form = screen.getByRole('button', { name: 'Save submission' }).closest('form') as HTMLElement;
    await user.type(within(form).getByLabelText(/BVN \(11 digits\)/), '12345');
    await user.click(within(form).getByRole('button', { name: 'Save submission' }));
    expect(await screen.findByText('BVN must be exactly 11 digits')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });
});
