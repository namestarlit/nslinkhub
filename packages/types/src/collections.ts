import type { ShareRole, ShareSource } from "./common";
import type { IsoTimestamp } from "./envelope";

export interface Collection {
  id: string;
  hubId: string;
  slug: string;
  title: string;
  description: string | null;
  published: boolean;
  linkSharingEnabled: boolean;
  parentCollectionId: string | null;
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
  username: string;
  role: ShareRole;
  source: ShareSource;
}

export interface CreateCollectionRequest {
  slug: string;
  title: string;
  description?: string;
  published?: boolean;
}

export interface UpdateCollectionRequest {
  version: number;
  slug?: string;
  title?: string;
  description?: string;
  published?: boolean;
}

// Nest an existing collection into another as a section (the one nesting path).
export interface NestCollectionRequest {
  collectionId: string;
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
