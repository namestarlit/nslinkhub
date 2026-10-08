-- CreateTable
CREATE TABLE "link_metadata" (
    "id" UUID NOT NULL DEFAULT app_uuid_v7(),
    "url" TEXT NOT NULL,
    "title" VARCHAR(255),
    "description" VARCHAR(500),
    "site_name" VARCHAR(120),
    "state" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMPTZ(6),
    "lease_token" UUID,
    "fetched_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "link_metadata_url_key" ON "link_metadata"("url");

-- CreateIndex
CREATE INDEX "link_metadata_state_available_at_idx" ON "link_metadata"("state", "available_at");

-- Hand-written: constraints, the updated_at trigger, and registering existing
-- link addresses. A link item no longer stores a title; its page metadata lives
-- here, once per address, shared by everyone who saves it — so only text read
-- from the page may enter it. Old link titles (which could be typed by a person
-- or taken from an import file) are not copied: every address starts pending
-- and the worker fetches it. Headings keep their text in title_override.
ALTER TABLE "link_metadata"
    ADD CONSTRAINT "link_metadata_state_check" CHECK ("state" IN ('pending', 'ready', 'failed')),
    ADD CONSTRAINT "link_metadata_attempts_check" CHECK ("attempts" >= 0);

CREATE TRIGGER link_metadata_set_updated_at BEFORE UPDATE ON public.link_metadata FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO "link_metadata" ("url")
SELECT DISTINCT "url" FROM "resources"
WHERE "kind" = 'external_link' AND "url" IS NOT NULL
ON CONFLICT ("url") DO NOTHING;

UPDATE "resources" SET "title_override" = NULL WHERE "kind" = 'external_link';
