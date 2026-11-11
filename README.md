# Loan Origination to Repayment

A lending back-office tool, plus a customer portal, built as a thin end-to-end slice of a lending product. It covers term-loan origination,
repayments, invoice financing and borrower statements. Every number is in kobo, and the browser's figures match the server's exactly.

- **Backend:** NestJS + TypeScript + Prisma (SQLite), double-entry ledger, idempotent posting endpoints
- **Frontend:** React 19 + TypeScript (Vite), TanStack Query, React Hook Form + Zod, Tailwind
- **Money maths:** `decimal.js`, integer kobo, rounding half-up only where the brief says to round

> The requirements come from `Fullstack Developer Assessment Loan Origination to Repayment.pdf`. Assumptions, what was verified by hand and
> what was left out are in [NOTES.md](NOTES.md).

---

## Contents

1. [Quick start](#quick-start)
2. [What the app does](#what-the-app-does)
3. [How the money works](#how-the-money-works)
4. [Architecture](#architecture)
5. [API overview](#api-overview)
6. [Testing](#testing)
7. [Configuration](#configuration)
8. [Useful scripts](#useful-scripts)

---

## Quick start

**Requirements:** Node.js 20.19 or newer (developed on Node 24) and npm. SQLite is bundled through `better-sqlite3`, so you don't need a database server.

```bash
npm install          # installs both workspaces and generates the Prisma client
npm run dev          # API on http://localhost:3000, web app on http://localhost:5173
```

On the first run, `npm run dev`:

1. creates `backend/.env` from `backend/.env.example` if it does not exist yet,
2. creates `backend/data/lending.db` and applies the Prisma migrations,
3. seeds an administrator from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

Open http://localhost:5173 and sign in as **`admin@lender.test` / `ChangeMe123!`**. Then change the password under **Settings**.

### A first walkthrough

1. **Products** → create a loan product with amount, rate and term limits.
2. **Customers** → create a customer (you can assign a loan officer here or later).
3. **Loans → Create** → choose the customer and product, enter principal, rate and term, and watch the amortisation schedule appear.
   The **parity badge** confirms that the browser's schedule equals the server's. Approve and disburse, then open the loan to see the
   journal entry that was posted.
4. On the loan, **take a repayment**: the server previews how the payment will be allocated, you confirm, and the schedule and statement refresh.
5. **Invoices → Create** → quote an advance, finance it, then settle it later. Settle 96+ days overdue to see the client-shortfall case.
6. **Admin dashboard** → check that the ledger totals tie to the loan schedules.

To try the customer portal without going through the invitation flow, give an existing customer a login:

```bash
npm run db:demo-customer -w backend                 # oldest customer with an email, password CustomerPass1!
npm run db:demo-customer -w backend -- CUS-000003   # a specific customer
```

Then sign in at http://localhost:5173/portal/login.

---

## What the app does

### Roles

| Role               | Can do                                                                                                                                                                                                                       |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Administrator**  | Everything below, plus: see every customer, create and edit loan products, see all customers on a product, invite team members, assign loan officers to customers, view the admin dashboard and the ledger explorer. |
| **Loan officer**   | Work their **assigned** customers only (any other customer returns `403`): originate loans, take repayments, finance and settle invoices, review applications and KYC documents, and use a **collections list** ranked by overdue amount. |
| **Customer**       | Uses the separate portal at `/portal`: sees their own loans, schedules, statements and invoices, applies for a loan at a product's rate, uploads the documents staff ask for, and gets notifications. Customers **cannot post payments**. |

Team members and customers are invited with a **one-time link** that staff copy and send themselves (the app sends no email). The person
opening the link sets their own password.

### Core flows

| Flow                       | What happens                                                                                                                                                                                    |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Term loan origination**  | Quote (amortisation schedule) → approve and disburse → posts `Dr Loans Receivable / Cr Cash`. The quote runs the same customer-access and product-limit checks as the posting does. |
| **Repayment**              | Server-computed allocation preview → confirm (idempotent) → posts the payment entry and marks instalments paid.                                                                                |
| **Invoice financing**      | Quote the advance and discount fee → finance (posts the advance) → settlement preview → settle. Charges are taken from the reserve, and any shortfall becomes a client receivable.             |
| **Borrower statement**     | Built from the loan's ledger lines. A **tie-out indicator** compares the statement's closing principal with the outstanding principal on the schedule.                                         |
| **Applications**           | Submitted → Under review → Approved / Rejected. **Approving disburses the loan.** The approver and the assigned officer are recorded on both the application and the loan.                       |
| **KYC documents**          | Staff request BVN, NIN, ID or statements; the customer uploads them (max 5 MB); staff verify or reject them.                                                                                    |
| **Notifications**          | The bell in the top bar shows submissions, assignments, decisions and document events, for staff and for customers.                                                                           |
| **Dashboard and ledger**   | Portfolio totals, trends, and a check that Loans Receivable ties to the schedules. The ledger explorer shows debits and credits by customer or product, with Σ debits = Σ credits.             |

---

## How the money works

The domain rules are written down in full in [CLAUDE.md](CLAUDE.md). In short:

### Money representation

- Every amount is an **integer number of kobo** (₦1 = 100 kobo). No floats are used for money anywhere: not in storage, payloads, UI state or maths.
- **On the wire:** kobo travels as a JSON integer `number`, and the field names end in `Kobo` (`principalKobo`). The largest amount (₦5bn = 5×10¹¹ kobo)
  is far below `Number.MAX_SAFE_INTEGER`, so a plain number is exact. Both ends reject non-integers, strings and unsafe integers
  (`@IsKobo` on the server, `koboSchema` on the client).
- **In the database:** Prisma `BigInt` columns.
- **Rates** are plain percentages (`annualRatePercent: 18.5`). **Dates** are `YYYY-MM-DD` calendar strings with no time zone.
- **Rounding** is half-up to the nearest kobo through a single rounding function, called only at the points the brief names.

### Product B: term loan (annuity, monthly reducing balance)

```
i           = annualRate / 12
instalment  = P × i / (1 − (1 + i)^−n)            ← rounded half-up once
interest_k  = openingBalance_k × i                ← rounded half-up
principal_k = instalment − interest_k
final row   : principal = remaining balance; payment = principal + interest
```

Golden example: ₦1,200,000 at 18% over 6 months → instalment **21,063,026** kobo, total interest **6,378,154** kobo, final payment 21,063,024.

### Product A: invoice financing

| Quantity      | Formula                                         |
|---------------|-------------------------------------------------|
| advance       | face × 80%                                      |
| reserve       | face − advance                                  |
| discount fee  | advance × 36% × tenorDays / 365 (rounded once)  |
| late penalty  | advance × 0.2% × daysOverdue (from the day after the due date) |

At settlement, the lender keeps `fee + penalty` out of the reserve and pays the rest to the client. If the charges are larger than the reserve,
**the client owes the shortfall**. The app never shows a negative "payable to client".

### Payment allocation (waterfall)

Each payment goes to the **oldest unpaid instalment first**. Within an instalment the order is **penalty → fee → interest → principal**.
Anything left once everything owed is cleared is recorded as **unapplied customer credit**, which is a liability. Paying early clears future
instalments in order (see assumption A3 in NOTES.md).

### Ledger

- Double entry: every journal entry has at least two lines, and debits equal credits to the kobo. Lines with a zero amount are not posted.
- Entries are **immutable**. Database triggers keep the journal append-only, and corrections are made with reversing entries.
- Interest, fees and penalties are recognised as income **when collected**. There is no accrual job.

| Event              | Entry                                                                                                   |
|--------------------|---------------------------------------------------------------------------------------------------------|
| Disbursement       | Dr Loans Receivable / Cr Cash                                                                           |
| Payment            | Dr Cash / Cr Loans Receivable, Interest Income, Penalty Income, Fee Income, Unapplied Credit            |
| Invoice advance    | Dr Invoice Receivables / Cr Cash                                                                        |
| Invoice settlement | Dr Cash (+ Dr Client Receivable for any shortfall) / Cr Invoice Receivables, Fee Income, Penalty Income, Client Payable |

### Server is the source of truth

The browser keeps **its own implementation** of the schedule and invoice maths in [frontend/src/lib/money/](frontend/src/lib/money/), so it can
preview instantly. It never decides anything that posts: every posting is recomputed on the server. A parity test (below) proves the two
implementations agree.

### Idempotency and concurrency

- Every posting endpoint requires an **`Idempotency-Key`** header. The same key with the same payload returns the original response. The same
  key with a different payload returns `409`. Money is never posted twice.
- The key is stored **in the same database transaction** as the posting, so either both are saved or neither is.
- Every write is a single transaction that takes the write lock from its first statement. Repayments lock the loan first, and settlements and
  approvals use compare-and-set, so concurrent requests move money exactly once.

---

## Architecture

```
/
├── README.md            ← you are here
├── CLAUDE.md            ← product brief and shared domain rules (with frontend/ and backend/ CLAUDE.md files)
├── NOTES.md             ← assumptions, manual verification, what was not done
├── package.json         ← npm workspaces: `npm run dev` / `npm test` run both ends
├── backend/             ← NestJS API
└── frontend/            ← React SPA (staff app + customer portal)
```

### Backend ([backend/](backend/))

```
backend/
├── prisma/schema.prisma + migrations/   ← SQLite schema (money columns are BigInt kobo)
├── scripts/prepare-database.mjs         ← creates .env on first run, applies migrations
├── src/
│   ├── common/          ← shared building blocks
│   │   ├── money/           kobo type, half-up rounding, limits
│   │   ├── dates/           calendar-date (YYYY-MM-DD) arithmetic
│   │   ├── validation/      @IsKobo, @IsCalendarDate, ValidationPipe → field errors
│   │   ├── errors/          AppError hierarchy + AllExceptionsFilter (one error envelope)
│   │   ├── idempotency/     @Idempotency() decorator + IdempotencyService
│   │   ├── auth/            @Public, @Roles, authenticated user
│   │   └── clock/           injectable clock (tests can fix "today")
│   ├── term-loans/domain/       ← pure schedule maths   (term-loan-schedule.ts)
│   ├── repayments/domain/       ← pure waterfall        (allocate-payment.ts)
│   ├── invoice-financing/domain ← pure fee/penalty/settlement maths
│   ├── ledger/domain/           ← chart of accounts, balanced journal entries, summaries
│   ├── term-loans/ repayments/ invoice-financing/ statements/   ← controllers, services, repositories
│   ├── loan-applications/ customer-documents/ notifications/
│   ├── customers/ loan-products/ users/ auth/ admin/
│   ├── portal/                  ← customer-portal auth (separate cookie + guard) and read models
│   └── parity/                  ← client ⇄ server parity spec
└── test/                        ← e2e suites (supertest against a real SQLite DB)
```

How the backend is organised:

- **Domain code is pure.** The money maths in each `*/domain/` folder has no Nest or Prisma imports and is unit-tested directly.
  Services coordinate the domain code, repositories and the ledger inside a single transaction.
- **Authentication:** a global `JwtAuthGuard` checks every route unless it is marked `@Public()`. Staff sessions use an HttpOnly cookie
  (`access_token`); a `Bearer` header is also accepted, which is handy for Postman or curl. Portal routes use their own cookie and
  `PortalAuthGuard`, so a staff session can never act as a customer and a customer session can never act as staff.
- **Error envelope.** Every error, from any route, has the same shape:

  ```json
  { "statusCode": 422, "code": "VALIDATION_FAILED", "message": "Validation failed",
    "errors": [{ "field": "principalKobo", "message": "principalKobo must be an integer number of kobo between 100000 and 500000000000" }] }
  ```

  The frontend maps `errors[].field` onto the matching form field.

### Frontend ([frontend/](frontend/))

```
frontend/src/
├── app/            ← router, layout, sidebar, top bar (notification bell), providers
├── components/     ← shared UI, layout and chart components
├── lib/
│   ├── money/      ← kobo helpers, parsing/formatting ₦, client-side schedule + invoice maths
│   ├── api/        ← httpClient + ApiValidationError (maps the error envelope to fields)
│   ├── dates/      ← calendar-date helpers
│   └── utils/      ← idempotency-key generation, live-quote hooks
├── features/       ← one folder per feature: api/ (queries), schemas/ (Zod), components/, pages/, __tests__/
│   ├── term-loans/  repayments/  invoice-financing/  statements/
│   ├── applications/  customers/  customer-documents/  collections/
│   ├── loan-products/  team/  admin-dashboard/  ledger/  notifications/
│   └── auth/  settings/  portal/
└── test/           ← test setup + the live contract test
```

How the frontend is organised:

- **Validated on both sides.** Zod schemas in each feature mirror the server's DTO rules for instant feedback. Server `422`s are still mapped
  back onto the same fields.
- **Server data goes through TanStack Query.** Each feature has a query-key factory and hooks, and mutations invalidate the views they
  affect. For example, a repayment refreshes the schedule and the statement.
- **Posting buttons create one `Idempotency-Key` per user intent**, so a double-click or a retry replays the original request instead of
  posting again.

#### Main routes

| Staff app                                   | Customer portal                       |
|---------------------------------------------|---------------------------------------|
| `/login`, `/accept-invite`                  | `/portal/login`, `/portal/accept-invite` |
| `/customers`, `/customers/:id`              | `/portal/loans`, `/portal/loans/:id`  |
| `/applications`, `/applications/:id`        | `/portal/invoices`, `/portal/invoices/:id` |
| `/loans`, `/loans/create`, `/loans/:id`, `/loans/:id/statement` | `/portal/applications`, `/portal/apply` |
| `/invoices`, `/invoices/create`, `/invoices/:id` | `/portal/documents`              |
| `/collections`, `/settings`                 |                                       |
| Admin only: `/admin`, `/ledger`, `/products`, `/team` |                             |

---

## API overview

The base URL is `http://localhost:3000`. All money fields are integer kobo, and all dates are `YYYY-MM-DD`. 🔑 marks endpoints that require an `Idempotency-Key` header.

| Area                | Endpoints |
|---------------------|-----------|
| **Auth (staff)**    | `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/change-password` · `GET /auth/invitations/:token` · `POST /auth/accept-invitation` |
| **Term loans**      | `POST /term-loans/quote` · `POST /term-loans` 🔑 · `GET /term-loans` · `GET /term-loans/:loanId` |
| **Repayments**      | `POST /term-loans/:loanId/repayments/preview` · `POST /term-loans/:loanId/repayments` 🔑 |
| **Statement**       | `GET /term-loans/:loanId/statement` |
| **Invoices**        | `POST /invoices/quote` · `POST /invoices` 🔑 · `GET /invoices` · `GET /invoices/:invoiceId` · `POST /invoices/:invoiceId/settlement/preview` · `POST /invoices/:invoiceId/settlement` 🔑 |
| **Applications**    | `GET/POST /loan-applications` · `GET /loan-applications/:id` · `POST …/:id/review` · `PATCH …/:id/assignment` · `POST …/:id/approve` 🔑 · `POST …/:id/reject` |
| **Customers**       | `GET/POST /customers` · `GET /customers/:id` · `PATCH /customers/:id/assignment` |
| **KYC documents**   | `GET/POST /customers/:id/documents` · `POST …/documents/requests` · `GET …/documents/:docId` · `POST …/documents/:docId/review` · `GET …/documents/:docId/file` |
| **Portal access**   | `GET/PATCH /customers/:id/portal-access` · `POST /customers/:id/portal-access/invitation` |
| **Loan products**   | `GET/POST /loan-products` · `GET/PATCH /loan-products/:id` · `GET /loan-products/:id/customers` |
| **Team**            | `GET /team/members` · `PATCH /team/members/:userId/status` · `GET/POST /team/invitations` · `DELETE /team/invitations/:id` |
| **Admin and ledger** | `GET /admin/dashboard` · `GET /collections/portfolio` · `GET /ledger` · `GET /ledger/search` |
| **Notifications**   | `GET /notifications` · `POST /notifications/read-all` · `POST /notifications/:id/read` |
| **Customer portal** | `/portal/auth/*` (login, logout, me, change-password, invitations) · `GET /portal/overview` · `GET /portal/loans[/:id]` · `GET /portal/invoices[/:id]` · `GET /portal/products` · `POST /portal/quote` · `GET/POST /portal/applications` · `GET/POST /portal/documents` · `/portal/notifications` |

The exact list of posting endpoints that require a key is set by the `@Idempotency()` parameter decorator in the controllers.

Example: quoting and creating a term loan with curl.

```bash
# 1. Log in (stores the session cookie)
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"admin@lender.test","password":"ChangeMe123!"}' http://localhost:3000/auth/login

# 2. Quote: ₦1,200,000 at 18% for 6 months
curl -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"principalKobo":120000000,"annualRatePercent":18,"termMonths":6}' \
  http://localhost:3000/term-loans/quote

# 3. Disburse (idempotent: run it twice with the same key and it posts once)
curl -b cookies.txt -H 'Content-Type: application/json' -H 'Idempotency-Key: 7f9c…' \
  -d '{"customerId":"…","loanProductId":"…","principalKobo":120000000,"annualRatePercent":18,"termMonths":6}' \
  http://localhost:3000/term-loans
```

---

## Testing

```bash
npm test     # backend unit → backend e2e → frontend
```

| Suite                         | Where                                                         | What it covers |
|-------------------------------|---------------------------------------------------------------|----------------|
| **Backend unit**              | `backend/src/**/*.spec.ts`                                    | Schedule maths (golden example, rounding boundaries, final-instalment clean-up), waterfall (partial, early payoff, over-payment), invoice fee/penalty/shortfall (days 0 / 95 / 96), journal balancing, date maths, document rules. |
| **Parity**                    | `backend/src/parity/client-server-parity.spec.ts`             | Imports **both** the frontend and backend maths and compares 255 generated loans (principal ₦1,000–₦5bn, rate 0.5–60% with fractions, term 1–60 months, plus edge cases and the golden example) and 250 invoices, kobo for kobo. Mutation-checked: breaking the client's rounding makes it fail. |
| **Backend e2e**               | `backend/test/*.e2e-spec.ts`                                  | The real HTTP API against SQLite: origination and journal, repayments and invoices, statements, applications, documents, portal isolation, role checks, idempotent replay, **concurrent** payments/settlements/approvals, and the append-only journal triggers. |
| **Frontend**                  | `frontend/src/**/__tests__/*.test.ts(x)` (Vitest + Testing Library) | Client money maths, ₦ parsing and formatting, mapping API errors onto form fields, the tie-out indicator, and the page flows. |
| **Live contract** (optional)  | `frontend/src/test/contract.live.test.ts`                     | Runs the parity check over HTTP against a running API. |

Run the live contract test while `npm run dev` is running:

```bash
CONTRACT_API_URL=http://localhost:3000 npm run test:contract -w frontend
```

Per-workspace verification (in the order the project uses):

```bash
npm run typecheck -w backend && npm test -w backend && npm run test:e2e -w backend && npm run lint -w backend && npm run build -w backend
npm run typecheck -w frontend && npm test -w frontend && npm run lint -w frontend && npm run build -w frontend
```

---

## Configuration

**`backend/.env`** (created from `.env.example` on first run outside production):

| Variable              | Default                   | Purpose |
|-----------------------|---------------------------|---------|
| `PORT`                | `3000`                    | API port |
| `DATABASE_PATH`       | `./data/lending.db`       | SQLite file (relative to `backend/`) |
| `FRONTEND_ORIGIN`     | `http://localhost:5173`   | CORS origin for the SPA |
| `JWT_SECRET`          | `change-me-…`             | Signs session tokens. **Set a long random value outside local dev.** |
| `SEED_ADMIN_EMAIL`    | `admin@lender.test`       | First administrator, created if missing |
| `SEED_ADMIN_PASSWORD` | `ChangeMe123!`            | Their initial password. **Change it after signing in.** |

**`frontend/.env`** (optional):

| Variable            | Default                  | Purpose |
|---------------------|--------------------------|---------|
| `VITE_API_BASE_URL` | `http://localhost:3000`  | Where the SPA sends API calls |

To **reset the data**, stop the app and delete `backend/data/`. The next `npm run dev` rebuilds the database and seeds the administrator again.

---

## Useful scripts

| Command                                   | Does |
|-------------------------------------------|------|
| `npm run dev`                             | Starts the API and the web app together (the API migrates first) |
| `npm test`                                | Runs every test suite |
| `npm run db:migrate -w backend`           | Applies pending Prisma migrations (also upgrades a pre-Prisma database file, keeping a backup) |
| `npm run db:studio -w backend`            | Opens Prisma Studio to browse the data |
| `npm run db:demo-customer -w backend`     | Gives a customer a portal login for local testing (refuses to run in production) |
| `npm run build -w backend` / `-w frontend` | Production builds (`backend/dist`, `frontend/dist`) |
| `npm start -w backend`                    | Migrates, then runs the built API |

---

## Known limitations

These are covered in full in [NOTES.md](NOTES.md):

- No reversal endpoint yet. `LedgerService.reverse` exists and is tested, but reversing a payment would also have to un-apply instalments, and the brief does not say how.
- No accrual job (income is recognised when collected, as the brief requires), no email delivery and no password reset.
- No pagination. The ledger view shows at most 2,000 lines, but its totals always cover everything.
- Customer details and user roles cannot be edited after creation.
