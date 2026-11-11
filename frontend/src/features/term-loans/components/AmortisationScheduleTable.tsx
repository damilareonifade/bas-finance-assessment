import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { Badge } from '@/components/ui/Badge';
import type { LoanInstalment, TermLoanQuote } from '../schemas/termLoan';

type ScheduleRow = TermLoanQuote['schedule'][number] & Partial<Pick<LoanInstalment, 'dueDate' | 'status'>>;

interface AmortisationScheduleTableProps {
  readonly schedule: readonly ScheduleRow[];
}

const STATUS_TONE = { PAID: 'success', PARTIALLY_PAID: 'warning', UNPAID: 'neutral' } as const;
const STATUS_LABEL = { PAID: 'Paid', PARTIALLY_PAID: 'Part paid', UNPAID: 'Unpaid' } as const;

export function AmortisationScheduleTable({ schedule }: AmortisationScheduleTableProps) {
  const hasLoanDetails = schedule.some((row) => row.dueDate !== undefined);

  const columns: ReadonlyArray<DataTableColumn<ScheduleRow>> = [
    { key: 'number', header: '#', render: (row) => row.instalmentNumber },
    ...(hasLoanDetails ? [{ key: 'due', header: 'Due date', render: (row: ScheduleRow) => row.dueDate ?? '—' }] : []),
    { key: 'payment', header: 'Payment', align: 'right', render: (row) => <MoneyText kobo={row.paymentKobo} /> },
    { key: 'interest', header: 'Interest', align: 'right', render: (row) => <MoneyText kobo={row.interestKobo} /> },
    { key: 'principal', header: 'Principal', align: 'right', render: (row) => <MoneyText kobo={row.principalKobo} /> },
    { key: 'balance', header: 'Closing balance', align: 'right', render: (row) => <MoneyText kobo={row.closingBalanceKobo} /> },
    ...(hasLoanDetails
      ? [{ key: 'status', header: 'Status', render: (row: ScheduleRow) => (row.status ? <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge> : null) }]
      : []),
  ];

  return <DataTable caption="Amortisation schedule" columns={columns} rows={schedule} getRowKey={(row) => String(row.instalmentNumber)} />;
}
