import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { GoogleMapsService } from '../../leads/services/google-maps.service';
import {
  CreateClockinAddressDto,
  UpdateClockinAddressDto,
  ListClockinAddressesDto,
  ImportAddressFromQuoteDto,
  ImportAddressFromLeadDto,
} from '../dto/clockin-address.dto';

@Injectable()
export class ClockinAddressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  async list(tenantId: string, dto: ListClockinAddressesDto) {
    const { page = 1, limit = 20, project_id, is_active, search } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.clockin_addressWhereInput = { tenant_id: tenantId };

    if (typeof is_active === 'boolean') {
      where.is_active = is_active;
    }

    if (project_id) {
      where.project_id = project_id;
    }

    if (search) {
      where.label = { contains: search };
    }

    const [data, total] = await Promise.all([
      this.prisma.clockin_address.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.clockin_address.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(tenantId: string, userId: string, dto: CreateClockinAddressDto) {
    if (dto.project_id) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.project_id, tenant_id: tenantId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
    }

    const validated = await this.googleMapsService.validateAddress({
      address_line1: dto.address_line1,
      address_line2: dto.address_line2,
      city: dto.city,
      state: dto.state,
      zip_code: dto.zip_code,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    const address = await this.prisma.clockin_address.create({
      data: {
        tenant_id: tenantId,
        label: dto.label,
        address_line1: validated.address_line1,
        address_line2: dto.address_line2 ?? null,
        city: validated.city,
        state: validated.state,
        zip_code: validated.zip_code,
        latitude: new Prisma.Decimal(validated.latitude),
        longitude: new Prisma.Decimal(validated.longitude),
        radius_meters: dto.radius_meters ?? 100,
        source: 'manual',
        project_id: dto.project_id ?? null,
        created_by_user_id: userId,
      },
      include: { project: { select: { id: true, name: true } } },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'clockin_address',
      entityId: address.id,
      tenantId,
      actorUserId: userId,
      after: address,
      description: `Created clock-in address: ${address.label}`,
    });

    return address;
  }

  async findOne(tenantId: string, id: string) {
    const address = await this.prisma.clockin_address.findFirst({
      where: { id, tenant_id: tenantId },
      include: { project: { select: { id: true, name: true } } },
    });

    if (!address) {
      throw new NotFoundException('Clock-in address not found');
    }

    return address;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateClockinAddressDto,
  ) {
    const existing = await this.prisma.clockin_address.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Clock-in address not found');
    }

    if (dto.project_id !== undefined && dto.project_id !== null) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.project_id, tenant_id: tenantId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
    }

    const addressFieldsChanged =
      (dto.address_line1 !== undefined &&
        dto.address_line1 !== existing.address_line1) ||
      (dto.city !== undefined && dto.city !== existing.city) ||
      (dto.state !== undefined && dto.state !== existing.state) ||
      (dto.zip_code !== undefined && dto.zip_code !== existing.zip_code);

    const geocodeData: Prisma.clockin_addressUpdateInput = {};

    if (addressFieldsChanged) {
      const validated = await this.googleMapsService.validateAddress({
        address_line1: dto.address_line1 ?? existing.address_line1,
        address_line2: dto.address_line2 ?? existing.address_line2 ?? undefined,
        city: dto.city ?? existing.city,
        state: dto.state ?? existing.state,
        zip_code: dto.zip_code ?? existing.zip_code,
      });

      geocodeData.address_line1 = validated.address_line1;
      geocodeData.city = validated.city;
      geocodeData.state = validated.state;
      geocodeData.zip_code = validated.zip_code;
      geocodeData.latitude = new Prisma.Decimal(validated.latitude);
      geocodeData.longitude = new Prisma.Decimal(validated.longitude);
    }

    const updateData: Prisma.clockin_addressUpdateInput = {};

    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.address_line2 !== undefined)
      updateData.address_line2 = dto.address_line2;
    if (dto.radius_meters !== undefined)
      updateData.radius_meters = dto.radius_meters;
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
    if (dto.project_id !== undefined) {
      updateData.project =
        dto.project_id === null
          ? { disconnect: true }
          : { connect: { id: dto.project_id } };
    }

    const updated = await this.prisma.clockin_address.update({
      where: { id },
      data: { ...updateData, ...geocodeData },
      include: { project: { select: { id: true, name: true } } },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'clockin_address',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated clock-in address: ${updated.label}`,
    });

    return updated;
  }

  async softDelete(tenantId: string, userId: string, id: string) {
    const existing = await this.prisma.clockin_address.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Clock-in address not found');
    }

    await this.prisma.clockin_address.update({
      where: { id },
      data: { is_active: false },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'clockin_address',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: { ...existing, is_active: false },
      description: `Deactivated clock-in address: ${existing.label}`,
    });

    return { message: 'Address deactivated successfully' };
  }

  async importFromQuote(
    tenantId: string,
    userId: string,
    dto: ImportAddressFromQuoteDto,
  ) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: dto.quote_id, tenant_id: tenantId },
      include: { jobsite_address: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    if (!quote.jobsite_address) {
      throw new BadRequestException('Quote does not have a jobsite address');
    }

    if (dto.project_id) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.project_id, tenant_id: tenantId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
    }

    const jobsite = quote.jobsite_address;

    const address = await this.prisma.clockin_address.create({
      data: {
        tenant_id: tenantId,
        label: dto.label,
        address_line1: jobsite.address_line1,
        address_line2: jobsite.address_line2 ?? null,
        city: jobsite.city,
        state: jobsite.state,
        zip_code: jobsite.zip_code,
        latitude: jobsite.latitude,
        longitude: jobsite.longitude,
        radius_meters: dto.radius_meters ?? 100,
        source: 'imported_from_quote',
        source_address_id: jobsite.id,
        project_id: dto.project_id ?? null,
        created_by_user_id: userId,
      },
      include: { project: { select: { id: true, name: true } } },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'clockin_address',
      entityId: address.id,
      tenantId,
      actorUserId: userId,
      after: address,
      description: `Imported clock-in address from quote: ${address.label}`,
    });

    return address;
  }

  async importFromLead(
    tenantId: string,
    userId: string,
    dto: ImportAddressFromLeadDto,
  ) {
    const leadAddress = await this.prisma.lead_address.findFirst({
      where: { id: dto.lead_address_id },
      include: { lead: true },
    });

    if (!leadAddress || leadAddress.lead.tenant_id !== tenantId) {
      throw new NotFoundException('Lead address not found');
    }

    if (dto.project_id) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.project_id, tenant_id: tenantId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
    }

    const address = await this.prisma.clockin_address.create({
      data: {
        tenant_id: tenantId,
        label: dto.label,
        address_line1: leadAddress.address_line1,
        address_line2: leadAddress.address_line2 ?? null,
        city: leadAddress.city,
        state: leadAddress.state,
        zip_code: leadAddress.zip_code,
        latitude: leadAddress.latitude,
        longitude: leadAddress.longitude,
        radius_meters: dto.radius_meters ?? 100,
        source: 'imported_from_lead',
        source_address_id: leadAddress.id,
        project_id: dto.project_id ?? null,
        created_by_user_id: userId,
      },
      include: { project: { select: { id: true, name: true } } },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'clockin_address',
      entityId: address.id,
      tenantId,
      actorUserId: userId,
      after: address,
      description: `Imported clock-in address from lead: ${address.label}`,
    });

    return address;
  }
}
