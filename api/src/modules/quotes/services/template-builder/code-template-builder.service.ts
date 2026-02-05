import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { TemplateValidatorService } from './template-validator.service';
import { AuditLoggerService } from '../../../audit/services/audit-logger.service';
import { randomUUID } from 'crypto';
import Handlebars from 'handlebars';

interface CreateCodeTemplateDto {
  name: string;
  description?: string;
  html_content: string;
  css_content?: string;
  category_id?: string;
  tags?: string[];
  thumbnail_url?: string;
  is_global?: boolean;
  is_default?: boolean;
  tenant_id?: string;
}

interface UpdateCodeTemplateDto {
  html_content?: string;
  css_content?: string;
  changes_summary?: string;
}

interface ValidateHandlebarsDto {
  html_content: string;
  css_content?: string;
}

@Injectable()
export class CodeTemplateBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TemplateValidatorService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create new code-based template
   */
  async createCodeTemplate(userId: string, dto: CreateCodeTemplateDto): Promise<any> {
    // Validate Handlebars code
    const validation = await this.validator.validateHandlebarsCode(
      dto.html_content,
      dto.css_content,
    );

    if (!validation.is_valid) {
      throw new BadRequestException({
        message: 'Template validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // If setting as default, unset other defaults
    if (dto.is_default) {
      if (dto.is_global) {
        await this.prisma.quote_template.updateMany({
          where: { tenant_id: { equals: null }, is_default: true },
          data: { is_default: false },
        });
      } else if (dto.tenant_id) {
        await this.prisma.quote_template.updateMany({
          where: { tenant_id: dto.tenant_id, is_default: true },
          data: { is_default: false },
        });
      }
    }

    const templateId = randomUUID();

    // Create template
    const template = await this.prisma.quote_template.create({
      data: {
        id: templateId,
        tenant_id: dto.tenant_id || null,
        name: dto.name,
        description: dto.description,
        template_type: 'code',
        html_content: dto.html_content,
        css_content: dto.css_content,
        category_id: dto.category_id,
        tags: dto.tags || [],
        thumbnail_url: dto.thumbnail_url,
        is_global: dto.is_global ?? false,
        is_default: dto.is_default ?? false,
        is_prebuilt: false,
        created_by_user_id: userId,
      },
    });

    // Create initial version
    await this.createVersion(templateId, dto.html_content, dto.css_content ?? null, userId, 'Initial version');

    // Audit log
    if (dto.tenant_id) {
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote_template',
        entityId: template.id,
        tenantId: dto.tenant_id,
        actorUserId: userId,
        after: template,
        description: `Code template created: ${template.name}`,
      });
    }

    return {
      ...template,
      validation_warnings: validation.warnings,
    };
  }

  /**
   * Update template code (HTML/CSS)
   */
  async updateTemplateCode(
    templateId: string,
    userId: string,
    dto: UpdateCodeTemplateDto,
  ): Promise<any> {
    // Get existing template
    const existing = await this.prisma.quote_template.findUnique({
      where: { id: templateId },
    });

    if (!existing) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    if (existing.template_type !== 'code') {
      throw new BadRequestException(
        'This endpoint is for code templates only. Use visual template endpoints for visual templates.',
      );
    }

    // Validate new code
    const html = dto.html_content || existing.html_content || '';
    const css = dto.css_content !== undefined ? dto.css_content : existing.css_content;

    const validation = await this.validator.validateHandlebarsCode(html, css ?? undefined);

    if (!validation.is_valid) {
      throw new BadRequestException({
        message: 'Template validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // Update template
    const updated = await this.prisma.quote_template.update({
      where: { id: templateId },
      data: {
        html_content: html,
        css_content: css,
        updated_at: new Date(),
      },
    });

    // Create new version
    const latestVersion = await this.prisma.quote_template_version.findFirst({
      where: { template_id: templateId },
      orderBy: { version_number: 'desc' },
    });

    const newVersionNumber = (latestVersion?.version_number || 0) + 1;

    await this.createVersion(
      templateId,
      html || '',
      css ?? null,
      userId,
      dto.changes_summary || `Version ${newVersionNumber}`,
      newVersionNumber,
    );

    // Audit log
    if (existing.tenant_id) {
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'quote_template',
        entityId: templateId,
        tenantId: existing.tenant_id,
        actorUserId: userId,
        before: existing,
        after: updated,
        description: `Code template updated: ${existing.name} (v${newVersionNumber})`,
      });
    }

    return {
      ...updated,
      version_number: newVersionNumber,
      validation_warnings: validation.warnings,
    };
  }

  /**
   * Validate Handlebars syntax
   */
  async validateHandlebars(dto: ValidateHandlebarsDto): Promise<any> {
    const validation = await this.validator.validateHandlebarsCode(
      dto.html_content,
      dto.css_content,
    );

    return {
      is_valid: validation.is_valid,
      syntax_errors: validation.errors.filter(e => e.type === 'syntax'),
      security_errors: validation.errors.filter(e => e.type === 'security'),
      structure_errors: validation.errors.filter(e => e.type === 'structure'),
      warnings: validation.warnings,
      variables_used: this.validator.extractVariables(dto.html_content),
      helpers_used: this.extractHelpers(dto.html_content),
    };
  }

  /**
   * Extract Handlebars variables from template
   */
  async extractVariables(html: string): Promise<string[]> {
    return this.validator.extractVariables(html);
  }

  /**
   * Get variable suggestions (available data schema)
   */
  async getVariableSuggestions() {
    // Define the complete quote data schema available in templates
    return {
      variables: [
        // Quote fields
        { path: 'quote.quote_number', type: 'string', description: 'Quote number', example: 'Q-0001' },
        { path: 'quote.title', type: 'string', description: 'Quote title', example: 'Kitchen Renovation' },
        { path: 'quote.status', type: 'string', description: 'Quote status', example: 'sent' },
        { path: 'quote.subtotal', type: 'number', description: 'Quote subtotal', example: 5000.00 },
        { path: 'quote.tax_amount', type: 'number', description: 'Tax amount', example: 500.00 },
        { path: 'quote.discount_amount', type: 'number', description: 'Discount amount', example: 250.00 },
        { path: 'quote.total', type: 'number', description: 'Quote total', example: 5250.00 },
        { path: 'quote.expires_at', type: 'date', description: 'Expiration date', example: '2026-03-01' },
        { path: 'quote.custom_terms', type: 'string', description: 'Custom terms', example: 'Payment due within 30 days' },

        // Customer/Lead fields
        { path: 'quote.lead.full_name', type: 'string', description: 'Customer full name', example: 'John Smith' },
        { path: 'quote.lead.email', type: 'string', description: 'Customer email', example: 'john@example.com' },
        { path: 'quote.lead.phone', type: 'string', description: 'Customer phone', example: '(555) 123-4567' },
        { path: 'quote.lead.company_name', type: 'string', description: 'Customer company', example: 'Smith Corp' },

        // Jobsite address
        { path: 'quote.jobsite_address.line1', type: 'string', description: 'Address line 1', example: '123 Main St' },
        { path: 'quote.jobsite_address.line2', type: 'string', description: 'Address line 2', example: 'Suite 200' },
        { path: 'quote.jobsite_address.city', type: 'string', description: 'City', example: 'Springfield' },
        { path: 'quote.jobsite_address.state', type: 'string', description: 'State', example: 'IL' },
        { path: 'quote.jobsite_address.zip_code', type: 'string', description: 'ZIP code', example: '62701' },

        // Vendor (business) fields
        { path: 'quote.vendor.name', type: 'string', description: 'Vendor/Business name', example: 'ABC Contractors' },
        { path: 'quote.vendor.email', type: 'string', description: 'Vendor email', example: 'info@abccontractors.com' },
        { path: 'quote.vendor.phone', type: 'string', description: 'Vendor phone', example: '(555) 987-6543' },
        { path: 'quote.vendor.address_line1', type: 'string', description: 'Vendor address', example: '456 Business Blvd' },
        { path: 'quote.vendor.city', type: 'string', description: 'Vendor city', example: 'Springfield' },
        { path: 'quote.vendor.state', type: 'string', description: 'Vendor state', example: 'IL' },
        { path: 'quote.vendor.zip_code', type: 'string', description: 'Vendor ZIP', example: '62702' },

        // Tenant (company) fields
        { path: 'tenant.company_name', type: 'string', description: 'Company name', example: 'My Business LLC' },
        { path: 'tenant.primary_contact_phone', type: 'string', description: 'Company phone', example: '(555) 111-2222' },
        { path: 'tenant.primary_contact_email', type: 'string', description: 'Company email', example: 'contact@mybusiness.com' },
        { path: 'tenant.website_url', type: 'string', description: 'Company website', example: 'https://mybusiness.com' },
        { path: 'tenant.logo_url', type: 'string', description: 'Company logo URL', example: 'https://...' },

        // Line items (array)
        { path: 'quote.items', type: 'array', description: 'Quote line items', example: '[...]' },
        { path: 'quote.items[].title', type: 'string', description: 'Item title', example: 'Cabinet Installation' },
        { path: 'quote.items[].description', type: 'string', description: 'Item description', example: 'Install 10 cabinets' },
        { path: 'quote.items[].quantity', type: 'number', description: 'Item quantity', example: 10 },
        { path: 'quote.items[].unit_measurement', type: 'string', description: 'Unit of measurement', example: 'each' },
        { path: 'quote.items[].total_cost', type: 'number', description: 'Item total cost', example: 1200.00 },

        // Date fields
        { path: 'quote.created_at', type: 'date', description: 'Quote created date', example: '2026-02-01' },
        { path: 'quote.updated_at', type: 'date', description: 'Quote updated date', example: '2026-02-04' },

        // Current date/time (system variables)
        { path: 'current_date', type: 'date', description: 'Current date', example: '2026-02-04' },
        { path: 'current_year', type: 'number', description: 'Current year', example: 2026 },
      ],
      helpers: [
        { name: 'currency', syntax: '{{currency value}}', description: 'Format as currency ($1,234.56)', example: '{{currency quote.total}}' },
        { name: 'date', syntax: '{{date value}}', description: 'Format as date (MM/DD/YYYY)', example: '{{date quote.expires_at}}' },
        { name: 'percent', syntax: '{{percent value}}', description: 'Format as percentage (12.5%)', example: '{{percent 0.125}}' },
        { name: 'eq', syntax: '{{#if (eq a b)}}', description: 'Check if two values are equal', example: '{{#if (eq quote.status "sent")}}' },
        { name: 'ne', syntax: '{{#if (ne a b)}}', description: 'Check if two values are not equal', example: '{{#if (ne quote.discount_amount 0)}}' },
        { name: 'gt', syntax: '{{#if (gt a b)}}', description: 'Check if a > b', example: '{{#if (gt quote.total 1000)}}' },
        { name: 'lt', syntax: '{{#if (lt a b)}}', description: 'Check if a < b', example: '{{#if (lt quote.items.length 10)}}' },
        { name: 'multiply', syntax: '{{multiply a b}}', description: 'Multiply two numbers', example: '{{multiply quantity price}}' },
        { name: 'if', syntax: '{{#if condition}}...{{/if}}', description: 'Conditional rendering', example: '{{#if quote.custom_terms}}...{{/if}}' },
        { name: 'unless', syntax: '{{#unless condition}}...{{/unless}}', description: 'Inverse conditional', example: '{{#unless quote.discount_amount}}...{{/unless}}' },
        { name: 'each', syntax: '{{#each array}}...{{/each}}', description: 'Loop through array', example: '{{#each quote.items}}...{{/each}}' },
      ],
    };
  }

  /**
   * Convert code template to visual (AI-assisted - placeholder for now)
   */
  async convertToVisual(templateId: string): Promise<any> {
    const template = await this.prisma.quote_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    if (template.template_type !== 'code') {
      throw new BadRequestException('Template is already a visual template');
    }

    // TODO: Implement AI-assisted conversion (future enhancement)
    // For now, return a message that this is not implemented
    throw new BadRequestException(
      'Code to Visual conversion is not yet implemented. ' +
      'This feature will use AI to analyze the HTML structure and convert it to component-based layout.',
    );
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async createVersion(
    templateId: string,
    html: string,
    css: string | null,
    userId: string,
    changesSummary: string,
    versionNumber?: number,
  ) {
    const version = versionNumber || 1;

    await this.prisma.quote_template_version.create({
      data: {
        id: randomUUID(),
        template_id: templateId,
        version_number: version,
        template_type: 'code',
        html_content: html,
        css_content: css,
        changes_summary: changesSummary,
        created_by_user_id: userId,
      },
    });
  }

  private extractHelpers(html: string): string[] {
    const helpers = new Set<string>();

    // Match {{#helper}} and {{helper}}
    const helperRegex = /\{\{#?([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;

    while ((match = helperRegex.exec(html)) !== null) {
      const helper = match[1];
      // Skip variables that look like object properties
      if (!helper.includes('.')) {
        helpers.add(helper);
      }
    }

    return Array.from(helpers).sort();
  }
}
