import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../services/tenant.service';
import { AuthenticatedUser, JwtPayload } from '../../auth/entities/jwt-payload.entity';

// Extend Express Request to include tenant_id and tenant
// Note: 'user' is defined by Passport.js and set by JwtStrategy
declare global {
  namespace Express {
    interface Request {
      tenant_id?: string;
      tenant?: any;
    }
    // Extend Express.User to match our AuthenticatedUser type
    interface User extends AuthenticatedUser {}
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

  constructor(
    private readonly tenantService: TenantService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip tenant resolution for certain paths
    if (this.shouldSkipTenantResolution(req.path)) {
      return next();
    }

    try {
      // Extract subdomain from host header
      const host = req.headers.host || '';
      const subdomain = this.extractSubdomain(host);

      // If no subdomain or special subdomain, try to get tenant_id from JWT or header
      if (!subdomain || this.SPECIAL_SUBDOMAINS.includes(subdomain)) {
        // PRIORITY 1: Check X-Impersonate-Tenant-Id header (for Platform Admins viewing tenant data)
        const impersonateTenantId = req.headers['x-impersonate-tenant-id'] as string;

        if (impersonateTenantId) {
          // Verify user is Platform Admin by extracting JWT payload
          const jwtPayload = this.extractJwtPayload(req);
          if (jwtPayload && jwtPayload.is_platform_admin) {
            req.tenant_id = impersonateTenantId;
            // Load full tenant object
            const tenant = await this.tenantService.findById(impersonateTenantId);
            req.tenant = tenant;
            console.log(`[TenantResolution] Admin ${jwtPayload.email} viewing tenant ${impersonateTenantId}`);
            return next();
          }
        }

        // PRIORITY 2: For localhost/IP access (e.g., tests, development), extract tenant_id from JWT token
        const tenantIdFromJwt = this.extractTenantIdFromJwt(req);

        if (tenantIdFromJwt) {
          req.tenant_id = tenantIdFromJwt;
          // Optionally load full tenant object
          const tenant = await this.tenantService.findById(tenantIdFromJwt);
          req.tenant = tenant;
        }
        // Allow request to continue (even if no tenant_id - might be Platform Admin)
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
   * - 127.0.0.1 → null (IP address, no subdomain)
   * - www.lead360.app → www
   */
  private extractSubdomain(host: string): string | null {
    // Remove port if present
    const hostWithoutPort = host.split(':')[0];

    // Check if host is an IP address (IPv4)
    const ipv4Regex = /^\d+\.\d+\.\d+\.\d+$/;
    if (ipv4Regex.test(hostWithoutPort)) {
      return null; // IP addresses have no subdomain
    }

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
   * Extract full JWT payload from Authorization header
   * Returns payload or null if token is invalid/missing
   */
  private extractJwtPayload(req: Request): JwtPayload | null {
    try {
      // Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Decode JWT token
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      return payload;
    } catch (error) {
      // Token invalid, expired, or malformed - return null
      return null;
    }
  }

  /**
   * Extract tenant_id from JWT token in Authorization header
   * Returns tenant_id or null if token is invalid/missing
   */
  private extractTenantIdFromJwt(req: Request): string | null {
    const payload = this.extractJwtPayload(req);
    // Return tenant_id from payload (can be null for Platform Admins)
    return payload?.tenant_id || null;
  }

  /**
   * Determine if tenant resolution should be skipped for this path
   */
  private shouldSkipTenantResolution(path: string): boolean {
    const skipPaths = [
      '/api/v1/auth/', // Auth endpoints (registration, login, etc.)
      '/auth/', // Auth endpoints without global prefix
      '/api/v1/tenants/check-subdomain', // Subdomain availability check
      '/tenants/check-subdomain', // Without global prefix
      '/api/v1/admin', // Admin endpoints
      '/admin', // Admin endpoints without global prefix
      '/api/v1/public/', // Public quote access (NO AUTH)
      '/public/', // Public endpoints without global prefix
      '/health', // Health check
      '/api/docs', // Swagger docs
      '/api/v1/health', // Health with prefix
    ];

    return skipPaths.some((skipPath) => path.startsWith(skipPath));
  }
}
