import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  GoogleMapsService,
  PartialAddress,
  ValidatedAddress,
} from '../../leads/services/google-maps.service';
import { FilesService } from '../../files/files.service';
import { CreateVendorDto, UpdateVendorDto, ListVendorsDto } from '../dto/vendor';
import { randomUUID } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class VendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly googleMapsService: GoogleMapsService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Generate UUID v4 using Node's built-in crypto.randomUUID()
   */
  private generateUUID(): string {
    return randomUUID();
  }

  /**
   * Create a new vendor
   */
  async create(tenantId: string, userId: string, dto: CreateVendorDto) {
    // 1. Validate email uniqueness
    const existing = await this.prisma.vendor.findFirst({
      where: { tenant_id: tenantId, email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // 2. Validate signature file exists and belongs to tenant (if provided)
    // Ignore placeholder values from frontend
    const hasValidSignature =
      dto.signature_file_id &&
      dto.signature_file_id !== 'placeholder-file-id' &&
      dto.signature_file_id.trim() !== '';

    if (hasValidSignature) {
      const signatureFile = await this.prisma.file.findFirst({
        where: {
          file_id: dto.signature_file_id,
          tenant_id: tenantId,
        },
      });
      if (!signatureFile) {
        throw new NotFoundException('Signature file not found');
      }
    }

    // 3. Validate address with Google Maps
    const partialAddress: PartialAddress = {
      address_line1: dto.address_line1,
      address_line2: dto.address_line2,
      city: dto.city,
      state: dto.state,
      zip_code: dto.zip_code,
      latitude: dto.latitude,
      longitude: dto.longitude,
    };
    const validatedAddress =
      await this.googleMapsService.validateAddress(partialAddress);

    // 4. If is_default=true, unset default on others
    if (dto.is_default) {
      await this.prisma.vendor.updateMany({
        where: { tenant_id: tenantId, is_default: true },
        data: { is_default: false },
      });
    }

    // 5. Create vendor
    const vendorId = this.generateUUID();
    const vendor = await this.prisma.vendor.create({
      data: {
        id: vendorId,
        tenant_id: tenantId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address_line1: validatedAddress.address_line1,
        address_line2: validatedAddress.address_line2,
        city: validatedAddress.city,
        state: validatedAddress.state,
        zip_code: validatedAddress.zip_code,
        latitude: new Decimal(validatedAddress.latitude),
        longitude: new Decimal(validatedAddress.longitude),
        google_place_id: validatedAddress.google_place_id,
        signature_file_id: hasValidSignature ? dto.signature_file_id : undefined,
        is_default: dto.is_default || false,
        created_by_user_id: userId,
      },
    });

    // 6. Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'vendor',
      entityId: vendor.id,
      tenantId,
      actorUserId: userId,
      after: vendor,
      description: `Vendor created: ${vendor.name}`,
    });

    return vendor;
  }

  /**
   * List all vendors for a tenant
   */
  async findAll(tenantId: string, filters: ListVendorsDto) {
    const { is_active, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
    };

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
        include: {
          signature_file: {
            select: {
              file_id: true,
              original_filename: true,
            },
          },
        },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return {
      data: vendors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single vendor
   */
  async findOne(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenant_id: tenantId },
      include: {
        signature_file: {
          select: {
            file_id: true,
            original_filename: true,
            size_bytes: true,
            mime_type: true,
          },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  /**
   * Update a vendor
   */
  async update(
    tenantId: string,
    vendorId: string,
    userId: string,
    dto: UpdateVendorDto,
  ) {
    // Verify vendor exists
    const vendor = await this.findOne(tenantId, vendorId);

    // Validate email uniqueness if email is being changed
    if (dto.email && dto.email !== vendor.email) {
      const existing = await this.prisma.vendor.findFirst({
        where: {
          tenant_id: tenantId,
          email: dto.email,
          id: { not: vendorId },
        },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    // Validate signature file if being changed (ignore placeholder values)
    const hasValidSignatureUpdate =
      dto.signature_file_id &&
      dto.signature_file_id !== 'placeholder-file-id' &&
      dto.signature_file_id.trim() !== '';

    if (hasValidSignatureUpdate) {
      const signatureFile = await this.prisma.file.findFirst({
        where: {
          file_id: dto.signature_file_id,
          tenant_id: tenantId,
        },
      });
      if (!signatureFile) {
        throw new NotFoundException('Signature file not found');
      }
    }

    // Validate address with Google Maps if address fields are provided
    let validatedAddress: ValidatedAddress | null = null;
    if (
      dto.address_line1 ||
      dto.city ||
      dto.state ||
      dto.zip_code ||
      dto.latitude ||
      dto.longitude
    ) {
      const partialAddress: PartialAddress = {
        address_line1: dto.address_line1 || vendor.address_line1,
        address_line2: dto.address_line2 !== undefined ? dto.address_line2 : (vendor.address_line2 || undefined),
        city: dto.city || vendor.city,
        state: dto.state || vendor.state,
        zip_code: dto.zip_code || vendor.zip_code,
        latitude: dto.latitude !== undefined ? dto.latitude : Number(vendor.latitude),
        longitude: dto.longitude !== undefined ? dto.longitude : Number(vendor.longitude),
      };
      validatedAddress =
        await this.googleMapsService.validateAddress(partialAddress);
    }

    // If is_default=true, unset default on others
    if (dto.is_default && !vendor.is_default) {
      await this.prisma.vendor.updateMany({
        where: { tenant_id: tenantId, is_default: true },
        data: { is_default: false },
      });
    }

    // Update vendor
    const updateData: any = {
      ...(dto.name && { name: dto.name }),
      ...(dto.email && { email: dto.email }),
      ...(dto.phone && { phone: dto.phone }),
      ...(dto.is_default !== undefined && { is_default: dto.is_default }),
      ...(dto.is_active !== undefined && { is_active: dto.is_active }),
    };

    // Handle signature_file_id:
    // - If valid file ID provided: update to that value
    // - If placeholder/empty provided: set to null (remove signature)
    // - If undefined: don't update (keep existing value)
    if (dto.signature_file_id !== undefined) {
      updateData.signature_file_id = hasValidSignatureUpdate
        ? dto.signature_file_id
        : null;
    }

    if (validatedAddress) {
      updateData.address_line1 = validatedAddress.address_line1;
      updateData.address_line2 = validatedAddress.address_line2;
      updateData.city = validatedAddress.city;
      updateData.state = validatedAddress.state;
      updateData.zip_code = validatedAddress.zip_code;
      updateData.latitude = new Decimal(validatedAddress.latitude);
      updateData.longitude = new Decimal(validatedAddress.longitude);
      updateData.google_place_id = validatedAddress.google_place_id;
    }

    const updatedVendor = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: updateData,
      include: {
        signature_file: {
          select: {
            file_id: true,
            original_filename: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'vendor',
      entityId: vendorId,
      tenantId,
      actorUserId: userId,
      before: vendor,
      after: updatedVendor,
      description: `Vendor updated: ${updatedVendor.name}`,
    });

    return updatedVendor;
  }

  /**
   * Delete a vendor
   */
  async delete(tenantId: string, vendorId: string, userId: string) {
    // Verify vendor exists
    const vendor = await this.findOne(tenantId, vendorId);

    // Check if vendor is used in any quotes
    const quotesCount = await this.prisma.quote.count({
      where: { vendor_id: vendorId, tenant_id: tenantId },
    });

    if (quotesCount > 0) {
      throw new BadRequestException(
        `Cannot delete vendor. It is used in ${quotesCount} quote(s)`,
      );
    }

    // Delete vendor
    await this.prisma.vendor.delete({
      where: { id: vendorId },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'vendor',
      entityId: vendorId,
      tenantId,
      actorUserId: userId,
      before: vendor,
      description: `Vendor deleted: ${vendor.name}`,
    });

    return { message: 'Vendor deleted successfully' };
  }

  /**
   * Set a vendor as default
   */
  async setDefault(tenantId: string, vendorId: string, userId: string) {
    // Verify vendor exists
    const vendor = await this.findOne(tenantId, vendorId);

    // Unset default on all other vendors
    await this.prisma.vendor.updateMany({
      where: { tenant_id: tenantId, is_default: true },
      data: { is_default: false },
    });

    // Set this vendor as default
    const updatedVendor = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { is_default: true },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'vendor',
      entityId: vendorId,
      tenantId,
      actorUserId: userId,
      before: vendor,
      after: updatedVendor,
      description: `Vendor set as default: ${vendor.name}`,
    });

    return updatedVendor;
  }

  /**
   * Upload signature for vendor (update signature_file_id)
   * Note: File upload happens via FilesController first, this just updates the reference
   */
  async uploadSignature(
    tenantId: string,
    vendorId: string,
    userId: string,
    fileId: string,
  ) {
    // Verify vendor exists
    const vendor = await this.findOne(tenantId, vendorId);

    // Validate file exists and belongs to tenant
    const signatureFile = await this.prisma.file.findFirst({
      where: {
        file_id: fileId,
        tenant_id: tenantId,
      },
    });

    if (!signatureFile) {
      throw new NotFoundException('Signature file not found');
    }

    // Update vendor
    const updatedVendor = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { signature_file_id: fileId },
      include: {
        signature_file: {
          select: {
            file_id: true,
            original_filename: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'vendor',
      entityId: vendorId,
      tenantId,
      actorUserId: userId,
      before: vendor,
      after: updatedVendor,
      description: `Vendor signature updated: ${vendor.name}`,
    });

    return updatedVendor;
  }

  /**
   * Get vendor statistics (quote counts by status)
   */
  async getStatistics(tenantId: string, vendorId: string) {
    // Verify vendor exists
    await this.findOne(tenantId, vendorId);

    const [totalQuotes, quotesByStatus] = await Promise.all([
      this.prisma.quote.count({
        where: { vendor_id: vendorId, tenant_id: tenantId },
      }),
      this.prisma.quote.groupBy({
        by: ['status'],
        where: { vendor_id: vendorId, tenant_id: tenantId },
        _count: true,
      }),
    ]);

    const statusCounts = quotesByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      vendor_id: vendorId,
      total_quotes: totalQuotes,
      quotes_by_status: statusCounts,
    };
  }
}
