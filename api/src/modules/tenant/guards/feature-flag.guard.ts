import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../services/subscription.service';
import { REQUIRED_FEATURE_KEY } from '../decorators/require-feature.decorator';

/**
 * FeatureFlagGuard
 *
 * Checks if the tenant's subscription plan includes the required feature flag.
 * Used with @RequireFeature() decorator on controller routes.
 *
 * Example:
 * @RequireFeature('quotes_module')
 * @Get('quotes')
 * async getQuotes() { ... }
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required feature from decorator metadata
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      REQUIRED_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no feature required, allow access
    if (!requiredFeature) {
      return true;
    }

    // Get request object
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenant_id;

    // If no tenant_id in request, deny access
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant context required. Please ensure you are accessing from a valid subdomain.',
      );
    }

    // Check if tenant has access to this feature
    const hasAccess = await this.subscriptionService.checkFeatureAccess(
      tenantId,
      requiredFeature,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Your subscription plan does not include access to the '${requiredFeature}' feature. Please upgrade your plan to access this functionality.`,
      );
    }

    return true;
  }
}
