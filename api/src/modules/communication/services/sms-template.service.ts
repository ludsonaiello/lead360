import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateSmsTemplateDto } from '../dto/template/create-sms-template.dto';
import { UpdateSmsTemplateDto } from '../dto/template/update-sms-template.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * SMS Template Service
 *
 * Handles CRUD operations for SMS templates.
 *
 * Features:
 * - Create templates with optional default flag
 * - List templates (filtered by tenant and optionally category)
 * - Update templates (with default flag handling)
 * - Soft delete templates (sets is_active = false)
 * - Automatic default management (only one default per category per tenant)
 *
 * Multi-tenant isolation: All operations filtered by tenant_id from JWT.
 * RBAC: Enforced at controller level (Owner, Admin, Manager, Sales).
 */
@Injectable()
export class SmsTemplateService {
  private readonly logger = new Logger(SmsTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create new SMS template
   *
   * If is_default=true, automatically unsets other defaults in same category.
   * Only one template can be default per category per tenant.
   *
   * @param tenantId - Tenant UUID from JWT
   * @param userId - User UUID from JWT (template creator)
   * @param dto - Template creation data
   * @returns Created template
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateSmsTemplateDto,
  ): Promise<any> {
    // If setting as default, unset other defaults in same category
    if (dto.is_default && dto.category) {
      await this.prisma.sms_template.updateMany({
        where: {
          tenant_id: tenantId,
          category: dto.category,
          is_default: true,
        },
        data: { is_default: false },
      });

      this.logger.log(
        `Unset previous default templates in category "${dto.category}" for tenant ${tenantId}`,
      );
    }

    const templateId = uuidv4();

    const template = await this.prisma.sms_template.create({
      data: {
        id: templateId,
        tenant_id: tenantId,
        created_by: userId,
        name: dto.name,
        description: dto.description,
        template_body: dto.template_body,
        category: dto.category,
        is_default: dto.is_default || false,
      },
      include: {
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `Created SMS template ${template.id} "${template.name}" for tenant ${tenantId}`,
    );

    return template;
  }

  /**
   * Find all active templates for tenant
   *
   * Optionally filter by category.
   * Only returns active templates (is_active = true).
   *
   * @param tenantId - Tenant UUID from JWT
   * @param category - Optional category filter
   * @returns List of templates
   */
  async findAll(tenantId: string, category?: string): Promise<any[]> {
    const templates = await this.prisma.sms_template.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        ...(category && { category }),
      },
      include: {
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });

    this.logger.debug(
      `Found ${templates.length} active templates for tenant ${tenantId}${category ? ` in category "${category}"` : ''}`,
    );

    return templates;
  }

  /**
   * Find template by ID
   *
   * Verifies template belongs to tenant (multi-tenant isolation).
   *
   * @param id - Template UUID
   * @param tenantId - Tenant UUID from JWT
   * @returns Template data
   * @throws NotFoundException if template not found or doesn't belong to tenant
   */
  async findOne(id: string, tenantId: string): Promise<any> {
    const template = await this.prisma.sms_template.findFirst({
      where: {
        id,
        tenant_id: tenantId, // CRITICAL: Multi-tenant isolation
      },
      include: {
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(
        'Template not found or does not belong to your organization',
      );
    }

    return template;
  }

  /**
   * Update template
   *
   * If is_default=true, automatically unsets other defaults in same category.
   * Verifies template belongs to tenant.
   *
   * @param id - Template UUID
   * @param tenantId - Tenant UUID from JWT
   * @param dto - Update data
   * @returns Updated template
   * @throws NotFoundException if template not found
   */
  async update(
    id: string,
    tenantId: string,
    dto: UpdateSmsTemplateDto,
  ): Promise<any> {
    // Verify template exists and belongs to tenant
    await this.findOne(id, tenantId);

    // If setting as default, unset other defaults in same category
    if (dto.is_default === true) {
      // Get current template to know its category (or use updated category)
      const currentTemplate = await this.prisma.sms_template.findUnique({
        where: { id },
        select: { category: true },
      });

      const categoryToCheck = dto.category || currentTemplate?.category;

      if (categoryToCheck) {
        await this.prisma.sms_template.updateMany({
          where: {
            tenant_id: tenantId,
            category: categoryToCheck,
            is_default: true,
            id: { not: id }, // Don't unset the template we're updating
          },
          data: { is_default: false },
        });

        this.logger.log(
          `Unset previous default templates in category "${categoryToCheck}" for tenant ${tenantId}`,
        );
      }
    }

    const template = await this.prisma.sms_template.update({
      where: {
        id,
        tenant_id: tenantId, // Extra safety check
      },
      data: dto,
      include: {
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`Updated SMS template ${id} for tenant ${tenantId}`);

    return template;
  }

  /**
   * Delete template (soft delete)
   *
   * Sets is_active = false instead of permanently deleting.
   * This preserves template history and usage statistics.
   *
   * @param id - Template UUID
   * @param tenantId - Tenant UUID from JWT
   * @returns Deleted template
   * @throws NotFoundException if template not found
   */
  async delete(id: string, tenantId: string): Promise<any> {
    // Verify template exists and belongs to tenant
    await this.findOne(id, tenantId);

    const template = await this.prisma.sms_template.update({
      where: {
        id,
        tenant_id: tenantId,
      },
      data: { is_active: false },
    });

    this.logger.log(`Soft deleted SMS template ${id} for tenant ${tenantId}`);

    return template;
  }

  /**
   * Get template statistics
   *
   * Returns usage statistics for a template.
   *
   * @param id - Template UUID
   * @param tenantId - Tenant UUID from JWT
   * @returns Template with statistics
   * @throws NotFoundException if template not found
   */
  async getTemplateStats(id: string, tenantId: string): Promise<any> {
    const template = await this.findOne(id, tenantId);

    return {
      id: template.id,
      name: template.name,
      category: template.category,
      usage_count: template.usage_count,
      is_default: template.is_default,
      is_active: template.is_active,
      created_at: template.created_at,
      updated_at: template.updated_at,
    };
  }
}
