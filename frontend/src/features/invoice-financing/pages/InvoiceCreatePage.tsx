import { useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { ApiErrorAlert } from '@/components/ui/ApiErrorAlert';
import { useToast } from '@/components/ui/Toast';
import { useCustomerDirectory } from '@/features/customers';
import type { PostedEntryState } from '@/features/ledger';
import { useLoanProductsQuery } from '@/features/loan-products';
import { createIdempotencyKey } from '@/lib/utils/idempotencyKey';
import { useLiveQuote } from '@/lib/utils/useLiveQuote';
import { useFinanceInvoiceMutation, useRequestInvoiceQuoteMutation } from '../api/invoiceApi';
import { INVOICE_FIELD_LABELS } from '../schemas/invoice';
import { InvoiceQuoteForm } from '../components/InvoiceQuoteForm';
import { InvoiceQuoteSummary } from '../components/InvoiceQuoteSummary';

/** Finance an invoice: quote → pay the advance → land on the invoice, ready to settle later. */
export default function InvoiceCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId') ?? '';
  const customerDirectory = useCustomerDirectory();
  const productsQuery = useLoanProductsQuery('ACTIVE');
  const productOptions = useMemo(
    () => (productsQuery.data ?? []).filter(({ product }) => product.type === 'INVOICE_FINANCING').map(({ product }) => ({ value: product.productId, label: product.name })),
    [productsQuery.data],
  );
  const quoteMutation = useRequestInvoiceQuoteMutation();
  const financeMutation = useFinanceInvoiceMutation();
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());
  const { reset: resetFinance } = financeMutation;
  // After the first "Get quote", every valid edit is re-quoted once typing pauses; `quoted` is exactly what gets posted.
  const { quoted, freshness, requestQuote, setDraft } = useLiveQuote(quoteMutation, {
    onQuoteRequested: resetFinance,
    onNewQuote: () => {
      idempotencyKeyRef.current = createIdempotencyKey(); // new inputs = new intent
    },
  });

  const handleFinance = useCallback(() => {
    if (!quoted || freshness !== 'current' || financeMutation.isPending || financeMutation.isSuccess) return;
    financeMutation.mutate(
      { request: quoted.request, idempotencyKey: idempotencyKeyRef.current },
      {
        onSuccess: ({ invoice, journalEntry }) => {
          toast.success('Advance paid', `${invoice.invoiceId} is financed.`);
          const state: PostedEntryState = { postedJournalEntry: journalEntry };
          navigate(`/invoices/${invoice.invoiceId}`, { state });
        },
      },
    );
  }, [quoted, freshness, financeMutation, toast, navigate]);

  const customerName = customerDirectory.nameOf(preselectedCustomerId || null);
  const backTo = preselectedCustomerId ? `/customers/${preselectedCustomerId}` : '/invoices';

  return (
    <>
      <PageHeader
        title="Finance an invoice"
        breadcrumbs={
          customerName
            ? [{ label: 'Customers', to: '/customers' }, { label: customerName, to: backTo }, { label: 'Finance an invoice' }]
            : [{ label: 'Invoices', to: '/invoices' }, { label: 'Create' }]
        }
        description="Get a quote, then pay the advance."
      />
      <div className="flex flex-col gap-6">
        <InvoiceQuoteForm
          isSubmitting={quoteMutation.isPending}
          serverError={financeMutation.error ?? quoteMutation.error}
          onQuoteRequested={requestQuote}
          onDraftChange={setDraft}
          customerOptions={customerDirectory.options}
          productOptions={productOptions}
          defaultCustomerId={preselectedCustomerId}
          cancelTo={backTo}
        />
        {quoteMutation.error && quoteMutation.error.name !== 'ApiValidationError' ? <Alert tone="danger" title="Could not get a quote">{quoteMutation.error.message}</Alert> : null}
        {quoted ? (
          <InvoiceQuoteSummary
            request={quoted.request}
            quote={quoted.quote}
            freshness={freshness}
            isFinancing={financeMutation.isPending}
            isFinanced={financeMutation.isSuccess}
            onFinance={handleFinance}
          />
        ) : null}
        {financeMutation.error ? <ApiErrorAlert title="Advance was not paid" error={financeMutation.error} fieldLabels={INVOICE_FIELD_LABELS} /> : null}
      </div>
    </>
  );
}
