import { addKobo, Kobo, minKobo, subtractKobo, ZERO_KOBO } from '../../common/money';

export interface OutstandingComponents {
  readonly penaltyKobo: Kobo;
  readonly feeKobo: Kobo;
  readonly interestKobo: Kobo;
  readonly principalKobo: Kobo;
}

export interface AllocatableInstalment {
  readonly instalmentNumber: number;
  readonly outstanding: OutstandingComponents;
}

export interface InstalmentAllocation extends OutstandingComponents {
  readonly instalmentNumber: number;
}

export interface PaymentAllocation {
  readonly receivedKobo: Kobo;
  readonly allocations: readonly InstalmentAllocation[];
  /** Anything left after everything owed is cleared: a liability (unapplied customer credit), not a prepayment. */
  readonly unappliedCreditKobo: Kobo;
}

const COMPONENT_ORDER = ['penaltyKobo', 'feeKobo', 'interestKobo', 'principalKobo'] as const;

/**
 * The waterfall: oldest unpaid instalment first; inside an instalment penalty → fee → interest → principal.
 * Instalments must be supplied oldest first. Only instalments that actually receive money are returned.
 */
export function allocatePayment(receivedKobo: Kobo, instalments: readonly AllocatableInstalment[]): PaymentAllocation {
  let remainingKobo: Kobo = receivedKobo;
  const allocations: InstalmentAllocation[] = [];

  for (const instalment of instalments) {
    if (remainingKobo === 0) break;
    const applied: Record<(typeof COMPONENT_ORDER)[number], Kobo> = {
      penaltyKobo: ZERO_KOBO,
      feeKobo: ZERO_KOBO,
      interestKobo: ZERO_KOBO,
      principalKobo: ZERO_KOBO,
    };
    for (const component of COMPONENT_ORDER) {
      const payment = minKobo(remainingKobo, instalment.outstanding[component]);
      applied[component] = payment;
      remainingKobo = subtractKobo(remainingKobo, payment);
    }
    if (addKobo(applied.penaltyKobo, applied.feeKobo, applied.interestKobo, applied.principalKobo) > 0) {
      allocations.push({ instalmentNumber: instalment.instalmentNumber, ...applied });
    }
  }
  return { receivedKobo, allocations, unappliedCreditKobo: remainingKobo };
}

export function sumAllocation(allocations: readonly InstalmentAllocation[], component: (typeof COMPONENT_ORDER)[number]): Kobo {
  return addKobo(...allocations.map((allocation) => allocation[component]));
}
