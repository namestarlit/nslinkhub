// Format-agnostic export document. Mirrors how the collection reads as a
// document: root collection = H1 + description, expanded sub-collections =
// H2 sections. The two-level nesting cap means sections never nest further.
export interface ExportLink {
  kind: "link";
  title: string;
  url: string;
}

// A sub-collection rendered as a titled section (expand: true, the default).
export interface ExportSection {
  kind: "section";
  title: string;
  description?: string;
  links: ExportLink[];
}

// A sub-collection collapsed to a single line (expand: false).
export interface ExportCollectionRef {
  kind: "collection_ref";
  title: string;
}

export type ExportItem = ExportLink | ExportSection | ExportCollectionRef;

export interface ExportDocument {
  title: string;
  description?: string;
  items: ExportItem[];
}

export type ExportFormat = "markdown" | "pdf" | "docx";

export const EXPORT_FORMATS: ExportFormat[] = ["markdown", "pdf", "docx"];

export const EXPORT_FILE_EXTENSIONS: Record<ExportFormat, string> = {
  markdown: "md",
  pdf: "pdf",
  docx: "docx",
};

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  markdown: "text/markdown; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
