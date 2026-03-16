import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../core/database/prisma.service';
import type {
  PortalJwtPayload,
  AuthenticatedPortalUser,
} from '../entities/portal-jwt-payload.entity';

@Injectable()
export class PortalJwtStrategy extends PassportStrategy(Strategy, 'portal-jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('PORTAL_JWT_SECRET');
    if (!secret) {
      throw new Error('PORTAL_JWT_SECRET is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: PortalJwtPayload): Promise<AuthenticatedPortalUser> {
    // Verify portal account still exists and is active
    const account = await this.prisma.portal_account.findFirst({
      where: {
        id: payload.sub,
        tenant_id: payload.tenant_id,
        is_active: true,
      },
    });

    if (!account) {
      throw new UnauthorizedException('Portal account not found or inactive');
    }

    return {
      portal_account_id: payload.sub,
      tenant_id: payload.tenant_id,
      lead_id: payload.lead_id,
      customer_slug: payload.customer_slug,
    };
  }
}
