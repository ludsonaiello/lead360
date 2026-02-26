/**
 * Sprint BAS14: Usage summary DTO
 * Monthly usage summary for tenant reporting
 */
export class UsageSummaryDto {
  tenant_id: string;
  year: number;
  month: number;
  minutes_used: number;
  minutes_included: number;
  overage_minutes: number;
  estimated_overage_cost: number | null;
  total_calls: number;
  percentage_used: number; // minutes_used / minutes_included * 100
}
