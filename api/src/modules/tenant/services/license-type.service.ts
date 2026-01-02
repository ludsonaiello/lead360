import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateLicenseTypeDto } from '../dto/create-license-type.dto';
import { UpdateLicenseTypeDto } from '../dto/update-license-type.dto';

/**
 * LicenseTypeService
 *
 * Admin-only service for managing license types (platform-wide)
 * License types are shared across all tenants
 */
@Injectable()
export class LicenseTypeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all license types (including inactive if specified)
   */
  async findAll(includeInactive = false) {
    return this.prisma.licenseType.findMany({
      where: includeInactive ? {} : { is_active: true } as any,
      orderBy: { name: 'asc' } as any,
    });
  }

  /**
   * Get a specific license type by ID
   */
  async findById(licenseTypeId: string) {
    const licenseType = await this.prisma.licenseType.findUnique({
      where: { id: licenseTypeId } as any,
    });

    if (!licenseType) {
      throw new NotFoundException('License type not found');
    }

    return licenseType;
  }

  /**
   * Create a new license type (admin-only)
   */
  async create(createDto: CreateLicenseTypeDto, adminUserId: string) {
    // Check if license type name already exists
    const existing = await this.prisma.licenseType.findUnique({
      where: { name: createDto.name } as any,
    });

    if (existing) {
      throw new ConflictException(
        `License type with name '${createDto.name}' already exists`,
      );
    }

    const licenseType = await this.prisma.$transaction(async (tx) => {
      const newLicenseType = await tx.licenseType.create({
        data: createDto,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: null, // System-level action
          actor_user_id: adminUserId,
          action: 'CREATE',
          entity_type: 'LicenseType',
          entity_id: newLicenseType.id,
          metadata_json: {  created: createDto } as any,
        } as any,
      });

      return newLicenseType;
    });

    return licenseType;
  }

  /**
   * Update a license type (admin-only)
   */
  async update(licenseTypeId: string, updateDto: UpdateLicenseTypeDto, adminUserId: string) {
    // Verify license type exists
    const existing = await this.findById(licenseTypeId);

    // If changing name, check uniqueness
    if (updateDto.name && updateDto.name !== existing.name) {
      const nameConflict = await this.prisma.licenseType.findUnique({
        where: { name: updateDto.name } as any,
      });

      if (nameConflict) {
        throw new ConflictException(
          `License type with name '${updateDto.name}' already exists`,
        );
      }
    }

    const licenseType = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.licenseType.update({
        where: { id: licenseTypeId } as any,
        data: updateDto,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: null, // System-level action
          actor_user_id: adminUserId,
          action: 'UPDATE',
          entity_type: 'LicenseType',
          entity_id: licenseTypeId,
          metadata_json: { 
            old: existing,
            new: updateDto,
          } as any,
        } as any,
      });

      return updated;
    });

    return licenseType;
  }

  /**
   * Deactivate a license type (admin-only)
   * We don't delete license types because they may be in use
   */
  async deactivate(licenseTypeId: string, adminUserId: string) {
    const existing = await this.findById(licenseTypeId);

    if (!existing.is_active) {
      throw new BadRequestException('License type is already inactive');
    }

    const licenseType = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.licenseType.update({
        where: { id: licenseTypeId } as any,
        data: { is_active: false } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: null,
          actor_user_id: adminUserId,
          action: 'DEACTIVATE',
          entity_type: 'LicenseType',
          entity_id: licenseTypeId,
          metadata_json: {  is_active: { old: true, new: false } } as any,
        } as any,
      });

      return updated;
    });

    return licenseType;
  }

  /**
   * Reactivate a license type (admin-only)
   */
  async reactivate(licenseTypeId: string, adminUserId: string) {
    const existing = await this.findById(licenseTypeId);

    if (existing.is_active) {
      throw new BadRequestException('License type is already active');
    }

    const licenseType = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.licenseType.update({
        where: { id: licenseTypeId } as any,
        data: { is_active: true } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: null,
          actor_user_id: adminUserId,
          action: 'REACTIVATE',
          entity_type: 'LicenseType',
          entity_id: licenseTypeId,
          metadata_json: {  is_active: { old: false, new: true } } as any,
        } as any,
      });

      return updated;
    });

    return licenseType;
  }

  /**
   * Get usage statistics for a license type (how many tenants use it)
   */
  async getUsageStats(licenseTypeId: string) {
    const licenseType = await this.findById(licenseTypeId);

    const usageCount = await this.prisma.tenantLicense.count({
      where: { license_type_id: licenseTypeId } as any,
    });

    return {
      license_type: licenseType,
      tenants_using: usageCount,
    };
  }
}
