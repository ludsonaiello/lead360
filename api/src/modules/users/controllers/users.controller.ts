import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { AuthService } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { InviteUserDto } from '../dto/invite-user.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { DeactivateUserDto } from '../dto/deactivate-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateMeDto } from '../dto/update-me.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import type { AuthenticatedUser } from '../../auth/entities/jwt-payload.entity';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  // ── Invite flow — authenticated Owner/Admin ─────────────────────────────

  @Post('invite')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Invite a user to the tenant' })
  @ApiResponse({ status: 201, description: 'Invite created and email sent' })
  @ApiResponse({
    status: 409,
    description: 'Email already has active membership in this tenant',
  })
  async inviteUser(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: InviteUserDto,
  ) {
    return this.usersService.inviteUser(tenantId, actor.id, dto);
  }

  // ── Invite flow — unauthenticated ────────────────────────────────────────

  @Public()
  @Get('invite/:token')
  @ApiOperation({ summary: 'Validate invite token and return invite info' })
  @ApiResponse({ status: 200, description: 'Invite info returned' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  @ApiResponse({ status: 410, description: 'Token expired' })
  @ApiResponse({ status: 409, description: 'Token already used' })
  async getInviteInfo(@Param('token') token: string) {
    return this.usersService.validateInviteToken(token);
  }

  @Public()
  @Post('invite/:token/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Accept invite, set password, activate membership',
  })
  @ApiResponse({
    status: 201,
    description: 'Membership activated, JWT returned',
  })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  @ApiResponse({ status: 410, description: 'Token expired' })
  @ApiResponse({
    status: 409,
    description: 'Token already used or user active in another org',
  })
  async acceptInvite(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
  ) {
    const data = await this.usersService.acceptInvite(token, dto);

    // Issue JWT for the newly activated user
    const { access_token, refresh_token } =
      await this.authService.issueTokensForMembership(
        data.user_id,
        data.membership_id,
        data.tenant_id,
        [data.role_name],
        data.user_email,
        false,
      );

    return {
      access_token,
      refresh_token,
      user: {
        id: data.user_id,
        first_name: data.user_first_name,
        last_name: data.user_last_name,
        email: data.user_email,
      },
      tenant: {
        id: data.tenant_id,
        company_name: data.tenant_name,
      },
      role: data.role_name,
    };
  }

  // ── Self-service — any authenticated user ────────────────────────────────
  // IMPORTANT: /me routes MUST be declared BEFORE /:id routes (NestJS route matching)

  @Get('me')
  @ApiOperation({ summary: 'Get own profile and current membership' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    if (!user.membershipId) {
      throw new BadRequestException(
        'No active membership found. Platform admins without a membership cannot access this endpoint.',
      );
    }
    return this.usersService.getMe(user.id, user.membershipId);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update own profile (first_name, last_name, phone, avatar_url)',
  })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMeDto,
  ) {
    await this.usersService.updateMe(user.id, dto);
    return { message: 'Profile updated.' };
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password (requires current password)' })
  @ApiResponse({
    status: 400,
    description: 'Current password incorrect',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(user.id, dto);
    return { message: 'Password updated.' };
  }

  // ── User management — Owner/Admin ────────────────────────────────────────

  @Get()
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List all users in the tenant (paginated)' })
  async listUsers(
    @TenantId() tenantId: string,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.usersService.listUsers(tenantId, query);
  }

  @Get(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get a single user membership by ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  async getUserById(
    @TenantId() tenantId: string,
    @Param('id') membershipId: string,
  ) {
    return this.usersService.getUserById(tenantId, membershipId);
  }

  @Patch(':id/role')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Change role of a user membership' })
  @ApiResponse({ status: 200 })
  @ApiResponse({
    status: 403,
    description: 'Cannot change Owner role without Owner privilege',
  })
  async changeRole(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') membershipId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.changeRole(tenantId, membershipId, actor, dto);
  }

  @Patch(':id/deactivate')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Deactivate user and immediately revoke their JWT',
  })
  @ApiResponse({ status: 200, description: 'User deactivated, JWT revoked' })
  @ApiResponse({
    status: 400,
    description: 'Cannot deactivate last Owner',
  })
  async deactivateUser(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') membershipId: string,
    @Body() dto: DeactivateUserDto,
  ) {
    return this.usersService.deactivateUser(
      tenantId,
      membershipId,
      actor.id,
      dto,
    );
  }

  @Patch(':id/reactivate')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Reactivate an inactive user membership' })
  @ApiResponse({ status: 200 })
  @ApiResponse({
    status: 409,
    description: 'User is currently active in another organization',
  })
  async reactivateUser(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') membershipId: string,
  ) {
    return this.usersService.reactivateUser(tenantId, membershipId, actor.id);
  }

  @Delete(':id')
  @Roles('Owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a user (Owner only). Soft or hard delete based on history.',
  })
  @ApiResponse({ status: 204, description: 'User deleted' })
  async deleteUser(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') membershipId: string,
  ) {
    await this.usersService.deleteUser(tenantId, membershipId, actor.id);
  }
}
