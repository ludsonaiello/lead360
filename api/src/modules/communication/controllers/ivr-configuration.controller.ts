import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../modules/auth/guards/roles.guard';
import { Roles } from '../../../modules/auth/decorators/roles.decorator';
import { IvrConfigurationService } from '../services/ivr-configuration.service';
import {
  CreateIvrConfigDto,
  UpdateIvrConfigDto,
} from '../dto/ivr/create-ivr-config.dto';

/**
 * IvrConfigurationController
 *
 * REST API for managing Interactive Voice Response (IVR) configurations.
 *
 * Endpoints:
 * - POST   /communication/twilio/ivr   Create/update IVR config
 * - GET    /communication/twilio/ivr   Get current IVR config
 * - DELETE /communication/twilio/ivr   Disable IVR config
 *
 * Access Control:
 * - Create/Update/Delete: Owner, Admin only
 * - Read: Owner, Admin, Manager
 *
 * Security:
 * - JWT authentication required (via JwtAuthGuard)
 * - Role-based authorization (via RolesGuard)
 * - Tenant isolation enforced (tenantId from JWT token)
 * - All inputs validated via DTOs
 *
 * Best Practices:
 * - Upsert pattern for create/update (idempotent)
 * - Soft delete for audit trail
 * - Comprehensive API documentation (Swagger)
 * - Proper HTTP status codes
 *
 * @see IvrConfigurationService
 */
@ApiTags('Communication - Twilio IVR')
@Controller('communication/twilio/ivr')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IvrConfigurationController {
  constructor(private readonly ivrService: IvrConfigurationService) {}

  /**
   * Create or update IVR configuration
   *
   * Uses upsert pattern - if configuration exists, it will be updated.
   * This simplifies client logic and prevents race conditions.
   *
   * Validation:
   * - Menu options: 1-10 items, unique digits, valid actions
   * - Phone numbers: E.164 format
   * - Webhook URLs: HTTPS only
   * - Timeout: 5-60 seconds
   * - Max retries: 1-5
   *
   * Access: Owner, Admin only
   *
   * @param req - Express request (contains user with tenant_id)
   * @param dto - IVR configuration data
   * @returns Created or updated IVR configuration
   */
  @Post()
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or update IVR configuration',
    description:
      'Creates or updates IVR configuration for the tenant. Uses upsert pattern - if configuration exists, it will be updated. Only accessible by Owner or Admin roles.',
  })
  @ApiBody({ type: CreateIvrConfigDto })
  @ApiResponse({
    status: 201,
    description: 'IVR configuration created or updated successfully',
    schema: {
      example: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        tenant_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        ivr_enabled: true,
        greeting_message: 'Thank you for calling ABC Company.',
        menu_options: [
          {
            digit: '1',
            action: 'route_to_number',
            label: 'Sales Department',
            config: { phone_number: '+19781234567' },
          },
          {
            digit: '2',
            action: 'voicemail',
            label: 'Leave a message',
            config: { max_duration_seconds: 180 },
          },
        ],
        default_action: {
          action: 'voicemail',
          config: { max_duration_seconds: 180 },
        },
        timeout_seconds: 10,
        max_retries: 3,
        status: 'active',
        created_at: '2026-01-15T10:30:00.000Z',
        updated_at: '2026-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input (validation failed)',
    schema: {
      example: {
        statusCode: 400,
        message: 'Duplicate digits found: 1. Each digit must be unique.',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT token)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createOrUpdate(@Request() req, @Body() dto: CreateIvrConfigDto) {
    return this.ivrService.createOrUpdate(req.user.tenant_id, dto);
  }

  /**
   * Get IVR configuration
   *
   * Returns current IVR configuration for the tenant.
   *
   * Access: Owner, Admin, Manager
   *
   * @param req - Express request (contains user with tenant_id)
   * @returns Current IVR configuration
   */
  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get IVR configuration',
    description:
      'Retrieves the current IVR configuration for the tenant. Accessible by Owner, Admin, or Manager roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'IVR configuration retrieved successfully',
    schema: {
      example: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        tenant_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        ivr_enabled: true,
        greeting_message: 'Thank you for calling ABC Company.',
        menu_options: [
          {
            digit: '1',
            action: 'route_to_number',
            label: 'Sales Department',
            config: { phone_number: '+19781234567' },
          },
        ],
        default_action: {
          action: 'voicemail',
          config: { max_duration_seconds: 180 },
        },
        timeout_seconds: 10,
        max_retries: 3,
        status: 'active',
        created_at: '2026-01-15T10:30:00.000Z',
        updated_at: '2026-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT token)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  @ApiResponse({
    status: 404,
    description: 'IVR configuration not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'IVR configuration not found for this tenant',
        error: 'Not Found',
      },
    },
  })
  async findOne(@Request() req) {
    return this.ivrService.findByTenantId(req.user.tenant_id);
  }

  /**
   * Disable IVR configuration
   *
   * Soft deletes the IVR configuration (sets ivr_enabled = false, status = 'inactive').
   * Does not physically delete data for audit trail purposes.
   *
   * Access: Owner, Admin only
   *
   * @param req - Express request (contains user with tenant_id)
   * @returns Updated configuration with ivr_enabled = false
   */
  @Delete()
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disable IVR configuration',
    description:
      'Disables the IVR configuration (soft delete). Sets ivr_enabled to false and status to inactive. Data is retained for audit purposes. Only accessible by Owner or Admin roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'IVR configuration disabled successfully',
    schema: {
      example: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        tenant_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        ivr_enabled: false,
        greeting_message: 'Thank you for calling ABC Company.',
        menu_options: [],
        default_action: {},
        timeout_seconds: 10,
        max_retries: 3,
        status: 'inactive',
        created_at: '2026-01-15T10:30:00.000Z',
        updated_at: '2026-01-15T11:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT token)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  @ApiResponse({
    status: 404,
    description: 'IVR configuration not found',
  })
  async delete(@Request() req) {
    return this.ivrService.delete(req.user.tenant_id);
  }
}
