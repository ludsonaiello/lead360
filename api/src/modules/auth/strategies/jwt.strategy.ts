import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload, AuthenticatedUser } from '../entities/jwt-payload.entity';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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
      roles: payload.roles,
      is_platform_admin: payload.is_platform_admin,
    };
  }
}
