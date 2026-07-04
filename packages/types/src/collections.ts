import type { IsoTimestamp } from './envelope';
import type { ShareRole, ShareSource } from './common';

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
  parentCollectionId?: string;
}

export interface UpdateCollectionRequest {
  version: number;
  slug?: string;
  title?: string;
  description?: string;
  published?: boolean;
  parentCollectionId?: string | null;
}

export type CreateChildCollectionRequest = Omit<
  CreateCollectionRequest,
  'parentCollectionId'
>;

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
