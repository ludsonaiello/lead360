import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../core/file-storage';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
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
  private readonly uploadBasePath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly configService: ConfigService,
    private readonly auditLogger: AuditLoggerService,
  ) {
    const uploadsPath =
      this.configService.get<string>('UPLOADS_PATH') ||
      '/var/www/lead360.app/app/uploads/public';
    this.uploadBasePath = uploadsPath;
  }

  /**
   * Find tenant by subdomain (used by middleware for tenant resolution)
   */
  async findBySubdomain(subdomain: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain } as any,
      include: {
        subscription_plan: true,
        file_tenant_logo_file_idTofile: {
          select: {
            file_id: true,
            original_filename: true,
            mime_type: true,
            size_bytes: true,
            created_at: true,
          },
        },
        file_tenant_venmo_qr_code_file_idTofile: {
          select: {
            file_id: true,
            original_filename: true,
            mime_type: true,
            size_bytes: true,
            created_at: true,
          },
        },
      } as any,
    });

    if (!tenant) {
      throw new NotFoundException(
        `Tenant with subdomain '${subdomain}' not found`,
      );
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
        file_tenant_logo_file_idTofile: {
          select: {
            file_id: true,
            original_filename: true,
            mime_type: true,
            size_bytes: true,
            created_at: true,
          },
        },
        file_tenant_venmo_qr_code_file_idTofile: {
          select: {
            file_id: true,
            original_filename: true,
            mime_type: true,
            size_bytes: true,
            created_at: true,
          },
        },
        tenant_address: {
          orderBy: { is_default: 'desc' } as any,
        } as any,
        tenant_license: {
          include: {
            license_type: true,
            file: {
              select: {
                file_id: true,
                original_filename: true,
                mime_type: true,
                size_bytes: true,
                created_at: true,
              },
            },
          } as any,
          orderBy: { expiry_date: 'asc' } as any,
        } as any,
        tenant_insurance: {
          include: {
            file_tenant_insurance_gl_document_file_idTofile: {
              select: {
                file_id: true,
                original_filename: true,
                mime_type: true,
                size_bytes: true,
                created_at: true,
              },
            },
            file_tenant_insurance_wc_document_file_idTofile: {
              select: {
                file_id: true,
                original_filename: true,
                mime_type: true,
                size_bytes: true,
                created_at: true,
              },
            },
          },
        },
        tenant_payment_terms: true,
        tenant_business_hours: true,
        tenant_custom_hours: {
          orderBy: { date: 'asc' } as any,
        } as any,
        tenant_service_area: true,
        tenant_service: {
          include: {
            service: true,
          },
        },
      } as any,
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found`);
    }

    // Transform tenant_services to services_offered array for backward compatibility
    const services_offered =
      tenant.tenant_services?.map((ts: any) => ts.service) || [];

    return {
      ...tenant,
      services_offered,
    };
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
  async checkEinUniqueness(
    ein: string,
    excludeTenantId?: string,
  ): Promise<{
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
  async create(createTenantDto: CreateTenantDto, userId?: string) {
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
    const defaultPlan = await this.prisma.subscription_plan.findFirst({
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
      await tx.tenant_business_hours.create({
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

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'tenant',
      entityId: tenant.id,
      tenantId: tenant.id,
      actorUserId: userId || 'system',
      after: tenant,
      description: 'Tenant created',
    });

    return tenant;
  }

  /**
   * Update tenant profile (with protected fields audit logging)
   */
  async update(
    tenantId: string,
    updateTenantDto: UpdateTenantDto,
    userId: string,
  ) {
    // Verify tenant exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId } as any,
    });

    if (!existingTenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Extract services_offered if present (handle separately)
    const { services_offered, ...tenantData } = updateTenantDto as any;

    // Update tenant
    const updatedTenant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenantId } as any,
        data: tenantData,
        include: {
          subscription_plan: true,
        } as any,
      });

      // Handle services_offered if provided
      if (services_offered !== undefined && Array.isArray(services_offered)) {
        // Delete existing service assignments
        await tx.tenant_service.deleteMany({
          where: { tenant_id: tenantId } as any,
        });

        // Create new service assignments if array is not empty
        if (services_offered.length > 0) {
          await tx.tenant_service.createMany({
            data: services_offered.map((service_id: string) => ({
              tenant_id: tenantId,
              service_id,
            })) as any,
          });
        }
      }

      return updated;
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant',
      entityId: tenantId,
      tenantId: tenantId,
      actorUserId: userId,
      before: existingTenant,
      after: updatedTenant,
      description: 'Tenant updated',
    });

    return updatedTenant;
  }

  /**
   * Update branding settings
   */
  async updateBranding(
    tenantId: string,
    brandingDto: UpdateBrandingDto,
    userId: string,
  ) {
    // Get existing tenant data before update
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId } as any,
    });

    if (!existingTenant) {
      throw new NotFoundException('Tenant not found');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId } as any,
      data: {
        primary_brand_color: brandingDto.primary_brand_color,
        secondary_brand_color: brandingDto.secondary_brand_color,
        accent_color: brandingDto.accent_color,
        logo_file_id: brandingDto.logo_file_id,
        company_website: brandingDto.company_website,
        tagline: brandingDto.tagline,
      } as any,
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant',
      entityId: tenantId,
      tenantId: tenantId,
      actorUserId: userId,
      before: existingTenant,
      after: tenant,
      description: 'Tenant branding updated',
    });

    return tenant;
  }

  /**
   * Suspend tenant (admin-only)
   */
  async suspend(tenantId: string, reason: string, adminUserId: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId } as any,
      data: { is_active: false } as any,
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant',
      entityId: tenantId,
      tenantId: tenantId,
      actorUserId: adminUserId,
      before: { is_active: true },
      after: { is_active: false },
      metadata: { reason },
      description: `Tenant suspended: ${reason}`,
    });

    return tenant;
  }

  /**
   * Reactivate tenant (admin-only)
   */
  async reactivate(tenantId: string, adminUserId: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId } as any,
      data: { is_active: true } as any,
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant',
      entityId: tenantId,
      tenantId: tenantId,
      actorUserId: adminUserId,
      before: { is_active: false },
      after: { is_active: true },
      description: 'Tenant reactivated',
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
      this.prisma.user.count({
        where: { tenant_id: tenantId, is_active: true },
      }),
      this.prisma.tenant_address.count({ where: { tenant_id: tenantId } }),
      this.prisma.tenant_license.count({ where: { tenant_id: tenantId } }),
      this.prisma.tenant_license.count({
        where: {
          tenant_id: tenantId,
          expiry_date: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Expiring in 30 days
          } as any,
        } as any,
      }),
      this.prisma.tenant_insurance.findUnique({
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
      tenant_address: addressCount,
      tenant_license: licenseCount,
      expiring_tenant_license: expiringLicenses,
      insurance_expiring_soon: insuranceExpiringSoon,
    };
  }

  /**
   * Upload tenant logo
   */
  async uploadLogo(
    tenantId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<{ file_id: string; url: string; metadata: any }> {
    // Get current tenant to check for existing logo
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId } as any,
      select: { logo_file_id: true } as any,
    });

    // Upload new logo
    const { file_id, url } = await this.fileStorage.uploadLogo(tenantId, file);

    // If tenant has existing logo, delete it (hard delete)
    const existingLogoFileId = tenant?.logo_file_id as
      | string
      | null
      | undefined;
    if (existingLogoFileId) {
      const oldFile = await this.prisma.file.findUnique({
        where: { file_id: existingLogoFileId },
      });
      if (oldFile) {
        await this.fileStorage.deleteFileByPath(oldFile.storage_path);
        await this.prisma.file.delete({ where: { id: oldFile.id } });
      }
    }

    // Get file extension from original filename
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${file_id}.${fileExtension}`;
    const storagePath = `${this.uploadBasePath}/${tenantId}/images/${fileName}`;

    // Create File record in database
    await this.prisma.file.create({
      data: {
        id: file_id,
        file_id,
        tenant_id: tenantId,
        original_filename: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        category: 'logo',
        storage_path: storagePath,
        uploaded_by: userId,
        entity_type: 'tenant_logo',
        entity_id: tenantId,
      },
    });

    // Update tenant with logo_file_id
    await this.prisma.tenant.update({
      where: { id: tenantId } as any,
      data: { logo_file_id: file_id } as any,
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant',
      entityId: tenantId,
      tenantId: tenantId,
      actorUserId: userId,
      after: { logo_file_id: file_id },
      metadata: {
        original_filename: file.originalname,
        size_bytes: file.size,
      },
      description: 'Tenant logo uploaded',
    });

    // Return file metadata
    return {
      file_id,
      url,
      metadata: {
        original_filename: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        storage_path: storagePath,
      },
    };
  }

  /**
   * Delete tenant logo
   */
  async deleteLogo(
    tenantId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId } as any,
      select: { logo_file_id: true } as any,
    });

    const logoFileId = tenant?.logo_file_id as string | null | undefined;
    if (!logoFileId) {
      throw new BadRequestException('Tenant does not have a logo');
    }

    // Get file record
    const fileRecord = await this.prisma.file.findUnique({
      where: { file_id: logoFileId },
    });

    if (fileRecord) {
      // Delete from filesystem (hard delete)
      await this.fileStorage.deleteFileByPath(fileRecord.storage_path);

      // Delete from database (hard delete)
      await this.prisma.file.delete({ where: { id: fileRecord.id } });
    }

    // Update tenant to remove logo_file_id
    await this.prisma.tenant.update({
      where: { id: tenantId } as any,
      data: { logo_file_id: null } as any,
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant',
      entityId: tenantId,
      tenantId: tenantId,
      actorUserId: userId,
      before: { logo_file_id: logoFileId },
      after: { logo_file_id: null },
      description: 'Tenant logo deleted',
    });

    return { message: 'Logo deleted successfully' };
  }
}
