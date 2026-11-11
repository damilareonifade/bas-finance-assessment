import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import type { CollectionRow } from '../schemas/collections';

interface CollectionsTableProps {
  readonly rows: readonly CollectionRow[];
  readonly showOfficer: boolean;
}

export function CollectionsTable({ rows, showOfficer }: CollectionsTableProps) {
  const columns: ReadonlyArray<DataTableColumn<CollectionRow>> = [
    { key: 'name', header: 'Customer', render: (row) => <Link className="text-brand underline" to={`/customers/${row.customerId}`}>{row.fullName}</Link> },
    { key: 'contact', header: 'Call / email', render: (row) => row.phone ?? row.email ?? '—' },
    ...(showOfficer ? [{ key: 'officer', header: 'Officer', render: (row: CollectionRow) => row.assignedOfficer?.fullName ?? '—' }] : []),
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.needsFollowUp ? <Badge tone="danger">Chase now</Badge> : <Badge tone="success">Up to date</Badge>,
    },
    { key: 'overdue', header: 'Overdue', align: 'right', render: (row) => (row.overdueKobo > 0 ? <span className="font-semibold text-danger"><MoneyText kobo={row.overdueKobo} /></span> : '—') },
    { key: 'instalments', header: 'Missed instalments', align: 'right', render: (row) => (row.overdueInstalments > 0 ? row.overdueInstalments : '—') },
    { key: 'days', header: 'Oldest overdue', align: 'right', render: (row) => (row.oldestOverdueDays > 0 ? `${row.oldestOverdueDays} days` : '—') },
    { key: 'next', header: 'Next due', render: (row) => row.nextDueDate ?? '—' },
    { key: 'outstanding', header: 'Outstanding principal', align: 'right', render: (row) => <MoneyText kobo={row.outstandingPrincipalKobo} /> },
  ];
  return <DataTable caption="Collections portfolio" columns={columns} rows={rows} getRowKey={(row) => row.customerId} emptyMessage="No customers are assigned yet." />;
}
