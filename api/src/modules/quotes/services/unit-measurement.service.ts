import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateUnitDto,
  CreateGlobalUnitDto,
  UpdateUnitDto,
  ListUnitsDto,
} from '../dto/unit-measurement';
import { randomUUID } from 'crypto';

@Injectable()
export class UnitMeasurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return randomUUID();
  }

  /**
   * Admin creates global unit (tenant_id = NULL)
   */
  async createGlobal(userId: string, dto: CreateGlobalUnitDto) {
    // Check if global unit with same name exists
    const existing = await this.prisma.unit_measurement.findFirst({
      where: {
        tenant_id: null,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException('Global unit with this name already exists');
    }

    const unitId = this.generateUUID();
    const unit = await this.prisma.unit_measurement.create({
      data: {
        id: unitId,
        tenant_id: null, // Global unit
        name: dto.name,
        abbreviation: dto.abbreviation,
        is_global: true,
      },
    });

    // Note: Platform-level audit logging skipped (global unit)

    return unit;
  }

  /**
   * Tenant creates custom unit
   */
  async createTenantUnit(tenantId: string, userId: string, dto: CreateUnitDto) {
    // Check if tenant unit with same name exists
    const existing = await this.prisma.unit_measurement.findFirst({
      where: {
        tenant_id: tenantId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException('Unit with this name already exists for your tenant');
    }

    const unitId = this.generateUUID();
    const unit = await this.prisma.unit_measurement.create({
      data: {
        id: unitId,
        tenant_id: tenantId, // Tenant-specific unit
        name: dto.name,
        abbreviation: dto.abbreviation,
        is_global: false,
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'unit_measurement',
      entityId: unit.id,
      tenantId,
      actorUserId: userId,
      after: unit,
      description: `Tenant unit created: ${unit.name}`,
    });

    return unit;
  }

  /**
   * Get all available units for tenant (global + tenant-specific)
   */
  async findAllForTenant(tenantId: string, filters: ListUnitsDto) {
    const { is_active, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { tenant_id: null }, // Global units
        { tenant_id: tenantId }, // Tenant-specific units
      ],
    };

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const [units, total] = await Promise.all([
      this.prisma.unit_measurement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ is_global: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.unit_measurement.count({ where }),
    ]);

    return {
      data: units,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin view of global units only
   */
  async findAllGlobal(filters: ListUnitsDto) {
    const { is_active, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: null, // Global units only
    };

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const [units, total] = await Promise.all([
      this.prisma.unit_measurement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.unit_measurement.count({ where }),
    ]);

    return {
      data: units,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single unit (accessible if global or belongs to tenant)
   */
  async findOne(tenantId: string | null, unitId: string) {
    const whereCondition: any = { id: unitId };

    if (tenantId) {
      // Tenant access: can see global OR tenant-specific
      whereCondition.OR = [
        { tenant_id: null },
        { tenant_id: tenantId },
      ];
    } else {
      // Admin access: global only
      whereCondition.tenant_id = null;
    }

    const unit = await this.prisma.unit_measurement.findFirst({
      where: whereCondition,
    });

    if (!unit) {
      throw new NotFoundException('Unit measurement not found');
    }

    return unit;
  }

  /**
   * Admin updates global unit
   */
  async updateGlobal(unitId: string, userId: string, dto: UpdateUnitDto) {
    // Verify unit exists and is global
    const unit = await this.prisma.unit_measurement.findFirst({
      where: { id: unitId, tenant_id: { equals: null } },
    });

    if (!unit) {
      throw new NotFoundException('Global unit not found');
    }

    // Check name uniqueness if name is being changed
    if (dto.name && dto.name !== unit.name) {
      const existing = await this.prisma.unit_measurement.findFirst({
        where: {
          tenant_id: null,
          name: dto.name,
          id: { not: unitId },
        },
      });
      if (existing) {
        throw new ConflictException('Global unit with this name already exists');
      }
    }

    const updatedUnit = await this.prisma.unit_measurement.update({
      where: { id: unitId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.abbreviation && { abbreviation: dto.abbreviation }),
      },
    });

    // Note: Platform-level audit logging skipped (global unit)

    return updatedUnit;
  }

  /**
   * Update tenant unit
   */
  async updateTenantUnit(
    tenantId: string,
    unitId: string,
    userId: string,
    dto: UpdateUnitDto,
  ) {
    // Verify unit exists and belongs to tenant (not global)
    const unit = await this.prisma.unit_measurement.findFirst({
      where: { id: unitId, tenant_id: tenantId },
    });

    if (!unit) {
      throw new NotFoundException('Unit measurement not found');
    }

    // Prevent editing global units
    if (unit.is_global) {
      throw new ForbiddenException('Cannot edit global units');
    }

    // Check name uniqueness if name is being changed
    if (dto.name && dto.name !== unit.name) {
      const existing = await this.prisma.unit_measurement.findFirst({
        where: {
          tenant_id: tenantId,
          name: dto.name,
          id: { not: unitId },
        },
      });
      if (existing) {
        throw new ConflictException('Unit with this name already exists for your tenant');
      }
    }

    const updatedUnit = await this.prisma.unit_measurement.update({
      where: { id: unitId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.abbreviation && { abbreviation: dto.abbreviation }),
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'unit_measurement',
      entityId: unitId,
      tenantId,
      actorUserId: userId,
      before: unit,
      after: updatedUnit,
      description: `Tenant unit updated: ${updatedUnit.name}`,
    });

    return updatedUnit;
  }

  /**
   * Delete unit (check if in use first)
   */
  async delete(tenantId: string, unitId: string, userId: string) {
    // Verify unit exists and belongs to tenant
    const unit = await this.prisma.unit_measurement.findFirst({
      where: { id: unitId, tenant_id: tenantId },
    });

    if (!unit) {
      throw new NotFoundException('Unit measurement not found');
    }

    // Prevent deleting global units (should use admin endpoint)
    if (unit.is_global) {
      throw new ForbiddenException('Cannot delete global units via tenant endpoint');
    }

    // Check usage in quote_item
    const itemUsageCount = await this.prisma.quote_item.count({
      where: { unit_measurement_id: unitId },
    });

    // Check usage in item_library
    const libraryUsageCount = await this.prisma.item_library.count({
      where: { unit_measurement_id: unitId },
    });

    // Check usage in quote_bundle_item
    const bundleItemUsageCount = await this.prisma.quote_bundle_item.count({
      where: { unit_measurement_id: unitId },
    });

    const totalUsage = itemUsageCount + libraryUsageCount + bundleItemUsageCount;

    if (totalUsage > 0) {
      throw new BadRequestException(
        `Cannot delete unit. It is used in ${totalUsage} record(s)`,
      );
    }

    // Delete unit
    await this.prisma.unit_measurement.delete({
      where: { id: unitId },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'unit_measurement',
      entityId: unitId,
      tenantId,
      actorUserId: userId,
      before: unit,
      description: `Tenant unit deleted: ${unit.name}`,
    });

    return { message: 'Unit measurement deleted successfully' };
  }

  /**
   * Get usage statistics for a unit
   */
  async getUsageStatistics(tenantId: string, unitId: string) {
    // Verify unit exists and is accessible
    await this.findOne(tenantId, unitId);

    const [itemCount, libraryCount, bundleItemCount] = await Promise.all([
      this.prisma.quote_item.count({
        where: { unit_measurement_id: unitId, quote: { tenant_id: tenantId } },
      }),
      this.prisma.item_library.count({
        where: { unit_measurement_id: unitId, tenant_id: tenantId },
      }),
      this.prisma.quote_bundle_item.count({
        where: {
          unit_measurement_id: unitId,
          quote_bundle: { tenant_id: tenantId },
        },
      }),
    ]);

    return {
      unit_id: unitId,
      usage: {
        quote_items: itemCount,
        item_library: libraryCount,
        bundle_items: bundleItemCount,
        total: itemCount + libraryCount + bundleItemCount,
      },
    };
  }

  /**
   * Seed default global units (idempotent)
   */
  async seedDefaultUnits(userId: string) {
    const defaultUnits = [
      { name: 'Each', abbreviation: 'ea' },
      { name: 'Square Foot', abbreviation: 'sq ft' },
      { name: 'Linear Foot', abbreviation: 'lin ft' },
      { name: 'Hour', abbreviation: 'hr' },
      { name: 'Cubic Yard', abbreviation: 'cu yd' },
      { name: 'Ton', abbreviation: 'ton' },
      { name: 'Gallon', abbreviation: 'gal' },
      { name: 'Pound', abbreviation: 'lb' },
      { name: 'Box', abbreviation: 'box' },
      { name: 'Bundle', abbreviation: 'bundle' },
    ];

    const createdUnits: string[] = [];
    const skippedUnits: string[] = [];

    for (const unitData of defaultUnits) {
      // Check if already exists
      const existing = await this.prisma.unit_measurement.findFirst({
        where: {
          tenant_id: null,
          name: unitData.name,
        },
      });

      if (existing) {
        skippedUnits.push(unitData.name);
        continue;
      }

      // Create unit
      const unitId = this.generateUUID();
      const unit = await this.prisma.unit_measurement.create({
        data: {
          id: unitId,
          tenant_id: null,
          name: unitData.name,
          abbreviation: unitData.abbreviation,
          is_global: true,
        },
      });

      createdUnits.push(unit.name);
      // Note: Platform-level audit logging skipped for seeded units
    }

    return {
      message: 'Default units seeded successfully',
      created: createdUnits.length,
      skipped: skippedUnits.length,
      created_units: createdUnits,
      skipped_units: skippedUnits,
    };
  }
}
