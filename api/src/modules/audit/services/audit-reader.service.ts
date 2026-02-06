import { randomBytes } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLogQueryDto } from '../dto';

@Injectable()
export class AuditReaderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all audit logs with filters and pagination
   * Enforces tenant isolation unless isPlatformAdmin=true
   */
  async findAll(
    query: AuditLogQueryDto,
    isPlatformAdmin: boolean,
    tenantId?: string,
  ) {
    const {
      page = 1,
      limit = 50,
      start_date,
      end_date,
      actor_user_id,
      actor_type,
      action_type,
      entity_type,
      entity_id,
      status,
      search,
    } = query;

    // Build where clause
    const where: any = {};

    // Tenant isolation (CRITICAL)
    if (!isPlatformAdmin) {
      if (!tenantId) {
        throw new Error('Tenant ID is required for non-platform admin users');
      }
      where.tenant_id = tenantId;
    }

    // Apply filters
    if (start_date) {
      where.created_at = { ...where.created_at, gte: new Date(start_date) };
    }
    if (end_date) {
      where.created_at = { ...where.created_at, lte: new Date(end_date) };
    }
    if (actor_user_id) {
      where.actor_user_id = actor_user_id;
    }
    if (actor_type) {
      where.actor_type = actor_type;
    }
    if (action_type) {
      where.action_type = action_type;
    }
    if (entity_type) {
      where.entity_type = entity_type;
    }
    if (entity_id) {
      where.entity_id = entity_id;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.description = { contains: search };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries in parallel
    const [logs, total] = await Promise.all([
      this.prisma.audit_log.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          tenant: {
            select: {
              id: true,
              company_name: true,
              subdomain: true,
            },
          },
        },
      }),
      this.prisma.audit_log.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single audit log by ID
   * Enforces tenant isolation
   */
  async findOne(id: string, isPlatformAdmin: boolean, tenantId?: string) {
    const log = await this.prisma.audit_log.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        tenant: {
          select: {
            id: true,
            company_name: true,
            subdomain: true,
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundException('Audit log entry not found');
    }

    // Tenant isolation check
    if (!isPlatformAdmin && log.tenant_id !== tenantId) {
      throw new NotFoundException('Audit log entry not found');
    }

    return log;
  }

  /**
   * Find logs by specific user (user activity history)
   */
  async findByUser(
    userId: string,
    query: AuditLogQueryDto,
    isPlatformAdmin: boolean,
    tenantId?: string,
  ) {
    // Verify user belongs to tenant (if not platform admin)
    if (!isPlatformAdmin && tenantId) {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, tenant_id: tenantId },
      });

      if (!user) {
        throw new NotFoundException('User not found in your tenant');
      }
    }

    // Use findAll with actor_user_id filter
    return this.findAll(
      { ...query, actor_user_id: userId },
      isPlatformAdmin,
      tenantId,
    );
  }

  /**
   * Find logs for specific entity (entity history)
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    query: AuditLogQueryDto,
    isPlatformAdmin: boolean,
    tenantId?: string,
  ) {
    return this.findAll(
      { ...query, entity_type: entityType, entity_id: entityId },
      isPlatformAdmin,
      tenantId,
    );
  }

  /**
   * Count logs matching filters
   */
  async count(
    query: Partial<AuditLogQueryDto>,
    isPlatformAdmin: boolean,
    tenantId?: string,
  ): Promise<number> {
    const where: any = {};

    // Tenant isolation
    if (!isPlatformAdmin) {
      if (!tenantId) {
        throw new Error('Tenant ID is required for non-platform admin users');
      }
      where.tenant_id = tenantId;
    }

    // Apply filters
    if (query.start_date) {
      where.created_at = {
        ...where.created_at,
        gte: new Date(query.start_date),
      };
    }
    if (query.end_date) {
      where.created_at = { ...where.created_at, lte: new Date(query.end_date) };
    }
    if (query.actor_user_id) {
      where.actor_user_id = query.actor_user_id;
    }
    if (query.actor_type) {
      where.actor_type = query.actor_type;
    }
    if (query.action_type) {
      where.action_type = query.action_type;
    }
    if (query.entity_type) {
      where.entity_type = query.entity_type;
    }
    if (query.entity_id) {
      where.entity_id = query.entity_id;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.description = { contains: query.search };
    }

    return this.prisma.audit_log.count({ where });
  }
}
