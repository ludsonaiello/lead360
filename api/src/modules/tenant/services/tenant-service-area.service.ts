import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateServiceAreaDto, ServiceAreaType } from '../dto/create-service-area.dto';
import { UpdateServiceAreaDto } from '../dto/update-service-area.dto';

@Injectable()
export class TenantServiceAreaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all service areas for a tenant
   */
  async findAll(tenantId: string) {
    return this.prisma.tenantServiceArea.findMany({
      where: { tenant_id: tenantId } as any,
      orderBy: { area_type: 'asc' } as any,
    });
  }

  /**
   * Get a specific service area by ID
   */
  async findOne(tenantId: string, serviceAreaId: string) {
    const serviceArea = await this.prisma.tenantServiceArea.findFirst({
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
    }
  }

  /**
   * Create a new service area
   */
  async create(tenantId: string, createDto: CreateServiceAreaDto, userId: string) {
    // Validate based on area type
    this.validateServiceAreaDto(createDto);

    const serviceArea = await this.prisma.$transaction(async (tx) => {
      const newServiceArea = await tx.tenantServiceArea.create({
        data: {
          tenant_id: tenantId,
          ...createDto,
        } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'CREATE',
          entity_type: 'TenantServiceArea',
          entity_id: newServiceArea.id,
          metadata_json: {  created: createDto } as any,
        } as any,
      });

      return newServiceArea;
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

    const serviceArea = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantServiceArea.update({
        where: { id: serviceAreaId } as any,
        data: updateDto,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'UPDATE',
          entity_type: 'TenantServiceArea',
          entity_id: serviceAreaId,
          metadata_json: { 
            old: existing,
            new: updateDto,
          } as any,
        } as any,
      });

      return updated;
    });

    return serviceArea;
  }

  /**
   * Delete a service area
   */
  async delete(tenantId: string, serviceAreaId: string, userId: string) {
    // Verify service area exists and belongs to tenant
    const existing = await this.findOne(tenantId, serviceAreaId);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantServiceArea.delete({
        where: { id: serviceAreaId } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'DELETE',
          entity_type: 'TenantServiceArea',
          entity_id: serviceAreaId,
          metadata_json: {  deleted: existing } as any,
        } as any,
      });
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
