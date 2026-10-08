import type { IsoTimestamp, PersonRef } from "./envelope.js";

export const auditActions = [
  "collection.published",
  "collection.unpublished",
  "collection.deleted",
  "collection.transferred_out",
  "collection.transferred_in",
  "share.granted",
  "share.revoked",
  "link.enabled",
  "link.rotated",
  "link.disabled",
  "hub.handle_changed",
  "hub.name_changed",
  "audit.read",
  // Content changes (ADR-0015): attribution is derived from these.
  "collection.created",
  "collection.updated",
  "item.link_added",
  "item.reference_added",
  "item.section_added",
  "item.updated",
  "item.removed",
  "items.reordered",
  "items.imported",
  "comment.hidden",
  "comment.shown",
  "comment.answer_marked",
  "comment.answer_unmarked",
] as const;
export type AuditAction = (typeof auditActions)[number];

/** Actions that shape a collection's content: their actors are its contributors. */
export const contentActions = [
  "collection.created",
  "collection.updated",
  "item.link_added",
  "item.reference_added",
  "item.section_added",
  "item.updated",
  "item.removed",
  "items.reordered",
  "items.imported",
] as const satisfies readonly AuditAction[];

export interface AuditEntry {
  id: string;
  hubId: string;
  actorUserId: string;
  collectionId: string | null;
  targetUserId: string | null;
  resourceId: string | null;
  action: AuditAction;
  role: "reader" | "editor" | null;
  createdAt: IsoTimestamp;
}

// One change in a collection's history, as its contributors see it. `item` is
// the item as it is now (null once removed); people appear as everywhere else.
export interface ActivityEntry {
  id: string;
  action: AuditAction;
  actor: PersonRef | null;
  /** The person acted on: shared with, transferred to, whose comment. */
  target: PersonRef | null;
  item: { id: string; kind: import("./common.js").ResourceKind; title: string | null } | null;
  createdAt: IsoTimestamp;
}
