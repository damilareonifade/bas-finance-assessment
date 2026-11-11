import { Kobo } from './kobo';

/** Business limits from the brief (mirrored by the frontend). */
export const MIN_PRINCIPAL_KOBO = 100_000 as Kobo; // ₦1,000
export const MAX_PRINCIPAL_KOBO = 500_000_000_000 as Kobo; // ₦5,000,000,000
export const MIN_ANNUAL_RATE_PERCENT = 0.5;
export const MAX_ANNUAL_RATE_PERCENT = 60;
export const MIN_TERM_MONTHS = 1;
export const MAX_TERM_MONTHS = 60;
/** Largest single kobo amount we accept for invoices / payments (well inside MAX_SAFE_INTEGER). */
export const MAX_AMOUNT_KOBO = 1_000_000_000_000 as Kobo;
