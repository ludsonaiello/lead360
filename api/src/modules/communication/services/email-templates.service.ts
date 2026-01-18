import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import * as Handlebars from 'handlebars';
import { randomUUID } from 'crypto';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  ListTemplatesDto,
  ValidateTemplateDto,
  PreviewTemplateDto,
} from '../dto/template.dto';

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

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all templates for tenant (includes system templates)
   */
  async findAll(tenantId: string, dto: ListTemplatesDto) {
    const where: any = {
      OR: [
        { tenant_id: tenantId }, // Tenant-specific templates
        { is_system: true }, // System templates (tenant_id = NULL)
      ],
    };

    if (dto.category) {
      where.category = dto.category;
    }

    if (dto.is_active !== undefined) {
      where.is_active = dto.is_active;
    }

    if (dto.search) {
      where.OR = [
        { template_key: { contains: dto.search } },
        { description: { contains: dto.search } },
      ];
    }

    const templates = await this.prisma.email_template.findMany({
      where,
      orderBy: [{ is_system: 'desc' }, { template_key: 'asc' }],
      select: {
        id: true,
        tenant_id: true,
        template_key: true,
        category: true,
        subject: true,
        description: true,
        variables: true,
        variable_schema: true,
        is_system: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    return {
      templates,
      total: templates.length,
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

    // Validate Handlebars syntax
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

    // Create template
    const template = await this.prisma.email_template.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        template_key: dto.template_key,
        category: dto.category,
        subject: dto.subject,
        html_body: dto.html_body,
        text_body: dto.text_body,
        variables: dto.variables || [],
        variable_schema: dto.variable_schema || {},
        description: dto.description,
        is_system: false,
        is_active: true,
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
  ) {
    // Find template
    const template = await this.prisma.email_template.findFirst({
      where: {
        template_key: templateKey,
        tenant_id: tenantId,
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Template '${templateKey}' not found for this tenant`,
      );
    }

    // Prevent editing system templates
    if (template.is_system) {
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
  async delete(tenantId: string, templateKey: string, userId: string) {
    // Find template
    const template = await this.prisma.email_template.findFirst({
      where: {
        template_key: templateKey,
        tenant_id: tenantId,
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Template '${templateKey}' not found for this tenant`,
      );
    }

    // Prevent deleting system templates
    if (template.is_system) {
      throw new ForbiddenException('System templates cannot be deleted.');
    }

    // Delete template
    await this.prisma.email_template.delete({
      where: { id: template.id },
    });

    this.logger.log(
      `Template deleted: ${templateKey} by user ${userId} for tenant ${tenantId}`,
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
   * Get variable registry (common variables available in templates)
   */
  async getVariableRegistry() {
    return {
      common: {
        companyName: {
          type: 'string',
          description: 'Business name',
          example: 'Acme Plumbing',
        },
        companyPhone: {
          type: 'string',
          description: 'Business phone number',
          example: '(555) 123-4567',
        },
        companyEmail: {
          type: 'string',
          description: 'Business email',
          example: 'info@acmeplumbing.com',
        },
        companyAddress: {
          type: 'string',
          description: 'Business address',
          example: '123 Main St, City, ST 12345',
        },
        currentYear: {
          type: 'number',
          description: 'Current year',
          example: new Date().getFullYear(),
        },
      },
      customer: {
        customerName: {
          type: 'string',
          description: 'Customer full name',
          example: 'John Doe',
        },
        customerFirstName: {
          type: 'string',
          description: 'Customer first name',
          example: 'John',
        },
        customerEmail: {
          type: 'string',
          description: 'Customer email',
          example: 'john@example.com',
        },
        customerPhone: {
          type: 'string',
          description: 'Customer phone',
          example: '(555) 987-6543',
        },
      },
      quote: {
        quoteNumber: {
          type: 'string',
          description: 'Quote number',
          example: 'Q-12345',
        },
        quoteTotal: {
          type: 'string',
          description: 'Quote total (formatted)',
          example: '$1,250.00',
        },
        quoteDate: {
          type: 'string',
          description: 'Quote date',
          example: '2026-01-18',
        },
        quoteValidUntil: {
          type: 'string',
          description: 'Quote expiration date',
          example: '2026-02-18',
        },
      },
      invoice: {
        invoiceNumber: {
          type: 'string',
          description: 'Invoice number',
          example: 'INV-12345',
        },
        invoiceTotal: {
          type: 'string',
          description: 'Invoice total (formatted)',
          example: '$1,250.00',
        },
        invoiceDueDate: {
          type: 'string',
          description: 'Invoice due date',
          example: '2026-02-01',
        },
        amountDue: {
          type: 'string',
          description: 'Amount due (formatted)',
          example: '$1,250.00',
        },
      },
      appointment: {
        appointmentDate: {
          type: 'string',
          description: 'Appointment date',
          example: '2026-01-20',
        },
        appointmentTime: {
          type: 'string',
          description: 'Appointment time',
          example: '10:00 AM',
        },
        technicianName: {
          type: 'string',
          description: 'Assigned technician name',
          example: 'Mike Smith',
        },
      },
    };
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
  }): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Validate subject
    try {
      Handlebars.compile(content.subject);
    } catch (error) {
      errors.push(`Subject: ${error.message}`);
    }

    // Validate HTML body
    try {
      Handlebars.compile(content.html_body);
    } catch (error) {
      errors.push(`HTML body: ${error.message}`);
    }

    // Validate text body (if provided)
    if (content.text_body) {
      try {
        Handlebars.compile(content.text_body);
      } catch (error) {
        errors.push(`Text body: ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
