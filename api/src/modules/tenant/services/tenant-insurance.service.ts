import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../core/file-storage/file-storage.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { UpdateInsuranceDto } from '../dto/update-insurance.dto';

@Injectable()
export class TenantInsuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Get insurance for a tenant (creates default record if not exists)
   */
  async findOrCreate(tenantId: string) {
    let insurance = await this.prisma.tenant_insurance.findUnique({
      where: { tenant_id: tenantId } as any,
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
      } as any,
    });

    // If no insurance record exists, create empty one
    if (!insurance) {
      insurance = await this.prisma.tenant_insurance.create({
        data: { tenant_id: tenantId } as any,
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
        } as any,
      });
    }

    return this.transformInsuranceResponse(insurance);
  }

  /**
   * Update insurance information
   */
  async update(
    tenantId: string,
    updateInsuranceDto: UpdateInsuranceDto,
    userId: string,
  ) {
    // Ensure insurance record exists
    const existingInsurance = await this.findOrCreate(tenantId);

    const insurance = await this.prisma.tenant_insurance.update({
      where: { tenant_id: tenantId } as any,
      data: updateInsuranceDto,
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
      } as any,
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant_insurance',
      entityId: insurance.id,
      tenantId: tenantId,
      actorUserId: userId,
      before: existingInsurance,
      after: insurance,
      description: 'Tenant insurance updated',
    });

    return this.transformInsuranceResponse(insurance);
  }

  /**
   * Find insurance expiring within specified days (for background jobs)
   */
  async findExpiring(daysFromNow: number) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysFromNow);

    const startOfDay = new Date(expiryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(expiryDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find tenants with GL or WC insurance expiring on this date
    const expiringInsurance = await this.prisma.tenant_insurance.findMany({
      where: {
        OR: [
          {
            gl_expiry_date: {
              gte: startOfDay,
              lte: endOfDay,
            } as any,
          } as any,
          {
            wc_expiry_date: {
              gte: startOfDay,
              lte: endOfDay,
            } as any,
          } as any,
        ],
      } as any,
      include: {
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

    return expiringInsurance;
  }

  /**
   * Get insurance status (expired, expiring soon, or valid)
   */
  async getInsuranceStatus(tenantId: string) {
    const insurance = await this.findOrCreate(tenantId);
    const now = new Date();

    const calculateStatus = (expiryDate: Date | null) => {
      if (!expiryDate) return null;

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

      return { status, days_until_expiry: daysUntilExpiry };
    };

    return {
      insurance: this.transformInsuranceResponse(insurance),
      gl_status: calculateStatus(insurance.gl_expiry_date),
      wc_status: calculateStatus(insurance.wc_expiry_date),
    };
  }

  /**
   * Check if both GL and WC insurance are valid
   */
  async checkCoverage(tenantId: string): Promise<{
    gl_covered: boolean;
    wc_covered: boolean;
    all_covered: boolean;
  }> {
    const insurance = await this.findOrCreate(tenantId);
    const now = new Date();

    const glCovered = insurance.gl_expiry_date
      ? new Date(insurance.gl_expiry_date) > now
      : false;
    const wcCovered = insurance.wc_expiry_date
      ? new Date(insurance.wc_expiry_date) > now
      : false;

    return {
      gl_covered: glCovered,
      wc_covered: wcCovered,
      all_covered: glCovered && wcCovered,
    };
  }

  /**
   * Upload General Liability insurance document
   */
  async uploadGLDocument(
    tenantId: string,
    file: Express.Multer.File,
    userId: string,
  ) {
    // Get or create insurance record
    const insurance = await this.findOrCreate(tenantId);

    // Upload file using FileStorageService
    const { file_id, url, metadata } = await this.fileStorage.uploadFile(
      tenantId,
      file,
      {
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
        ],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
        category: 'insurance',
      },
    );

    // If insurance already has a GL document, delete the old one
    if (insurance.gl_document_file_id) {
      const oldFile = await this.prisma.file.findUnique({
        where: { file_id: insurance.gl_document_file_id },
      });
      if (oldFile) {
        await this.fileStorage.deleteFileByPath(oldFile.storage_path);
        await this.prisma.file.delete({ where: { id: oldFile.id } });
      }
    }

    // Create File record in database
    await this.prisma.file.create({
      data: {
        id: randomBytes(16).toString('hex'),
        file_id,
        tenant_id: tenantId,
        original_filename: metadata.original_filename,
        mime_type: metadata.mime_type,
        size_bytes: metadata.size_bytes,
        category: 'insurance',
        storage_path: metadata.storage_path,
        uploaded_by: userId,
        entity_type: 'insurance_gl',
        entity_id: insurance.id,
      },
    });

    // Update insurance with gl_document_file_id
    await this.prisma.tenant_insurance.update({
      where: { id: insurance.id },
      data: { gl_document_file_id: file_id },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant_insurance',
      entityId: insurance.id,
      tenantId: tenantId,
      actorUserId: userId,
      after: { gl_document_file_id: file_id },
      metadata: {
        original_filename: metadata.original_filename,
        size_bytes: metadata.size_bytes,
      },
      description: 'General Liability insurance document uploaded',
    });

    return {
      message: 'GL document uploaded successfully',
      file_id,
      url,
    };
  }

  /**
   * Upload Workers Compensation insurance document
   */
  async uploadWCDocument(
    tenantId: string,
    file: Express.Multer.File,
    userId: string,
  ) {
    // Get or create insurance record
    const insurance = await this.findOrCreate(tenantId);

    // Upload file using FileStorageService
    const { file_id, url, metadata } = await this.fileStorage.uploadFile(
      tenantId,
      file,
      {
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
        ],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
        category: 'insurance',
      },
    );

    // If insurance already has a WC document, delete the old one
    if (insurance.wc_document_file_id) {
      const oldFile = await this.prisma.file.findUnique({
        where: { file_id: insurance.wc_document_file_id },
      });
      if (oldFile) {
        await this.fileStorage.deleteFileByPath(oldFile.storage_path);
        await this.prisma.file.delete({ where: { id: oldFile.id } });
      }
    }

    // Create File record in database
    await this.prisma.file.create({
      data: {
        id: randomBytes(16).toString('hex'),
        file_id,
        tenant_id: tenantId,
        original_filename: metadata.original_filename,
        mime_type: metadata.mime_type,
        size_bytes: metadata.size_bytes,
        category: 'insurance',
        storage_path: metadata.storage_path,
        uploaded_by: userId,
        entity_type: 'insurance_wc',
        entity_id: insurance.id,
      },
    });

    // Update insurance with wc_document_file_id
    await this.prisma.tenant_insurance.update({
      where: { id: insurance.id },
      data: { wc_document_file_id: file_id },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant_insurance',
      entityId: insurance.id,
      tenantId: tenantId,
      actorUserId: userId,
      after: { wc_document_file_id: file_id },
      metadata: {
        original_filename: metadata.original_filename,
        size_bytes: metadata.size_bytes,
      },
      description: 'Workers Compensation insurance document uploaded',
    });

    return {
      message: 'WC document uploaded successfully',
      file_id,
      url,
    };
  }

  /**
   * Delete General Liability insurance document
   */
  async deleteGLDocument(tenantId: string, userId: string) {
    const insurance = await this.findOrCreate(tenantId);

    if (!insurance.gl_document_file_id) {
      throw new BadRequestException('Insurance does not have a GL document');
    }

    // Get file record
    const fileRecord = await this.prisma.file.findUnique({
      where: { file_id: insurance.gl_document_file_id },
    });

    if (fileRecord) {
      // Delete from filesystem (hard delete)
      await this.fileStorage.deleteFileByPath(fileRecord.storage_path);

      // Delete from database (hard delete)
      await this.prisma.file.delete({ where: { id: fileRecord.id } });
    }

    // Update insurance to remove gl_document_file_id
    await this.prisma.tenant_insurance.update({
      where: { id: insurance.id },
      data: { gl_document_file_id: null },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant_insurance',
      entityId: insurance.id,
      tenantId: tenantId,
      actorUserId: userId,
      before: { gl_document_file_id: insurance.gl_document_file_id },
      after: { gl_document_file_id: null },
      description: 'General Liability insurance document deleted',
    });

    return { message: 'GL document deleted successfully' };
  }

  /**
   * Delete Workers Compensation insurance document
   */
  async deleteWCDocument(tenantId: string, userId: string) {
    const insurance = await this.findOrCreate(tenantId);

    if (!insurance.wc_document_file_id) {
      throw new BadRequestException('Insurance does not have a WC document');
    }

    // Get file record
    const fileRecord = await this.prisma.file.findUnique({
      where: { file_id: insurance.wc_document_file_id },
    });

    if (fileRecord) {
      // Delete from filesystem (hard delete)
      await this.fileStorage.deleteFileByPath(fileRecord.storage_path);

      // Delete from database (hard delete)
      await this.prisma.file.delete({ where: { id: fileRecord.id } });
    }

    // Update insurance to remove wc_document_file_id
    await this.prisma.tenant_insurance.update({
      where: { id: insurance.id },
      data: { wc_document_file_id: null },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'tenant_insurance',
      entityId: insurance.id,
      tenantId: tenantId,
      actorUserId: userId,
      before: { wc_document_file_id: insurance.wc_document_file_id },
      after: { wc_document_file_id: null },
      description: 'Workers Compensation insurance document deleted',
    });

    return { message: 'WC document deleted successfully' };
  }

  /**
   * Transform Prisma response to use clean field names for API
   * Maps ugly Prisma-generated relation names to developer-friendly aliases
   */
  private transformInsuranceResponse(insurance: any) {
    if (!insurance) return insurance;

    return {
      ...insurance,
      // Create clean aliases for frontend
      gl_document_file:
        insurance.file_tenant_insurance_gl_document_file_idTofile || null,
      wc_document_file:
        insurance.file_tenant_insurance_wc_document_file_idTofile || null,
      // Remove ugly Prisma relation names from response
      file_tenant_insurance_gl_document_file_idTofile: undefined,
      file_tenant_insurance_wc_document_file_idTofile: undefined,
    };
  }
}
