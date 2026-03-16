import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FileStorageService } from '../../../core/file-storage/file-storage.service';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ListUsersQueryDto } from '../../users/dto/list-users-query.dto';
import { CreateUserAdminDto } from '../../users/dto/create-user-admin.dto';

@Injectable()
export class TenantManagementService {
  private readonly logger = new Logger(TenantManagementService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly fileStorage: FileStorageService,
  ) {}

  /**
   * Create tenant manually by Platform Admin
   */
  async createTenantManually(createDto: any, adminUserId: string) {
    try {
      // Validate subdomain uniqueness
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { subdomain: createDto.subdomain },
      });

      if (existingTenant) {
        throw new ConflictException('Subdomain already exists');
      }

      // Check if email already exists globally
      const existingUser = await this.prisma.user.findFirst({
        where: { email: createDto.owner_email },
      });

      if (existingUser) {
        throw new ConflictException('Owner email is already registered');
      }

      // Hash owner password
      const passwordHash = await bcrypt.hash(
        createDto.owner_password,
        this.SALT_ROUNDS,
      );

      // Determine subscription plan
      let subscriptionPlanId = createDto.subscription_plan_id;
      if (!subscriptionPlanId) {
        // Get default plan if not specified
        const defaultPlan = await this.prisma.subscription_plan.findFirst({
          where: { is_default: true, is_active: true },
        });
        if (!defaultPlan) {
          throw new InternalServerErrorException(
            'No default subscription plan found',
          );
        }
        subscriptionPlanId = defaultPlan.id;
      }

      // Get subscription plan details to calculate trial
      const subscriptionPlan = await this.prisma.subscription_plan.findUnique({
        where: { id: subscriptionPlanId },
      });

      if (!subscriptionPlan) {
        throw new BadRequestException('Invalid subscription plan ID');
      }

      // Calculate subscription fields
      const subscriptionStatus = createDto.subscription_status || 'trial';
      let trialEndDate = createDto.trial_end_date
        ? new Date(createDto.trial_end_date)
        : null;
      let billingCycle = createDto.billing_cycle || null;
      let nextBillingDate = createDto.next_billing_date
        ? new Date(createDto.next_billing_date)
        : null;

      // Auto-calculate trial_end_date if plan offers trial and status is trial
      if (
        subscriptionStatus === 'trial' &&
        !trialEndDate &&
        subscriptionPlan.offers_trial &&
        subscriptionPlan.trial_days
      ) {
        const now = new Date();
        trialEndDate = new Date(
          now.getTime() + subscriptionPlan.trial_days * 24 * 60 * 60 * 1000,
        );
      }

      // If status is active but no billing info provided, set defaults
      if (subscriptionStatus === 'active') {
        billingCycle = billingCycle || 'monthly';
        if (!nextBillingDate) {
          const now = new Date();
          nextBillingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        }
      }

      // Create tenant and owner user in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create tenant
        const tenant = await tx.tenant.create({
          data: {
            id: randomBytes(16).toString('hex'),
            subdomain: createDto.subdomain,
            company_name: createDto.business_name,
            legal_business_name: createDto.business_name,
            business_entity_type: createDto.business_entity_type || 'LLC',
            state_of_registration: createDto.state_of_registration || 'NY',
            ein: createDto.ein || this.generateTemporaryEIN(),
            primary_contact_phone: createDto.owner_phone || '0000000000',
            primary_contact_email: createDto.owner_email,
            business_size: createDto.business_size,
            subscription_plan_id: subscriptionPlanId,
            subscription_status: subscriptionStatus,
            trial_end_date: trialEndDate,
            billing_cycle: billingCycle,
            next_billing_date: nextBillingDate,
            is_active: true,
            updated_at: new Date(),
          },
        });

        // Create tenant-industry associations (many-to-many)
        if (createDto.industry_ids && createDto.industry_ids.length > 0) {
          const industryAssociations = createDto.industry_ids.map(
            (industryId: string) => ({
              id: randomBytes(16).toString('hex'),
              tenant_id: tenant.id,
              industry_id: industryId,
              created_at: new Date(),
            }),
          );

          await tx.tenant_industry.createMany({
            data: industryAssociations,
          });
        }

        // Find Owner role
        const ownerRole = await tx.role.findUnique({
          where: { name: 'Owner' },
        });

        if (!ownerRole) {
          throw new InternalServerErrorException(
            'Owner role not found in database',
          );
        }

        // Create default business hours
        await tx.tenant_business_hours.create({
          data: {
            id: randomBytes(16).toString('hex'),
            tenant_id: tenant.id,
            monday_closed: false,
            monday_open1: '09:00',
            monday_close1: '17:00',
            tuesday_closed: false,
            tuesday_open1: '09:00',
            tuesday_close1: '17:00',
            wednesday_closed: false,
            wednesday_open1: '09:00',
            wednesday_close1: '17:00',
            thursday_closed: false,
            thursday_open1: '09:00',
            thursday_close1: '17:00',
            friday_closed: false,
            friday_open1: '09:00',
            friday_close1: '17:00',
            saturday_closed: true,
            sunday_closed: true,
            updated_at: new Date(),
          },
        });

        // Create owner user (global identity — no tenant_id on user)
        const ownerUser = await tx.user.create({
          data: {
            id: randomBytes(16).toString('hex'),
            email: createDto.owner_email,
            password_hash: passwordHash,
            first_name: createDto.owner_first_name,
            last_name: createDto.owner_last_name,
            phone: createDto.owner_phone,
            is_active: createDto.skip_email_verification || false,
            email_verified: createDto.skip_email_verification || false,
            email_verified_at: createDto.skip_email_verification
              ? new Date()
              : null,
            updated_at: new Date(),
          },
        });

        // Create tenant membership for the owner
        await tx.user_tenant_membership.create({
          data: {
            user_id: ownerUser.id,
            tenant_id: tenant.id,
            role_id: ownerRole.id,
            status: 'ACTIVE',
            joined_at: new Date(),
          },
        });

        // Assign Owner role
        await tx.user_role.create({
          data: {
            id: randomBytes(16).toString('hex'),
            user_id: ownerUser.id,
            role_id: ownerRole.id,
            tenant_id: tenant.id,
            assigned_by_user_id: adminUserId,
          },
        });

        return { tenant, owner: ownerUser };
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: result.tenant.id,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant',
        entity_id: result.tenant.id,
        action_type: 'created',
        description: `Tenant manually created by Platform Admin`,
        after_json: {
          tenant: {
            id: result.tenant.id,
            subdomain: result.tenant.subdomain,
            company_name: result.tenant.company_name,
          },
          owner: {
            id: result.owner.id,
            email: result.owner.email,
            first_name: result.owner.first_name,
            last_name: result.owner.last_name,
          },
        },
        status: 'success',
      });

      return {
        tenant: result.tenant,
        owner: {
          id: result.owner.id,
          email: result.owner.email,
          first_name: result.owner.first_name,
          last_name: result.owner.last_name,
          is_active: result.owner.is_active,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to create tenant manually: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Suspend tenant (set status to inactive, invalidate sessions)
   */
  async suspendTenant(tenantId: string, adminUserId: string, reason?: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      if (!tenant.is_active) {
        throw new ConflictException('Tenant is already suspended');
      }

      const beforeState = { is_active: tenant.is_active };

      // Update tenant status
      const updatedTenant = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          is_active: false,
          updated_at: new Date(),
        },
      });

      // Invalidate all active sessions for this tenant's members
      await this.prisma.refresh_token.deleteMany({
        where: {
          user: {
            memberships: { some: { tenant_id: tenantId, status: 'ACTIVE' } },
          },
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant',
        entity_id: tenantId,
        action_type: 'updated',
        description: `Tenant suspended: ${reason || 'No reason provided'}`,
        before_json: beforeState,
        after_json: { is_active: false, reason },
        status: 'success',
      });

      this.logger.log(`Tenant ${tenantId} suspended by admin ${adminUserId}`);

      return updatedTenant;
    } catch (error) {
      this.logger.error(
        `Failed to suspend tenant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Activate tenant (reactivate suspended tenant)
   */
  async activateTenant(tenantId: string, adminUserId: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      if (tenant.is_active) {
        throw new ConflictException('Tenant is already active');
      }

      const beforeState = { is_active: tenant.is_active };

      // Update tenant status
      const updatedTenant = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          is_active: true,
          updated_at: new Date(),
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant',
        entity_id: tenantId,
        action_type: 'updated',
        description: 'Tenant activated by Platform Admin',
        before_json: beforeState,
        after_json: { is_active: true },
        status: 'success',
      });

      this.logger.log(`Tenant ${tenantId} activated by admin ${adminUserId}`);

      return updatedTenant;
    } catch (error) {
      this.logger.error(
        `Failed to activate tenant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete tenant (soft delete with 90-day retention)
   */
  async deleteTenant(tenantId: string, adminUserId: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      if (tenant.deleted_at) {
        throw new ConflictException('Tenant is already deleted');
      }

      // Soft delete tenant
      const deletedTenant = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          deleted_at: new Date(),
          is_active: false,
          updated_at: new Date(),
        },
      });

      // Invalidate all sessions for this tenant's members
      await this.prisma.refresh_token.deleteMany({
        where: {
          user: {
            memberships: { some: { tenant_id: tenantId, status: 'ACTIVE' } },
          },
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant',
        entity_id: tenantId,
        action_type: 'deleted',
        description:
          'Tenant deleted by Platform Admin (soft delete, 90-day retention)',
        before_json: { deleted_at: null },
        after_json: { deleted_at: deletedTenant.deleted_at },
        status: 'success',
      });

      this.logger.log(`Tenant ${tenantId} deleted by admin ${adminUserId}`);

      return {
        message: 'Tenant deleted successfully (90-day retention period)',
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete tenant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Restore tenant (undo soft delete)
   */
  async restoreTenant(tenantId: string, adminUserId: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      if (!tenant.deleted_at) {
        throw new ConflictException('Tenant is not deleted');
      }

      // Restore tenant
      const restoredTenant = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          deleted_at: null,
          is_active: true,
          updated_at: new Date(),
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant',
        entity_id: tenantId,
        action_type: 'restored',
        description: 'Tenant restored from trash by Platform Admin',
        before_json: {
          deleted_at: tenant.deleted_at,
          is_active: tenant.is_active,
        },
        after_json: { deleted_at: null, is_active: true },
        status: 'success',
      });

      this.logger.log(`Tenant ${tenantId} restored by admin ${adminUserId}`);

      return {
        message: 'Tenant restored successfully',
        tenant: restoredTenant,
      };
    } catch (error) {
      this.logger.error(
        `Failed to restore tenant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Permanently delete tenant (hard delete)
   * WARNING: This action is irreversible and will delete all tenant data
   */
  async permanentlyDeleteTenant(tenantId: string, adminUserId: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          subdomain: true,
          company_name: true,
          deleted_at: true,
        },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      // Get all users for this tenant BEFORE deletion (via membership)
      const tenantUsers = await this.prisma.user.findMany({
        where: {
          memberships: { some: { tenant_id: tenantId } },
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
        },
      });

      this.logger.log(
        `Found ${tenantUsers.length} users to delete for tenant ${tenantId}`,
      );

      // Get all files for this tenant BEFORE deletion
      const tenantFiles = await this.prisma.file.findMany({
        where: { tenant_id: tenantId },
        select: {
          file_id: true,
          storage_path: true,
          thumbnail_path: true,
          storage_provider: true,
        },
      });

      this.logger.log(
        `Found ${tenantFiles.length} files to delete for tenant ${tenantId}`,
      );

      // Delete physical files from disk
      let filesDeleted = 0;
      let filesFailedToDelete = 0;

      for (const file of tenantFiles) {
        try {
          // Delete main file
          if (file.storage_provider === 'local' && file.storage_path) {
            await this.fileStorage.deleteFileByPath(file.storage_path);
            filesDeleted++;
          }

          // Delete thumbnail if exists
          if (file.thumbnail_path) {
            try {
              await this.fileStorage.deleteFileByPath(file.thumbnail_path);
            } catch (thumbnailError) {
              this.logger.warn(
                `Failed to delete thumbnail for file ${file.file_id}: ${thumbnailError.message}`,
              );
            }
          }
        } catch (fileError) {
          filesFailedToDelete++;
          this.logger.warn(
            `Failed to delete file ${file.file_id}: ${fileError.message}`,
          );
        }
      }

      this.logger.log(
        `Deleted ${filesDeleted} files, ${filesFailedToDelete} failed for tenant ${tenantId}`,
      );

      // Delete memberships for this tenant first
      await this.prisma.user_tenant_membership.deleteMany({
        where: { tenant_id: tenantId },
      });

      // Delete users who now have no remaining memberships in any tenant
      const usersDeleted = await this.prisma.user.deleteMany({
        where: {
          id: { in: tenantUsers.map((u) => u.id) },
          memberships: { none: {} },
        },
      });

      this.logger.log(
        `Deleted ${usersDeleted.count} users for tenant ${tenantId}`,
      );

      // Audit log BEFORE deletion (tenant_id set to null since tenant will be deleted)
      await this.auditLogger.log({
        tenant_id: undefined, // Set to null since tenant will be permanently deleted
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant',
        entity_id: tenantId,
        action_type: 'permanently_deleted',
        description: `Tenant permanently deleted by Platform Admin - IRREVERSIBLE`,
        before_json: {
          id: tenant.id,
          subdomain: tenant.subdomain,
          company_name: tenant.company_name,
          deleted_at: tenant.deleted_at,
        },
        metadata_json: {
          tenant_subdomain: tenant.subdomain,
          tenant_company_name: tenant.company_name,
          files_deleted: filesDeleted,
          files_failed: filesFailedToDelete,
          total_files: tenantFiles.length,
          users_deleted: usersDeleted.count,
          total_users: tenantUsers.length,
          user_emails: tenantUsers.map((u) => u.email),
        },
        status: 'success',
      });

      // Hard delete - Prisma will cascade delete related records (including file records)
      await this.prisma.tenant.delete({
        where: { id: tenantId },
      });

      this.logger.warn(
        `Tenant ${tenantId} (${tenant.subdomain}) PERMANENTLY DELETED by admin ${adminUserId} ` +
          `(${filesDeleted} files deleted, ${filesFailedToDelete} files failed, ${usersDeleted.count} users deleted)`,
      );

      return {
        message: 'Tenant permanently deleted',
        subdomain: tenant.subdomain,
        warning:
          'This action is irreversible. All tenant data has been removed.',
        files_deleted: filesDeleted,
        files_failed: filesFailedToDelete,
        total_files: tenantFiles.length,
        users_deleted: usersDeleted.count,
        total_users: tenantUsers.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to permanently delete tenant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get tenant details with full relations
   */
  async getTenantDetails(tenantId: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription_plan: true,
          tenant_industries: {
            include: {
              industry: true,
            },
          },
          file_tenant_logo_file_idTofile: {
            select: {
              file_id: true,
              original_filename: true,
              mime_type: true,
              storage_path: true,
            },
          },
          _count: {
            select: {
              memberships: {
                where: { status: 'ACTIVE' },
              },
              file_file_tenant_idTotenant: {
                where: { is_trashed: false },
              },
            },
          },
        },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      // Get users (via membership)
      const users = await this.prisma.user.findMany({
        where: {
          memberships: { some: { tenant_id: tenantId, status: 'ACTIVE' } },
          deleted_at: null,
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
          memberships: {
            where: { tenant_id: tenantId },
            include: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      // Get storage stats
      const storageStats = await this.prisma.file.aggregate({
        where: {
          tenant_id: tenantId,
          is_trashed: false,
        },
        _sum: {
          size_bytes: true,
        },
        _count: true,
      });

      // Get job stats
      const jobStats = await this.prisma.job.groupBy({
        by: ['status'],
        where: {
          tenant_id: tenantId,
        },
        _count: true,
      });

      return {
        ...tenant,
        industries:
          (tenant as any).tenant_industries?.map((ti: any) => ti.industry) ||
          [],
        users: users.map((user) => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          is_active: user.is_active,
          last_login_at: user.last_login_at,
          created_at: user.created_at,
          roles: user.memberships.map(
            (m) => m.role.name,
          ),
        })),
        stats: {
          user_count: (tenant as any)._count?.memberships || 0,
          file_count: (tenant as any)._count?.file_file_tenant_idTotenant || 0,
          storage_used_bytes: storageStats._sum.size_bytes || 0,
          storage_used_gb: (
            (storageStats._sum.size_bytes || 0) /
            (1024 * 1024 * 1024)
          ).toFixed(2),
          jobs: jobStats.reduce(
            (acc, stat) => {
              acc[stat.status] = stat._count;
              return acc;
            },
            {} as Record<string, number>,
          ),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get tenant details: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * List tenants with filters and pagination
   */
  async listTenants(filters: any = {}, pagination: any = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        created_from,
        created_to,
        search,
        industry_ids,
        business_size,
      } = filters;

      // Convert to integers (query params come as strings)
      const pageNum = parseInt(String(page), 10);
      const limitNum = parseInt(String(limit), 10);
      const skip = (pageNum - 1) * limitNum;

      // Normalize industry_ids to always be an array (handle single value from query params)
      const normalizedIndustryIds = industry_ids
        ? Array.isArray(industry_ids)
          ? industry_ids
          : [industry_ids]
        : null;

      const where: any = {};

      // Status filter
      if (status === 'active') {
        where.is_active = true;
        where.deleted_at = null;
      } else if (status === 'suspended') {
        where.is_active = false;
        where.deleted_at = null;
      } else if (status === 'deleted') {
        where.deleted_at = { not: null };
      } else {
        where.deleted_at = null; // Default: exclude deleted
      }

      // Date range filter
      if (created_from || created_to) {
        where.created_at = {};
        if (created_from) {
          where.created_at.gte = new Date(created_from);
        }
        if (created_to) {
          where.created_at.lte = new Date(created_to);
        }
      }

      // Industry filter (many-to-many - show tenants with ANY of these industries)
      if (normalizedIndustryIds && normalizedIndustryIds.length > 0) {
        where.tenant_industries = {
          some: {
            industry_id: {
              in: normalizedIndustryIds,
            },
          },
        };
      }

      // Business size filter
      if (business_size) {
        where.business_size = business_size;
      }

      // Search filter
      if (search) {
        where.OR = [
          { subdomain: { contains: search } },
          { company_name: { contains: search } },
          { primary_contact_email: { contains: search } },
        ];
      }

      const [tenants, total] = await Promise.all([
        this.prisma.tenant.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { created_at: 'desc' },
          include: {
            subscription_plan: true,
            tenant_industries: {
              include: {
                industry: true,
              },
            },
            _count: {
              select: {
                memberships: {
                  where: { status: 'ACTIVE' },
                },
              },
            },
          },
        }),
        this.prisma.tenant.count({ where }),
      ]);

      return {
        data: tenants.map((tenant) => ({
          id: tenant.id,
          subdomain: tenant.subdomain,
          company_name: tenant.company_name,
          legal_business_name: tenant.legal_business_name,
          business_entity_type: tenant.business_entity_type,
          state_of_registration: tenant.state_of_registration,
          ein: tenant.ein,
          business_size: tenant.business_size,
          industries:
            (tenant as any).tenant_industries?.map((ti: any) => ti.industry) ||
            [],
          subscription_plan_id: tenant.subscription_plan_id,
          subscription_status: tenant.subscription_status,
          trial_end_date: tenant.trial_end_date,
          billing_cycle: tenant.billing_cycle,
          next_billing_date: tenant.next_billing_date,
          subscription_plan: (tenant as any).subscription_plan,
          is_active: tenant.is_active,
          deleted_at: tenant.deleted_at,
          primary_contact_email: tenant.primary_contact_email,
          primary_contact_phone: tenant.primary_contact_phone,
          user_count: (tenant as any)._count?.memberships || 0,
          created_at: tenant.created_at,
          updated_at: tenant.updated_at,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to list tenants: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Change tenant subscription plan
   */
  async changeSubscriptionPlan(
    tenantId: string,
    newPlanId: string,
    adminUserId: string,
  ) {
    try {
      // Verify tenant exists
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          company_name: true,
          subscription_plan_id: true,
          subscription_status: true,
          subscription_plan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      // Verify new plan exists and is active
      const newPlan = await this.prisma.subscription_plan.findUnique({
        where: { id: newPlanId },
        select: {
          id: true,
          name: true,
          is_active: true,
          offers_trial: true,
          trial_days: true,
        },
      });

      if (!newPlan) {
        throw new NotFoundException('Subscription plan not found');
      }

      if (!newPlan.is_active) {
        throw new BadRequestException(
          'Cannot assign an inactive subscription plan',
        );
      }

      // Store old plan info for audit
      const oldPlan = tenant.subscription_plan;

      // Update tenant's subscription plan
      const updatedTenant = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscription_plan_id: newPlanId,
          updated_at: new Date(),
        },
        include: {
          subscription_plan: true,
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant',
        entity_id: tenantId,
        action_type: 'updated',
        description: `Subscription plan changed from "${oldPlan?.name || 'Unknown'}" to "${newPlan.name}"`,
        before_json: {
          subscription_plan_id: tenant.subscription_plan_id,
          plan_name: oldPlan?.name,
        },
        after_json: {
          subscription_plan_id: newPlanId,
          plan_name: newPlan.name,
        },
        status: 'success',
      });

      this.logger.log(
        `Tenant ${tenantId} subscription plan changed to ${newPlanId} by admin ${adminUserId}`,
      );

      return {
        message: 'Subscription plan changed successfully',
        tenant: updatedTenant,
      };
    } catch (error) {
      this.logger.error(
        `Failed to change subscription plan: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update tenant subscription details (status, billing cycle, dates)
   */
  async updateSubscriptionDetails(
    tenantId: string,
    updateDto: any,
    adminUserId: string,
  ) {
    try {
      // Verify tenant exists
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          company_name: true,
          subscription_status: true,
          trial_end_date: true,
          billing_cycle: true,
          next_billing_date: true,
        },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      // Validate subscription_status
      if (
        updateDto.subscription_status &&
        !['trial', 'active', 'canceled'].includes(updateDto.subscription_status)
      ) {
        throw new BadRequestException(
          'Invalid subscription_status. Must be: trial, active, or canceled',
        );
      }

      // Validate billing_cycle
      if (
        updateDto.billing_cycle &&
        !['monthly', 'annual'].includes(updateDto.billing_cycle)
      ) {
        throw new BadRequestException(
          'Invalid billing_cycle. Must be: monthly or annual',
        );
      }

      // Build update data
      const updateData: any = {
        updated_at: new Date(),
      };

      if (updateDto.subscription_status !== undefined) {
        updateData.subscription_status = updateDto.subscription_status;
      }

      if (updateDto.trial_end_date !== undefined) {
        updateData.trial_end_date = updateDto.trial_end_date
          ? new Date(updateDto.trial_end_date)
          : null;
      }

      if (updateDto.billing_cycle !== undefined) {
        updateData.billing_cycle = updateDto.billing_cycle;
      }

      if (updateDto.next_billing_date !== undefined) {
        updateData.next_billing_date = updateDto.next_billing_date
          ? new Date(updateDto.next_billing_date)
          : null;
      }

      // Update tenant
      const updatedTenant = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: updateData,
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant',
        entity_id: tenantId,
        action_type: 'updated',
        description: 'Subscription details updated by Platform Admin',
        before_json: {
          subscription_status: tenant.subscription_status,
          trial_end_date: tenant.trial_end_date,
          billing_cycle: tenant.billing_cycle,
          next_billing_date: tenant.next_billing_date,
        },
        after_json: updateData,
        status: 'success',
      });

      this.logger.log(
        `Tenant ${tenantId} subscription details updated by admin ${adminUserId}`,
      );

      return {
        message: 'Subscription details updated successfully',
        tenant: updatedTenant,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update subscription details: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get subscription change history for a tenant
   */
  async getSubscriptionHistory(tenantId: string) {
    try {
      // Verify tenant exists
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, company_name: true },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      // Get audit logs related to subscription changes
      const history = await this.prisma.audit_log.findMany({
        where: {
          tenant_id: tenantId,
          entity_type: 'tenant',
          entity_id: tenantId,
          OR: [
            { description: { contains: 'subscription' } },
            { description: { contains: 'Subscription' } },
            { description: { contains: 'plan changed' } },
            { description: { contains: 'billing' } },
          ],
        },
        select: {
          id: true,
          action_type: true,
          description: true,
          before_json: true,
          after_json: true,
          created_at: true,
          actor_user_id: true,
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 50, // Limit to last 50 changes
      });

      return {
        tenant: {
          id: tenant.id,
          company_name: tenant.company_name,
        },
        history: history.map((log) => ({
          id: log.id,
          action: log.action_type,
          description: log.description,
          changes: {
            before: log.before_json,
            after: log.after_json,
          },
          changed_by: log.user
            ? {
                id: log.user.id,
                email: log.user.email,
                name: `${log.user.first_name} ${log.user.last_name}`,
              }
            : null,
          changed_at: log.created_at,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get subscription history: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * List all user memberships in a specific tenant (platform admin)
   */
  async getTenantUsers(tenantId: string, query: ListUsersQueryDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found.');

    const { page = 1, limit = 20, status, role_id } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.user_tenant_membershipWhereInput = {
      tenant_id: tenantId,
    };
    if (status) where.status = status;
    if (role_id) where.role_id = role_id;

    const [memberships, total] = await Promise.all([
      this.prisma.user_tenant_membership.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
            },
          },
          role: {
            select: { id: true, name: true },
          },
          invited_by: {
            select: { id: true, first_name: true, last_name: true },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user_tenant_membership.count({ where }),
    ]);

    return {
      data: memberships.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        first_name: m.user.first_name,
        last_name: m.user.last_name,
        email: m.user.email,
        phone: m.user.phone ?? null,
        role: { id: m.role.id, name: m.role.name },
        status: m.status,
        joined_at: m.joined_at?.toISOString() ?? null,
        left_at: m.left_at?.toISOString() ?? null,
        invited_by: m.invited_by
          ? {
              id: m.invited_by.id,
              first_name: m.invited_by.first_name,
              last_name: m.invited_by.last_name,
            }
          : null,
        created_at: m.created_at.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a user + membership directly, bypassing the invite flow (platform admin)
   */
  async createUserInTenant(
    tenantId: string,
    dto: CreateUserAdminDto,
    adminUserId: string,
  ) {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found.');

    // Verify role exists
    const role = await this.prisma.role.findUnique({
      where: { id: dto.role_id },
    });
    if (!role) throw new NotFoundException('Role not found.');

    // Check for existing active membership in this tenant
    const existing = await this.prisma.user_tenant_membership.findFirst({
      where: {
        tenant_id: tenantId,
        status: 'ACTIVE',
        user: { email: dto.email },
      },
    });
    if (existing) {
      throw new ConflictException(
        'This email already has an active membership in this tenant.',
      );
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
      user = await this.prisma.user.create({
        data: {
          id: randomBytes(16).toString('hex'),
          email: dto.email,
          first_name: dto.first_name,
          last_name: dto.last_name,
          password_hash: passwordHash,
          phone: dto.phone ?? null,
          is_active: true,
          email_verified: true,
          email_verified_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    // BR-02: Verify user has no other ACTIVE membership
    const otherActive = await this.prisma.user_tenant_membership.findFirst({
      where: { user_id: user.id, status: 'ACTIVE' },
    });
    if (otherActive) {
      throw new ConflictException(
        'User is currently active in another organization.',
      );
    }

    // Create ACTIVE membership
    const membership = await this.prisma.user_tenant_membership.create({
      data: {
        user_id: user.id,
        tenant_id: tenantId,
        role_id: dto.role_id,
        status: 'ACTIVE',
        joined_at: new Date(),
      },
      include: { role: true },
    });

    // Audit log
    await this.auditLogger.log({
      tenant_id: tenantId,
      actor_user_id: adminUserId,
      actor_type: 'platform_admin',
      entity_type: 'user_tenant_membership',
      entity_id: membership.id,
      action_type: 'created',
      description: `User ${dto.email} added to tenant ${tenant.company_name} with role ${role.name} (bypassed invite flow)`,
      after_json: {
        user_id: user.id,
        email: dto.email,
        tenant_id: tenantId,
        role_id: dto.role_id,
        status: 'ACTIVE',
      },
      status: 'success',
    });

    return {
      id: membership.id,
      user_id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: { id: role.id, name: role.name },
      status: 'ACTIVE',
      joined_at: membership.joined_at?.toISOString() ?? null,
      created_at: membership.created_at.toISOString(),
    };
  }

  /**
   * Generate temporary EIN for development/testing
   */
  private generateTemporaryEIN(): string {
    const prefix = Math.floor(Math.random() * 90) + 10;
    const suffix = Math.floor(Math.random() * 9000000) + 1000000;
    return `${prefix}-${suffix}`;
  }
}
