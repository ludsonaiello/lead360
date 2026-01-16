import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../core/database/prisma.service';

export const SKIP_TRIAL_CHECK_KEY = 'skipTrialCheck';

/**
 * TrialGuard
 *
 * Checks if tenant's trial has expired and blocks access if so.
 * Platform admins bypass this check.
 * Certain routes can be excluded using @SkipTrialCheck() decorator.
 *
 * Blocked statuses:
 * - subscription_status = 'canceled' (trial expired or subscription ended)
 * - trial_end_date < now() and subscription_status = 'trial'
 *
 * Allowed statuses:
 * - subscription_status = 'active' (paid subscription)
 * - subscription_status = 'trial' AND trial_end_date >= now() (active trial)
 * - subscription_status = 'past_due' (grace period - allow access but show warning)
 */
@Injectable()
export class TrialGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if trial check should be skipped for this route
    const skipTrialCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRIAL_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipTrialCheck) {
      return true;
    }

    // Get request object
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Platform admins bypass trial checks
    if (user?.is_platform_admin) {
      return true;
    }

    const tenantId = request.tenant_id || user?.tenant_id;

    // If no tenant context, allow (will be caught by tenant middleware)
    if (!tenantId) {
      return true;
    }

    // Get tenant subscription status
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscription_status: true,
        trial_end_date: true,
        company_name: true,
      },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    // Check subscription status
    const now = new Date();

    // Canceled subscriptions are blocked
    if (tenant.subscription_status === 'canceled') {
      throw new ForbiddenException(
        'Your subscription has been canceled. Please contact support or upgrade your plan to regain access.',
      );
    }

    // Check if trial has expired
    if (
      tenant.subscription_status === 'trial' &&
      tenant.trial_end_date &&
      tenant.trial_end_date < now
    ) {
      throw new ForbiddenException(
        `Your trial period has expired. Please upgrade to a paid plan to continue using ${tenant.company_name || 'this service'}.`,
      );
    }

    // Allow access for:
    // - Active subscriptions
    // - Valid trials (trial_end_date >= now)
    // - Past due (grace period)
    return true;
  }
}
