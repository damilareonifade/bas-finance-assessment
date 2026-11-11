# NOTES

**Run:** `npm install` → `npm run dev` (API :3000, web :5173; creates `backend/.env` from the example and seeds `admin@lender.test` / `ChangeMe123!`) ·
`npm test` (backend unit + e2e, frontend) · live contract: `CONTRACT_API_URL=http://localhost:3000 npm run test:contract -w frontend`.

## Money contract (decision)
- Kobo crosses the wire as a JSON **integer `number`** (`principalKobo`). The ceiling, ₦5bn = 5×10¹¹ kobo, is far below 2⁵³, so a number is exact
  and needs no parsing ceremony; a string would only pay off for unbounded amounts. Both ends reject floats, strings and unsafe integers
  (`koboSchema` / `@IsKobo`). Rates are plain percent numbers (not money); dates are `YYYY-MM-DD`.
- Maths uses decimal.js (half-up) with one rounding function, called only where the brief rounds. Storage: SQLite via Prisma, money as `BigInt` kobo.
- **Client and server have separate implementations** (browser preview vs. what posts), so parity is proven, not assumed:
  `backend/src/parity/client-server-parity.spec.ts` imports both and compares 255 generated loans (brief's ranges + edges + Worked Example 1)
  and 250 invoices kobo for kobo inside `npm test`; the live contract test repeats it over HTTP. Mutation-checked: breaking client rounding fails it.

## Decisions & assumptions
- **A1** Disbursement date defaults to today; instalment *k* is due *k* months later, clamped to month end.
- **A2** Term loans have no penalty or fee (the brief defines none); those waterfall slots exist and are 0.
- **A3** "Oldest unpaid, due instalment": every instalment still owed is eligible, oldest first, so early payoff clears future instalments (no
  interest rebate) and only money beyond everything owed becomes unapplied credit. The stricter reading (past-due only) is a one-line filter.
- **A4** Unapplied credit is a recorded liability; it is not auto-applied later. **A5** Tenor = due − advance date; an invoice settles once.
- **A6** Reversing entries exist (`LedgerService.reverse`, tested) but have no endpoint: reversing a payment must also un-apply instalments, which
  the brief does not specify.
- **A7** Every write is one DB transaction holding the write lock from its first statement; repayments lock the loan first; settlement and
  approvals are compare-and-set. Same `Idempotency-Key` → same response, never a second posting. Triggers keep the journal append-only.
- **A8** Quotes run the same customer-access and product-limit checks as posting, so nothing is quoted that approval would refuse.
- **A9** Roles: officers act only on their assigned customers (403 otherwise). Staff invite team members and customers by one-time link (no email).
- **A10** Beyond the brief: applications (approve = disburse), KYC documents, notifications, admin dashboard, collections, a ledger explorer
  (any customer's or product's debits and credits), and a customer portal (separate login; applies at the product's minimum rate; cannot post payments).

## Verified by hand
- Worked Example 1 and the invoice shortfall table (day 0 / 95 / 96, settlement journal) match to the kobo — unit tests on both ends and e2e.
- Fresh-clone run in a scratch copy: `npm install` → `npm test` all green → server starts → admin login works.
- Real parallel HTTP requests: one key ×5 posts once; concurrent payments, settlements and approvals each move money exactly once.
- Clicked through in a browser: product setup, term-loan quote/disburse, invoice quote and settlement, customer portal (loans, settled invoice).
- Dashboard "ledger ties to schedules" holds after partial payments, over-payments and invoices; every ledger view reports Σ debits = Σ credits.

## Not done
- No reversal endpoint (A6), no accrual job (per the brief), no email delivery or password reset (users change it in Settings).
- No pagination (the ledger caps a view at 2,000 lines; its totals cover everything). Customer details and user roles cannot be edited.
