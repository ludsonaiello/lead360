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
import { EditUserDto } from '../dto/edit-user.dto';
import { InviteResponseDto } from '../dto/invite-response.dto';
import {
  MembershipResponseDto,
  PaginatedMembershipsDto,
} from '../dto/membership-response.dto';
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
    const role = await this.prisma.role.findUnique({
      where: { id: dto.role_id },
    });
    if (!role) throw new NotFoundException('Role not found.');

    // Step 2: Look up any existing membership for (email's user, tenant)
    // ACTIVE/INVITED → 409. INACTIVE → reuse the row in Step 5.
    const existingMembership =
      await this.prisma.user_tenant_membership.findFirst({
        where: {
          tenant_id: tenantId,
          user: { email: dto.email },
        },
        include: { user: true },
      });

    if (
      existingMembership &&
      (existingMembership.status === 'ACTIVE' ||
        existingMembership.status === 'INVITED')
    ) {
      throw new ConflictException(
        'This email already has an active or pending invitation in this organization.',
      );
    }

    // Step 3: Find or create the user record — BR-12: link existing user, never duplicate
    let user =
      existingMembership?.user ??
      (await this.prisma.user.findUnique({
        where: { email: dto.email },
      }));

    // Step 4: Generate invite token — SHA-256 for O(1) indexed lookup
    const rawToken = randomBytes(32).toString('hex'); // 64-char hex string
    const tokenHash = createHash('sha256').update(rawToken).digest('hex'); // 64-char SHA-256 hex
    const expiresAt = new Date(
      Date.now() + this.INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    // Step 5: Atomic — create or restore user + create or reuse membership
    let membershipId: string;
    const reusedExisting = !!existingMembership;
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
      } else if (user.deleted_at || existingMembership) {
        // Re-inviting: restore soft-deleted user record (auth lookups filter
        // `deleted_at IS NULL`) and refresh first/last name from the DTO.
        // Keep `is_active = false` until acceptance.
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            deleted_at: null,
            first_name: dto.first_name,
            last_name: dto.last_name,
            is_active: false,
            updated_at: new Date(),
          },
        });
      }

      if (existingMembership) {
        // Reuse the INACTIVE membership row instead of inserting a duplicate.
        const updated = await tx.user_tenant_membership.update({
          where: { id: existingMembership.id },
          data: {
            status: 'INVITED',
            role_id: dto.role_id,
            invite_token_hash: tokenHash,
            invite_token_expires_at: expiresAt,
            invite_accepted_at: null,
            invited_by_user_id: actorUserId,
            joined_at: null,
            left_at: null,
          },
        });
        membershipId = updated.id;
      } else {
        const membership = await tx.user_tenant_membership.create({
          data: {
            user_id: user.id,
            tenant_id: tenantId,
            role_id: dto.role_id,
            status: 'INVITED',
            invite_token_hash: tokenHash,
            invite_token_expires_at: expiresAt,
            invited_by_user_id: actorUserId,
          },
        });
        membershipId = membership.id;
      }
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

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      'https://app.lead360.app';
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
          inviter_name: inviter
            ? `${inviter.first_name} ${inviter.last_name}`
            : 'Your administrator',
          role_name: role.name,
          expires_at: expiresAt.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        },
        related_entity_type: 'user_tenant_membership',
        related_entity_id: membershipId!,
      },
      actorUserId,
    );

    // Step 7: Audit log
    await this.auditLogger.logTenantChange({
      action: reusedExisting ? 'updated' : 'created',
      entityType: 'UserMembership',
      entityId: membershipId!,
      tenantId,
      actorUserId,
      after: { email: dto.email, role: role.name, status: 'INVITED' },
      description: reusedExisting
        ? `Re-invited ${dto.email} as ${role.name} (reused inactive membership)`
        : `Invited ${dto.email} as ${role.name}`,
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
    const otherActiveMembership =
      await this.prisma.user_tenant_membership.findFirst({
        where: {
          user_id: membership.user_id,
          status: 'ACTIVE',
          id: { not: membership.id },
        },
      });
    if (otherActiveMembership) {
      throw new ConflictException(
        'User is currently active in another organization.',
      );
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
          deleted_at: null, // Defensive: ensure auth lookups can find the user
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
          invited_by: {
            select: { id: true, first_name: true, last_name: true },
          },
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
      throw new NotFoundException(
        'User membership not found in this organization.',
      );
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

    const newRole = await this.prisma.role.findUnique({
      where: { id: dto.role_id },
    });
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

  // ─── EDIT USER (admin) ────────────────────────────────────────────────────────

  async editUser(
    tenantId: string,
    membershipId: string,
    actorUser: { id: string; roles: string[]; is_platform_admin: boolean },
    dto: EditUserDto,
  ): Promise<MembershipResponseDto> {
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { id: membershipId, tenant_id: tenantId },
      include: { user: true, role: true },
    });

    if (!membership) throw new NotFoundException('Membership not found.');

    if (membership.user.deleted_at) {
      throw new BadRequestException('Cannot edit a deleted user.');
    }

    // BR-09 parity: only an Owner or platform admin may edit an Owner's profile.
    // Without this check, an Admin could change an Owner's email and effectively
    // hijack the account on next password reset.
    if (
      membership.role.name === 'Owner' &&
      !actorUser.roles.includes('Owner') &&
      !actorUser.is_platform_admin
    ) {
      throw new ForbiddenException(
        'Only an Owner or platform administrator can edit an Owner.',
      );
    }

    // The user record is global — it is shared across every tenant the user
    // belongs to. If the user has memberships in multiple tenants, editing PII
    // here would mutate state visible to OTHER tenants. Block that to preserve
    // tenant isolation; cross-tenant edits must go through Platform Admin.
    if (!actorUser.is_platform_admin) {
      const otherMembershipCount =
        await this.prisma.user_tenant_membership.count({
          where: {
            user_id: membership.user_id,
            tenant_id: { not: tenantId },
            status: { in: ['ACTIVE', 'INVITED'] },
          },
        });
      if (otherMembershipCount > 0) {
        throw new ForbiddenException(
          'This user belongs to other organizations. Only a platform administrator can edit their profile.',
        );
      }
    }

    const normalizedEmail = dto.email?.toLowerCase().trim();
    const normalizedFirstName = dto.first_name?.trim();
    const normalizedLastName = dto.last_name?.trim();

    // Friendly pre-check for email uniqueness. The P2002 catch below is the
    // authoritative safety net for the TOCTOU race.
    if (normalizedEmail && normalizedEmail !== membership.user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existing && existing.id !== membership.user_id) {
        throw new ConflictException('Email address is already in use.');
      }
    }

    // Treat empty phone as null so the column stays NULL rather than ''.
    const normalizedPhone =
      dto.phone === undefined
        ? undefined
        : dto.phone.trim().length === 0
          ? null
          : dto.phone.trim();

    // Build the patch only with fields that actually changed.
    const updateData: Prisma.userUpdateInput = {};
    if (
      normalizedFirstName !== undefined &&
      normalizedFirstName !== membership.user.first_name
    ) {
      updateData.first_name = normalizedFirstName;
    }
    if (
      normalizedLastName !== undefined &&
      normalizedLastName !== membership.user.last_name
    ) {
      updateData.last_name = normalizedLastName;
    }
    if (
      normalizedEmail !== undefined &&
      normalizedEmail !== membership.user.email
    ) {
      updateData.email = normalizedEmail;
      // BR: when email changes, force re-verification on next login. The user
      // can no longer be assumed to control the new mailbox.
      updateData.email_verified = false;
      updateData.email_verified_at = null;
    }
    if (
      normalizedPhone !== undefined &&
      normalizedPhone !== membership.user.phone
    ) {
      updateData.phone = normalizedPhone;
    }

    // No-op short-circuit: skip DB write + audit log when nothing changed.
    if (Object.keys(updateData).length === 0) {
      const current = await this.prisma.user_tenant_membership.findFirst({
        where: { id: membershipId },
        include: {
          user: true,
          role: true,
          invited_by: {
            select: { id: true, first_name: true, last_name: true },
          },
        },
      });
      return this.formatMembership(current!);
    }

    updateData.updated_at = new Date();

    const beforeState = {
      first_name: membership.user.first_name,
      last_name: membership.user.last_name,
      email: membership.user.email,
      phone: membership.user.phone,
    };

    let updatedUser;
    try {
      updatedUser = await this.prisma.user.update({
        where: { id: membership.user_id },
        data: updateData,
      });
    } catch (err: unknown) {
      // Race condition: another request grabbed the email between our
      // pre-check and the update. Surface as ConflictException, not 500.
      const prismaError = err as { code?: string; meta?: { target?: string[] } };
      if (
        prismaError?.code === 'P2002' &&
        prismaError.meta?.target?.includes('email')
      ) {
        throw new ConflictException('Email address is already in use.');
      }
      throw err;
    }

    const updated = await this.prisma.user_tenant_membership.findFirst({
      where: { id: membershipId },
      include: {
        user: true,
        role: true,
        invited_by: { select: { id: true, first_name: true, last_name: true } },
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'User',
      entityId: membership.user_id,
      tenantId,
      actorUserId: actorUser.id,
      before: beforeState,
      after: {
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      },
      description:
        beforeState.email !== updatedUser.email
          ? `User profile updated by admin (email changed — re-verification required)`
          : `User profile updated by admin`,
    });

    return this.formatMembership(updated!);
  }

  // ─── RESEND INVITE ────────────────────────────────────────────────────────────

  async resendInvite(
    tenantId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<{ message: string; expires_at: string }> {
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { id: membershipId, tenant_id: tenantId },
      include: { user: true, role: true },
    });

    if (!membership) throw new NotFoundException('Membership not found.');

    if (membership.status !== 'INVITED') {
      throw new BadRequestException(
        'Can only resend invites for users with INVITED status.',
      );
    }

    if (membership.user.deleted_at) {
      throw new BadRequestException(
        'Cannot resend invite to a deleted user account.',
      );
    }

    // Generate a fresh token; overwriting the hash invalidates the old link.
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + this.INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.user_tenant_membership.update({
      where: { id: membershipId },
      data: {
        invite_token_hash: tokenHash,
        invite_token_expires_at: expiresAt,
        invite_accepted_at: null,
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { company_name: true },
    });
    const inviter = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { first_name: true, last_name: true },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      'https://app.lead360.app';
    const inviteLink = `${frontendUrl}/invite/${rawToken}`;

    await this.sendEmailService.sendTemplated(
      tenantId,
      {
        to: membership.user.email,
        template_key: 'user-invite',
        variables: {
          first_name: membership.user.first_name,
          last_name: membership.user.last_name,
          invite_link: inviteLink,
          tenant_name: tenant?.company_name ?? 'Lead360',
          inviter_name: inviter
            ? `${inviter.first_name} ${inviter.last_name}`
            : 'Your administrator',
          role_name: membership.role.name,
          expires_at: expiresAt.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        },
        related_entity_type: 'user_tenant_membership',
        related_entity_id: membershipId,
      },
      actorUserId,
    );

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'UserMembership',
      entityId: membershipId,
      tenantId,
      actorUserId,
      after: { action: 'invite_resent', email: membership.user.email },
      description: `Invite resent to ${membership.user.email}`,
    });

    return {
      message: 'Invitation resent successfully.',
      expires_at: expiresAt.toISOString(),
    };
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

    if (!membership)
      throw new NotFoundException('Active membership not found.');

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
          throw new BadRequestException(
            'Tenant must have at least one active Owner.',
          );
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

    return {
      id: membershipId,
      status: 'INACTIVE',
      left_at: leftAt.toISOString(),
    };
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
    if (!membership)
      throw new NotFoundException('Inactive membership not found.');

    // BR-02, BR-03: User must have NO other ACTIVE membership anywhere
    const otherActive = await this.prisma.user_tenant_membership.findFirst({
      where: {
        user_id: membership.user_id,
        status: 'ACTIVE',
        id: { not: membershipId },
      },
    });
    if (otherActive) {
      throw new ConflictException(
        'User is currently active in another organization.',
      );
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

    // BR-10: Cannot remove the last active Owner of this tenant
    if (membership.role.name === 'Owner' && membership.status === 'ACTIVE') {
      const activeOwnerCount = await this.prisma.user_tenant_membership.count({
        where: {
          tenant_id: tenantId,
          status: 'ACTIVE',
          role: { name: 'Owner' },
        },
      });
      if (activeOwnerCount <= 1) {
        throw new BadRequestException(
          'Tenant must have at least one active Owner.',
        );
      }
    }

    // Per-tenant scope: if the user has any other ACTIVE/INVITED membership
    // (this tenant or another), only mark THIS membership as INACTIVE. The
    // shared `user` row stays intact so the user can keep using their other
    // memberships and log in.
    const otherActive = await this.prisma.user_tenant_membership.count({
      where: {
        user_id: userId,
        id: { not: membershipId },
        status: { in: ['ACTIVE', 'INVITED'] },
      },
    });

    if (otherActive > 0) {
      const leftAt = new Date();
      await this.prisma.user_tenant_membership.update({
        where: { id: membershipId },
        data: { status: 'INACTIVE', left_at: leftAt },
      });
      // BR-04: revoke the user's tokens; subsequent requests will re-validate
      // membership status against this tenant and reject (other tenants stay
      // accessible after re-login).
      await this.tokenBlocklist.blockUserTokens(userId);
      await this.auditLogger.logTenantChange({
        action: 'deleted',
        entityType: 'UserMembership',
        entityId: membershipId,
        tenantId,
        actorUserId,
        before: {
          email: membership.user.email,
          status: membership.status,
        },
        after: { status: 'INACTIVE', left_at: leftAt },
        description: `Removed ${membership.user.email} from tenant (other memberships preserved)`,
      });
      return;
    }

    // Last membership — proceed with the legacy global delete path.
    // BR-06: Check audit_log first — fast check for the most common FK reference
    const auditLogRef = await this.prisma.audit_log.count({
      where: { actor_user_id: userId },
    });

    if (auditLogRef > 0) {
      // Soft delete — preserve FK integrity (BR-06, BR-07)
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          deleted_at: new Date(),
          is_active: false,
          updated_at: new Date(),
        },
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
        await tx.user_tenant_membership.deleteMany({
          where: { user_id: userId },
        });
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
          data: {
            deleted_at: new Date(),
            is_active: false,
            updated_at: new Date(),
          },
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

  async getMe(
    userId: string,
    membershipId: string,
  ): Promise<UserMeResponseDto> {
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

    const valid = await bcrypt.compare(
      dto.current_password,
      user.password_hash,
    );
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
    user: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
    };
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
        ? {
            id: m.invited_by.id,
            first_name: m.invited_by.first_name,
            last_name: m.invited_by.last_name,
          }
        : null,
      created_at: m.created_at.toISOString(),
    };
  }
}
