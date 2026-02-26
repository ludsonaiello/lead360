/**
 * Sprint BAS14: Quota check result interface
 * Returned by checkAndReserveMinute() to indicate whether a call is allowed
 */
export interface QuotaCheckResult {
  allowed: boolean;
  is_overage: boolean;
  reason?: 'quota_exceeded' | 'plan_not_included' | 'tenant_disabled';
  minutes_used: number;
  minutes_included: number;
  overage_rate: number | null;
}
