/**
 * Quote Search API Client
 * Handles advanced search, autocomplete, and saved searches
 */

import { apiClient } from './axios';
import type {
  QuoteSearchFilters,
  QuoteSearchResponse,
  SearchSuggestionsResponse,
  SavedSearch,
  SavedSearchesResponse,
  CreateSavedSearchDto,
} from '../types/quotes';

/**
 * Advanced search with multiple filters
 * NOTE: status must be sent as array (e.g., status[]=draft&status[]=sent)
 */
export const advancedSearch = async (
  filters: QuoteSearchFilters
): Promise<QuoteSearchResponse> => {
  const response = await apiClient.get<QuoteSearchResponse>('/quotes/search/advanced', {
    params: filters,
    paramsSerializer: (params) => {
      // Handle array parameters properly (status[]=value1&status[]=value2)
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(`${key}[]`, v));
        } else if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      return searchParams.toString();
    },
  });
  return response.data;
};

/**
 * Get search suggestions for autocomplete
 * Requires minimum 2 characters
 */
export const getSearchSuggestions = async (params: {
  query: string;
  field?: 'all' | 'quote_number' | 'customer' | 'items';
  limit?: number;
}): Promise<SearchSuggestionsResponse> => {
  const response = await apiClient.get<SearchSuggestionsResponse>(
    '/quotes/search/suggestions',
    { params }
  );
  return response.data;
};

/**
 * Save search filters for later use
 */
export const saveSearch = async (dto: CreateSavedSearchDto): Promise<SavedSearch> => {
  const response = await apiClient.post<SavedSearch>('/quotes/search/save', dto);
  return response.data;
};

/**
 * Get all saved searches for current user
 */
export const getSavedSearches = async (): Promise<SavedSearchesResponse> => {
  const response = await apiClient.get<SavedSearchesResponse>('/quotes/search/saved');
  return response.data;
};

/**
 * Delete a saved search
 * NOTE: This endpoint may not be implemented yet (returned 404 during testing)
 */
export const deleteSavedSearch = async (id: string): Promise<void> => {
  await apiClient.delete(`/quotes/search/saved/${id}`);
};
