import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { LiveKitWebhookGuard } from '../guards/livekit-webhook.guard';
import { VoiceAiWebhookService } from '../services/voice-ai-webhook.service';
import type { LiveKitWebhookEvent } from '../interfaces/livekit-webhook.interface';

/**
 * VoiceAiWebhookController — Sprint B14
 *
 * Receives inbound webhook events from LiveKit.
 *
 * Authentication: HMAC-SHA256 signature verification via LiveKitWebhookGuard.
 * No JWT required — route is marked @Public() to bypass the global JwtAuthGuard.
 *
 * Endpoint:
 *   POST /api/v1/webhooks/voice-ai/livekit   (API-031)
 *
 * Signature verification:
 *   LiveKit signs the raw request body with HMAC-SHA256 using the livekit_api_secret
 *   stored in voice_ai_global_config. The computed signature is compared to the
 *   X-LiveKit-Signature header in constant time.
 *
 * LiveKit webhook URL to configure in the LiveKit dashboard:
 *   https://api.lead360.app/api/v1/webhooks/voice-ai/livekit
 *   Events: room_started, room_finished, participant_joined, participant_left
 */
@ApiTags('Voice AI Webhooks')
@Controller('webhooks/voice-ai')
export class VoiceAiWebhookController {
  constructor(
    private readonly webhookService: VoiceAiWebhookService,
  ) {}

  /**
   * API-031: LiveKit webhook event handler.
   *
   * Processes room lifecycle events from LiveKit to provide a server-side
   * safety net when the Python agent crashes mid-call. Returns 200 immediately
   * after dispatching the event to the service.
   *
   * Authentication: X-LiveKit-Signature HMAC-SHA256 (no JWT)
   */
  @Post('livekit')
  @HttpCode(200)
  @Public()
  @UseGuards(LiveKitWebhookGuard)
  @ApiOperation({
    summary: 'LiveKit webhook event handler (API-031)',
    description:
      'Receives LiveKit room lifecycle events. Authenticated via HMAC-SHA256 ' +
      'signature in X-LiveKit-Signature header. No JWT required.',
  })
  @ApiResponse({ status: 200, description: 'Event received and processed' })
  @ApiResponse({ status: 401, description: 'Invalid or missing signature' })
  async handleLiveKitWebhook(
    @Body() event: LiveKitWebhookEvent,
  ): Promise<{ received: boolean }> {
    await this.webhookService.handleEvent(event);
    return { received: true };
  }
}
