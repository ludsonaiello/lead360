import {
  Controller,
  Get,
  Put,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { VoiceAiSettingsService } from '../../services/voice-ai-settings.service';
import { UpsertTenantVoiceSettingsDto } from '../../dto/upsert-tenant-voice-settings.dto';

/**
 * VoiceAiSettingsController — Tenant
 *
 * Allows tenant admins to view and configure their Voice AI behavior settings.
 * Only behavior fields are writable here — infrastructure overrides are admin-only (B11).
 *
 * Route prefix: /api/v1/voice-ai/settings
 * Auth: JwtAuthGuard only — any authenticated tenant user (no specific role required)
 * Tenant ID: extracted from JWT (req.user.tenant_id) — NEVER from the request body
 */
@ApiTags('Voice AI - Tenant Settings')
@ApiBearerAuth()
@Controller('voice-ai/settings')
@UseGuards(JwtAuthGuard)
export class VoiceAiSettingsController {
  constructor(private readonly settingsService: VoiceAiSettingsService) {}

  /**
   * GET /api/v1/voice-ai/settings
   *
   * Returns the tenant's current Voice AI settings.
   * Returns null if the tenant has never configured them — the frontend should
   * treat null as "all defaults apply" and render the form with default values.
   */
  @Get()
  @ApiOperation({
    summary: 'Get tenant Voice AI settings',
    description:
      'Returns the current Voice AI behavior settings for the authenticated tenant. ' +
      'Returns null if settings have never been saved (global defaults apply).',
  })
  @ApiResponse({
    status: 200,
    description: 'Current settings returned (may be null if not yet configured)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — valid JWT required' })
  getTenantSettings(@Request() req: { user: { tenant_id: string } }) {
    return this.settingsService.getTenantSettings(req.user.tenant_id);
  }

  /**
   * PUT /api/v1/voice-ai/settings
   *
   * Create or update the tenant's Voice AI behavior settings.
   * All fields are optional — only provided fields are written (PATCH semantics on PUT).
   *
   * Returns 403 if the tenant's subscription plan does not include Voice AI
   * and is_enabled: true is being set.
   */
  @Put()
  @ApiOperation({
    summary: 'Create or update tenant Voice AI settings',
    description:
      'Upserts Voice AI behavior settings for the authenticated tenant. ' +
      'Only behavior fields (greeting, languages, transfer numbers, etc.) can be set here. ' +
      'Setting is_enabled: true requires the tenant plan to have voice_ai_enabled = true.',
  })
  @ApiResponse({
    status: 200,
    description: 'Settings saved successfully — full updated settings row returned',
  })
  @ApiResponse({ status: 400, description: 'Validation error in request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — valid JWT required' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden — subscription plan does not include Voice AI (when is_enabled: true is sent)',
  })
  upsertTenantSettings(
    @Request() req: { user: { tenant_id: string } },
    @Body() dto: UpsertTenantVoiceSettingsDto,
  ) {
    return this.settingsService.upsertTenantSettings(req.user.tenant_id, dto);
  }
}
