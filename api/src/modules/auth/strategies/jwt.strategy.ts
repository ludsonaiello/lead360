import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type {
  JwtPayload,
  AuthenticatedUser,
} from '../entities/jwt-payload.entity';
import { PrismaService } from '../../../core/database/prisma.service';
import { TokenBlocklistService } from '../../../core/token-blocklist/token-blocklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenBlocklist: TokenBlocklistService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true, // Enable access to request object
    });
  }

  async validate(req: any, payload: JwtPayload): Promise<AuthenticatedUser> {
    // Check token blocklist FIRST — Redis roundtrip avoids unnecessary DB query for blocked tokens
    if (payload.jti) {
      const blocked = await this.tokenBlocklist.isBlocked(payload.jti);
      if (blocked) {
        throw new UnauthorizedException('Token has been revoked.');
      }
    }

    // Verify user still exists and is active
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        is_active: true,
        deleted_at: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Check if tenant_id was overridden by middleware (for Platform Admin impersonation)
    const tenant_id = req.tenant_id || payload.tenant_id;

    return {
      id: payload.sub,
      email: payload.email,
      tenant_id: tenant_id, // Use overridden tenant_id if present
      membershipId: payload.membershipId, // from active membership (Sprint 3)
      roles: payload.roles,
      is_platform_admin: payload.is_platform_admin,
      jti: payload.jti,
    };
  }
}
