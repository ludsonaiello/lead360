import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CallManagementService } from '../services/call-management.service';
import { InitiateCallDto } from '../dto/call/initiate-call.dto';
import { CallHistoryQueryDto } from '../dto/call/call-history-query.dto';

/**
 * Call Management Controller
 *
 * Production-grade call management API for Twilio voice integration.
 *
 * Core Capabilities:
 * - Initiate outbound calls to Leads (user-first bridge pattern)
 * - View call history with pagination
 * - Retrieve call details and recordings
 * - Multi-tenant isolation
 * - RBAC enforcement
 *
 * Call Flow (Outbound):
 * 1. User clicks "Call Lead" in frontend
 * 2. POST /api/v1/communication/twilio/calls/initiate
 * 3. System calls user's phone
 * 4. User answers → system bridges to Lead
 * 5. Call begins with automatic recording
 *
 * Security:
 * - All endpoints require JWT authentication
 * - RBAC: Owner, Admin, Manager, Sales can make calls
 * - Multi-tenant isolation via tenant_id from JWT
 * - Recording URLs are tenant-scoped
 *
 * RBAC:
 * - View calls: Owner, Admin, Manager, Sales
 * - Initiate calls: Owner, Admin, Manager, Sales
 * - Access recordings: Owner, Admin, Manager, Sales
 *
 * Route Registration Order (Critical):
 * - Static routes (call-history) registered FIRST
 * - Dynamic routes (calls/:id) registered AFTER
 * - This prevents route conflicts where :id catches static routes
 */
@ApiTags('Communication - Twilio Calls')
@Controller('communication/twilio')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CallManagementController {
  constructor(private readonly callService: CallManagementService) {}

  /**
   * Get paginated call history
   *
   * GET /api/v1/communication/twilio/call-history
   *
   * Returns:
   * - Call records with Lead and User information
   * - Pagination metadata
   * - Sorted by created_at DESC (newest first)
   *
   * CRITICAL: This static route MUST be registered before dynamic routes
   * to prevent /calls/:id from catching this endpoint.
   *
   * @param req - Express request with authenticated user
   * @param query - Pagination parameters
   * @returns Paginated call history
   */
  @Get('call-history')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Get paginated call history',
    description:
      'Retrieves call history for the tenant with pagination. ' +
      'Results are sorted by creation date (newest first).',
  })
  @ApiResponse({
    status: 200,
    description: 'Call history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tenant_id: { type: 'string' },
              lead_id: { type: 'string', nullable: true },
              twilio_call_sid: { type: 'string' },
              direction: { type: 'string', enum: ['inbound', 'outbound'] },
              from_number: { type: 'string' },
              to_number: { type: 'string' },
              status: {
                type: 'string',
                enum: [
                  'initiated',
                  'ringing',
                  'in_progress',
                  'completed',
                  'failed',
                  'no_answer',
                  'busy',
                  'canceled',
                ],
              },
              call_type: { type: 'string' },
              call_reason: { type: 'string', nullable: true },
              recording_url: { type: 'string', nullable: true },
              recording_duration_seconds: { type: 'number', nullable: true },
              recording_status: { type: 'string' },
              started_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              ended_at: { type: 'string', format: 'date-time', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              lead: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  phone: { type: 'string', nullable: true },
                },
              },
              initiated_by_user: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 156 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 8 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  async getCallHistory(@Request() req, @Query() query: CallHistoryQueryDto) {
    return this.callService.findAll(
      req.user.tenant_id,
      query.page,
      query.limit,
    );
  }

  /**
   * Get unified call history including both IVR and Voice AI calls
   *
   * GET /api/v1/communication/twilio/call-history/unified
   *
   * Returns a merged view of both regular IVR calls and Voice AI calls,
   * sorted by date with a call_type flag ('ivr' | 'voice_ai')
   *
   * @param req - Express request with authenticated user
   * @param query - Pagination parameters
   * @returns Paginated unified call history with call type indicators
   */
  @Get('call-history/unified')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Get unified call history (IVR + Voice AI)',
    description:
      'Returns paginated call history including both regular IVR calls and Voice AI calls. Each call includes a call_type field to distinguish between "ivr" and "voice_ai" calls.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unified call history retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            call_type: 'voice_ai',
            call_sid: 'CAxxxxx',
            from_number: '+1234567890',
            to_number: '+0987654321',
            direction: 'inbound',
            status: 'completed',
            outcome: 'answered',
            duration_seconds: 120,
            recording_url: 'https://...',
            recording_status: 'available',
            created_at: '2024-01-01T00:00:00Z',
            ended_at: '2024-01-01T00:02:00Z',
            lead: { id: 'uuid', first_name: 'John', last_name: 'Doe' },
            transcription: { transcription_text: '...' },
          },
        ],
        meta: {
          total: 150,
          page: 1,
          limit: 20,
          totalPages: 8,
          ivr_count: 100,
          voice_ai_count: 50,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  async getUnifiedCallHistory(
    @Request() req,
    @Query() query: CallHistoryQueryDto,
  ) {
    return this.callService.findAllUnified(
      req.user.tenant_id,
      query.page,
      query.limit,
    );
  }

  /**
   * Initiate outbound call to Lead
   *
   * POST /api/v1/communication/twilio/calls/initiate
   *
   * Process:
   * 1. Validates Lead exists and has phone number
   * 2. Retrieves tenant's Twilio configuration
   * 3. Initiates call to user's phone
   * 4. When user answers, bridges to Lead
   *
   * @param req - Express request with authenticated user
   * @param dto - Call initiation parameters
   * @returns Call initiation result with tracking IDs
   */
  @Post('calls/initiate')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Initiate outbound call to Lead',
    description:
      'Initiates a call to the specified Lead. The system will call your phone first, ' +
      'and when you answer, it will bridge the call to the Lead. This prevents the Lead ' +
      'from receiving a robocall-like experience.',
  })
  @ApiResponse({
    status: 201,
    description: 'Call initiated successfully. Your phone will ring shortly.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        call_record_id: {
          type: 'string',
          example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
        twilio_call_sid: {
          type: 'string',
          example: 'CA1234567890abcdef1234567890abcdef',
        },
        message: {
          type: 'string',
          example: 'Calling your phone. Please answer to connect to the Lead.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (invalid data or Lead has no phone)',
  })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  async initiateCall(@Request() req, @Body() dto: InitiateCallDto) {
    return this.callService.initiateOutboundCall(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  /**
   * Get call details by ID
   *
   * GET /api/v1/communication/twilio/calls/:id
   *
   * Returns detailed information about a specific call including:
   * - Full call record data
   * - Associated Lead information
   * - User who initiated the call (if outbound)
   * - Recording availability
   *
   * @param req - Express request with authenticated user
   * @param callId - CallRecord UUID
   * @returns Call details
   */
  @Get('calls/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Get call details by ID',
    description: 'Retrieves detailed information about a specific call record.',
  })
  @ApiParam({
    name: 'id',
    description: 'CallRecord UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Call details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Call record not found' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  async getCall(@Request() req, @Param('id') callId: string) {
    return this.callService.findOne(req.user.tenant_id, callId);
  }

  /**
   * Get recording URL for playback
   *
   * GET /api/v1/communication/twilio/calls/:id/recording
   *
   * Returns:
   * - Recording URL (currently public, future: signed URL with expiration)
   * - Recording duration in seconds
   * - Transcription availability status
   *
   * @param req - Express request with authenticated user
   * @param callId - CallRecord UUID
   * @returns Recording metadata and URL
   */
  @Get('calls/:id/recording')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Get recording URL for call playback',
    description:
      'Retrieves the recording URL for a specific call. ' +
      'The URL currently points to a public file, but will be upgraded to ' +
      'time-limited signed URLs for enhanced security.',
  })
  @ApiParam({
    name: 'id',
    description: 'CallRecord UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Recording URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          example:
            'https://tenant.lead360.app/uploads/public/tenant-id/communication/recordings/2026/01/call-id.mp3',
        },
        duration_seconds: { type: 'number', example: 127 },
        transcription_available: { type: 'boolean', example: true },
        transcription: {
          type: 'object',
          nullable: true,
          properties: {
            transcription_text: {
              type: 'string',
              example: 'Full transcription text here...',
            },
            language_detected: { type: 'string', example: 'en' },
            confidence_score: { type: 'number', example: 0.95 },
            transcription_provider: {
              type: 'string',
              example: 'openai_whisper',
            },
            status: { type: 'string', example: 'completed' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Call record not found or recording not available',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  async getRecordingUrl(@Request() req, @Param('id') callId: string) {
    return this.callService.getRecordingUrl(req.user.tenant_id, callId);
  }

  /**
   * Get transcription for a call
   *
   * GET /api/v1/communication/twilio/calls/:id/transcription
   *
   * Returns:
   * - Transcription text
   * - Language detected
   * - Confidence score
   * - Provider used
   *
   * @param req - Express request with authenticated user
   * @param callId - CallRecord UUID
   * @returns Transcription data
   */
  @Get('calls/:id/transcription')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Get transcription for call',
    description:
      'Retrieves the transcription data for a specific call if available.',
  })
  @ApiParam({
    name: 'id',
    description: 'CallRecord UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        transcription_text: { type: 'string' },
        language_detected: { type: 'string', example: 'en' },
        confidence_score: { type: 'number', example: 0.95 },
        transcription_provider: { type: 'string', example: 'openai_whisper' },
        status: { type: 'string', example: 'completed' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Call record not found or transcription not available',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  async getTranscription(@Request() req, @Param('id') callId: string) {
    return this.callService.getTranscription(req.user.tenant_id, callId);
  }
}
