// Lead360 - Quote Attachments API Client
// Sprint 5: Attachment Management (6 endpoints)
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  QuoteAttachment,
  CreateAttachmentDto,
  UpdateAttachmentDto,
  ReorderAttachmentsDto,
  ReorderAttachmentsResponse,
} from '@/lib/types/quotes';

// ========== ATTACHMENT OPERATIONS (6 endpoints) ==========

/**
 * Create attachment (photo or URL with QR code)
 * @endpoint POST /quotes/:quoteId/attachments
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param dto Attachment creation data
 * @returns Created attachment with file/QR code details
 * @throws 400 - Validation errors (missing file_id/url, invalid grid_layout)
 * @throws 404 - Quote not found
 *
 * @note Attachment Types:
 * - url_attachment: Requires `url`, auto-generates QR code
 * - cover_photo: Requires `file_id`, only 1 allowed (replaces previous)
 * - full_page_photo: Requires `file_id`
 * - grid_photo: Requires `file_id` and `grid_layout` (grid_2|grid_4|grid_6)
 *
 * @note Workflow for photo attachments:
 * 1. Upload file to FilesService: POST /files/upload (category: "photo")
 * 2. Get file_id from response
 * 3. Create attachment with file_id
 */
export const createAttachment = async (
  quoteId: string,
  dto: CreateAttachmentDto
): Promise<QuoteAttachment> => {
  const { data } = await apiClient.post<QuoteAttachment>(
    `/quotes/${quoteId}/attachments`,
    dto
  );
  return data;
};

/**
 * List all attachments for a quote
 * @endpoint GET /quotes/:quoteId/attachments
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @returns Array of attachments (not paginated)
 * @throws 404 - Quote not found
 * @note Returns attachments ordered by order_index
 * @note Includes nested qr_code_file or file objects based on type
 */
export const listAttachments = async (quoteId: string): Promise<QuoteAttachment[]> => {
  const { data } = await apiClient.get<QuoteAttachment[]>(
    `/quotes/${quoteId}/attachments`
  );
  return data;
};

/**
 * Get single attachment by ID
 * @endpoint GET /quotes/:quoteId/attachments/:attachmentId
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @param attachmentId Attachment UUID
 * @returns Attachment with full details
 * @throws 404 - Quote or attachment not found
 */
export const getAttachment = async (
  quoteId: string,
  attachmentId: string
): Promise<QuoteAttachment> => {
  const { data } = await apiClient.get<QuoteAttachment>(
    `/quotes/${quoteId}/attachments/${attachmentId}`
  );
  return data;
};

/**
 * Update attachment
 * @endpoint PATCH /quotes/:quoteId/attachments/:attachmentId
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param attachmentId Attachment UUID
 * @param dto Update data (url, title, grid_layout)
 * @returns Updated attachment
 * @throws 400 - Validation errors
 * @throws 404 - Quote or attachment not found
 * @note Updating URL for url_attachment triggers NEW QR code generation
 * @note Cannot change attachment_type or file_id (delete and recreate instead)
 */
export const updateAttachment = async (
  quoteId: string,
  attachmentId: string,
  dto: UpdateAttachmentDto
): Promise<QuoteAttachment> => {
  const { data } = await apiClient.patch<QuoteAttachment>(
    `/quotes/${quoteId}/attachments/${attachmentId}`,
    dto
  );
  return data;
};

/**
 * Reorder attachments
 * @endpoint PATCH /quotes/:quoteId/attachments/reorder
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param dto Array of attachment IDs with new order_index values
 * @returns Success response
 * @throws 400 - Validation errors
 * @throws 404 - Quote not found
 * @note order_index starts at 0
 * @note All attachments in the array will be reordered
 */
export const reorderAttachments = async (
  quoteId: string,
  dto: ReorderAttachmentsDto
): Promise<ReorderAttachmentsResponse> => {
  const { data } = await apiClient.patch<ReorderAttachmentsResponse>(
    `/quotes/${quoteId}/attachments/reorder`,
    dto
  );
  return data;
};

/**
 * Delete attachment
 * @endpoint DELETE /quotes/:quoteId/attachments/:attachmentId
 * @permission quotes:delete
 * @param quoteId Quote UUID
 * @param attachmentId Attachment UUID
 * @returns void (HTTP 204 No Content)
 * @throws 404 - Quote or attachment not found
 * @note Also deletes associated QR code file (if url_attachment)
 * @note File record remains in FilesService (soft delete)
 */
export const deleteAttachment = async (
  quoteId: string,
  attachmentId: string
): Promise<void> => {
  await apiClient.delete(`/quotes/${quoteId}/attachments/${attachmentId}`);
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Check if attachment is a photo type
 * @param attachment QuoteAttachment object
 * @returns boolean
 */
export const isPhotoAttachment = (attachment: QuoteAttachment): boolean => {
  return ['cover_photo', 'full_page_photo', 'grid_photo'].includes(
    attachment.attachment_type
  );
};

/**
 * Check if attachment is URL type
 * @param attachment QuoteAttachment object
 * @returns boolean
 */
export const isUrlAttachment = (attachment: QuoteAttachment): boolean => {
  return attachment.attachment_type === 'url_attachment';
};

/**
 * Get grid layout display name
 * @param layout Grid layout value
 * @returns Display name (e.g., "2x2 Grid", "4x4 Grid", "6x6 Grid")
 */
export const getGridLayoutName = (layout: string | null): string => {
  const names: Record<string, string> = {
    grid_2: '2x2 Grid',
    grid_4: '4x4 Grid',
    grid_6: '6x6 Grid',
  };
  return layout ? names[layout] || layout : 'N/A';
};

/**
 * Format file size for display
 * @param bytes File size in bytes
 * @returns Formatted string (e.g., "4.2 KB", "1.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
