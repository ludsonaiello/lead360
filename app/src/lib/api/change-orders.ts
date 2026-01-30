// Lead360 - Change Orders API Client
// Change order endpoints for approved quotes
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';

// ========== TYPES ==========

/**
 * Change order status
 */
export type ChangeOrderStatus = 'pending' | 'approved' | 'rejected';

/**
 * Change order object
 */
export interface ChangeOrder {
  id: string;
  change_order_number: string;
  parent_quote_id: string;
  child_quote_id: string;  // New quote created for the changes
  title: string;
  description: string | null;
  status: ChangeOrderStatus;
  amount_change: number;  // Difference from parent quote
  new_total: number;  // Parent total + amount_change
  created_at: string;
  approved_at: string | null;
  approved_by: {
    id: string;
    name: string;
  } | null;
  rejected_at: string | null;
  rejected_by: {
    id: string;
    name: string;
  } | null;
  rejection_reason: string | null;
}

/**
 * Change orders list response
 */
export interface ChangeOrdersResponse {
  change_orders: ChangeOrder[];
  total_count: number;
}

/**
 * Total impact of all change orders
 */
export interface TotalImpact {
  original_total: number;
  total_approved_changes: number;
  total_pending_changes: number;
  net_change: number;  // approved only
  new_total: number;  // original + net_change
  change_orders_count: {
    approved: number;
    pending: number;
    rejected: number;
    total: number;
  };
}

/**
 * Change order history entry
 */
export interface ChangeOrderHistoryEntry {
  change_order_id: string;
  change_order_number: string;
  title: string;
  status: ChangeOrderStatus;
  amount_change: number;
  created_at: string;
  approved_at: string | null;
  created_by: {
    id: string;
    name: string;
  };
}

/**
 * Change order history timeline
 */
export interface ChangeOrderHistory {
  parent_quote_id: string;
  parent_quote_number: string;
  history: ChangeOrderHistoryEntry[];
}

/**
 * Create change order request body
 * Note: Only title and description - items are added separately
 */
export interface CreateChangeOrderDto {
  title: string;
  description?: string;
}

/**
 * Create change order response
 */
export interface CreateChangeOrderResponse {
  change_order: ChangeOrder;
  child_quote: {
    id: string;
    quote_number: string;
  };
  message: string;
}

/**
 * Approve change order response
 */
export interface ApproveChangeOrderResponse {
  change_order: ChangeOrder;
  parent_quote_updated: boolean;
  message: string;
}

/**
 * Link to project request body
 */
export interface LinkToProjectDto {
  project_id: string;
}

// ========== API FUNCTIONS ==========

/**
 * Create change order for approved quote
 * @endpoint POST /quotes/:parentQuoteId/change-orders
 * @permission quotes:create_change_order
 * @param parentQuoteId Parent quote UUID (must be approved)
 * @param dto Change order creation data (title, description only)
 * @returns Created change order and child quote info
 * @throws 400 - Parent quote must be approved
 * @throws 404 - Parent quote not found
 * @note Creates new child quote for the changes - add items separately using quote item endpoints
 * @note Child quote inherits parent's settings and customer info
 */
export const createChangeOrder = async (
  parentQuoteId: string,
  dto: CreateChangeOrderDto
): Promise<CreateChangeOrderResponse> => {
  const { data } = await apiClient.post<CreateChangeOrderResponse>(
    `/quotes/${parentQuoteId}/change-orders`,
    dto
  );
  return data;
};

/**
 * Get all change orders for a quote
 * @endpoint GET /quotes/:parentQuoteId/change-orders
 * @permission quotes:view
 * @param parentQuoteId Parent quote UUID
 * @returns List of change orders with counts
 * @throws 404 - Quote not found
 * @note Returns empty array if no change orders exist
 */
export const getChangeOrders = async (
  parentQuoteId: string
): Promise<ChangeOrdersResponse> => {
  const { data } = await apiClient.get<ChangeOrdersResponse>(
    `/quotes/${parentQuoteId}/change-orders`
  );
  return data;
};

/**
 * Get total impact of all change orders
 * @endpoint GET /quotes/:parentQuoteId/change-orders/total-impact
 * @permission quotes:view
 * @param parentQuoteId Parent quote UUID
 * @returns Aggregate financial impact and counts
 * @throws 404 - Quote not found
 * @note Only approved change orders affect net_change and new_total
 */
export const getTotalImpact = async (parentQuoteId: string): Promise<TotalImpact> => {
  const { data } = await apiClient.get<TotalImpact>(
    `/quotes/${parentQuoteId}/change-orders/total-impact`
  );
  return data;
};

/**
 * Approve change order
 * @endpoint POST /change-orders/:id/approve
 * @permission quotes:approve_change_order
 * @param changeOrderId Change order UUID
 * @returns Approved change order and update status
 * @throws 400 - Change order already processed
 * @throws 404 - Change order not found
 * @note Approving merges child quote changes into parent quote
 * @note Creates new version of parent quote
 */
export const approveChangeOrder = async (
  changeOrderId: string
): Promise<ApproveChangeOrderResponse> => {
  const { data } = await apiClient.post<ApproveChangeOrderResponse>(
    `/change-orders/${changeOrderId}/approve`
  );
  return data;
};

/**
 * Get change order history timeline
 * @endpoint GET /quotes/:parentQuoteId/change-orders/history
 * @permission quotes:view
 * @param parentQuoteId Parent quote UUID
 * @returns Chronological timeline of all change orders
 * @throws 404 - Quote not found
 * @note Returns timeline sorted by created_at (oldest first)
 */
export const getChangeOrderHistory = async (
  parentQuoteId: string
): Promise<ChangeOrderHistory> => {
  const { data } = await apiClient.get<ChangeOrderHistory>(
    `/quotes/${parentQuoteId}/change-orders/history`
  );
  return data;
};

/**
 * Link change order to project (placeholder)
 * @endpoint POST /change-orders/:id/link-to-project
 * @permission quotes:link_to_project
 * @param changeOrderId Change order UUID
 * @param dto Project link data
 * @returns Success response
 * @throws 404 - Change order not found
 * @note This is a placeholder for future project integration
 */
export const linkToProject = async (
  changeOrderId: string,
  dto: LinkToProjectDto
): Promise<{ success: boolean; message: string }> => {
  const { data } = await apiClient.post<{ success: boolean; message: string }>(
    `/change-orders/${changeOrderId}/link-to-project`,
    dto
  );
  return data;
};

// ========== HELPER FUNCTIONS ==========

/**
 * Check if change order can be edited
 * Returns true if status is 'pending'
 */
export const canEditChangeOrder = (changeOrder: ChangeOrder): boolean => {
  return changeOrder.status === 'pending';
};

/**
 * Check if change order can be approved
 * Returns true if status is 'pending'
 */
export const canApproveChangeOrder = (changeOrder: ChangeOrder): boolean => {
  return changeOrder.status === 'pending';
};

/**
 * Get change order status label
 */
export const getStatusLabel = (status: ChangeOrderStatus): string => {
  const labels: Record<ChangeOrderStatus, string> = {
    pending: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
  };
  return labels[status];
};

/**
 * Get change order status color class
 * For badge styling
 */
export const getStatusColorClass = (status: ChangeOrderStatus): string => {
  const colors: Record<ChangeOrderStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
  };
  return colors[status];
};

/**
 * Format amount change with + or - prefix
 */
export const formatAmountChange = (amount: number): string => {
  const prefix = amount >= 0 ? '+' : '';
  return `${prefix}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Get change direction text
 * e.g., "increased by", "decreased by", "no change"
 */
export const getChangeDirectionText = (amount: number): string => {
  if (amount > 0) return 'increased by';
  if (amount < 0) return 'decreased by';
  return 'no change';
};

/**
 * Calculate percentage change
 * Returns percentage change from original total
 */
export const calculatePercentageChange = (
  originalTotal: number,
  amountChange: number
): number => {
  if (originalTotal === 0) return 0;
  return (amountChange / originalTotal) * 100;
};

/**
 * Format percentage change for display
 * e.g., "+15.5%", "-8.2%"
 */
export const formatPercentageChange = (percentage: number): string => {
  const prefix = percentage >= 0 ? '+' : '';
  return `${prefix}${percentage.toFixed(1)}%`;
};

/**
 * Group change orders by status
 */
export const groupByStatus = (
  changeOrders: ChangeOrder[]
): Record<ChangeOrderStatus, ChangeOrder[]> => {
  return changeOrders.reduce(
    (acc, co) => {
      acc[co.status].push(co);
      return acc;
    },
    { pending: [], approved: [], rejected: [] } as Record<ChangeOrderStatus, ChangeOrder[]>
  );
};

/**
 * Get most recent change order
 */
export const getMostRecent = (changeOrders: ChangeOrder[]): ChangeOrder | null => {
  if (changeOrders.length === 0) return null;
  return changeOrders.reduce((latest, co) =>
    new Date(co.created_at) > new Date(latest.created_at) ? co : latest
  );
};
