-- CreateTable
CREATE TABLE "email_change_intents" (
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "current_email" TEXT NOT NULL,
    "new_email" TEXT NOT NULL,
    "phase" VARCHAR(16) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_change_intents_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL DEFAULT app_uuid_v7(),
    "challenge_key" VARCHAR(64) NOT NULL,
    "recipient_key" VARCHAR(64) NOT NULL,
    "payload" TEXT,
    "state" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "lease_until" TIMESTAMPTZ(6),
    "lease_token" UUID,
    "provider_id" TEXT,
    "outcome" VARCHAR(24),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_webhooks" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppressions" (
    "recipient_key" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(24) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("recipient_key")
);

-- CreateTable
CREATE TABLE "auth_audit" (
    "id" UUID NOT NULL DEFAULT app_uuid_v7(),
    "user_id" UUID,
    "action" VARCHAR(32) NOT NULL,
    "outcome" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_change_intents_expires_at_idx" ON "email_change_intents"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_outbox_provider_id_key" ON "email_outbox"("provider_id");

-- CreateIndex
CREATE INDEX "email_outbox_state_available_at_idx" ON "email_outbox"("state", "available_at");

-- CreateIndex
CREATE INDEX "email_outbox_expires_at_idx" ON "email_outbox"("expires_at");

-- CreateIndex
CREATE INDEX "email_outbox_challenge_key_idx" ON "email_outbox"("challenge_key");

-- CreateIndex
CREATE INDEX "auth_audit_created_at_idx" ON "auth_audit"("created_at");

-- Reviewed additive migration: existing UUID functions, triggers and partial
-- indexes remain untouched. Workflow/proof and delivery states stay bounded.
ALTER TABLE email_change_intents ADD CONSTRAINT email_change_phase CHECK (phase IN ('current','new'));
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_state CHECK (state IN ('pending','sent','failed','expired','cancelled','suppressed'));
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_attempts CHECK (attempts >= 0);
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_terminal_payload CHECK (state = 'pending' OR payload IS NULL);
