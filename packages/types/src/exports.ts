import type { ExportFormat } from "./common";

// Export is synchronous: POST /exports responds with the file itself
// (Content-Disposition attachment) — one document per collection, zipped when
// several collections are selected. There is no job to poll.
export interface CreateExportRequest {
  format: ExportFormat;
  /** Collections to export, one document each (max 20). */
  collectionIds: string[];
  /** Expand sub-collections as sections (default true); false collapses them to a line. */
  expand?: boolean;
}
