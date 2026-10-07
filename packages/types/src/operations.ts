export const operationReasons = [
  "spam",
  "harmful_content",
  "account_compromise",
  "owner_request",
  "mistake_corrected",
  "review_completed",
  "access_administration",
] as const;
export type OperationReason = (typeof operationReasons)[number];
export const operationActions = [
  "account.suspend",
  "account.reactivate",
  "sessions.revoke",
  "collection.hold",
  "collection.release",
] as const;
export type OperationAction = (typeof operationActions)[number];
export interface OperationCommand {
  action: OperationAction;
  targetId: string;
  reason: OperationReason;
  version: number;
  operationId: string;
}
export interface OperationResult {
  action: OperationAction;
  targetId: string;
  state: string;
  version: number;
}
export interface SessionView {
  email: string;
  // Notifications newer than the last time the account opened Notifications.
  unreadNotifications: number;
  userId: string;
  name: string;
  operator: boolean;
  admin: boolean;
}
export interface OperatorAccount {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  hub: { id: string; handle: string } | null;
  createdAt: string;
  state: "active" | "suspended";
  version: number;
  sessions: number;
  operator: boolean;
  admin: boolean;
}
export interface OperatorCollection {
  id: string;
  hubId: string;
  hubHandle: string | null;
  held: boolean;
  version: number;
  reason: OperationReason | null;
  updatedAt: string | null;
}
export interface OperatorAuditEntry {
  id: string;
  createdAt: string;
  actorKind: "user" | "deployment" | "invitee";
  actorUserId: string | null;
  /** The actor's hub handle, when they have a hub. */
  actorHandle: string | null;
  authority: string | null;
  targetUserId: string | null;
  /** The target account's hub handle, when it has a hub. */
  targetHandle: string | null;
  collectionId: string | null;
  invitationId: string | null;
  action: string;
  reason: OperationReason | null;
  outcome: string;
  beforeState: string | null;
  afterState: string | null;
}

export interface ServiceInvitationView {
  id: string;
  role: "admin" | "operator";
  email: string;
  state: "pending" | "verifying" | "accepted" | "declined" | "cancelled" | "expired";
  version: number;
  createdAt: string;
  expiresAt: string;
  delivery: string | null;
}
// Notification center item. Today every notification is a service invitation;
// newest first with unread items leading.
export interface NotificationView {
  id: string;
  kind: "service_invitation";
  role: ServiceInvitationView["role"];
  state: ServiceInvitationView["state"];
  createdAt: string;
  unread: boolean;
}
export interface InvitationResult {
  id: string;
  state: string;
  version: number;
}

export interface InvitationPreview {
  id: string;
  role: "admin" | "operator";
  email: string;
  state: string;
  version: number;
  expiresAt: string;
  needsName: boolean;
  session: "match" | "mismatch" | "none";
}
export interface InvitationAcceptance {
  email: string;
  state: string;
  signedIn: boolean;
}

// Every action the operator audit records, grouped for the audit filter.
export const operatorAuditActions = [
  "account.suspend",
  "account.reactivate",
  "sessions.revoke",
  "collection.hold",
  "collection.release",
  "invitation.create",
  "invitation.resend",
  "invitation.cancel",
  "invitation.accept_requested",
  "invitation.verified",
  "invitation.decline",
  "operator.revoke",
  "admin.invitation_refreshed",
  "account.handover",
  "accounts.list",
  "accounts.lookup",
  "collections.list",
  "account.read",
  "collection.inspect",
  "operators.list",
  "invitations.list",
  "audit.read",
  "access.denied",
  "action.denied",
] as const;
export type OperatorAuditAction = (typeof operatorAuditActions)[number];
