-- CreateTable
CREATE TABLE "audit_records" (
    "id" UUID NOT NULL DEFAULT app_uuid_v7(),
    "hub_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "collection_id" UUID,
    "target_user_id" UUID,
    "action" VARCHAR(48) NOT NULL,
    "role" VARCHAR(16),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_budgets" (
    "key" VARCHAR(80) NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "request_budgets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "idx_audit_hub_created" ON "audit_records"("hub_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "idx_request_budgets_expires" ON "request_budgets"("expires_at");

-- Reviewed additions only: no existing SQL-only invariants are touched.
ALTER TABLE audit_records ADD CONSTRAINT audit_action_check CHECK (action IN (
  'collection.published', 'collection.unpublished', 'collection.deleted',
  'collection.transferred_out', 'collection.transferred_in', 'share.granted',
  'share.revoked', 'link.enabled', 'link.rotated', 'link.disabled',
  'hub.handle_changed', 'audit.read'
));
ALTER TABLE audit_records ADD CONSTRAINT audit_role_check CHECK (role IS NULL OR role IN ('reader', 'editor'));
ALTER TABLE request_budgets ADD CONSTRAINT request_budget_count_check CHECK (count > 0);
