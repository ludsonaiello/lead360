/**
 * Quote Notes API Client
 * Backend API: /api/v1/quotes/:id/notes
 * Documentation: api/documentation/quote_notes_REST_API.md
 */

import { apiClient } from './axios';
import type {
  QuoteNote,
  CreateQuoteNoteDto,
  UpdateQuoteNoteDto,
  QuoteNotesListResponse,
} from '@/lib/types/quotes';

const BASE_URL = '/quotes';

/**
 * Create a new note on a quote
 * POST /api/v1/quotes/:id/notes
 *
 * @param quoteId - Quote UUID
 * @param data - Note content and optional pin flag
 * @returns Created note with user info
 */
export async function createQuoteNote(
  quoteId: string,
  data: CreateQuoteNoteDto
): Promise<QuoteNote> {
  const response = await apiClient.post(`${BASE_URL}/${quoteId}/notes`, data);
  return response.data;
}

/**
 * Get all notes for a quote with pagination
 * GET /api/v1/quotes/:id/notes
 *
 * Notes are sorted: pinned first (newest), then unpinned (newest)
 *
 * @param quoteId - Quote UUID
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 50)
 * @returns List of notes with total count
 */
export async function getQuoteNotes(
  quoteId: string,
  page: number = 1,
  limit: number = 50
): Promise<QuoteNotesListResponse> {
  const response = await apiClient.get(`${BASE_URL}/${quoteId}/notes`, {
    params: { page, limit },
  });
  return response.data;
}

/**
 * Update an existing note
 * PATCH /api/v1/quotes/:id/notes/:noteId
 *
 * Can update note text, pin status, or both
 *
 * @param quoteId - Quote UUID
 * @param noteId - Note UUID
 * @param data - Fields to update (note_text and/or is_pinned)
 * @returns Updated note
 */
export async function updateQuoteNote(
  quoteId: string,
  noteId: string,
  data: UpdateQuoteNoteDto
): Promise<QuoteNote> {
  const response = await apiClient.patch(
    `${BASE_URL}/${quoteId}/notes/${noteId}`,
    data
  );
  return response.data;
}

/**
 * Delete a note permanently
 * DELETE /api/v1/quotes/:id/notes/:noteId
 *
 * @param quoteId - Quote UUID
 * @param noteId - Note UUID
 */
export async function deleteQuoteNote(
  quoteId: string,
  noteId: string
): Promise<void> {
  await apiClient.delete(`${BASE_URL}/${quoteId}/notes/${noteId}`);
}

/**
 * Toggle pin status of a note
 * Convenience method that calls updateQuoteNote
 *
 * @param quoteId - Quote UUID
 * @param noteId - Note UUID
 * @param isPinned - New pin status
 * @returns Updated note
 */
export async function togglePinNote(
  quoteId: string,
  noteId: string,
  isPinned: boolean
): Promise<QuoteNote> {
  return updateQuoteNote(quoteId, noteId, { is_pinned: isPinned });
}
