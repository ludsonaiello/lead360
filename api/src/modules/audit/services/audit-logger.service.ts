import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateAuditLogDto } from '../dto';

interface LogAuthParams {
  event: string;
  userId?: string;
  tenantId?: string | null;
  status: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
  metadata?: object;
  errorMessage?: string;
}

interface LogTenantChangeParams {
  action: 'created' | 'updated' | 'deleted';
  entityType: string;
  entityId: string;
  tenantId: string | null;
  actorUserId: string;
  before?: object;
  after?: object;
  metadata?: object;
  description: string;
  ipAddress?: string;
  userAgent?: string;
}

interface LogRBACChangeParams {
  action: 'created' | 'updated' | 'deleted';
  entityType: string;
  entityId: string;
  tenantId?: string | null;
  actorUserId: string;
  metadata?: object;
  description: string;
  ipAddress?: string;
  userAgent?: string;
}

interface LogFailedActionParams {
  entityType: string;
  actorUserId?: string;
  tenantId?: string | null;
  errorMessage: string;
  metadata?: object;
  ipAddress?: string;
  userAgent?: string;
  description: string;
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);
  private queueAvailable = true;

  constructor(
    @InjectQueue('audit-log-write') private auditQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Queue a generic audit log entry
   * Non-blocking - returns immediately
   * Falls back to direct DB write if queue unavailable
   */
  async log(logData: CreateAuditLogDto): Promise<void> {
    try {
      if (this.queueAvailable) {
        // Try to queue the log write (reduced retries to prevent queue saturation)
        await this.auditQueue.add('write-log', logData, {
          attempts: 2, // Reduced from 3 to speed up error response
          backoff: {
            type: 'exponential',
            delay: 1000, // Reduced from 2000ms to speed up retries
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 1000,
          },
          removeOnFail: false,
        });
      } else {
        // Queue unavailable, write directly
        await this.writeDirectly(logData);
      }
    } catch (error) {
      this.logger.warn(
        `Queue unavailable, falling back to direct write: ${error.message}`,
      );
      this.queueAvailable = false;

      try {
        await this.writeDirectly(logData);
      } catch (writeError) {
        // Best effort logging - don't throw errors
        this.logger.error(
          `Failed to write audit log: ${writeError.message}`,
          writeError.stack,
        );
      }
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(params: LogAuthParams): Promise<void> {
    const {
      event,
      userId,
      tenantId,
      status,
      ipAddress,
      userAgent,
      metadata,
      errorMessage,
    } = params;

    const logData: CreateAuditLogDto = {
      tenant_id: tenantId ?? undefined,
      actor_user_id: userId,
      actor_type: userId ? 'user' : 'system',
      entity_type: status === 'success' ? 'auth_session' : 'auth_attempt',
      entity_id: userId || 'anonymous',
      description: this.getAuthDescription(event, status),
      action_type: this.getAuthAction(event),
      metadata_json: {
        event,
        ...metadata,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
      status,
      error_message: errorMessage,
    };

    await this.log(logData);
  }

  /**
   * Log tenant-related changes (CRUD operations)
   */
  async logTenantChange(params: LogTenantChangeParams): Promise<void> {
    const {
      action,
      entityType,
      entityId,
      tenantId,
      actorUserId,
      before,
      after,
      metadata,
      description,
      ipAddress,
      userAgent,
    } = params;

    // Sanitize sensitive data
    const sanitizedBefore = before ? this.sanitizeData(before) : undefined;
    const sanitizedAfter = after ? this.sanitizeData(after) : undefined;

    const logData: CreateAuditLogDto = {
      tenant_id: tenantId ?? undefined,
      actor_user_id: actorUserId === 'system' ? undefined : actorUserId,
      actor_type: actorUserId === 'system' ? 'system' : 'user',
      entity_type: entityType,
      entity_id: entityId,
      description,
      action_type: action,
      before_json: sanitizedBefore,
      after_json: sanitizedAfter,
      metadata_json: metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
      status: 'success',
    };

    await this.log(logData);
  }

  /**
   * Log RBAC changes (roles, permissions, assignments)
   */
  async logRBACChange(params: LogRBACChangeParams): Promise<void> {
    const {
      action,
      entityType,
      entityId,
      tenantId,
      actorUserId,
      metadata,
      description,
      ipAddress,
      userAgent,
    } = params;

    const logData: CreateAuditLogDto = {
      tenant_id: tenantId ?? undefined,
      actor_user_id: actorUserId === 'system' ? undefined : actorUserId,
      actor_type: actorUserId === 'system' ? 'system' : 'user',
      entity_type: entityType,
      entity_id: entityId,
      description,
      action_type: action,
      metadata_json: metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
      status: 'success',
    };

    await this.log(logData);
  }

  /**
   * Log failed actions (permission denied, validation errors, etc.)
   */
  async logFailedAction(params: LogFailedActionParams): Promise<void> {
    const {
      entityType,
      actorUserId,
      tenantId,
      errorMessage,
      metadata,
      ipAddress,
      userAgent,
      description,
    } = params;

    const logData: CreateAuditLogDto = {
      tenant_id: tenantId ?? undefined,
      actor_user_id: actorUserId,
      actor_type: actorUserId ? 'user' : 'system',
      entity_type: entityType,
      entity_id: 'N/A',
      description,
      action_type: 'failed',
      metadata_json: metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
      status: 'failure',
      error_message: errorMessage,
    };

    await this.log(logData);
  }

  /**
   * Write directly to database (fallback when queue unavailable)
   */
  private async writeDirectly(logData: CreateAuditLogDto): Promise<void> {
    await this.prisma.audit_log.create({
      data: {
        id: randomBytes(16).toString('hex'),
        ...logData,
        // Convert JSON objects to strings for Prisma
        before_json: logData.before_json
          ? JSON.stringify(logData.before_json)
          : null,
        after_json: logData.after_json
          ? JSON.stringify(logData.after_json)
          : null,
        metadata_json: logData.metadata_json
          ? JSON.stringify(logData.metadata_json)
          : null,
      } as any,
    });
  }

  /**
   * Sanitize sensitive data before logging
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'password_hash',
      'activation_token',
      'password_reset_token',
      'mfa_secret',
      'api_key',
      'access_token',
      'refresh_token',
    ];

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get human-readable description for auth events
   */
  private getAuthDescription(
    event: string,
    status: 'success' | 'failure',
  ): string {
    const descriptions = {
      register:
        status === 'success'
          ? 'User registered successfully'
          : 'Registration failed',
      login: status === 'success' ? 'User logged in' : 'Login failed',
      logout: 'User logged out',
      logout_all: 'User logged out from all devices',
      password_reset_requested: 'Password reset requested',
      password_reset:
        status === 'success'
          ? 'Password reset completed'
          : 'Password reset failed',
      password_changed: 'Password changed',
      account_activated: 'Account activated',
    };

    return descriptions[event] || `Auth event: ${event}`;
  }

  /**
   * Map auth event to action type
   */
  private getAuthAction(event: string): string {
    const actionMap = {
      register: 'created',
      login: 'accessed',
      logout: 'deleted',
      logout_all: 'deleted',
      password_reset_requested: 'created',
      password_reset: 'updated',
      password_changed: 'updated',
      account_activated: 'updated',
    };

    return actionMap[event] || 'accessed';
  }
}
