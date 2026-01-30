import { apiClient } from './axios';
import type {
  DiscountRule,
  DiscountRulesListResponse,
  CreateDiscountRuleDto,
  UpdateDiscountRuleDto,
  ReorderDiscountRulesDto,
  DiscountPreviewRequest,
  DiscountPreviewResponse,
} from '@/lib/types/quotes';

/**
 * Create discount rule
 * @endpoint POST /quotes/:quoteId/discount-rules
 * @permission Owner, Admin, Manager
 * @param quoteId Quote UUID
 * @param dto Discount rule creation data
 * @returns Created discount rule
 * @throws 400 - Validation errors, cannot modify approved quote
 * @throws 404 - Quote not found
 */
export const createDiscountRule = async (
  quoteId: string,
  dto: CreateDiscountRuleDto
): Promise<DiscountRule> => {
  const { data } = await apiClient.post<DiscountRule>(
    `/quotes/${quoteId}/discount-rules`,
    dto
  );
  return data;
};

/**
 * List discount rules for quote
 * @endpoint GET /quotes/:quoteId/discount-rules
 * @permission Owner, Admin, Manager, Sales, Field
 * @param quoteId Quote UUID
 * @returns Discount rules list with totals
 * @throws 404 - Quote not found
 */
export const listDiscountRules = async (
  quoteId: string
): Promise<DiscountRulesListResponse> => {
  const { data } = await apiClient.get<DiscountRulesListResponse>(
    `/quotes/${quoteId}/discount-rules`
  );
  return data;
};

/**
 * Get single discount rule
 * @endpoint GET /quotes/:quoteId/discount-rules/:ruleId
 * @permission Owner, Admin, Manager, Sales, Field
 * @param quoteId Quote UUID
 * @param ruleId Discount rule UUID
 * @returns Discount rule
 * @throws 404 - Quote or discount rule not found
 */
export const getDiscountRule = async (
  quoteId: string,
  ruleId: string
): Promise<DiscountRule> => {
  const { data } = await apiClient.get<DiscountRule>(
    `/quotes/${quoteId}/discount-rules/${ruleId}`
  );
  return data;
};

/**
 * Update discount rule
 * @endpoint PATCH /quotes/:quoteId/discount-rules/:ruleId
 * @permission Owner, Admin, Manager
 * @param quoteId Quote UUID
 * @param ruleId Discount rule UUID
 * @param dto Discount rule update data
 * @returns Updated discount rule
 * @throws 400 - Validation errors, cannot modify approved quote
 * @throws 404 - Quote or discount rule not found
 */
export const updateDiscountRule = async (
  quoteId: string,
  ruleId: string,
  dto: UpdateDiscountRuleDto
): Promise<DiscountRule> => {
  const { data } = await apiClient.patch<DiscountRule>(
    `/quotes/${quoteId}/discount-rules/${ruleId}`,
    dto
  );
  return data;
};

/**
 * Delete discount rule
 * @endpoint DELETE /quotes/:quoteId/discount-rules/:ruleId
 * @permission Owner, Admin, Manager
 * @param quoteId Quote UUID
 * @param ruleId Discount rule UUID
 * @returns void
 * @throws 400 - Cannot modify approved quote
 * @throws 404 - Quote or discount rule not found
 */
export const deleteDiscountRule = async (
  quoteId: string,
  ruleId: string
): Promise<void> => {
  await apiClient.delete(`/quotes/${quoteId}/discount-rules/${ruleId}`);
};

/**
 * Reorder discount rules
 * @endpoint PATCH /quotes/:quoteId/discount-rules/reorder
 * @permission Owner, Admin, Manager
 * @param quoteId Quote UUID
 * @param dto Reorder data with rule_orders array
 * @returns void
 * @throws 400 - Cannot modify approved quote
 * @throws 404 - Quote not found
 */
export const reorderDiscountRules = async (
  quoteId: string,
  dto: ReorderDiscountRulesDto
): Promise<void> => {
  await apiClient.patch(`/quotes/${quoteId}/discount-rules/reorder`, dto);
};

/**
 * Preview discount impact
 * @endpoint POST /quotes/:quoteId/discount-rules/preview
 * @permission Owner, Admin, Manager, Sales
 * @param quoteId Quote UUID
 * @param dto Discount preview request (rule_type and value)
 * @returns Discount preview with margin impact
 * @throws 404 - Quote not found
 */
export const previewDiscountImpact = async (
  quoteId: string,
  dto: DiscountPreviewRequest
): Promise<DiscountPreviewResponse> => {
  const { data } = await apiClient.post<DiscountPreviewResponse>(
    `/quotes/${quoteId}/discount-rules/preview`,
    dto
  );
  return data;
};
