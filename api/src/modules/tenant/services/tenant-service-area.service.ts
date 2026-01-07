import { randomBytes } from 'crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateServiceAreaDto, ServiceAreaType } from '../dto/create-service-area.dto';
import { UpdateServiceAreaDto } from '../dto/update-service-area.dto';

@Injectable()
export class TenantServiceAreaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Get all service areas for a tenant
   */
  async findAll(tenantId: string) {
    return this.prisma.tenant_service_area.findMany({
      where: { tenant_id: tenantId } as any,
      orderBy: { type: 'asc' } as any,
    });
  }

  /**
   * Get a specific service area by ID
   */
  async findOne(tenantId: string, serviceAreaId: string) {
    const serviceArea = await this.prisma.tenant_service_area.findFirst({
      where: {
        id: serviceAreaId,
        tenant_id: tenantId, // CRITICAL: Tenant isolation
      } as any,
    });

    if (!serviceArea) {
      throw new NotFoundException('Service area not found');
    }

    return serviceArea;
  }

  /**
   * Check for duplicate service areas based on type
   */
  private async checkDuplicateServiceArea(
    tenantId: string,
    dto: CreateServiceAreaDto | UpdateServiceAreaDto,
    excludeId?: string,
  ): Promise<void> {
    let existing;

    if (dto.area_type === ServiceAreaType.CITY) {
      // Check for duplicate city + state combination
      existing = await this.prisma.tenant_service_area.findFirst({
        where: {
          tenant_id: tenantId,
          type: ServiceAreaType.CITY,
          city_name: dto.city,
          state: dto.state,
          ...(excludeId && { id: { not: excludeId } }),
        } as any,
      });
      if (existing) {
        throw new ConflictException(
          `Service area already exists for city "${dto.city}, ${dto.state}"`,
        );
      }
    } else if (dto.area_type === ServiceAreaType.ZIPCODE) {
      // Check for duplicate zipcode
      existing = await this.prisma.tenant_service_area.findFirst({
        where: {
          tenant_id: tenantId,
          type: ServiceAreaType.ZIPCODE,
          zipcode: dto.zipcode,
          ...(excludeId && { id: { not: excludeId } }),
        } as any,
      });
      if (existing) {
        throw new ConflictException(
          `Service area already exists for ZIP code "${dto.zipcode}"`,
        );
      }
    } else if (dto.area_type === ServiceAreaType.STATE) {
      // Check for duplicate state
      existing = await this.prisma.tenant_service_area.findFirst({
        where: {
          tenant_id: tenantId,
          type: ServiceAreaType.STATE,
          state: dto.state,
          entire_state: true,
          ...(excludeId && { id: { not: excludeId } }),
        } as any,
      });
      if (existing) {
        throw new ConflictException(
          `Service area already exists for entire state "${dto.state}"`,
        );
      }
    } else if (dto.area_type === ServiceAreaType.RADIUS) {
      // Check for duplicate radius with same center and radius
      existing = await this.prisma.tenant_service_area.findFirst({
        where: {
          tenant_id: tenantId,
          type: ServiceAreaType.RADIUS,
          latitude: dto.center_lat,
          longitude: dto.center_long,
          radius_miles: dto.radius_miles,
          ...(excludeId && { id: { not: excludeId } }),
        } as any,
      });
      if (existing) {
        throw new ConflictException(
          `Service area already exists for this location and radius`,
        );
      }
    }
  }

  /**
   * Validate service area DTO based on type
   */
  private validateServiceAreaDto(dto: CreateServiceAreaDto | UpdateServiceAreaDto): void {
    if (dto.area_type === ServiceAreaType.CITY) {
      if (!dto.city || !dto.state) {
        throw new BadRequestException(
          'City and state are required for city-based service areas',
        );
      }
    } else if (dto.area_type === ServiceAreaType.ZIPCODE) {
      if (!dto.zipcode) {
        throw new BadRequestException(
          'Zipcode is required for zipcode-based service areas',
        );
      }
    } else if (dto.area_type === ServiceAreaType.RADIUS) {
      if (
        dto.center_lat === undefined ||
        dto.center_long === undefined ||
        dto.radius_miles === undefined
      ) {
        throw new BadRequestException(
          'Center coordinates (lat, long) and radius are required for radius-based service areas',
        );
      }
    } else if (dto.area_type === ServiceAreaType.STATE) {
      if (!dto.state) {
        throw new BadRequestException(
          'State is required for state-based service areas',
        );
      }
    }
  }

  /**
   * Create a new service area
   */
  async create(tenantId: string, createDto: CreateServiceAreaDto, userId: string) {
    // Validate based on area type
    this.validateServiceAreaDto(createDto);

    // Check for duplicates based on type
    await this.checkDuplicateServiceArea(tenantId, createDto);

    // Determine value based on type
    let value: string;
    let entire_state = false;

    if (createDto.area_type === ServiceAreaType.CITY) {
      value = createDto.city || '';
    } else if (createDto.area_type === ServiceAreaType.ZIPCODE) {
      value = createDto.zipcode || '';
    } else if (createDto.area_type === ServiceAreaType.STATE) {
      // State type - entire state
      value = createDto.state || '';
      entire_state = true;
    } else {
      // Radius type - full description
      value = `${createDto.city || 'Area'}, ${createDto.state || ''} (${createDto.radius_miles} mile radius)`;
    }

    const serviceArea = await this.prisma.tenant_service_area.create({
      data: {
        id: randomBytes(16).toString('hex'),
        tenant_id: tenantId,
        type: createDto.area_type,
        value: value,
        latitude: createDto.center_lat || 0,
        longitude: createDto.center_long || 0,
        radius_miles: createDto.radius_miles,
        state: createDto.state,
        city_name: createDto.city,
        zipcode: createDto.zipcode,
        entire_state: entire_state,
      } as any,
    });

    // Audit log (after successful creation)
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'TenantServiceArea',
      entityId: serviceArea.id,
      tenantId: tenantId,
      actorUserId: userId,
      metadata: { created: createDto },
      description: 'Created service area',
    });

    return serviceArea;
  }

  /**
   * Update a service area
   */
  async update(
    tenantId: string,
    serviceAreaId: string,
    updateDto: UpdateServiceAreaDto,
    userId: string,
  ) {
    // Verify service area exists and belongs to tenant
    const existing = await this.findOne(tenantId, serviceAreaId);

    // If area_type is being changed, validate new requirements
    const updatedType = updateDto.area_type || (existing.type as ServiceAreaType);
    if (updateDto.area_type) {
      this.validateServiceAreaDto({ ...updateDto, area_type: updatedType });
    }

    // Check for duplicates (excluding current record)
    if (updateDto.area_type || updateDto.city || updateDto.zipcode || updateDto.state || updateDto.center_lat || updateDto.center_long || updateDto.radius_miles) {
      const mergedDto = {
        area_type: updatedType,
        city: updateDto.city !== undefined ? updateDto.city : existing.city_name || undefined,
        zipcode: updateDto.zipcode !== undefined ? updateDto.zipcode : existing.zipcode || undefined,
        state: updateDto.state !== undefined ? updateDto.state : existing.state || undefined,
        center_lat: updateDto.center_lat !== undefined ? updateDto.center_lat : Number(existing.latitude),
        center_long: updateDto.center_long !== undefined ? updateDto.center_long : Number(existing.longitude),
        radius_miles: updateDto.radius_miles !== undefined ? updateDto.radius_miles : (existing.radius_miles ? Number(existing.radius_miles) : undefined),
      };
      await this.checkDuplicateServiceArea(tenantId, mergedDto, serviceAreaId);
    }

    // Determine value based on type (use updated values or existing)
    let value: string | undefined;
    let entire_state: boolean | undefined;

    if (updateDto.area_type || updateDto.city || updateDto.zipcode || updateDto.radius_miles || updateDto.state) {
      const finalType = updateDto.area_type || (existing.type as ServiceAreaType);
      const finalCity = updateDto.city !== undefined ? updateDto.city : existing.city_name;
      const finalZipcode = updateDto.zipcode !== undefined ? updateDto.zipcode : existing.zipcode;
      const finalRadiusMiles = updateDto.radius_miles !== undefined ? updateDto.radius_miles : existing.radius_miles;
      const finalState = updateDto.state !== undefined ? updateDto.state : existing.state;

      if (finalType === ServiceAreaType.CITY) {
        value = finalCity || '';
        entire_state = false;
      } else if (finalType === ServiceAreaType.ZIPCODE) {
        value = finalZipcode || '';
        entire_state = false;
      } else if (finalType === ServiceAreaType.STATE) {
        value = finalState || '';
        entire_state = true;
      } else {
        // Radius type - full description
        value = `${finalCity || 'Area'}, ${finalState || ''} (${finalRadiusMiles} mile radius)`;
        entire_state = false;
      }
    }

    const serviceArea = await this.prisma.tenant_service_area.update({
      where: { id: serviceAreaId } as any,
      data: {
        type: updateDto.area_type,
        value: value,
        latitude: updateDto.center_lat,
        longitude: updateDto.center_long,
        radius_miles: updateDto.radius_miles,
        state: updateDto.state,
        city_name: updateDto.city,
        zipcode: updateDto.zipcode,
        entire_state: entire_state,
      } as any,
    });

    // Audit log (after successful update)
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'TenantServiceArea',
      entityId: serviceAreaId,
      tenantId: tenantId,
      actorUserId: userId,
      before: existing,
      after: updateDto,
      description: 'Updated service area',
    });

    return serviceArea;
  }

  /**
   * Delete a service area
   */
  async delete(tenantId: string, serviceAreaId: string, userId: string) {
    // Verify service area exists and belongs to tenant
    const existing = await this.findOne(tenantId, serviceAreaId);

    await this.prisma.tenant_service_area.delete({
      where: { id: serviceAreaId } as any,
    });

    // Audit log (after successful deletion)
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'TenantServiceArea',
      entityId: serviceAreaId,
      tenantId: tenantId,
      actorUserId: userId,
      before: existing,
      description: 'Deleted service area',
    });

    return { message: 'Service area deleted successfully' };
  }

  /**
   * Check if a location (lat, long) is covered by tenant's service areas
   */
  async checkCoverage(tenantId: string, lat: number, long: number): Promise<{
    is_covered: boolean;
    covering_areas: any[];
  }> {
    const serviceAreas = await this.findAll(tenantId);
    const coveringAreas: any[] = [];

    for (const area of serviceAreas) {
      if (area.type === ServiceAreaType.RADIUS) {
        // Calculate distance using Haversine formula
        const distance = this.calculateDistance(
          lat,
          long,
          Number(area.latitude),
          Number(area.longitude),
        );

        if (distance <= Number(area.radius_miles)) {
          coveringAreas.push({
            ...area,
            distance_miles: Math.round(distance * 10) / 10,
          });
        }
      }
      // For city and zipcode types, external geocoding service would be needed
      // to convert lat/long to city/zip and check. Skipping for now.
    }

    return {
      is_covered: coveringAreas.length > 0,
      covering_areas: coveringAreas,
    };
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 3959; // Earth radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
