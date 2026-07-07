import type { ResourceKind } from "./common";
import type { IsoTimestamp } from "./envelope";

export interface Resource {
  id: string;
  collectionId: string;
  kind: ResourceKind;
  url?: string;
  linkedCollectionId: string | null;
  titleOverride: string | null;
  tags: string[];
  position: number;
  version: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface CreateExternalResourceRequest {
  url: string;
  titleOverride?: string;
  tags?: string[];
  position: number;
}

export interface UpdateResourceRequest {
  version: number;
  titleOverride?: string;
  tags?: string[];
  position?: number;
}

export interface ReorderResourcesRequest {
  items: Array<{ resourceId: string; position: number; version: number }>;
}
