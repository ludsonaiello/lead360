import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RoleService } from '../services/role.service';
import { JwtAuthGuard } from '../../auth/guards';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

/**
 * Roles Controller — Tenant-Scoped Role Listing
 *
 * Lightweight endpoint for tenant Owner/Admin to get available roles
 * for dropdowns (invite user, change role). Returns only id, name,
 * description — no permissions, no counts, no internal RBAC data.
 *
 * Route: GET /api/v1/rbac/roles
 * Guard: JwtAuthGuard + RolesGuard (Owner, Admin)
 */
@ApiTags('Roles')
@Controller('rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly roleService: RoleService) {}

  @Get('roles')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List all active roles (for dropdowns)' })
  @ApiResponse({ status: 200, description: 'Active roles list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Owner or Admin role required' })
  async listRoles() {
    return this.roleService.listActiveRoles();
  }
}
