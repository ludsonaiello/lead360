import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../admin/guards/platform-admin.guard';
import { VoiceAiProvidersService } from '../../services/voice-ai-providers.service';
import { CreateProviderDto } from '../../dto/create-provider.dto';
import { UpdateProviderDto } from '../../dto/update-provider.dto';

/**
 * VoiceAiProvidersController — System Admin
 *
 * CRUD management for the AI provider registry.
 * Route prefix: /api/v1/system/voice-ai/providers
 * Access: Platform Admin only (JwtAuthGuard + PlatformAdminGuard)
 */
@ApiTags('Voice AI - System Admin Providers')
@ApiBearerAuth()
@Controller('system/voice-ai/providers')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class VoiceAiProvidersController {
  constructor(
    private readonly providersService: VoiceAiProvidersService,
  ) {}

  /**
   * GET /api/v1/system/voice-ai/providers
   * List all AI providers ordered by type then name.
   */
  @Get()
  @ApiOperation({ summary: 'List all AI providers' })
  @ApiResponse({ status: 200, description: 'Providers list returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  findAll() {
    return this.providersService.findAll();
  }

  /**
   * POST /api/v1/system/voice-ai/providers
   * Create a new AI provider entry.
   */
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new AI provider' })
  @ApiResponse({ status: 201, description: 'Provider created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({
    status: 409,
    description: 'Provider key already exists',
  })
  create(@Body() dto: CreateProviderDto) {
    return this.providersService.create(dto);
  }

  /**
   * PATCH /api/v1/system/voice-ai/providers/:id
   * Partially update an AI provider.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update an AI provider' })
  @ApiParam({ name: 'id', description: 'Provider UUID' })
  @ApiResponse({ status: 200, description: 'Provider updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.providersService.update(id, dto);
  }

  /**
   * DELETE /api/v1/system/voice-ai/providers/:id
   * Permanently delete an AI provider.
   * Returns 422 if the provider is referenced by credentials or usage records.
   */
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Permanently delete an AI provider' })
  @ApiParam({ name: 'id', description: 'Provider UUID' })
  @ApiResponse({ status: 204, description: 'Provider deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  @ApiResponse({
    status: 422,
    description: 'Provider is in use — remove linked credentials/usage records first',
  })
  async delete(@Param('id') id: string): Promise<void> {
    await this.providersService.delete(id);
  }
}
