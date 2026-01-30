// Lead360 - Quote Approvals API Client
// Approval workflow endpoints for quotes
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';

// ========== TYPES ==========

/**
 * Individual approval in the workflow
 */
export interface Approval {
  id: string;
  level: number;
  approver_user_id: string;
  approver: {
    id: string;
    name: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  rejected_at: string | null;
  comments: string | null;
}

/**
 * Approval status for a quote
 */
export interface ApprovalStatus {
  quote_id: string;
  status: string;  // Note: API returns 'status' not 'quote_status'
  approvals: Approval[];
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

/**
 * Pending approval item for dashboard widget
 */
export interface PendingApproval {
  approval_id: string;
  quote_id: string;
  quote_number: string;
  quote_title: string;
  quote_total: number;
  level: number;
  submitted_at: string;
  submitted_by: {
    id: string;
    name: string;
  };
}

/**
 * Pending approvals response
 */
export interface PendingApprovalsResponse {
  pending_approvals: PendingApproval[];
  count: number;
}

/**
 * Approval level configuration (from GET endpoint)
 * Note: GET endpoint returns direct array of levels (not wrapped in object)
 */
export interface ApprovalLevel {
  level: number;
  amount: number;
  approver_role: string;
}

/**
 * Approval threshold for PATCH endpoint
 * Note: PATCH uses different structure than GET
 */
export interface ApprovalThreshold {
  level: number;
  amount: number;
  approver_role: string;
}

/**
 * Update thresholds request body (for PATCH)
 */
export interface UpdateThresholdsDto {
  thresholds: ApprovalThreshold[];
}

/**
 * Update thresholds response
 */
export interface UpdateThresholdsResponse {
  thresholds: ApprovalThreshold[];
  updated_at: string;
}

/**
 * Approve request body
 */
export interface ApproveDto {
  comments?: string;
}

/**
 * Reject request body
 */
export interface RejectDto {
  comments: string;
}

/**
 * Bypass request body
 */
export interface BypassDto {
  reason: string;
}

/**
 * Approval history - individual approval in a workflow
 */
export interface ApprovalHistoryItem {
  id: string;
  level: number;
  approver: {
    id: string;
    name: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  comments: string | null;
  decided_at: string | null;
  created_at: string;
}

/**
 * Approval history - individual workflow
 */
export interface ApprovalWorkflow {
  workflow_id: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  is_current: boolean;
  approvals: ApprovalHistoryItem[];
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

/**
 * Complete approval history response
 */
export interface ApprovalHistoryResponse {
  quote_id: string;
  workflows: ApprovalWorkflow[];
  total_workflows: number;
  current_workflow_id: string | null;
}

// ========== API FUNCTIONS ==========

/**
 * Submit quote for approval
 * @endpoint POST /quotes/:quoteId/submit-for-approval
 * @permission quotes:submit_for_approval
 * @param quoteId Quote UUID
 * @returns Updated quote with approval status
 * @throws 400 - No approval thresholds configured
 * @throws 400 - Quote must be in draft status
 * @throws 404 - Quote not found
 * @note Quote status changes to 'pending_approval'
 */
export const submitForApproval = async (quoteId: string): Promise<ApprovalStatus> => {
  const { data } = await apiClient.post<ApprovalStatus>(
    `/quotes/${quoteId}/submit-for-approval`
  );
  return data;
};

/**
 * Approve quote at specific level
 * @endpoint POST /quotes/:quoteId/approvals/:approvalId/approve
 * @permission quotes:approve
 * @param quoteId Quote UUID
 * @param approvalId Approval UUID
 * @param dto Optional approval comments
 * @returns Updated approval status
 * @throws 400 - Not authorized to approve this level
 * @throws 400 - Previous level not approved yet
 * @throws 404 - Quote or approval not found
 * @note If all levels approved, quote status changes to 'approved'
 */
export const approveQuote = async (
  quoteId: string,
  approvalId: string,
  dto?: ApproveDto
): Promise<ApprovalStatus> => {
  const { data } = await apiClient.post<ApprovalStatus>(
    `/quotes/${quoteId}/approvals/${approvalId}/approve`,
    dto || {}
  );
  return data;
};

/**
 * Reject quote at specific level
 * @endpoint POST /quotes/:quoteId/approvals/:approvalId/reject
 * @permission quotes:approve
 * @param quoteId Quote UUID
 * @param approvalId Approval UUID
 * @param dto Rejection reason (required)
 * @returns Updated approval status
 * @throws 400 - Not authorized to reject this level
 * @throws 400 - Comments required for rejection
 * @throws 404 - Quote or approval not found
 * @note Quote status reverts to 'draft' and all approvals reset
 */
export const rejectQuote = async (
  quoteId: string,
  approvalId: string,
  dto: RejectDto
): Promise<ApprovalStatus> => {
  const { data } = await apiClient.post<ApprovalStatus>(
    `/quotes/${quoteId}/approvals/${approvalId}/reject`,
    dto
  );
  return data;
};

/**
 * Get approval status for a quote
 * @endpoint GET /quotes/:quoteId/approvals
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @returns Approval status with all approval levels
 * @throws 404 - Quote not found
 * @note Returns empty approvals array if quote hasn't been submitted
 */
export const getApprovalStatus = async (quoteId: string): Promise<ApprovalStatus> => {
  const { data } = await apiClient.get<ApprovalStatus>(`/quotes/${quoteId}/approvals`);
  return data;
};

/**
 * Get complete approval history for a quote
 * @endpoint GET /quotes/:quoteId/approvals/history
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @returns Complete approval workflow history with all attempts
 * @throws 404 - Quote not found
 * @note Returns all workflows (current + past), newest first
 * @note Use for audit trail and understanding rejection history
 */
export const getApprovalHistory = async (quoteId: string): Promise<ApprovalHistoryResponse> => {
  const { data } = await apiClient.get<ApprovalHistoryResponse>(
    `/quotes/${quoteId}/approvals/history`
  );
  return data;
};

/**
 * Get quotes pending current user's approval
 * @endpoint GET /users/me/pending-approvals
 * @permission quotes:view
 * @returns List of quotes awaiting user's approval
 * @note Only returns quotes where user is assigned approver for current level
 */
export const getPendingApprovals = async (): Promise<PendingApprovalsResponse> => {
  const { data } = await apiClient.get<PendingApprovalsResponse>('/users/me/pending-approvals');
  return data;
};

/**
 * Owner bypass - skip all approval levels
 * @endpoint POST /quotes/:quoteId/approvals/bypass
 * @permission quotes:bypass_approval (Owner only)
 * @param quoteId Quote UUID
 * @param dto Reason for bypass (required, audited)
 * @returns Updated approval status
 * @throws 403 - Only Owner role can bypass
 * @throws 400 - Reason required
 * @throws 404 - Quote not found
 * @note Sets quote status directly to 'approved', bypassing all levels
 * @warning This action is audited and should be used sparingly
 */
export const bypassApproval = async (
  quoteId: string,
  dto: BypassDto
): Promise<ApprovalStatus> => {
  const { data } = await apiClient.post<ApprovalStatus>(
    `/quotes/${quoteId}/approvals/bypass`,
    dto
  );
  return data;
};

/**
 * Reset approvals - return quote to draft
 * @endpoint POST /quotes/:quoteId/approvals/reset
 * @permission quotes:manage_approvals
 * @param quoteId Quote UUID
 * @returns Updated approval status
 * @throws 404 - Quote not found
 * @note Clears all approval history and returns quote to draft status
 */
export const resetApprovals = async (quoteId: string): Promise<ApprovalStatus> => {
  const { data } = await apiClient.post<ApprovalStatus>(
    `/quotes/${quoteId}/approvals/reset`
  );
  return data;
};

/**
 * Get approval threshold configuration
 * @endpoint GET /quotes/settings/approval-thresholds
 * @permission quotes:view_settings
 * @returns Approval level configuration (array) or null if disabled
 * @note GET returns direct array of approval levels (not wrapped in object)
 */
export const getApprovalThresholds = async (): Promise<ApprovalLevel[] | null> => {
  const { data } = await apiClient.get<ApprovalLevel[] | null>(
    '/quotes/settings/approval-thresholds'
  );
  return data;
};

/**
 * Update approval threshold configuration
 * @endpoint PATCH /quotes/settings/approval-thresholds
 * @permission quotes:manage_settings (Admin/Owner only)
 * @param dto Threshold configuration
 * @returns Updated thresholds with timestamp
 * @throws 400 - Validation errors (must have 1-5 levels, thresholds must be array)
 * @note PATCH expects 'thresholds' array with approver_role, amount (different from GET structure)
 * @warning GET and PATCH have different field names! Use transformation helpers.
 */
export const updateApprovalThresholds = async (
  dto: UpdateThresholdsDto
): Promise<UpdateThresholdsResponse> => {
  const { data } = await apiClient.patch<UpdateThresholdsResponse>(
    '/quotes/settings/approval-thresholds',
    dto
  );
  return data;
};

// ========== TRANSFORMATION HELPERS ==========

/**
 * Transform GET approval levels to PATCH thresholds format
 * Needed because GET and PATCH use different structures
 */
export const transformLevelsToThresholds = (
  levels: ApprovalLevel[]
): ApprovalThreshold[] => {
  return levels.map((level) => ({
    level: level.level,
    amount: level.amount,
    approver_role: level.approver_role,
  }));
};

/**
 * Transform PATCH thresholds to display format
 * For displaying in forms/tables
 */
export const transformThresholdsToLevels = (
  thresholds: ApprovalThreshold[]
): ApprovalLevel[] => {
  return thresholds.map((threshold) => ({
    level: threshold.level,
    amount: threshold.amount,
    approver_role: threshold.approver_role,
  }));
};
