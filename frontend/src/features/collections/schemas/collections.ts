import { z } from 'zod';
import { customerSummarySchema, officerRefSchema } from '@/features/customers';
import { koboSchema } from '@/lib/money';

export const collectionRowSchema = customerSummarySchema.extend({
  needsFollowUp: z.boolean(),
  overdueInstalments: z.number().int(),
  oldestOverdueDays: z.number().int(),
  nextDueDate: z.string().nullable(),
});
export type CollectionRow = z.infer<typeof collectionRowSchema>;

export const collectionsSchema = z.object({
  asOf: z.string(),
  officer: officerRefSchema.nullable(),
  totals: z.object({ customers: z.number().int(), customersToChase: z.number().int(), overdueKobo: koboSchema, outstandingPrincipalKobo: koboSchema }),
  customers: z.array(collectionRowSchema),
});
export type Collections = z.infer<typeof collectionsSchema>;
