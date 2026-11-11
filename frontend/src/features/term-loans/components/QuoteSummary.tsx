import { Card, CardHeader } from '@/components/ui/Card';
import { MoneyText } from '@/components/ui/MoneyText';
import { Button } from '@/components/ui/Button';
import { QuoteFreshnessNote } from '@/components/ui/QuoteFreshnessNote';
import { buildAmortisationSchedule } from '@/lib/money';
import { cn } from '@/lib/utils/cn';
import type { QuoteFreshness } from '@/lib/utils/useLiveQuote';
import { useMemo } from 'react';
import type { TermLoanQuote, TermLoanRequest } from '../schemas/termLoan';
import { AmortisationScheduleTable } from './AmortisationScheduleTable';
import { ClientServerParityBadge } from './ClientServerParityBadge';

interface QuoteSummaryProps {
  readonly request: TermLoanRequest;
  readonly quote: TermLoanQuote;
  /** Whether these figures still match the form; approving is only possible when they do. */
  readonly freshness?: QuoteFreshness;
  readonly isDisbursing: boolean;
  readonly isDisbursed: boolean;
  readonly onApproveAndDisburse: () => void;
}

export function QuoteSummary({ request, quote, freshness = 'current', isDisbursing, isDisbursed, onApproveAndDisburse }: QuoteSummaryProps) {
  const clientSchedule = useMemo(() => buildAmortisationSchedule(request), [request]);
  const isCurrent = freshness === 'current';

  return (
    <Card>
      <CardHeader
        title="Repayment schedule"
        description="Server schedule is authoritative; the badge shows whether the browser preview agrees."
        action={<ClientServerParityBadge clientSchedule={clientSchedule} serverSchedule={quote.schedule} />}
      />
      <div className={cn('transition-opacity', !isCurrent && 'opacity-50')} aria-busy={freshness === 'updating'}>
      <dl className="mb-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-muted">Monthly instalment</dt>
          <dd className="text-lg font-semibold"><MoneyText kobo={quote.instalmentKobo} /></dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Total interest</dt>
          <dd className="text-lg font-semibold"><MoneyText kobo={quote.totalInterestKobo} /></dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Principal</dt>
          <dd className="text-lg font-semibold"><MoneyText kobo={request.principalKobo} /></dd>
        </div>
      </dl>
      <AmortisationScheduleTable schedule={quote.schedule} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onApproveAndDisburse} isLoading={isDisbursing} disabled={isDisbursed || !isCurrent}>
          {isDisbursed ? 'Disbursed' : 'Approve and disburse'}
        </Button>
        <QuoteFreshnessNote freshness={freshness} />
      </div>
    </Card>
  );
}
