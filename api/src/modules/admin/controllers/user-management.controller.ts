import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

@ApiTags('Admin - User Management')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class UserManagementController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * GET /admin/users
   * List all users across all tenants with filters
   */
  @Get()
  @ApiOperation({
    summary: 'List all users',
    description:
      'Get paginated list of users across all tenants with optional filters',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'tenant_id',
    required: false,
    type: String,
    description: 'Filter by tenant ID',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    type: String,
    description: 'Filter by role name',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'deleted'],
  })
  @ApiQuery({
    name: 'last_login_from',
    required: false,
    type: String,
    description: 'ISO date string',
  })
  @ApiQuery({
    name: 'last_login_to',
    required: false,
    type: String,
    description: 'ISO date string',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search email or name',
  })
  @ApiResponse({
    status: 200,
    description: 'Users list retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              is_active: { type: 'boolean' },
              is_platform_admin: { type: 'boolean' },
              tenant_id: { type: 'string', nullable: true },
              tenant_subdomain: { type: 'string', nullable: true },
              roles: { type: 'array', items: { type: 'string' } },
              last_login_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            total_pages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async listUsers(@Query() filters: any) {
    const page = parseInt(filters.page) || 1;
    const limit = Math.min(parseInt(filters.limit) || 20, 100); // Max 100
    const skip = (page - 1) * limit;

    const where: any = {};

    // Tenant filter
    if (filters.tenant_id) {
      where.tenant_id = filters.tenant_id;
    }

    // Status filter
    if (filters.status === 'active') {
      where.is_active = true;
      where.deleted_at = null;
    } else if (filters.status === 'inactive') {
      where.is_active = false;
      where.deleted_at = null;
    } else if (filters.status === 'deleted') {
      where.deleted_at = { not: null };
    } else {
      where.deleted_at = null; // Default: exclude deleted
    }

    // Last login filter
    if (filters.last_login_from || filters.last_login_to) {
      where.last_login_at = {};
      if (filters.last_login_from) {
        where.last_login_at.gte = new Date(filters.last_login_from);
      }
      if (filters.last_login_to) {
        where.last_login_at.lte = new Date(filters.last_login_to);
      }
    }

    // Search filter
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search } },
        { first_name: { contains: filters.search } },
        { last_name: { contains: filters.search } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          tenant: {
            select: {
              subdomain: true,
              company_name: true,
            },
          },
          user_role_user_role_user_idTouser: {
            include: {
              role: {
                select: { name: true },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
        is_platform_admin: user.is_platform_admin,
        tenant_id: user.tenant_id ?? undefined,
        tenant_subdomain: user.tenant?.subdomain,
        tenant_company_name: user.tenant?.company_name,
        roles: user.user_role_user_role_user_idTouser.map((ur) => ur.role.name),
        last_login_at: user.last_login_at,
        created_at: user.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /admin/users/:id
   * Get user details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get user details',
    description: 'Get full user details including roles and activity',
  })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        phone: { type: 'string', nullable: true },
        is_active: { type: 'boolean' },
        is_platform_admin: { type: 'boolean' },
        email_verified: { type: 'boolean' },
        tenant_id: { type: 'string', nullable: true },
        tenant: { type: 'object', nullable: true },
        roles: { type: 'array', items: { type: 'object' } },
        last_login_at: { type: 'string', format: 'date-time', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async getUserDetails(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        tenant: true,
        user_role_user_role_user_idTouser: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      is_active: user.is_active,
      is_platform_admin: user.is_platform_admin,
      email_verified: user.email_verified,
      tenant_id: user.tenant_id ?? undefined,
      tenant: user.tenant,
      roles: user.user_role_user_role_user_idTouser.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description,
        assigned_at: ur.created_at,
      })),
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * POST /admin/users/:id/reset-password
   * Force password reset for user
   */
  @Post(':id/reset-password')
  @ApiOperation({
    summary: 'Force password reset',
    description: 'Send password reset email to user (admin-initiated)',
  })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async resetPassword(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, tenant_id: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Use AuthService to send password reset email
    await this.authService.forgotPassword({ email: user.email });

    // Audit log
    await this.auditLogger.log({
      tenant_id: user.tenant_id ?? undefined,
      actor_user_id: req.user.id,
      actor_type: 'platform_admin',
      entity_type: 'user',
      entity_id: id,
      action_type: 'updated',
      description: `Platform Admin initiated password reset for ${user.email}`,
      status: 'success',
    });

    return {
      message: 'Password reset email sent successfully',
      email: user.email,
    };
  }

  /**
   * POST /admin/users/:id/deactivate
   * Deactivate user account
   */
  @Post(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate user',
    description: 'Set user account to inactive',
  })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User is already inactive' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async deactivateUser(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, is_active: true, tenant_id: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.is_active) {
      throw new Error('User is already inactive');
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });

    // Invalidate user's sessions
    await this.prisma.refresh_token.deleteMany({
      where: { user_id: id },
    });

    // Audit log
    await this.auditLogger.log({
      tenant_id: user.tenant_id ?? undefined,
      actor_user_id: req.user.id,
      actor_type: 'platform_admin',
      entity_type: 'user',
      entity_id: id,
      action_type: 'updated',
      description: `User ${user.email} deactivated by Platform Admin`,
      before_json: { is_active: true },
      after_json: { is_active: false },
      status: 'success',
    });

    return {
      message: 'User deactivated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        is_active: updatedUser.is_active,
      },
    };
  }

  /**
   * POST /admin/users/:id/activate
   * Activate user account
   */
  @Post(':id/activate')
  @ApiOperation({
    summary: 'Activate user',
    description: 'Set user account to active',
  })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User is already active' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async activateUser(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, is_active: true, tenant_id: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.is_active) {
      throw new Error('User is already active');
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        is_active: true,
        updated_at: new Date(),
      },
    });

    // Audit log
    await this.auditLogger.log({
      tenant_id: user.tenant_id ?? undefined,
      actor_user_id: req.user.id,
      actor_type: 'platform_admin',
      entity_type: 'user',
      entity_id: id,
      action_type: 'updated',
      description: `User ${user.email} activated by Platform Admin`,
      before_json: { is_active: false },
      after_json: { is_active: true },
      status: 'success',
    });

    return {
      message: 'User activated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        is_active: updatedUser.is_active,
      },
    };
  }

  /**
   * DELETE /admin/users/:id
   * Soft delete user
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete user',
    description: 'Soft delete user (sets deleted_at timestamp)',
  })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User is already deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async deleteUser(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, deleted_at: true, tenant_id: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.deleted_at) {
      throw new Error('User is already deleted');
    }

    // Soft delete user
    const deletedUser = await this.prisma.user.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        is_active: false,
        updated_at: new Date(),
      },
    });

    // Invalidate user's sessions
    await this.prisma.refresh_token.deleteMany({
      where: { user_id: id },
    });

    // Audit log
    await this.auditLogger.log({
      tenant_id: user.tenant_id ?? undefined,
      actor_user_id: req.user.id,
      actor_type: 'platform_admin',
      entity_type: 'user',
      entity_id: id,
      action_type: 'deleted',
      description: `User ${user.email} deleted by Platform Admin`,
      before_json: { deleted_at: null },
      after_json: { deleted_at: deletedUser.deleted_at },
      status: 'success',
    });

    return {
      message: 'User deleted successfully',
      user: {
        id: deletedUser.id,
        email: deletedUser.email,
        deleted_at: deletedUser.deleted_at,
      },
    };
  }
}
