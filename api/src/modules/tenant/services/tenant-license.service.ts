import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../core/file-storage/file-storage.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { UpdateLicenseDto } from '../dto/update-license.dto';

import { randomBytes } from 'crypto';
@Injectable()
export class TenantLicenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Get all licenses for a tenant
   */
  async findAll(tenantId: string) {
    return this.prisma.tenant_license.findMany({
      where: { tenant_id: tenantId } as any,
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
    });
  }

  /**
   * Get a specific license by ID
   */
  async findOne(tenantId: string, licenseId: string) {
    const license = await this.prisma.tenant_license.findFirst({
      where: {
        id: licenseId,
        tenant_id: tenantId, // CRITICAL: Tenant isolation
      } as any,
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

    return this.prisma.tenant_license.findMany({
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

    return this.prisma.tenant_license.findMany({
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
      const licenseType = await this.prisma.license_type.findUnique({
        where: { id: createLicenseDto.license_type_id } as any,
      });

      if (!licenseType) {
        throw new NotFoundException('License type not found');
      }
    }

    const license = await this.prisma.tenant_license.create({
      data: {
        tenant_id: tenantId,
        ...createLicenseDto,
      } as any,
      include: { license_type: true } as any,
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'tenant_license',
      entityId: license.id,
      tenantId: tenantId,
      actorUserId: userId,
      after: license,
      description: 'Tenant license created',
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
      const licenseType = await this.prisma.license_type.findUnique({
        where: { id: updateLicenseDto.license_type_id } as any,
      });

      if (!licenseType) {
        throw new NotFoundException('License type not found');
      }
    }

    const license = await this.prisma.tenant_license.update({
      where: { id: licenseId } as any,
      data: updateLicenseDto,
      include: { license_type: true } as any,
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant_license',
      entityId: licenseId,
      tenantId: tenantId,
      actorUserId: userId,
      before: existingLicense,
      after: license,
      description: 'Tenant license updated',
    });

    return license;
  }

  /**
   * Delete a license
   */
  async delete(tenantId: string, licenseId: string, userId: string) {
    // Verify license exists and belongs to tenant
    const existingLicense = await this.findOne(tenantId, licenseId);

    // If license has an associated document, delete it (hard delete)
    if (existingLicense.document_file_id) {
      const fileRecord = await this.prisma.file.findUnique({
        where: { file_id: existingLicense.document_file_id },
      });

      if (fileRecord) {
        // Delete from filesystem
        await this.fileStorage.deleteFileByPath(fileRecord.storage_path);

        // Delete from database
        await this.prisma.file.delete({ where: { id: fileRecord.id } });
      }
    }

    await this.prisma.tenant_license.delete({
      where: { id: licenseId } as any,
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'tenant_license',
      entityId: licenseId,
      tenantId: tenantId,
      actorUserId: userId,
      before: existingLicense,
      metadata: {
        deleted_file_id: existingLicense.document_file_id || null,
      },
      description: 'Tenant license deleted',
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

  /**
   * Upload document for a license
   */
  async uploadDocument(
    tenantId: string,
    licenseId: string,
    file: Express.Multer.File,
    userId: string,
  ) {
    // Verify license exists and belongs to tenant
    const license = await this.findOne(tenantId, licenseId);

    // Upload file using FileStorageService
    const { file_id, url, metadata } = await this.fileStorage.uploadFile(
      tenantId,
      file,
      {
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
        category: 'license',
      },
    );

    // If license already has a document, delete the old one
    if (license.document_file_id) {
      const oldFile = await this.prisma.file.findUnique({
        where: { file_id: license.document_file_id },
      });
      if (oldFile) {
        await this.fileStorage.deleteFileByPath(oldFile.storage_path);
        await this.prisma.file.delete({ where: { id: oldFile.id } });
      }
    }

    // Create File record in database
    const fileRecord = await this.prisma.file.create({
      data: {
        id: randomBytes(16).toString('hex'),
        file_id,
        tenant_id: tenantId,
        original_filename: metadata.original_filename,
        mime_type: metadata.mime_type,
        size_bytes: metadata.size_bytes,
        category: 'license',
        storage_path: metadata.storage_path,
        uploaded_by: userId,
        entity_type: 'license',
        entity_id: licenseId,
      },
    });

    // Update license with document_file_id
    await this.prisma.tenant_license.update({
      where: { id: licenseId },
      data: { document_file_id: file_id },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant_license',
      entityId: licenseId,
      tenantId: tenantId,
      actorUserId: userId,
      after: { document_file_id: file_id },
      metadata: {
        original_filename: metadata.original_filename,
        size_bytes: metadata.size_bytes,
      },
      description: 'License document uploaded',
    });

    return {
      message: 'Document uploaded successfully',
      file_id,
      url,
    };
  }

  /**
   * Delete document for a license
   */
  async deleteDocument(tenantId: string, licenseId: string, userId: string) {
    // Verify license exists and belongs to tenant
    const license = await this.findOne(tenantId, licenseId);

    if (!license.document_file_id) {
      throw new BadRequestException('License does not have a document');
    }

    // Get file record
    const fileRecord = await this.prisma.file.findUnique({
      where: { file_id: license.document_file_id },
    });

    if (fileRecord) {
      // Delete from filesystem (hard delete)
      await this.fileStorage.deleteFileByPath(fileRecord.storage_path);

      // Delete from database (hard delete)
      await this.prisma.file.delete({ where: { id: fileRecord.id } });
    }

    // Update license to remove document_file_id
    await this.prisma.tenant_license.update({
      where: { id: licenseId },
      data: { document_file_id: null },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant_license',
      entityId: licenseId,
      tenantId: tenantId,
      actorUserId: userId,
      before: { document_file_id: license.document_file_id },
      after: { document_file_id: null },
      description: 'License document deleted',
    });

    return { message: 'Document deleted successfully' };
  }
}
