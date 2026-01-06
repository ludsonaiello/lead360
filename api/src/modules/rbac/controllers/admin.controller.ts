import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RoleService } from '../services/role.service';
import { PermissionService } from '../services/permission.service';
import { ModuleService } from '../services/module.service';
import { RoleTemplateService } from '../services/role-template.service';
import { JwtAuthGuard } from '../../auth/guards';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { CurrentUser } from '../../auth/decorators';
import type { AuthenticatedUser } from '../../auth/entities/jwt-payload.entity';

/**
 * Admin Controller
 *
 * Platform Admin endpoints for managing RBAC system.
 * All endpoints require:
 * - JWT authentication
 * - Platform Admin privileges (is_platform_admin = true)
 *
 * Manages:
 * - Roles (create, update, delete, clone)
 * - Permissions (create, update, delete)
 * - Modules (create, update, delete, reorder)
 * - Role Templates (create, update, delete, clone, apply)
 */
@ApiTags('Admin - RBAC Management')
@Controller('admin/rbac')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly roleService: RoleService,
    private readonly permissionService: PermissionService,
    private readonly moduleService: ModuleService,
    private readonly roleTemplateService: RoleTemplateService,
  ) {}

  // ==================== ROLES ====================

  @Get('roles')
  @ApiOperation({ summary: 'Get all roles (Platform Admin)' })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted roles',
  })
  @ApiResponse({
    status: 200,
    description: 'Roles retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  async getAllRoles(@Query('includeDeleted') includeDeleted?: boolean) {
    return this.roleService.getAllRoles(includeDeleted === true);
  }

  @Get('roles/:roleId')
  @ApiOperation({ summary: 'Get role by ID (Platform Admin)' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Role retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  async getRole(@Param('roleId') roleId: string) {
    return this.roleService.getRole(roleId);
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create custom role (Platform Admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Role name (must be unique)',
          example: 'Sales Manager',
        },
        permissionIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of permission IDs',
          example: ['perm-id-1', 'perm-id-2'],
        },
      },
      required: ['name', 'permissionIds'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Role created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid permissions',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 409,
    description: 'Role name already exists',
  })
  async createRole(
    @Body('name') name: string,
    @Body('permissionIds') permissionIds: string[],
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.roleService.createRole(name, permissionIds, currentUser.id);
  }

  @Patch('roles/:roleId')
  @ApiOperation({ summary: 'Update role (Platform Admin)' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Role name (must be unique if changing)',
          example: 'Senior Sales Manager',
        },
        is_active: {
          type: 'boolean',
          description: 'Whether role is active',
          example: true,
        },
        permissionIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of permission IDs (replaces all)',
          example: ['perm-id-1', 'perm-id-2'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Role updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid permissions',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Role name already exists',
  })
  async updateRole(
    @Param('roleId') roleId: string,
    @Body()
    updates: {
      name?: string;
      is_active?: boolean;
      permissionIds?: string[];
    },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.roleService.updateRole(roleId, updates, currentUser.id);
  }

  @Delete('roles/:roleId')
  @ApiOperation({ summary: 'Soft delete role (Platform Admin)' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Role deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete role - assigned to users',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  async deleteRole(
    @Param('roleId') roleId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.roleService.deleteRole(roleId, currentUser.id);
  }

  @Post('roles/:roleId/clone')
  @ApiOperation({ summary: 'Clone role with new name (Platform Admin)' })
  @ApiParam({ name: 'roleId', description: 'Source role ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newName: {
          type: 'string',
          description: 'New role name (must be unique)',
          example: 'Custom Sales Manager',
        },
      },
      required: ['newName'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Role cloned successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Source role not found',
  })
  @ApiResponse({
    status: 409,
    description: 'New role name already exists',
  })
  async cloneRole(
    @Param('roleId') roleId: string,
    @Body('newName') newName: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.roleService.cloneRole(roleId, newName, currentUser.id);
  }

  // ==================== PERMISSIONS ====================

  @Get('permissions')
  @ApiOperation({ summary: 'Get all permissions (Platform Admin)' })
  @ApiQuery({
    name: 'moduleId',
    required: false,
    type: String,
    description: 'Filter by module ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  async getAllPermissions(@Query('moduleId') moduleId?: string) {
    return this.permissionService.getAllPermissions(moduleId);
  }

  @Get('permissions/:permissionId')
  @ApiOperation({ summary: 'Get permission by ID (Platform Admin)' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Permission not found',
  })
  async getPermission(@Param('permissionId') permissionId: string) {
    return this.permissionService.getPermission(permissionId);
  }

  @Post('permissions')
  @ApiOperation({ summary: 'Create permission (Platform Admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        moduleId: {
          type: 'string',
          description: 'Module ID',
          example: 'module-id-123',
        },
        action: {
          type: 'string',
          description: 'Action name (e.g., view, create, edit, delete)',
          example: 'export',
        },
        displayName: {
          type: 'string',
          description: 'Human-readable name',
          example: 'Export Leads',
        },
        description: {
          type: 'string',
          nullable: true,
          description: 'Optional description',
          example: 'Allows exporting leads to CSV/Excel',
        },
      },
      required: ['moduleId', 'action', 'displayName'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Permission created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Module not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Permission already exists (module + action must be unique)',
  })
  async createPermission(
    @Body('moduleId') moduleId: string,
    @Body('action') action: string,
    @Body('displayName') displayName: string,
    @Body('description') description: string | null,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.permissionService.createPermission(
      moduleId,
      action,
      displayName,
      description,
      currentUser.id,
    );
  }

  @Patch('permissions/:permissionId')
  @ApiOperation({ summary: 'Update permission (Platform Admin)' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        display_name: {
          type: 'string',
          description: 'Human-readable name',
          example: 'Export All Leads',
        },
        description: {
          type: 'string',
          nullable: true,
          description: 'Optional description',
          example: 'Allows exporting all leads to CSV/Excel/PDF',
        },
        is_active: {
          type: 'boolean',
          description: 'Whether permission is active',
          example: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Permission updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Permission not found',
  })
  async updatePermission(
    @Param('permissionId') permissionId: string,
    @Body()
    updates: {
      display_name?: string;
      description?: string | null;
      is_active?: boolean;
    },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.permissionService.updatePermission(
      permissionId,
      updates,
      currentUser.id,
    );
  }

  @Delete('permissions/:permissionId')
  @ApiOperation({ summary: 'Delete permission (Platform Admin)' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission deleted (removed from all roles)',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Permission not found',
  })
  async deletePermission(
    @Param('permissionId') permissionId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.permissionService.deletePermission(
      permissionId,
      currentUser.id,
    );
  }

  // ==================== MODULES ====================

  @Get('modules')
  @ApiOperation({ summary: 'Get all modules (Platform Admin)' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive modules',
  })
  @ApiResponse({
    status: 200,
    description: 'Modules retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  async getAllModules(@Query('includeInactive') includeInactive?: boolean) {
    return this.moduleService.getAllModules(includeInactive === true);
  }

  @Get('modules/:moduleId')
  @ApiOperation({ summary: 'Get module by ID (Platform Admin)' })
  @ApiParam({ name: 'moduleId', description: 'Module ID' })
  @ApiResponse({
    status: 200,
    description: 'Module retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Module not found',
  })
  async getModule(@Param('moduleId') moduleId: string) {
    return this.moduleService.getModule(moduleId);
  }

  @Post('modules')
  @ApiOperation({ summary: 'Create module (Platform Admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Module name (lowercase, underscores only)',
          example: 'work_orders',
        },
        displayName: {
          type: 'string',
          description: 'Human-readable name',
          example: 'Work Orders',
        },
        description: {
          type: 'string',
          nullable: true,
          description: 'Optional description',
          example: 'Manage work orders and job tracking',
        },
        icon: {
          type: 'string',
          nullable: true,
          description: 'Optional icon name',
          example: 'Wrench',
        },
        sortOrder: {
          type: 'number',
          description: 'Display order',
          example: 10,
        },
      },
      required: ['name', 'displayName', 'sortOrder'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Module created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid module name format',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 409,
    description: 'Module name already exists',
  })
  async createModule(
    @Body('name') name: string,
    @Body('displayName') displayName: string,
    @Body('description') description: string | null,
    @Body('icon') icon: string | null,
    @Body('sortOrder') sortOrder: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.moduleService.createModule(
      name,
      displayName,
      description,
      icon,
      sortOrder,
      currentUser.id,
    );
  }

  @Patch('modules/:moduleId')
  @ApiOperation({ summary: 'Update module (Platform Admin)' })
  @ApiParam({ name: 'moduleId', description: 'Module ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        display_name: {
          type: 'string',
          description: 'Human-readable name',
          example: 'Work Order Management',
        },
        description: {
          type: 'string',
          nullable: true,
          description: 'Optional description',
        },
        icon: {
          type: 'string',
          nullable: true,
          description: 'Optional icon name',
        },
        sort_order: {
          type: 'number',
          description: 'Display order',
        },
        is_active: {
          type: 'boolean',
          description: 'Whether module is active',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Module updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Module not found',
  })
  async updateModule(
    @Param('moduleId') moduleId: string,
    @Body()
    updates: {
      display_name?: string;
      description?: string | null;
      icon?: string | null;
      sort_order?: number;
      is_active?: boolean;
    },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.moduleService.updateModule(moduleId, updates, currentUser.id);
  }

  @Delete('modules/:moduleId')
  @ApiOperation({ summary: 'Delete module (Platform Admin)' })
  @ApiParam({ name: 'moduleId', description: 'Module ID' })
  @ApiResponse({
    status: 200,
    description: 'Module deleted (cascades to permissions and roles)',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Module not found',
  })
  async deleteModule(
    @Param('moduleId') moduleId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.moduleService.deleteModule(moduleId, currentUser.id);
  }

  @Patch('modules/reorder')
  @ApiOperation({ summary: 'Reorder modules (Platform Admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        moduleOrders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              sort_order: { type: 'number' },
            },
          },
          description: 'Array of module ID and sort order pairs',
          example: [
            { id: 'module-id-1', sort_order: 1 },
            { id: 'module-id-2', sort_order: 2 },
          ],
        },
      },
      required: ['moduleOrders'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Modules reordered successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  async reorderModules(
    @Body('moduleOrders')
    moduleOrders: Array<{ id: string; sort_order: number }>,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.moduleService.reorderModules(moduleOrders, currentUser.id);
  }

  // ==================== ROLE TEMPLATES ====================

  @Get('templates')
  @ApiOperation({ summary: 'Get all role templates (Platform Admin)' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive templates',
  })
  @ApiResponse({
    status: 200,
    description: 'Role templates retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  async getAllTemplates(@Query('includeInactive') includeInactive?: boolean) {
    return this.roleTemplateService.getAllTemplates(includeInactive === true);
  }

  @Get('templates/:templateId')
  @ApiOperation({ summary: 'Get role template by ID (Platform Admin)' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Role template retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async getTemplate(@Param('templateId') templateId: string) {
    return this.roleTemplateService.getTemplate(templateId);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create custom role template (Platform Admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Template name (must be unique)',
          example: 'Custom Manager',
        },
        description: {
          type: 'string',
          nullable: true,
          description: 'Optional description',
          example: 'Custom manager role with specific permissions',
        },
        permissionIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of permission IDs',
          example: ['perm-id-1', 'perm-id-2'],
        },
      },
      required: ['name', 'permissionIds'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Role template created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid permissions',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 409,
    description: 'Template name already exists',
  })
  async createTemplate(
    @Body('name') name: string,
    @Body('description') description: string | null,
    @Body('permissionIds') permissionIds: string[],
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.roleTemplateService.createTemplate(
      name,
      description,
      permissionIds,
      currentUser.id,
    );
  }

  @Patch('templates/:templateId')
  @ApiOperation({ summary: 'Update custom role template (Platform Admin)' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Template name (must be unique if changing)',
        },
        description: {
          type: 'string',
          nullable: true,
          description: 'Optional description',
        },
        permissionIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of permission IDs (replaces all)',
        },
        is_active: {
          type: 'boolean',
          description: 'Whether template is active',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Role template updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid permissions',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required or system template',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Template name already exists',
  })
  async updateTemplate(
    @Param('templateId') templateId: string,
    @Body()
    updates: {
      name?: string;
      description?: string | null;
      permissionIds?: string[];
      is_active?: boolean;
    },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.roleTemplateService.updateTemplate(
      templateId,
      updates,
      currentUser.id,
    );
  }

  @Delete('templates/:templateId')
  @ApiOperation({ summary: 'Delete custom role template (Platform Admin)' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Role template deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required or system template',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async deleteTemplate(
    @Param('templateId') templateId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.roleTemplateService.deleteTemplate(templateId, currentUser.id);
  }

  @Post('templates/:templateId/apply')
  @ApiOperation({ summary: 'Create role from template (Platform Admin)' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        roleName: {
          type: 'string',
          description: 'New role name (must be unique)',
          example: 'Custom Sales Manager',
        },
      },
      required: ['roleName'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Role created from template successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Template is inactive',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Role name already exists',
  })
  async applyTemplate(
    @Param('templateId') templateId: string,
    @Body('roleName') roleName: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.roleTemplateService.applyTemplate(
      templateId,
      roleName,
      currentUser.id,
    );
  }

  @Post('templates/:templateId/clone')
  @ApiOperation({ summary: 'Clone role template (Platform Admin)' })
  @ApiParam({ name: 'templateId', description: 'Source template ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newName: {
          type: 'string',
          description: 'New template name (must be unique)',
          example: 'Custom Manager v2',
        },
      },
      required: ['newName'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Role template cloned successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Source template not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Template name already exists',
  })
  async cloneTemplate(
    @Param('templateId') templateId: string,
    @Body('newName') newName: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.roleTemplateService.cloneTemplate(
      templateId,
      newName,
      currentUser.id,
    );
  }
}
