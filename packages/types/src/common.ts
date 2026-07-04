// Machine-token unions (lower_snake values per the casing convention).

export type HubRole = "owner" | "admin" | "member";
export type MembershipStatus = "active" | "suspended";
export type ShareRole = "reader" | "editor";
export type ShareSource = "direct" | "link";
export type ResourceKind = "external_link" | "collection_link";
export type ExportFormat = "pdf";
export type ExportStatus = "queued" | "running" | "completed" | "failed";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
