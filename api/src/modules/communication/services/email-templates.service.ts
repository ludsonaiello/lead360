import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { Prisma, $Enums } from '@prisma/client';
import * as Handlebars from 'handlebars';
import { randomUUID } from 'crypto';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  ListTemplatesDto,
  ValidateTemplateDto,
  PreviewTemplateDto,
} from '../dto/template.dto';
import { TemplateVariableRegistryService } from '../../../shared/services/template-variable-registry.service';

/**
 * Email Templates Service
 *
 * Manages email templates with Handlebars rendering.
 * Templates can be system-wide (tenant_id = NULL) or tenant-specific.
 *
 * Features:
 * - Handlebars template compilation and validation
 * - Template preview with sample data
 * - System templates protection (cannot be edited/deleted)
 * - Variable registry for autocomplete
 */
@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly variableRegistry: TemplateVariableRegistryService,
  ) {}

  /**
   * List all templates for tenant
   * - Platform admins see all templates (platform, shared, tenant)
   * - Tenants see shared + their own tenant templates only
   */
  async findAll(
    tenantId: string | null,
    dto: ListTemplatesDto,
    isPlatformAdmin: boolean = false,
  ) {
    const where: any = {
      AND: [],
    };

    // Template type filter (NEW - replaces is_system logic)
    if (dto.template_type) {
      // Explicit filter by type
      where.AND.push({ template_type: dto.template_type });

      // For tenant templates, also filter by tenant_id
      if (dto.template_type === 'tenant' && tenantId) {
        where.AND.push({ tenant_id: tenantId });
      }
    } else if (dto.is_system !== undefined) {
      // DEPRECATED: Backward compatibility for is_system filter
      if (dto.is_system === true) {
        where.AND.push({ is_system: true });
      } else {
        where.AND.push({ is_system: false });
        if (tenantId) {
          where.AND.push({ tenant_id: tenantId });
        }
      }
    } else {
      // Default visibility rules (no filter specified)
      if (isPlatformAdmin) {
        // Platform admin sees ALL templates (platform, shared, tenant)
        // No filter needed
      } else if (tenantId) {
        // Regular tenant user sees:
        // - Shared templates (global library)
        // - Their own tenant templates
        where.AND.push({
          OR: [
            { template_type: 'shared' },
            { template_type: 'tenant', tenant_id: tenantId },
          ],
        });
      } else {
        // No tenantId and not admin = error (shouldn't happen)
        throw new ForbiddenException('Access denied');
      }
    }

    // Category filter
    if (dto.category) {
      where.AND.push({ category: dto.category });
    }

    // Active status filter
    if (dto.is_active !== undefined) {
      where.AND.push({ is_active: dto.is_active });
    }

    // Search filter
    if (dto.search) {
      where.AND.push({
        OR: [
          { template_key: { contains: dto.search } },
          { description: { contains: dto.search } },
        ],
      });
    }

    // Pagination
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await this.prisma.email_template.count({ where });

    // Get paginated templates
    const templates = await this.prisma.email_template.findMany({
      where,
      orderBy: [{ template_type: 'asc' }, { template_key: 'asc' }],
      skip,
      take: limit,
      select: {
        id: true,
        tenant_id: true,
        template_key: true,
        category: true,
        template_type: true,
        subject: true,
        description: true,
        variables: true,
        variable_schema: true,
        is_system: true, // Keep for backward compatibility
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    return {
      templates,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single template by key
   */
  async findOne(tenantId: string, templateKey: string) {
    const template = await this.prisma.email_template.findFirst({
      where: {
        template_key: templateKey,
        OR: [{ tenant_id: tenantId }, { is_system: true }],
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Template '${templateKey}' not found for this tenant`,
      );
    }

    return template;
  }

  /**
   * Create new template
   */
  async create(
    tenantId: string,
    dto: CreateEmailTemplateDto,
    userId: string,
    isPlatformAdmin: boolean = false,
  ) {
    // Check if template key already exists for this tenant
    const existing = await this.prisma.email_template.findFirst({
      where: {
        template_key: dto.template_key,
        tenant_id: tenantId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Template with key '${dto.template_key}' already exists for this tenant`,
      );
    }

    // Validate Handlebars syntax and extract variables
    const validation = this.validateHandlebars({
      subject: dto.subject,
      html_body: dto.html_body,
      text_body: dto.text_body,
    });

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid Handlebars syntax',
        errors: validation.errors,
      });
    }

    // Use provided variables or auto-extracted ones
    const variables = dto.variables || validation.variables_used || [];

    // Determine template type
    let template_type = dto.template_type || 'tenant';

    // Validate permissions for platform/shared templates
    if (template_type === 'platform' && !isPlatformAdmin) {
      throw new ForbiddenException(
        'Only platform admins can create platform templates',
      );
    }
    if (template_type === 'shared' && !isPlatformAdmin) {
      throw new ForbiddenException(
        'Only platform admins can create shared templates',
      );
    }

    // Determine final tenant_id
    let final_tenant_id: string | null;

    if (template_type === 'platform' || template_type === 'shared') {
      // Platform/shared templates always have NULL tenant_id
      final_tenant_id = null;
    } else if (dto.tenant_id && isPlatformAdmin) {
      // Platform admin can create tenant template for specific tenant
      final_tenant_id = dto.tenant_id;
    } else if (dto.tenant_id && !isPlatformAdmin) {
      // Non-admin trying to specify tenant_id - security violation
      throw new ForbiddenException(
        'Only platform admins can create templates for other tenants',
      );
    } else {
      // Regular user creating template for their own tenant
      final_tenant_id = tenantId;
    }

    // Create template
    const template = await this.prisma.email_template.create({
      data: {
        id: randomUUID(),
        tenant_id: final_tenant_id,
        template_key: dto.template_key,
        category: dto.category,
        template_type: template_type as $Enums.email_template_type,
        subject: dto.subject,
        html_body: dto.html_body,
        text_body: dto.text_body,
        variables: variables,
        variable_schema: dto.variable_schema || {},
        description: dto.description,
        is_system: template_type !== 'tenant', // Keep for backward compatibility
        is_active: dto.is_active !== undefined ? dto.is_active : true,
      },
    });

    this.logger.log(
      `Template created: ${dto.template_key} by user ${userId} for tenant ${tenantId}`,
    );

    return template;
  }

  /**
   * Update existing template
   */
  async update(
    tenantId: string,
    templateKey: string,
    dto: UpdateEmailTemplateDto,
    userId: string,
    isPlatformAdmin: boolean = false,
  ) {
    // Find template
    // Platform admins can edit system templates (tenant_id = null)
    // Regular users can only edit their tenant's templates
    const template = await this.prisma.email_template.findFirst({
      where: {
        template_key: templateKey,
        ...(isPlatformAdmin
          ? {} // Platform admin can access any template
          : { tenant_id: tenantId }), // Regular users only see their tenant templates
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Template '${templateKey}' not found${isPlatformAdmin ? '' : ' for this tenant'}`,
      );
    }

    // Prevent editing system templates UNLESS user is platform admin
    if (template.is_system && !isPlatformAdmin) {
      throw new ForbiddenException(
        'System templates cannot be edited. Create a custom template instead.',
      );
    }

    // Validate Handlebars syntax if body fields are being updated
    if (dto.subject || dto.html_body || dto.text_body) {
      const validation = this.validateHandlebars({
        subject: dto.subject || template.subject,
        html_body: dto.html_body || template.html_body,
        text_body: dto.text_body || template.text_body || undefined,
      });

      if (!validation.valid) {
        throw new BadRequestException({
          message: 'Invalid Handlebars syntax',
          errors: validation.errors,
        });
      }
    }

    // Update template
    const updated = await this.prisma.email_template.update({
      where: { id: template.id },
      data: {
        category: dto.category,
        subject: dto.subject,
        html_body: dto.html_body,
        text_body: dto.text_body,
        variables: dto.variables,
        variable_schema: dto.variable_schema,
        description: dto.description,
        is_active: dto.is_active,
      },
    });

    this.logger.log(
      `Template updated: ${templateKey} by user ${userId} for tenant ${tenantId}`,
    );

    return updated;
  }

  /**
   * Delete template
   */
  async delete(
    tenantId: string,
    templateKey: string,
    userId: string,
    isPlatformAdmin: boolean = false,
  ) {
    // Find template
    // Platform admins can delete system templates (tenant_id = null)
    // Regular users can only delete their tenant's templates
    const template = await this.prisma.email_template.findFirst({
      where: {
        template_key: templateKey,
        ...(isPlatformAdmin
          ? {} // Platform admin can access any template
          : { tenant_id: tenantId }), // Regular users only see their tenant templates
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Template '${templateKey}' not found${isPlatformAdmin ? '' : ' for this tenant'}`,
      );
    }

    // Prevent deleting system templates UNLESS user is platform admin
    if (template.is_system && !isPlatformAdmin) {
      throw new ForbiddenException('System templates cannot be deleted.');
    }

    // Delete template
    await this.prisma.email_template.delete({
      where: { id: template.id },
    });

    this.logger.log(
      `Template deleted: ${templateKey} by user ${userId}${template.is_system ? ' (system template)' : ` for tenant ${tenantId}`}`,
    );

    return { message: 'Template deleted successfully' };
  }

  /**
   * Validate Handlebars syntax in template
   */
  async validateTemplate(dto: ValidateTemplateDto) {
    return this.validateHandlebars({
      subject: dto.subject,
      html_body: dto.html_body,
      text_body: dto.text_body,
    });
  }

  /**
   * Preview template with sample data
   */
  async preview(tenantId: string, dto: PreviewTemplateDto) {
    let subject: string;
    let html_body: string;
    let text_body: string | undefined;

    // Use existing template or provided content
    if (dto.template_key) {
      const template = await this.findOne(tenantId, dto.template_key);
      subject = template.subject;
      html_body = template.html_body;
      text_body = template.text_body || undefined;
    } else {
      if (!dto.subject || !dto.html_body) {
        throw new BadRequestException(
          'Either template_key or subject/html_body must be provided',
        );
      }
      subject = dto.subject;
      html_body = dto.html_body;
      text_body = dto.text_body;
    }

    // Render with sample data
    try {
      const renderedSubject = Handlebars.compile(subject)(dto.sample_data);
      const renderedHtmlBody = Handlebars.compile(html_body)(dto.sample_data);
      const renderedTextBody = text_body
        ? Handlebars.compile(text_body)(dto.sample_data)
        : undefined;

      return {
        subject: renderedSubject,
        html_body: renderedHtmlBody,
        text_body: renderedTextBody,
        sample_data: dto.sample_data,
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Template rendering failed',
        error: error.message,
      });
    }
  }

  /**
   * Get comprehensive variable registry for email templates
   * Uses shared centralized variable registry service
   */
  async getVariableRegistry() {
    return this.variableRegistry.getAllVariables();
  }

  /**
   * Render template with variables (used by SendEmailService)
   */
  async renderTemplate(
    tenantId: string | null,
    templateKey: string,
    variables: Record<string, any>,
  ): Promise<{
    subject: string;
    html_body: string;
    text_body: string | null;
  }> {
    // Find template (system or tenant-specific)
    const where: any = {
      template_key: templateKey,
      is_active: true,
    };

    if (tenantId) {
      where.OR = [{ tenant_id: tenantId }, { is_system: true }];
    } else {
      where.is_system = true;
    }

    const template = await this.prisma.email_template.findFirst({
      where,
    });

    if (!template) {
      throw new NotFoundException(
        `Active template '${templateKey}' not found`,
      );
    }

    try {
      const subject = Handlebars.compile(template.subject)(variables);
      const html_body = Handlebars.compile(template.html_body)(variables);
      const text_body = template.text_body
        ? Handlebars.compile(template.text_body)(variables)
        : null;

      return { subject, html_body, text_body };
    } catch (error) {
      this.logger.error(
        `Template rendering failed for '${templateKey}': ${error.message}`,
      );
      throw new BadRequestException({
        message: 'Template rendering failed',
        template_key: templateKey,
        error: error.message,
      });
    }
  }

  /**
   * Validate Handlebars syntax (private helper)
   */
  private validateHandlebars(content: {
    subject: string;
    html_body: string;
    text_body?: string;
  }): { valid: boolean; errors?: string[]; variables_used?: string[] } {
    const errors: string[] = [];
    const variablesSet = new Set<string>();

    // Helper to extract variables from template string
    const extractVariables = (template: string) => {
      // Match {{variable}} and {{#if variable}} patterns
      const variableRegex = /\{\{[#\/]?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
      let match;
      while ((match = variableRegex.exec(template)) !== null) {
        variablesSet.add(match[1]);
      }
    };

    // Validate subject
    try {
      Handlebars.compile(content.subject);
      extractVariables(content.subject);
    } catch (error) {
      errors.push(`Subject: ${error.message}`);
    }

    // Validate HTML body
    try {
      Handlebars.compile(content.html_body);
      extractVariables(content.html_body);
    } catch (error) {
      errors.push(`HTML body: ${error.message}`);
    }

    // Validate text body (if provided)
    if (content.text_body) {
      try {
        Handlebars.compile(content.text_body);
        extractVariables(content.text_body);
      } catch (error) {
        errors.push(`Text body: ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      variables_used: Array.from(variablesSet).sort(),
    };
  }

  /**
   * Clone a shared template to tenant
   */
  async cloneTemplate(
    tenantId: string,
    sourceKey: string,
    newKey: string | undefined,
    userId: string,
  ) {
    // Find source template (must be shared)
    const source = await this.prisma.email_template.findFirst({
      where: {
        template_key: sourceKey,
        template_type: 'shared',
      },
    });

    if (!source) {
      throw new NotFoundException('Shared template not found');
    }

    // Generate new key if not provided
    const cloneKey = newKey || `${sourceKey}-custom`;

    // Check if key exists for tenant
    const existing = await this.prisma.email_template.findFirst({
      where: {
        template_key: cloneKey,
        tenant_id: tenantId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Template with key '${cloneKey}' already exists for this tenant`,
      );
    }

    // Create cloned template
    const cloned = await this.prisma.email_template.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        template_key: cloneKey,
        category: source.category,
        template_type: 'tenant', // Always tenant type
        subject: source.subject,
        html_body: source.html_body,
        text_body: source.text_body,
        variables: source.variables as Prisma.InputJsonValue,
        variable_schema: source.variable_schema as Prisma.InputJsonValue,
        description: source.description
          ? `Cloned from: ${source.description}`
          : `Cloned from ${sourceKey}`,
        is_system: false,
        is_active: true,
      },
    });

    this.logger.log(
      `Template cloned: ${sourceKey} → ${cloneKey} by user ${userId} for tenant ${tenantId}`,
    );

    return cloned;
  }
}
