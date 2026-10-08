-- AlterTable
ALTER TABLE "audit_records" ADD COLUMN     "resource_id" UUID;

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "added_by_user_id" UUID;

-- CreateIndex
CREATE INDEX "idx_audit_collection_created" ON "audit_records"("collection_id", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Hand-written: the audit action list grows with content changes (ADR-0015).
ALTER TABLE "audit_records" DROP CONSTRAINT "audit_action_check";
ALTER TABLE "audit_records" ADD CONSTRAINT "audit_action_check" CHECK ("action" IN (
    'collection.published',
    'collection.unpublished',
    'collection.deleted',
    'collection.transferred_out',
    'collection.transferred_in',
    'share.granted',
    'share.revoked',
    'link.enabled',
    'link.rotated',
    'link.disabled',
    'hub.handle_changed',
    'hub.name_changed',
    'audit.read',
    'collection.created',
    'collection.updated',
    'item.link_added',
    'item.reference_added',
    'item.section_added',
    'item.updated',
    'item.removed',
    'items.reordered',
    'items.imported',
    'comment.hidden',
    'comment.shown',
    'comment.answer_marked',
    'comment.answer_unmarked'
));

-- Hand-written backfill: every existing collection gets its creation entry
-- (its creator, at its creation time), so attribution starts from what is
-- known. Who added older items is unknown and stays null rather than guessed.
INSERT INTO "audit_records" ("hub_id", "actor_user_id", "collection_id", "action", "created_at")
SELECT c."hub_id", c."creator_user_id", c."id", 'collection.created', c."created_at"
FROM "collections" c
WHERE c."creator_user_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "audit_records" a
    WHERE a."collection_id" = c."id" AND a."action" = 'collection.created'
  );
