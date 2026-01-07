/**
 * useFileGallery Hook
 * Manage file gallery state and operations
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getFiles } from '@/lib/api/files';
import type { File, FileFilters, ViewMode } from '@/lib/types/files';

interface UseFileGalleryOptions {
  initialFilters?: Partial<FileFilters>;
  initialViewMode?: ViewMode;
  autoLoad?: boolean;
}

interface UseFileGalleryReturn {
  files: File[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null;
  filters: FileFilters;
  viewMode: ViewMode;
  selectedFiles: Set<string>;
  isLoading: boolean;
  error: string | null;
  setFilters: (filters: Partial<FileFilters>) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleFileSelection: (fileId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  nextPage: () => void;
  previousPage: () => void;
  refresh: () => Promise<void>;
}

export function useFileGallery(options: UseFileGalleryOptions = {}): UseFileGalleryReturn {
  const { initialFilters = {}, initialViewMode = 'grid', autoLoad = true } = options;

  const router = useRouter();
  const searchParams = useSearchParams();

  const [files, setFiles] = useState<File[]>([]);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null>(null);

  // Check if we have any initialFilters - if not, ignore URL params to prevent stale filters
  const hasInitialFilters = Object.keys(initialFilters).length > 0;

  const [filters, setFiltersState] = useState<FileFilters>(() => ({
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
    // Only use URL params if we have initialFilters, otherwise start fresh
    category: initialFilters.category || (hasInitialFilters ? (searchParams.get('category') as any) : undefined) || undefined,
    entity_type: initialFilters.entity_type || (hasInitialFilters ? (searchParams.get('entity_type') as any) : undefined) || undefined,
    entity_id: initialFilters.entity_id || (hasInitialFilters ? searchParams.get('entity_id') : undefined) || undefined,
    search: initialFilters.search || (hasInitialFilters ? searchParams.get('search') : undefined) || undefined,
    file_type: initialFilters.file_type || undefined,
    start_date: initialFilters.start_date || undefined,
    end_date: initialFilters.end_date || undefined,
  }));

  const [viewMode, setViewModeState] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) || initialViewMode
  );

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch files from API
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await getFiles(filters);

      setFiles(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to load files';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Auto-load files on mount and when filters change
  useEffect(() => {
    if (autoLoad) {
      fetchFiles();
    }
  }, [fetchFiles, autoLoad]);

  // Update URL query params when filters/view mode change
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.page) params.set('page', filters.page.toString());
    if (filters.limit) params.set('limit', filters.limit.toString());
    if (filters.category) params.set('category', filters.category);
    if (filters.entity_type) params.set('entity_type', filters.entity_type);
    if (filters.entity_id) params.set('entity_id', filters.entity_id);
    if (filters.search) params.set('search', filters.search);
    if (viewMode) params.set('view', viewMode);

    router.replace(`?${params.toString()}`, { scroll: false });
  }, [filters, viewMode, router]);

  // Set filters
  const setFilters = useCallback((newFilters: Partial<FileFilters>) => {
    setFiltersState((prev) => ({
      ...prev,
      ...newFilters,
      // Reset to page 1 when filters change (except when changing page)
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
    setSelectedFiles(new Set()); // Clear selections when filters change
  }, []);

  // Set view mode
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
  }, []);

  // Toggle file selection
  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  }, []);

  // Select all files on current page
  const selectAll = useCallback(() => {
    setSelectedFiles(new Set(files.map((f) => f.file_id)));
  }, [files]);

  // Deselect all files
  const deselectAll = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  // Next page
  const nextPage = useCallback(() => {
    if (pagination && pagination.page < pagination.totalPages) {
      setFilters({ page: pagination.page + 1 });
    }
  }, [pagination, setFilters]);

  // Previous page
  const previousPage = useCallback(() => {
    if (pagination && pagination.page > 1) {
      setFilters({ page: pagination.page - 1 });
    }
  }, [pagination, setFilters]);

  // Refresh (reload current page)
  const refresh = useCallback(async () => {
    await fetchFiles();
    setSelectedFiles(new Set()); // Clear selections on refresh
  }, [fetchFiles]);

  return {
    files,
    pagination,
    filters,
    viewMode,
    selectedFiles,
    isLoading,
    error,
    setFilters,
    setViewMode,
    toggleFileSelection,
    selectAll,
    deselectAll,
    nextPage,
    previousPage,
    refresh,
  };
}
