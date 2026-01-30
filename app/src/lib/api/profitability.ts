import { apiClient } from './axios';
import type {
  ProfitabilityValidation,
  ProfitabilityAnalysis,
} from '@/lib/types/quotes';

/**
 * Validate quote profitability
 * @endpoint GET /quotes/:quoteId/profitability/validate
 * @permission Owner, Admin, Manager, Sales
 * @param quoteId Quote UUID
 * @returns Profitability validation with warnings and thresholds
 * @throws 404 - Quote not found
 */
export const validateProfitability = async (
  quoteId: string
): Promise<ProfitabilityValidation> => {
  const { data} = await apiClient.get<ProfitabilityValidation>(
    `/quotes/${quoteId}/profitability/validate`
  );
  return data;
};

/**
 * Analyze quote margins and profitability
 * @endpoint GET /quotes/:quoteId/profitability/analysis
 * @permission Owner, Admin, Manager, Sales
 * @param quoteId Quote UUID
 * @returns Detailed profitability analysis with cost breakdown and item-by-item margins
 * @throws 404 - Quote not found
 */
export const analyzeProfitability = async (
  quoteId: string
): Promise<ProfitabilityAnalysis> => {
  const { data } = await apiClient.get<ProfitabilityAnalysis>(
    `/quotes/${quoteId}/profitability/analysis`
  );
  return data;
};
