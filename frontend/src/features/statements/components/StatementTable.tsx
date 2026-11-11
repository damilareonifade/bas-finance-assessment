import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { ACCOUNT_LABELS } from '@/features/ledger';
import type { StatementRow } from '../statementMath';

interface StatementTableProps {
  readonly rows: readonly StatementRow[];
}

const statementColumns: ReadonlyArray<DataTableColumn<StatementRow>> = [
  { key: 'date', header: 'Date', render: (row) => row.postedOn },
  { key: 'event', header: 'Event', render: (row) => row.event },
  { key: 'account', header: 'Account', render: (row) => ACCOUNT_LABELS[row.account] },
  { key: 'debit', header: 'Debit', align: 'right', render: (row) => (row.debitKobo > 0 ? <MoneyText kobo={row.debitKobo} /> : '—') },
  { key: 'credit', header: 'Credit', align: 'right', render: (row) => (row.creditKobo > 0 ? <MoneyText kobo={row.creditKobo} /> : '—') },
  { key: 'balance', header: 'Principal balance', align: 'right', render: (row) => <MoneyText kobo={row.runningPrincipalBalanceKobo} /> },
];

export function StatementTable({ rows }: StatementTableProps) {
  return (
    <DataTable
      caption="Borrower statement"
      columns={statementColumns}
      rows={rows}
      getRowKey={(row, index) => `${row.entryId}-${row.account}-${index}`}
      emptyMessage="No ledger activity for this loan yet."
    />
  );
}
