import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../rbac/guards/platform-admin.guard';
import { EmailTemplateService } from '../services/email-template.service';
import { VariableRegistryService } from '../services/variable-registry.service';
import { TemplateValidatorService } from '../services/template-validator.service';
import { VariableCategory } from '../types/variable-schema.types';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  PreviewEmailTemplateDto,
  EmailTemplateFilterDto,
} from '../dto/email-template.dto';

@ApiTags('Background Jobs - Email Templates')
@ApiBearerAuth()
@Controller('admin/jobs/email-templates')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class EmailTemplatesController {
  constructor(
    private readonly emailTemplateService: EmailTemplateService,
    private readonly variableRegistryService: VariableRegistryService,
    private readonly templateValidatorService: TemplateValidatorService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all email templates with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Email templates retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async listTemplates(@Query() filters: EmailTemplateFilterDto) {
    const templates = await this.emailTemplateService.getAllTemplates({
      search: filters.search,
      is_system: filters.is_system,
    });

    return { data: templates };
  }

  // IMPORTANT: Specific routes MUST come before parameterized routes
  // /variables/* routes must be before /:templateKey

  @Get('variables/registry')
  @ApiOperation({ summary: 'Get all available template variables from registry' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: VariableCategory,
    description: 'Filter variables by category',
  })
  @ApiResponse({ status: 200, description: 'Variable registry retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async getVariables(@Query('category') category?: VariableCategory) {
    if (category) {
      return this.variableRegistryService.getVariablesByCategory(category);
    }
    return this.variableRegistryService.getAllVariables();
  }

  @Get('variables/sample')
  @ApiOperation({ summary: 'Get sample data for specific variables' })
  @ApiQuery({
    name: 'variables',
    required: true,
    type: String,
    description: 'Comma-separated list of variable names',
  })
  @ApiResponse({ status: 200, description: 'Sample data generated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async getVariableSampleData(@Query('variables') variables: string) {
    const variableNames = variables.split(',').map((v) => v.trim());
    return this.variableRegistryService.getSampleData(variableNames);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate template body against variables' })
  @ApiResponse({ status: 200, description: 'Validation result returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async validateTemplate(
    @Body() dto: { html_body: string; text_body?: string; variables: string[] },
  ) {
    return this.templateValidatorService.validateBothTemplates(
      dto.html_body,
      dto.text_body || null,
      dto.variables,
    );
  }

  // Parameterized routes come AFTER specific routes

  @Get(':templateKey')
  @ApiOperation({ summary: 'Get specific email template details' })
  @ApiParam({ name: 'templateKey', description: 'Template Key', type: String })
  @ApiResponse({ status: 200, description: 'Template retrieved' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async getTemplate(@Param('templateKey') templateKey: string) {
    const template = await this.emailTemplateService.getTemplate(templateKey);

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    return template;
  }

  @Post()
  @ApiOperation({ summary: 'Create new email template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  @ApiResponse({ status: 400, description: 'Invalid Handlebars syntax or duplicate key' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async createTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.emailTemplateService.createTemplate(dto);
  }

  @Patch(':templateKey')
  @ApiOperation({ summary: 'Update email template (including system templates)' })
  @ApiParam({ name: 'templateKey', description: 'Template Key', type: String })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiResponse({ status: 400, description: 'Invalid syntax' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async updateTemplate(
    @Req() req: Request,
    @Param('templateKey') templateKey: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    const userId = (req.user as any)?.id;
    return this.emailTemplateService.updateTemplate(templateKey, dto, userId);
  }

  @Delete(':templateKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete email template' })
  @ApiParam({ name: 'templateKey', description: 'Template Key', type: String })
  @ApiResponse({ status: 204, description: 'Template deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete system template' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async deleteTemplate(@Param('templateKey') templateKey: string) {
    await this.emailTemplateService.deleteTemplate(templateKey);
  }

  @Post(':templateKey/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview rendered email template with sample variables' })
  @ApiParam({ name: 'templateKey', description: 'Template Key', type: String })
  @ApiResponse({ status: 200, description: 'Template rendered successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 400, description: 'Template rendering error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async previewTemplate(
    @Param('templateKey') templateKey: string,
    @Body() dto: PreviewEmailTemplateDto,
  ) {
    const template = await this.emailTemplateService.getTemplate(templateKey);

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    try {
      const renderedSubject = this.emailTemplateService.renderTemplate(
        template.subject,
        dto.variables,
      );
      const renderedHtml = this.emailTemplateService.renderTemplate(
        template.html_body,
        dto.variables,
      );
      const renderedText = template.text_body
        ? this.emailTemplateService.renderTemplate(template.text_body, dto.variables)
        : null;

      return {
        subject: renderedSubject,
        html_body: renderedHtml,
        text_body: renderedText,
      };
    } catch (error) {
      throw new BadRequestException(
        `Template rendering failed: ${error.message}`,
      );
    }
  }
}
