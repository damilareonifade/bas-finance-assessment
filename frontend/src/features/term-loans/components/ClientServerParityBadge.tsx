import { Badge } from '@/components/ui/Badge';
import type { TermLoanQuote } from '../schemas/termLoan';
import type { ScheduleInstalment } from '@/lib/money';

interface ClientServerParityBadgeProps {
  readonly clientSchedule: readonly ScheduleInstalment[];
  readonly serverSchedule: TermLoanQuote['schedule'];
}

export function schedulesMatch(clientSchedule: readonly ScheduleInstalment[], serverSchedule: TermLoanQuote['schedule']): boolean {
  return (
    clientSchedule.length === serverSchedule.length &&
    clientSchedule.every((clientRow, index) => {
      const serverRow = serverSchedule[index];
      return (
        serverRow !== undefined &&
        serverRow.paymentKobo === clientRow.paymentKobo &&
        serverRow.interestKobo === clientRow.interestKobo &&
        serverRow.principalKobo === clientRow.principalKobo &&
        serverRow.closingBalanceKobo === clientRow.closingBalanceKobo
      );
    })
  );
}

/** Shows whether the in-browser preview agrees with the server's schedule kobo for kobo. */
export function ClientServerParityBadge({ clientSchedule, serverSchedule }: ClientServerParityBadgeProps) {
  const isMatching = schedulesMatch(clientSchedule, serverSchedule);
  return <Badge tone={isMatching ? 'success' : 'danger'}>{isMatching ? 'Client preview matches server' : 'Client and server disagree'}</Badge>;
}
