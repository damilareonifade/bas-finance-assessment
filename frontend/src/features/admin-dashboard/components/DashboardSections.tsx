import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, type ChartSeries } from '@/components/charts/AreaChart';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { ShieldCheckIcon } from '@/components/ui/icons';
import { MetricCard } from '@/components/ui/MetricCard';
import { MoneyText } from '@/components/ui/MoneyText';
import { SelectField } from '@/components/ui/SelectField';
import { StatusChip } from '@/components/ui/StatusChip';
import { asKobo, formatKobo, formatKoboCompact } from '@/lib/money';
import type { Dashboard } from '../schemas/dashboard';
import { DashboardCard } from './DashboardCard';

interface DashboardProps {
  readonly dashboard: Dashboard;
}

const COMPARED_WITH = 'vs same days last month';

/** Five KPI cards: label + change pill, figure, one line of context. */
export function KpiCards({ dashboard }: DashboardProps) {
  const { monthToDate, customers, loans } = dashboard;
  return (
    <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <MetricCard
        label="Customers"
        value={customers.total.toLocaleString('en-NG')}
        trend={{ changePercent: monthToDate.newCustomers.changePercent, comparedWith: COMPARED_WITH, increaseIsGood: true, emptyText: 'No new customers last month' }}
        caption={`${monthToDate.newCustomers.current} new this month`}
      />
      <MetricCard
        label="Disbursed this month"
        value={formatKoboCompact(monthToDate.disbursed.current)}
        trend={{ changePercent: monthToDate.disbursed.changePercent, comparedWith: COMPARED_WITH, increaseIsGood: true }}
        caption={<MoneyText kobo={monthToDate.disbursed.current} />}
      />
      <MetricCard
        label="Repayments this month"
        value={formatKoboCompact(monthToDate.collected.current)}
        trend={{ changePercent: monthToDate.collected.changePercent, comparedWith: COMPARED_WITH, increaseIsGood: true }}
        caption={<MoneyText kobo={monthToDate.collected.current} />}
      />
      <MetricCard label="Outstanding principal" value={formatKoboCompact(loans.outstandingPrincipalKobo)} caption={`${loans.count} term loans`} />
      <MetricCard
        label="Overdue"
        value={formatKoboCompact(loans.overdueKobo)}
        valueTone={loans.overdueKobo > 0 ? 'danger' : 'neutral'}
        caption={loans.overdueLoanCount > 0 ? `${loans.overdueLoanCount} loans past due` : 'Nothing past due'}
        captionTone={loans.overdueLoanCount > 0 ? 'danger' : 'success'}
      />
    </dl>
  );
}

type ChartView = 'cash' | 'invoices' | 'customers';

const CHART_VIEWS: ReadonlyArray<{ value: ChartView; label: string }> = [
  { value: 'cash', label: 'Disbursed and collected' },
  { value: 'invoices', label: 'Invoice advances' },
  { value: 'customers', label: 'New customers' },
];

export function TrendChartCard({ dashboard }: DashboardProps) {
  const [view, setView] = useState<ChartView>('cash');
  const { trends } = dashboard;
  const series: readonly ChartSeries[] =
    view === 'cash'
      ? [
          { label: 'Disbursed', values: trends.disbursedKobo, color: 'blue' },
          { label: 'Collected', values: trends.collectedKobo, color: 'green' },
        ]
      : view === 'invoices'
        ? [{ label: 'Invoice advances', values: trends.invoiceAdvancesKobo, color: 'amber' }]
        : [{ label: 'New customers', values: trends.newCustomers, color: 'blue' }];
  const isMoney = view !== 'customers';
  const description = CHART_VIEWS.find((option) => option.value === view)?.label ?? '';

  return (
    <DashboardCard
      title="Activity, last 30 days"
      action={
        <div className="w-48">
          <SelectField label="Show" hideLabel options={CHART_VIEWS} value={view} onChange={(event) => setView(event.target.value as ChartView)} className="py-1.5 text-xs" />
        </div>
      }
    >
      <AreaChart
        days={trends.days}
        series={series}
        caption={`${description} for each of the last 30 days`}
        formatAxis={(value) => (isMoney ? formatKoboCompact(asKobo(Math.round(value))) : String(Math.round(value)))}
        formatValue={(value) => (isMoney ? formatKobo(asKobo(Math.round(value))) : String(value))}
      />
    </DashboardCard>
  );
}

export function LedgerSummary({ dashboard }: DashboardProps) {
  const { ledger } = dashboard;
  const figures = [
    { label: 'Loans receivable', kobo: ledger.loansReceivableKobo },
    { label: 'Invoice receivables', kobo: ledger.invoiceReceivablesKobo },
    { label: 'Client receivable (shortfalls)', kobo: ledger.clientReceivableKobo },
    { label: 'Unapplied customer credit', kobo: ledger.unappliedCreditKobo },
    { label: 'Interest income', kobo: ledger.interestIncomeKobo },
    { label: 'Fee income', kobo: ledger.feeIncomeKobo },
    { label: 'Penalty income', kobo: ledger.penaltyIncomeKobo },
  ] as const;
  return (
    <DashboardCard
      title="Ledger"
      action={
        <StatusChip tone={ledger.loansReceivableTiesToSchedules ? 'good' : 'alert'}>
          <span className="flex items-center gap-1">
            <ShieldCheckIcon size={14} />
            {ledger.loansReceivableTiesToSchedules ? 'Ties to loan schedules' : 'Does not tie to schedules'}
          </span>
        </StatusChip>
      }
    >
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt className="text-xs text-ink-muted">{figure.label}</dt>
            <dd className="font-semibold text-ink"><MoneyText kobo={figure.kobo} /></dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-ink-muted">Income is recognised when collected.</p>
    </DashboardCard>
  );
}

type WorkloadRow = Dashboard['officerWorkload'][number];

const workloadColumns: ReadonlyArray<DataTableColumn<WorkloadRow>> = [
  { key: 'officer', header: 'Loan officer', render: (row) => <span className="font-medium">{row.officer.fullName}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusChip tone={row.status === 'ACTIVE' ? 'good' : 'neutral'}>{row.status === 'ACTIVE' ? 'Active' : 'Disabled'}</StatusChip> },
  { key: 'customers', header: 'Customers', align: 'right', render: (row) => row.customerCount },
  { key: 'overdue', header: 'Overdue in book', align: 'right', render: (row) => (row.overdueKobo > 0 ? <span className="font-medium text-danger"><MoneyText kobo={row.overdueKobo} /></span> : '—') },
];

export function OfficerWorkload({ dashboard }: DashboardProps) {
  return (
    <DashboardCard title="Officer workload" action={<Link className="text-sm font-medium text-brand hover:underline" to="/team">View team</Link>}>
      <DataTable caption="Officer workload" columns={workloadColumns} rows={dashboard.officerWorkload} getRowKey={(row) => row.officer.userId} emptyMessage="No loan officers yet. Invite one from the Team page." />
    </DashboardCard>
  );
}
