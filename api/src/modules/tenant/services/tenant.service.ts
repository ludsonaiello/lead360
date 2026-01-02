import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../core/file-storage';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { UpdateBrandingDto } from '../dto/update-branding.dto';

const RESERVED_SUBDOMAINS = [
  'www',
  'app',
  'api',
  'admin',
  'mail',
  'ftp',
  'smtp',
  'pop',
  'imap',
  'webmail',
  'email',
  'portal',
  'dashboard',
  'billing',
  'support',
  'help',
  'docs',
  'blog',
  'cdn',
  'static',
  'assets',
  'files',
  'upload',
  'downloads',
];

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
  ) {}

  /**
   * Find tenant by subdomain (used by middleware for tenant resolution)
   */
  async findBySubdomain(subdomain: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain } as any,
      include: {
        subscription_plan: true,
      } as any,
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with subdomain '${subdomain}' not found`);
    }

    if (!tenant.is_active) {
      throw new ForbiddenException('Tenant account is inactive');
    }

    return tenant;
  }

  /**
   * Find tenant by ID with full relations
   */
  async findById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId } as any,
      include: {
        subscription_plan: true,
        addresses: {
          orderBy: { is_default: 'desc' } as any,
        } as any,
        licenses: {
          include: { license_type: true } as any,
          orderBy: { expiry_date: 'asc' } as any,
        } as any,
        insurance: true,
        payment_terms: true,
        business_hours: true,
        custom_hours: {
          orderBy: { date: 'asc' } as any,
        } as any,
        service_areas: true,
      } as any,
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found`);
    }

    return tenant;
  }

  /**
   * Check if subdomain is available (unique + not reserved)
   */
  async checkSubdomainAvailability(subdomain: string): Promise<{
    available: boolean;
    reason?: string;
  }> {
    // Check if reserved
    if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
      return {
        available: false,
        reason: 'This subdomain is reserved and cannot be used',
      };
    }

    // Check if taken
    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain } as any,
    });

    if (existing) {
      return {
        available: false,
        reason: 'This subdomain is already taken',
      };
    }

    return { available: true };
  }

  /**
   * Check if EIN is unique (global check)
   */
  async checkEinUniqueness(ein: string, excludeTenantId?: string): Promise<{
    unique: boolean;
    conflictingTenantId?: string;
  }> {
    const existing = await this.prisma.tenant.findUnique({
      where: { ein },
      select: { id: true, legal_business_name: true },
    });

    if (existing && existing.id !== excludeTenantId) {
      return {
        unique: false,
        conflictingTenantId: existing.id,
      };
    }

    return { unique: true };
  }

  /**
   * Create new tenant (admin-only function, called during registration)
   */
  async create(createTenantDto: CreateTenantDto) {
    // Check subdomain availability
    const subdomainCheck = await this.checkSubdomainAvailability(
      createTenantDto.subdomain,
    );
    if (!subdomainCheck.available) {
      throw new ConflictException(subdomainCheck.reason);
    }

    // Check EIN uniqueness
    const einCheck = await this.checkEinUniqueness(createTenantDto.ein);
    if (!einCheck.unique) {
      throw new ConflictException(
        `EIN ${createTenantDto.ein} is already registered to another tenant`,
      );
    }

    // Get default subscription plan
    let subscriptionPlanId: string | undefined = undefined;
    const defaultPlan = await this.prisma.subscriptionPlan.findFirst({
      where: { is_default: true, is_active: true } as any,
    });
    if (defaultPlan) {
      subscriptionPlanId = defaultPlan.id;
    }

    // Create tenant with transaction to also create default business hours
    const tenant = await this.prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          ...createTenantDto,
          subscription_plan_id: subscriptionPlanId,
          is_active: true,
          subscription_status: 'trial',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
        } as any,
        include: {
          subscription_plan: true,
        } as any,
      });

      // Create default business hours (Mon-Fri 9-5, closed weekends)
      await tx.tenantBusinessHours.create({
        data: {
          tenant_id: newTenant.id,
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
        } as any,
      });

      return newTenant;
    });

    return tenant;
  }

  /**
   * Update tenant profile (with protected fields audit logging)
   */
  async update(tenantId: string, updateTenantDto: UpdateTenantDto, userId: string) {
    // Verify tenant exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId } as any,
    });

    if (!existingTenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Track changes for audit log
    const changes: Record<string, { old: any; new: any }> = {};
    Object.keys(updateTenantDto).forEach((key) => {
      const oldValue = existingTenant[key];
      const newValue = updateTenantDto[key];
      if (oldValue !== newValue) {
        changes[key] = { old: oldValue, new: newValue };
      }
    });

    // Update tenant
    const updatedTenant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenantId } as any,
        data: updateTenantDto,
        include: {
          subscription_plan: true,
        } as any,
      });

      // Create audit log entry for changes
      if (Object.keys(changes).length > 0) {
        await tx.auditLog.create({
          data: {
            tenant_id: tenantId,
            actor_user_id: userId,
            action: 'UPDATE',
            entity_type: 'Tenant',
            entity_id: tenantId,
            metadata_json: changes,
          } as any,
        });
      }

      return updated;
    });

    return updatedTenant;
  }

  /**
   * Update branding settings
   */
  async updateBranding(tenantId: string, brandingDto: UpdateBrandingDto, userId: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId } as any,
      data: {
        primary_color: brandingDto.primary_color,
        secondary_color: brandingDto.secondary_color,
        logo_file_id: brandingDto.logo_file_id,
        company_website: brandingDto.company_website,
        tagline: brandingDto.tagline,
      } as any,
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        actor_user_id: userId,
        action: 'UPDATE',
        entity_type: 'Tenant',
        entity_id: tenantId,
        metadata_json: {  branding: brandingDto } as any,
      } as any,
    });

    return tenant;
  }

  /**
   * Suspend tenant (admin-only)
   */
  async suspend(tenantId: string, reason: string, adminUserId: string) {
    const tenant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenantId } as any,
        data: { is_active: false } as any,
      });

      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: adminUserId,
          action: 'SUSPEND',
          entity_type: 'Tenant',
          entity_id: tenantId,
          metadata_json: {  is_active: { old: true, new: false }, reason } as any,
        } as any,
      });

      return updated;
    });

    return tenant;
  }

  /**
   * Reactivate tenant (admin-only)
   */
  async reactivate(tenantId: string, adminUserId: string) {
    const tenant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenantId } as any,
        data: { is_active: true } as any,
      });

      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: adminUserId,
          action: 'REACTIVATE',
          entity_type: 'Tenant',
          entity_id: tenantId,
          metadata_json: {  is_active: { old: false, new: true } } as any,
        } as any,
      });

      return updated;
    });

    return tenant;
  }

  /**
   * Get tenant statistics (for dashboard)
   */
  async getStatistics(tenantId: string) {
    const [
      userCount,
      addressCount,
      licenseCount,
      expiringLicenses,
      insuranceStatus,
    ] = await Promise.all([
      this.prisma.user.count({ where: { tenant_id: tenantId, is_active: true } }),
      this.prisma.tenantAddress.count({ where: { tenant_id: tenantId } }),
      this.prisma.tenantLicense.count({ where: { tenant_id: tenantId } }),
      this.prisma.tenantLicense.count({
        where: {
          tenant_id: tenantId,
          expiry_date: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Expiring in 30 days
          } as any,
        } as any,
      }),
      this.prisma.tenantInsurance.findUnique({
        where: { tenant_id: tenantId } as any,
        select: {
          gl_expiry_date: true,
          wc_expiry_date: true,
        } as any,
      }),
    ]);

    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const insuranceExpiringSoon = {
      gl: insuranceStatus?.gl_expiry_date
        ? new Date(insuranceStatus.gl_expiry_date) <= thirtyDaysFromNow
        : false,
      wc: insuranceStatus?.wc_expiry_date
        ? new Date(insuranceStatus.wc_expiry_date) <= thirtyDaysFromNow
        : false,
    };

    return {
      users: userCount,
      addresses: addressCount,
      licenses: licenseCount,
      expiring_licenses: expiringLicenses,
      insurance_expiring_soon: insuranceExpiringSoon,
    };
  }

  /**
   * Upload tenant logo
   */
  async uploadLogo(tenantId: string, file: Express.Multer.File): Promise<{ url: string }> {
    const { file_id, url } = await this.fileStorage.uploadLogo(tenantId, file);

    await this.prisma.tenant.update({
      where: { id: tenantId } as any,
      data: { logo_file_id: file_id } as any,
    });

    return { url };
  }
}
