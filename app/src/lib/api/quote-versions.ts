// Lead360 - Quote Versions API Client
// Version history and comparison endpoints for quotes
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';

// ========== TYPES ==========

/**
 * Quote version with full snapshot
 */
export interface QuoteVersion {
  id: string;
  quote_id: string;
  version_number: number;  // Decimal like 1.0, 1.5, 2.0, 2.9
  snapshot_data: {
    quote: any;  // Full quote object snapshot
    items: any[];  // All quote items at this version
    groups: any[];  // All groups at this version
    discounts: any[];  // Discount rules at this version
    draw_schedule: any[];  // Draw schedule at this version
  };
  created_at: string;
  created_by_user_id: string | null;
}

/**
 * Simplified version info for timeline display
 */
export interface VersionSummary {
  id: string;
  version_number: number;
  created_at: string;
  created_by: {
    id: string;
    name: string;
  } | null;
  change_summary: string;
  item_count: number;
  total: number;
}

/**
 * Version comparison summary
 */
export interface VersionComparisonSummary {
  items_added: number;
  items_removed: number;
  items_modified: number;
  groups_added: number;
  groups_removed: number;
  groups_modified: number;
  settings_changed: boolean;
  total_change_amount: number;
  total_change_percent: number;
}

/**
 * Detailed differences between versions
 */
export interface VersionDifferences {
  quote_settings: Record<string, any>;
  items: {
    added: any[];
    removed: any[];
    modified: any[];
  };
  groups: {
    added: any[];
    removed: any[];
    modified: any[];
  };
  totals: Record<string, any>;
  discount_rules: {
    added: any[];
    removed: any[];
  };
  draw_schedule: {
    changed: boolean;
    from_count: number;
    to_count: number;
  };
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  quote_id: string;
  from_version: string;  // Version number as string (e.g., "2.8")
  to_version: string;    // Version number as string (e.g., "2.9")
  from_created_at: string;
  to_created_at: string;
  to_change_summary: string;
  summary: VersionComparisonSummary;
  differences: VersionDifferences;
}

/**
 * Timeline entry for version history
 */
export interface VersionTimelineEntry {
  version_number: number;
  created_at: string;
  created_by: {
    id: string;
    name: string;
  } | null;
  event_type: 'created' | 'approved' | 'edited' | 'restored' | 'change_order';
  description: string;
  changes_summary: {
    items_changed: number;
    total_changed: boolean;
  };
}

/**
 * Version timeline response
 */
export interface VersionTimeline {
  quote_id: string;
  timeline: VersionTimelineEntry[];
}

/**
 * Restore version request body
 */
export interface RestoreVersionDto {
  reason: string;
}

/**
 * Restore version response
 */
export interface RestoreVersionResponse {
  success: boolean;
  new_version_number: number;
  message: string;
}

// ========== API FUNCTIONS ==========

/**
 * Get all versions for a quote
 * @endpoint GET /quotes/:quoteId/versions
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @returns Array of all versions with full snapshots
 * @throws 404 - Quote not found
 * @note Returns array directly (not wrapped in object)
 * @note Versions are sorted by version_number descending (latest first)
 */
export const getVersions = async (quoteId: string): Promise<QuoteVersion[]> => {
  const { data } = await apiClient.get<QuoteVersion[]>(`/quotes/${quoteId}/versions`);
  return data;
};

/**
 * Get specific version by ID
 * @endpoint GET /quotes/:quoteId/versions/:versionId
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @param versionId Version UUID
 * @returns Single version with full snapshot
 * @throws 404 - Quote or version not found
 */
export const getVersion = async (
  quoteId: string,
  versionId: string
): Promise<QuoteVersion> => {
  const { data } = await apiClient.get<QuoteVersion>(
    `/quotes/${quoteId}/versions/${versionId}`
  );
  return data;
};

/**
 * Compare two versions of a quote
 * @endpoint GET /quotes/:quoteId/versions/compare?from=X&to=Y
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @param fromVersion Version number as string (e.g., "1.0", "2.8")
 * @param toVersion Version number as string (e.g., "1.5", "2.9")
 * @returns Detailed comparison with changes
 * @throws 400 - Invalid version numbers (expects version numbers, not UUIDs)
 * @throws 404 - Quote or versions not found
 * @note IMPORTANT: Use version numbers (e.g., "2.8"), NOT version IDs (UUIDs)
 * @note API documentation incorrectly states to use version IDs
 */
export const compareVersions = async (
  quoteId: string,
  fromVersion: string,
  toVersion: string
): Promise<VersionComparison> => {
  const { data } = await apiClient.get<VersionComparison>(
    `/quotes/${quoteId}/versions/compare`,
    {
      params: {
        from: fromVersion,
        to: toVersion,
      },
    }
  );
  return data;
};

/**
 * Restore a previous version
 * @endpoint POST /quotes/:quoteId/versions/:versionNumber/restore
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param versionNumber Version number as string (e.g., "1.0", "2.5")
 * @param dto Reason for restore (required, audited)
 * @returns Success response with new version number
 * @throws 400 - Reason required
 * @throws 404 - Quote or version not found
 * @throws 500 - Backend decimal handling error (known issue)
 * @note Creates new version with restored data (doesn't delete current version)
 * @note Current version is backed up before restore
 * @warning Backend has known issue with decimal handling - may return 500 error
 */
export const restoreVersion = async (
  quoteId: string,
  versionNumber: string,
  dto: RestoreVersionDto
): Promise<RestoreVersionResponse> => {
  const { data } = await apiClient.post<RestoreVersionResponse>(
    `/quotes/${quoteId}/versions/${versionNumber}/restore`,
    dto
  );
  return data;
};

/**
 * Get version timeline (chronological history)
 * @endpoint GET /quotes/:quoteId/versions/timeline
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @returns Timeline of version events
 * @throws 404 - Quote not found
 * @note Returns timeline sorted chronologically (oldest to newest)
 */
export const getVersionTimeline = async (quoteId: string): Promise<VersionTimeline> => {
  const { data } = await apiClient.get<VersionTimeline>(
    `/quotes/${quoteId}/versions/timeline`
  );
  return data;
};

/**
 * Get version summary by version number
 * @endpoint GET /quotes/:quoteId/versions/:versionNumber/summary
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @param versionNumber Version number as string
 * @returns Simplified version info
 * @throws 404 - Quote or version not found
 * @note Returns lighter payload than full version (no snapshot data)
 */
export const getVersionSummary = async (
  quoteId: string,
  versionNumber: string
): Promise<VersionSummary> => {
  const { data } = await apiClient.get<VersionSummary>(
    `/quotes/${quoteId}/versions/${versionNumber}/summary`
  );
  return data;
};

// ========== HELPER FUNCTIONS ==========

/**
 * Extract version number from version object
 * Helper to ensure correct format for comparison/restore endpoints
 */
export const getVersionNumberString = (version: QuoteVersion | VersionSummary): string => {
  return version.version_number.toString();
};

/**
 * Format version number for display
 * e.g., 1.0 -> "v1.0", 2.5 -> "v2.5"
 */
export const formatVersionNumber = (versionNumber: number): string => {
  return `v${versionNumber.toFixed(1)}`;
};

/**
 * Calculate change direction from comparison
 * Returns 'increased', 'decreased', or 'unchanged'
 */
export const getChangeDirection = (
  comparison: VersionComparison
): 'increased' | 'decreased' | 'unchanged' => {
  const { total_change_amount } = comparison.summary;
  if (total_change_amount > 0) return 'increased';
  if (total_change_amount < 0) return 'decreased';
  return 'unchanged';
};

/**
 * Check if version has significant changes
 * Returns true if items or totals changed
 */
export const hasSignificantChanges = (comparison: VersionComparison): boolean => {
  const { summary } = comparison;
  return (
    summary.items_added > 0 ||
    summary.items_removed > 0 ||
    summary.items_modified > 0 ||
    summary.total_change_amount !== 0
  );
};

/**
 * Get change summary text for display
 * e.g., "3 items added, 1 removed"
 */
export const getChangeSummaryText = (comparison: VersionComparison): string => {
  const { summary } = comparison;
  const parts: string[] = [];

  if (summary.items_added > 0) {
    parts.push(`${summary.items_added} item${summary.items_added > 1 ? 's' : ''} added`);
  }
  if (summary.items_removed > 0) {
    parts.push(`${summary.items_removed} removed`);
  }
  if (summary.items_modified > 0) {
    parts.push(`${summary.items_modified} modified`);
  }
  if (summary.settings_changed) {
    parts.push('settings changed');
  }

  return parts.length > 0 ? parts.join(', ') : 'No changes';
};
