import { SetMetadata } from '@nestjs/common';
import { SKIP_TRIAL_CHECK_KEY } from '../guards/trial.guard';

/**
 * SkipTrialCheck Decorator
 *
 * Use this decorator on routes that should be accessible even if trial has expired.
 * Typically used for:
 * - Billing/subscription management endpoints
 * - Upgrade/checkout pages
 * - Account settings
 * - Logout endpoints
 *
 * Example:
 * @SkipTrialCheck()
 * @Get('billing')
 * async getBillingInfo() { ... }
 */
export const SkipTrialCheck = () => SetMetadata(SKIP_TRIAL_CHECK_KEY, true);
