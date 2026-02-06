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
  ParseUUIDPipe,
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
import { EmailTemplatesService } from '../services/email-templates.service';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  PreviewTemplateDto,
  ValidateTemplateDto,
  ListTemplatesDto,
} from '../dto/template.dto';

/**
 * Email Templates Controller
 *
 * Manage email templates for both system (admin) and tenant-specific templates.
 * Supports Handlebars templating with variable substitution.
 *
 * RBAC: View (all roles), Edit (Owner, Admin only)
 */
@ApiTags('Communication - Email Templates')
@Controller('communication/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmailTemplatesController {
  constructor(private readonly templatesService: EmailTemplatesService) {}

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'List email templates',
    description:
      'Get all templates (system templates + tenant-specific templates)',
  })
  @ApiResponse({
    status: 200,
    description: 'Templates retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'template-001' },
              template_key: { type: 'string', example: 'lead-created' },
              template_name: { type: 'string', example: 'Lead Created' },
              category: {
                type: 'string',
                enum: ['system', 'transactional', 'marketing', 'notification'],
                example: 'transactional',
              },
              subject_template: {
                type: 'string',
                example: 'New Lead: {{lead_name}}',
              },
              is_system: { type: 'boolean', example: false },
              is_active: { type: 'boolean', example: true },
              created_at: {
                type: 'string',
                example: '2026-01-18T00:00:00.000Z',
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            total: { type: 'number', example: 15 },
            total_pages: { type: 'number', example: 1 },
          },
        },
      },
    },
  })
  async findAll(@Request() req, @Query() dto: ListTemplatesDto) {
    return this.templatesService.findAll(
      req.user.tenant_id,
      dto,
      req.user.is_platform_admin,
    );
  }

  @Get('variables/registry')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get available template variables',
    description:
      'List all available Handlebars variables that can be used in templates',
  })
  @ApiResponse({
    status: 200,
    description: 'Variable registry retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        lead: {
          type: 'object',
          properties: {
            lead_name: { type: 'string', description: 'Lead full name' },
            first_name: { type: 'string', description: 'Lead first name' },
            last_name: { type: 'string', description: 'Lead last name' },
            email: { type: 'string', description: 'Primary email' },
            phone: { type: 'string', description: 'Primary phone' },
            status: { type: 'string', description: 'Lead status' },
          },
        },
        tenant: {
          type: 'object',
          properties: {
            business_name: { type: 'string', description: 'Business name' },
            website: { type: 'string', description: 'Business website' },
            phone: { type: 'string', description: 'Business phone' },
          },
        },
        user: {
          type: 'object',
          properties: {
            user_name: { type: 'string', description: 'User full name' },
            user_email: { type: 'string', description: 'User email' },
          },
        },
      },
    },
  })
  async getVariableRegistry() {
    return this.templatesService.getVariableRegistry();
  }

  @Get(':key')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get template by key',
    description: 'Get single template with full content',
  })
  @ApiParam({
    name: 'key',
    description: 'Template key (e.g., lead-created)',
  })
  @ApiResponse({
    status: 200,
    description: 'Template retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        template_key: { type: 'string' },
        template_name: { type: 'string' },
        category: { type: 'string' },
        subject_template: { type: 'string' },
        html_body_template: { type: 'string' },
        text_body_template: { type: 'string' },
        is_system: { type: 'boolean' },
        is_active: { type: 'boolean' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(@Request() req, @Param('key') key: string) {
    return this.templatesService.findOne(req.user.tenant_id, key);
  }

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create new email template',
    description: 'Create tenant-specific email template with Handlebars syntax',
  })
  @ApiResponse({
    status: 201,
    description: 'Template created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Handlebars syntax or validation error',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (Owner, Admin only)',
  })
  @ApiResponse({
    status: 409,
    description: 'Template key already exists',
  })
  async create(@Request() req, @Body() dto: CreateEmailTemplateDto) {
    return this.templatesService.create(
      req.user.tenant_id,
      dto,
      req.user.id,
      req.user.is_platform_admin,
    );
  }

  @Patch(':key')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Update email template',
    description:
      'Update tenant-specific template. Platform admins can edit system templates.',
  })
  @ApiParam({
    name: 'key',
    description: 'Template key',
  })
  @ApiResponse({
    status: 200,
    description: 'Template updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Handlebars syntax or validation error',
  })
  @ApiResponse({
    status: 403,
    description:
      'Tenant users cannot update system templates or insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async update(
    @Request() req,
    @Param('key') key: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.templatesService.update(
      req.user.tenant_id,
      key,
      dto,
      req.user.id,
      req.user.is_platform_admin,
    );
  }

  @Delete(':key')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete email template',
    description:
      'Delete tenant-specific template. Platform admins can delete system templates.',
  })
  @ApiParam({
    name: 'key',
    description: 'Template key',
  })
  @ApiResponse({
    status: 204,
    description: 'Template deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description:
      'Tenant users cannot delete system templates or insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async delete(@Request() req, @Param('key') key: string) {
    await this.templatesService.delete(
      req.user.tenant_id,
      key,
      req.user.id,
      req.user.is_platform_admin,
    );
  }

  @Post('validate')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Validate Handlebars template syntax',
    description: 'Validate template syntax without saving',
  })
  @ApiResponse({
    status: 200,
    description: 'Template is valid',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        variables_used: {
          type: 'array',
          items: { type: 'string' },
          example: ['lead_name', 'user_name'],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Template syntax error',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: false },
        errors: {
          type: 'array',
          items: { type: 'string' },
          example: ['Unclosed tag at line 5'],
        },
      },
    },
  })
  async validate(@Body() dto: ValidateTemplateDto) {
    return this.templatesService.validateTemplate(dto);
  }

  @Post(':key/preview')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Preview template with sample data',
    description: 'Render template with provided variables for preview',
  })
  @ApiParam({
    name: 'key',
    description: 'Template key',
  })
  @ApiResponse({
    status: 200,
    description: 'Template previewed successfully',
    schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', example: 'New Lead: John Doe' },
        html_body: { type: 'string', example: '<p>Hello John Doe...</p>' },
        text_body: { type: 'string', example: 'Hello John Doe...' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async preview(
    @Request() req,
    @Param('key') key: string,
    @Body() dto: PreviewTemplateDto,
  ) {
    return this.templatesService.preview(req.user.tenant_id, dto);
  }

  @Post(':key/clone')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Clone a shared template to tenant',
    description:
      'Create a copy of a shared template as a tenant-specific template that can be customized',
  })
  @ApiParam({
    name: 'key',
    description: 'Template key of the shared template to clone',
  })
  @ApiResponse({
    status: 201,
    description: 'Template cloned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Shared template not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Template key already exists for this tenant',
  })
  async cloneTemplate(
    @Request() req,
    @Param('key') key: string,
    @Body() dto: { new_template_key?: string },
  ) {
    return this.templatesService.cloneTemplate(
      req.user.tenant_id,
      key,
      dto.new_template_key,
      req.user.id,
    );
  }
}
