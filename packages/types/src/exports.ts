import type { ExportFormat, ExportStatus } from "./common";
import type { IsoTimestamp } from "./envelope";

export interface ExportJob {
  id: string;
  hubId: string;
  collectionId: string;
  requestedByUserId: string | null;
  format: ExportFormat;
  status: ExportStatus;
  outputRef: string | null;
  errorMessage: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface MarkdownExport {
  collectionId: string;
  format: "markdown";
  content: string;
}
