import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { TenantSmsConfigService } from '../services/tenant-sms-config.service';
import { CreateTenantSmsConfigDto } from '../dto/sms-config/create-tenant-sms-config.dto';
import { UpdateTenantSmsConfigDto } from '../dto/sms-config/update-tenant-sms-config.dto';
import { TestSmsConfigDto } from '../dto/sms-config/test-sms-config.dto';

/**
 * Tenant SMS Configuration Controller
 *
 * Manages SMS configuration for Twilio integration.
 * Provides endpoints for CRUD operations and connection testing.
 *
 * Security:
 * - All endpoints require authentication (JWT)
 * - RBAC enforced: View (all roles), Edit (Owner/Admin only)
 * - Multi-tenant isolation via tenant_id from JWT
 * - Credentials never exposed in responses
 *
 * RBAC:
 * - View: Owner, Admin, Manager, Sales, Employee
 * - Create/Update/Delete: Owner, Admin only
 * - Test: Owner, Admin only
 */
@ApiTags('Communication - Twilio SMS')
@Controller('communication/twilio/sms-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantSmsConfigController {
  constructor(private readonly smsConfigService: TenantSmsConfigService) {}

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create SMS configuration for tenant',
    description:
      'Create a new SMS configuration with Twilio credentials. Only one active configuration allowed per tenant. Credentials are encrypted before storage and validated against Twilio API.',
  })
  @ApiResponse({
    status: 201,
    description: 'SMS configuration created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        tenant_id: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440001',
        },
        provider_id: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440002',
        },
        from_phone: { type: 'string', example: '+19781234567' },
        is_active: { type: 'boolean', example: true },
        is_verified: { type: 'boolean', example: true },
        created_at: {
          type: 'string',
          example: '2026-02-05T10:00:00.000Z',
        },
        updated_at: {
          type: 'string',
          example: '2026-02-05T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Twilio credentials or phone number format',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example:
            'Invalid Twilio credentials. Please check Account SID and Auth Token.',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Active SMS configuration already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example:
            'Active SMS configuration already exists. Deactivate existing config first.',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  async create(@Request() req, @Body() dto: CreateTenantSmsConfigDto) {
    return this.smsConfigService.create(req.user.tenant_id, dto);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get active SMS configuration',
    description:
      'Retrieve the active SMS configuration for this tenant. Credentials are NOT included in response for security.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active SMS configuration retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'No active SMS configuration found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          example: 'No active SMS configuration found for this tenant',
        },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async findActive(@Request() req) {
    return this.smsConfigService.findByTenantId(req.user.tenant_id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Update SMS configuration',
    description:
      'Update an existing SMS configuration. If credentials are updated, they will be re-validated against Twilio API.',
  })
  @ApiParam({
    name: 'id',
    description: 'SMS configuration UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'SMS configuration updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'SMS configuration not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials if updated',
  })
  async update(
    @Request() req,
    @Param('id') configId: string,
    @Body() dto: UpdateTenantSmsConfigDto,
  ) {
    return this.smsConfigService.update(req.user.tenant_id, configId, dto);
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Deactivate SMS configuration',
    description:
      'Soft delete (deactivate) an SMS configuration. Configuration is not permanently deleted, only marked as inactive.',
  })
  @ApiParam({
    name: 'id',
    description: 'SMS configuration UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'SMS configuration deactivated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'SMS configuration not found',
  })
  async delete(@Request() req, @Param('id') configId: string) {
    return this.smsConfigService.delete(req.user.tenant_id, configId);
  }

  @Post(':id/test')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Test SMS configuration',
    description:
      'Send a test SMS message to verify configuration. Provide a destination phone number to receive the test message. Marks configuration as verified on success.',
  })
  @ApiParam({
    name: 'id',
    description: 'SMS configuration UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Test SMS sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Test SMS sent successfully' },
        twilio_message_sid: {
          type: 'string',
          example: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        from: { type: 'string', example: '+19781234567' },
        to: { type: 'string', example: '+19787654321' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'SMS test failed (invalid credentials, phone number, or Twilio error)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'SMS test failed: Unable to create record',
        },
        error: { type: 'string', example: 'TWILIO_ERROR' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'SMS configuration not found',
  })
  async testConnection(
    @Request() req,
    @Param('id') configId: string,
    @Body() dto: TestSmsConfigDto,
  ) {
    return this.smsConfigService.testConnection(
      req.user.tenant_id,
      configId,
      dto.to_phone,
    );
  }
}
