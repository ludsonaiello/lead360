import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../core/database/prisma.service';
import { WebhookAuthService } from '../services/webhook-auth.service';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebhookAuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookAuthService: WebhookAuthService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check if this is an internal call (JWT token present) or external webhook (API key)
    const authHeader = request.headers['authorization'];
    const hasJwtToken = authHeader && authHeader.startsWith('Bearer ') && !authHeader.includes('lead360_webhook_');

    if (hasJwtToken) {
      // INTERNAL CALL from authenticated frontend
      this.logger.log('Internal webhook call detected (JWT token present)');

      try {
        // Manually verify JWT since @Public() bypassed the global guard
        const token = authHeader.replace('Bearer ', '');
        const payload = await this.jwtService.verifyAsync(token);

        if (!payload || !payload.tenant_id) {
          throw new UnauthorizedException('Invalid JWT token - missing tenant information');
        }

        this.logger.log(`JWT validated for user ${payload.sub}, tenant ${payload.tenant_id}`);

        // Resolve tenant info
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: payload.tenant_id },
          select: { id: true, subdomain: true, company_name: true },
        });

        if (!tenant) {
          throw new UnauthorizedException('Tenant not found');
        }

        this.logger.log(`Internal call authenticated for tenant: ${tenant.id} (${tenant.company_name})`);

        // Attach user and tenant to request
        request.user = payload;
        request.tenant = tenant;
        return true;
      } catch (error) {
        this.logger.error(`JWT validation failed: ${error.message}`);
        throw new UnauthorizedException('Invalid JWT token');
      }
    }

    // EXTERNAL WEBHOOK - use API key authentication
    this.logger.log('External webhook call detected (API key authentication)');

    // 1. Extract tenant - THREE methods in priority order:
    //    a) X-Tenant-Subdomain header (frontend proxy sends this)
    //    b) X-Tenant-ID header (direct backend calls with tenant UUID)
    //    c) Host subdomain (external webhooks via subdomain URL)
    let tenant;
    const tenantSubdomainHeader = request.headers['x-tenant-subdomain'];
    const tenantIdHeader = request.headers['x-tenant-id'];

    if (tenantSubdomainHeader) {
      // Frontend proxy call with subdomain in header
      this.logger.log(`Using tenant subdomain from header: ${tenantSubdomainHeader}`);

      tenant = await this.prisma.tenant.findFirst({
        where: { subdomain: tenantSubdomainHeader },
        select: { id: true, subdomain: true, company_name: true },
      });

      if (!tenant) {
        throw new BadRequestException(`Tenant not found for subdomain: ${tenantSubdomainHeader}`);
      }
    } else if (tenantIdHeader) {
      // Internal frontend call with explicit tenant ID
      this.logger.log(`Using tenant ID from header: ${tenantIdHeader}`);

      tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantIdHeader },
        select: { id: true, subdomain: true, company_name: true },
      });

      if (!tenant) {
        throw new BadRequestException(`Tenant not found: ${tenantIdHeader}`);
      }
    } else {
      // External webhook call - use subdomain from host
      const host = request.headers.host || request.headers['x-forwarded-host'];
      if (!host) {
        throw new BadRequestException('Missing host header');
      }

      this.logger.log(`Webhook request from host: ${host}`);

      // Extract subdomain (everything before first dot)
      // Example: acme-plumbing.lead360.app → acme-plumbing
      const subdomain = this.extractSubdomain(host);
      if (!subdomain) {
        throw new BadRequestException(
          'Invalid request: Subdomain not found. Webhook URLs must use tenant subdomain (e.g., your-company.lead360.app)',
        );
      }

      this.logger.log(`Extracted subdomain: ${subdomain}`);

      // 2. Resolve tenant from subdomain
      tenant = await this.prisma.tenant.findFirst({
        where: { subdomain },
        select: { id: true, subdomain: true, company_name: true },
      });

      if (!tenant) {
        throw new BadRequestException(
          `Tenant not found for subdomain: ${subdomain}`,
        );
      }
    }

    this.logger.log(
      `Resolved tenant: ${tenant.id} (${tenant.company_name})`,
    );

    // 3. Extract API key from headers
    const apiKey =
      request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');

    this.logger.log(`Headers: ${JSON.stringify({
      'x-api-key': request.headers['x-api-key'] ? 'present' : 'missing',
      'authorization': request.headers['authorization'] ? 'present' : 'missing',
    })}`);

    if (!apiKey) {
      this.logger.error('No API key found in request headers');
      throw new UnauthorizedException(
        'Missing API key. Provide in X-API-Key or Authorization header.',
      );
    }

    this.logger.log(`API key extracted (prefix): ${apiKey.substring(0, 25)}...`);

    // 4. Validate API key AND verify it belongs to the tenant from subdomain
    const keyRecord = await this.webhookAuthService.validateApiKey(
      apiKey,
      tenant.id,
    );

    // 5. CRITICAL SECURITY CHECK: Ensure API key tenant matches subdomain tenant
    if (keyRecord.tenant_id !== tenant.id) {
      this.logger.error(
        `SECURITY VIOLATION: API key tenant (${keyRecord.tenant_id}) does not match subdomain tenant (${tenant.id})`,
      );
      throw new UnauthorizedException(
        'API key does not match tenant from subdomain',
      );
    }

    this.logger.log(
      `Webhook authentication successful for tenant ${tenant.id} using key ${keyRecord.id}`,
    );

    // 6. Attach tenant info to request for use in controller
    request.tenant = tenant;
    request.webhookKey = keyRecord;

    return true;
  }

  /**
   * Extract subdomain from host header
   * Examples:
   *  - acme-plumbing.lead360.app → acme-plumbing
   *  - localhost:3000 → null (for local development)
   *  - acme.localhost → acme (for local development)
   * @param host - Host header value
   * @returns Subdomain or null
   */
  private extractSubdomain(host: string): string | null {
    // Remove port if present
    const hostWithoutPort = host.split(':')[0];

    // Split by dots
    const parts = hostWithoutPort.split('.');

    // Local development: acme.localhost
    if (parts.length === 2 && parts[1] === 'localhost') {
      return parts[0];
    }

    // Production: acme-plumbing.lead360.app (or any domain)
    if (parts.length >= 3) {
      return parts[0];
    }

    // localhost or single-word domain → no subdomain
    return null;
  }
}
