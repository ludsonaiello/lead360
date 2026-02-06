import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MaintenanceModeService } from '../services/maintenance-mode.service';

/**
 * Maintenance Mode Middleware
 *
 * Blocks tenant access during maintenance mode (with IP whitelist support).
 * Admin routes are always accessible during maintenance.
 *
 * Applied globally except to admin routes.
 */
@Injectable()
export class MaintenanceModeMiddleware implements NestMiddleware {
  constructor(
    private readonly maintenanceModeService: MaintenanceModeService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip admin routes (admins can always access)
    if (req.path.startsWith('/admin') || req.path.startsWith('/api/v1/admin')) {
      return next();
    }

    // Skip health check endpoints
    if (req.path === '/health' || req.path === '/api/v1/health') {
      return next();
    }

    try {
      const isInMaintenance =
        await this.maintenanceModeService.isInMaintenanceMode();

      if (isInMaintenance) {
        const config = await this.maintenanceModeService.getMaintenanceConfig();

        // Check if IP is whitelisted
        const clientIp = this.getClientIp(req);
        const allowedIps = config.allowed_ips
          ? config.allowed_ips.split(',').map((ip) => ip.trim())
          : [];

        if (allowedIps.includes(clientIp)) {
          // IP is whitelisted - allow access
          return next();
        }

        // Block request with maintenance page response
        return res.status(503).json({
          statusCode: 503,
          message:
            config.message ||
            "Lead360 is undergoing maintenance. We'll be back shortly.",
          maintenance: true,
          mode: config.mode,
          estimated_end: config.end_time,
        });
      }

      next();
    } catch (error) {
      // If maintenance check fails, log error and allow request (fail-open for availability)
      console.error('Maintenance mode check failed:', error.message);
      next();
    }
  }

  /**
   * Get client IP address from request
   * Handles proxies and load balancers
   */
  private getClientIp(req: Request): string {
    // Check X-Forwarded-For header (set by proxies/load balancers)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2...)
      // The first one is the original client IP
      const ips =
        typeof forwardedFor === 'string'
          ? forwardedFor.split(',').map((ip) => ip.trim())
          : [forwardedFor[0]];
      return ips[0];
    }

    // Check X-Real-IP header (set by some proxies like Nginx)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return typeof realIp === 'string' ? realIp : realIp[0];
    }

    // Fallback to socket remote address
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
