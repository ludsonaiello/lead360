import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PlatformAdminGuard } from '../../../admin/guards/platform-admin.guard';
import { VoiceAiProvidersService } from '../../services/voice-ai-providers.service';
import { CreateProviderDto } from '../../dto/create-provider.dto';
import { UpdateProviderDto } from '../../dto/update-provider.dto';
import { FilterVoiceAiProvidersDto } from '../../dto/filter-voice-ai-providers.dto';

/**
 * VoiceAiProvidersController — System Admin
 *
 * CRUD management for the AI provider registry.
 * Route prefix: /api/v1/system/voice-ai/providers
 * Access: Platform Admin only (PlatformAdminGuard)
 * Note: JWT authentication is globally applied, so only PlatformAdminGuard is needed here
 */
@ApiTags('Admin - Voice AI Providers')
@ApiBearerAuth()
@Controller('system/voice-ai/providers')
@UseGuards(PlatformAdminGuard)
export class VoiceAiProvidersController {
  constructor(
    private readonly providersService: VoiceAiProvidersService,
  ) {}

  /**
   * GET /api/v1/system/voice-ai/providers
   * List all AI providers ordered by type then name.
   * Supports filtering by provider_type and is_active.
   */
  @Get()
  @ApiOperation({
    summary: 'List all AI providers',
    description:
      'Returns all AI providers with optional filtering by type (STT/LLM/TTS) and active status',
  })
  @ApiResponse({
    status: 200,
    description: 'Providers list returned successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  findAll(@Query() filters: FilterVoiceAiProvidersDto) {
    return this.providersService.findAll(filters);
  }

  /**
   * GET /api/v1/system/voice-ai/providers/:id
   * Get a single AI provider by ID.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single AI provider by ID',
    description: 'Returns detailed information about a specific AI provider',
  })
  @ApiParam({ name: 'id', description: 'Provider UUID' })
  @ApiResponse({
    status: 200,
    description: 'Provider details returned successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  findOne(@Param('id') id: string) {
    return this.providersService.findById(id);
  }

  /**
   * POST /api/v1/system/voice-ai/providers
   * Create a new AI provider entry.
   */
  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a new AI provider',
    description:
      'Creates a new AI provider in the registry (e.g., Deepgram for STT, OpenAI for LLM, Cartesia for TTS)',
  })
  @ApiResponse({
    status: 201,
    description: 'Provider created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error - invalid input data',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({
    status: 409,
    description: 'Provider key already exists - must be unique',
  })
  create(@Body() dto: CreateProviderDto) {
    return this.providersService.create(dto);
  }

  /**
   * PATCH /api/v1/system/voice-ai/providers/:id
   * Partially update an AI provider.
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update an AI provider',
    description:
      'Partially updates an existing AI provider. All fields are optional.',
  })
  @ApiParam({ name: 'id', description: 'Provider UUID' })
  @ApiResponse({
    status: 200,
    description: 'Provider updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error - invalid input data',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  @ApiResponse({
    status: 409,
    description: 'Provider key already exists (if changing provider_key)',
  })
  update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.providersService.update(id, dto);
  }

  /**
   * DELETE /api/v1/system/voice-ai/providers/:id
   * Hard-delete an AI provider (permanently removes from database).
   * WARNING: This will cascade delete all related credentials and usage records.
   */
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Hard-delete an AI provider',
    description:
      'Permanently deletes a provider from the database. WARNING: This will also cascade delete all related credentials and usage records. This action cannot be undone.',
  })
  @ApiParam({ name: 'id', description: 'Provider UUID' })
  @ApiResponse({
    status: 204,
    description: 'Provider permanently deleted from database',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async delete(@Param('id') id: string) {
    await this.providersService.delete(id);
  }
}
