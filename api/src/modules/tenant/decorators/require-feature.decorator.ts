import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for required feature flag
 */
export const REQUIRED_FEATURE_KEY = 'required_feature';

/**
 * @RequireFeature() Decorator
 *
 * Use this decorator on controller routes to enforce feature flag access.
 * Must be used with FeatureFlagGuard.
 *
 * Example usage:
 *
 * @Controller('quotes')
 * @UseGuards(JwtAuthGuard, FeatureFlagGuard)
 * export class QuotesController {
 *   @RequireFeature('quotes_module')
 *   @Get()
 *   async findAll() { ... }
 * }
 *
 * Available feature flags (defined in subscription plan):
 * - leads_module
 * - quotes_module
 * - invoices_module
 * - scheduling_module
 * - time_tracking_module
 * - inventory_module
 * - advanced_reporting
 */
export const RequireFeature = (featureName: string) =>
  SetMetadata(REQUIRED_FEATURE_KEY, featureName);
