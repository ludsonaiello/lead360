import { Injectable, NotFoundException } from '@nestjs/common';
import { subscription_plan } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { UpdatePlanVoiceConfigDto } from '../dto/update-plan-voice-config.dto';

/**
 * Subset of subscription_plan fields returned by this service.
 * Only plan identity and Voice AI fields are exposed.
 */
export interface PlanWithVoiceConfig {
  id: string;
  name: string;
  description: string | null;
  monthly_price: unknown; // Decimal — serialized as string by Prisma
  annual_price: unknown; // Decimal — serialized as string by Prisma
  is_active: boolean;
  voice_ai_enabled: boolean;
  voice_ai_minutes_included: number;
  voice_ai_overage_rate: unknown; // Decimal | null
  voice_ai_max_agent_profiles: number;
}

/**
 * VoiceAiPlanConfigService
 *
 * Manages Voice AI feature flags on subscription_plan rows.
 * No tenant_id involved — subscription plans are platform-wide.
 */
@Injectable()
export class VoiceAiPlanConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return all subscription plans with their Voice AI config fields.
   * Ordered alphabetically by name.
   */
  async getPlansWithVoiceConfig(): Promise<PlanWithVoiceConfig[]> {
    const plans = await this.prisma.subscription_plan.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        monthly_price: true,
        annual_price: true,
        is_active: true,
        voice_ai_enabled: true,
        voice_ai_minutes_included: true,
        voice_ai_overage_rate: true,
        voice_ai_max_agent_profiles: true,
      },
      orderBy: { name: 'asc' },
    });

    return plans;
  }

  /**
   * Update the Voice AI fields on a specific subscription plan.
   *
   * @param planId  UUID of the subscription_plan row
   * @param dto     Fields to update (all optional)
   * @throws NotFoundException when no plan with that ID exists
   */
  async updatePlanVoiceConfig(
    planId: string,
    dto: UpdatePlanVoiceConfigDto,
  ): Promise<subscription_plan> {
    // Verify the plan exists — gives a clean 404 instead of a Prisma P2025 error
    const existing = await this.prisma.subscription_plan.findUnique({
      where: { id: planId },
    });

    if (!existing) {
      throw new NotFoundException(`Subscription plan "${planId}" not found`);
    }

    // Build update payload — only include fields present in the DTO.
    // updated_at must be set explicitly: subscription_plan has no @updatedAt attribute.
    const updateData: {
      updated_at: Date;
      voice_ai_enabled?: boolean;
      voice_ai_minutes_included?: number;
      voice_ai_overage_rate?: number | null;
      voice_ai_max_agent_profiles?: number;
    } = { updated_at: new Date() };

    if (dto.voice_ai_enabled !== undefined)
      updateData.voice_ai_enabled = dto.voice_ai_enabled;

    if (dto.voice_ai_minutes_included !== undefined)
      updateData.voice_ai_minutes_included = dto.voice_ai_minutes_included;

    if (dto.voice_ai_overage_rate !== undefined)
      updateData.voice_ai_overage_rate = dto.voice_ai_overage_rate;

    if (dto.voice_ai_max_agent_profiles !== undefined)
      updateData.voice_ai_max_agent_profiles = dto.voice_ai_max_agent_profiles;

    return this.prisma.subscription_plan.update({
      where: { id: planId },
      data: updateData,
    });
  }
}
