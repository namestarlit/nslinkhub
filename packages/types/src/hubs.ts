import type { Collection } from "./collections";
import type { HubRole, InvitationStatus, MembershipStatus } from "./common";
import type { IsoTimestamp } from "./envelope";

export interface HubSummary {
  id: string;
  name: string;
  description: string | null;
}

export interface HubPage {
  hub: HubSummary;
  collections: Collection[];
}

export interface HubMember {
  userId: string;
  username: string;
  name: string;
  role: HubRole;
  status: MembershipStatus;
  createdAt: IsoTimestamp;
}

export interface HubInvitation {
  id: string;
  email: string;
  role: Exclude<HubRole, "owner">;
  status: InvitationStatus;
  expiresAt: IsoTimestamp;
  createdAt: IsoTimestamp;
}

export interface CreateInvitationRequest {
  email: string;
  role: Exclude<HubRole, "owner">;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface ChangeRoleRequest {
  role: Exclude<HubRole, "owner">;
}

export interface TransferOwnershipRequest {
  userId: string;
}
