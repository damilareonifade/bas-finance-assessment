import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { MoneyText } from '@/components/ui/MoneyText';
import { JournalEntryCard } from '@/features/ledger';
import type { InvoiceSettlement } from '../schemas/invoice';

interface SettlementOutcomeProps {
  readonly settlement: InvoiceSettlement;
  readonly isPosted: boolean;
  readonly isConfirming: boolean;
  readonly onConfirm: () => void;
}

/** Shows what the client receives, or — when charges exceed the reserve — the shortfall the client owes. Never a negative payable. */
export function SettlementOutcome({ settlement, isPosted, isConfirming, onConfirm }: SettlementOutcomeProps) {
  const hasShortfall = settlement.clientOwesKobo > 0;
  const figures = [
    { label: 'Days overdue', value: String(settlement.daysOverdue) },
    { label: 'Discount fee', value: <MoneyText kobo={settlement.discountFeeKobo} /> },
    { label: 'Late penalty', value: <MoneyText kobo={settlement.latePenaltyKobo} /> },
    { label: 'Total charges', value: <MoneyText kobo={settlement.totalChargesKobo} /> },
    { label: 'Client receives', value: <MoneyText kobo={settlement.clientReceivesKobo} /> },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Settlement" />
        <dl className="grid gap-4 sm:grid-cols-5">
          {figures.map((figure) => (
            <div key={figure.label}>
              <dt className="text-xs text-ink-muted">{figure.label}</dt>
              <dd className="font-semibold">{figure.value}</dd>
            </div>
          ))}
        </dl>
        {hasShortfall ? (
          <div className="mt-4">
            <Alert tone="danger" title="Shortfall: the client owes the lender">
              Charges exceed the reserve. The client owes <strong><MoneyText kobo={settlement.clientOwesKobo} /></strong>, recorded as Client Receivable.
            </Alert>
          </div>
        ) : null}
        {isPosted ? null : (
          <div className="mt-4">
            <Button onClick={onConfirm} isLoading={isConfirming}>Confirm settlement</Button>
          </div>
        )}
      </Card>
      <JournalEntryCard journalEntry={settlement.journalEntry} title={isPosted ? 'Posted settlement entry' : 'Settlement entry (preview)'} />
    </div>
  );
}
