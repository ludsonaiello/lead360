// Quote Groups API Client
// Sprint 2: 8 endpoints for quote group management
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  QuoteGroup,
  CreateQuoteGroupDto,
  UpdateQuoteGroupDto,
  DeleteGroupOptions,
  ReorderGroupsDto,
  AddItemsToGroupDto,
} from '@/lib/types/quotes';

// ========== QUOTE GROUPS (8 endpoints) ==========

/**
 * Create group in quote
 * @endpoint POST /quotes/:quoteId/groups
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param dto Group creation data
 * @returns Created group (initially empty)
 * @throws 400 - Validation errors
 * @throws 404 - Quote not found
 */
export const createQuoteGroup = async (
  quoteId: string,
  dto: CreateQuoteGroupDto
): Promise<QuoteGroup> => {
  const { data } = await apiClient.post<QuoteGroup>(
    `/quotes/${quoteId}/groups`,
    dto
  );
  return data;
};

/**
 * List all groups in quote
 * @endpoint GET /quotes/:quoteId/groups
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @returns Array of groups with items
 * @throws 404 - Quote not found
 * @note Groups sorted by order_index, items sorted by order_index within group
 */
export const getQuoteGroups = async (
  quoteId: string
): Promise<QuoteGroup[]> => {
  const { data } = await apiClient.get<QuoteGroup[]>(
    `/quotes/${quoteId}/groups`
  );
  return data;
};

/**
 * Get single group details
 * @endpoint GET /quotes/:quoteId/groups/:groupId
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @param groupId Group UUID
 * @returns Group with all items
 * @throws 404 - Quote or group not found
 */
export const getQuoteGroupById = async (quoteId: string, groupId: string): Promise<QuoteGroup> => {
  const { data } = await apiClient.get<QuoteGroup>(`/quotes/${quoteId}/groups/${groupId}`);
  return data;
};

/**
 * Update group
 * @endpoint PATCH /quotes/:quoteId/groups/:groupId
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param groupId Group UUID
 * @param dto Partial group update data
 * @returns Updated group
 * @throws 400 - Validation errors
 * @throws 404 - Quote or group not found
 */
export const updateQuoteGroup = async (
  quoteId: string,
  groupId: string,
  dto: UpdateQuoteGroupDto
): Promise<QuoteGroup> => {
  const { data } = await apiClient.patch<QuoteGroup>(`/quotes/${quoteId}/groups/${groupId}`, dto);
  return data;
};

/**
 * Delete group
 * @endpoint DELETE /quotes/:quoteId/groups/:groupId
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param groupId Group UUID
 * @param options keep_items: true = keep items (move to ungrouped), false = delete all items
 * @returns void (204 No Content)
 * @throws 404 - Quote or group not found
 * @note Default behavior: keep_items = true
 * @note Uses query parameter ?delete_items=true/false instead of request body
 */
export const deleteQuoteGroup = async (
  quoteId: string,
  groupId: string,
  deleteItems: boolean = false
): Promise<void> => {
  await apiClient.delete(`/quotes/${quoteId}/groups/${groupId}?delete_items=${deleteItems}`);
};

/**
 * Duplicate group (including all items)
 * @endpoint POST /quotes/:quoteId/groups/:groupId/duplicate
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param groupId Group UUID to duplicate
 * @returns New group (copy of original with all items)
 * @throws 404 - Quote or group not found
 * @note Appends " (Copy)" to name, duplicates all items in group
 */
export const duplicateQuoteGroup = async (quoteId: string, groupId: string): Promise<QuoteGroup> => {
  const { data } = await apiClient.post<QuoteGroup>(`/quotes/${quoteId}/groups/${groupId}/duplicate`);
  return data;
};

/**
 * Reorder groups (drag-and-drop)
 * @endpoint PATCH /quotes/:quoteId/groups/reorder
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param dto Array of group IDs with new order_index values
 * @returns void (204 No Content)
 * @throws 400 - Invalid group IDs or order_index values
 * @note Updates order_index for all provided groups
 */
export const reorderGroups = async (quoteId: string, dto: ReorderGroupsDto): Promise<void> => {
  await apiClient.patch(`/quotes/${quoteId}/groups/reorder`, dto);
};

/**
 * Add multiple items to group
 * @endpoint POST /quotes/:quoteId/groups/:groupId/add-items
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param groupId Group UUID
 * @param dto Array of item IDs to add to group
 * @returns Updated group with new items
 * @throws 404 - Group or items not found
 * @throws 400 - Items belong to different quote
 * @note Moves items from their current location (ungrouped or other group)
 */
export const addItemsToGroup = async (
  quoteId: string,
  groupId: string,
  dto: AddItemsToGroupDto
): Promise<QuoteGroup> => {
  const { data } = await apiClient.post<QuoteGroup>(
    `/quotes/${quoteId}/groups/${groupId}/add-items`,
    dto
  );
  return data;
};
