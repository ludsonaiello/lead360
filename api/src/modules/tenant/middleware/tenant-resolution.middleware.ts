import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../services/tenant.service';

// Extend Express Request to include tenant_id
declare global {
  namespace Express {
    interface Request {
      tenant_id?: string;
      tenant?: any;
    }
  }
}

/**
 * CRITICAL: Tenant Resolution Middleware
 *
 * Extracts subdomain from request host, looks up tenant, and injects tenant_id into request.
 * This is the foundation of multi-tenant isolation.
 *
 * Applied globally to all routes except public/admin endpoints.
 */
@Injectable()
export class TenantResolutionMiddleware implements NestMiddleware {
  // Special subdomains that bypass tenant resolution
  private readonly SPECIAL_SUBDOMAINS = [
    'www',
    'app',
    'api',
    'admin',
    'mail',
    'webmail',
    'docs',
    'help',
    'support',
  ];

  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip tenant resolution for certain paths
    if (this.shouldSkipTenantResolution(req.path)) {
      return next();
    }

    try {
      // Extract subdomain from host header
      const host = req.headers.host || '';
      const subdomain = this.extractSubdomain(host);

      // If no subdomain or special subdomain, skip tenant resolution
      if (!subdomain || this.SPECIAL_SUBDOMAINS.includes(subdomain)) {
        // For special subdomains, allow request to continue
        // Controller will handle authorization (e.g., admin endpoints require admin auth)
        return next();
      }

      // Look up tenant by subdomain
      const tenant = await this.tenantService.findBySubdomain(subdomain);

      // Inject tenant_id and full tenant object into request
      req.tenant_id = tenant.id;
      req.tenant = tenant;

      next();
    } catch (error) {
      // If tenant not found or inactive, return 404
      if (error instanceof NotFoundException) {
        return res.status(404).json({
          statusCode: 404,
          message: 'Tenant not found. Please check your subdomain.',
          error: 'Not Found',
        });
      }

      // For other errors, pass to error handler
      next(error);
    }
  }

  /**
   * Extract subdomain from host header
   * Examples:
   * - acme-roofing.lead360.app → acme-roofing
   * - acme-roofing.localhost:3000 → acme-roofing
   * - localhost:3000 → null (no subdomain)
   * - www.lead360.app → www
   */
  private extractSubdomain(host: string): string | null {
    // Remove port if present
    const hostWithoutPort = host.split(':')[0];

    // Split by dots
    const parts = hostWithoutPort.split('.');

    // If only one part (e.g., localhost), no subdomain
    if (parts.length <= 1) {
      return null;
    }

    // If two parts (e.g., lead360.app), no subdomain
    if (parts.length === 2) {
      return null;
    }

    // First part is the subdomain
    return parts[0];
  }

  /**
   * Determine if tenant resolution should be skipped for this path
   */
  private shouldSkipTenantResolution(path: string): boolean {
    const skipPaths = [
      '/api/v1/auth/register', // Tenant creation happens here
      '/api/v1/auth/check-subdomain', // Subdomain availability check
      '/api/v1/admin', // Admin endpoints (use different auth)
      '/health', // Health check
      '/api/docs', // Swagger docs
    ];

    return skipPaths.some((skipPath) => path.startsWith(skipPath));
  }
}
