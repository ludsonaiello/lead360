import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LeadActivitiesService, ActivityType } from './lead-activities.service';
import {
  CreateServiceRequestDto,
  UpdateServiceRequestDto,
} from '../dto/lead.dto';

@Injectable()
export class ServiceRequestsService {
  private readonly logger = new Logger(ServiceRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: LeadActivitiesService,
  ) {}

  async create(
    tenantId: string,
    leadId: string,
    addressId: string,
    userId: string,
    serviceRequestData: CreateServiceRequestDto,
  ): Promise<any> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenant_id: tenantId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    const address = await this.prisma.lead_address.findFirst({
      where: { id: addressId, lead_id: leadId },
    });

    if (!address) {
      throw new NotFoundException(`Address with ID ${addressId} not found`);
    }

    const serviceRequestId = this.generateUUID();
    const serviceRequest = await this.prisma.service_request.create({
      data: {
        id: serviceRequestId,
        tenant_id: tenantId,
        lead_id: leadId,
        lead_address_id: addressId,
        service_name: serviceRequestData.service_name,
        service_type: serviceRequestData.service_type || null,
        description: serviceRequestData.service_description,
        time_demand: serviceRequestData.urgency || 'flexible',
        status: 'new',
        extra_data: {
          requested_date: serviceRequestData.requested_date,
          estimated_value: serviceRequestData.estimated_value,
          notes: serviceRequestData.notes,
        },
      },
      include: {
        lead: { select: { id: true, first_name: true, last_name: true } },
        lead_address: { select: { address_line1: true, city: true, state: true, zip_code: true } },
      },
    });

    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.SERVICE_REQUEST_CREATED,
      description: `Service request created: ${serviceRequest.service_name}`,
      user_id: userId,
      metadata: { service_request_id: serviceRequest.id },
    });

    return serviceRequest;
  }

  async createForNewLead(
    tenantId: string,
    leadId: string,
    addressId: string,
    serviceRequestData: CreateServiceRequestDto,
    prismaClient?: any,
  ): Promise<any> {
    // Use transaction client if provided, otherwise use default prisma
    const client = prismaClient || this.prisma;

    const serviceRequestId = this.generateUUID();
    return client.service_request.create({
      data: {
        id: serviceRequestId,
        tenant_id: tenantId,
        lead_id: leadId,
        lead_address_id: addressId,
        service_name: serviceRequestData.service_name,
        service_type: serviceRequestData.service_type || null,
        description: serviceRequestData.service_description,
        time_demand: serviceRequestData.urgency || 'flexible',
        status: 'new',
        extra_data: { requested_date: serviceRequestData.requested_date, estimated_value: serviceRequestData.estimated_value, notes: serviceRequestData.notes },
      },
    });
  }

  async update(
    tenantId: string,
    serviceRequestId: string,
    userId: string,
    updateData: UpdateServiceRequestDto,
  ): Promise<any> {
    const serviceRequest = await this.prisma.service_request.findFirst({
      where: { id: serviceRequestId, tenant_id: tenantId },
      include: { lead: true },
    });

    if (!serviceRequest) {
      throw new NotFoundException(`Service request with ID ${serviceRequestId} not found`);
    }

    const updatedServiceRequest = await this.prisma.service_request.update({
      where: { id: serviceRequestId },
      data: {
        service_name: updateData.service_name,
        service_type: updateData.service_type,
        description: updateData.service_description,
        time_demand: updateData.urgency,
        status: updateData.status,
      },
      include: {
        lead: { select: { id: true, first_name: true, last_name: true } },
        lead_address: { select: { address_line1: true, city: true, state: true, zip_code: true } },
      },
    });

    await this.activitiesService.logActivity(tenantId, {
      lead_id: serviceRequest.lead_id,
      activity_type: ActivityType.SERVICE_REQUEST_UPDATED,
      description: `Service request updated: ${updatedServiceRequest.service_name}`,
      user_id: userId,
      metadata: { service_request_id: updatedServiceRequest.id },
    });

    return updatedServiceRequest;
  }

  async findAllByLead(tenantId: string, leadId: string): Promise<any[]> {
    return this.prisma.service_request.findMany({
      where: { lead_id: leadId, tenant_id: tenantId },
      include: {
        lead_address: { select: { address_line1: true, address_line2: true, city: true, state: true, zip_code: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findAll(
    tenantId: string,
    filters?: { status?: string; urgency?: string; service_type?: string },
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: any[]; meta: any }> {
    const skip = (page - 1) * limit;
    const where: any = { tenant_id: tenantId };

    if (filters?.status) where.status = filters.status;
    if (filters?.service_type) where.service_type = { contains: filters.service_type };

    const [serviceRequests, total] = await Promise.all([
      this.prisma.service_request.findMany({
        where,
        include: {
          lead: { select: { id: true, first_name: true, last_name: true, status: true } },
          lead_address: { select: { address_line1: true, city: true, state: true, zip_code: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.service_request.count({ where }),
    ]);

    return {
      data: serviceRequests,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, serviceRequestId: string): Promise<any | null> {
    return this.prisma.service_request.findFirst({
      where: { id: serviceRequestId, tenant_id: tenantId },
      include: {
        lead: { select: { id: true, first_name: true, last_name: true, status: true } },
        lead_address: { select: { address_line1: true, address_line2: true, city: true, state: true, zip_code: true, latitude: true, longitude: true } },
      },
    });
  }

  async delete(
    tenantId: string,
    serviceRequestId: string,
    userId: string,
  ): Promise<void> {
    const serviceRequest = await this.prisma.service_request.findFirst({
      where: { id: serviceRequestId, tenant_id: tenantId },
    });

    if (!serviceRequest) {
      throw new NotFoundException(`Service request with ID ${serviceRequestId} not found`);
    }

    await this.prisma.service_request.delete({
      where: { id: serviceRequestId },
    });

    await this.activitiesService.logActivity(tenantId, {
      lead_id: serviceRequest.lead_id,
      activity_type: ActivityType.SERVICE_REQUEST_UPDATED,
      description: `Service request deleted: ${serviceRequest.service_name}`,
      user_id: userId,
      metadata: { service_request_id: serviceRequestId, deleted: true },
    });
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
