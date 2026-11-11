import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { mapServerFieldErrors } from '@/lib/api';
import { cn } from '@/lib/utils/cn';
import { useSettledValue } from '@/lib/utils/useSettledValue';
import { usePortalApplyMutation, usePortalProductsQuery, usePortalQuoteQuery, type QuoteInput } from '../api/portalApi';
import { checkApplication, type PortalApplication } from '../schemas/portal';

function Submitted({ application }: { readonly application: PortalApplication }) {
  return (
    <Card>
      <EmptyState
        title="Application sent"
        description={`We received application ${application.applicationId}. Your loan officer will review it, and you will see the decision on your home page and in your notifications.`}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink to="/portal">Back to my loans</ButtonLink>
            <ButtonLink variant="secondary" to="/portal/documents">
              Check my documents
            </ButtonLink>
          </div>
        }
      />
    </Card>
  );
}

export default function PortalApplyPage() {
  const productsQuery = usePortalProductsQuery();
  const applyMutation = usePortalApplyMutation();
  const [productId, setProductId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [termInput, setTermInput] = useState('');
  const [purpose, setPurpose] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const product = productsQuery.data?.find((candidate) => candidate.productId === productId);
  const check = checkApplication(product, amountInput, termInput);
  const quoteInput: QuoteInput | null =
    product && check.principalKobo !== undefined && check.termMonths !== undefined ? { loanProductId: product.productId, principalKobo: check.principalKobo, termMonths: check.termMonths } : null;
  const settledQuoteInput = useSettledValue(quoteInput);
  const quoteQuery = usePortalQuoteQuery(settledQuoteInput && quoteInput && JSON.stringify(settledQuoteInput) === JSON.stringify(quoteInput) ? settledQuoteInput : null);

  const serverErrors = applyMutation.error
    ? Object.fromEntries(mapServerFieldErrors(applyMutation.error, { principalKobo: 'amount', termMonths: 'termMonths', loanProductId: 'loanProductId' }).mapped.map(({ field, message }) => [field, message]))
    : {};
  const errorFor = (field: 'loanProductId' | 'amount' | 'termMonths') => (showErrors ? check.errors[field] : undefined) ?? (serverErrors as Record<string, string | undefined>)[field];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (!quoteInput) return;
    applyMutation.mutate({ ...quoteInput, purpose: purpose.trim() || undefined });
  };

  if (applyMutation.isSuccess) return <Submitted application={applyMutation.data} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Apply for a loan" breadcrumbs={[{ label: 'My loans', to: '/portal' }, { label: 'Apply' }]} description="Choose a loan, tell us how much and for how long, and see your monthly payment before you apply." />
      {productsQuery.isPending ? <Skeleton className="h-48 w-full rounded-2xl" /> : null}
      {productsQuery.isError ? <QueryError error={productsQuery.error} onRetry={() => void productsQuery.refetch()} /> : null}
      {productsQuery.isSuccess && productsQuery.data.length === 0 ? (
        <Card>
          <EmptyState title="No loans are open for online applications right now" description="Please contact your loan officer." />
        </Card>
      ) : null}
      {productsQuery.isSuccess && productsQuery.data.length > 0 ? (
        <form noValidate onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-6">
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-medium text-ink">Which loan?</legend>
              {productsQuery.data.map((candidate) => (
                <label
                  key={candidate.productId}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-2xl border bg-surface p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand',
                    productId === candidate.productId ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-brand/50',
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <input type="radio" name="product" value={candidate.productId} checked={productId === candidate.productId} onChange={() => setProductId(candidate.productId)} className="accent-brand" />
                      {candidate.name}
                    </span>
                    <span className="text-sm font-semibold text-brand">{candidate.annualRatePercent}% a year</span>
                  </span>
                  <span className="pl-6 text-sm text-ink-muted">
                    <MoneyText kobo={candidate.minPrincipalKobo} /> to <MoneyText kobo={candidate.maxPrincipalKobo} />, {candidate.minTermMonths}–{candidate.maxTermMonths} months
                    {candidate.description ? ` · ${candidate.description}` : ''}
                  </span>
                </label>
              ))}
              {errorFor('loanProductId') ? <p role="alert" className="text-sm text-danger">{errorFor('loanProductId')}</p> : null}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="How much (₦)" inputMode="decimal" placeholder="e.g. 500000" isRequired value={amountInput} onChange={(event) => setAmountInput(event.target.value)} errorMessage={errorFor('amount')} />
              <TextField label="For how many months" inputMode="numeric" placeholder={product ? `${product.minTermMonths}–${product.maxTermMonths}` : 'e.g. 6'} isRequired value={termInput} onChange={(event) => setTermInput(event.target.value)} errorMessage={errorFor('termMonths')} />
            </div>
            <TextField label="What is the loan for?" hint="Optional — e.g. 'Stock for my shop'" maxLength={500} value={purpose} onChange={(event) => setPurpose(event.target.value)} />
            {applyMutation.error && Object.keys(serverErrors).length === 0 ? <Alert tone="danger">{applyMutation.error.message}</Alert> : null}
            <div className="flex gap-3">
              <Button type="submit" isLoading={applyMutation.isPending}>
                Send application
              </Button>
              <ButtonLink variant="secondary" to="/portal">
                Cancel
              </ButtonLink>
            </div>
          </div>

          <aside aria-live="polite">
            <Card className="lg:sticky lg:top-24">
              <CardHeader title="Your monthly payment" />
              {!quoteInput ? <p className="text-sm text-ink-muted">Choose a loan, an amount and a term to see what you would pay each month.</p> : null}
              {quoteInput && quoteQuery.isFetching && !quoteQuery.data ? <Skeleton className="h-24 w-full" /> : null}
              {quoteInput && quoteQuery.isError ? <p className="text-sm text-danger">{quoteQuery.error.message}</p> : null}
              {quoteInput && quoteQuery.data ? (
                <dl className="flex flex-col gap-3">
                  <div>
                    <dt className="text-xs text-ink-muted">Each month</dt>
                    <dd className="text-3xl font-semibold text-brand-strong"><MoneyText kobo={quoteQuery.data.instalmentKobo} /></dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-ink-muted">Total interest</dt>
                    <dd className="font-medium text-ink"><MoneyText kobo={quoteQuery.data.totalInterestKobo} /></dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-ink-muted">Rate</dt>
                    <dd className="font-medium text-ink">{quoteQuery.data.annualRatePercent}% a year</dd>
                  </div>
                  <p className="text-xs text-ink-muted">The last payment may differ by a few kobo so the balance ends at exactly zero. Final terms are confirmed when your loan is approved.</p>
                </dl>
              ) : null}
            </Card>
          </aside>
        </form>
      ) : null}
      <p className="text-sm text-ink-muted">
        We may ask for documents such as your BVN or a bank statement — you can send them from{' '}
        <Link to="/portal/documents" className="font-medium text-brand hover:underline">
          Documents
        </Link>
        .
      </p>
    </div>
  );
}
