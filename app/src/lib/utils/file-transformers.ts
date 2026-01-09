/**
 * File Transformers
 * Transform file data between different API formats
 */

import { AdminFileListItem } from '@/lib/api/admin';
import { File } from '@/lib/types/files';

/**
 * Transform admin file API response to FileGallery format
 *
 * Admin API returns Prisma relation names that differ from the File type:
 * - tenant_file_tenant_idTotenant → tenant info
 * - user → uploader info
 * - is_trashed → deleted status
 * - created_at → uploaded date
 */
export function transformAdminFileToGalleryFile(adminFile: AdminFileListItem): File {
  return {
    id: adminFile.file_id,
    file_id: adminFile.file_id,
    original_filename: adminFile.original_filename,
    mime_type: adminFile.mime_type,
    size_bytes: adminFile.size_bytes,
    url: adminFile.storage_path,
    category: adminFile.category as any, // FileCategory type
    entity_type: adminFile.entity_type as any, // EntityType
    entity_id: adminFile.entity_id || undefined,
    uploaded_by: adminFile.uploaded_by,
    uploaded_by_name: adminFile.user
      ? `${adminFile.user.first_name} ${adminFile.user.last_name}`
      : undefined,
    created_at: adminFile.created_at,
    updated_at: adminFile.created_at, // Admin API doesn't return updated_at
    deleted_at: adminFile.is_trashed ? (adminFile.trashed_at || undefined) : undefined,
    is_orphan: false, // Admin API doesn't track orphan status
    has_thumbnail: false, // Will be determined by FileGallery based on mime_type
    is_optimized: false, // Admin API doesn't return optimization status
  };
}
