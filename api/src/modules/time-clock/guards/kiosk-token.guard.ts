import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { PrismaService } from '../../../core/database/prisma.service';

export interface KioskAuthenticatedRequest extends Request {
  kioskTenantId?: string;
  kioskTokenHash?: string;
}

@Injectable()
export class KioskTokenGuard implements CanActivate {
  private readonly logger = new Logger(KioskTokenGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<KioskAuthenticatedRequest>();

    const headerValue = request.headers['x-kiosk-token'];
    const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new UnauthorizedException('Missing X-Kiosk-Token header');
    }

    const settingsRecords = await this.prisma.time_clock_settings.findMany({
      where: {
        kiosk_mode_enabled: true,
        kiosk_token_hash: { not: null },
      },
      select: {
        tenant_id: true,
        kiosk_token_hash: true,
      },
    });

    for (const settings of settingsRecords) {
      if (!settings.kiosk_token_hash) {
        continue;
      }
      try {
        const isMatch = await bcrypt.compare(token, settings.kiosk_token_hash);
        if (isMatch) {
          request.kioskTenantId = settings.tenant_id;
          request.kioskTokenHash = settings.kiosk_token_hash;
          return true;
        }
      } catch (error) {
        this.logger.warn(
          `bcrypt compare failed for tenant ${settings.tenant_id}: ${
            (error as Error).message
          }`,
        );
      }
    }

    throw new UnauthorizedException('Invalid kiosk token');
  }
}
