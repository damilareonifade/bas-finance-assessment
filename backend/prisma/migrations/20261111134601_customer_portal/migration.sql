-- Customer self-service portal: customer sign-ins, portal invitations and customer notifications; applications and documents
-- record when the customer submitted them online. CHECKs and triggers are hand-written (Prisma cannot express them).

-- CreateTable
CREATE TABLE "customer_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "last_login_at" TEXT,
    CONSTRAINT "customer_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("status" IN ('ACTIVE', 'DISABLED'))
);

-- CreateTable
CREATE TABLE "customer_portal_invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "accepted_at" TEXT,
    CONSTRAINT "customer_portal_invitations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "customer_portal_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REVOKED'))
);

-- CreateTable
CREATE TABLE "customer_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "created_at" TEXT NOT NULL,
    "read_at" TEXT,
    CONSTRAINT "customer_notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_customer_documents" (
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
    "submitted_by_customer" BOOLEAN NOT NULL DEFAULT false,
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
    CHECK ("status" IN ('REQUESTED', 'SUBMITTED', 'VERIFIED', 'REJECTED')),
    CHECK (NOT ("submitted_by_customer" AND "submitted_by" IS NOT NULL))
);
INSERT INTO "new_customer_documents" ("created_at", "customer_id", "file_mime", "file_name", "file_path", "file_size", "id", "identifier", "request_note", "requested_at", "requested_by", "review_note", "reviewed_at", "reviewed_by", "status", "submitted_at", "submitted_by", "type") SELECT "created_at", "customer_id", "file_mime", "file_name", "file_path", "file_size", "id", "identifier", "request_note", "requested_at", "requested_by", "review_note", "reviewed_at", "reviewed_by", "status", "submitted_at", "submitted_by", "type" FROM "customer_documents";
DROP TABLE "customer_documents";
ALTER TABLE "new_customer_documents" RENAME TO "customer_documents";
CREATE INDEX "customer_documents_customer_id_type_status_idx" ON "customer_documents"("customer_id", "type", "status");

-- RedefineTables dropped this table's hand-written guards (see 20261111000000_init) — re-created here.
CREATE TRIGGER "customer_documents_final_status" BEFORE UPDATE OF "status" ON "customer_documents"
WHEN OLD."status" IN ('VERIFIED', 'REJECTED') AND NEW."status" <> OLD."status"
BEGIN SELECT RAISE(ABORT, 'DOCUMENT_ALREADY_REVIEWED'); END;

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
CREATE TABLE "new_loan_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "loan_product_id" TEXT,
    "principal_kobo" BIGINT NOT NULL,
    "annual_rate_percent" REAL NOT NULL,
    "term_months" INTEGER NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL,
    "assigned_officer_id" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'STAFF',
    "submitted_by" TEXT,
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
    CONSTRAINT "loan_applications_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CHECK ("status" IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
    CHECK ("principal_kobo" > 0),
    CHECK ("term_months" > 0),
    CHECK ("channel" IN ('STAFF', 'PORTAL')),
    CHECK (("channel" = 'STAFF' AND "submitted_by" IS NOT NULL) OR ("channel" = 'PORTAL' AND "submitted_by" IS NULL))
);
INSERT INTO "new_loan_applications" ("annual_rate_percent", "assigned_officer_id", "customer_id", "decided_at", "decided_by", "id", "loan_id", "loan_product_id", "principal_kobo", "purpose", "rejection_reason", "review_started_at", "reviewed_by", "status", "submitted_at", "submitted_by", "term_months") SELECT "annual_rate_percent", "assigned_officer_id", "customer_id", "decided_at", "decided_by", "id", "loan_id", "loan_product_id", "principal_kobo", "purpose", "rejection_reason", "review_started_at", "reviewed_by", "status", "submitted_at", "submitted_by", "term_months" FROM "loan_applications";
DROP TABLE "loan_applications";
ALTER TABLE "new_loan_applications" RENAME TO "loan_applications";
CREATE UNIQUE INDEX "loan_applications_loan_id_key" ON "loan_applications"("loan_id");
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");
CREATE INDEX "loan_applications_customer_id_idx" ON "loan_applications"("customer_id");
CREATE INDEX "loan_applications_assigned_officer_id_idx" ON "loan_applications"("assigned_officer_id");
CREATE INDEX "loan_applications_decided_by_idx" ON "loan_applications"("decided_by");

-- RedefineTables dropped this table's hand-written guard (see 20261111000000_init) — re-created here.
CREATE TRIGGER "loan_applications_final_status" BEFORE UPDATE OF "status" ON "loan_applications"
WHEN OLD."status" IN ('APPROVED', 'REJECTED') AND NEW."status" <> OLD."status"
BEGIN SELECT RAISE(ABORT, 'APPLICATION_ALREADY_DECIDED'); END;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_customer_id_key" ON "customer_accounts"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_email_key" ON "customer_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_portal_invitations_token_hash_key" ON "customer_portal_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "customer_portal_invitations_customer_id_status_idx" ON "customer_portal_invitations"("customer_id", "status");

-- CreateIndex
CREATE INDEX "customer_notifications_customer_id_read_at_idx" ON "customer_notifications"("customer_id", "read_at");
