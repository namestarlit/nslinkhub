import type { ResourceKind } from "./common";
import type { IsoTimestamp } from "./envelope";

export interface Resource {
  id: string;
  collectionId: string;
  kind: ResourceKind;
  linkId: string | null;
  linkedCollectionId: string | null;
  url?: string;
  titleOverride: string | null;
  position: number;
  version: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface CreateExternalResourceRequest {
  url: string;
  titleOverride?: string;
  position: number;
}

export interface CreateCollectionLinkResourceRequest {
  linkedCollectionId: string;
  titleOverride?: string;
  position: number;
}

export interface UpdateResourceRequest {
  version: number;
  titleOverride?: string;
  position?: number;
}

export interface ReorderResourcesRequest {
  items: Array<{ resourceId: string; position: number; version: number }>;
}
