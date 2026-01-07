/**
 * File Storage Module - TypeScript Types
 * Comprehensive type definitions for file management
 */

// File Categories (matches backend enum)
export type FileCategory =
  | 'quote'
  | 'invoice'
  | 'license'
  | 'insurance'
  | 'logo'
  | 'contract'
  | 'receipt'
  | 'photo'
  | 'report'
  | 'signature'
  | 'misc';

// Entity Types
export type EntityType =
  | 'tenant'
  | 'user'
  | 'quote'
  | 'project'
  | 'invoice'
  | 'expense';

// File Type for filtering
export type FileType = 'image' | 'pdf' | 'document';

// Main File Interface
export interface File {
  id: string;
  file_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  original_size_bytes?: number;
  category: FileCategory;
  entity_type?: EntityType;
  entity_id?: string;
  entity_name?: string;
  is_orphan: boolean;
  url: string;
  thumbnail_url?: string;
  has_thumbnail: boolean;
  is_optimized: boolean;
  width?: number;
  height?: number;
  uploaded_by?: string;
  uploaded_by_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  marked_orphan_at?: string;
}

// Share Link Interface
export interface ShareLink {
  id: string;
  share_token: string;
  share_url: string;
  file_id: string;
  file_name?: string;
  has_password: boolean;
  expires_at?: string;
  max_downloads?: number;
  download_count: number;
  view_count: number;
  is_active: boolean;
  created_at: string;
  last_accessed_at?: string;
}

// Upload Response
export interface UploadResponse {
  message: string;
  file_id: string;
  url: string;
  file: File;
}

// Filters for Gallery
export interface FileFilters {
  category?: FileCategory;
  entity_type?: EntityType;
  entity_id?: string;
  file_type?: FileType;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Pagination Metadata
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// List Files Response
export interface ListFilesResponse {
  data: File[];
  pagination: PaginationMeta;
}

// Upload Options
export interface UploadOptions {
  category: FileCategory;
  entity_type?: EntityType;
  entity_id?: string;
  onProgress?: (progress: number) => void;
}

// Create Share Link Request
export interface CreateShareLinkRequest {
  file_id: string;
  password?: string;
  expires_at?: string;
  max_downloads?: number;
}

// Create Share Link Response
export interface CreateShareLinkResponse {
  message: string;
  share_link: ShareLink;
}

// List Share Links Response
export interface ListShareLinksResponse {
  share_links: ShareLink[];
  total: number;
}

// Access Shared File Response
export interface AccessSharedFileResponse {
  message: string;
  file: Omit<File, 'entity_type' | 'entity_id' | 'uploaded_by'>;
  share_info: {
    view_count: number;
    download_count: number;
    max_downloads?: number;
    expires_at?: string;
  };
}

// Bulk Delete Request
export interface BulkDeleteRequest {
  file_ids: string[];
}

// Bulk Delete Response
export interface BulkDeleteResponse {
  message: string;
  count: number;
}

// Orphan Files Response
export interface OrphanFilesResponse {
  orphans: Array<{
    id: string;
    file_id: string;
    original_filename: string;
    days_orphaned: number;
    url: string;
  }>;
  total: number;
  marked_as_orphan: number;
}

// File Category Configuration
export interface FileCategoryConfig {
  label: string;
  maxSize: number; // in MB
  accept: string[];
  color: string; // Tailwind color for badges
  icon: string; // Icon name
}

// File Category Configurations
export const FILE_CATEGORY_CONFIG: Record<FileCategory, FileCategoryConfig> = {
  quote: {
    label: 'Quote',
    maxSize: 10,
    accept: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    color: 'blue',
    icon: 'FileText',
  },
  invoice: {
    label: 'Invoice',
    maxSize: 10,
    accept: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
    color: 'green',
    icon: 'Receipt',
  },
  license: {
    label: 'License',
    maxSize: 10,
    accept: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
    color: 'purple',
    icon: 'Award',
  },
  insurance: {
    label: 'Insurance',
    maxSize: 10,
    accept: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
    color: 'indigo',
    icon: 'Shield',
  },
  logo: {
    label: 'Logo',
    maxSize: 5,
    accept: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
    color: 'pink',
    icon: 'Image',
  },
  contract: {
    label: 'Contract',
    maxSize: 15,
    accept: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    color: 'yellow',
    icon: 'FileSignature',
  },
  receipt: {
    label: 'Receipt',
    maxSize: 5,
    accept: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
    color: 'orange',
    icon: 'Receipt',
  },
  photo: {
    label: 'Photo',
    maxSize: 20,
    accept: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'],
    color: 'teal',
    icon: 'Camera',
  },
  report: {
    label: 'Report',
    maxSize: 25,
    accept: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    color: 'cyan',
    icon: 'FileBarChart',
  },
  signature: {
    label: 'Signature',
    maxSize: 2,
    accept: ['image/png', 'image/jpeg', 'image/webp'],
    color: 'violet',
    icon: 'PenTool',
  },
  misc: {
    label: 'Miscellaneous',
    maxSize: 20,
    accept: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv'],
    color: 'gray',
    icon: 'File',
  },
};

// View Mode
export type ViewMode = 'grid' | 'list';
