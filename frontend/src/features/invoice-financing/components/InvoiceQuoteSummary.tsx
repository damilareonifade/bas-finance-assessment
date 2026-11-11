import { useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { MoneyText } from '@/components/ui/MoneyText';
import { QuoteFreshnessNote } from '@/components/ui/QuoteFreshnessNote';
import { calculateInvoiceSettlement } from '@/lib/money';
import { cn } from '@/lib/utils/cn';
import type { QuoteFreshness } from '@/lib/utils/useLiveQuote';
import type { InvoiceQuote, InvoiceRequest } from '../schemas/invoice';

interface InvoiceQuoteSummaryProps {
  readonly request: InvoiceRequest;
  readonly quote: InvoiceQuote;
  readonly freshness?: QuoteFreshness;
  readonly isFinancing: boolean;
  readonly isFinanced: boolean;
  readonly onFinance: () => void;
}

export function InvoiceQuoteSummary({ request, quote, freshness = 'current', isFinancing, isFinanced, onFinance }: InvoiceQuoteSummaryProps) {
  const isCurrent = freshness === 'current';
  const clientPreview = useMemo(
    () => calculateInvoiceSettlement({ faceValueKobo: request.faceValueKobo, tenorDays: quote.tenorDays, daysOverdue: 0 }),
    [request.faceValueKobo, quote.tenorDays],
  );
  const isMatching =
    clientPreview.advanceKobo === quote.advanceKobo &&
    clientPreview.reserveKobo === quote.reserveKobo &&
    clientPreview.discountFeeKobo === quote.discountFeeKobo;

  const quoteFigures = [
    { label: 'Face value', kobo: request.faceValueKobo },
    { label: 'Advance paid now (80%)', kobo: quote.advanceKobo },
    { label: 'Reserve held back', kobo: quote.reserveKobo },
    { label: `Discount fee (${quote.tenorDays} days at 36%)`, kobo: quote.discountFeeKobo },
    { label: 'Late penalty per day overdue', kobo: quote.latePenaltyPerDayKobo },
  ] as const;

  return (
    <Card>
      <CardHeader
        title="Quote"
        action={<Badge tone={isMatching ? 'success' : 'danger'}>{isMatching ? 'Client preview matches server' : 'Client and server disagree'}</Badge>}
      />
      <dl className={cn('grid gap-4 transition-opacity sm:grid-cols-3', !isCurrent && 'opacity-50')} aria-busy={freshness === 'updating'}>
        {quoteFigures.map((figure) => (
          <div key={figure.label}>
            <dt className="text-xs text-ink-muted">{figure.label}</dt>
            <dd className="text-lg font-semibold"><MoneyText kobo={figure.kobo} /></dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onFinance} isLoading={isFinancing} disabled={isFinanced || !isCurrent}>
          {isFinanced ? 'Advance paid' : 'Approve and pay advance'}
        </Button>
        <QuoteFreshnessNote freshness={freshness} />
      </div>
    </Card>
  );
}
