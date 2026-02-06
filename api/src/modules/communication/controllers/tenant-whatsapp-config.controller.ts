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
import { TenantWhatsAppConfigService } from '../services/tenant-whatsapp-config.service';
import { CreateTenantWhatsAppConfigDto } from '../dto/whatsapp-config/create-tenant-whatsapp-config.dto';
import { UpdateTenantWhatsAppConfigDto } from '../dto/whatsapp-config/update-tenant-whatsapp-config.dto';

/**
 * Tenant WhatsApp Configuration Controller
 *
 * Manages WhatsApp configuration for Twilio integration.
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
 *
 * WhatsApp-Specific Notes:
 * - Requires approved WhatsApp Business Account with Twilio
 * - Phone numbers automatically prefixed with 'whatsapp:'
 * - First messages to new contacts may require template approval
 */
@ApiTags('Communication - Twilio WhatsApp')
@Controller('communication/twilio/whatsapp-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantWhatsAppConfigController {
  constructor(
    private readonly whatsappConfigService: TenantWhatsAppConfigService,
  ) {}

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create WhatsApp configuration for tenant',
    description:
      'Create a new WhatsApp configuration with Twilio credentials. Only one active configuration allowed per tenant. Credentials are encrypted before storage and validated against Twilio API. Requires approved WhatsApp Business Account.',
  })
  @ApiResponse({
    status: 201,
    description: 'WhatsApp configuration created successfully',
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
        from_phone: { type: 'string', example: 'whatsapp:+19781234567' },
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
    description: 'Active WhatsApp configuration already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example:
            'Active WhatsApp configuration already exists. Deactivate existing config first.',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  async create(@Request() req, @Body() dto: CreateTenantWhatsAppConfigDto) {
    return this.whatsappConfigService.create(req.user.tenant_id, dto);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get active WhatsApp configuration',
    description:
      'Retrieve the active WhatsApp configuration for this tenant. Credentials are NOT included in response for security.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active WhatsApp configuration retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'No active WhatsApp configuration found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          example: 'No active WhatsApp configuration found for this tenant',
        },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async findActive(@Request() req) {
    return this.whatsappConfigService.findByTenantId(req.user.tenant_id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Update WhatsApp configuration',
    description:
      'Update an existing WhatsApp configuration. If credentials are updated, they will be re-validated against Twilio API.',
  })
  @ApiParam({
    name: 'id',
    description: 'WhatsApp configuration UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp configuration updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'WhatsApp configuration not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials if updated',
  })
  async update(
    @Request() req,
    @Param('id') configId: string,
    @Body() dto: UpdateTenantWhatsAppConfigDto,
  ) {
    return this.whatsappConfigService.update(req.user.tenant_id, configId, dto);
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Deactivate WhatsApp configuration',
    description:
      'Soft delete (deactivate) a WhatsApp configuration. Configuration is not permanently deleted, only marked as inactive.',
  })
  @ApiParam({
    name: 'id',
    description: 'WhatsApp configuration UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp configuration deactivated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'WhatsApp configuration not found',
  })
  async delete(@Request() req, @Param('id') configId: string) {
    return this.whatsappConfigService.delete(req.user.tenant_id, configId);
  }

  @Post(':id/test')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Test WhatsApp configuration',
    description:
      'Send a test WhatsApp message to verify configuration. Message is sent to the configured phone number (self-test). Marks configuration as verified on success. Note: First message to a new contact may require template approval.',
  })
  @ApiParam({
    name: 'id',
    description: 'WhatsApp configuration UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Test WhatsApp message sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Test WhatsApp message sent successfully',
        },
        twilio_message_sid: {
          type: 'string',
          example: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        from: { type: 'string', example: 'whatsapp:+19781234567' },
        to: { type: 'string', example: 'whatsapp:+19781234567' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'WhatsApp test failed (invalid credentials or Twilio error)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'WhatsApp test failed: Unable to create record',
        },
        error: { type: 'string', example: 'TWILIO_ERROR' },
        hint: {
          type: 'string',
          example:
            'Ensure your Twilio WhatsApp Business Account is approved and the phone number is configured correctly.',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'WhatsApp configuration not found',
  })
  async testConnection(@Request() req, @Param('id') configId: string) {
    return this.whatsappConfigService.testConnection(
      req.user.tenant_id,
      configId,
    );
  }
}
