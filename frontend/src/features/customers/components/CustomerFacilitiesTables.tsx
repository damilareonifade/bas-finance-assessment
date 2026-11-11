import { Link, useNavigate } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import type { CustomerInvoiceLine, CustomerLoanLine } from '../schemas/customer';

const loanColumns: ReadonlyArray<DataTableColumn<CustomerLoanLine>> = [
  { key: 'loan', header: 'Loan', render: (loan) => <Link className="font-medium text-brand hover:underline" to={`/loans/${loan.loanId}`}>{loan.loanId}</Link> },
  { key: 'product', header: 'Product', render: (loan) => loan.productName ?? '—' },
  { key: 'disbursed', header: 'Disbursed', render: (loan) => loan.disbursedOn },
  { key: 'principal', header: 'Principal', align: 'right', render: (loan) => <MoneyText kobo={loan.principalKobo} /> },
  { key: 'outstanding', header: 'Outstanding', align: 'right', render: (loan) => <MoneyText kobo={loan.outstandingPrincipalKobo} /> },
  { key: 'overdue', header: 'Overdue', align: 'right', render: (loan) => (loan.overdueKobo > 0 ? <span className="text-danger"><MoneyText kobo={loan.overdueKobo} /></span> : '—') },
];

const invoiceColumns: ReadonlyArray<DataTableColumn<CustomerInvoiceLine>> = [
  {
    key: 'invoice',
    header: 'Invoice',
    render: (invoice) => <Link className="font-medium text-brand hover:underline" to={`/invoices/${invoice.invoiceId}`}>{invoice.invoiceId}</Link>,
  },
  { key: 'product', header: 'Product', render: (invoice) => invoice.productName ?? '—' },
  { key: 'due', header: 'Due', render: (invoice) => invoice.dueDate },
  { key: 'face', header: 'Face value', align: 'right', render: (invoice) => <MoneyText kobo={invoice.faceValueKobo} /> },
  { key: 'advance', header: 'Advance', align: 'right', render: (invoice) => <MoneyText kobo={invoice.advanceKobo} /> },
  {
    key: 'status',
    header: 'Status',
    render: (invoice) => (invoice.status === 'SETTLED' ? <Badge tone="success">Settled</Badge> : <Badge tone={invoice.isOverdue ? 'danger' : 'neutral'}>{invoice.isOverdue ? 'Overdue' : 'Advanced'}</Badge>),
  },
];

interface CustomerFacilitiesTablesProps {
  readonly loans: readonly CustomerLoanLine[];
  readonly invoices: readonly CustomerInvoiceLine[];
  readonly customerId: string;
}

export function CustomerFacilitiesTables({ loans, invoices, customerId }: CustomerFacilitiesTablesProps) {
  const navigate = useNavigate();
  const forCustomer = `customerId=${encodeURIComponent(customerId)}`;
  return (
    <>
      <Card>
        <CardHeader title="Term loans" />
        <DataTable
          caption="Customer term loans"
          columns={loanColumns}
          rows={loans}
          getRowKey={(loan) => loan.loanId}
          onRowClick={(loan) => navigate(`/loans/${loan.loanId}`)}
          emptyState={<EmptyState title="No term loans yet" action={<ButtonLink variant="secondary" to={`/loans/create?${forCustomer}`}>New loan</ButtonLink>} />}
        />
      </Card>
      <Card>
        <CardHeader title="Invoice financing" />
        <DataTable
          caption="Customer invoices"
          columns={invoiceColumns}
          rows={invoices}
          getRowKey={(invoice) => invoice.invoiceId}
          onRowClick={(invoice) => navigate(`/invoices/${invoice.invoiceId}`)}
          emptyState={<EmptyState title="No financed invoices yet" action={<ButtonLink variant="secondary" to={`/invoices/create?${forCustomer}`}>Finance an invoice</ButtonLink>} />}
        />
      </Card>
    </>
  );
}
