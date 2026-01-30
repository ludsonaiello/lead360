import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuoteVersionService } from './quote-version.service';
import { QuoteService } from './quote.service';
import { GeneratePublicUrlDto, PublicUrlResponseDto } from '../dto/public/generate-public-url.dto';
import { PasswordValidationResponseDto } from '../dto/public/validate-password.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * QuotePublicAccessService
 *
 * Manages public URL generation, password protection, and access control for quotes.
 * Enables customers to view quotes without authentication.
 *
 * Key Features:
 * - Cryptographically secure token generation (32 chars)
 * - Password protection with bcrypt
 * - Failed login lockout (3 strikes = 15min)
 * - Status automation (ready → sent, sent → read)
 * - Rate limiting integration
 *
 * @author Developer 5
 */
@Injectable()
export class QuotePublicAccessService {
  private readonly logger = new Logger(QuotePublicAccessService.name);

  // In-memory lockout tracking (key: `${token}:${ipAddress}`)
  // In production, use Redis for distributed lockout tracking
  private readonly lockouts = new Map<string, { attempts: number; lockedUntil?: Date }>();

  private readonly MAX_FAILED_ATTEMPTS = 3;
  private readonly LOCKOUT_DURATION_MINUTES = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly versionService: QuoteVersionService,
    private readonly quoteService: QuoteService,
  ) {}

  /**
   * Generate a public URL for quote sharing
   *
   * @param tenantId - Tenant ID from JWT
   * @param quoteId - Quote UUID
   * @param dto - Contains optional password, hint, expiration
   * @returns Public URL and metadata
   */
  async generatePublicUrl(
    tenantId: string,
    quoteId: string,
    dto: GeneratePublicUrlDto,
    userId: string,
    skipStatusChange: boolean = false,
  ): Promise<PublicUrlResponseDto> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Validate quote exists and belongs to tenant
      const quote = await tx.quote.findFirst({
        where: {
          id: quoteId,
          tenant_id: tenantId,
        },
        include: {
          tenant: true,
        },
      });

      if (!quote) {
        throw new NotFoundException(`Quote ${quoteId} not found`);
      }

      // 2. Validate quote status (must be ready or sent to generate public URL)
      if (!['ready', 'sent', 'delivered', 'read', 'opened', 'email_failed'].includes(quote.status)) {
        throw new BadRequestException(
          `Quote must be in 'ready', 'sent', 'delivered', 'read', 'opened', or 'email_failed' status to generate public URL. Current status: ${quote.status}`,
        );
      }

      // 3. Generate unique token
      let token: string = this.generateToken();
      let tokenExists = true;

      // Ensure token is globally unique
      while (tokenExists) {
        const existing = await tx.quote_public_access.findUnique({
          where: { access_token: token },
        });
        if (!existing) {
          tokenExists = false;
        } else {
          token = this.generateToken();
        }
      }

      // 4. Hash password if provided
      let passwordHash: string | undefined;
      if (dto.password) {
        passwordHash = await this.hashPassword(dto.password);
      }

      // 5. Deactivate existing public access for this quote
      await tx.quote_public_access.updateMany({
        where: {
          quote_id: quoteId,
          is_active: true,
        },
        data: {
          is_active: false,
        },
      });

      // 6. Create new public access record
      const publicAccess = await tx.quote_public_access.create({
        data: {
          id: crypto.randomUUID(),
          quote_id: quoteId,
          access_token: token,
          password_hash: passwordHash,
          password_hint: dto.password_hint,
          expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
          is_active: true,
        },
      });

      // 7. Auto-change status: ready → sent (if quote is currently 'ready' and not skipped)
      if (!skipStatusChange && quote.status === 'ready') {
        // Update status to 'sent'
        await tx.quote.update({
          where: { id: quoteId },
          data: { status: 'sent' },
        });

        // Create version snapshot (minor version increment: +0.1)
        await this.versionService.createVersion(
          quoteId,
          0.1,
          'Status changed to sent (public URL generated)',
          userId,
          tx,
        );

        this.logger.log(`Quote ${quoteId} status changed from 'ready' to 'sent' (public URL generated)`);
      }

      // 8. Build public URL
      const tenantSubdomain = quote.tenant.subdomain || quote.tenant.id;
      const publicUrl = this.buildPublicUrl(tenantSubdomain, token);

      // 9. Return response
      return {
        public_url: publicUrl,
        access_token: token,
        has_password: !!passwordHash,
        password_hint: dto.password_hint,
        expires_at: publicAccess.expires_at?.toISOString(),
        created_at: publicAccess.created_at.toISOString(),
      };
    });
  }

  /**
   * Validate password for protected quote
   *
   * @param token - Public access token
   * @param password - Password to validate
   * @param ipAddress - Client IP for lockout tracking
   * @returns Validation result with hint if invalid
   */
  async validatePassword(
    token: string,
    password: string,
    ipAddress: string,
  ): Promise<PasswordValidationResponseDto> {
    // 1. Get public access record
    const publicAccess = await this.prisma.quote_public_access.findUnique({
      where: { access_token: token },
    });

    if (!publicAccess || !publicAccess.is_active) {
      throw new NotFoundException('Invalid or expired access token');
    }

    // 2. Check if not password protected
    if (!publicAccess.password_hash) {
      return {
        valid: true,
        message: 'No password required',
      };
    }

    // 3. Check lockout status
    const lockoutKey = `${token}:${ipAddress}`;
    const lockoutInfo = this.lockouts.get(lockoutKey);

    if (lockoutInfo?.lockedUntil && lockoutInfo.lockedUntil > new Date()) {
      return {
        valid: false,
        message: 'Too many failed attempts. Please try again later.',
        is_locked: true,
        lockout_expires_at: lockoutInfo.lockedUntil.toISOString(),
        failed_attempts: lockoutInfo.attempts,
      };
    }

    // 4. Compare passwords
    const isValid = await bcrypt.compare(password, publicAccess.password_hash);

    if (isValid) {
      // Clear failed attempts on successful login
      this.lockouts.delete(lockoutKey);

      return {
        valid: true,
        message: 'Password is correct',
      };
    }

    // 5. Track failed attempt
    const currentAttempts = (lockoutInfo?.attempts || 0) + 1;

    if (currentAttempts >= this.MAX_FAILED_ATTEMPTS) {
      // Lock out the IP
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + this.LOCKOUT_DURATION_MINUTES);

      this.lockouts.set(lockoutKey, {
        attempts: currentAttempts,
        lockedUntil,
      });

      this.logger.warn(
        `IP ${ipAddress} locked out for ${this.LOCKOUT_DURATION_MINUTES} minutes due to ${currentAttempts} failed password attempts on token ${token}`,
      );

      return {
        valid: false,
        message: `Too many failed attempts. Locked out for ${this.LOCKOUT_DURATION_MINUTES} minutes.`,
        failed_attempts: currentAttempts,
        is_locked: true,
        lockout_expires_at: lockedUntil.toISOString(),
      };
    }

    // Track attempt but don't lock yet
    this.lockouts.set(lockoutKey, {
      attempts: currentAttempts,
    });

    return {
      valid: false,
      message: 'Incorrect password',
      failed_attempts: currentAttempts,
      is_locked: false,
    };
  }

  /**
   * Get active public access information for a quote
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @returns Public access information or null if not active
   */
  async getPublicAccessStatus(
    tenantId: string,
    quoteId: string,
  ): Promise<PublicUrlResponseDto | null> {
    // 1. Validate quote belongs to tenant
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
      include: {
        tenant: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    // 2. Get active public access record
    const publicAccess = await this.prisma.quote_public_access.findFirst({
      where: {
        quote_id: quoteId,
        is_active: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!publicAccess) {
      return null;
    }

    // 3. Build public URL
    const tenantSubdomain = quote.tenant.subdomain || quote.tenant.id;
    const publicUrl = this.buildPublicUrl(tenantSubdomain, publicAccess.access_token);

    // 4. Return response
    return {
      public_url: publicUrl,
      access_token: publicAccess.access_token,
      has_password: !!publicAccess.password_hash,
      password_hint: publicAccess.password_hint || undefined,
      expires_at: publicAccess.expires_at?.toISOString(),
      created_at: publicAccess.created_at.toISOString(),
    };
  }

  /**
   * Deactivate public URL (revoke access)
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @returns Success message
   */
  async deactivatePublicUrl(tenantId: string, quoteId: string): Promise<{ message: string }> {
    // 1. Validate quote belongs to tenant
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    // 2. Deactivate all public access records for this quote
    const result = await this.prisma.quote_public_access.updateMany({
      where: {
        quote_id: quoteId,
        is_active: true,
      },
      data: {
        is_active: false,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(`No active public URL found for quote ${quoteId}`);
    }

    this.logger.log(`Deactivated ${result.count} public URL(s) for quote ${quoteId}`);

    return {
      message: `Successfully deactivated public access for quote ${quoteId}`,
    };
  }

  /**
   * Check if IP is locked out due to failed password attempts
   *
   * @param token - Public access token
   * @param ipAddress - Client IP
   * @returns Lockout status
   */
  async checkLockout(token: string, ipAddress: string): Promise<{
    is_locked: boolean;
    lockout_expires_at?: string;
    failed_attempts?: number;
  }> {
    const lockoutKey = `${token}:${ipAddress}`;
    const lockoutInfo = this.lockouts.get(lockoutKey);

    if (!lockoutInfo) {
      return { is_locked: false };
    }

    // Check if lockout has expired
    if (lockoutInfo.lockedUntil) {
      if (lockoutInfo.lockedUntil <= new Date()) {
        // Lockout expired, clean up
        this.lockouts.delete(lockoutKey);
        return { is_locked: false };
      }

      return {
        is_locked: true,
        lockout_expires_at: lockoutInfo.lockedUntil.toISOString(),
        failed_attempts: lockoutInfo.attempts,
      };
    }

    // Has failed attempts but not locked yet
    return {
      is_locked: false,
      failed_attempts: lockoutInfo.attempts,
    };
  }

  /**
   * Get public access record by token (for public viewing)
   *
   * @param token - Public access token
   * @returns Public access record with quote data
   */
  async getByToken(token: string): Promise<any> {
    const publicAccess = await this.prisma.quote_public_access.findUnique({
      where: { access_token: token },
      include: {
        quote: {
          include: {
            tenant: {
              include: {
                file_tenant_logo_file_idTofile: true,
                tenant_address: {
                  where: {
                    is_default: true,
                  },
                },
              },
            },
            lead: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                emails: true,
                phones: true,
              },
            },
            vendor: {
              include: {
                signature_file: true,
              },
            },
            jobsite_address: true,
            items: {
              include: {
                quote_group: true,
                unit_measurement: true,
              },
              orderBy: [
                { quote_group: { order_index: 'asc' } },
                { order_index: 'asc' },
              ],
            },
            groups: {
              orderBy: { order_index: 'asc' },
            },
            discount_rules: {
              orderBy: { order_index: 'asc' },
            },
            draw_schedule: {
              orderBy: { draw_number: 'asc' },
            },
            attachments: {
              include: {
                file: true, // Include file details for filename, mime_type, file_size
              },
              orderBy: { order_index: 'asc' },
            },
            latest_pdf_file: true,
          },
        },
      },
    });

    if (!publicAccess) {
      throw new NotFoundException('Invalid access token');
    }

    // Check if expired
    if (!publicAccess.is_active) {
      throw new ForbiddenException('This link has been deactivated');
    }

    if (publicAccess.expires_at && publicAccess.expires_at < new Date()) {
      throw new ForbiddenException('This link has expired');
    }

    // Check quote status (only show sent/delivered/read/opened/downloaded/approved/started/concluded/email_failed quotes publicly)
    if (!['sent', 'delivered', 'read', 'opened', 'downloaded', 'approved', 'started', 'concluded', 'email_failed'].includes(publicAccess.quote.status)) {
      throw new ForbiddenException('This quote is not available for public viewing');
    }

    return publicAccess;
  }

  /**
   * Generate cryptographically secure random token
   *
   * @returns 32-character hex string
   */
  private generateToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Hash password with bcrypt
   *
   * @param password - Plain text password
   * @returns Bcrypt hash
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Build full public URL
   *
   * @param tenantSlug - Tenant subdomain
   * @param token - Access token
   * @returns Full URL
   */
  private buildPublicUrl(tenantSlug: string, token: string): string {
    return `https://${tenantSlug}.lead360.app/public/quotes/${token}`;
  }
}
