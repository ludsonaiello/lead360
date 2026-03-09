import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../admin/guards/platform-admin.guard';
import { VoiceAiPlanConfigService } from '../../services/voice-ai-plan-config.service';
import { UpdatePlanVoiceConfigDto } from '../../dto/update-plan-voice-config.dto';

/**
 * VoiceAiPlanConfigController — System Admin
 *
 * Manages Voice AI feature flags on subscription plan tiers.
 * Route prefix: /api/v1/system/voice-ai/plans
 * Access: Platform Admin only (JwtAuthGuard + PlatformAdminGuard)
 */
@ApiTags('Voice AI - System Admin Plan Config')
@ApiBearerAuth()
@Controller('system/voice-ai/plans')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class VoiceAiPlanConfigController {
  constructor(private readonly planConfigService: VoiceAiPlanConfigService) {}

  /**
   * GET /api/v1/system/voice-ai/plans
   * Return all subscription plans with their Voice AI configuration.
   */
  @Get()
  @ApiOperation({
    summary: 'List all subscription plans with Voice AI configuration',
  })
  @ApiResponse({
    status: 200,
    description:
      'Plans returned with voice_ai_enabled, minutes, and overage rate',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  getPlansWithVoiceConfig() {
    return this.planConfigService.getPlansWithVoiceConfig();
  }

  /**
   * PATCH /api/v1/system/voice-ai/plans/:planId/voice
   * Update Voice AI settings for a specific subscription plan.
   * Partial update — only fields in the DTO body are changed.
   */
  @Patch(':planId/voice')
  @ApiOperation({ summary: 'Update Voice AI config for a subscription plan' })
  @ApiParam({
    name: 'planId',
    description: 'UUID of the subscription_plan row',
  })
  @ApiResponse({
    status: 200,
    description: 'Plan voice config updated',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  updatePlanVoiceConfig(
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanVoiceConfigDto,
  ) {
    return this.planConfigService.updatePlanVoiceConfig(planId, dto);
  }
}
