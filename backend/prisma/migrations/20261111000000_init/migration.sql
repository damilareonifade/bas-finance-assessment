-- CreateTable
CREATE TABLE "sequences" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_json" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    CHECK ("role" IN ('ADMIN', 'LOAN_OFFICER')),
    CHECK ("status" IN ('ACTIVE', 'DISABLED'))
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "accepted_at" TEXT,
    CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("role" IN ('ADMIN', 'LOAN_OFFICER')),
    CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REVOKED'))
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "assigned_officer_id" TEXT,
    "created_by" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "customers_assigned_officer_id_fkey" FOREIGN KEY ("assigned_officer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "min_principal_kobo" BIGINT NOT NULL,
    "max_principal_kobo" BIGINT NOT NULL,
    "min_annual_rate_percent" REAL,
    "max_annual_rate_percent" REAL,
    "min_term_months" INTEGER,
    "max_term_months" INTEGER,
    "status" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "loan_products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CHECK ("type" IN ('TERM_LOAN', 'INVOICE_FINANCING')),
    CHECK ("status" IN ('ACTIVE', 'ARCHIVED')),
    CHECK ("min_principal_kobo" > 0),
    CHECK ("min_principal_kobo" <= "max_principal_kobo")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "posted_on" TEXT NOT NULL,
    "loan_id" TEXT,
    "invoice_id" TEXT,
    "customer_id" TEXT,
    "reverses_entry_id" TEXT,
    "created_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "entry_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "account" TEXT NOT NULL,
    "debit_kobo" BIGINT NOT NULL,
    "credit_kobo" BIGINT NOT NULL,

    PRIMARY KEY ("entry_id", "line_no"),
    CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("debit_kobo" >= 0),
    CHECK ("credit_kobo" >= 0),
    CHECK (("debit_kobo" > 0 AND "credit_kobo" = 0) OR ("credit_kobo" > 0 AND "debit_kobo" = 0))
);

-- CreateTable
CREATE TABLE "term_loans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT,
    "loan_product_id" TEXT,
    "principal_kobo" BIGINT NOT NULL,
    "annual_rate_percent" REAL NOT NULL,
    "term_months" INTEGER NOT NULL,
    "instalment_kobo" BIGINT NOT NULL,
    "disbursed_on" TEXT NOT NULL,
    "unapplied_credit_kobo" BIGINT NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TEXT,
    "assigned_officer_id" TEXT,
    "application_id" TEXT,
    "lock_version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "term_loans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "term_loans_loan_product_id_fkey" FOREIGN KEY ("loan_product_id") REFERENCES "loan_products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "term_loans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "term_loans_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "term_loans_assigned_officer_id_fkey" FOREIGN KEY ("assigned_officer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CHECK ("principal_kobo" > 0),
    CHECK ("instalment_kobo" > 0),
    CHECK ("term_months" > 0),
    CHECK ("unapplied_credit_kobo" >= 0)
);

-- CreateTable
CREATE TABLE "loan_instalments" (
    "loan_id" TEXT NOT NULL,
    "instalment_number" INTEGER NOT NULL,
    "due_date" TEXT NOT NULL,
    "payment_kobo" BIGINT NOT NULL,
    "interest_kobo" BIGINT NOT NULL,
    "principal_kobo" BIGINT NOT NULL,
    "closing_balance_kobo" BIGINT NOT NULL,
    "penalty_paid_kobo" BIGINT NOT NULL DEFAULT 0,
    "fee_paid_kobo" BIGINT NOT NULL DEFAULT 0,
    "interest_paid_kobo" BIGINT NOT NULL DEFAULT 0,
    "principal_paid_kobo" BIGINT NOT NULL DEFAULT 0,

    PRIMARY KEY ("loan_id", "instalment_number"),
    CONSTRAINT "loan_instalments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "term_loans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("penalty_paid_kobo" >= 0),
    CHECK ("fee_paid_kobo" >= 0),
    CHECK ("interest_paid_kobo" BETWEEN 0 AND "interest_kobo"),
    CHECK ("principal_paid_kobo" BETWEEN 0 AND "principal_kobo")
);

-- CreateTable
CREATE TABLE "repayments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loan_id" TEXT NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "payment_date" TEXT NOT NULL,
    "allocation_json" TEXT NOT NULL,
    "unapplied_kobo" BIGINT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "repayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "term_loans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "repayments_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "repayments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CHECK ("amount_kobo" > 0),
    CHECK ("unapplied_kobo" >= 0)
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT,
    "loan_product_id" TEXT,
    "face_value_kobo" BIGINT NOT NULL,
    "issue_date" TEXT NOT NULL,
    "due_date" TEXT NOT NULL,
    "tenor_days" INTEGER NOT NULL,
    "advance_kobo" BIGINT NOT NULL,
    "reserve_kobo" BIGINT NOT NULL,
    "discount_fee_kobo" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invoices_loan_product_id_fkey" FOREIGN KEY ("loan_product_id") REFERENCES "loan_products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CHECK ("status" IN ('ADVANCED', 'SETTLED')),
    CHECK ("face_value_kobo" > 0),
    CHECK ("tenor_days" > 0)
);

-- CreateTable
CREATE TABLE "invoice_settlements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "settlement_date" TEXT NOT NULL,
    "days_overdue" INTEGER NOT NULL,
    "discount_fee_kobo" BIGINT NOT NULL,
    "late_penalty_kobo" BIGINT NOT NULL,
    "total_charges_kobo" BIGINT NOT NULL,
    "client_receives_kobo" BIGINT NOT NULL,
    "client_owes_kobo" BIGINT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "invoice_settlements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoice_settlements_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("client_receives_kobo" >= 0),
    CHECK ("client_owes_kobo" >= 0),
    CHECK (NOT ("client_receives_kobo" > 0 AND "client_owes_kobo" > 0))
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "loan_product_id" TEXT,
    "principal_kobo" BIGINT NOT NULL,
    "annual_rate_percent" REAL NOT NULL,
    "term_months" INTEGER NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL,
    "assigned_officer_id" TEXT,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "review_started_at" TEXT,
    "decided_by" TEXT,
    "decided_at" TEXT,
    "rejection_reason" TEXT,
    "loan_id" TEXT,
    CONSTRAINT "loan_applications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_loan_product_id_fkey" FOREIGN KEY ("loan_product_id") REFERENCES "loan_products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_assigned_officer_id_fkey" FOREIGN KEY ("assigned_officer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CHECK ("status" IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
    CHECK ("principal_kobo" > 0),
    CHECK ("term_months" > 0)
);

-- CreateTable
CREATE TABLE "customer_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "identifier" TEXT,
    "file_name" TEXT,
    "file_path" TEXT,
    "file_mime" TEXT,
    "file_size" INTEGER,
    "request_note" TEXT,
    "requested_by" TEXT,
    "requested_at" TEXT,
    "submitted_by" TEXT,
    "submitted_at" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TEXT,
    "review_note" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "customer_documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "customer_documents_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customer_documents_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customer_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CHECK ("type" IN ('BVN', 'NIN', 'PASSPORT', 'DRIVERS_LICENCE', 'BANK_STATEMENT', 'UTILITY_BILL', 'OTHER')),
    CHECK ("status" IN ('REQUESTED', 'SUBMITTED', 'VERIFIED', 'REJECTED'))
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "created_at" TEXT NOT NULL,
    "read_at" TEXT,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_email_status_idx" ON "invitations"("email", "status");

-- CreateIndex
CREATE INDEX "customers_assigned_officer_id_idx" ON "customers"("assigned_officer_id");

-- CreateIndex
CREATE INDEX "customers_created_at_idx" ON "customers"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "loan_products_name_key" ON "loan_products"("name");

-- CreateIndex
CREATE INDEX "loan_products_status_idx" ON "loan_products"("status");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reverses_entry_id_key" ON "journal_entries"("reverses_entry_id");

-- CreateIndex
CREATE INDEX "journal_entries_loan_id_idx" ON "journal_entries"("loan_id");

-- CreateIndex
CREATE INDEX "journal_entries_invoice_id_idx" ON "journal_entries"("invoice_id");

-- CreateIndex
CREATE INDEX "journal_entries_customer_id_idx" ON "journal_entries"("customer_id");

-- CreateIndex
CREATE INDEX "journal_lines_account_idx" ON "journal_lines"("account");

-- CreateIndex
CREATE UNIQUE INDEX "term_loans_application_id_key" ON "term_loans"("application_id");

-- CreateIndex
CREATE INDEX "term_loans_customer_id_idx" ON "term_loans"("customer_id");

-- CreateIndex
CREATE INDEX "term_loans_loan_product_id_idx" ON "term_loans"("loan_product_id");

-- CreateIndex
CREATE INDEX "term_loans_approved_by_idx" ON "term_loans"("approved_by");

-- CreateIndex
CREATE INDEX "term_loans_assigned_officer_id_idx" ON "term_loans"("assigned_officer_id");

-- CreateIndex
CREATE INDEX "term_loans_disbursed_on_idx" ON "term_loans"("disbursed_on");

-- CreateIndex
CREATE UNIQUE INDEX "repayments_journal_entry_id_key" ON "repayments"("journal_entry_id");

-- CreateIndex
CREATE INDEX "repayments_loan_id_idx" ON "repayments"("loan_id");

-- CreateIndex
CREATE INDEX "repayments_payment_date_idx" ON "repayments"("payment_date");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE INDEX "invoices_loan_product_id_idx" ON "invoices"("loan_product_id");

-- CreateIndex
CREATE INDEX "invoices_issue_date_idx" ON "invoices"("issue_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_settlements_invoice_id_key" ON "invoice_settlements"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_settlements_journal_entry_id_key" ON "invoice_settlements"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_loan_id_key" ON "loan_applications"("loan_id");

-- CreateIndex
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");

-- CreateIndex
CREATE INDEX "loan_applications_customer_id_idx" ON "loan_applications"("customer_id");

-- CreateIndex
CREATE INDEX "loan_applications_assigned_officer_id_idx" ON "loan_applications"("assigned_officer_id");

-- CreateIndex
CREATE INDEX "loan_applications_decided_by_idx" ON "loan_applications"("decided_by");

-- CreateIndex
CREATE INDEX "customer_documents_customer_id_type_status_idx" ON "customer_documents"("customer_id", "type", "status");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");


-- ─────────────────────────────────────────────────────────────────────────────
-- Guards Prisma cannot express. Hand-written: keep them if a later migration redefines these tables
-- (test/database-guards.e2e-spec.ts fails when one goes missing).
-- ─────────────────────────────────────────────────────────────────────────────

-- The journal is append-only: corrections are reversing entries, never UPDATE / DELETE.
CREATE TRIGGER "journal_entries_no_update" BEFORE UPDATE ON "journal_entries" BEGIN SELECT RAISE(ABORT, 'JOURNAL_IMMUTABLE'); END;
CREATE TRIGGER "journal_entries_no_delete" BEFORE DELETE ON "journal_entries" BEGIN SELECT RAISE(ABORT, 'JOURNAL_IMMUTABLE'); END;
CREATE TRIGGER "journal_lines_no_update" BEFORE UPDATE ON "journal_lines" BEGIN SELECT RAISE(ABORT, 'JOURNAL_IMMUTABLE'); END;
CREATE TRIGGER "journal_lines_no_delete" BEFORE DELETE ON "journal_lines" BEGIN SELECT RAISE(ABORT, 'JOURNAL_IMMUTABLE'); END;

-- Decided applications, settled invoices and reviewed documents never change state again.
CREATE TRIGGER "loan_applications_final_status" BEFORE UPDATE OF "status" ON "loan_applications"
WHEN OLD."status" IN ('APPROVED', 'REJECTED') AND NEW."status" <> OLD."status"
BEGIN SELECT RAISE(ABORT, 'APPLICATION_ALREADY_DECIDED'); END;

CREATE TRIGGER "invoices_final_status" BEFORE UPDATE OF "status" ON "invoices"
WHEN OLD."status" = 'SETTLED' AND NEW."status" <> OLD."status"
BEGIN SELECT RAISE(ABORT, 'INVOICE_ALREADY_SETTLED'); END;

CREATE TRIGGER "customer_documents_final_status" BEFORE UPDATE OF "status" ON "customer_documents"
WHEN OLD."status" IN ('VERIFIED', 'REJECTED') AND NEW."status" <> OLD."status"
BEGIN SELECT RAISE(ABORT, 'DOCUMENT_ALREADY_REVIEWED'); END;

-- At most one open (requested or awaiting review) document per customer and type.
CREATE TRIGGER "customer_documents_one_open_insert" BEFORE INSERT ON "customer_documents"
WHEN NEW."status" IN ('REQUESTED', 'SUBMITTED') AND EXISTS (
  SELECT 1 FROM "customer_documents"
   WHERE "customer_id" = NEW."customer_id" AND "type" = NEW."type" AND "status" IN ('REQUESTED', 'SUBMITTED'))
BEGIN SELECT RAISE(ABORT, 'DOCUMENT_ALREADY_OPEN'); END;

CREATE TRIGGER "customer_documents_one_open_update" BEFORE UPDATE OF "status" ON "customer_documents"
WHEN NEW."status" IN ('REQUESTED', 'SUBMITTED') AND EXISTS (
  SELECT 1 FROM "customer_documents"
   WHERE "customer_id" = NEW."customer_id" AND "type" = NEW."type" AND "status" IN ('REQUESTED', 'SUBMITTED') AND "id" <> NEW."id")
BEGIN SELECT RAISE(ABORT, 'DOCUMENT_ALREADY_OPEN'); END;

-- Product names are unique ignoring case ("SME Loan" and "sme loan" are the same product).
CREATE TRIGGER "loan_products_name_unique_insert" BEFORE INSERT ON "loan_products"
WHEN EXISTS (SELECT 1 FROM "loan_products" WHERE lower("name") = lower(NEW."name"))
BEGIN SELECT RAISE(ABORT, 'PRODUCT_NAME_TAKEN'); END;

CREATE TRIGGER "loan_products_name_unique_update" BEFORE UPDATE OF "name" ON "loan_products"
WHEN EXISTS (SELECT 1 FROM "loan_products" WHERE lower("name") = lower(NEW."name") AND "id" <> NEW."id")
BEGIN SELECT RAISE(ABORT, 'PRODUCT_NAME_TAKEN'); END;
