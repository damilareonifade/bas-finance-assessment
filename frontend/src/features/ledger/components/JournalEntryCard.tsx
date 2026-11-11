import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { Badge } from '@/components/ui/Badge';
import { addKobo, ZERO_KOBO } from '@/lib/money';
import { ACCOUNT_LABELS, type JournalEntry, type JournalLine } from '../schemas/ledger';

interface JournalEntryCardProps {
  readonly journalEntry: JournalEntry;
  readonly title?: string;
}

const journalLineColumns: ReadonlyArray<DataTableColumn<JournalLine>> = [
  { key: 'account', header: 'Account', render: (line) => ACCOUNT_LABELS[line.account] },
  { key: 'debit', header: 'Debit', align: 'right', render: (line) => (line.debitKobo > 0 ? <MoneyText kobo={line.debitKobo} /> : '—') },
  { key: 'credit', header: 'Credit', align: 'right', render: (line) => (line.creditKobo > 0 ? <MoneyText kobo={line.creditKobo} /> : '—') },
];

export function JournalEntryCard({ journalEntry, title = 'Posted journal entry' }: JournalEntryCardProps) {
  const totalDebitsKobo = journalEntry.lines.reduce((total, line) => addKobo(total, line.debitKobo), ZERO_KOBO);
  const totalCreditsKobo = journalEntry.lines.reduce((total, line) => addKobo(total, line.creditKobo), ZERO_KOBO);
  const isBalanced = totalDebitsKobo === totalCreditsKobo;

  return (
    <Card>
      <CardHeader
        title={title}
        description={`${journalEntry.event} · ${journalEntry.postedOn} · ${journalEntry.entryId}`}
        action={<Badge tone={isBalanced ? 'success' : 'danger'}>{isBalanced ? 'Balanced' : 'Out of balance'}</Badge>}
      />
      <DataTable
        caption="Journal lines"
        columns={journalLineColumns}
        rows={journalEntry.lines}
        getRowKey={(line, index) => `${line.account}-${index}`}
        footer={
          <tr className="font-semibold">
            <th scope="row" className="px-3 py-2 text-left">Total</th>
            <td className="px-3 py-2 text-right tabular-nums"><MoneyText kobo={totalDebitsKobo} /></td>
            <td className="px-3 py-2 text-right tabular-nums"><MoneyText kobo={totalCreditsKobo} /></td>
          </tr>
        }
      />
    </Card>
  );
}
