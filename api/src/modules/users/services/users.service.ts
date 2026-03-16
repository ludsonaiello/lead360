import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { randomBytes, randomUUID, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Prisma, MembershipStatus } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { TokenBlocklistService } from '../../../core/token-blocklist/token-blocklist.service';
import { SendEmailService } from '../../communication/services/send-email.service';
import { ConfigService } from '@nestjs/config';
import { InviteUserDto } from '../dto/invite-user.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { DeactivateUserDto } from '../dto/deactivate-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateMeDto } from '../dto/update-me.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { InviteResponseDto } from '../dto/invite-response.dto';
import { MembershipResponseDto, PaginatedMembershipsDto } from '../dto/membership-response.dto';
import { UserMeResponseDto } from '../dto/user-me-response.dto';
import { InviteTokenInfoDto } from '../dto/invite-token-info.dto';

@Injectable()
export class UsersService {
  private readonly INVITE_TOKEN_TTL_HOURS = 72;
  private readonly BCRYPT_ROUNDS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly tokenBlocklist: TokenBlocklistService,
    private readonly sendEmailService: SendEmailService,
    private readonly configService: ConfigService,
  ) {}

  // ─── INVITE USER ──────────────────────────────────────────────────────────────

  async inviteUser(
    tenantId: string,
    actorUserId: string,
    dto: InviteUserDto,
  ): Promise<InviteResponseDto> {
    // Step 1: Validate role exists
    const role = await this.prisma.role.findUnique({ where: { id: dto.role_id } });
    if (!role) throw new NotFoundException('Role not found.');

    // Step 2: Check if this email already has an ACTIVE membership in this tenant (409)
    const existingActive = await this.prisma.user_tenant_membership.findFirst({
      where: {
        tenant_id: tenantId,
        status: 'ACTIVE',
        user: { email: dto.email },
      },
    });
    if (existingActive) {
      throw new ConflictException('This email already has an active membership in this organization.');
    }

    // Step 3: Find or create the user record — BR-12: link existing user, never duplicate
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Step 4: Generate invite token — SHA-256 for O(1) indexed lookup
    const rawToken = randomBytes(32).toString('hex'); // 64-char hex string
    const tokenHash = createHash('sha256').update(rawToken).digest('hex'); // 64-char SHA-256 hex
    const expiresAt = new Date(Date.now() + this.INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    // Step 5: Atomic — create user (if new) + membership in one transaction
    let membershipId: string;
    await this.prisma.$transaction(async (tx) => {
      if (!user) {
        user = await tx.user.create({
          data: {
            id: randomUUID(),
            email: dto.email,
            first_name: dto.first_name,
            last_name: dto.last_name,
            password_hash: '', // Set when invite is accepted
            is_active: false,
            updated_at: new Date(),
          },
        });
      }

      const membership = await tx.user_tenant_membership.create({
        data: {
          user_id: user!.id,
          tenant_id: tenantId,
          role_id: dto.role_id,
          status: 'INVITED',
          invite_token_hash: tokenHash,
          invite_token_expires_at: expiresAt,
          invited_by_user_id: actorUserId,
        },
      });
      membershipId = membership.id;
    });

    // Step 6: Resolve tenant name and inviter name, then dispatch via existing email infrastructure
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { company_name: true },
    });
    const inviter = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { first_name: true, last_name: true },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'https://app.lead360.app';
    const inviteLink = `${frontendUrl}/invite/${rawToken}`;

    await this.sendEmailService.sendTemplated(
      tenantId,
      {
        to: dto.email,
        template_key: 'user-invite',
        variables: {
          first_name: dto.first_name,
          last_name: dto.last_name,
          invite_link: inviteLink,
          tenant_name: tenant?.company_name ?? 'Lead360',
          inviter_name: inviter ? `${inviter.first_name} ${inviter.last_name}` : 'Your administrator',
          role_name: role.name,
          expires_at: expiresAt.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          }),
        },
        related_entity_type: 'user_tenant_membership',
        related_entity_id: membershipId!,
      },
      actorUserId,
    );

    // Step 7: Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'UserMembership',
      entityId: membershipId!,
      tenantId,
      actorUserId,
      after: { email: dto.email, role: role.name, status: 'INVITED' },
      description: `Invited ${dto.email} as ${role.name}`,
    });

    return {
      id: membershipId!,
      user_id: user!.id,
      email: user!.email,
      first_name: user!.first_name,
      last_name: user!.last_name,
      role: { id: role.id, name: role.name },
      status: 'INVITED',
      created_at: new Date().toISOString(),
    };
  }

  // ─── VALIDATE INVITE TOKEN ────────────────────────────────────────────────────

  async validateInviteToken(rawToken: string): Promise<InviteTokenInfoDto> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Direct index lookup — invite_token_hash has @unique constraint
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { invite_token_hash: tokenHash },
      include: {
        user: true,
        tenant: true,
        role: true,
        invited_by: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Invalid invite token.');
    }

    // Check if already accepted before checking expiry — more specific error
    if (membership.invite_accepted_at !== null) {
      throw new ConflictException('This invite link has already been used.');
    }

    if (membership.invite_token_expires_at! < new Date()) {
      throw new GoneException('This invite link has expired.');
    }

    return {
      tenant_name: membership.tenant.company_name,
      role_name: membership.role.name,
      invited_by_name: membership.invited_by
        ? `${membership.invited_by.first_name} ${membership.invited_by.last_name}`
        : 'Unknown',
      email: membership.user.email,
      expires_at: membership.invite_token_expires_at!.toISOString(),
    };
  }

  // ─── ACCEPT INVITE ────────────────────────────────────────────────────────────

  async acceptInvite(
    rawToken: string,
    dto: AcceptInviteDto,
  ): Promise<{
    membership_id: string;
    user_id: string;
    tenant_id: string;
    role_name: string;
    user_email: string;
    user_first_name: string;
    user_last_name: string;
    tenant_name: string;
  }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Direct index lookup — O(1) via @unique constraint
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { invite_token_hash: tokenHash },
      include: { user: true, role: true, tenant: true },
    });

    if (!membership) {
      throw new NotFoundException('Invalid invite token.');
    }

    // Check already-accepted BEFORE expiry — more specific error (BR-05)
    if (membership.invite_accepted_at !== null) {
      throw new ConflictException('This invite link has already been used.');
    }

    if (membership.invite_token_expires_at! < new Date()) {
      throw new GoneException('This invite link has expired.');
    }

    // BR-02: Block acceptance if user already has an ACTIVE membership elsewhere
    const otherActiveMembership = await this.prisma.user_tenant_membership.findFirst({
      where: {
        user_id: membership.user_id,
        status: 'ACTIVE',
        id: { not: membership.id },
      },
    });
    if (otherActiveMembership) {
      throw new ConflictException('User is currently active in another organization.');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    // BR-05: Single-use — mark accepted_at and activate atomically
    await this.prisma.$transaction(async (tx) => {
      await tx.user_tenant_membership.update({
        where: { id: membership.id },
        data: {
          invite_accepted_at: new Date(),
          status: 'ACTIVE',
          joined_at: new Date(),
          invite_token_hash: null, // Clear hash — token is consumed
        },
      });

      await tx.user.update({
        where: { id: membership.user_id },
        data: {
          password_hash: passwordHash,
          is_active: true,
          email_verified: true,
          email_verified_at: new Date(),
          updated_at: new Date(),
        },
      });
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'UserMembership',
      entityId: membership.id,
      tenantId: membership.tenant_id,
      actorUserId: membership.user_id,
      after: { status: 'ACTIVE', joined_at: new Date() },
      description: `Invite accepted by ${membership.user.email}`,
    });

    // Return raw membership data — the controller (Sprint 7) calls AuthService to issue tokens
    return {
      membership_id: membership.id,
      user_id: membership.user_id,
      tenant_id: membership.tenant_id,
      role_name: membership.role.name,
      user_email: membership.user.email,
      user_first_name: membership.user.first_name,
      user_last_name: membership.user.last_name,
      tenant_name: membership.tenant.company_name,
    };
  }

  // ─── LIST USERS ───────────────────────────────────────────────────────────────

  async listUsers(
    tenantId: string,
    query: ListUsersQueryDto,
  ): Promise<PaginatedMembershipsDto> {
    const { page, limit, status, role_id } = query;
    const skip = (page - 1) * limit;

    // BR-07: exclude soft-deleted users via relational filter (not include.where which is invalid for to-one)
    const where: Prisma.user_tenant_membershipWhereInput = {
      tenant_id: tenantId,
      user: { deleted_at: null },
    };
    if (status) where.status = status as MembershipStatus;
    if (role_id) where.role_id = role_id;

    const [memberships, total] = await Promise.all([
      this.prisma.user_tenant_membership.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: true,
          role: true,
          invited_by: { select: { id: true, first_name: true, last_name: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user_tenant_membership.count({ where }),
    ]);

    return {
      data: memberships.map((m) => this.formatMembership(m)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // ─── GET USER BY ID ───────────────────────────────────────────────────────────

  async getUserById(
    tenantId: string,
    membershipId: string,
  ): Promise<MembershipResponseDto> {
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { id: membershipId, tenant_id: tenantId },
      include: {
        user: true,
        role: true,
        invited_by: { select: { id: true, first_name: true, last_name: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException('User membership not found in this organization.');
    }

    return this.formatMembership(membership);
  }

  // ─── CHANGE ROLE ──────────────────────────────────────────────────────────────

  async changeRole(
    tenantId: string,
    membershipId: string,
    actorUser: { id: string; roles: string[]; is_platform_admin: boolean },
    dto: UpdateUserRoleDto,
  ): Promise<MembershipResponseDto> {
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { id: membershipId, tenant_id: tenantId },
      include: { role: true },
    });

    if (!membership) throw new NotFoundException('Membership not found.');

    // BR-09: Only an Owner or platform admin can change an Owner's role
    if (
      membership.role.name === 'Owner' &&
      !actorUser.roles.includes('Owner') &&
      !actorUser.is_platform_admin
    ) {
      throw new ForbiddenException(
        'Only an Owner or platform administrator can change the role of an Owner.',
      );
    }

    const newRole = await this.prisma.role.findUnique({ where: { id: dto.role_id } });
    if (!newRole) throw new NotFoundException('Role not found.');

    const beforeRole = membership.role.name;

    const updated = await this.prisma.user_tenant_membership.update({
      where: { id: membershipId },
      data: { role_id: dto.role_id },
      include: {
        role: true,
        user: true,
        invited_by: { select: { id: true, first_name: true, last_name: true } },
      },
    });

    // BR-08: Every role change is written to audit log with before/after state
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'UserMembership',
      entityId: membershipId,
      tenantId,
      actorUserId: actorUser.id,
      before: { role: beforeRole },
      after: { role: newRole.name },
      description: `Role changed from ${beforeRole} to ${newRole.name}`,
    });

    return this.formatMembership(updated);
  }

  // ─── DEACTIVATE USER ──────────────────────────────────────────────────────────

  async deactivateUser(
    tenantId: string,
    membershipId: string,
    actorUserId: string,
    dto: DeactivateUserDto,
  ): Promise<{ id: string; status: string; left_at: string }> {
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { id: membershipId, tenant_id: tenantId, status: 'ACTIVE' },
      include: { role: true },
    });

    if (!membership) throw new NotFoundException('Active membership not found.');

    const leftAt = new Date();

    // BR-10 + deactivation inside a single transaction to prevent TOCTOU race condition
    await this.prisma.$transaction(async (tx) => {
      // BR-10: Cannot deactivate the last active Owner — checked inside transaction
      if (membership.role.name === 'Owner') {
        const activeOwnerCount = await tx.user_tenant_membership.count({
          where: {
            tenant_id: tenantId,
            status: 'ACTIVE',
            role: { name: 'Owner' },
          },
        });
        if (activeOwnerCount <= 1) {
          throw new BadRequestException('Tenant must have at least one active Owner.');
        }
      }

      await tx.user_tenant_membership.update({
        where: { id: membershipId },
        data: { status: 'INACTIVE', left_at: leftAt },
      });
      await tx.user.update({
        where: { id: membership.user_id },
        data: { is_active: false, updated_at: new Date() },
      });
    });

    // BR-04: Immediately push user's active JWT jti to Redis blocklist
    // This runs outside the DB transaction intentionally — Redis and MySQL cannot share transactions
    await this.tokenBlocklist.blockUserTokens(membership.user_id);

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'UserMembership',
      entityId: membershipId,
      tenantId,
      actorUserId,
      before: { status: 'ACTIVE' },
      after: { status: 'INACTIVE', left_at: leftAt },
      description: `User deactivated${dto.reason ? ': ' + dto.reason : ''}`,
    });

    return { id: membershipId, status: 'INACTIVE', left_at: leftAt.toISOString() };
  }

  // ─── REACTIVATE USER ──────────────────────────────────────────────────────────

  async reactivateUser(
    tenantId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<{ id: string; status: string; joined_at: string }> {
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { id: membershipId, tenant_id: tenantId, status: 'INACTIVE' },
    });
    if (!membership) throw new NotFoundException('Inactive membership not found.');

    // BR-02, BR-03: User must have NO other ACTIVE membership anywhere
    const otherActive = await this.prisma.user_tenant_membership.findFirst({
      where: {
        user_id: membership.user_id,
        status: 'ACTIVE',
        id: { not: membershipId },
      },
    });
    if (otherActive) {
      throw new ConflictException('User is currently active in another organization.');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user_tenant_membership.update({
        where: { id: membershipId },
        data: { status: 'ACTIVE', joined_at: now, left_at: null },
      });
      await tx.user.update({
        where: { id: membership.user_id },
        data: { is_active: true, updated_at: new Date() },
      });
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'UserMembership',
      entityId: membershipId,
      tenantId,
      actorUserId,
      before: { status: 'INACTIVE' },
      after: { status: 'ACTIVE', joined_at: now },
      description: 'User reactivated',
    });

    return { id: membershipId, status: 'ACTIVE', joined_at: now.toISOString() };
  }

  // ─── DELETE USER ──────────────────────────────────────────────────────────────

  async deleteUser(
    tenantId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<void> {
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { id: membershipId, tenant_id: tenantId },
      include: { user: true, role: true },
    });
    if (!membership) throw new NotFoundException('Membership not found.');

    const userId = membership.user_id;

    // BR-06: Check audit_log first — fast check for the most common FK reference
    const auditLogRef = await this.prisma.audit_log.count({
      where: { actor_user_id: userId },
    });

    if (auditLogRef > 0) {
      // Soft delete — preserve FK integrity (BR-06, BR-07)
      await this.prisma.user.update({
        where: { id: userId },
        data: { deleted_at: new Date(), is_active: false, updated_at: new Date() },
      });
      await this.prisma.user_tenant_membership.update({
        where: { id: membershipId },
        data: { status: 'INACTIVE', left_at: new Date() },
      });
      await this.auditLogger.logTenantChange({
        action: 'deleted',
        entityType: 'User',
        entityId: userId,
        tenantId,
        actorUserId,
        before: { email: membership.user.email },
        description: 'User soft-deleted (has audit log history)',
      });
      return;
    }

    // Hard delete — attempt to remove all memberships then the user
    // Catch Prisma P2003 (FK constraint) from other tables (quotes, leads, projects, etc.)
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user_tenant_membership.deleteMany({ where: { user_id: userId } });
        await tx.user.delete({ where: { id: userId } });
      });

      await this.auditLogger.logTenantChange({
        action: 'deleted',
        entityType: 'User',
        entityId: userId,
        tenantId,
        actorUserId,
        before: { email: membership.user.email },
        description: 'User hard-deleted',
      });
    } catch (err: unknown) {
      // BR-06: If any other table has an FK reference -> fall back to soft delete
      const prismaError = err as { code?: string };
      if (prismaError?.code === 'P2003' || prismaError?.code === 'P2014') {
        await this.prisma.user.update({
          where: { id: userId },
          data: { deleted_at: new Date(), is_active: false, updated_at: new Date() },
        });
        await this.prisma.user_tenant_membership.update({
          where: { id: membershipId },
          data: { status: 'INACTIVE', left_at: new Date() },
        });
        await this.auditLogger.logTenantChange({
          action: 'deleted',
          entityType: 'User',
          entityId: userId,
          tenantId,
          actorUserId,
          before: { email: membership.user.email },
          description: 'User soft-deleted (FK constraints in other tables)',
        });
      } else {
        throw err; // unexpected error — re-throw
      }
    }
  }

  // ─── GET ME ───────────────────────────────────────────────────────────────────

  async getMe(userId: string, membershipId: string): Promise<UserMeResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const membership = await this.prisma.user_tenant_membership.findUnique({
      where: { id: membershipId },
      include: { role: true },
    });
    if (!membership) throw new NotFoundException('Membership not found.');

    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone ?? null,
      avatar_url: null, // files module integration point
      membership: {
        id: membership.id,
        tenant_id: membership.tenant_id,
        role: { id: membership.role.id, name: membership.role.name },
        status: membership.status as string,
        joined_at: membership.joined_at?.toISOString() ?? null,
      },
    };
  }

  // ─── UPDATE ME ────────────────────────────────────────────────────────────────

  async updateMe(userId: string, dto: UpdateMeDto): Promise<void> {
    const updateData: Prisma.userUpdateInput = { updated_at: new Date() };
    if (dto.first_name !== undefined) updateData.first_name = dto.first_name;
    if (dto.last_name !== undefined) updateData.last_name = dto.last_name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;

    await this.prisma.user.update({ where: { id: userId }, data: updateData });
  }

  // ─── CHANGE PASSWORD ─────────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const valid = await bcrypt.compare(dto.current_password, user.password_hash);
    if (!valid) throw new BadRequestException('Current password is incorrect.');

    const newHash = await bcrypt.hash(dto.new_password, this.BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHash, updated_at: new Date() },
    });
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────────

  private formatMembership(m: {
    id: string;
    user_id: string;
    status: string;
    joined_at: Date | null;
    left_at: Date | null;
    created_at: Date;
    user: { first_name: string; last_name: string; email: string; phone: string | null };
    role: { id: string; name: string };
    invited_by: { id: string; first_name: string; last_name: string } | null;
  }): MembershipResponseDto {
    return {
      id: m.id,
      user_id: m.user_id,
      first_name: m.user.first_name,
      last_name: m.user.last_name,
      email: m.user.email,
      phone: m.user.phone ?? null,
      avatar_url: null,
      role: { id: m.role.id, name: m.role.name },
      status: m.status,
      joined_at: m.joined_at?.toISOString() ?? null,
      left_at: m.left_at?.toISOString() ?? null,
      invited_by: m.invited_by
        ? { id: m.invited_by.id, first_name: m.invited_by.first_name, last_name: m.invited_by.last_name }
        : null,
      created_at: m.created_at.toISOString(),
    };
  }
}
