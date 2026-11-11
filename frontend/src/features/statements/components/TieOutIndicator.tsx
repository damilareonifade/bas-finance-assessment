import { Alert } from '@/components/ui/Alert';
import { MoneyText } from '@/components/ui/MoneyText';
import type { Kobo } from '@/lib/money';
import type { TieOutResult } from '../statementMath';

interface TieOutIndicatorProps {
  readonly statementClosingKobo: Kobo;
  readonly scheduleOutstandingKobo: Kobo;
  readonly tieOut: TieOutResult;
}

/** Green when the statement closing balance equals the schedule's outstanding principal; red with the difference otherwise. */
export function TieOutIndicator({ statementClosingKobo, scheduleOutstandingKobo, tieOut }: TieOutIndicatorProps) {
  return (
    <Alert tone={tieOut.isTiedOut ? 'success' : 'danger'} title={tieOut.isTiedOut ? 'Tie-out: statement agrees with schedule' : 'Tie-out failed'}>
      <p>
        Statement closing balance <MoneyText kobo={statementClosingKobo} /> · Schedule outstanding principal{' '}
        <MoneyText kobo={scheduleOutstandingKobo} />
      </p>
      {tieOut.isTiedOut ? null : (
        <p className="font-semibold">
          Difference: <MoneyText kobo={tieOut.differenceKobo} />
        </p>
      )}
    </Alert>
  );
}
