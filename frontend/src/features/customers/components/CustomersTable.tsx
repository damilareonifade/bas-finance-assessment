import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import type { CustomerSummary } from '../schemas/customer';

interface CustomersTableProps {
  readonly customers: readonly CustomerSummary[];
  readonly emptyMessage?: string;
  readonly emptyState?: ReactNode;
  readonly onOpen?: (customer: CustomerSummary) => void;
}

const customerColumns: ReadonlyArray<DataTableColumn<CustomerSummary>> = [
  {
    key: 'name',
    header: 'Customer',
    render: (customer) => (
      <Link className="font-medium text-brand hover:underline" to={`/customers/${customer.customerId}`}>
        {customer.fullName}
      </Link>
    ),
  },
  { key: 'contact', header: 'Contact', render: (customer) => customer.email ?? customer.phone ?? '—' },
  {
    key: 'officer',
    header: 'Loan officer',
    render: (customer) => (customer.assignedOfficer ? customer.assignedOfficer.fullName : <Badge tone="warning">Unassigned</Badge>),
  },
  { key: 'facilities', header: 'Loans / invoices', align: 'right', render: (customer) => `${customer.loanCount} / ${customer.invoiceCount}` },
  { key: 'outstanding', header: 'Outstanding principal', align: 'right', render: (customer) => <MoneyText kobo={customer.outstandingPrincipalKobo} /> },
  {
    key: 'overdue',
    header: 'Overdue',
    align: 'right',
    render: (customer) =>
      customer.overdueKobo > 0 ? (
        <span className="font-medium text-danger">
          <MoneyText kobo={customer.overdueKobo} />
        </span>
      ) : (
        '—'
      ),
  },
];

export function CustomersTable({ customers, emptyMessage = 'No customers match.', emptyState, onOpen }: CustomersTableProps) {
  return (
    <DataTable
      caption="Customers"
      columns={customerColumns}
      rows={customers}
      getRowKey={(customer) => customer.customerId}
      emptyMessage={emptyMessage}
      emptyState={emptyState}
      onRowClick={onOpen}
    />
  );
}
