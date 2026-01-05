import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateServiceDto } from '../dto/create-service.dto';
import { UpdateServiceDto } from '../dto/update-service.dto';
import { AssignServicesDto } from '../dto/assign-services.dto';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all services (admin endpoint - platform-wide)
   */
  async findAll(includeInactive = false) {
    return this.prisma.service.findMany({
      where: includeInactive ? {} : { is_active: true } as any,
      orderBy: { name: 'asc' } as any,
    });
  }

  /**
   * Get a specific service by ID
   */
  async findOne(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId } as any,
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  /**
   * Create a new service (admin only)
   */
  async create(createDto: CreateServiceDto) {
    // Generate slug if not provided
    const slug = createDto.slug || this.generateSlug(createDto.name);

    // Check for duplicate name
    const existingByName = await this.prisma.service.findUnique({
      where: { name: createDto.name } as any,
    });

    if (existingByName) {
      throw new ConflictException(`Service with name "${createDto.name}" already exists`);
    }

    // Check for duplicate slug
    const existingBySlug = await this.prisma.service.findUnique({
      where: { slug } as any,
    });

    if (existingBySlug) {
      throw new ConflictException(`Service with slug "${slug}" already exists`);
    }

    const service = await this.prisma.service.create({
      data: {
        name: createDto.name,
        slug,
        description: createDto.description,
      } as any,
    });

    return service;
  }

  /**
   * Update a service (admin only)
   */
  async update(serviceId: string, updateDto: UpdateServiceDto) {
    // Verify service exists
    await this.findOne(serviceId);

    // If name is being updated, check for duplicates
    if (updateDto.name) {
      const existing = await this.prisma.service.findFirst({
        where: {
          name: updateDto.name,
          id: { not: serviceId },
        } as any,
      });

      if (existing) {
        throw new ConflictException(`Service with name "${updateDto.name}" already exists`);
      }
    }

    // If slug is being updated, check for duplicates
    if (updateDto.slug) {
      const existing = await this.prisma.service.findFirst({
        where: {
          slug: updateDto.slug,
          id: { not: serviceId },
        } as any,
      });

      if (existing) {
        throw new ConflictException(`Service with slug "${updateDto.slug}" already exists`);
      }
    }

    const service = await this.prisma.service.update({
      where: { id: serviceId } as any,
      data: {
        name: updateDto.name,
        slug: updateDto.slug,
        description: updateDto.description,
        is_active: updateDto.is_active,
      } as any,
    });

    return service;
  }

  /**
   * Delete a service (admin only)
   */
  async delete(serviceId: string) {
    // Verify service exists
    await this.findOne(serviceId);

    // Check if service is assigned to any tenants
    const assignedCount = await this.prisma.tenantService.count({
      where: { service_id: serviceId } as any,
    });

    if (assignedCount > 0) {
      throw new BadRequestException(
        `Cannot delete service. It is currently assigned to ${assignedCount} tenant(s). Please deactivate instead.`,
      );
    }

    await this.prisma.service.delete({
      where: { id: serviceId } as any,
    });

    return { message: 'Service deleted successfully' };
  }

  /**
   * Get tenant's assigned services
   */
  async getTenantServices(tenantId: string) {
    const tenantServices = await this.prisma.tenantService.findMany({
      where: { tenant_id: tenantId } as any,
      include: {
        service: true,
      } as any,
    });

    return tenantServices.map((ts) => ts.service);
  }

  /**
   * Assign services to tenant (replaces all existing assignments)
   */
  async assignServices(tenantId: string, assignDto: AssignServicesDto, userId: string) {
    // Validate all service IDs exist and are active
    const services = await this.prisma.service.findMany({
      where: {
        id: { in: assignDto.service_ids },
        is_active: true,
      } as any,
    });

    if (services.length !== assignDto.service_ids.length) {
      const foundIds = services.map((s) => s.id);
      const missingIds = assignDto.service_ids.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Some service IDs are invalid or inactive: ${missingIds.join(', ')}`,
      );
    }

    // Use transaction to replace all assignments
    await this.prisma.$transaction(async (tx) => {
      // Delete existing assignments
      await tx.tenantService.deleteMany({
        where: { tenant_id: tenantId } as any,
      });

      // Create new assignments
      if (assignDto.service_ids.length > 0) {
        await tx.tenantService.createMany({
          data: assignDto.service_ids.map((service_id) => ({
            tenant_id: tenantId,
            service_id,
          })) as any,
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'UPDATE',
          entity_type: 'TenantService',
          entity_id: tenantId,
          metadata_json: {
            service_ids: assignDto.service_ids,
          } as any,
        } as any,
      });
    });

    // Return updated services
    return this.getTenantServices(tenantId);
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim();
  }
}
