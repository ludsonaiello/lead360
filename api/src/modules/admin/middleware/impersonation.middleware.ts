import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ImpersonationService } from '../services/impersonation.service';

// Extend Express Request to include impersonation context
declare global {
  namespace Express {
    interface Request {
      impersonating_admin?: any;
      is_impersonating?: boolean;
    }
  }
}

/**
 * Impersonation Middleware
 *
 * Checks for X-Impersonation-Token header and overrides current user if valid.
 * Injects impersonation context into request for audit logging.
 *
 * Applied globally to all routes.
 */
@Injectable()
export class ImpersonationMiddleware implements NestMiddleware {
  constructor(private readonly impersonationService: ImpersonationService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Check for impersonation token in header
    const impersonationToken = req.headers['x-impersonation-token'] as string;

    if (!impersonationToken) {
      // No impersonation token - proceed normally
      return next();
    }

    try {
      // Validate impersonation session
      const session =
        await this.impersonationService.validateImpersonationSession(
          impersonationToken,
        );

      // Override current user with impersonated user
      req.user = session.impersonated_user as any;

      // Store original admin context for audit logging
      req.impersonating_admin = session.admin_user;
      req.is_impersonating = true;

      // Also override tenant_id if needed
      if (session.impersonated_tenant) {
        req.tenant_id = session.impersonated_tenant.id;
        req.tenant = session.impersonated_tenant;
      }

      // Log impersonation context
      console.log(
        `Impersonation active: Admin ${session.admin_user.email} → User ${session.impersonated_user.email}`,
      );

      next();
    } catch (error) {
      // Invalid or expired token - ignore and proceed normally
      // (Don't block request, just don't apply impersonation)
      console.warn(`Invalid impersonation token: ${error.message}`);
      next();
    }
  }
}
