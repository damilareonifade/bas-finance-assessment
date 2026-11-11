import { useMutation, useQueryClient } from '@tanstack/react-query';
import { statementKeys } from '@/features/statements';
import { termLoanKeys } from '@/features/term-loans';
import { apiRequest } from '@/lib/api';
import { confirmedRepaymentSchema, repaymentAllocationSchema, type RepaymentRequest } from '../schemas/repayment';

function repaymentsPath(loanId: string): string {
  return `/term-loans/${encodeURIComponent(loanId)}/repayments`;
}

export function previewRepaymentAllocation(loanId: string, request: RepaymentRequest) {
  return apiRequest({ method: 'POST', path: `${repaymentsPath(loanId)}/preview`, body: request, responseSchema: repaymentAllocationSchema });
}

export function confirmRepayment(loanId: string, request: RepaymentRequest, idempotencyKey: string) {
  return apiRequest({ method: 'POST', path: repaymentsPath(loanId), body: request, idempotencyKey, responseSchema: confirmedRepaymentSchema });
}

export function usePreviewRepaymentMutation(loanId: string) {
  return useMutation({ mutationFn: (request: RepaymentRequest) => previewRepaymentAllocation(loanId, request) });
}

interface ConfirmRepaymentVariables {
  readonly request: RepaymentRequest;
  readonly idempotencyKey: string;
}

/** After posting, the schedule and statement are refetched from the server — never patched from client guesses. */
export function useConfirmRepaymentMutation(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ request, idempotencyKey }: ConfirmRepaymentVariables) => confirmRepayment(loanId, request, idempotencyKey),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: termLoanKeys.detail(loanId) }),
        queryClient.invalidateQueries({ queryKey: statementKeys.forLoan(loanId) }),
      ]);
    },
  });
}
