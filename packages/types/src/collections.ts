import type { ShareRole, ShareSource } from "./common.js";
import type { IsoTimestamp } from "./envelope.js";

export interface Collection {
  hub?: { id: string; handle: string; name: string };
  // Who created the collection (immutable provenance; may differ from the owner
  // after a transfer). Present on single-collection reads; null if unavailable.
  creator?: import("./envelope.js").PersonRef | null;
  // Everyone who has shaped its content, most recent first (up to five), and
  // how many there are. Present on single-collection reads.
  contributors?: { people: import("./envelope.js").PersonRef[]; total: number };
  /** canManage: the owner; canEdit: a contributor (owner or editor). */
  capabilities?: { canManage: boolean; canEdit: boolean };
  restriction?: { reason: import("./operations.js").OperationReason; supportUrl: string };
  id: string;
  hubId: string;
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  published: boolean;
  linkSharingEnabled: boolean;
  commentsEnabled: boolean;
  version: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface SharedCollection extends Collection {
  shareRole: ShareRole;
  shareSource: ShareSource;
}

export interface SavedCollection extends Collection {
  savedAt: IsoTimestamp;
  available: boolean;
}

export interface CollectionShareView {
  userId: string;
  displayName: string;
  /** Present for direct shares (the owner supplied it); null for link-source shares. */
  email: string | null;
  role: ShareRole;
  source: ShareSource;
}

export interface CreateCollectionRequest {
  slug: string;
  title: string;
  description?: string;
  tags?: string[];
  published?: boolean;
}

export interface UpdateCollectionRequest {
  version: number;
  slug?: string;
  title?: string;
  description?: string;
  tags?: string[];
  published?: boolean;
}

export interface SetLinkSharingRequest {
  enabled: boolean;
  rotate?: boolean;
}

export interface LinkSharingResult {
  collectionId: string;
  linkSharingEnabled: boolean;
  token?: string;
  queryParam?: string;
}

export interface CreateShareRequest {
  email: string;
  role?: ShareRole;
}
