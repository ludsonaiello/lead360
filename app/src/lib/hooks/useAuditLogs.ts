// Custom hook for managing audit logs with filtering and pagination

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuditLogs, getUserAuditLogs, getTenantAuditLogs } from '@/lib/api/audit';
import type {
  AuditLog,
  AuditLogFilters,
  AuditLogPagination
} from '@/lib/types/audit';

interface UseAuditLogsOptions {
  /**
   * API endpoint type to use
   * - 'default': GET /audit-logs
   * - 'user': GET /users/:userId/audit-logs
   * - 'tenant': GET /tenants/:tenantId/audit-logs
   */
  endpointType?: 'default' | 'user' | 'tenant';

  /**
   * Resource ID (userId or tenantId depending on endpointType)
   */
  resourceId?: string;

  /**
   * Initial filters to apply
   */
  initialFilters?: Partial<AuditLogFilters>;

  /**
   * Whether to sync filters with URL query params
   * @default true
   */
  syncWithUrl?: boolean;

  /**
   * Auto-fetch on mount
   * @default true
   */
  autoFetch?: boolean;
}

interface UseAuditLogsReturn {
  logs: AuditLog[];
  pagination: AuditLogPagination | null;
  filters: AuditLogFilters;
  isLoading: boolean;
  error: string | null;
  setFilters: (filters: Partial<AuditLogFilters>) => void;
  resetFilters: () => void;
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (page: number) => void;
  refresh: () => void;
}

const DEFAULT_FILTERS: AuditLogFilters = {
  page: 1,
  limit: 50
};

/**
 * Custom hook for fetching and managing audit logs
 *
 * Features:
 * - Pagination support
 * - Filter management
 * - URL query param synchronization (shareable links)
 * - Automatic refetch on filter/page change
 * - Loading and error states
 *
 * @param options - Configuration options
 * @returns Audit logs state and control functions
 *
 * @example
 * ```tsx
 * const {
 *   logs,
 *   pagination,
 *   filters,
 *   isLoading,
 *   setFilters,
 *   nextPage
 * } = useAuditLogs();
 * ```
 */
export function useAuditLogs(options: UseAuditLogsOptions = {}): UseAuditLogsReturn {
  const {
    endpointType = 'default',
    resourceId,
    initialFilters = {},
    syncWithUrl = true,
    autoFetch = true
  } = options;

  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize filters from URL or defaults
  const getInitialFilters = useCallback((): AuditLogFilters => {
    if (!syncWithUrl) {
      return { ...DEFAULT_FILTERS, ...initialFilters };
    }

    const urlFilters: AuditLogFilters = {
      page: Number(searchParams.get('page')) || DEFAULT_FILTERS.page,
      limit: Number(searchParams.get('limit')) || DEFAULT_FILTERS.limit
    };

    // Parse URL params
    if (searchParams.get('start_date')) urlFilters.start_date = searchParams.get('start_date')!;
    if (searchParams.get('end_date')) urlFilters.end_date = searchParams.get('end_date')!;
    if (searchParams.get('actor_user_id')) urlFilters.actor_user_id = searchParams.get('actor_user_id')!;
    if (searchParams.get('actor_type')) urlFilters.actor_type = searchParams.get('actor_type') as any;
    if (searchParams.get('action_type')) urlFilters.action_type = searchParams.get('action_type') as any;
    if (searchParams.get('entity_type')) urlFilters.entity_type = searchParams.get('entity_type')!;
    if (searchParams.get('entity_id')) urlFilters.entity_id = searchParams.get('entity_id')!;
    if (searchParams.get('status')) urlFilters.status = searchParams.get('status') as any;
    if (searchParams.get('search')) urlFilters.search = searchParams.get('search')!;

    return { ...urlFilters, ...initialFilters };
  }, [searchParams, syncWithUrl, initialFilters]);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<AuditLogPagination | null>(null);
  const [filters, setFiltersState] = useState<AuditLogFilters>(getInitialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update URL query params when filters change (runs in useEffect)
  useEffect(() => {
    if (!syncWithUrl) return;

    const params = new URLSearchParams();

    // Only add non-default params to URL
    if (filters.page && filters.page !== 1) params.set('page', String(filters.page));
    if (filters.limit && filters.limit !== 50) params.set('limit', String(filters.limit));
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date) params.set('end_date', filters.end_date);
    if (filters.actor_user_id) params.set('actor_user_id', filters.actor_user_id);
    if (filters.actor_type) params.set('actor_type', filters.actor_type);
    if (filters.action_type) params.set('action_type', filters.action_type);
    if (filters.entity_type) params.set('entity_type', filters.entity_type);
    if (filters.entity_id) params.set('entity_id', filters.entity_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;

    router.replace(newUrl, { scroll: false });
  }, [filters, router, syncWithUrl]);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let response;

      // Call appropriate API endpoint based on type
      if (endpointType === 'user' && resourceId) {
        response = await getUserAuditLogs(resourceId, filters);
      } else if (endpointType === 'tenant' && resourceId) {
        response = await getTenantAuditLogs(resourceId, filters);
      } else {
        response = await getAuditLogs(filters);
      }

      setLogs(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load audit logs';
      setError(errorMessage);
      setLogs([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [endpointType, resourceId, filters]);

  // Auto-fetch on mount and when filters change
  useEffect(() => {
    if (autoFetch) {
      fetchLogs();
    }
  }, [autoFetch, fetchLogs]);

  // Set filters (URL update happens in useEffect)
  const setFilters = useCallback((newFilters: Partial<AuditLogFilters>) => {
    setFiltersState((prev) => {
      // Reset to page 1 when filters change (unless page is explicitly set)
      return {
        ...prev,
        ...newFilters,
        page: newFilters.page !== undefined ? newFilters.page : 1
      };
    });
  }, []);

  // Reset all filters to defaults (URL update happens in useEffect)
  const resetFilters = useCallback(() => {
    const defaults = { ...DEFAULT_FILTERS, ...initialFilters };
    setFiltersState(defaults);
  }, [initialFilters]);

  // Pagination controls
  const nextPage = useCallback(() => {
    if (pagination && filters.page! < pagination.totalPages) {
      setFilters({ page: filters.page! + 1 });
    }
  }, [pagination, filters.page, setFilters]);

  const previousPage = useCallback(() => {
    if (filters.page && filters.page > 1) {
      setFilters({ page: filters.page - 1 });
    }
  }, [filters.page, setFilters]);

  const goToPage = useCallback((page: number) => {
    if (pagination && page >= 1 && page <= pagination.totalPages) {
      setFilters({ page });
    }
  }, [pagination, setFilters]);

  // Refresh current page
  const refresh = useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    pagination,
    filters,
    isLoading,
    error,
    setFilters,
    resetFilters,
    nextPage,
    previousPage,
    goToPage,
    refresh
  };
}
