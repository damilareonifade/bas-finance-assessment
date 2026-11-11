import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CloseIcon } from '@/components/ui/icons';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { SelectField } from '@/components/ui/SelectField';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { TextField } from '@/components/ui/TextField';
import { useLoanProductsQuery } from '@/features/loan-products';
import { initialsOf } from '@/lib/utils/initials';
import { useLedgerQuery } from '../api/ledgerBookApi';
import { LedgerCustomerSearch } from '../components/LedgerCustomerSearch';
import { LedgerAccountsCard, LedgerLinesCard, LedgerProductsCard } from '../components/LedgerTables';
import type { LedgerFilter, LedgerView } from '../schemas/ledgerBook';

const FILTER_KEYS = ['customerId', 'loanProductId', 'from', 'to'] as const;

function SelectedCustomer({ customer, onClear }: { readonly customer: NonNullable<LedgerView['customer']>; readonly onClear: () => void }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-base font-semibold text-surface">
            {initialsOf(customer.fullName)}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">{customer.fullName}</h2>
            <p className="text-sm text-ink-muted">
              {[customer.customerId, customer.email, customer.phone, customer.assignedOfficer ? `Officer: ${customer.assignedOfficer.fullName}` : 'No officer'].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink variant="secondary" to={`/customers/${encodeURIComponent(customer.customerId)}`}>
            Open profile
          </ButtonLink>
          <Button variant="secondary" onClick={onClear}>
            <CloseIcon size={16} />
            Whole book
          </Button>
        </div>
      </div>
    </Card>
  );
}

function LedgerFigures({ view }: { readonly view: LedgerView }) {
  const { totals, position } = view;
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total debits" value={<MoneyText kobo={totals.debitKobo} />} hint={`${totals.entryCount} entr${totals.entryCount === 1 ? 'y' : 'ies'} · ${totals.lineCount} lines`} />
        <StatCard label="Total credits" value={<MoneyText kobo={totals.creditKobo} />} />
        <StatCard
          label="Double entry"
          value={totals.isBalanced ? 'Balanced' : 'Out of balance'}
          tone={totals.isBalanced ? 'success' : 'danger'}
          hint={totals.isBalanced ? 'Debits equal credits' : 'Debits and credits differ — investigate'}
        />
      </dl>
      {position ? (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Owed by the customer" value={<MoneyText kobo={position.owedByCustomerKobo} />} hint="Loan principal, invoice advances and shortfalls" />
          <StatCard label="Held for the customer" value={<MoneyText kobo={position.owedToCustomerKobo} />} hint="Unapplied credit and client payable" />
          <StatCard label="Income earned" value={<MoneyText kobo={position.incomeEarnedKobo} />} hint="Interest, fees and penalties collected" tone="success" />
          <StatCard
            label="Net cash"
            value={<MoneyText kobo={position.netCashKobo} />}
            hint={position.netCashKobo < 0 ? 'More paid out to them than received' : 'Received from them, less paid out'}
          />
        </dl>
      ) : null}
    </div>
  );
}

/**
 * Admin ledger: search a customer and see every debit and credit attributed to them, or look at the whole book.
 * Narrow by loan product and period; all filters live in the URL.
 */
export default function LedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter: LedgerFilter = useMemo(
    () => Object.fromEntries(FILTER_KEYS.flatMap((key) => (searchParams.get(key) ? [[key, searchParams.get(key)]] : []))) as LedgerFilter,
    [searchParams],
  );
  const ledgerQuery = useLedgerQuery(filter);
  const productsQuery = useLoanProductsQuery();
  const productOptions = (productsQuery.data ?? []).map(({ product }) => ({ value: product.productId, label: `${product.name}${product.status === 'ARCHIVED' ? ' (archived)' : ''}` }));
  const view = ledgerQuery.data;

  const setFilter = (key: (typeof FILTER_KEYS)[number], value: string | null) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ledger"
        description="Every debit and credit, by customer and loan product. Search a customer by name, ID, email or phone — or paste a loan, invoice or journal entry ID."
      />

      <Card>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <LedgerCustomerSearch onSelect={(result) => setFilter('customerId', result.customerId)} />
          <SelectField
            label="Loan product"
            options={productOptions}
            placeholder="All products"
            value={filter.loanProductId ?? ''}
            onChange={(event) => setFilter('loanProductId', event.target.value || null)}
          />
          <TextField label="From" type="date" value={filter.from ?? ''} onChange={(event) => setFilter('from', event.target.value || null)} />
          <TextField label="To" type="date" value={filter.to ?? ''} onChange={(event) => setFilter('to', event.target.value || null)} />
        </div>
        {filter.loanProductId || filter.from || filter.to ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            Showing
            {view?.product ? <Badge>{view.product.name}</Badge> : null}
            {filter.from || filter.to ? <Badge>{`${filter.from ?? 'the start'} → ${filter.to ?? 'today'}`}</Badge> : null}
            <button
              type="button"
              className="font-medium text-brand hover:underline"
              onClick={() =>
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  ['loanProductId', 'from', 'to'].forEach((key) => next.delete(key));
                  return next;
                })
              }
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </Card>

      {ledgerQuery.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : null}
      {ledgerQuery.isError ? <QueryError error={ledgerQuery.error} onRetry={() => void ledgerQuery.refetch()} /> : null}

      {view ? (
        <div className={ledgerQuery.isFetching ? 'flex flex-col gap-6 opacity-70 transition-opacity' : 'flex flex-col gap-6 transition-opacity'}>
          {view.customer ? (
            <SelectedCustomer customer={view.customer} onClear={() => setFilter('customerId', null)} />
          ) : (
            <p className="text-sm text-ink-muted">
              Showing the <span className="font-medium text-ink">whole book</span>{view.product ? ` for ${view.product.name}` : ''}. Search for a customer to see only their postings.
            </p>
          )}
          <LedgerFigures view={view} />
          <div className="grid gap-6 xl:grid-cols-2">
            <LedgerAccountsCard accounts={view.accounts} />
            <LedgerProductsCard products={view.products} />
          </div>
          <LedgerLinesCard key={JSON.stringify(filter)} lines={view.lines} showCustomer={view.customer === null} truncated={view.truncated} />
        </div>
      ) : null}
    </div>
  );
}
