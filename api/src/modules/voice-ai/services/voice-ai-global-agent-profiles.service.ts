import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateGlobalAgentProfileDto } from '../dto/create-global-agent-profile.dto';
import { UpdateGlobalAgentProfileDto } from '../dto/update-global-agent-profile.dto';

/**
 * VoiceAiGlobalAgentProfilesService
 *
 * Service for managing global voice agent profiles (system admin only).
 * Global profiles are templates available to all tenants.
 * Tenants select profiles and optionally override settings per their preferences.
 */
@Injectable()
export class VoiceAiGlobalAgentProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new global voice agent profile
   *
   * Validation:
   * - display_name must be unique across all global profiles
   * - language_code should be valid ISO 639-1 code (not strictly enforced, but recommended)
   *
   * @param dto - Profile creation data
   * @param userId - Admin user UUID (for audit trail)
   * @returns Created profile
   */
  async create(dto: CreateGlobalAgentProfileDto, userId: string) {
    // Check for duplicate display_name
    const existingByName = await this.prisma.voice_ai_agent_profile.findFirst({
      where: {
        display_name: dto.display_name,
      },
    });

    if (existingByName) {
      throw new ConflictException(
        `A global profile with display name "${dto.display_name}" already exists. Display names must be unique.`,
      );
    }

    // Create profile
    return this.prisma.voice_ai_agent_profile.create({
      data: {
        ...dto,
        voice_provider_type: dto.voice_provider_type || 'tts',
        is_active: dto.is_active ?? true,
        display_order: dto.display_order ?? 0,
        updated_by: userId,
      },
    });
  }

  /**
   * List all global profiles
   *
   * @param activeOnly - If true, returns only is_active=true profiles
   * @returns Array of profiles sorted by display_order
   */
  async findAll(activeOnly: boolean = false) {
    return this.prisma.voice_ai_agent_profile.findMany({
      where: activeOnly ? { is_active: true } : undefined,
      orderBy: [{ display_order: 'asc' }, { language_name: 'asc' }],
    });
  }

  /**
   * Get a single global profile by ID
   *
   * @param id - Profile UUID
   * @returns Profile details
   * @throws NotFoundException if profile doesn't exist
   */
  async findOne(id: string) {
    const profile = await this.prisma.voice_ai_agent_profile.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tenant_overrides: true, // Count how many tenants are using this profile
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        `Global voice agent profile not found: ${id}`,
      );
    }

    return profile;
  }

  /**
   * Update a global profile
   *
   * Only fields included in the DTO are updated.
   * Cannot update created_at, id, or relationships.
   *
   * @param id - Profile UUID
   * @param dto - Fields to update
   * @param userId - Admin user UUID (for audit trail)
   * @returns Updated profile
   * @throws NotFoundException if profile doesn't exist
   * @throws ConflictException if display_name conflicts
   */
  async update(id: string, dto: UpdateGlobalAgentProfileDto, userId: string) {
    // Check profile exists
    await this.findOne(id);

    // Check display_name uniqueness (if being changed)
    if (dto.display_name) {
      const existingByName = await this.prisma.voice_ai_agent_profile.findFirst(
        {
          where: {
            display_name: dto.display_name,
            id: { not: id }, // Exclude current profile
          },
        },
      );

      if (existingByName) {
        throw new ConflictException(
          `A global profile with display name "${dto.display_name}" already exists.`,
        );
      }
    }

    return this.prisma.voice_ai_agent_profile.update({
      where: { id },
      data: {
        ...dto,
        updated_by: userId,
      },
    });
  }

  /**
   * Delete (soft delete) a global profile
   *
   * Sets is_active=false instead of hard deleting.
   * This prevents breaking existing IVR configurations that reference this profile.
   *
   * Validation:
   * - Cannot delete if any tenant overrides exist (must be removed first)
   * - Cannot delete if any IVR configs reference this profile
   *
   * @param id - Profile UUID
   * @throws NotFoundException if profile doesn't exist
   * @throws BadRequestException if profile is in use
   */
  async remove(id: string) {
    // Check profile exists
    const profile = await this.findOne(id);

    // Check if any tenant overrides exist
    const overrideCount =
      await this.prisma.tenant_voice_agent_profile_override.count({
        where: {
          agent_profile_id: id,
        },
      });

    if (overrideCount > 0) {
      throw new BadRequestException(
        `Cannot delete this profile. ${overrideCount} tenant(s) are using it. ` +
          `Please ask tenants to remove their overrides first, or deactivate the profile instead of deleting.`,
      );
    }

    // Soft delete (set is_active=false)
    return this.prisma.voice_ai_agent_profile.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
