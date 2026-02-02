// Lead360 - Change Orders API Client
// Change order endpoints for approved quotes
// Base URL: /api/v1 (configured in axios.ts)
//
// IMPORTANT: Types match backend DTOs exactly.
// Backend source: /api/src/modules/quotes/dto/change-order/
// Change orders are stored in the quote table with parent_quote_id FK.
// Status uses the quote_status enum (not a separate change order status).

import { apiClient } from './axios';
import type {
  QuoteStatus,
  CreateChangeOrderDto,
  ApproveChangeOrderDto,
  RejectChangeOrderDto,
  ChangeOrderResponseDto,
  ChangeOrderSummaryDto,
  ListChangeOrdersResponseDto,
  ParentQuoteTotalsDto,
  ChangeOrderHistoryEvent,
  ChangeOrderHistoryResponse,
} from '../types/quotes';

// ========== STATUS CONSTANTS ==========

/**
 * Pending statuses (change order is still in progress, not yet approved/denied)
 * Backend uses these to calculate pending_count and pending_change_orders_total
 */
export const PENDING_STATUSES: QuoteStatus[] = [
  'draft',
  'pending_approval',
  'ready',
  'sent',
  'delivered',
  'read',
  'opened',
  'downloaded',
];

/**
 * Statuses that allow approval
 * Backend validates: ready, sent, delivered, read, opened, downloaded
 */
export const APPROVABLE_STATUSES: QuoteStatus[] = [
  'ready',
  'sent',
  'delivered',
  'read',
  'opened',
  'downloaded',
];

/**
 * Valid parent quote statuses for creating change orders
 * Backend validates: approved, started, concluded
 */
export const VALID_PARENT_STATUSES: QuoteStatus[] = [
  'approved',
  'started',
  'concluded',
];

// ========== TYPE ALIASES ==========
// Using types from quotes.ts for consistency

export type ChangeOrderResponse = ChangeOrderResponseDto;
export type ChangeOrderSummary = ChangeOrderSummaryDto;
export type ListChangeOrdersResponse = ListChangeOrdersResponseDto;
export type ParentQuoteTotals = ParentQuoteTotalsDto;

// ========== API FUNCTIONS ==========

/**
 * Create change order for approved quote
 * @endpoint POST /quotes/:parentQuoteId/change-orders
 * @roles Owner, Admin, Manager, Sales
 * @param parentQuoteId Parent quote UUID (must be approved, started, or concluded)
 * @param dto Change order creation data
 * @returns Created change order with parent context (ChangeOrderResponseDto)
 * @throws 400 - Parent quote must be approved, started, or concluded
 * @throws 404 - Parent quote not found
 * @note Creates new child quote - add items separately using quote item endpoints
 * @note Child quote inherits parent's customer, vendor, jobsite (unless overridden)
 * @note Status starts as 'draft'
 */
export const createChangeOrder = async (
  parentQuoteId: string,
  dto: CreateChangeOrderDto
): Promise<ChangeOrderResponse> => {
  const { data } = await apiClient.post<ChangeOrderResponse>(
    `/quotes/${parentQuoteId}/change-orders`,
    dto
  );
  return data;
};

/**
 * List all change orders for a parent quote
 * @endpoint GET /quotes/:parentQuoteId/change-orders
 * @roles Owner, Admin, Manager, Sales, Field
 * @param parentQuoteId Parent quote UUID
 * @returns Change orders list with summary statistics
 * @throws 404 - Parent quote not found
 * @note Returns empty change_orders array if no change orders exist
 */
export const getChangeOrders = async (
  parentQuoteId: string
): Promise<ListChangeOrdersResponse> => {
  const { data } = await apiClient.get<ListChangeOrdersResponse>(
    `/quotes/${parentQuoteId}/change-orders`
  );
  return data;
};

/**
 * Get parent quote totals with aggregated change order impact
 * @endpoint GET /quotes/:quoteId/with-change-orders
 * @roles Owner, Admin, Manager, Sales, Field
 * @param quoteId Parent quote UUID
 * @returns Parent totals with approved/pending breakdown
 * @throws 404 - Parent quote not found
 * @note revised_total = original_total + approved_change_orders_total
 */
export const getParentQuoteTotals = async (
  quoteId: string
): Promise<ParentQuoteTotals> => {
  const { data } = await apiClient.get<ParentQuoteTotals>(
    `/quotes/${quoteId}/with-change-orders`
  );
  return data;
};

/**
 * Approve change order
 * @endpoint POST /change-orders/:id/approve
 * @roles Owner, Admin, Manager
 * @param changeOrderId Change order UUID
 * @param dto Optional approval notes
 * @returns Approved change order with parent context (status will be 'approved')
 * @throws 400 - Change order not in approvable status (must be ready/sent/delivered/read/opened/downloaded)
 * @throws 400 - Not a change order (no parent_quote_id)
 * @throws 404 - Change order not found
 * @note Creates version snapshot and audit log entry
 */
export const approveChangeOrder = async (
  changeOrderId: string,
  dto?: ApproveChangeOrderDto
): Promise<ChangeOrderResponse> => {
  const { data } = await apiClient.post<ChangeOrderResponse>(
    `/change-orders/${changeOrderId}/approve`,
    dto || {}
  );
  return data;
};

/**
 * Reject change order
 * @endpoint POST /change-orders/:id/reject
 * @roles Owner, Admin, Manager
 * @param changeOrderId Change order UUID
 * @param dto Rejection reason (required, min 10 characters)
 * @returns Rejected change order (status will be 'denied')
 * @throws 400 - Not a change order (no parent_quote_id)
 * @throws 400 - Rejection reason missing or too short (min 10 chars)
 * @throws 404 - Change order not found
 * @note Backend sets status to 'denied' (not 'rejected')
 * @note Rejection reason stored in audit log metadata, NOT on quote record
 */
export const rejectChangeOrder = async (
  changeOrderId: string,
  dto: RejectChangeOrderDto
): Promise<ChangeOrderResponse> => {
  const { data } = await apiClient.post<ChangeOrderResponse>(
    `/change-orders/${changeOrderId}/reject`,
    dto
  );
  return data;
};

/**
 * Get change order history timeline
 * @endpoint GET /quotes/:parentQuoteId/change-orders/history
 * @roles Owner, Admin, Manager, Sales, Field
 * @param parentQuoteId Parent quote UUID
 * @returns Chronological timeline of change order events (oldest first)
 * @throws 404 - Parent quote not found
 */
export const getChangeOrderHistory = async (
  parentQuoteId: string
): Promise<ChangeOrderHistoryResponse> => {
  const { data } = await apiClient.get<ChangeOrderHistoryResponse>(
    `/quotes/${parentQuoteId}/change-orders/history`
  );
  return data;
};

/**
 * Link change order to project (placeholder - not yet implemented)
 * @endpoint POST /change-orders/:id/link-to-project
 * @roles Owner, Admin, Manager
 * @param changeOrderId Change order UUID
 * @returns Placeholder message
 * @note This endpoint is a placeholder for future project integration
 */
export const linkToProject = async (
  changeOrderId: string
): Promise<{ message: string; planned_for: string }> => {
  const { data } = await apiClient.post<{ message: string; planned_for: string }>(
    `/change-orders/${changeOrderId}/link-to-project`
  );
  return data;
};

// ========== HELPER FUNCTIONS ==========

/**
 * Check if change order can be edited
 * Editable when in draft or pre-send statuses
 */
export const canEditChangeOrder = (status: string): boolean => {
  return ['draft', 'pending_approval', 'ready'].includes(status);
};

/**
 * Check if change order can be approved
 * Backend validates: ready, sent, delivered, read, opened, downloaded
 */
export const canApproveChangeOrder = (status: string): boolean => {
  return APPROVABLE_STATUSES.includes(status as QuoteStatus);
};

/**
 * Check if change order is in a pending state (not yet finalized)
 */
export const isPendingStatus = (status: string): boolean => {
  return PENDING_STATUSES.includes(status as QuoteStatus);
};

/**
 * Check if change order is finalized (approved or denied)
 */
export const isFinalizedStatus = (status: string): boolean => {
  return status === 'approved' || status === 'denied';
};

/**
 * Check if parent quote can have change orders created
 * Backend validates: approved, started, concluded
 */
export const canCreateChangeOrderForParent = (parentStatus: string): boolean => {
  return VALID_PARENT_STATUSES.includes(parentStatus as QuoteStatus);
};

/**
 * Get change order status label for display
 */
export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    ready: 'Ready',
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Read',
    opened: 'Opened',
    downloaded: 'Downloaded',
    approved: 'Approved',
    denied: 'Denied',
    started: 'Started',
    concluded: 'Concluded',
  };
  return labels[status] || status;
};

/**
 * Get change order status color class for badge styling
 */
export const getStatusColorClass = (status: string): string => {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200',
    pending_approval: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200',
    ready: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
    sent: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200',
    delivered: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200',
    read: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200',
    opened: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200',
    downloaded: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-200',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200',
    denied: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
    started: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200',
    concluded: 'bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
};

/**
 * Get status badge variant for Badge component
 */
export const getStatusBadgeVariant = (status: string): string => {
  if (status === 'approved') return 'success';
  if (status === 'denied') return 'danger';
  if (isPendingStatus(status)) return 'warning';
  return 'gray';
};

/**
 * Format money amount for display
 */
export const formatMoney = (amount: number): string => {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
 * Calculate percentage change from original total
 */
export const calculatePercentageChange = (
  originalTotal: number,
  changeAmount: number
): number => {
  if (originalTotal === 0) return 0;
  return (changeAmount / originalTotal) * 100;
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
 * Group change order summaries by status category
 */
export const groupByStatusCategory = (
  changeOrders: ChangeOrderSummary[]
): { pending: ChangeOrderSummary[]; approved: ChangeOrderSummary[]; denied: ChangeOrderSummary[] } => {
  return changeOrders.reduce(
    (acc, co) => {
      if (co.status === 'approved') {
        acc.approved.push(co);
      } else if (co.status === 'denied') {
        acc.denied.push(co);
      } else {
        acc.pending.push(co);
      }
      return acc;
    },
    { pending: [] as ChangeOrderSummary[], approved: [] as ChangeOrderSummary[], denied: [] as ChangeOrderSummary[] }
  );
};

/**
 * Get most recent change order from a list
 */
export const getMostRecent = (changeOrders: ChangeOrderSummary[]): ChangeOrderSummary | null => {
  if (changeOrders.length === 0) return null;
  return changeOrders.reduce((latest, co) =>
    new Date(co.created_at) > new Date(latest.created_at) ? co : latest
  );
};
