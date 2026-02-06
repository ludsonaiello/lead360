import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { randomBytes } from 'crypto';
import { addHours } from 'date-fns';

@Injectable()
export class ImpersonationService {
  private readonly logger = new Logger(ImpersonationService.name);
  private readonly SESSION_EXPIRY_HOURS = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Start impersonation session
   */
  async startImpersonation(adminUserId: string, impersonatedUserId: string) {
    try {
      // Validate admin is Platform Admin
      const admin = await this.prisma.user.findUnique({
        where: { id: adminUserId },
        select: {
          id: true,
          is_platform_admin: true,
          email: true,
          first_name: true,
          last_name: true,
        },
      });

      if (!admin || !admin.is_platform_admin) {
        throw new ForbiddenException(
          'Only Platform Admins can impersonate users',
        );
      }

      // Validate impersonated user exists
      const impersonatedUser = await this.prisma.user.findUnique({
        where: { id: impersonatedUserId },
        include: {
          tenant: {
            select: {
              id: true,
              subdomain: true,
              company_name: true,
            },
          },
        },
      });

      if (!impersonatedUser) {
        throw new NotFoundException('User not found');
      }

      if (!impersonatedUser.tenant_id) {
        throw new ForbiddenException(
          'Cannot impersonate users without a tenant',
        );
      }

      // End any existing impersonation session for this admin
      await this.prisma.impersonation_session.deleteMany({
        where: { admin_user_id: adminUserId },
      });

      // Create impersonation session
      const sessionToken = randomBytes(32).toString('hex');
      const expiresAt = addHours(new Date(), this.SESSION_EXPIRY_HOURS);

      const session = await this.prisma.impersonation_session.create({
        data: {
          admin_user_id: adminUserId,
          impersonated_user_id: impersonatedUserId,
          impersonated_tenant_id: impersonatedUser.tenant_id,
          session_token: sessionToken,
          expires_at: expiresAt,
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: impersonatedUser.tenant_id,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'impersonation_session',
        entity_id: session.id,
        action_type: 'created',
        description: `Started impersonating ${impersonatedUser.first_name} ${impersonatedUser.last_name} (${impersonatedUser.email})`,
        after_json: {
          impersonated_user_id: impersonatedUserId,
          impersonated_tenant_id: impersonatedUser.tenant_id,
          expires_at: expiresAt,
        },
        status: 'success',
      });

      this.logger.log(
        `Admin ${admin.email} started impersonating user ${impersonatedUser.email}`,
      );

      return {
        session_token: sessionToken,
        expires_at: expiresAt,
        impersonated_user: {
          id: impersonatedUser.id,
          email: impersonatedUser.email,
          first_name: impersonatedUser.first_name,
          last_name: impersonatedUser.last_name,
          tenant_id: impersonatedUser.tenant_id,
          tenant: impersonatedUser.tenant,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to start impersonation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Validate impersonation session
   */
  async validateImpersonationSession(sessionToken: string) {
    try {
      const session = await this.prisma.impersonation_session.findUnique({
        where: { session_token: sessionToken },
        include: {
          admin_user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              is_platform_admin: true,
            },
          },
          impersonated_user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              tenant_id: true,
              is_active: true,
            },
          },
          impersonated_tenant: {
            select: {
              id: true,
              subdomain: true,
              company_name: true,
              is_active: true,
            },
          },
        },
      });

      if (!session) {
        throw new UnauthorizedException('Invalid impersonation session');
      }

      // Check if session expired
      if (new Date() > session.expires_at) {
        await this.endImpersonation(sessionToken);
        throw new UnauthorizedException('Impersonation session expired');
      }

      // Check if admin still has platform admin privileges
      if (!session.admin_user.is_platform_admin) {
        await this.endImpersonation(sessionToken);
        throw new ForbiddenException(
          'Admin no longer has platform admin privileges',
        );
      }

      return {
        session,
        admin_user: session.admin_user,
        impersonated_user: session.impersonated_user,
        impersonated_tenant: session.impersonated_tenant,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to validate impersonation session: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException('Invalid impersonation session');
    }
  }

  /**
   * End impersonation session
   */
  async endImpersonation(sessionToken: string) {
    try {
      const session = await this.prisma.impersonation_session.findUnique({
        where: { session_token: sessionToken },
        include: {
          admin_user: {
            select: {
              id: true,
              email: true,
            },
          },
          impersonated_user: {
            select: {
              email: true,
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException('Impersonation session not found');
      }

      // Audit log
      await this.auditLogger.log({
        tenant_id: session.impersonated_tenant_id,
        actor_user_id: session.admin_user_id,
        actor_type: 'platform_admin',
        entity_type: 'impersonation_session',
        entity_id: session.id,
        action_type: 'deleted',
        description: 'Ended impersonation session',
        before_json: {
          impersonated_user_id: session.impersonated_user_id,
          expires_at: session.expires_at,
        },
        status: 'success',
      });

      // Delete session
      await this.prisma.impersonation_session.delete({
        where: { id: session.id },
      });

      this.logger.log(
        `Admin ${session.admin_user.email} ended impersonation of ${session.impersonated_user.email}`,
      );

      return { message: 'Impersonation session ended successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to end impersonation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get active impersonation sessions for an admin
   */
  async getActiveSessionsForAdmin(adminUserId: string) {
    try {
      const sessions = await this.prisma.impersonation_session.findMany({
        where: {
          admin_user_id: adminUserId,
          expires_at: { gt: new Date() },
        },
        include: {
          impersonated_user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
          impersonated_tenant: {
            select: {
              id: true,
              subdomain: true,
              company_name: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return sessions;
    } catch (error) {
      this.logger.error(
        `Failed to get active sessions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cleanup expired sessions (background job)
   */
  async cleanupExpiredSessions() {
    try {
      const result = await this.prisma.impersonation_session.deleteMany({
        where: {
          expires_at: { lt: new Date() },
        },
      });

      this.logger.log(
        `Cleaned up ${result.count} expired impersonation sessions`,
      );

      return { cleaned: result.count };
    } catch (error) {
      this.logger.error(
        `Failed to cleanup expired sessions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
