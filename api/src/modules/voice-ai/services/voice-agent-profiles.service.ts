import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateAgentProfileOverrideDto } from '../dto/create-agent-profile-override.dto';
import { UpdateAgentProfileOverrideDto } from '../dto/update-agent-profile-override.dto';

/**
 * VoiceAgentProfilesService
 *
 * Service for managing tenant overrides for global voice agent profiles.
 * Tenants select global profiles (read-only templates) and create overrides
 * to customize greeting/instructions per their business needs.
 *
 * Security:
 * - All queries enforce tenant_id isolation
 * - Plan limits enforced (subscription_plan.voice_ai_max_agent_profiles)
 * - Global profiles are read-only for tenants (system admin managed)
 */
@Injectable()
export class VoiceAgentProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List available global profiles (read-only for tenants)
   *
   * @param activeOnly - Filter to active profiles only
   * @returns Array of global profiles sorted by display_order
   */
  async listAvailableGlobalProfiles(activeOnly: boolean = true) {
    return this.prisma.voice_ai_agent_profile.findMany({
      where: activeOnly ? { is_active: true } : undefined,
      orderBy: [{ display_order: 'asc' }, { language_name: 'asc' }],
      select: {
        id: true,
        language_code: true,
        language_name: true,
        voice_id: true,
        display_name: true,
        description: true,
        default_greeting: true, // Show default so tenants can decide if override needed
        default_instructions: true,
        is_active: true,
        display_order: true,
      },
    });
  }

  /**
   * Create a tenant override for a global profile
   *
   * Validation:
   * - Global profile must exist and be active
   * - Tenant cannot exceed plan limit (voice_ai_max_agent_profiles)
   * - Tenant cannot create duplicate override for same global profile
   *
   * @param tenantId - Tenant UUID (from JWT)
   * @param dto - Override data
   * @param userId - User UUID (for audit trail)
   * @returns Created override
   */
  async createOverride(
    tenantId: string,
    dto: CreateAgentProfileOverrideDto,
    userId: string,
  ) {
    // 1. Validate global profile exists and is active
    const globalProfile = await this.prisma.voice_ai_agent_profile.findUnique({
      where: { id: dto.agent_profile_id },
    });

    if (!globalProfile) {
      throw new NotFoundException(
        `Global voice agent profile not found: ${dto.agent_profile_id}`,
      );
    }

    if (!globalProfile.is_active) {
      throw new BadRequestException(
        `Cannot create override for inactive global profile: ${globalProfile.display_name}`,
      );
    }

    // 2. Check for duplicate override (tenant already has override for this global profile)
    const existingOverride =
      await this.prisma.tenant_voice_agent_profile_override.findFirst({
        where: {
          tenant_id: tenantId,
          agent_profile_id: dto.agent_profile_id,
        },
      });

    if (existingOverride) {
      throw new ConflictException(
        `You already have an override for profile "${globalProfile.display_name}". ` +
          `Update the existing override (ID: ${existingOverride.id}) instead of creating a new one.`,
      );
    }

    // 3. Enforce plan limit
    await this.validatePlanLimit(tenantId);

    // 4. Create override
    return this.prisma.tenant_voice_agent_profile_override.create({
      data: {
        tenant_id: tenantId,
        agent_profile_id: dto.agent_profile_id,
        custom_greeting: dto.custom_greeting,
        custom_instructions: dto.custom_instructions,
        is_active: dto.is_active ?? true,
        updated_by: userId,
        display_order: globalProfile.display_order,
      },
      include: {
        agent_profile: {
          select: {
            id: true,
            display_name: true,
            language_name: true,
            default_greeting: true,
            default_instructions: true,
          },
        },
      },
    });
  }

  /**
   * List tenant's overrides (with global profile details)
   *
   * @param tenantId - Tenant UUID (from JWT)
   * @param activeOnly - Filter to active overrides only
   * @returns Array of overrides with global profile details
   */
  async listOverrides(tenantId: string, activeOnly: boolean = false) {
    return this.prisma.tenant_voice_agent_profile_override.findMany({
      where: {
        tenant_id: tenantId,
        ...(activeOnly ? { is_active: true } : {}),
      },
      include: {
        agent_profile: {
          select: {
            id: true,
            language_code: true,
            language_name: true,
            voice_id: true,
            display_name: true,
            description: true,
            default_greeting: true,
            default_instructions: true,
            is_active: true,
          },
        },
      },
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  /**
   * Get single override by ID
   *
   * @param tenantId - Tenant UUID (tenant isolation)
   * @param overrideId - Override UUID
   * @returns Override with global profile details
   * @throws NotFoundException if not found or belongs to different tenant
   */
  async findOverride(tenantId: string, overrideId: string) {
    const override =
      await this.prisma.tenant_voice_agent_profile_override.findFirst({
        where: {
          id: overrideId,
          tenant_id: tenantId,
        },
        include: {
          agent_profile: true,
        },
      });

    if (!override) {
      throw new NotFoundException(
        `Override not found or does not belong to your tenant: ${overrideId}`,
      );
    }

    return override;
  }

  /**
   * Update an existing override
   *
   * Can update: custom_greeting, custom_instructions, is_active
   * Cannot update: agent_profile_id (immutable after creation)
   *
   * @param tenantId - Tenant UUID (tenant isolation)
   * @param overrideId - Override UUID
   * @param dto - Fields to update
   * @param userId - User UUID (for audit trail)
   * @returns Updated override
   */
  async updateOverride(
    tenantId: string,
    overrideId: string,
    dto: UpdateAgentProfileOverrideDto,
    userId: string,
  ) {
    // Validate override exists and belongs to tenant
    await this.findOverride(tenantId, overrideId);

    return this.prisma.tenant_voice_agent_profile_override.update({
      where: {
        id: overrideId,
        tenant_id: tenantId,
      },
      data: {
        ...dto,
        updated_by: userId,
      },
      include: {
        agent_profile: true,
      },
    });
  }

  /**
   * Delete an override
   *
   * Hard delete (not soft delete, since tenant can recreate if needed).
   *
   * @param tenantId - Tenant UUID (tenant isolation)
   * @param overrideId - Override UUID
   */
  async deleteOverride(tenantId: string, overrideId: string) {
    // Validate override exists
    await this.findOverride(tenantId, overrideId);

    // Hard delete
    await this.prisma.tenant_voice_agent_profile_override.delete({
      where: {
        id: overrideId,
        tenant_id: tenantId,
      },
    });
  }

  /**
   * Validate tenant plan limit
   *
   * Checks subscription_plan.voice_ai_max_agent_profiles.
   * Counts active overrides (is_active=true).
   *
   * @param tenantId - Tenant UUID
   * @throws ForbiddenException if limit exceeded
   */
  private async validatePlanLimit(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription_plan: {
          select: {
            name: true,
            voice_ai_enabled: true,
            voice_ai_max_agent_profiles: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    if (!tenant.subscription_plan) {
      throw new NotFoundException(
        `Subscription plan not found for tenant: ${tenantId}`,
      );
    }

    if (!tenant.subscription_plan.voice_ai_enabled) {
      throw new ForbiddenException(
        `Voice AI is not enabled on your subscription plan (${tenant.subscription_plan.name}). ` +
          `Please upgrade to access this feature.`,
      );
    }

    const activeOverrideCount =
      await this.prisma.tenant_voice_agent_profile_override.count({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
      });

    const limit = tenant.subscription_plan.voice_ai_max_agent_profiles || 1;

    if (activeOverrideCount >= limit) {
      throw new ForbiddenException(
        `Your plan allows a maximum of ${limit} active voice agent profile(s). ` +
          `You currently have ${activeOverrideCount} active. ` +
          `Deactivate or delete an existing profile, or upgrade your plan.`,
      );
    }
  }
}
