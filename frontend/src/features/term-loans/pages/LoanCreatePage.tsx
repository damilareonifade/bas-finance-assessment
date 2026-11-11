import { useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ApiErrorAlert } from '@/components/ui/ApiErrorAlert';
import { useToast } from '@/components/ui/Toast';
import { useCustomerDirectory } from '@/features/customers';
import type { PostedEntryState } from '@/features/ledger';
import { useLoanProductsQuery } from '@/features/loan-products';
import { createIdempotencyKey } from '@/lib/utils/idempotencyKey';
import { useLiveQuote } from '@/lib/utils/useLiveQuote';
import { useOriginateTermLoanMutation, useRequestTermLoanQuoteMutation } from '../api/useTermLoanQueries';
import { QuoteSummary } from '../components/QuoteSummary';
import { TermLoanQuoteForm } from '../components/TermLoanQuoteForm';
import { TERM_LOAN_FIELD_LABELS } from '../schemas/termLoan';

/** Create a loan: quote → approve and disburse → land on the new loan with its posted journal entry. */
export default function LoanCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId') ?? '';
  const customerDirectory = useCustomerDirectory();
  const productsQuery = useLoanProductsQuery('ACTIVE');
  const productOptions = useMemo(
    () => (productsQuery.data ?? []).filter(({ product }) => product.type === 'TERM_LOAN').map(({ product }) => ({ value: product.productId, label: product.name })),
    [productsQuery.data],
  );
  const quoteMutation = useRequestTermLoanQuoteMutation();
  const originateMutation = useOriginateTermLoanMutation();
  // One idempotency key per quote: a double click or a retry re-sends the same key and cannot disburse twice.
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());
  const { reset: resetOriginate } = originateMutation;
  // After the first "Get quote", every valid edit is re-quoted once typing pauses; `quoted` is exactly what gets disbursed.
  const { quoted, freshness, requestQuote, setDraft } = useLiveQuote(quoteMutation, {
    onQuoteRequested: resetOriginate,
    onNewQuote: () => {
      idempotencyKeyRef.current = createIdempotencyKey(); // new terms = new intent
    },
  });

  const handleApproveAndDisburse = useCallback(() => {
    if (!quoted || freshness !== 'current' || originateMutation.isPending || originateMutation.isSuccess) return;
    originateMutation.mutate(
      { request: quoted.request, idempotencyKey: idempotencyKeyRef.current },
      {
        onSuccess: ({ loan, journalEntry }) => {
          toast.success('Loan disbursed', `${loan.loanId} — the disbursement entry is posted.`);
          const state: PostedEntryState = { postedJournalEntry: journalEntry };
          navigate(`/loans/${loan.loanId}`, { state });
        },
      },
    );
  }, [quoted, freshness, originateMutation, toast, navigate]);

  const customerName = customerDirectory.nameOf(preselectedCustomerId || null);
  const backTo = preselectedCustomerId ? `/customers/${preselectedCustomerId}` : '/loans';

  return (
    <>
      <PageHeader
        title="New term loan"
        breadcrumbs={
          customerName
            ? [{ label: 'Customers', to: '/customers' }, { label: customerName, to: backTo }, { label: 'New loan' }]
            : [{ label: 'Loans', to: '/loans' }, { label: 'Create' }]
        }
        description="Get a quote, check the schedule, then approve and disburse."
      />
      <div className="flex flex-col gap-6">
        <TermLoanQuoteForm
          isSubmitting={quoteMutation.isPending}
          serverError={originateMutation.error ?? quoteMutation.error}
          onQuoteRequested={requestQuote}
          onDraftChange={setDraft}
          customerOptions={customerDirectory.options}
          productOptions={productOptions}
          defaultCustomerId={preselectedCustomerId}
          cancelTo={backTo}
        />

        {quoteMutation.error && quoteMutation.error.name !== 'ApiValidationError' ? (
          <ApiErrorAlert title="Could not get a quote" error={quoteMutation.error} fieldLabels={TERM_LOAN_FIELD_LABELS} />
        ) : null}

        {quoted ? (
          <QuoteSummary
            request={quoted.request}
            quote={quoted.quote}
            freshness={freshness}
            isDisbursing={originateMutation.isPending}
            isDisbursed={originateMutation.isSuccess}
            onApproveAndDisburse={handleApproveAndDisburse}
          />
        ) : null}

        {originateMutation.error ? <ApiErrorAlert title="The loan was not disbursed" error={originateMutation.error} fieldLabels={TERM_LOAN_FIELD_LABELS} /> : null}
      </div>
    </>
  );
}
