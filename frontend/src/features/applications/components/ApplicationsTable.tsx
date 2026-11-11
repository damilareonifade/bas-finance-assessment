import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import type { LoanApplication } from '../schemas/application';
import { ApplicationStatusChip } from './ApplicationStatusChip';

interface ApplicationsTableProps {
  readonly applications: readonly LoanApplication[];
  readonly onOpen: (application: LoanApplication) => void;
  readonly emptyState: ReactNode;
  /** Hide the applicant column when the table already sits on that applicant's profile. */
  readonly showApplicant?: boolean;
}

export function ApplicationsTable({ applications, onOpen, emptyState, showApplicant = true }: ApplicationsTableProps) {
  const columns: ReadonlyArray<DataTableColumn<LoanApplication>> = [
    {
      key: 'id',
      header: 'Application',
      render: (application) => (
        <Link className="font-medium text-brand hover:underline" to={`/applications/${application.applicationId}`}>
          {application.applicationId}
        </Link>
      ),
    },
    ...(showApplicant
      ? [
          {
            key: 'applicant',
            header: 'Applicant',
            render: (application: LoanApplication) => (
              <Link className="text-ink hover:text-brand hover:underline" to={`/customers/${application.customer.customerId}`}>
                {application.customer.fullName}
              </Link>
            ),
          },
        ]
      : []),
    { key: 'amount', header: 'Amount', align: 'right', render: (application) => <span className="font-medium"><MoneyText kobo={application.principalKobo} /></span> },
    { key: 'terms', header: 'Rate / term', align: 'right', render: (application) => `${application.annualRatePercent}% · ${application.termMonths} mo` },
    { key: 'officer', header: 'Loan officer', render: (application) => application.assignedOfficer?.fullName ?? <span className="text-ink-muted">Unassigned</span> },
    { key: 'submitted', header: 'Submitted', render: (application) => application.submittedAt.slice(0, 10) },
    { key: 'decided', header: 'Decided by', render: (application) => application.decidedBy?.fullName ?? '—' },
    { key: 'status', header: 'Status', render: (application) => <ApplicationStatusChip status={application.status} /> },
  ];
  return <DataTable caption="Loan applications" columns={columns} rows={applications} getRowKey={(application) => application.applicationId} onRowClick={onOpen} emptyState={emptyState} />;
}
