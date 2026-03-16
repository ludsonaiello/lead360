import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../../jobs/services/job-queue.service';
import type { PortalJwtPayload } from '../entities/portal-jwt-payload.entity';

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);
  private readonly SALT_ROUNDS = 10;
  private readonly PORTAL_TOKEN_EXPIRY = '30d';
  private readonly RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
  private readonly TEMP_PASSWORD_LENGTH = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly jobQueue: JobQueueService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. createForLead — Called from ProjectService.createFromQuote
  // ---------------------------------------------------------------------------

  /**
   * Create a portal account for a lead in a tenant.
   * Idempotent: if a portal_account already exists for (tenant_id, lead_id), skips.
   * Returns { customer_slug, temporary_password } or null if account already existed.
   */
  async createForLead(
    tenantId: string,
    leadId: string,
  ): Promise<{ customer_slug: string; temporary_password: string } | null> {
    // Check if portal account already exists for this tenant+lead
    const existing = await this.prisma.portal_account.findUnique({
      where: {
        tenant_id_lead_id: {
          tenant_id: tenantId,
          lead_id: leadId,
        },
      },
    });

    if (existing) {
      this.logger.log(
        `Portal account already exists for tenant=${tenantId}, lead=${leadId} — skipping`,
      );
      return null;
    }

    // Fetch lead with primary email
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenant_id: tenantId },
      include: {
        emails: {
          where: { is_primary: true },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead not found: ${leadId}`);
    }

    // Get primary email — fall back to first email if no primary flagged
    let primaryEmail: string | null = lead.emails[0]?.email ?? null;
    if (!primaryEmail) {
      // Try any email
      const anyEmail = await this.prisma.lead_email.findFirst({
        where: { lead_id: leadId },
      });
      primaryEmail = anyEmail?.email ?? null;
    }

    if (!primaryEmail) {
      this.logger.warn(
        `Lead ${leadId} has no email — cannot create portal account`,
      );
      return null;
    }

    // Generate customer slug from lead name
    const customerSlug = await this.generateSlug(
      lead.first_name,
      lead.last_name,
      tenantId,
    );

    // Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, this.SALT_ROUNDS);

    // Create portal account
    await this.prisma.portal_account.create({
      data: {
        tenant_id: tenantId,
        lead_id: leadId,
        email: primaryEmail,
        customer_slug: customerSlug,
        password_hash: passwordHash,
        must_change_password: true,
      },
    });

    // Queue welcome email with temporary credentials
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { subdomain: true, company_name: true },
      });

      if (tenant) {
        const baseDomain = this.configService.get<string>('PORTAL_BASE_DOMAIN') || 'lead360.app';
        const portalUrl = `https://${tenant.subdomain}.${baseDomain}/public/${customerSlug}/projects/`;
        await this.jobQueue.queueEmail({
          to: primaryEmail,
          templateKey: 'portal-welcome',
          variables: {
            customer_name: `${lead.first_name} ${lead.last_name}`,
            company_name: tenant.company_name,
            portal_url: portalUrl,
            email: primaryEmail,
            temporary_password: temporaryPassword,
          },
          tenantId,
        });
      }
    } catch (error) {
      // Non-blocking — log and continue
      this.logger.error(
        `Failed to queue welcome email for portal account: ${error.message}`,
      );
    }

    this.logger.log(
      `Portal account created for lead=${leadId}, slug=${customerSlug}`,
    );

    return { customer_slug: customerSlug, temporary_password: temporaryPassword };
  }

  // ---------------------------------------------------------------------------
  // 2. login
  // ---------------------------------------------------------------------------

  async login(tenantSlug: string, email: string, password: string) {
    // Resolve tenant from subdomain
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain: tenantSlug },
      select: { id: true, subdomain: true, is_active: true },
    });

    if (!tenant || !tenant.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tenantId = tenant.id;

    // Find portal account
    const account = await this.prisma.portal_account.findUnique({
      where: {
        tenant_id_email: {
          tenant_id: tenantId,
          email,
        },
      },
    });

    if (!account || !account.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, account.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Issue portal JWT
    const token = this.issuePortalToken(account);

    // Update last_login_at
    await this.prisma.portal_account.update({
      where: { id: account.id },
      data: { last_login_at: new Date() },
    });

    // Fetch lead name for response
    const lead = await this.prisma.lead.findFirst({
      where: { id: account.lead_id, tenant_id: tenantId },
      select: { first_name: true, last_name: true },
    });

    return {
      token,
      customer_slug: account.customer_slug,
      must_change_password: account.must_change_password,
      lead: lead
        ? { first_name: lead.first_name, last_name: lead.last_name }
        : null,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. changePassword
  // ---------------------------------------------------------------------------

  async changePassword(
    portalAccountId: string,
    tenantId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const account = await this.prisma.portal_account.findFirst({
      where: { id: portalAccountId, tenant_id: tenantId, is_active: true },
    });

    if (!account) {
      throw new NotFoundException('Portal account not found');
    }

    // Validate old password
    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      account.password_hash,
    );
    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Ensure new password is different
    const isSamePassword = await bcrypt.compare(
      newPassword,
      account.password_hash,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.prisma.portal_account.update({
      where: { id: portalAccountId },
      data: {
        password_hash: newHash,
        must_change_password: false,
      },
    });

    return { message: 'Password changed successfully' };
  }

  // ---------------------------------------------------------------------------
  // 4. requestPasswordReset
  // ---------------------------------------------------------------------------

  async requestPasswordReset(tenantSlug: string, email: string) {
    // Always return success to prevent email enumeration
    const successMessage =
      'If an account with that email exists, a password reset link has been sent.';

    // Resolve tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain: tenantSlug },
      select: { id: true, subdomain: true, company_name: true, is_active: true },
    });

    if (!tenant || !tenant.is_active) {
      return { message: successMessage };
    }

    // Find portal account
    const account = await this.prisma.portal_account.findUnique({
      where: {
        tenant_id_email: {
          tenant_id: tenant.id,
          email,
        },
      },
    });

    if (!account || !account.is_active) {
      return { message: successMessage };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiresAt = new Date(Date.now() + this.RESET_TOKEN_EXPIRY_MS);

    await this.prisma.portal_account.update({
      where: { id: account.id },
      data: {
        reset_token: resetToken,
        reset_token_expires_at: resetTokenExpiresAt,
      },
    });

    // Queue reset email
    try {
      const lead = await this.prisma.lead.findFirst({
        where: { id: account.lead_id, tenant_id: tenant.id },
        select: { first_name: true, last_name: true },
      });

      const baseDomain = this.configService.get<string>('PORTAL_BASE_DOMAIN') || 'lead360.app';
      const resetUrl = `https://${tenant.subdomain}.${baseDomain}/public/reset-password?token=${resetToken}`;
      await this.jobQueue.queueEmail({
        to: email,
        templateKey: 'portal-password-reset',
        variables: {
          customer_name: lead
            ? `${lead.first_name} ${lead.last_name}`
            : 'Customer',
          company_name: tenant.company_name,
          reset_link: resetUrl,
        },
        tenantId: tenant.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to queue portal password reset email: ${error.message}`,
      );
    }

    return { message: successMessage };
  }

  // ---------------------------------------------------------------------------
  // 5. resetPassword
  // ---------------------------------------------------------------------------

  async resetPassword(token: string, newPassword: string) {
    // Find account by reset token (not expired)
    const account = await this.prisma.portal_account.findFirst({
      where: {
        reset_token: token,
        reset_token_expires_at: { gt: new Date() },
        is_active: true,
      },
    });

    if (!account) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password and clear reset token
    await this.prisma.portal_account.update({
      where: { id: account.id },
      data: {
        password_hash: newHash,
        must_change_password: false,
        reset_token: null,
        reset_token_expires_at: null,
      },
    });

    return { message: 'Password reset successfully. You can now log in with your new password.' };
  }

  // ---------------------------------------------------------------------------
  // 6. getTenantBranding — Public, no auth required
  // ---------------------------------------------------------------------------

  /**
   * Fetch tenant branding by subdomain slug for the portal login/public pages.
   * Returns only safe, public-facing fields: company name, logo, colors, contact, socials.
   */
  async getTenantBranding(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain: tenantSlug },
      select: {
        id: true,
        company_name: true,
        is_active: true,
        primary_brand_color: true,
        secondary_brand_color: true,
        accent_color: true,
        primary_contact_phone: true,
        primary_contact_email: true,
        website_url: true,
        instagram_url: true,
        facebook_url: true,
        tiktok_url: true,
        youtube_url: true,
        file_tenant_logo_file_idTofile: {
          select: {
            file_id: true,
            storage_path: true,
            original_filename: true,
            mime_type: true,
          },
        },
        tenant_address: {
          where: { is_default: true },
          take: 1,
          select: {
            line1: true,
            line2: true,
            city: true,
            state: true,
            zip_code: true,
            country: true,
          },
        },
      },
    });

    if (!tenant || !tenant.is_active) {
      throw new NotFoundException('Tenant not found');
    }

    // Build logo URL from storage_path (same pattern as public quote)
    let logoUrl: string | null = null;
    if (tenant.file_tenant_logo_file_idTofile?.storage_path) {
      const storagePath = tenant.file_tenant_logo_file_idTofile.storage_path;
      const appUrl = this.configService.get<string>('APP_URL') || 'https://app.lead360.app';
      if (storagePath.includes('/uploads/public/')) {
        const parts = storagePath.split('/uploads/public/');
        logoUrl = `${appUrl}/uploads/public/${parts[1]}`;
      } else if (storagePath.startsWith('/public/')) {
        logoUrl = `${appUrl}/uploads${storagePath}`;
      }
    }

    const address = tenant.tenant_address?.[0] ?? null;

    return {
      company_name: tenant.company_name,
      logo_file_id: tenant.file_tenant_logo_file_idTofile?.file_id ?? null,
      logo_url: logoUrl,
      primary_color: tenant.primary_brand_color,
      secondary_color: tenant.secondary_brand_color,
      accent_color: tenant.accent_color,
      phone: tenant.primary_contact_phone,
      email: tenant.primary_contact_email,
      website: tenant.website_url,
      address: address
        ? {
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            zip_code: address.zip_code,
            country: address.country,
          }
        : null,
      social_media: {
        instagram: tenant.instagram_url,
        facebook: tenant.facebook_url,
        tiktok: tenant.tiktok_url,
        youtube: tenant.youtube_url,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate a URL-safe slug from first_name + last_name.
   * Deduplicate per tenant by appending -2, -3, etc.
   */
  private async generateSlug(
    firstName: string,
    lastName: string,
    tenantId: string,
  ): Promise<string> {
    const base = `${firstName}-${lastName}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''); // trim leading/trailing hyphens

    // Ensure we have a non-empty base
    const safeBase = base || 'customer';

    let slug = safeBase;
    let counter = 2;

    while (await this.slugExistsInTenant(tenantId, slug)) {
      slug = `${safeBase}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async slugExistsInTenant(
    tenantId: string,
    slug: string,
  ): Promise<boolean> {
    const existing = await this.prisma.portal_account.findUnique({
      where: {
        tenant_id_customer_slug: {
          tenant_id: tenantId,
          customer_slug: slug,
        },
      },
      select: { id: true },
    });
    return !!existing;
  }

  /**
   * Generate a temporary password: 12 chars, guaranteed to have
   * uppercase, lowercase, digit, and special character.
   */
  private generateTemporaryPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '@#$%&*!';

    // Guarantee at least one of each category
    const required = [
      upper[crypto.randomInt(upper.length)],
      lower[crypto.randomInt(lower.length)],
      digits[crypto.randomInt(digits.length)],
      special[crypto.randomInt(special.length)],
    ];

    // Fill remaining characters from all categories
    const all = upper + lower + digits + special;
    const remaining = this.TEMP_PASSWORD_LENGTH - required.length;
    for (let i = 0; i < remaining; i++) {
      required.push(all[crypto.randomInt(all.length)]);
    }

    // Shuffle using Fisher-Yates
    for (let i = required.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [required[i], required[j]] = [required[j], required[i]];
    }

    return required.join('');
  }

  /**
   * Issue a portal JWT token.
   */
  private issuePortalToken(account: {
    id: string;
    tenant_id: string;
    lead_id: string;
    customer_slug: string;
  }): string {
    const payload: PortalJwtPayload = {
      sub: account.id,
      tenant_id: account.tenant_id,
      lead_id: account.lead_id,
      customer_slug: account.customer_slug,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('PORTAL_JWT_SECRET'),
      expiresIn: this.PORTAL_TOKEN_EXPIRY,
    });
  }
}
