// Quote Items API Client
// Sprint 2: 12 endpoints for quote item management
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  QuoteItem,
  CreateQuoteItemDto,
  UpdateQuoteItemDto,
  ReorderItemsDto,
} from '@/lib/types/quotes';

// ========== QUOTE ITEMS (12 endpoints) ==========

/**
 * Add item to quote
 * @endpoint POST /quotes/:quoteId/items
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param dto Item creation data
 * @returns Created quote item with calculated totals
 * @throws 400 - Validation errors
 * @throws 404 - Quote not found or unit not found
 */
export const addQuoteItem = async (
  quoteId: string,
  dto: CreateQuoteItemDto
): Promise<QuoteItem> => {
  const { data } = await apiClient.post<QuoteItem>(
    `/quotes/${quoteId}/items`,
    dto
  );
  return data;
};

/**
 * Add item from library to quote
 * @endpoint POST /quotes/:quoteId/items/from-library/:libraryItemId
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param libraryItemId Library item UUID
 * @param quantity Optional quantity (default: 1)
 * @param groupId Optional group UUID to add item to
 * @returns Created quote item (copy of library item)
 * @throws 404 - Quote or library item not found
 * @note Increments library item usage_count automatically
 */
export const addItemFromLibrary = async (
  quoteId: string,
  libraryItemId: string,
  quantity?: number,
  groupId?: string
): Promise<QuoteItem> => {
  const { data } = await apiClient.post<QuoteItem>(
    `/quotes/${quoteId}/items/from-library/${libraryItemId}`,
    { quantity, quote_group_id: groupId }
  );
  return data;
};

/**
 * List all items in quote (including grouped and ungrouped)
 * @endpoint GET /quotes/:quoteId/items
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @returns Array of quote items with unit and warranty details
 * @throws 404 - Quote not found
 * @note Items are sorted by order_index
 */
export const getQuoteItems = async (quoteId: string): Promise<QuoteItem[]> => {
  const { data } = await apiClient.get<QuoteItem[]>(`/quotes/${quoteId}/items`);
  return data;
};

/**
 * Get single quote item details
 * @endpoint GET /quotes/:quoteId/items/:itemId
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @param id Item UUID
 * @returns Complete item details with unit and warranty
 * @throws 404 - Item not found
 */
export const getQuoteItemById = async (quoteId: string, id: string): Promise<QuoteItem> => {
  const { data } = await apiClient.get<QuoteItem>(`/quotes/${quoteId}/items/${id}`);
  return data;
};

/**
 * Update quote item
 * @endpoint PATCH /quotes/:quoteId/items/:itemId
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param id Item UUID
 * @param dto Partial item update data
 * @returns Updated item with recalculated totals
 * @throws 400 - Validation errors
 * @throws 404 - Item not found
 * @note Recalculates quote totals automatically
 */
export const updateQuoteItem = async (
  quoteId: string,
  id: string,
  dto: UpdateQuoteItemDto
): Promise<QuoteItem> => {
  const { data } = await apiClient.patch<QuoteItem>(`/quotes/${quoteId}/items/${id}`, dto);
  return data;
};

/**
 * Delete quote item
 * @endpoint DELETE /quotes/:quoteId/items/:itemId
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param id Item UUID
 * @returns void (204 No Content)
 * @throws 404 - Item not found
 * @note Recalculates quote totals automatically
 */
export const deleteQuoteItem = async (quoteId: string, id: string): Promise<void> => {
  await apiClient.delete(`/quotes/${quoteId}/items/${id}`);
};

/**
 * Duplicate quote item
 * @endpoint POST /quotes/:quoteId/items/:itemId/duplicate
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param id Item UUID to duplicate
 * @returns New item (copy of original)
 * @throws 404 - Item not found
 * @note Appends " (Copy)" to title, places after original item
 */
export const duplicateQuoteItem = async (quoteId: string, id: string): Promise<QuoteItem> => {
  const { data } = await apiClient.post<QuoteItem>(`/quotes/${quoteId}/items/${id}/duplicate`);
  return data;
};

/**
 * Move item to group
 * @endpoint PATCH /quotes/:quoteId/items/:itemId/move-to-group
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param id Item UUID
 * @param groupId Group UUID (or null to remove from group)
 * @returns Updated item
 * @throws 404 - Item or group not found
 * @throws 400 - Group belongs to different quote
 */
export const moveItemToGroup = async (
  quoteId: string,
  id: string,
  groupId: string | null
): Promise<QuoteItem> => {
  const { data } = await apiClient.patch<QuoteItem>(
    `/quotes/${quoteId}/items/${id}/move-to-group`,
    { quote_group_id: groupId }
  );
  return data;
};

/**
 * Remove item from group (moves to ungrouped)
 * @endpoint POST /quotes/:quoteId/items/:itemId/remove-from-group
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param id Item UUID
 * @returns Updated item (group_id set to null)
 * @throws 404 - Item not found
 * @throws 400 - Item not in a group
 */
export const removeItemFromGroup = async (quoteId: string, id: string): Promise<QuoteItem> => {
  const { data } = await apiClient.post<QuoteItem>(
    `/quotes/${quoteId}/items/${id}/remove-from-group`
  );
  return data;
};

/**
 * Reorder items (drag-and-drop)
 * @endpoint PATCH /quotes/:quoteId/items/reorder
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param dto Array of item IDs with new order_index values
 * @returns void (204 No Content)
 * @throws 400 - Invalid item IDs or order_index values
 * @note Updates order_index for all provided items
 */
export const reorderItems = async (quoteId: string, dto: ReorderItemsDto): Promise<void> => {
  await apiClient.patch(`/quotes/${quoteId}/items/reorder`, dto);
};

/**
 * Save item to library
 * @endpoint POST /quotes/:quoteId/items/:itemId/save-to-library
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param id Item UUID
 * @returns Created library item
 * @throws 404 - Item not found
 * @note Creates new library item with same data (no link between them)
 */
export const saveItemToLibrary = async (quoteId: string, id: string): Promise<any> => {
  const { data } = await apiClient.post(`/quotes/${quoteId}/items/${id}/save-to-library`);
  return data;
};

/**
 * Calculate warranty price for item
 * @endpoint GET /items/:id/warranty-price
 * @permission quotes:view
 * @param id Item UUID
 * @returns Calculated warranty price based on item cost and warranty tier
 * @throws 404 - Item not found
 * @throws 400 - No warranty tier assigned to item
 */
export const getItemWarrantyPrice = async (
  id: string
): Promise<{ item_id: string; warranty_price: number }> => {
  const { data } = await apiClient.get<{
    item_id: string;
    warranty_price: number;
  }>(`/items/${id}/warranty-price`);
  return data;
};
