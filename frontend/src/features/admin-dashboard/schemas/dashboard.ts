import { z } from 'zod';
import { officerRefSchema } from '@/features/customers';
import { koboSchema } from '@/lib/money';

const periodComparisonSchema = <TValue extends z.ZodType<number>>(value: TValue) =>
  z.object({ current: value, previous: value, changePercent: z.number().nullable() });

export const dashboardTrendsSchema = z.object({
  days: z.array(z.string()),
  disbursedKobo: z.array(koboSchema),
  collectedKobo: z.array(koboSchema),
  invoiceAdvancesKobo: z.array(koboSchema),
  newCustomers: z.array(z.number().int()),
});
export type DashboardTrends = z.infer<typeof dashboardTrendsSchema>;

export const monthToDateSchema = z.object({
  disbursed: periodComparisonSchema(koboSchema),
  collected: periodComparisonSchema(koboSchema),
  invoiceAdvances: periodComparisonSchema(koboSchema),
  newCustomers: periodComparisonSchema(z.number().int()),
});
export type MonthToDate = z.infer<typeof monthToDateSchema>;

export const dashboardSchema = z.object({
  trends: dashboardTrendsSchema,
  monthToDate: monthToDateSchema,
  asOf: z.string(),
  customers: z.object({ total: z.number().int(), unassigned: z.number().int() }),
  team: z.object({ officers: z.number().int(), admins: z.number().int(), pendingInvitations: z.number().int() }),
  products: z.object({ active: z.number().int(), archived: z.number().int() }),
  loans: z.object({ count: z.number().int(), outstandingPrincipalKobo: koboSchema, overdueKobo: koboSchema, overdueLoanCount: z.number().int() }),
  invoices: z.object({ advancedCount: z.number().int(), outstandingAdvanceKobo: koboSchema, overdueCount: z.number().int() }),
  ledger: z.object({
    loansReceivableKobo: koboSchema,
    invoiceReceivablesKobo: koboSchema,
    clientReceivableKobo: koboSchema,
    unappliedCreditKobo: koboSchema,
    interestIncomeKobo: koboSchema,
    feeIncomeKobo: koboSchema,
    penaltyIncomeKobo: koboSchema,
    loansReceivableTiesToSchedules: z.boolean(),
  }),
  officerWorkload: z.array(
    z.object({ officer: officerRefSchema, status: z.enum(['ACTIVE', 'DISABLED']), customerCount: z.number().int(), overdueKobo: koboSchema }),
  ),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
