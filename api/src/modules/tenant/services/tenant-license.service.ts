import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { UpdateLicenseDto } from '../dto/update-license.dto';

@Injectable()
export class TenantLicenseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all licenses for a tenant
   */
  async findAll(tenantId: string) {
    return this.prisma.tenantLicense.findMany({
      where: { tenant_id: tenantId } as any,
      include: { license_type: true } as any,
      orderBy: { expiry_date: 'asc' } as any,
    });
  }

  /**
   * Get a specific license by ID
   */
  async findOne(tenantId: string, licenseId: string) {
    const license = await this.prisma.tenantLicense.findFirst({
      where: {
        id: licenseId,
        tenant_id: tenantId, // CRITICAL: Tenant isolation
      } as any,
      include: { license_type: true } as any,
    });

    if (!license) {
      throw new NotFoundException('License not found');
    }

    return license;
  }

  /**
   * Find licenses expiring within specified days (for background jobs)
   */
  async findExpiring(tenantId: string, daysFromNow: number) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysFromNow);

    // Get licenses expiring exactly on this date (for daily job)
    const startOfDay = new Date(expiryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(expiryDate);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.tenantLicense.findMany({
      where: {
        tenant_id: tenantId,
        expiry_date: {
          gte: startOfDay,
          lte: endOfDay,
        } as any,
      } as any,
      include: {
        license_type: true,
        tenant: {
          select: {
            id: true,
            company_name: true,
            subdomain: true,
          } as any,
        } as any,
      } as any,
    });
  }

  /**
   * Get all expiring licenses across all tenants (for background job)
   */
  async findAllExpiring(daysFromNow: number) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysFromNow);

    const startOfDay = new Date(expiryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(expiryDate);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.tenantLicense.findMany({
      where: {
        expiry_date: {
          gte: startOfDay,
          lte: endOfDay,
        } as any,
      } as any,
      include: {
        license_type: true,
        tenant: {
          select: {
            id: true,
            company_name: true,
            subdomain: true,
            primary_contact_email: true,
          } as any,
        } as any,
      } as any,
    });
  }

  /**
   * Create a new license
   */
  async create(tenantId: string, createLicenseDto: CreateLicenseDto, userId: string) {
    // Validation: Must provide either license_type_id OR custom_license_type
    if (!createLicenseDto.license_type_id && !createLicenseDto.custom_license_type) {
      throw new BadRequestException(
        'Either license_type_id or custom_license_type must be provided',
      );
    }

    // If license_type_id is provided, verify it exists
    if (createLicenseDto.license_type_id) {
      const licenseType = await this.prisma.licenseType.findUnique({
        where: { id: createLicenseDto.license_type_id } as any,
      });

      if (!licenseType) {
        throw new NotFoundException('License type not found');
      }
    }

    const license = await this.prisma.$transaction(async (tx) => {
      const newLicense = await tx.tenantLicense.create({
        data: {
          tenant_id: tenantId,
          ...createLicenseDto,
        } as any,
        include: { license_type: true } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'CREATE',
          entity_type: 'TenantLicense',
          entity_id: newLicense.id,
          metadata_json: {  created: createLicenseDto } as any,
        } as any,
      });

      return newLicense;
    });

    return license;
  }

  /**
   * Update a license
   */
  async update(
    tenantId: string,
    licenseId: string,
    updateLicenseDto: UpdateLicenseDto,
    userId: string,
  ) {
    // Verify license exists and belongs to tenant
    const existingLicense = await this.findOne(tenantId, licenseId);

    // If license_type_id is being updated, verify it exists
    if (updateLicenseDto.license_type_id) {
      const licenseType = await this.prisma.licenseType.findUnique({
        where: { id: updateLicenseDto.license_type_id } as any,
      });

      if (!licenseType) {
        throw new NotFoundException('License type not found');
      }
    }

    const license = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantLicense.update({
        where: { id: licenseId } as any,
        data: updateLicenseDto,
        include: { license_type: true } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'UPDATE',
          entity_type: 'TenantLicense',
          entity_id: licenseId,
          metadata_json: { 
            old: existingLicense,
            new: updateLicenseDto,
          } as any,
        } as any,
      });

      return updated;
    });

    return license;
  }

  /**
   * Delete a license
   */
  async delete(tenantId: string, licenseId: string, userId: string) {
    // Verify license exists and belongs to tenant
    const existingLicense = await this.findOne(tenantId, licenseId);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantLicense.delete({
        where: { id: licenseId } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'DELETE',
          entity_type: 'TenantLicense',
          entity_id: licenseId,
          metadata_json: {  deleted: existingLicense } as any,
        } as any,
      });
    });

    return { message: 'License deleted successfully' };
  }

  /**
   * Get license status (expired, expiring soon, or valid)
   */
  async getLicenseStatus(tenantId: string, licenseId: string) {
    const license = await this.findOne(tenantId, licenseId);
    const now = new Date();
    const expiryDate = new Date(license.expiry_date);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    let status: 'expired' | 'expiring_soon' | 'valid';
    if (daysUntilExpiry < 0) {
      status = 'expired';
    } else if (daysUntilExpiry <= 30) {
      status = 'expiring_soon';
    } else {
      status = 'valid';
    }

    return {
      license,
      status,
      days_until_expiry: daysUntilExpiry,
    };
  }
}
