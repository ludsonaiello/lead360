import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SmsTemplateService } from '../services/sms-template.service';
import { CreateSmsTemplateDto } from '../dto/template/create-sms-template.dto';
import { UpdateSmsTemplateDto } from '../dto/template/update-sms-template.dto';

/**
 * SMS Templates Controller
 *
 * Manages SMS templates for reusable messages with merge field support.
 *
 * All endpoints require authentication and RBAC permissions.
 * Multi-tenant isolation enforced via tenant_id from JWT token.
 *
 * Base path: /api/v1/communication/sms/templates
 */
@ApiTags('Communication - SMS Templates')
@ApiBearerAuth()
@Controller('communication/sms/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SmsTemplateController {
  constructor(private readonly smsTemplateService: SmsTemplateService) {}

  /**
   * Create new SMS template
   *
   * Allows creating reusable SMS templates with merge fields.
   * Templates can be categorized and marked as default.
   *
   * Merge fields supported:
   * - Lead: {lead.first_name}, {lead.last_name}, {lead.phone}, {lead.email}, {lead.address}
   * - Tenant: {tenant.company_name}, {tenant.phone}, {tenant.address}
   * - User: {user.first_name}, {user.last_name}, {user.phone}, {user.email}
   * - Date/Time: {today}, {time}
   * - Custom: {custom.field_name}
   */
  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create SMS template',
    description:
      'Create a new SMS template with merge field support. Templates can include dynamic fields like {lead.first_name}, {tenant.company_name}, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Template created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async create(
    @Request() req,
    @Body() createDto: CreateSmsTemplateDto,
  ): Promise<any> {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    return this.smsTemplateService.create(tenantId, userId, createDto);
  }

  /**
   * List all SMS templates
   *
   * Returns all active templates for the tenant.
   * Optionally filter by category.
   */
  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'List SMS templates',
    description:
      'Get all active SMS templates for the organization. Optionally filter by category.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description:
      'Filter by category (e.g., "quote", "appointment", "follow_up")',
    example: 'quote',
  })
  @ApiResponse({
    status: 200,
    description: 'List of templates',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
  })
  async findAll(
    @Request() req,
    @Query('category') category?: string,
  ): Promise<any[]> {
    const tenantId = req.user.tenantId;

    return this.smsTemplateService.findAll(tenantId, category);
  }

  /**
   * Get template by ID
   */
  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Get SMS template',
    description: 'Get a specific SMS template by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Template UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Template data',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async findOne(@Request() req, @Param('id') id: string): Promise<any> {
    const tenantId = req.user.tenantId;

    return this.smsTemplateService.findOne(id, tenantId);
  }

  /**
   * Update template
   */
  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Update SMS template',
    description:
      'Update an existing SMS template. All fields are optional - only provided fields will be updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Template UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Template updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateSmsTemplateDto,
  ): Promise<any> {
    const tenantId = req.user.tenantId;

    return this.smsTemplateService.update(id, tenantId, updateDto);
  }

  /**
   * Delete template (soft delete)
   */
  @Delete(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Delete SMS template',
    description:
      'Soft delete an SMS template (sets is_active = false). Template will no longer appear in listings but data is preserved.',
  })
  @ApiParam({
    name: 'id',
    description: 'Template UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Template deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async delete(@Request() req, @Param('id') id: string): Promise<any> {
    const tenantId = req.user.tenantId;

    return this.smsTemplateService.delete(id, tenantId);
  }

  /**
   * Get template statistics
   */
  @Get(':id/stats')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get template statistics',
    description: 'Get usage statistics for a specific template',
  })
  @ApiParam({
    name: 'id',
    description: 'Template UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Template statistics',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async getStats(@Request() req, @Param('id') id: string): Promise<any> {
    const tenantId = req.user.tenantId;

    return this.smsTemplateService.getTemplateStats(id, tenantId);
  }
}
