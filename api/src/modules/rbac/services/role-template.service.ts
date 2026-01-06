import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Role Template Service - Role Template Management
 *
 * Role templates are pre-defined permission sets that can be:
 * - Used to quickly create new roles
 * - Applied to existing roles
 * - Cloned and customized
 *
 * System templates (created during seed) cannot be modified/deleted.
 * Custom templates can be created by Platform Admins.
 *
 * Handles:
 * - Listing templates (system + custom)
 * - Creating custom templates
 * - Updating custom templates
 * - Deleting custom templates
 * - Applying templates to roles (create new role from template)
 * - Audit logging
 */
@Injectable()
export class RoleTemplateService {
  private readonly logger = new Logger(RoleTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all role templates
   *
   * @param includeInactive - Whether to include inactive templates
   */
  async getAllTemplates(includeInactive = false) {
    return this.prisma.roleTemplate.findMany({
      where: includeInactive ? {} : { is_active: true },
      include: {
        template_permissions: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
          orderBy: {
            permission: {
              module: { sort_order: 'asc' },
            },
          },
        },
        _count: {
          select: {
            template_permissions: true,
          },
        },
      },
      orderBy: [{ is_system_template: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Get single template by ID
   */
  async getTemplate(templateId: string) {
    const template = await this.prisma.roleTemplate.findUnique({
      where: { id: templateId },
      include: {
        template_permissions: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
          orderBy: {
            permission: {
              module: { sort_order: 'asc' },
            },
          },
        },
        _count: {
          select: {
            template_permissions: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template not found`);
    }

    return template;
  }

  /**
   * Get template by name
   */
  async getTemplateByName(name: string) {
    const template = await this.prisma.roleTemplate.findUnique({
      where: { name },
      include: {
        template_permissions: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template "${name}" not found`);
    }

    return template;
  }

  /**
   * Create custom role template (Platform Admin only)
   *
   * @param name - Template name (must be unique)
   * @param description - Template description
   * @param permissionIds - Array of permission IDs to include
   * @param createdByUserId - Platform Admin user ID
   */
  async createTemplate(
    name: string,
    description: string | null,
    permissionIds: string[],
    createdByUserId: string,
  ) {
    // Verify creator is Platform Admin
    const creator = await this.prisma.user.findUnique({
      where: { id: createdByUserId },
      select: { is_platform_admin: true },
    });

    if (!creator?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can create role templates',
      );
    }

    // Check if name already exists
    const existing = await this.prisma.roleTemplate.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException(`Template "${name}" already exists`);
    }

    // Verify all permissions exist
    const permissions = await this.prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
      },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissions not found');
    }

    // Create template + assign permissions (atomic transaction)
    const template = await this.prisma.$transaction(async (tx) => {
      // Create template
      const newTemplate = await tx.roleTemplate.create({
        data: {
          name,
          description,
          is_system_template: false,
          is_active: true,
          created_by_user_id: createdByUserId,
        },
      });

      // Assign permissions
      await tx.roleTemplatePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          role_template_id: newTemplate.id,
          permission_id: permissionId,
        })),
      });

      // Return template with permissions
      return tx.roleTemplate.findUnique({
        where: { id: newTemplate.id },
        include: {
          template_permissions: {
            include: {
              permission: {
                include: {
                  module: true,
                },
              },
            },
          },
        },
      });
    });

    if (!template) {
      throw new InternalServerErrorException('Failed to create template');
    }

    // Audit log
    await this.createAuditLog(
      null,
      createdByUserId,
      'role_template',
      template.id,
      'template_created',
      null,
      {
        name,
        permission_count: permissionIds.length,
      },
    );

    this.logger.log(
      `Role template "${name}" created by Platform Admin ${createdByUserId} with ${permissionIds.length} permissions`,
    );

    return template;
  }

  /**
   * Update custom role template
   *
   * Can update: name, description, permissions, is_active
   * CANNOT update: is_system_template flag
   * CANNOT modify system templates
   */
  async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      description?: string | null;
      permissionIds?: string[];
      is_active?: boolean;
    },
    updatedByUserId: string,
  ) {
    // Get existing template
    const template = await this.prisma.roleTemplate.findUnique({
      where: { id: templateId },
      include: {
        template_permissions: true,
      },
    });

    if (!template) {
      throw new NotFoundException(`Template not found`);
    }

    // Cannot modify system templates
    if (template.is_system_template) {
      throw new ForbiddenException('Cannot modify system templates');
    }

    // Verify updater is Platform Admin
    const updater = await this.prisma.user.findUnique({
      where: { id: updatedByUserId },
      select: { is_platform_admin: true },
    });

    if (!updater?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can update role templates',
      );
    }

    // If changing name, verify uniqueness
    if (updates.name && updates.name !== template.name) {
      const existing = await this.prisma.roleTemplate.findUnique({
        where: { name: updates.name },
      });

      if (existing) {
        throw new ConflictException(`Template "${updates.name}" already exists`);
      }
    }

    // Verify permissions if updating
    if (updates.permissionIds) {
      const permissions = await this.prisma.permission.findMany({
        where: {
          id: { in: updates.permissionIds },
        },
      });

      if (permissions.length !== updates.permissionIds.length) {
        throw new BadRequestException('One or more permissions not found');
      }
    }

    // Update template + permissions (atomic transaction)
    const updatedTemplate = await this.prisma.$transaction(async (tx) => {
      // Update template metadata
      const updated = await tx.roleTemplate.update({
        where: { id: templateId },
        data: {
          name: updates.name,
          description: updates.description,
          is_active: updates.is_active,
        },
      });

      // Update permissions if provided
      if (updates.permissionIds) {
        // Delete existing permissions
        await tx.roleTemplatePermission.deleteMany({
          where: { role_template_id: templateId },
        });

        // Add new permissions
        await tx.roleTemplatePermission.createMany({
          data: updates.permissionIds.map((permissionId) => ({
            role_template_id: templateId,
            permission_id: permissionId,
          })),
        });
      }

      // Return updated template with permissions
      return tx.roleTemplate.findUnique({
        where: { id: templateId },
        include: {
          template_permissions: {
            include: {
              permission: {
                include: {
                  module: true,
                },
              },
            },
          },
        },
      });
    });

    // Audit log
    await this.createAuditLog(
      null,
      updatedByUserId,
      'role_template',
      templateId,
      'template_updated',
      {
        name: template.name,
        description: template.description,
        is_active: template.is_active,
        permission_count: template.template_permissions.length,
      },
      {
        name: updates.name ?? template.name,
        description: updates.description ?? template.description,
        is_active: updates.is_active ?? template.is_active,
        permission_count:
          updates.permissionIds?.length ??
          template.template_permissions.length,
      },
    );

    this.logger.log(`Role template ${templateId} updated by ${updatedByUserId}`);

    return updatedTemplate;
  }

  /**
   * Delete custom role template
   *
   * CANNOT delete system templates
   */
  async deleteTemplate(templateId: string, deletedByUserId: string) {
    // Get template
    const template = await this.prisma.roleTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template not found`);
    }

    // Cannot delete system templates
    if (template.is_system_template) {
      throw new ForbiddenException('Cannot delete system templates');
    }

    // Verify deleter is Platform Admin
    const deleter = await this.prisma.user.findUnique({
      where: { id: deletedByUserId },
      select: { is_platform_admin: true },
    });

    if (!deleter?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can delete role templates',
      );
    }

    // Delete template (CASCADE will delete template_permissions)
    await this.prisma.roleTemplate.delete({
      where: { id: templateId },
    });

    // Audit log
    await this.createAuditLog(
      null,
      deletedByUserId,
      'role_template',
      templateId,
      'template_deleted',
      { name: template.name },
      null,
    );

    this.logger.log(
      `Role template "${template.name}" deleted by ${deletedByUserId}`,
    );

    return { message: 'Template deleted successfully' };
  }

  /**
   * Apply template to create new role
   *
   * Creates a new role with all permissions from the template
   */
  async applyTemplate(
    templateId: string,
    newRoleName: string,
    appliedByUserId: string,
  ) {
    // Get template
    const template = await this.prisma.roleTemplate.findUnique({
      where: { id: templateId },
      include: {
        template_permissions: true,
      },
    });

    if (!template) {
      throw new NotFoundException(`Template not found`);
    }

    if (!template.is_active) {
      throw new BadRequestException('Cannot apply inactive template');
    }

    // Verify applier is Platform Admin
    const applier = await this.prisma.user.findUnique({
      where: { id: appliedByUserId },
      select: { is_platform_admin: true },
    });

    if (!applier?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can apply role templates',
      );
    }

    // Check if role name already exists
    const existing = await this.prisma.role.findUnique({
      where: { name: newRoleName },
    });

    if (existing) {
      throw new ConflictException(`Role "${newRoleName}" already exists`);
    }

    // Create role + assign permissions (atomic transaction)
    const role = await this.prisma.$transaction(async (tx) => {
      // Create role
      const newRole = await tx.role.create({
        data: {
          name: newRoleName,
          is_system: false,
          is_active: true,
          created_by_user_id: appliedByUserId,
        },
      });

      // Copy permissions from template
      if (template.template_permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: template.template_permissions.map((rtp) => ({
            role_id: newRole.id,
            permission_id: rtp.permission_id,
            granted_by_user_id: appliedByUserId,
          })),
        });
      }

      // Return new role with permissions
      return tx.role.findUnique({
        where: { id: newRole.id },
        include: {
          role_permissions: {
            include: {
              permission: {
                include: {
                  module: true,
                },
              },
            },
          },
        },
      });
    });

    if (!role) {
      throw new InternalServerErrorException('Failed to create role from template');
    }

    // Audit log
    await this.createAuditLog(
      null,
      appliedByUserId,
      'role',
      role.id,
      'role_created_from_template',
      null,
      {
        template_id: templateId,
        template_name: template.name,
        role_name: newRoleName,
        permission_count: template.template_permissions.length,
      },
    );

    this.logger.log(
      `Role "${newRoleName}" created from template "${template.name}" by ${appliedByUserId} with ${template.template_permissions.length} permissions`,
    );

    return role;
  }

  /**
   * Clone template (duplicate with new name)
   */
  async cloneTemplate(
    sourceTemplateId: string,
    newName: string,
    clonedByUserId: string,
  ) {
    // Get source template
    const sourceTemplate = await this.prisma.roleTemplate.findUnique({
      where: { id: sourceTemplateId },
      include: {
        template_permissions: true,
      },
    });

    if (!sourceTemplate) {
      throw new NotFoundException(`Source template not found`);
    }

    // Check if new name already exists
    const existing = await this.prisma.roleTemplate.findUnique({
      where: { name: newName },
    });

    if (existing) {
      throw new ConflictException(`Template "${newName}" already exists`);
    }

    // Verify cloner is Platform Admin
    const cloner = await this.prisma.user.findUnique({
      where: { id: clonedByUserId },
      select: { is_platform_admin: true },
    });

    if (!cloner?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can clone role templates',
      );
    }

    // Clone template + permissions (atomic transaction)
    const clonedTemplate = await this.prisma.$transaction(async (tx) => {
      // Create new template
      const newTemplate = await tx.roleTemplate.create({
        data: {
          name: newName,
          description: sourceTemplate.description,
          is_system_template: false, // Cloned templates are never system templates
          is_active: true,
          created_by_user_id: clonedByUserId,
        },
      });

      // Copy permissions
      if (sourceTemplate.template_permissions.length > 0) {
        await tx.roleTemplatePermission.createMany({
          data: sourceTemplate.template_permissions.map((rtp) => ({
            role_template_id: newTemplate.id,
            permission_id: rtp.permission_id,
          })),
        });
      }

      // Return cloned template with permissions
      return tx.roleTemplate.findUnique({
        where: { id: newTemplate.id },
        include: {
          template_permissions: {
            include: {
              permission: {
                include: {
                  module: true,
                },
              },
            },
          },
        },
      });
    });

    if (!clonedTemplate) {
      throw new InternalServerErrorException('Failed to clone template');
    }

    // Audit log
    await this.createAuditLog(
      null,
      clonedByUserId,
      'role_template',
      clonedTemplate.id,
      'template_cloned',
      null,
      {
        source_template_id: sourceTemplateId,
        source_template_name: sourceTemplate.name,
        new_template_name: newName,
        permission_count: sourceTemplate.template_permissions.length,
      },
    );

    this.logger.log(
      `Template "${sourceTemplate.name}" cloned to "${newName}" by ${clonedByUserId} with ${sourceTemplate.template_permissions.length} permissions`,
    );

    return clonedTemplate;
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    tenantId: string | null,
    actorUserId: string,
    entityType: string,
    entityId: string,
    action: string,
    beforeJson: any,
    afterJson: any,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: actorUserId,
          actor_type: 'user',
          entity_type: entityType,
          entity_id: entityId,
          action_type: action,
          description: `Role template ${action}`,
          before_json: beforeJson,
          after_json: afterJson,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
      // Don't throw - audit log failure shouldn't break the operation
    }
  }
}
