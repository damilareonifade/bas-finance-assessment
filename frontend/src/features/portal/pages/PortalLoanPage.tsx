import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { usePortalLoanQuery } from '../api/portalApi';
import { formatPortalDate } from '../components/dates';
import type { PortalLoanDetail } from '../schemas/portal';

const INSTALMENT_LABEL: Readonly<Record<PortalLoanDetail['schedule'][number]['status'], { label: string; tone: StatusTone }>> = {
  PAID: { label: 'Paid', tone: 'good' },
  PARTIALLY_PAID: { label: 'Part paid', tone: 'progress' },
  UNPAID: { label: 'Due', tone: 'neutral' },
};

export default function PortalLoanPage() {
  const { loanId = '' } = useParams();
  const loanQuery = usePortalLoanQuery(loanId);
  const loan = loanQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={loan ? `${loan.productName ?? 'Term loan'} · ${loan.loanId}` : 'Your loan'}
        breadcrumbs={[{ label: 'My loans', to: '/portal/loans' }, { label: loanId }]}
        description={loan ? `Paid out ${formatPortalDate(loan.disbursedOn)} · ${loan.termMonths} monthly payments at ${loan.annualRatePercent}% a year` : undefined}
      />
      {loanQuery.isPending ? <Skeleton className="h-64 w-full rounded-2xl" /> : null}
      {loanQuery.isError ? <QueryError error={loanQuery.error} onRetry={() => void loanQuery.refetch()} /> : null}
      {loan ? (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Borrowed" value={<MoneyText kobo={loan.principalKobo} />} />
            <StatCard label="Still to repay (principal)" value={<MoneyText kobo={loan.outstandingPrincipalKobo} />} />
            <StatCard
              label={loan.nextPayment ? `Next payment · ${formatPortalDate(loan.nextPayment.dueDate)}` : 'Next payment'}
              value={loan.nextPayment ? <MoneyText kobo={loan.nextPayment.amountDueKobo} /> : 'All paid'}
            />
            <StatCard label="Past due" value={<MoneyText kobo={loan.overdueKobo} />} tone={loan.overdueKobo > 0 ? 'danger' : 'neutral'} />
          </dl>
          {loan.unappliedCreditKobo > 0 ? (
            <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
              You have <MoneyText kobo={loan.unappliedCreditKobo} /> in credit with us from paying more than was owed.
            </p>
          ) : null}
          {loan.officer ? (
            <p className="text-sm text-ink-muted">
              Questions about this loan? Your loan officer is {loan.officer.fullName} —{' '}
              <a href={`mailto:${loan.officer.email}`} className="font-medium text-brand hover:underline">
                {loan.officer.email}
              </a>
              .
            </p>
          ) : null}

          <Card>
            <CardHeader title="Payment schedule" description="Each monthly payment covers interest first, then repays part of what you borrowed." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">#</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Due</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Payment</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Interest</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Principal</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Balance after</th>
                    <th scope="col" className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {loan.schedule.map((row) => (
                    <tr key={row.instalmentNumber} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5 pr-3 text-ink-muted">{row.instalmentNumber}</td>
                      <td className="py-2.5 pr-3">{formatPortalDate(row.dueDate)}</td>
                      <td className="py-2.5 pr-3 text-right font-medium"><MoneyText kobo={row.paymentKobo} /></td>
                      <td className="py-2.5 pr-3 text-right"><MoneyText kobo={row.interestKobo} /></td>
                      <td className="py-2.5 pr-3 text-right"><MoneyText kobo={row.principalKobo} /></td>
                      <td className="py-2.5 pr-3 text-right"><MoneyText kobo={row.closingBalanceKobo} /></td>
                      <td className="py-2.5"><StatusChip tone={INSTALMENT_LABEL[row.status].tone}>{INSTALMENT_LABEL[row.status].label}</StatusChip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Statement" description="Every movement on this loan, oldest first." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                    <th scope="col" className="py-2 pr-3 font-medium">What happened</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Towards interest</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Towards principal</th>
                    <th scope="col" className="py-2 text-right font-medium">Balance after</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {loan.statement.map((row) => (
                    <tr key={row.entryId} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5 pr-3">{formatPortalDate(row.postedOn)}</td>
                      <td className="py-2.5 pr-3">
                        {row.description}
                        {row.creditKobo > 0 ? (
                          <span className="block text-xs text-ink-muted">
                            Includes <MoneyText kobo={row.creditKobo} /> kept as credit
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium"><MoneyText kobo={row.amountKobo} /></td>
                      <td className="py-2.5 pr-3 text-right">{row.kind === 'PAYMENT' ? <MoneyText kobo={row.interestKobo} /> : '—'}</td>
                      <td className="py-2.5 pr-3 text-right">{row.kind === 'PAYMENT' ? <MoneyText kobo={row.principalKobo} /> : '—'}</td>
                      <td className="py-2.5 text-right"><MoneyText kobo={row.balanceAfterKobo} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
