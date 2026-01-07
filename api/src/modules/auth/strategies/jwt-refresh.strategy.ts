import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import type { Request } from 'express';
import * as crypto from 'crypto';
import type { JwtRefreshPayload } from '../entities/jwt-payload.entity';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    };
    super(options);
  }

  async validate(
    request: Request,
    payload: JwtRefreshPayload,
  ): Promise<{ userId: string; tokenHash: string }> {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const refreshToken = authHeader.replace('Bearer ', '');

    // Hash the token to check against database
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Verify token exists in database and is not revoked
    const storedToken = await this.prisma.refresh_token.findFirst({
      where: {
        token_hash: tokenHash,
        user_id: payload.sub,
        revoked_at: null,
        expires_at: {
          gt: new Date(),
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
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

    return {
      userId: payload.sub,
      tokenHash,
    };
  }
}
