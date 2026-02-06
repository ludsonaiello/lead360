import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  ListTemplatesDto,
} from '../dto/template';
import { randomUUID } from 'crypto';

@Injectable()
export class QuoteTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    @Inject(
      forwardRef(
        () =>
          require('./admin-template-testing.service')
            .AdminTemplateTestingService,
      ),
    )
    private readonly templateTestingService: any,
  ) {}

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return randomUUID();
  }

  /**
   * Admin creates template (global or tenant-specific)
   */
  async createTemplate(userId: string, dto: CreateTemplateDto) {
    // Validate global vs tenant template
    const isGlobal =
      dto.is_global !== undefined ? dto.is_global : dto.tenant_id === null;
    const tenantId = dto.tenant_id || null;

    // If setting as default, unset other defaults
    if (dto.is_default) {
      if (isGlobal) {
        // Unset global defaults
        await this.prisma.quote_template.updateMany({
          where: { tenant_id: { equals: null }, is_default: true },
          data: { is_default: false },
        });
      } else if (tenantId) {
        // Unset tenant-specific defaults
        await this.prisma.quote_template.updateMany({
          where: { tenant_id: tenantId, is_default: true },
          data: { is_default: false },
        });
      }
    }

    const templateId = this.generateUUID();
    const template = await this.prisma.quote_template.create({
      data: {
        id: templateId,
        tenant_id: tenantId,
        name: dto.name,
        description: dto.description,
        html_content: dto.html_content,
        thumbnail_url: dto.thumbnail_url,
        is_global: isGlobal,
        is_default: dto.is_default || false,
        created_by_user_id: userId,
      },
    });

    // Audit logging
    if (tenantId) {
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote_template',
        entityId: template.id,
        tenantId,
        actorUserId: userId,
        after: template,
        description: `Template created: ${template.name}`,
      });
    }
    // Note: Global template audit logging skipped (no logPlatformChange method)

    return template;
  }

  /**
   * Admin view of all templates with stats
   */
  async findAllAdmin(filters: ListTemplatesDto) {
    const { is_active, is_global, tenant_id, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (is_active !== undefined) {
      where.is_active = is_active;
    }
    if (is_global !== undefined) {
      where.is_global = is_global;
    }
    if (tenant_id !== undefined) {
      where.tenant_id = tenant_id;
    }

    const [templates, total] = await Promise.all([
      this.prisma.quote_template.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { is_default: 'desc' },
          { is_global: 'desc' },
          { name: 'asc' },
        ],
        include: {
          _count: {
            select: { quotes: true },
          },
        },
      }),
      this.prisma.quote_template.count({ where }),
    ]);

    return {
      data: templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Tenant view (global + their templates)
   */
  async findAllForTenant(tenantId: string, filters: ListTemplatesDto) {
    const { is_active, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { tenant_id: null }, // Global templates
        { tenant_id: tenantId }, // Tenant-specific templates
      ],
    };

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const [templates, total] = await Promise.all([
      this.prisma.quote_template.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { is_default: 'desc' },
          { is_global: 'desc' },
          { name: 'asc' },
        ],
        select: {
          id: true,
          tenant_id: true,
          name: true,
          description: true,
          thumbnail_url: true,
          is_global: true,
          is_default: true,
          is_active: true,
          created_at: true,
        },
      }),
      this.prisma.quote_template.count({ where }),
    ]);

    return {
      data: templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin get template
   */
  async findOneAdmin(templateId: string) {
    const template = await this.prisma.quote_template.findUnique({
      where: { id: templateId },
      include: {
        _count: {
          select: { quotes: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  /**
   * Tenant get template (access check)
   */
  async findOne(tenantId: string, templateId: string) {
    const template = await this.prisma.quote_template.findFirst({
      where: {
        id: templateId,
        OR: [
          { tenant_id: null }, // Global templates
          { tenant_id: tenantId }, // Tenant-specific templates
        ],
      },
      select: {
        id: true,
        tenant_id: true,
        name: true,
        description: true,
        html_content: true,
        thumbnail_url: true,
        is_global: true,
        is_default: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  /**
   * Admin updates template
   */
  async updateTemplate(
    templateId: string,
    userId: string,
    dto: UpdateTemplateDto,
  ) {
    const template = await this.findOneAdmin(templateId);

    // If setting as default, unset other defaults in the same scope
    if (dto.is_default && !template.is_default) {
      if (template.is_global) {
        await this.prisma.quote_template.updateMany({
          where: { tenant_id: { equals: null }, is_default: true },
          data: { is_default: false },
        });
      } else if (template.tenant_id) {
        await this.prisma.quote_template.updateMany({
          where: { tenant_id: template.tenant_id, is_default: true },
          data: { is_default: false },
        });
      }
    }

    // Create version snapshot before updating (on any change)
    const changesSummary: string[] = [];
    if (dto.name && dto.name !== template.name) changesSummary.push('name');
    if (
      dto.description !== undefined &&
      dto.description !== template.description
    )
      changesSummary.push('description');
    if (dto.html_content && dto.html_content !== template.html_content)
      changesSummary.push('html_content');
    if (
      dto.thumbnail_url !== undefined &&
      dto.thumbnail_url !== template.thumbnail_url
    )
      changesSummary.push('thumbnail_url');
    if (dto.is_default !== undefined && dto.is_default !== template.is_default)
      changesSummary.push('is_default');

    if (changesSummary.length > 0 && this.templateTestingService) {
      try {
        await this.templateTestingService.createTemplateSnapshot(
          template,
          userId,
          `Updated: ${changesSummary.join(', ')}`,
        );
      } catch (error) {
        // Log but don't fail the update if versioning fails
        console.error('Failed to create template version snapshot:', error);
      }
    }

    const updatedTemplate = await this.prisma.quote_template.update({
      where: { id: templateId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.html_content && { html_content: dto.html_content }),
        ...(dto.thumbnail_url !== undefined && {
          thumbnail_url: dto.thumbnail_url,
        }),
        ...(dto.is_default !== undefined && { is_default: dto.is_default }),
      },
    });

    // Audit logging
    if (template.tenant_id) {
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'quote_template',
        entityId: templateId,
        tenantId: template.tenant_id,
        actorUserId: userId,
        before: template,
        after: updatedTemplate,
        description: `Template updated: ${updatedTemplate.name}`,
      });
    }
    // Note: Global template audit logging skipped

    return updatedTemplate;
  }

  /**
   * Admin deletes template (check usage)
   */
  async deleteTemplate(templateId: string, userId: string) {
    const template = await this.findOneAdmin(templateId);

    // Prevent deleting default template
    if (template.is_default) {
      throw new BadRequestException('Cannot delete default template');
    }

    // Check if template is in use (quotes reference it)
    const quoteCount = await this.prisma.quote.count({
      where: { active_template_id: templateId },
    });

    if (quoteCount > 0) {
      throw new BadRequestException(
        `Cannot delete template. It is used in ${quoteCount} quote(s)`,
      );
    }

    // Check if any tenant is using it as active template
    const tenantUsageCount = await this.prisma.tenant.count({
      where: { active_quote_template_id: templateId },
    });

    if (tenantUsageCount > 0) {
      throw new BadRequestException(
        `Cannot delete template. It is set as active template for ${tenantUsageCount} tenant(s)`,
      );
    }

    await this.prisma.quote_template.delete({
      where: { id: templateId },
    });

    // Audit logging
    if (template.tenant_id) {
      await this.auditLogger.logTenantChange({
        action: 'deleted',
        entityType: 'quote_template',
        entityId: templateId,
        tenantId: template.tenant_id,
        actorUserId: userId,
        before: template,
        description: `Template deleted: ${template.name}`,
      });
    }
    // Note: Global template audit logging skipped

    return { message: 'Template deleted successfully' };
  }

  /**
   * Admin clones template
   */
  async cloneTemplate(templateId: string, userId: string, newName?: string) {
    const template = await this.findOneAdmin(templateId);

    const clonedName = newName || `${template.name} (Copy)`;
    const newTemplateId = this.generateUUID();

    const clonedTemplate = await this.prisma.quote_template.create({
      data: {
        id: newTemplateId,
        tenant_id: template.tenant_id,
        name: clonedName,
        description: template.description,
        html_content: template.html_content,
        thumbnail_url: template.thumbnail_url,
        is_global: template.is_global,
        is_default: false, // Cloned templates are never default
        created_by_user_id: userId,
      },
    });

    // Audit logging
    if (template.tenant_id) {
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote_template',
        entityId: clonedTemplate.id,
        tenantId: template.tenant_id,
        actorUserId: userId,
        after: clonedTemplate,
        description: `Template cloned: ${template.name} → ${clonedTemplate.name}`,
      });
    }
    // Note: Global template audit logging skipped

    return clonedTemplate;
  }

  /**
   * Admin sets platform default template
   */
  async setDefaultTemplate(templateId: string, userId: string) {
    const template = await this.findOneAdmin(templateId);

    if (!template.is_global) {
      throw new ForbiddenException(
        'Only global templates can be set as platform default',
      );
    }

    // Unset all global defaults
    await this.prisma.quote_template.updateMany({
      where: { tenant_id: { equals: null }, is_default: true },
      data: { is_default: false },
    });

    // Set this template as default
    const updatedTemplate = await this.prisma.quote_template.update({
      where: { id: templateId },
      data: { is_default: true },
    });

    // Note: Platform-level audit logging skipped (global template)

    return updatedTemplate;
  }

  /**
   * Tenant selects active template
   */
  async setTenantActiveTemplate(
    tenantId: string,
    userId: string,
    templateId: string,
  ) {
    // Verify template exists and is accessible
    await this.findOne(tenantId, templateId);

    // Update tenant active template
    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { active_quote_template_id: templateId },
      select: {
        id: true,
        active_quote_template_id: true,
        active_quote_template: {
          select: {
            id: true,
            name: true,
            description: true,
            thumbnail_url: true,
            is_global: true,
          },
        },
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant_template_selection',
      entityId: tenantId,
      tenantId,
      actorUserId: userId,
      after: updatedTenant,
      description: `Active quote template updated`,
    });

    return updatedTenant;
  }

  /**
   * Get template variables schema
   */
  async getTemplateVariables() {
    return {
      quote: {
        id: {
          type: 'string',
          description: 'Quote UUID',
          example: '550e8400-e29b-41d4-a716',
        },
        quote_number: {
          type: 'string',
          description: 'Sequential quote number',
          example: 'Q-2024-001',
        },
        title: {
          type: 'string',
          description: 'Quote title',
          example: 'Kitchen Renovation',
        },
        status: {
          type: 'string',
          enum: [
            'draft',
            'pending',
            'approved',
            'rejected',
            'accepted',
            'declined',
            'expired',
            'converted',
          ],
          description: 'Quote status',
        },
        created_at: {
          type: 'datetime',
          format: 'ISO 8601',
          description: 'Creation timestamp',
          example: '2024-01-15T10:30:00Z',
        },
        valid_until: {
          type: 'datetime',
          format: 'ISO 8601',
          description: 'Expiration date',
          example: '2024-02-15T10:30:00Z',
        },
      },
      customer: {
        first_name: {
          type: 'string',
          description: 'Customer first name',
          example: 'John',
        },
        last_name: {
          type: 'string',
          description: 'Customer last name',
          example: 'Doe',
        },
        email: {
          type: 'string',
          description: 'Customer email',
          example: 'john.doe@example.com',
        },
        phone: {
          type: 'string',
          format: 'formatted',
          description: 'Customer phone',
          example: '(555) 123-4567',
        },
      },
      vendor: {
        name: {
          type: 'string',
          description: 'Vendor company name',
          example: 'ABC Construction Inc',
        },
        email: {
          type: 'string',
          description: 'Vendor email',
          example: 'vendor@abc.com',
        },
        phone: {
          type: 'string',
          format: 'formatted',
          description: 'Vendor phone',
          example: '(555) 234-5678',
        },
        address_line1: {
          type: 'string',
          description: 'Vendor address line 1',
          example: '123 Main St',
        },
        city: { type: 'string', description: 'Vendor city', example: 'Boston' },
        state: { type: 'string', description: 'Vendor state', example: 'MA' },
        zip_code: {
          type: 'string',
          description: 'Vendor ZIP code',
          example: '02101',
        },
        signature_url: {
          type: 'string',
          description: 'Vendor signature image URL',
          example: 'https://cdn.example.com/signatures/abc.png',
        },
      },
      jobsite: {
        address_line1: {
          type: 'string',
          description: 'Job site address line 1',
          example: '456 Oak Ave',
        },
        address_line2: {
          type: 'string',
          description: 'Job site address line 2',
          example: 'Unit 5B',
        },
        city: {
          type: 'string',
          description: 'Job site city',
          example: 'Cambridge',
        },
        state: { type: 'string', description: 'Job site state', example: 'MA' },
        zip_code: {
          type: 'string',
          description: 'Job site ZIP code',
          example: '02139',
        },
      },
      items: {
        _description: 'Array of items, iterate with {{#each items}}',
        _example: [
          {
            title: 'Bathroom Tile Installation',
            description: 'Premium ceramic tiles with professional installation',
            quantity: 100,
            unit: 'sq ft',
            unit_price: 8.25,
            total_price: 825.0,
          },
        ],
      },
      groups: {
        _description: 'Array of item groups, iterate with {{#each groups}}',
        _example: [
          {
            name: 'Bathroom Renovation',
            description: 'Complete bathroom remodel',
            items: [
              {
                title: 'Tile Installation',
                quantity: 100,
                unit: 'sq ft',
                total_price: 825.0,
              },
            ],
            subtotal: 825.0,
          },
        ],
      },
      totals: {
        subtotal: {
          type: 'number',
          format: 'currency',
          description: 'Sum of all items',
          example: 12500.0,
        },
        profit_amount: {
          type: 'number',
          format: 'currency',
          description: 'Profit calculation',
          example: 2500.0,
        },
        overhead_amount: {
          type: 'number',
          format: 'currency',
          description: 'Overhead calculation',
          example: 1250.0,
        },
        contingency_amount: {
          type: 'number',
          format: 'currency',
          description: 'Contingency amount',
          example: 625.0,
        },
        discount_amount: {
          type: 'number',
          format: 'currency',
          description: 'Total discounts applied',
          example: 500.0,
        },
        total: {
          type: 'number',
          format: 'currency',
          description: 'Final quote total',
          example: 16375.0,
        },
      },
      terms: {
        quote_terms: {
          type: 'string',
          description: 'Terms and conditions',
          example: 'Payment due upon completion',
        },
        payment_instructions: {
          type: 'string',
          description: 'Payment instructions',
          example: 'Check or cash accepted',
        },
      },
      attachments: {
        _description:
          'Array of attachments, iterate with {{#each attachments}}',
        _example: [
          {
            filename: 'floorplan.pdf',
            url: 'https://cdn.example.com/files/abc123.pdf',
            type: 'supporting_document',
          },
        ],
      },
      draw_schedule: {
        _description:
          'Array of draw schedule entries, iterate with {{#each draw_schedule}}',
        _example: [
          {
            sequence_number: 1,
            description: 'Initial deposit',
            amount: 5000.0,
            due_date: '2024-02-01',
          },
        ],
      },
    };
  }
}
