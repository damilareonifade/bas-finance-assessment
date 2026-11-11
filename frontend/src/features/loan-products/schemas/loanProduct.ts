import { z } from 'zod';
import { formatKobo, koboSchema, parseNairaInputToKobo } from '@/lib/money';
import { officerRefSchema } from '@/features/customers';

export const productTypeSchema = z.enum(['TERM_LOAN', 'INVOICE_FINANCING']);
export type ProductType = z.infer<typeof productTypeSchema>;
export const PRODUCT_TYPE_LABELS: Readonly<Record<ProductType, string>> = { TERM_LOAN: 'Term loan', INVOICE_FINANCING: 'Invoice financing' };

export const loanProductSchema = z.object({
  productId: z.string(),
  name: z.string(),
  type: productTypeSchema,
  description: z.string().nullable(),
  minPrincipalKobo: koboSchema,
  maxPrincipalKobo: koboSchema,
  minAnnualRatePercent: z.number().nullable(),
  maxAnnualRatePercent: z.number().nullable(),
  minTermMonths: z.number().int().nullable(),
  maxTermMonths: z.number().int().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  createdAt: z.string(),
});
export type LoanProduct = z.infer<typeof loanProductSchema>;

export const loanProductDetailSchema = z.object({
  product: loanProductSchema,
  stats: z.object({ customerCount: z.number().int(), facilityCount: z.number().int(), outstandingKobo: koboSchema }),
});
export type LoanProductDetail = z.infer<typeof loanProductDetailSchema>;

export const productCustomerSchema = z.object({
  customerId: z.string(),
  fullName: z.string(),
  assignedOfficer: officerRefSchema.nullable(),
  facilityCount: z.number().int(),
  outstandingKobo: koboSchema,
});
export type ProductCustomer = z.infer<typeof productCustomerSchema>;

/* ---------- Form: everything is typed as text; blanks mean "use the default" ---------- */

const optionalPrincipal = z.string().trim().transform((text, context) => {
  if (text === '') return undefined;
  const kobo = parseNairaInputToKobo(text);
  if (kobo === null) {
    context.addIssue({ code: 'custom', message: 'Enter a valid naira amount (max 2 decimals)' });
    return z.NEVER;
  }
  return kobo;
});

const optionalNumber = (pattern: RegExp, message: string) =>
  z.string().trim().transform((text, context) => {
    if (text === '') return undefined;
    if (!pattern.test(text)) {
      context.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return Number(text);
  });

export const loanProductFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the product a name'),
    type: productTypeSchema,
    description: z.string().trim().transform((text) => (text === '' ? undefined : text)),
    minPrincipalInput: optionalPrincipal,
    maxPrincipalInput: optionalPrincipal,
    minRateInput: optionalNumber(/^\d+(\.\d+)?$/, 'Enter a percentage, e.g. 12.5'),
    maxRateInput: optionalNumber(/^\d+(\.\d+)?$/, 'Enter a percentage, e.g. 24'),
    minTermInput: optionalNumber(/^\d+$/, 'Enter whole months'),
    maxTermInput: optionalNumber(/^\d+$/, 'Enter whole months'),
  })
  .transform((values) => ({
    name: values.name,
    type: values.type,
    description: values.description,
    minPrincipalKobo: values.minPrincipalInput,
    maxPrincipalKobo: values.maxPrincipalInput,
    // Rates and terms only apply to term loans
    ...(values.type === 'TERM_LOAN'
      ? {
          minAnnualRatePercent: values.minRateInput,
          maxAnnualRatePercent: values.maxRateInput,
          minTermMonths: values.minTermInput,
          maxTermMonths: values.maxTermInput,
        }
      : {}),
  }));
export type LoanProductFormInput = z.input<typeof loanProductFormSchema>;
export type LoanProductRequest = z.output<typeof loanProductFormSchema>;
/** The type of a product is fixed once created; everything else can change. */
export type LoanProductUpdate = Omit<LoanProductRequest, 'type'>;

/** Everything but the type, which is fixed once a product exists. */
export function toLoanProductUpdate(request: LoanProductRequest): LoanProductUpdate {
  return {
    name: request.name,
    description: request.description,
    minPrincipalKobo: request.minPrincipalKobo,
    maxPrincipalKobo: request.maxPrincipalKobo,
    ...('minAnnualRatePercent' in request
      ? {
          minAnnualRatePercent: request.minAnnualRatePercent,
          maxAnnualRatePercent: request.maxAnnualRatePercent,
          minTermMonths: request.minTermMonths,
          maxTermMonths: request.maxTermMonths,
        }
      : {}),
  };
}

/** Pre-fills the form from a saved product (amounts back to naira text, numbers back to text). */
export function toLoanProductFormInput(product: LoanProduct): LoanProductFormInput {
  const text = (value: number | null) => (value === null ? '' : String(value));
  return {
    name: product.name,
    type: product.type,
    description: product.description ?? '',
    minPrincipalInput: formatKobo(product.minPrincipalKobo),
    maxPrincipalInput: formatKobo(product.maxPrincipalKobo),
    minRateInput: text(product.minAnnualRatePercent),
    maxRateInput: text(product.maxAnnualRatePercent),
    minTermInput: text(product.minTermMonths),
    maxTermInput: text(product.maxTermMonths),
  };
}

/** Server field → form field. */
export const PRODUCT_SERVER_FIELD_MAP = {
  name: 'name',
  type: 'type',
  description: 'description',
  minPrincipalKobo: 'minPrincipalInput',
  maxPrincipalKobo: 'maxPrincipalInput',
  minAnnualRatePercent: 'minRateInput',
  maxAnnualRatePercent: 'maxRateInput',
  minTermMonths: 'minTermInput',
  maxTermMonths: 'maxTermInput',
} as const satisfies Record<string, keyof LoanProductFormInput>;

/** "₦1,000.00 – ₦5,000,000,000.00" */
export function describePrincipalRange(product: LoanProduct): string {
  return `${formatKobo(product.minPrincipalKobo)} – ${formatKobo(product.maxPrincipalKobo)}`;
}

export function describeRateRange(product: LoanProduct): string {
  return product.minAnnualRatePercent === null || product.maxAnnualRatePercent === null ? '—' : `${product.minAnnualRatePercent}% – ${product.maxAnnualRatePercent}%`;
}

export function describeTermRange(product: LoanProduct): string {
  return product.minTermMonths === null || product.maxTermMonths === null ? '—' : `${product.minTermMonths} – ${product.maxTermMonths} months`;
}
