import { randomBytes, randomUUID } from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ActivateAccountDto,
  ResendActivationDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto';
import { JwtPayload } from './entities/jwt-payload.entity';
import { AuditLoggerService } from '../audit/services/audit-logger.service';
import { JobQueueService } from '../jobs/services/job-queue.service';
import { TokenBlocklistService } from '../../core/token-blocklist/token-blocklist.service';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;
  private readonly ACCESS_TOKEN_EXPIRY = '24h';
  private readonly REFRESH_TOKEN_EXPIRY_DEFAULT = '7d';
  private readonly REFRESH_TOKEN_EXPIRY_REMEMBER = '30d';
  private readonly ACTIVATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogger: AuditLoggerService,
    private readonly jobQueue: JobQueueService,
    private readonly tokenBlocklist: TokenBlocklistService,
  ) {}

  /**
   * Register a new user and create their tenant
   */
  async register(registerDto: RegisterDto) {
    // Check if subdomain is taken
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { subdomain: registerDto.tenant_subdomain },
    });

    if (existingTenant) {
      throw new ConflictException('Subdomain is already taken');
    }

    // Check if email already exists (globally - since we're creating a new tenant)
    const existingUser = await this.prisma.user.findFirst({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      registerDto.password,
      this.SALT_ROUNDS,
    );

    // Generate activation token
    const activationToken = this.generateSecureToken();
    const activationTokenExpires = new Date(
      Date.now() + this.ACTIVATION_TOKEN_EXPIRY_MS,
    );

    // Create tenant and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create tenant with required fields
      const tenant = await tx.tenant.create({
        data: {
          id: randomBytes(16).toString('hex'),
          updated_at: new Date(),
          subdomain: registerDto.tenant_subdomain,
          company_name: registerDto.company_name,
          legal_business_name: registerDto.legal_business_name,
          business_entity_type: registerDto.business_entity_type,
          state_of_registration: registerDto.state_of_registration,
          ein: registerDto.ein,
          primary_contact_phone: registerDto.primary_contact_phone,
          primary_contact_email: registerDto.primary_contact_email,
          is_active: true,
        },
      });

      // Find the Owner role (global role, no tenant_id)
      const ownerRole = await tx.role.findUnique({
        where: { name: 'Owner' },
      });

      if (!ownerRole) {
        throw new InternalServerErrorException(
          'Owner role not found. Please run database seeding first.',
        );
      }

      // Create business hours (use provided or default to Mon-Fri 9-5)
      const businessHoursData = registerDto.business_hours || {
        monday_closed: false,
        monday_open1: '09:00',
        monday_close1: '17:00',
        tuesday_closed: false,
        tuesday_open1: '09:00',
        tuesday_close1: '17:00',
        wednesday_closed: false,
        wednesday_open1: '09:00',
        wednesday_close1: '17:00',
        thursday_closed: false,
        thursday_open1: '09:00',
        thursday_close1: '17:00',
        friday_closed: false,
        friday_open1: '09:00',
        friday_close1: '17:00',
        saturday_closed: true,
        sunday_closed: true,
      };

      await tx.tenant_business_hours.create({
        data: {
          id: randomBytes(16).toString('hex'),
          tenant_id: tenant.id,
          updated_at: new Date(),
          ...businessHoursData,
        } as any,
      });

      // Create user (global identity — no tenant_id; tenant link via user_tenant_membership)
      const user = await tx.user.create({
        data: {
          id: randomBytes(16).toString('hex'),
          updated_at: new Date(),
          email: registerDto.email,
          password_hash: passwordHash,
          first_name: registerDto.first_name,
          last_name: registerDto.last_name,
          phone: registerDto.phone,
          is_active: false,
          email_verified: false,
          activation_token: activationToken,
          activation_token_expires: activationTokenExpires,
        },
      });

      // Assign Owner role to user (legacy — kept for backward compatibility)
      await tx.user_role.create({
        data: {
          id: randomBytes(16).toString('hex'),
          user_id: user.id,
          role_id: ownerRole.id,
          tenant_id: tenant.id,
          assigned_by_user_id: user.id, // Self-assigned during registration
        },
      });

      // Create active membership for the new owner (Sprint 3)
      await tx.user_tenant_membership.create({
        data: {
          user_id: user.id,
          tenant_id: tenant.id,
          role_id: ownerRole.id,
          status: 'ACTIVE',
          joined_at: new Date(),
        },
      });

      // Create audit log
      await tx.audit_log.create({
        data: {
          id: randomBytes(16).toString('hex'),
          tenant_id: tenant.id,
          actor_user_id: user.id,
          actor_type: 'user',
          entity_type: 'auth_session',
          entity_id: user.id,
          description: 'User registered successfully',
          action_type: 'created',
          after_json: JSON.stringify({
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
          }),
          status: 'success',
        },
      });

      return { user, tenant };
    });

    // Queue activation email
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://app.lead360.app';
    await this.jobQueue.queueEmail({
      to: result.user.email,
      templateKey: 'account-activation',
      variables: {
        user_name: result.user.first_name,
        activation_link: `${frontendUrl}/activate?token=${activationToken}`,
      },
      tenantId: result.tenant.id,
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
        is_active: result.user.is_active,
        email_verified: result.user.email_verified,
      },
      tenant: {
        id: result.tenant.id,
        subdomain: result.tenant.subdomain,
        company_name: result.tenant.company_name,
      },
      message:
        'Registration successful. Please check your email to activate your account.',
    };
  }

  /**
   * Login user and return tokens
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    // Find user by email
    const user = await this.prisma.user.findFirst({
      where: {
        email: loginDto.email,
        deleted_at: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      // Resolve tenant from membership for audit (user no longer has tenant_id)
      const failedLoginTenantId = await this.resolveUserTenantId(user.id);
      await this.auditLogger.logAuth({
        event: 'login',
        userId: user.id,
        tenantId: failedLoginTenantId,
        status: 'failure',
        errorMessage: 'Invalid password',
        ipAddress,
        userAgent,
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if account is active
    if (!user.is_active) {
      throw new ForbiddenException(
        'Account is not activated. Please check your email for the activation link.',
      );
    }

    // Check if email is verified
    if (!user.email_verified) {
      throw new ForbiddenException(
        'Email is not verified. Please check your email for the verification link.',
      );
    }

    // Resolve tenant context from active membership (Sprint 3)
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: {
        user_id: user.id,
        status: 'ACTIVE',
      },
      include: {
        role: true,
      },
    });

    // Platform admins can log in without a membership (they operate cross-tenant)
    if (!membership && !user.is_platform_admin) {
      throw new ForbiddenException(
        'No active tenant membership found for this user.',
      );
    }

    // Derive roles and tenant context from membership, or defaults for platform admins
    const roles = membership ? [membership.role.name] : [];
    const resolvedMembershipId = membership?.id ?? null;
    const resolvedTenantId = membership?.tenant_id ?? null;

    // Generate tokens using membership-resolved data
    const { accessToken, refreshToken, expiresIn } = await this.generateTokens(
      { id: user.id, email: user.email, is_platform_admin: user.is_platform_admin },
      roles,
      loginDto.remember_me || false,
      resolvedMembershipId,
      resolvedTenantId,
    );

    // Store refresh token hash
    const tokenHash = this.hashToken(refreshToken);
    const refreshTokenExpiry = loginDto.remember_me
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refresh_token.create({
      data: {
        id: randomBytes(16).toString('hex'),
        user_id: user.id,
        token_hash: tokenHash,
        device_name: this.parseDeviceName(userAgent),
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: refreshTokenExpiry,
      },
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    // Create audit log (use membership-resolved tenant)
    await this.auditLogger.logAuth({
      event: 'login',
      userId: user.id,
      tenantId: resolvedTenantId,
      status: 'success',
      ipAddress,
      userAgent,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        tenant_id: resolvedTenantId,
        roles,
        is_platform_admin: user.is_platform_admin,
        email_verified: user.email_verified,
        last_login_at: user.last_login_at?.toISOString(),
        created_at: user.created_at.toISOString(),
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(userId: string) {
    // Get user (no role include — roles now come from membership)
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        is_active: true,
        deleted_at: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Resolve tenant context from active membership (Sprint 3)
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: {
        user_id: user.id,
        status: 'ACTIVE',
      },
      include: { role: true },
    });

    // Platform admins can refresh without a membership
    if (!membership && !user.is_platform_admin) {
      throw new UnauthorizedException('No active tenant membership.');
    }

    const roles = membership ? [membership.role.name] : [];

    // Generate new access token only
    const jti = randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenant_id: membership?.tenant_id ?? null,
      membershipId: membership?.id ?? null,
      roles,
      is_platform_admin: user.is_platform_admin,
      jti,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    const expTimestamp = Math.floor(Date.now() / 1000) + 86400; // matches ACCESS_TOKEN_EXPIRY = '24h'
    await this.tokenBlocklist.trackToken(user.id, jti, expTimestamp);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 86400, // 24 hours in seconds
    };
  }

  /**
   * Logout current session
   */
  async logout(userId: string, tokenHash: string) {
    await this.prisma.refresh_token.updateMany({
      where: {
        user_id: userId,
        token_hash: tokenHash,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });

    // Create audit log (resolve tenant from membership)
    const logoutTenantId = await this.resolveUserTenantId(userId);
    await this.auditLogger.logAuth({
      event: 'logout',
      userId,
      tenantId: logoutTenantId,
      status: 'success',
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Logout all sessions
   */
  async logoutAll(userId: string) {
    const result = await this.prisma.refresh_token.updateMany({
      where: {
        user_id: userId,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });

    // Create audit log (resolve tenant from membership)
    const logoutAllTenantId = await this.resolveUserTenantId(userId);
    await this.auditLogger.logAuth({
      event: 'logout_all',
      userId,
      tenantId: logoutAllTenantId,
      status: 'success',
      metadata: { sessions_revoked: result.count },
    });

    return {
      message: 'Logged out from all devices successfully',
      sessions_revoked: result.count,
    };
  }

  /**
   * Request password reset
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    // Always return success to prevent email enumeration
    const successMessage =
      'If an account with that email exists, a password reset link has been sent.';

    const user = await this.prisma.user.findFirst({
      where: {
        email: forgotPasswordDto.email,
        is_active: true,
        deleted_at: null,
      },
    });

    if (!user) {
      return { message: successMessage };
    }

    // Generate reset token
    const resetToken = this.generateSecureToken();
    const resetTokenExpires = new Date(Date.now() + this.RESET_TOKEN_EXPIRY_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_reset_token: resetToken,
        password_reset_expires: resetTokenExpires,
      },
    });

    // Resolve tenant from membership for audit & email
    const forgotTenantId = await this.resolveUserTenantId(user.id);

    await this.auditLogger.logAuth({
      event: 'password_reset_requested',
      userId: user.id,
      tenantId: forgotTenantId,
      status: 'success',
    });

    // Queue password reset email
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://app.lead360.app';
    await this.jobQueue.queueEmail({
      to: user.email,
      templateKey: 'password-reset',
      variables: {
        user_name: user.first_name,
        reset_link: `${frontendUrl}/reset-password?token=${resetToken}`,
      },
      tenantId: forgotTenantId ?? undefined,
    });

    return { message: successMessage };
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        password_reset_token: resetPasswordDto.token,
        password_reset_expires: {
          gt: new Date(),
        },
        deleted_at: null,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(
      resetPasswordDto.password,
      this.SALT_ROUNDS,
    );

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: passwordHash,
        password_reset_token: null,
        password_reset_expires: null,
      },
    });

    // Revoke all refresh tokens (force re-login)
    await this.prisma.refresh_token.updateMany({
      where: {
        user_id: user.id,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });

    // Create audit log (resolve tenant from membership)
    const resetTenantId = await this.resolveUserTenantId(user.id);
    await this.auditLogger.logAuth({
      event: 'password_reset',
      userId: user.id,
      tenantId: resetTenantId,
      status: 'success',
    });

    // TODO: Send password changed notification email

    return {
      message:
        'Password reset successfully. You can now log in with your new password.',
    };
  }

  /**
   * Activate account with token
   */
  async activateAccount(activateAccountDto: ActivateAccountDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        activation_token: activateAccountDto.token,
        activation_token_expires: {
          gt: new Date(),
        },
        deleted_at: null,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired activation token');
    }

    if (user.is_active && user.email_verified) {
      throw new ConflictException('Account is already activated');
    }

    // Activate user
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        is_active: true,
        email_verified: true,
        email_verified_at: new Date(),
        activation_token: null,
        activation_token_expires: null,
      },
    });

    // Create audit log (resolve tenant from membership)
    const activateTenantId = await this.resolveUserTenantId(user.id);
    await this.auditLogger.logAuth({
      event: 'account_activated',
      userId: user.id,
      tenantId: activateTenantId,
      status: 'success',
    });

    // TODO: Send welcome email

    return { message: 'Account activated successfully. You can now log in.' };
  }

  /**
   * Resend activation email
   */
  async resendActivation(resendActivationDto: ResendActivationDto) {
    // Always return success to prevent email enumeration
    const successMessage =
      'If an account with that email exists and is not activated, an activation link has been sent.';

    const user = await this.prisma.user.findFirst({
      where: {
        email: resendActivationDto.email,
        is_active: false,
        email_verified: false,
        deleted_at: null,
      },
    });

    if (!user) {
      return { message: successMessage };
    }

    // Generate new activation token
    const activationToken = this.generateSecureToken();
    const activationTokenExpires = new Date(
      Date.now() + this.ACTIVATION_TOKEN_EXPIRY_MS,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        activation_token: activationToken,
        activation_token_expires: activationTokenExpires,
      },
    });

    // Resolve tenant from membership for audit & email
    const resendTenantId = await this.resolveUserTenantId(user.id);

    await this.auditLogger.logAuth({
      event: 'activation_resent',
      userId: user.id,
      tenantId: resendTenantId,
      status: 'success',
    });

    // Queue activation email
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://app.lead360.app';
    await this.jobQueue.queueEmail({
      to: user.email,
      templateKey: 'account-activation',
      variables: {
        user_name: user.first_name,
        activation_link: `${frontendUrl}/activate?token=${activationToken}`,
      },
      tenantId: resendTenantId ?? undefined,
    });

    return { message: successMessage };
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deleted_at: null,
      },
      include: {
        user_role_user_role_user_idTouser: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = user.user_role_user_role_user_idTouser.map(
      (ur) => ur.role.name,
    );

    // Resolve tenant from active membership (user no longer has tenant_id)
    const profileTenantId = await this.resolveUserTenantId(userId);

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      tenant_id: profileTenantId,
      roles,
      is_platform_admin: user.is_platform_admin,
      email_verified: user.email_verified,
      last_login_at: user.last_login_at?.toISOString(),
      created_at: user.created_at.toISOString(),
    };
  }

  /**
   * Update current user profile
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deleted_at: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build update data (only include provided fields)
    const updateData: Record<string, string | undefined> = {};
    if (updateProfileDto.first_name !== undefined) {
      updateData.first_name = updateProfileDto.first_name;
    }
    if (updateProfileDto.last_name !== undefined) {
      updateData.last_name = updateProfileDto.last_name;
    }
    if (updateProfileDto.phone !== undefined) {
      updateData.phone = updateProfileDto.phone;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Create audit log (resolve tenant from membership)
    const updateTenantId = await this.resolveUserTenantId(userId);
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'user',
      entityId: userId,
      tenantId: updateTenantId,
      actorUserId: userId,
      before: {
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
      },
      after: updateData,
      description: 'User profile updated',
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      phone: updatedUser.phone,
      updated_at: updatedUser.updated_at.toISOString(),
    };
  }

  /**
   * Change password (authenticated)
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    currentTokenHash?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deleted_at: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.current_password,
      user.password_hash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Check that new password is different
    const isSamePassword = await bcrypt.compare(
      changePasswordDto.new_password,
      user.password_hash,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(
      changePasswordDto.new_password,
      this.SALT_ROUNDS,
    );

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: newPasswordHash },
    });

    // Revoke all other refresh tokens (keep current session if provided)
    if (currentTokenHash) {
      await this.prisma.refresh_token.updateMany({
        where: {
          user_id: userId,
          revoked_at: null,
          token_hash: { not: currentTokenHash },
        },
        data: {
          revoked_at: new Date(),
        },
      });
    } else {
      // Revoke all tokens
      await this.prisma.refresh_token.updateMany({
        where: {
          user_id: userId,
          revoked_at: null,
        },
        data: {
          revoked_at: new Date(),
        },
      });
    }

    // Create audit log (resolve tenant from membership)
    const changePwTenantId = await this.resolveUserTenantId(userId);
    await this.auditLogger.logAuth({
      event: 'password_changed',
      userId,
      tenantId: changePwTenantId,
      status: 'success',
    });

    // TODO: Send password changed notification email

    return { message: 'Password changed successfully' };
  }

  /**
   * List active sessions
   */
  async listSessions(userId: string, currentTokenHash?: string) {
    const sessions = await this.prisma.refresh_token.findMany({
      where: {
        user_id: userId,
        revoked_at: null,
        expires_at: {
          gt: new Date(),
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        device_name: session.device_name,
        ip_address: session.ip_address,
        created_at: session.created_at.toISOString(),
        expires_at: session.expires_at.toISOString(),
        is_current: currentTokenHash
          ? session.token_hash === currentTokenHash
          : false,
      })),
    };
  }

  /**
   * Revoke specific session
   */
  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.refresh_token.findFirst({
      where: {
        id: sessionId,
        user_id: userId,
        revoked_at: null,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.refresh_token.update({
      where: { id: sessionId },
      data: { revoked_at: new Date() },
    });

    // Create audit log (resolve tenant from membership)
    const revokeTenantId = await this.resolveUserTenantId(userId);
    await this.auditLogger.logAuth({
      event: 'logout',
      userId,
      tenantId: revokeTenantId,
      status: 'success',
      metadata: { session_id: sessionId, reason: 'manually_revoked' },
    });

    return { message: 'Session revoked successfully' };
  }

  /**
   * Check subdomain availability
   */
  async checkSubdomain(subdomain: string) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
    });

    return {
      available: !existingTenant,
      subdomain,
    };
  }

  // ==========================================
  // Public helpers for external callers
  // ==========================================

  /**
   * Issue access + refresh tokens for a user based on their active membership.
   * Called after invite acceptance to return a full auth response.
   */
  async issueTokensForMembership(
    userId: string,
    membershipId: string,
    tenantId: string,
    roles: string[],
    userEmail: string,
    isPlatformAdmin: boolean = false,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const { accessToken, refreshToken } = await this.generateTokens(
      { id: userId, email: userEmail, is_platform_admin: isPlatformAdmin },
      roles,
      false, // rememberMe = false for invite acceptance
      membershipId,
      tenantId,
    );

    // Store refresh token hash in DB so JwtRefreshStrategy can validate it.
    // login() does the same after generateTokens(). Without this, the returned
    // refresh_token will be rejected with 401 when the user tries to use it.
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refresh_token.create({
      data: {
        id: randomBytes(16).toString('hex'),
        user_id: userId,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  // ==========================================
  // Private helper methods
  // ==========================================

  private async generateTokens(
    user: {
      id: string;
      email: string;
      is_platform_admin: boolean;
    },
    roles: string[],
    rememberMe: boolean,
    membershipId: string | null,
    tenantId: string | null,
  ) {
    const jti = randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenant_id: tenantId,
      membershipId,
      roles,
      is_platform_admin: user.is_platform_admin,
      jti,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    const expTimestamp = Math.floor(Date.now() / 1000) + 86400; // matches ACCESS_TOKEN_EXPIRY = '24h'
    await this.tokenBlocklist.trackToken(user.id, jti, expTimestamp);

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: rememberMe
          ? this.REFRESH_TOKEN_EXPIRY_REMEMBER
          : this.REFRESH_TOKEN_EXPIRY_DEFAULT,
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400, // 24 hours in seconds
    };
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Resolve tenant_id from the user's active membership.
   * After Sprint 4, the user table no longer carries tenant_id.
   * Tenant context is always derived from user_tenant_membership.
   */
  private async resolveUserTenantId(userId: string): Promise<string | null> {
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
      select: { tenant_id: true },
    });
    return membership?.tenant_id ?? null;
  }

  private parseDeviceName(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    // Basic parsing - could use a library like ua-parser-js for better results
    const browserMatch = userAgent.match(
      /(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)[\/\s](\d+)/i,
    );
    const osMatch = userAgent.match(
      /(Windows|Mac OS X|Linux|Android|iOS|iPhone|iPad)/i,
    );

    const browser = browserMatch ? browserMatch[1] : 'Unknown Browser';
    const os = osMatch ? osMatch[1] : 'Unknown OS';

    return `${browser} on ${os}`;
  }
}
