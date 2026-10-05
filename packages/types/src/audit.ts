import type { IsoTimestamp } from "./envelope.js";

export type AuditAction =
  | "collection.published"
  | "collection.unpublished"
  | "collection.deleted"
  | "collection.transferred_out"
  | "collection.transferred_in"
  | "share.granted"
  | "share.revoked"
  | "link.enabled"
  | "link.rotated"
  | "link.disabled"
  | "hub.handle_changed"
  | "audit.read";

export interface AuditEntry {
  id: string;
  hubId: string;
  actorUserId: string;
  collectionId: string | null;
  targetUserId: string | null;
  action: AuditAction;
  role: "reader" | "editor" | null;
  createdAt: IsoTimestamp;
}
