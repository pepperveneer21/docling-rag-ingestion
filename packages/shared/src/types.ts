export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
  /** Set when a format-specific extractor was skipped or failed (e.g. an image
   *  above the decompression-bomb decode limit). Core fields stay exact. */
  metadata_warning: string | null;
  // Image-specific
  image_width: number | null;
  image_height: number | null;
  exif: Record<string, string> | null;
  // PDF-specific
  pdf_pages: number | null;
  pdf_author: string | null;
  pdf_title: string | null;
  // Audio/Video
  duration_seconds: number | null;
  codec: string | null;
  bitrate: number | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// --- Document ingestion (Docling) ------------------------------------------
// Mirror of services/api/app/types/documents.py.

export type ExportFormat = "markdown" | "json" | "html" | "text";
export type MaxTokens = 256 | 512 | 1024;
export type DocumentStatus = "pending" | "ingested" | "failed";

export interface DocumentConfig {
  export_format: ExportFormat;
  max_tokens: MaxTokens;
  merge_peers: boolean;
}

export interface DocumentResult {
  parsed_key: string;
  chunks_key: string;
  page_count: number;
  table_count: number;
  chunk_count: number;
  raw_bytes: number;
  derived_bytes: number;
  ingested_at: string;
}

export interface DocumentManifest {
  doc_id: string;
  filename: string;
  source_key: string;
  content_type: string;
  raw_bytes: number;
  status: DocumentStatus;
  config: DocumentConfig;
  result: DocumentResult | null;
  error: string | null;
  created_at: string;
}

export interface DocumentSummary {
  doc_id: string;
  filename: string;
  content_type: string;
  status: DocumentStatus;
  config: DocumentConfig;
  page_count: number;
  table_count: number;
  chunk_count: number;
  raw_bytes: number;
  raw_bytes_human: string;
  derived_bytes: number;
  derived_bytes_human: string;
  amplification: number;
  created_at: string;
}

export interface DocumentChunk {
  index: number;
  text: string;
  headings: string[];
  page_no: number | null;
  char_count: number;
}

export interface DocumentChunksResponse {
  doc_id: string;
  total_chunks: number;
  returned: number;
  truncated: boolean;
  chunks: DocumentChunk[];
}

export interface ParsedDocumentResponse {
  doc_id: string;
  export_format: ExportFormat;
  content: string;
  truncated: boolean;
  byte_count: number;
}

export interface DocumentStats {
  total_documents: number;
  ingested: number;
  pending: number;
  failed: number;
  total_chunks: number;
  total_pages: number;
  total_tables: number;
  raw_bytes: number;
  raw_bytes_human: string;
  derived_bytes: number;
  derived_bytes_human: string;
  amplification_ratio: number;
}
