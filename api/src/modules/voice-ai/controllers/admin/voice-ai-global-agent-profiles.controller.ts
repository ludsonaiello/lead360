import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../admin/guards/platform-admin.guard';
import { VoiceAiGlobalAgentProfilesService } from '../../services/voice-ai-global-agent-profiles.service';
import { CreateGlobalAgentProfileDto } from '../../dto/create-global-agent-profile.dto';
import { UpdateGlobalAgentProfileDto } from '../../dto/update-global-agent-profile.dto';

/**
 * VoiceAiGlobalAgentProfilesController — System Admin (Sprint 16)
 *
 * Platform admin endpoints for managing global voice agent profiles.
 * Global profiles are language/voice templates available to all tenants.
 *
 * All endpoints are admin-only (is_platform_admin: true).
 *
 * Route prefix: /api/v1/system/voice-ai/agent-profiles
 * Access: Platform Admin only (JwtAuthGuard + PlatformAdminGuard)
 *
 * Endpoints:
 *   POST   /api/v1/system/voice-ai/agent-profiles        — Create global profile
 *   GET    /api/v1/system/voice-ai/agent-profiles        — List all global profiles
 *   GET    /api/v1/system/voice-ai/agent-profiles/:id    — Get single profile
 *   PATCH  /api/v1/system/voice-ai/agent-profiles/:id    — Update profile
 *   DELETE /api/v1/system/voice-ai/agent-profiles/:id    — Soft delete profile
 */
@ApiTags('Voice AI - System Admin - Global Agent Profiles')
@ApiBearerAuth()
@Controller('system/voice-ai/agent-profiles')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class VoiceAiGlobalAgentProfilesController {
  constructor(
    private readonly globalProfilesService: VoiceAiGlobalAgentProfilesService,
  ) {}

  /**
   * POST /api/v1/system/voice-ai/agent-profiles
   *
   * Create a new global voice agent profile.
   * Global profiles are available to all tenants for selection/customization.
   *
   * Validation:
   * - display_name must be unique
   * - language_code: 2-10 chars
   * - voice_id: 1-200 chars (TTS provider voice identifier)
   *
   * Returns 201 with created profile.
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new global voice agent profile',
    description:
      'Creates a new global voice agent profile template. ' +
      'Global profiles are available to all tenants for selection and customization. ' +
      'Platform Admin access required.',
  })
  @ApiResponse({
    status: 201,
    description: 'Profile created successfully',
    schema: {
      example: {
        id: '00000000-0000-0000-0000-000000000001',
        language_code: 'en',
        language_name: 'English',
        voice_id: '2b568345-1f36-4cf8-baa7-5932856bf66a',
        voice_provider_type: 'tts',
        default_greeting: 'Hello, thank you for calling {business_name}!',
        default_instructions: 'You are a professional phone assistant...',
        display_name: 'English - Professional',
        description: 'Professional English voice for business calls',
        is_active: true,
        display_order: 1,
        created_at: '2026-03-04T12:00:00.000Z',
        updated_at: '2026-03-04T12:00:00.000Z',
        updated_by: 'admin-user-uuid',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body / Validation errors',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 409, description: 'Display name already exists' })
  create(@Body() dto: CreateGlobalAgentProfileDto, @Req() req) {
    return this.globalProfilesService.create(dto, req.user.id);
  }

  /**
   * GET /api/v1/system/voice-ai/agent-profiles
   *
   * List all global voice agent profiles.
   * Optional query param: active_only=true to filter only is_active=true profiles.
   *
   * Returns array sorted by display_order, then language_name.
   */
  @Get()
  @ApiOperation({
    summary: 'List all global voice agent profiles',
    description:
      'Returns a list of all global voice agent profiles. ' +
      'Optionally filter to show only active profiles. ' +
      'Platform Admin access required.',
  })
  @ApiQuery({
    name: 'active_only',
    required: false,
    type: Boolean,
    description: 'If true, returns only is_active=true profiles',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'List of global profiles',
    schema: {
      example: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          language_code: 'en',
          language_name: 'English',
          voice_id: '2b568345-1f36-4cf8-baa7-5932856bf66a',
          display_name: 'English - Professional',
          is_active: true,
          display_order: 1,
        },
        {
          id: '00000000-0000-0000-0000-000000000002',
          language_code: 'pt',
          language_name: 'Portuguese',
          voice_id: '3c679456-2g47-5dg9-cbb8-6043967cg77b',
          display_name: 'Portuguese - Friendly',
          is_active: true,
          display_order: 2,
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  findAll(
    @Query('active_only', new ParseBoolPipe({ optional: true }))
    activeOnly?: boolean,
  ) {
    return this.globalProfilesService.findAll(activeOnly || false);
  }

  /**
   * GET /api/v1/system/voice-ai/agent-profiles/:id
   *
   * Get details of a single global profile by ID.
   * Includes count of tenant overrides using this profile.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single global voice agent profile',
    description:
      'Returns details of a specific global profile by ID. ' +
      'Includes count of tenant overrides using this profile. ' +
      'Platform Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Global profile UUID',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile details',
    schema: {
      example: {
        id: '00000000-0000-0000-0000-000000000001',
        language_code: 'en',
        language_name: 'English',
        voice_id: '2b568345-1f36-4cf8-baa7-5932856bf66a',
        voice_provider_type: 'tts',
        default_greeting: 'Hello, thank you for calling {business_name}!',
        default_instructions: 'You are a professional phone assistant...',
        display_name: 'English - Professional',
        description: 'Professional English voice',
        is_active: true,
        display_order: 1,
        created_at: '2026-03-04T12:00:00.000Z',
        updated_at: '2026-03-04T12:00:00.000Z',
        updated_by: 'admin-user-uuid',
        _count: {
          tenant_overrides: 7, // 7 tenants are using this profile
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  findOne(@Param('id') id: string) {
    return this.globalProfilesService.findOne(id);
  }

  /**
   * PATCH /api/v1/system/voice-ai/agent-profiles/:id
   *
   * Update a global profile.
   * Only fields included in the request body are updated.
   *
   * Returns 200 with updated profile.
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a global voice agent profile',
    description:
      'Updates a global profile. Only fields included in the request body are updated. ' +
      'Platform Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Global profile UUID',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      example: {
        id: '00000000-0000-0000-0000-000000000001',
        display_name: 'English - Professional (Updated)',
        is_active: true,
        // ... other fields
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 409, description: 'Display name already exists' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGlobalAgentProfileDto,
    @Req() req,
  ) {
    return this.globalProfilesService.update(id, dto, req.user.id);
  }

  /**
   * DELETE /api/v1/system/voice-ai/agent-profiles/:id
   *
   * Soft delete a global profile (sets is_active=false).
   * Cannot delete if tenant overrides exist.
   *
   * Returns 204 No Content on success.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete (soft delete) a global voice agent profile',
    description:
      'Soft-deletes a global profile by setting is_active=false. ' +
      'Cannot delete if tenant overrides exist (returns 400). ' +
      'Platform Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Global profile UUID',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiResponse({ status: 204, description: 'Profile deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Profile is in use by tenant overrides',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  remove(@Param('id') id: string) {
    return this.globalProfilesService.remove(id);
  }
}
