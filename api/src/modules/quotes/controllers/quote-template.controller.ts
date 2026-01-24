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
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuoteTemplateService } from '../services/quote-template.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  ListTemplatesDto,
} from '../dto/template';

// ========== ADMIN CONTROLLER (Template Management) ==========

@ApiTags('Quotes - Templates (Admin)')
@ApiBearerAuth()
@Controller('admin/quotes/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteTemplateAdminController {
  private readonly logger = new Logger(QuoteTemplateAdminController.name);

  constructor(private readonly templateService: QuoteTemplateService) {}

  @Post()
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Create template (admin only)',
    description: 'Create global or tenant-specific template',
  })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(@Request() req, @Body() createTemplateDto: CreateTemplateDto) {
    return this.templateService.createTemplate(req.user.id, createTemplateDto);
  }

  @Get()
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Get all templates (admin only)',
    description: 'View all templates with usage statistics',
  })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async findAllAdmin(@Query() listTemplatesDto: ListTemplatesDto) {
    return this.templateService.findAllAdmin(listTemplatesDto);
  }

  @Get(':id')
  @Roles('Platform Admin')
  @ApiOperation({ summary: 'Get template details (admin only)' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOneAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.findOneAdmin(id);
  }

  @Patch(':id')
  @Roles('Platform Admin')
  @ApiOperation({ summary: 'Update template (admin only)' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateTemplate(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templateService.updateTemplate(id, req.user.id, updateTemplateDto);
  }

  @Delete(':id')
  @Roles('Platform Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template (admin only)',
    description: 'Cannot delete if template is in use or is default',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 204, description: 'Template deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete template (in use or is default)' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async deleteTemplate(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.deleteTemplate(id, req.user.id);
  }

  @Post(':id/clone')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Clone template (admin only)',
    description: 'Create a copy of existing template',
  })
  @ApiParam({ name: 'id', description: 'Template UUID to clone' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        new_name: { type: 'string', example: 'Modern Professional Quote V2' },
      },
    },
    required: false,
  })
  @ApiResponse({ status: 201, description: 'Template cloned successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async cloneTemplate(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('new_name') newName?: string,
  ) {
    return this.templateService.cloneTemplate(id, req.user.id, newName);
  }

  @Patch(':id/set-default')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Set template as platform default (admin only)',
    description: 'Only global templates can be set as platform default',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template set as default successfully' })
  @ApiResponse({ status: 403, description: 'Only global templates can be set as default' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async setDefaultTemplate(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templateService.setDefaultTemplate(id, req.user.id);
  }

  @Get('variables/schema')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Get template variables schema',
    description: 'Returns complete Handlebars variable schema for template development',
  })
  @ApiResponse({ status: 200, description: 'Variable schema retrieved successfully' })
  async getTemplateVariables() {
    return this.templateService.getTemplateVariables();
  }
}

// ========== TENANT CONTROLLER (Template Selection) ==========

@ApiTags('Quotes - Templates')
@ApiBearerAuth()
@Controller('quotes/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteTemplateController {
  private readonly logger = new Logger(QuoteTemplateController.name);

  constructor(private readonly templateService: QuoteTemplateService) {}

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get available templates',
    description: 'Returns global templates plus tenant-specific templates',
  })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async findAll(@Request() req, @Query() listTemplatesDto: ListTemplatesDto) {
    return this.templateService.findAllForTenant(req.user.tenant_id, listTemplatesDto);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get template details' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templateService.findOne(req.user.tenant_id, id);
  }

  @Patch('active')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Set active template for tenant',
    description: 'Select which template to use for new quotes',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716' },
      },
      required: ['template_id'],
    },
  })
  @ApiResponse({ status: 200, description: 'Active template updated successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async setActiveTemplate(
    @Request() req,
    @Body('template_id') templateId: string,
  ) {
    return this.templateService.setTenantActiveTemplate(
      req.user.tenant_id,
      req.user.id,
      templateId,
    );
  }
}
