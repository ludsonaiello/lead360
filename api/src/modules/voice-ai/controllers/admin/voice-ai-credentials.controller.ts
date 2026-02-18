import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  Request,
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
import { VoiceAiCredentialsService } from '../../services/voice-ai-credentials.service';
import { UpsertCredentialDto } from '../../dto/upsert-credential.dto';

/**
 * VoiceAiCredentialsController — System Admin
 *
 * Admin-only CRUD for encrypted provider API credentials.
 * Route prefix: /api/v1/system/voice-ai/credentials
 * Access: Platform Admin only (JwtAuthGuard + PlatformAdminGuard)
 *
 * Security rules enforced here:
 *   - Only masked keys are ever returned (no plaintext, no decrypted values)
 *   - updatedBy is taken from JWT (req.user.id) — never from the request body
 *   - getDecryptedKey() is NOT exposed — internal use by context builder only
 */
@ApiTags('Voice AI - System Admin Credentials')
@ApiBearerAuth()
@Controller('system/voice-ai/credentials')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class VoiceAiCredentialsController {
  constructor(
    private readonly credentialsService: VoiceAiCredentialsService,
  ) {}

  /**
   * GET /api/v1/system/voice-ai/credentials
   * List all provider credentials with masked keys only.
   * Never returns encrypted or plaintext API keys.
   */
  @Get()
  @ApiOperation({ summary: 'List all provider credentials (masked keys only)' })
  @ApiResponse({
    status: 200,
    description: 'Credentials returned with masked keys',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  findAll() {
    return this.credentialsService.findAll();
  }

  /**
   * PUT /api/v1/system/voice-ai/credentials/:providerId
   * Create or replace the credential for a given provider.
   * The key is encrypted (AES-256-GCM) before storage.
   * Returns the masked credential — plain key is never echoed back.
   */
  @Put(':providerId')
  @ApiOperation({
    summary: 'Create or update (upsert) credential for a provider',
  })
  @ApiParam({
    name: 'providerId',
    description: 'UUID of the voice_ai_provider row',
  })
  @ApiResponse({
    status: 200,
    description: 'Credential upserted — masked key returned',
  })
  @ApiResponse({ status: 400, description: 'Validation error (api_key < 10 chars)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  upsert(
    @Param('providerId') providerId: string,
    @Body() dto: UpsertCredentialDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.credentialsService.upsert(providerId, dto, req.user.id);
  }

  /**
   * DELETE /api/v1/system/voice-ai/credentials/:providerId
   * Remove the credential for a given provider.
   * Returns 204 No Content on success.
   */
  @Delete(':providerId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete credential for a provider' })
  @ApiParam({
    name: 'providerId',
    description: 'UUID of the voice_ai_provider row',
  })
  @ApiResponse({ status: 204, description: 'Credential deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Credential not found' })
  async delete(@Param('providerId') providerId: string): Promise<void> {
    await this.credentialsService.delete(providerId);
  }
}
