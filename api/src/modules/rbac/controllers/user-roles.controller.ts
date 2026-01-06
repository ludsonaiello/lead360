import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { UserRoleService } from '../services/user-role.service';
import { RBACService } from '../services/rbac.service';
import { JwtAuthGuard } from '../../auth/guards';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../auth/decorators';
import type { AuthenticatedUser } from '../../auth/entities/jwt-payload.entity';

/**
 * User Roles Controller
 *
 * Handles user-role assignments for Owner/Admin users.
 * Endpoints for managing roles within a tenant.
 *
 * All endpoints require:
 * - JWT authentication
 * - Tenant resolution
 * - Owner or Admin role
 */
@ApiTags('User Roles')
@Controller('user-roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UserRolesController {
  constructor(
    private readonly userRoleService: UserRoleService,
    private readonly rbacService: RBACService,
  ) {}

  /**
   * Get user's roles in current tenant
   */
  @Get(':userId')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get user roles in current tenant' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User roles retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Owner or Admin role required',
  })
  async getUserRoles(
    @Param('userId') userId: string,
    @TenantId() tenantId: string,
  ) {
    return this.userRoleService.getUserRoles(userId, tenantId);
  }

  /**
   * Get user's permissions in current tenant
   */
  @Get(':userId/permissions')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get all permissions user has in current tenant' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User permissions retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Owner or Admin role required',
  })
  async getUserPermissions(
    @Param('userId') userId: string,
    @TenantId() tenantId: string,
  ) {
    return this.rbacService.getUserPermissions(userId, tenantId);
  }

  /**
   * Assign role to user
   */
  @Post(':userId/roles/:roleId')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign role to user in current tenant' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({
    status: 201,
    description: 'Role assigned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid user or role',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Owner or Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'User or role not found',
  })
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @TenantId() tenantId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.userRoleService.assignRoleToUser(
      userId,
      tenantId,
      roleId,
      currentUser.id,
    );
  }

  /**
   * Remove role from user
   */
  @Delete(':userId/roles/:roleId')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Remove role from user in current tenant' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Role removed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot remove last Owner',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Owner or Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'User does not have this role',
  })
  async removeRoleFromUser(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @TenantId() tenantId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.userRoleService.removeRoleFromUser(
      userId,
      tenantId,
      roleId,
      currentUser.id,
    );
  }

  /**
   * Replace all user's roles (atomic operation)
   */
  @Patch(':userId/roles')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Replace all user roles in current tenant' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        roleIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of role IDs to assign',
          example: ['role-id-1', 'role-id-2'],
        },
      },
      required: ['roleIds'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User roles updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot remove last Owner',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Owner or Admin role required',
  })
  async replaceUserRoles(
    @Param('userId') userId: string,
    @Body('roleIds') roleIds: string[],
    @TenantId() tenantId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.userRoleService.replaceUserRoles(
      userId,
      tenantId,
      roleIds,
      currentUser.id,
    );
  }

  /**
   * Batch assign roles to multiple users
   */
  @Post('batch/assign')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign roles to multiple users in current tenant' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of user IDs',
          example: ['user-id-1', 'user-id-2'],
        },
        roleIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of role IDs to assign',
          example: ['role-id-1', 'role-id-2'],
        },
      },
      required: ['userIds', 'roleIds'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Roles assigned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid users or roles',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Owner or Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'One or more users or roles not found',
  })
  async batchAssignRoles(
    @Body('userIds') userIds: string[],
    @Body('roleIds') roleIds: string[],
    @TenantId() tenantId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.userRoleService.batchAssignRoles(
      userIds,
      roleIds,
      tenantId,
      currentUser.id,
    );
  }

  /**
   * Get all users with specific role in current tenant
   */
  @Get('role/:roleId/users')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get all users with specific role in current tenant' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Owner or Admin role required',
  })
  async getUsersWithRole(
    @Param('roleId') roleId: string,
    @TenantId() tenantId: string,
  ) {
    return this.userRoleService.getUsersWithRole(tenantId, roleId);
  }

  /**
   * Get permission matrix (all roles and their permissions)
   */
  @Get('permissions/matrix')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get permission matrix (all roles and permissions)' })
  @ApiResponse({
    status: 200,
    description: 'Permission matrix retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Owner or Admin role required',
  })
  async getPermissionMatrix() {
    return this.rbacService.getPermissionMatrix();
  }
}
