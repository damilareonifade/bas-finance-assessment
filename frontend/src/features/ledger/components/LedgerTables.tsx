import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { addKobo, ZERO_KOBO } from '@/lib/money';
import { cn } from '@/lib/utils/cn';
import { ACCOUNT_LABELS, type AccountCode } from '../schemas/ledger';
import { ACCOUNT_TYPE_LABELS, type LedgerAccountSummary, type LedgerLine, type LedgerProductSummary } from '../schemas/ledgerBook';

const ACCOUNT_COLUMNS: ReadonlyArray<DataTableColumn<LedgerAccountSummary>> = [
  { key: 'account', header: 'Account', render: (row) => <span className="font-medium text-ink">{ACCOUNT_LABELS[row.account]}</span> },
  { key: 'type', header: 'Type', render: (row) => <span className="text-ink-muted">{ACCOUNT_TYPE_LABELS[row.type]}</span> },
  { key: 'debit', header: 'Debits', align: 'right', render: (row) => <MoneyText kobo={row.debitKobo} /> },
  { key: 'credit', header: 'Credits', align: 'right', render: (row) => <MoneyText kobo={row.creditKobo} /> },
  {
    key: 'balance',
    header: 'Balance',
    align: 'right',
    render: (row) => (
      <span className={cn('font-semibold', row.balanceKobo < 0 ? 'text-danger' : 'text-ink')}>
        <MoneyText kobo={row.balanceKobo} />
        <span className="ml-1 text-xs font-normal text-ink-muted">{row.type === 'ASSET' ? 'Dr' : 'Cr'}</span>
      </span>
    ),
  },
];

interface LedgerAccountsCardProps {
  readonly accounts: readonly LedgerAccountSummary[];
}

/** Trial balance for the scope: each account's debits, credits and balance on its normal side. */
export function LedgerAccountsCard({ accounts }: LedgerAccountsCardProps) {
  return (
    <Card>
      <CardHeader title="Balances by account" description="Assets are shown as debit balances (Dr); income and liabilities as credit balances (Cr)." />
      <DataTable caption="Balances by account" columns={ACCOUNT_COLUMNS} rows={accounts} getRowKey={(row) => row.account} emptyMessage="No postings in this view." />
    </Card>
  );
}

const PRODUCT_COLUMNS: ReadonlyArray<DataTableColumn<LedgerProductSummary>> = [
  {
    key: 'product',
    header: 'Loan product',
    render: (row) =>
      row.product ? (
        <Link to={`/products/${row.product.productId}`} className="font-medium text-brand hover:underline">
          {row.product.name}
        </Link>
      ) : (
        <span className="text-ink-muted">No product</span>
      ),
  },
  { key: 'entries', header: 'Entries', align: 'right', render: (row) => row.entryCount },
  { key: 'debit', header: 'Debits', align: 'right', render: (row) => <MoneyText kobo={row.debitKobo} /> },
  { key: 'credit', header: 'Credits', align: 'right', render: (row) => <MoneyText kobo={row.creditKobo} /> },
];

interface LedgerProductsCardProps {
  readonly products: readonly LedgerProductSummary[];
}

/** Each product's share of the postings in scope (an entry belongs to the product of its loan or invoice). */
export function LedgerProductsCard({ products }: LedgerProductsCardProps) {
  return (
    <Card>
      <CardHeader title="By loan product" description="Every entry belongs to the product of the loan or invoice it was posted for." />
      <DataTable caption="Postings by loan product" columns={PRODUCT_COLUMNS} rows={products} getRowKey={(row) => row.product?.productId ?? 'none'} emptyMessage="No postings in this view." />
    </Card>
  );
}

interface LedgerLinesCardProps {
  readonly lines: readonly LedgerLine[];
  /** Show who each line belongs to (whole-book view). */
  readonly showCustomer: boolean;
  readonly truncated: boolean;
}

/** Every debit and credit in scope, newest first, narrowed by account with the chips. Totals follow what is shown. */
export function LedgerLinesCard({ lines, showCustomer, truncated }: LedgerLinesCardProps) {
  const [account, setAccount] = useState<AccountCode | 'ALL'>('ALL');
  const accountsInView = useMemo(() => [...new Set(lines.map((line) => line.account))], [lines]);
  const selectedAccount = account !== 'ALL' && accountsInView.includes(account) ? account : 'ALL';
  const visible = useMemo(() => [...(selectedAccount === 'ALL' ? lines : lines.filter((line) => line.account === selectedAccount))].reverse(), [lines, selectedAccount]);
  const debitTotal = addKobo(ZERO_KOBO, ...visible.map((line) => line.debitKobo));
  const creditTotal = addKobo(ZERO_KOBO, ...visible.map((line) => line.creditKobo));

  const columns: Array<DataTableColumn<LedgerLine>> = [
    { key: 'date', header: 'Date', render: (line) => <span className="whitespace-nowrap tabular-nums">{line.postedOn}</span> },
    {
      key: 'entry',
      header: 'Entry',
      render: (line) => (
        <span className="whitespace-nowrap">
          <span className="font-medium text-ink">{line.entryId}</span>
          <span className="block text-xs text-ink-muted">{line.reversesEntryId ? `${line.event} · reverses ${line.reversesEntryId}` : line.event}</span>
        </span>
      ),
    },
    ...(showCustomer
      ? [
          {
            key: 'customer',
            header: 'Customer',
            render: (line: LedgerLine) =>
              line.customer ? (
                <Link to={`/ledger?customerId=${encodeURIComponent(line.customer.customerId)}`} className="text-brand hover:underline">
                  {line.customer.fullName}
                </Link>
              ) : (
                <span className="text-ink-muted">—</span>
              ),
          },
        ]
      : []),
    {
      key: 'reference',
      header: 'Loan / invoice',
      render: (line) =>
        line.facility ? (
          <Link to={line.facility.kind === 'LOAN' ? `/loans/${line.facility.id}` : `/invoices/${line.facility.id}`} className="whitespace-nowrap text-brand hover:underline">
            {line.facility.id}
          </Link>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    { key: 'product', header: 'Product', render: (line) => line.product?.name ?? <span className="text-ink-muted">—</span> },
    { key: 'account', header: 'Account', render: (line) => ACCOUNT_LABELS[line.account] },
    { key: 'debit', header: 'Debit', align: 'right', render: (line) => (line.debitKobo > 0 ? <MoneyText kobo={line.debitKobo} /> : '') },
    { key: 'credit', header: 'Credit', align: 'right', render: (line) => (line.creditKobo > 0 ? <MoneyText kobo={line.creditKobo} /> : '') },
  ];

  return (
    <Card>
      <CardHeader
        title="Debits and credits"
        description={truncated ? 'Showing the most recent 2,000 lines; the totals above cover everything in this view.' : 'Newest first. Pick an account to narrow the lines.'}
      />
      {accountsInView.length > 1 ? (
        <div role="group" aria-label="Filter by account" className="mb-4 flex flex-wrap gap-2">
          {(['ALL', ...accountsInView] as const).map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={selectedAccount === code}
              onClick={() => setAccount(code)}
              className={cn(
                'rounded-md border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand',
                selectedAccount === code ? 'border-brand bg-brand text-surface' : 'border-line bg-surface text-ink hover:border-brand',
              )}
            >
              {code === 'ALL' ? 'All accounts' : ACCOUNT_LABELS[code]}
            </button>
          ))}
        </div>
      ) : null}
      <DataTable
        caption="Ledger lines"
        columns={columns}
        rows={visible}
        getRowKey={(line, index) => `${line.entryId}-${line.account}-${index}`}
        emptyMessage="No debits or credits in this view."
        footer={
          visible.length > 0 ? (
            <tr className="border-t-2 border-line font-semibold text-ink">
              <td colSpan={columns.length - 2} className="px-3 py-2">
                Total ({visible.length} line{visible.length === 1 ? '' : 's'})
              </td>
              <td className="px-3 py-2 text-right">
                <MoneyText kobo={debitTotal} />
              </td>
              <td className="px-3 py-2 text-right">
                <MoneyText kobo={creditTotal} />
              </td>
            </tr>
          ) : null
        }
      />
    </Card>
  );
}
