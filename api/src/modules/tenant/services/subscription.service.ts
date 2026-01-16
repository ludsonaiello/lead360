import { randomUUID } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Get all subscription plans
   */
  async findAllPlans(includeInactive = false) {
    return this.prisma.subscription_plan.findMany({
      where: includeInactive ? {} : { is_active: true } as any,
      orderBy: { monthly_price: 'asc' } as any,
    });
  }

  /**
   * Get a specific subscription plan by ID
   */
  async findPlanById(planId: string) {
    const plan = await this.prisma.subscription_plan.findUnique({
      where: { id: planId } as any,
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return plan;
  }

  /**
   * Get default subscription plan
   */
  async getDefaultPlan() {
    const defaultPlan = await this.prisma.subscription_plan.findFirst({
      where: {
        is_default: true,
        is_active: true,
      } as any,
    });

    if (!defaultPlan) {
      throw new NotFoundException('No default subscription plan configured');
    }

    return defaultPlan;
  }

  /**
   * Create a new subscription plan (admin-only)
   */
  async createPlan(createDto: CreateSubscriptionPlanDto, adminUserId: string) {
    // Check if plan name already exists
    const existing = await this.prisma.subscription_plan.findUnique({
      where: { name: createDto.name } as any,
    });

    if (existing) {
      throw new ConflictException(
        `Subscription plan with name '${createDto.name}' already exists`,
      );
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      // If marking as default, un-mark other defaults
      if (createDto.is_default === true) {
        await tx.subscription_plan.updateMany({
          where: { is_default: true } as any,
          data: { is_default: false } as any,
        });
      }

      return await tx.subscription_plan.create({
        data: {
          id: randomUUID(),
          updated_at: new Date(),
          ...createDto,
          feature_flags: JSON.stringify(createDto.feature_flags),
        },
      });
    });

    // Audit log (after successful transaction)
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'SubscriptionPlan',
      entityId: plan.id,
      tenantId: null, // System-level action
      actorUserId: adminUserId,
      metadata: { created: createDto },
      description: 'Created subscription plan',
    });

    return plan;
  }

  /**
   * Update a subscription plan (admin-only)
   */
  async updatePlan(planId: string, updateDto: UpdateSubscriptionPlanDto, adminUserId: string) {
    // Verify plan exists
    const existing = await this.findPlanById(planId);

    // If changing name, check uniqueness
    if (updateDto.name && updateDto.name !== existing.name) {
      const nameConflict = await this.prisma.subscription_plan.findUnique({
        where: { name: updateDto.name } as any,
      });

      if (nameConflict) {
        throw new ConflictException(
          `Subscription plan with name '${updateDto.name}' already exists`,
        );
      }
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      // If marking as default, un-mark other defaults
      if (updateDto.is_default === true) {
        await tx.subscription_plan.updateMany({
          where: {
            is_default: true,
            NOT: { id: planId } as any,
          } as any,
          data: { is_default: false } as any,
        });
      }

      // Prepare update data with feature_flags converted to JSON string if present
      const updateData = {
        ...updateDto,
        ...(updateDto.feature_flags && {
          feature_flags: JSON.stringify(updateDto.feature_flags),
        }),
        updated_at: new Date(),
      };

      return await tx.subscription_plan.update({
        where: { id: planId } as any,
        data: updateData,
      });
    });

    // Audit log (after successful transaction)
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'SubscriptionPlan',
      entityId: planId,
      tenantId: null, // System-level action
      actorUserId: adminUserId,
      before: existing,
      after: updateDto,
      description: 'Updated subscription plan',
    });

    return plan;
  }

  /**
   * Delete a subscription plan (admin-only)
   */
  async deletePlan(planId: string, adminUserId: string) {
    const existing = await this.findPlanById(planId);

    // Check if any tenants are using this plan
    const tenantsUsingPlan = await this.prisma.tenant.count({
      where: { subscription_plan_id: planId } as any,
    });

    if (tenantsUsingPlan > 0) {
      throw new BadRequestException(
        `Cannot delete subscription plan because ${tenantsUsingPlan} tenant(s) are using it. Please migrate tenants to another plan first.`,
      );
    }

    await this.prisma.subscription_plan.delete({
      where: { id: planId } as any,
    });

    // Audit log (after successful deletion)
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'SubscriptionPlan',
      entityId: planId,
      tenantId: null,
      actorUserId: adminUserId,
      before: existing,
      description: 'Deleted subscription plan',
    });

    return { message: 'Subscription plan deleted successfully' };
  }

  /**
   * Update tenant's subscription plan (admin-only)
   */
  async updateTenantSubscription(
    tenantId: string,
    newPlanId: string,
    adminUserId: string,
  ) {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId } as any,
      include: { subscription_plan: true } as any,
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Verify new plan exists and is active
    const newPlan = await this.findPlanById(newPlanId);
    if (!newPlan.is_active) {
      throw new BadRequestException('Cannot assign inactive subscription plan');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId } as any,
      data: {
        subscription_plan_id: newPlanId,
      } as any,
      include: { subscription_plan: true } as any,
    });

    // Audit log (after successful update)
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'Tenant',
      entityId: tenantId,
      tenantId: tenantId,
      actorUserId: adminUserId,
      metadata: {
        subscription_plan: {
          old: tenant.subscription_plan,
          new: newPlan,
        },
      },
      description: 'Updated billing cycle',
    });

    return updated;
  }

  /**
   * Check if tenant has access to a specific feature
   */
  async checkFeatureAccess(tenantId: string, featureName: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId } as any,
      include: { subscription_plan: true } as any,
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.subscription_plan) {
      return false; // No plan = no features
    }

    const featureFlags = (tenant.subscription_plan as any).feature_flags as Record<
      string,
      boolean
    >;

    return featureFlags[featureName] === true;
  }

  /**
   * Get tenant subscription status with trial info
   */
  async getTenantSubscriptionStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId } as any,
      include: { subscription_plan: true } as any,
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const now = new Date();
    const trialEndsAt = tenant.trial_end_date ? new Date(tenant.trial_end_date) : null;
    const isTrialActive = trialEndsAt ? trialEndsAt > now : false;
    const trialDaysRemaining = trialEndsAt
      ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      subscription_status: tenant.subscription_status,
      subscription_plan: tenant.subscription_plan,
      is_trial_active: isTrialActive,
      trial_end_date: trialEndsAt,
      trial_days_remaining: trialDaysRemaining > 0 ? trialDaysRemaining : 0,
      is_active: tenant.is_active,
    };
  }

  /**
   * Get all tenants using a specific plan (admin-only)
   */
  async getTenantsUsingPlan(planId: string) {
    const plan = await this.findPlanById(planId);

    const tenants = await this.prisma.tenant.findMany({
      where: { subscription_plan_id: planId } as any,
      select: {
        id: true,
        subdomain: true,
        company_name: true,
        subscription_plan_id: true,
        subscription_status: true,
        trial_end_date: true,
        billing_cycle: true,
        next_billing_date: true,
        is_active: true,
        created_at: true,
      } as any,
      orderBy: { created_at: 'desc' } as any,
    });

    return {
      plan,
      tenant_count: tenants.length,
      tenants,
    };
  }
}
