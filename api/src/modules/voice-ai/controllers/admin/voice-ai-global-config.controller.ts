import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Request,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../admin/guards/platform-admin.guard';
import { VoiceAiGlobalConfigService } from '../../services/voice-ai-global-config.service';
import { UpdateGlobalConfigDto } from '../../dto/update-global-config.dto';
import { GlobalConfigResponseDto } from '../../dto/global-config-response.dto';

/**
 * VoiceAiGlobalConfigController — System Admin
 *
 * Manages the singleton global configuration for the Voice AI platform.
 * Route prefix: /api/v1/system/voice-ai/config
 * Access: Platform Admin only (JwtAuthGuard + PlatformAdminGuard)
 *
 * Security rules:
 *   - LiveKit API keys are encrypted at rest; NEVER returned in responses
 *   - agent_api_key_hash is NEVER returned; only agent_api_key_preview
 *   - updated_by is sourced from JWT (req.user.id), never from request body
 *   - POST /regenerate-key returns the plain key ONCE — it is not stored
 */
@ApiTags('Voice AI - System Admin Config')
@ApiBearerAuth()
@Controller('system/voice-ai/config')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class VoiceAiGlobalConfigController {
  constructor(
    private readonly globalConfigService: VoiceAiGlobalConfigService,
  ) {}

  /**
   * GET /api/v1/system/voice-ai/config
   * Return the global config singleton.
   * Sensitive fields (LiveKit keys, hash) are masked — only presence flags returned.
   * Includes resolved provider objects with display_name and provider_key.
   */
  @Get()
  @ApiOperation({ summary: 'Get global Voice AI configuration' })
  @ApiResponse({
    status: 200,
    description: 'Global config returned (no raw keys)',
    type: GlobalConfigResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  getConfig(): Promise<GlobalConfigResponseDto> {
    return this.globalConfigService.getConfig();
  }

  /**
   * PATCH /api/v1/system/voice-ai/config
   * Update global config fields. All fields are optional.
   * LiveKit keys are encrypted before storage if provided.
   */
  @Patch()
  @ApiOperation({ summary: 'Update global Voice AI configuration' })
  @ApiResponse({
    status: 200,
    description: 'Config updated successfully (no raw keys returned)',
    type: GlobalConfigResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error or malformed JSON field' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  updateConfig(
    @Body() dto: UpdateGlobalConfigDto,
    @Request() req: { user: { id: string } },
  ): Promise<GlobalConfigResponseDto> {
    return this.globalConfigService.updateConfig(req.user.id, dto);
  }

  /**
   * POST /api/v1/system/voice-ai/config/regenerate-key
   * Generate a new agent API key.
   * The plain key is returned ONCE in this response — it is never stored.
   * Future agent requests must use the X-Voice-Agent-Key header with this value.
   */
  @Post('regenerate-key')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Regenerate the agent API key',
    description:
      'Generates a new cryptographically random key. The plain key is returned ONCE and never stored. ' +
      'Store it immediately — it cannot be recovered.',
  })
  @ApiResponse({
    status: 200,
    description: 'New agent key generated — save the plain_key immediately',
    schema: {
      example: {
        plain_key: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        preview: '...xxxx',
        warning: 'Save this key now. It will not be shown again.',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  regenerateAgentKey() {
    return this.globalConfigService.regenerateAgentKey();
  }
}
