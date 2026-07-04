export interface ImportTargetRequest {
  targetCollectionId?: string;
  createCollection?: boolean;
  collectionTitle?: string;
  collectionSlug?: string;
}

export interface ImportResult {
  totalRows: number;
  processedRows: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ row: number; reason: string; value: string }>;
}
