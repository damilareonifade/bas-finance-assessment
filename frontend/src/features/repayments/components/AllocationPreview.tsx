import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { addKobo, ZERO_KOBO, type Kobo } from '@/lib/money';
import type { InstalmentAllocation, RepaymentAllocation } from '../schemas/repayment';

interface AllocationPreviewProps {
  readonly allocation: RepaymentAllocation;
  readonly isConfirming: boolean;
  readonly onConfirm: () => void;
}

const allocationColumns: ReadonlyArray<DataTableColumn<InstalmentAllocation>> = [
  { key: 'number', header: 'Instalment', render: (row) => `#${row.instalmentNumber}` },
  { key: 'penalty', header: 'Penalty', align: 'right', render: (row) => <MoneyText kobo={row.penaltyKobo} /> },
  { key: 'fee', header: 'Fee', align: 'right', render: (row) => <MoneyText kobo={row.feeKobo} /> },
  { key: 'interest', header: 'Interest', align: 'right', render: (row) => <MoneyText kobo={row.interestKobo} /> },
  { key: 'principal', header: 'Principal', align: 'right', render: (row) => <MoneyText kobo={row.principalKobo} /> },
];

function sumColumn(allocations: readonly InstalmentAllocation[], pick: (row: InstalmentAllocation) => Kobo): Kobo {
  return allocations.reduce<Kobo>((total, row) => addKobo(total, pick(row)), ZERO_KOBO);
}

/** Displays the server-computed waterfall. The client never recomputes it. */
export function AllocationPreview({ allocation, isConfirming, onConfirm }: AllocationPreviewProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Received <MoneyText kobo={allocation.receivedKobo} />. Applied to the oldest unpaid instalment first: penalty, fee, interest, principal.
      </p>
      <DataTable
        caption="Allocation preview"
        columns={allocationColumns}
        rows={allocation.allocations}
        getRowKey={(row) => String(row.instalmentNumber)}
        emptyMessage="Nothing is due yet — the full amount becomes unapplied customer credit."
        footer={
          <tr className="font-semibold">
            <th scope="row" className="px-3 py-2 text-left">Total</th>
            <td className="px-3 py-2 text-right"><MoneyText kobo={sumColumn(allocation.allocations, (row) => row.penaltyKobo)} /></td>
            <td className="px-3 py-2 text-right"><MoneyText kobo={sumColumn(allocation.allocations, (row) => row.feeKobo)} /></td>
            <td className="px-3 py-2 text-right"><MoneyText kobo={sumColumn(allocation.allocations, (row) => row.interestKobo)} /></td>
            <td className="px-3 py-2 text-right"><MoneyText kobo={sumColumn(allocation.allocations, (row) => row.principalKobo)} /></td>
          </tr>
        }
      />
      {allocation.unappliedCreditKobo > 0 ? (
        <Alert tone="info" title="Unapplied customer credit">
          <MoneyText kobo={allocation.unappliedCreditKobo} /> is left over after everything due is cleared. It is held as a liability, not a prepayment.
        </Alert>
      ) : null}
      <div>
        <Button onClick={onConfirm} isLoading={isConfirming}>
          Confirm repayment
        </Button>
      </div>
    </div>
  );
}
