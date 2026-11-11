import { Link } from 'react-router-dom';
import { DonutChart, type DonutColor } from '@/components/charts/DonutChart';
import { ClipboardIcon, ClockIcon, ReceiptIcon, UserPlusIcon } from '@/components/ui/icons';
import { MoneyText } from '@/components/ui/MoneyText';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import type { CollectionRow } from '@/features/collections';
import type { TermLoan } from '@/features/term-loans';
import { asKobo, formatKobo, formatKoboCompact } from '@/lib/money';
import { cn } from '@/lib/utils/cn';
import { loanHealth, type ActivityItem, type LoanHealth, type PortfolioSlice } from '../dashboardDerivations';
import type { Dashboard } from '../schemas/dashboard';
import { DashboardCard } from './DashboardCard';

const viewAllClasses = 'text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand';

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '')).toUpperCase() || '·';
}

const HEALTH: Readonly<Record<LoanHealth, { label: string; tone: StatusTone }>> = {
  current: { label: 'Current', tone: 'good' },
  overdue: { label: 'Overdue', tone: 'alert' },
  repaid: { label: 'Repaid', tone: 'complete' },
};

interface RecentLoansCardProps {
  readonly loans: readonly TermLoan[];
  readonly nameOf: (customerId: string | null) => string | null;
  readonly today: string;
}

export function RecentLoansCard({ loans, nameOf, today }: RecentLoansCardProps) {
  const latest = loans.slice(0, 5);
  return (
    <DashboardCard className="h-full" title="Recent loans" action={<Link className={viewAllClasses} to="/loans">View all</Link>}>
      {latest.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No loans yet. <Link className="text-brand underline" to="/loans/create">Create the first one</Link>.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Five most recent loans</caption>
            <thead>
              <tr className="text-xs text-ink-muted uppercase">
                <th scope="col" className="pb-3 text-left font-medium tracking-wide">Customer</th>
                <th scope="col" className="pb-3 text-left font-medium tracking-wide">Loan</th>
                <th scope="col" className="pb-3 text-right font-medium tracking-wide">Amount</th>
                <th scope="col" className="hidden pb-3 text-right font-medium tracking-wide md:table-cell">Outstanding</th>
                <th scope="col" className="pb-3 pl-4 text-left font-medium tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((loan) => {
                const name = nameOf(loan.customerId);
                const health = HEALTH[loanHealth(loan, today)];
                return (
                  <tr key={loan.loanId} className="border-t border-line">
                    <td className="py-3">
                      <span className="flex items-center gap-2.5">
                        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{initialsOf(name ?? '?')}</span>
                        <span className="font-medium text-ink">{name ?? '—'}</span>
                      </span>
                    </td>
                    <td className="py-3">
                      <Link className="text-brand hover:underline" to={`/loans/${loan.loanId}`}>{loan.loanId}</Link>
                    </td>
                    <td className="py-3 text-right font-semibold text-ink tabular-nums"><MoneyText kobo={loan.principalKobo} /></td>
                    <td className="hidden py-3 text-right text-ink-muted tabular-nums md:table-cell"><MoneyText kobo={loan.outstandingPrincipalKobo} /></td>
                    <td className="py-3 pl-4"><StatusChip tone={health.tone}>{health.label}</StatusChip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}

const ACTIVITY_DOT: Readonly<Record<ActivityItem['kind'], string>> = {
  'loan-disbursed': 'bg-brand',
  'invoice-advanced': 'bg-chart-amber',
  'invoice-settled': 'bg-teal',
};

export function RecentActivityCard({ items }: { readonly items: readonly ActivityItem[] }) {
  return (
    <DashboardCard title="Recent activity">
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">Nothing has happened yet.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex gap-3">
              <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', ACTIVITY_DOT[item.kind])} />
              <div className="min-w-0">
                <Link to={item.to} className="text-sm font-medium text-ink hover:text-brand hover:underline">{item.title}</Link>
                <p className="truncate text-xs text-ink-muted">{item.detail}</p>
                <p className="text-xs text-ink-muted/80">{item.date}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashboardCard>
  );
}

const SLICE_COLORS: readonly DonutColor[] = ['brand', 'cyan', 'amber', 'green', 'teal', 'navy'];

export function PortfolioCard({ slices }: { readonly slices: readonly PortfolioSlice[] }) {
  const totalKobo = asKobo(slices.reduce((sum, slice) => sum + slice.valueKobo, 0));
  return (
    <DashboardCard title="Portfolio by product">
      {slices.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">Nothing is outstanding yet.</p>
      ) : (
        <DonutChart
          caption="Outstanding principal and open invoice advances by loan product"
          centerValue={formatKoboCompact(totalKobo)}
          centerLabel="Outstanding"
          formatValue={(value) => formatKoboCompact(asKobo(value))}
          segments={slices.map((slice, index) => ({ label: slice.label, value: slice.valueKobo, color: SLICE_COLORS[index % SLICE_COLORS.length] ?? 'brand' }))}
        />
      )}
    </DashboardCard>
  );
}

interface RiskMonitoringCardProps {
  readonly overdueAccounts: readonly CollectionRow[];
  readonly dashboard: Dashboard;
  /** Applications submitted or under review. */
  readonly openApplicationCount: number;
}

export function RiskMonitoringCard({ overdueAccounts, dashboard, openApplicationCount }: RiskMonitoringCardProps) {
  const toChase = overdueAccounts.filter((row) => row.needsFollowUp).slice(0, 5);
  const attention = [
    { label: 'Applications awaiting a decision', count: openApplicationCount, to: '/applications?status=OPEN', icon: <ClipboardIcon size={18} /> },
    { label: 'Customers without a loan officer', count: dashboard.customers.unassigned, to: '/customers?unassigned=true', icon: <UserPlusIcon size={18} /> },
    { label: 'Invoices past their due date', count: dashboard.invoices.overdueCount, to: '/invoices', icon: <ReceiptIcon size={18} /> },
    { label: 'Loans past due', count: dashboard.loans.overdueLoanCount, to: '/collections', icon: <ClockIcon size={18} /> },
  ];
  return (
    <DashboardCard title="Risk monitoring" action={<Link className={viewAllClasses} to="/collections">Open collections</Link>}>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-danger uppercase">Overdue accounts</h3>
      {toChase.length === 0 ? (
        <p className="mb-5 text-sm text-ink-muted">No assigned customer is behind.</p>
      ) : (
        <ul className="mb-5 flex flex-col divide-y divide-line">
          {toChase.map((row) => (
            <li key={row.customerId} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <Link className="block truncate text-sm font-medium text-ink hover:text-brand hover:underline" to={`/customers/${row.customerId}`}>{row.fullName}</Link>
                <span className="text-xs text-ink-muted">{row.assignedOfficer?.fullName ?? 'No officer'}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold text-danger tabular-nums">{formatKobo(row.overdueKobo)}</span>
                <StatusChip tone="alert">{row.oldestOverdueDays} days</StatusChip>
              </span>
            </li>
          ))}
        </ul>
      )}
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-orange uppercase">Needs attention</h3>
      <ul className="flex flex-col gap-1">
        {attention.map((item) => (
          <li key={item.label}>
            <Link to={item.to} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand">
              <span className="flex items-center gap-2.5 text-ink">
                <span className="text-ink-muted">{item.icon}</span>
                {item.label}
              </span>
              <span className={cn('font-semibold tabular-nums', item.count > 0 ? 'text-orange' : 'text-ink-muted')}>{item.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
