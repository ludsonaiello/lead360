import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
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
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { VoiceAgentProfilesService } from '../../services/voice-agent-profiles.service';
import { CreateAgentProfileOverrideDto } from '../../dto/create-agent-profile-override.dto';
import { UpdateAgentProfileOverrideDto } from '../../dto/update-agent-profile-override.dto';

/**
 * VoiceAgentProfilesController — Tenant
 *
 * Tenant endpoints for managing voice agent profile overrides.
 * Tenants can view available global profiles (read-only) and create/manage
 * overrides to customize greeting/instructions per their business needs.
 *
 * Route prefix: /api/v1/voice-ai/
 * Auth: JwtAuthGuard + RolesGuard
 * Tenant ID: extracted from JWT (req.user.tenant_id)
 *
 * Endpoints:
 *   GET    /api/v1/voice-ai/available-profiles              - List global profiles (read-only)
 *   POST   /api/v1/voice-ai/agent-profile-overrides         - Create override for global profile
 *   GET    /api/v1/voice-ai/agent-profile-overrides         - List tenant's overrides
 *   GET    /api/v1/voice-ai/agent-profile-overrides/:id     - Get single override
 *   PATCH  /api/v1/voice-ai/agent-profile-overrides/:id     - Update override
 *   DELETE /api/v1/voice-ai/agent-profile-overrides/:id     - Delete override
 */
@ApiTags('Voice AI - Agent Profile Overrides')
@ApiBearerAuth()
@Controller('voice-ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceAgentProfilesController {
  constructor(
    private readonly voiceAgentProfilesService: VoiceAgentProfilesService,
  ) {}

  // ─── NEW: List Available Global Profiles (Read-Only) ───────────────────────
  /**
   * GET /api/v1/voice-ai/available-profiles
   *
   * Lists all global profiles available for selection.
   * Read-only: tenants cannot modify global profiles.
   * Used to show available languages/voices in UI before creating override.
   */
  @Get('available-profiles')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'List available global voice agent profiles',
    description:
      'Returns all global profiles available for selection and customization. ' +
      'Read-only: tenants cannot modify global profiles (system admin managed). ' +
      'Optionally filter to active profiles only.',
  })
  @ApiQuery({
    name: 'active_only',
    required: false,
    type: Boolean,
    description: 'If true, returns only is_active=true profiles',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'List of available global profiles',
    schema: {
      example: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          language_code: 'en',
          language_name: 'English',
          voice_id: 'cartesia-voice-id',
          display_name: 'English - Professional',
          description: 'Professional English voice',
          default_greeting: 'Hello, thank you for calling {business_name}!',
          default_instructions: 'You are a professional assistant...',
          is_active: true,
          display_order: 1,
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  async listAvailableProfiles(
    @Query('active_only', new ParseBoolPipe({ optional: true }))
    activeOnly?: boolean,
  ) {
    return this.voiceAgentProfilesService.listAvailableGlobalProfiles(
      activeOnly ?? true,
    );
  }

  // ─── NEW: Create Override ───────────────────────────────────────────────────
  /**
   * POST /api/v1/voice-ai/agent-profile-overrides
   *
   * Creates a tenant override for a global voice agent profile.
   * Allows customization of greeting/instructions per tenant.
   * Subject to plan limits.
   */
  @Post('agent-profile-overrides')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create tenant override for a global profile',
    description:
      'Creates an override allowing you to customize a global profile. ' +
      'Subject to plan limits (subscription_plan.voice_ai_max_agent_profiles). ' +
      'Cannot create duplicate override for the same global profile.',
  })
  @ApiResponse({
    status: 201,
    description: 'Override created successfully',
    schema: {
      example: {
        id: 'override-uuid',
        tenant_id: 'tenant-uuid',
        agent_profile_id: '00000000-0000-0000-0000-000000000001',
        custom_greeting: 'Welcome to our business!',
        custom_instructions: 'Be extra friendly...',
        is_active: true,
        created_at: '2026-03-04T12:00:00.000Z',
        agent_profile: {
          id: '00000000-0000-0000-0000-000000000001',
          display_name: 'English - Professional',
          language_name: 'English',
          default_greeting: 'Hello...',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input / Global profile inactive',
  })
  @ApiResponse({ status: 403, description: 'Plan limit reached' })
  @ApiResponse({ status: 404, description: 'Global profile not found' })
  @ApiResponse({
    status: 409,
    description: 'Override already exists for this profile',
  })
  async createOverride(
    @Request() req: { user: { tenant_id: string; id: string } },
    @Body() dto: CreateAgentProfileOverrideDto,
  ) {
    return this.voiceAgentProfilesService.createOverride(
      req.user.tenant_id,
      dto,
      req.user.id,
    );
  }

  // ─── NEW: List Tenant Overrides ────────────────────────────────────────────
  /**
   * GET /api/v1/voice-ai/agent-profile-overrides
   *
   * Lists all tenant's overrides with global profile details.
   */
  @Get('agent-profile-overrides')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'List tenant overrides',
    description:
      'Returns all overrides for authenticated tenant with global profile details. ' +
      'Shows which global profiles you have customized.',
  })
  @ApiQuery({
    name: 'active_only',
    required: false,
    type: Boolean,
    description: 'If true, returns only is_active=true overrides',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'List of tenant overrides',
  })
  async listOverrides(
    @Request() req: { user: { tenant_id: string } },
    @Query('active_only', new ParseBoolPipe({ optional: true }))
    activeOnly?: boolean,
  ) {
    return this.voiceAgentProfilesService.listOverrides(
      req.user.tenant_id,
      activeOnly || false,
    );
  }

  // ─── NEW: Get Single Override ───────────────────────────────────────────────
  /**
   * GET /api/v1/voice-ai/agent-profile-overrides/:id
   */
  @Get('agent-profile-overrides/:id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get a single tenant override',
    description:
      'Returns details of a specific override with global profile details.',
  })
  @ApiParam({
    name: 'id',
    description: 'Override UUID',
    example: 'override-uuid',
  })
  @ApiResponse({ status: 200, description: 'Override details' })
  @ApiResponse({
    status: 404,
    description: 'Override not found or different tenant',
  })
  async findOverride(
    @Request() req: { user: { tenant_id: string } },
    @Param('id') id: string,
  ) {
    return this.voiceAgentProfilesService.findOverride(req.user.tenant_id, id);
  }

  // ─── NEW: Update Override ───────────────────────────────────────────────────
  /**
   * PATCH /api/v1/voice-ai/agent-profile-overrides/:id
   */
  @Patch('agent-profile-overrides/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Update a tenant override',
    description:
      'Updates override fields (custom_greeting, custom_instructions, is_active). ' +
      'Cannot change agent_profile_id (immutable).',
  })
  @ApiParam({
    name: 'id',
    description: 'Override UUID',
    example: 'override-uuid',
  })
  @ApiResponse({ status: 200, description: 'Override updated successfully' })
  @ApiResponse({ status: 404, description: 'Override not found' })
  async updateOverride(
    @Request() req: { user: { tenant_id: string; id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateAgentProfileOverrideDto,
  ) {
    return this.voiceAgentProfilesService.updateOverride(
      req.user.tenant_id,
      id,
      dto,
      req.user.id,
    );
  }

  // ─── NEW: Delete Override ───────────────────────────────────────────────────
  /**
   * DELETE /api/v1/voice-ai/agent-profile-overrides/:id
   */
  @Delete('agent-profile-overrides/:id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a tenant override',
    description: 'Deletes an override. Hard delete (not soft delete).',
  })
  @ApiParam({
    name: 'id',
    description: 'Override UUID',
    example: 'override-uuid',
  })
  @ApiResponse({ status: 204, description: 'Override deleted successfully' })
  @ApiResponse({ status: 404, description: 'Override not found' })
  async deleteOverride(
    @Request() req: { user: { tenant_id: string } },
    @Param('id') id: string,
  ) {
    await this.voiceAgentProfilesService.deleteOverride(
      req.user.tenant_id,
      id,
    );
  }
}
