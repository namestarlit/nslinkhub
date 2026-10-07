import type { ResourceKind } from "./common.js";
import type { IsoTimestamp } from "./envelope.js";

export interface Resource {
  id: string;
  collectionId: string;
  kind: ResourceKind;
  url?: string;
  linkedCollectionId: string | null;
  /** Viewer-authorized destination metadata; null means unavailable. */
  linkedCollection?: { id: string; title: string } | null;
  titleOverride: string | null;
  tags: string[];
  position: number;
  version: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

// A link's title is resolved by the server, never sent.
export interface CreateExternalResourceRequest {
  url: string;
  tags?: string[];
  position: number;
}

// Only what people add is editable; an item's own content is fixed.
export interface UpdateResourceRequest {
  version: number;
  tags?: string[];
  position?: number;
}

export interface ReorderResourcesRequest {
  items: Array<{ resourceId: string; position: number; version: number }>;
}

export interface CreateCollectionResourceRequest {
  linkedCollectionId: string;
  tags?: string[];
  position: number;
}
export interface CreateHeadingResourceRequest {
  titleOverride: string;
  position: number;
}
