/**
 * Quote Tags API Client
 * Handles tag management and assignment to quotes
 */

import { apiClient } from './axios';
import type {
  QuoteTag,
  CreateQuoteTagDto,
  UpdateQuoteTagDto,
  AssignTagsDto,
} from '../types/quotes';

/**
 * Create a new tag
 */
export const createTag = async (dto: CreateQuoteTagDto): Promise<QuoteTag> => {
  const response = await apiClient.post<QuoteTag>('/tags', dto);
  return response.data;
};

/**
 * Get all tags (optionally include inactive)
 */
export const getTags = async (params?: {
  include_inactive?: boolean;
}): Promise<QuoteTag[]> => {
  const response = await apiClient.get<QuoteTag[]>('/tags', { params });
  return response.data;
};

/**
 * Get a single tag by ID
 */
export const getTag = async (id: string): Promise<QuoteTag> => {
  const response = await apiClient.get<QuoteTag>(`/tags/${id}`);
  return response.data;
};

/**
 * Update a tag (name, color, or active status)
 */
export const updateTag = async (id: string, dto: UpdateQuoteTagDto): Promise<QuoteTag> => {
  const response = await apiClient.patch<QuoteTag>(`/tags/${id}`, dto);
  return response.data;
};

/**
 * Delete a tag
 * NOTE: Can only delete if usage_count = 0
 * If tag is in use, mark as inactive instead
 */
export const deleteTag = async (id: string): Promise<void> => {
  await apiClient.delete(`/tags/${id}`);
};

/**
 * Assign tags to a quote
 * NOTE: This REPLACES all existing tags (not additive)
 */
export const assignTagsToQuote = async (
  quoteId: string,
  dto: AssignTagsDto
): Promise<QuoteTag[]> => {
  const response = await apiClient.post<QuoteTag[]>(`/quotes/${quoteId}/tags`, dto);
  return response.data;
};

/**
 * Remove a single tag from a quote
 */
export const removeTagFromQuote = async (quoteId: string, tagId: string): Promise<void> => {
  await apiClient.delete(`/quotes/${quoteId}/tags/${tagId}`);
};

/**
 * Get all tags assigned to a quote
 */
export const getQuoteTags = async (quoteId: string): Promise<QuoteTag[]> => {
  const response = await apiClient.get<QuoteTag[]>(`/quotes/${quoteId}/tags`);
  return response.data;
};
