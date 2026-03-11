import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { LeadActivitiesService, ActivityType } from './lead-activities.service';
import { LeadEmailsService } from './lead-emails.service';
import { LeadPhonesService } from './lead-phones.service';
import { LeadAddressesService } from './lead-addresses.service';
import { ServiceRequestsService } from './service-requests.service';
import {
  CreateEmailDto,
  CreatePhoneDto,
  CreateAddressDto,
  CreateServiceRequestDto,
} from '../dto/lead.dto';

export interface CreateLeadDto {
  first_name: string;
  last_name: string;
  language_spoken?: string;
  accept_sms?: boolean;
  preferred_communication?: string; // 'email', 'phone', 'sms'
  source: string; // 'website', 'referral', 'phone_call', 'walk_in', 'webhook', etc.
  external_source_id?: string;
  emails: CreateEmailDto[];
  phones: CreatePhoneDto[];
  addresses: CreateAddressDto[];
  service_request?: CreateServiceRequestDto;
}

export interface UpdateLeadDto {
  first_name?: string;
  last_name?: string;
  language_spoken?: string;
  accept_sms?: boolean;
  preferred_communication?: string;
}

export interface UpdateStatusDto {
  status: string; // 'lead', 'prospect', 'customer', 'lost'
  lost_reason?: string;
}

export interface ListLeadsDto {
  page?: number;
  limit?: number;
  status?: string[]; // Array for multiple status filters
  source?: string[]; // Array for multiple source filters
  search?: string; // Search by name, email, phone, city, state
  created_after?: string; // Filter by created_at >= this date
  created_before?: string; // Filter by created_at <= this date
  sort_by?: string; // Sort field
  sort_order?: 'asc' | 'desc'; // Sort order
  email?: string; // Filter by exact email address
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly activitiesService: LeadActivitiesService,
    private readonly emailsService: LeadEmailsService,
    private readonly phonesService: LeadPhonesService,
    private readonly addressesService: LeadAddressesService,
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  /**
   * Create a new lead with nested entities (emails, phones, addresses, service request)
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - User creating the lead
   * @param createLeadDto - Lead creation data
   * @returns Created lead with all relations
   */
  async create(
    tenantId: string,
    userId: string | null,
    createLeadDto: CreateLeadDto,
  ): Promise<any> {
    // Validate: At least 1 email OR 1 phone required
    if (
      (!createLeadDto.emails || createLeadDto.emails.length === 0) &&
      (!createLeadDto.phones || createLeadDto.phones.length === 0)
    ) {
      throw new BadRequestException(
        'Lead must have at least one email or phone number',
      );
    }

    // Validate: At least 1 address required
    if (!createLeadDto.addresses || createLeadDto.addresses.length === 0) {
      throw new BadRequestException('Lead must have at least one address');
    }

    // CRITICAL: Check phone uniqueness (tenant-scoped) for all phones
    if (createLeadDto.phones && createLeadDto.phones.length > 0) {
      for (const phoneData of createLeadDto.phones) {
        const sanitizedPhone = phoneData.phone.replace(/\D/g, '');
        const phoneExists = await this.phonesService.checkPhoneUniqueness(
          tenantId,
          sanitizedPhone,
        );
        if (phoneExists) {
          throw new ConflictException(
            `Phone number ${phoneData.phone} is already assigned to another lead in this account.`,
          );
        }
      }
    }

    // Generate lead ID
    const leadId = this.generateUUID();

    // Transaction: Create lead with all nested entities
    try {
      const lead = await this.prisma.$transaction(async (tx) => {
        // 1. Create lead
        const newLead = await tx.lead.create({
          data: {
            id: leadId,
            tenant_id: tenantId,
            first_name: createLeadDto.first_name,
            last_name: createLeadDto.last_name,
            language_spoken: createLeadDto.language_spoken || 'EN',
            accept_sms: createLeadDto.accept_sms || false,
            preferred_communication:
              createLeadDto.preferred_communication || 'email',
            source: createLeadDto.source,
            external_source_id: createLeadDto.external_source_id,
            status: 'lead',
            created_by_user_id: userId,
          },
        });

        // 2. Create emails
        const emails = await this.emailsService.createMultiple(
          leadId,
          createLeadDto.emails,
          tx,
        );

        // 3. Create phones
        const phones = await this.phonesService.createMultiple(
          tenantId,
          leadId,
          createLeadDto.phones,
          tx,
        );

        // 4. Create addresses (with Google Maps validation)
        const addresses = await this.addressesService.createMultiple(
          leadId,
          createLeadDto.addresses,
          tx,
        );

        // 5. Create service request (if provided)
        let serviceRequest = null;
        if (createLeadDto.service_request && addresses.length > 0) {
          // Use first address as default
          serviceRequest = await this.serviceRequestsService.createForNewLead(
            tenantId,
            leadId,
            addresses[0].id,
            createLeadDto.service_request,
            tx,
          );
        }

        return {
          ...newLead,
          emails,
          phones,
          addresses,
          service_requests: serviceRequest ? [serviceRequest] : [],
        };
      });

      // Retroactive lead-call linking: update orphaned call records
      // Any previous calls from this phone number that had no lead get linked now
      if (createLeadDto.phones && createLeadDto.phones.length > 0) {
        this.linkOrphanedCallsToLead(
          tenantId,
          lead.id,
          createLeadDto.phones.map((p) => p.phone),
        ).catch((err) => {
          this.logger.warn(
            `⚠️ Failed to link orphaned calls to lead ${lead.id}: ${err.message}`,
          );
        });
      }

      // Log activity (outside transaction) - only if userId exists
      if (userId) {
        await this.activitiesService.logActivity(tenantId, {
          lead_id: lead.id,
          activity_type: ActivityType.CREATED,
          description: `Lead created: ${lead.first_name} ${lead.last_name} (${lead.source})`,
          user_id: userId,
          metadata: {
            source: lead.source,
            external_source_id: lead.external_source_id,
          },
        });

        // Audit log (async, non-blocking)
        await this.auditLogger.logTenantChange({
          action: 'created',
          entityType: 'lead',
          entityId: lead.id,
          tenantId,
          actorUserId: userId,
          after: lead,
          description: `Lead created: ${lead.first_name} ${lead.last_name}`,
        });
      }

      return lead;
    } catch (error) {
      this.logger.error(
        `Failed to create lead for tenant ${tenantId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get all leads for a tenant with filters and pagination
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param listLeadsDto - Filters and pagination
   * @returns Paginated leads
   */
  async findAll(
    tenantId: string,
    listLeadsDto: ListLeadsDto,
  ): Promise<{ data: any[]; meta: any }> {
    const page = listLeadsDto.page || 1;
    const limit = Math.min(listLeadsDto.limit || 50, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
    };

    // Status filter (supports multiple values)
    if (listLeadsDto.status && listLeadsDto.status.length > 0) {
      where.status = { in: listLeadsDto.status };
    }

    // Source filter (supports multiple values)
    if (listLeadsDto.source && listLeadsDto.source.length > 0) {
      where.source = { in: listLeadsDto.source };
    }

    // Date range filters
    if (listLeadsDto.created_after || listLeadsDto.created_before) {
      where.created_at = {};

      if (listLeadsDto.created_after) {
        where.created_at.gte = new Date(listLeadsDto.created_after);
      }

      if (listLeadsDto.created_before) {
        where.created_at.lte = new Date(listLeadsDto.created_before);
      }
    }

    // Email filter (exact match on any lead email)
    // MySQL collation handles case-insensitive matching automatically
    if (listLeadsDto.email) {
      where.emails = {
        some: {
          email: listLeadsDto.email,
        },
      };
    }

    // Search filter (by first_name, last_name, email, phone, city, state)
    // Supports multi-word search: "John Doe" searches for "John" AND "Doe"
    // MySQL collation handles case-insensitivity automatically
    if (listLeadsDto.search) {
      const searchInput = listLeadsDto.search.trim();

      // Split by whitespace for multi-word search
      const searchTerms = searchInput.split(/\s+/).filter(Boolean);

      // Each search term must match at least one field (AND logic between terms, OR logic between fields)
      const searchConditions = searchTerms.map((term) => {
        const phoneDigits = term.replace(/\D/g, '');

        return {
          OR: [
            // Search in first_name
            { first_name: { contains: term } },
            // Search in last_name
            { last_name: { contains: term } },
            // Search in emails
            {
              emails: {
                some: { email: { contains: term } },
              },
            },
            // Search in phones (digits only)
            ...(phoneDigits.length > 0
              ? [
                  {
                    phones: {
                      some: { phone: { contains: phoneDigits } },
                    },
                  },
                ]
              : []),
            // Search in addresses (city)
            {
              addresses: {
                some: { city: { contains: term } },
              },
            },
            // Search in addresses (state)
            {
              addresses: {
                some: { state: { contains: term } },
              },
            },
          ],
        };
      });

      // Combine all search term conditions with AND
      if (searchConditions.length > 0) {
        where.AND = [...(where.AND || []), ...searchConditions];
      }
    }

    // Log the generated where clause for debugging
    if (listLeadsDto.search) {
      this.logger.debug(
        `Search query for "${listLeadsDto.search}": ${JSON.stringify(where, null, 2)}`,
      );
    }

    // Dynamic sorting
    const sortOrder = listLeadsDto.sort_order || 'desc';
    let orderBy: any = { created_at: sortOrder }; // Default sort

    if (listLeadsDto.sort_by) {
      switch (listLeadsDto.sort_by) {
        case 'name':
          // Sort by first_name, then last_name
          orderBy = [{ first_name: sortOrder }, { last_name: sortOrder }];
          break;
        case 'city':
          // Sort by primary address city (Prisma doesn't support nested sorting directly)
          // We'll handle this with a raw query approach or fetch and sort in memory
          // For now, fall back to created_at
          orderBy = { created_at: sortOrder };
          break;
        case 'state':
          // Same limitation as city
          orderBy = { created_at: sortOrder };
          break;
        case 'status':
          orderBy = { status: sortOrder };
          break;
        case 'source':
          orderBy = { source: sortOrder };
          break;
        case 'created_at':
          orderBy = { created_at: sortOrder };
          break;
        default:
          orderBy = { created_at: sortOrder };
      }
    }

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: {
          emails: {
            where: { is_primary: true },
            take: 1,
          },
          phones: {
            where: { is_primary: true },
            take: 1,
          },
          addresses: {
            where: { is_primary: true },
            take: 1,
          },
          service_requests: {
            where: { status: { not: 'cancelled' } },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    // Post-query sorting for city and state (not supported by Prisma nested sorting)
    let sortedLeads = leads;
    if (listLeadsDto.sort_by === 'city' || listLeadsDto.sort_by === 'state') {
      const sortField = listLeadsDto.sort_by;
      const sortDir = sortOrder === 'asc' ? 1 : -1;

      sortedLeads = leads.sort((a, b) => {
        const aValue = a.addresses?.[0]?.[sortField] || '';
        const bValue = b.addresses?.[0]?.[sortField] || '';
        return aValue.localeCompare(bValue) * sortDir;
      });
    }

    return {
      data: sortedLeads,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single lead by ID with all relations
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @returns Lead with full details
   */
  async findOne(tenantId: string, leadId: string): Promise<any> {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenant_id: tenantId,
      },
      include: {
        emails: {
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        },
        phones: {
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        },
        addresses: {
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        },
        service_requests: {
          orderBy: { created_at: 'desc' },
          include: {
            lead_address: true,
          },
        },
        created_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(
        `Lead with ID ${leadId} not found or access denied`,
      );
    }

    return lead;
  }

  /**
   * Update lead basic information
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param userId - User performing the update
   * @param updateLeadDto - Update data
   * @returns Updated lead
   */
  async update(
    tenantId: string,
    leadId: string,
    userId: string,
    updateLeadDto: UpdateLeadDto,
  ): Promise<any> {
    // Get existing lead for audit logging
    const existingLead = await this.findOne(tenantId, leadId);

    const updatedLead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        first_name: updateLeadDto.first_name,
        last_name: updateLeadDto.last_name,
        language_spoken: updateLeadDto.language_spoken,
        accept_sms: updateLeadDto.accept_sms,
        preferred_communication: updateLeadDto.preferred_communication,
      },
    });

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.UPDATED,
      description: `Lead information updated`,
      user_id: userId,
      metadata: {
        changes: updateLeadDto,
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'lead',
      entityId: leadId,
      tenantId,
      actorUserId: userId,
      before: existingLead,
      after: updatedLead,
      description: `Lead updated: ${updatedLead.first_name} ${updatedLead.last_name}`,
    });

    return updatedLead;
  }

  /**
   * Update lead status with validation
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param userId - User performing the update
   * @param updateStatusDto - Status update data
   * @returns Updated lead
   */
  async updateStatus(
    tenantId: string,
    leadId: string,
    userId: string,
    updateStatusDto: UpdateStatusDto,
  ): Promise<any> {
    const lead = await this.findOne(tenantId, leadId);

    // Validate status transitions
    const validStatuses = ['lead', 'prospect', 'customer', 'lost'];
    if (!validStatuses.includes(updateStatusDto.status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    // Status transition rules
    if (updateStatusDto.status === 'customer' && lead.status === 'customer') {
      throw new BadRequestException(
        'Lead is already a customer. Status cannot be changed.',
      );
    }

    if (updateStatusDto.status === 'lost' && !updateStatusDto.lost_reason) {
      throw new BadRequestException(
        'Lost reason is required when marking lead as lost',
      );
    }

    // Determine activity type
    let activityType = ActivityType.STATUS_CHANGED;
    if (updateStatusDto.status === 'customer') {
      activityType = ActivityType.CONVERTED_TO_CUSTOMER;
    } else if (updateStatusDto.status === 'lost') {
      activityType = ActivityType.MARKED_AS_LOST;
    } else if (lead.status === 'lost' && updateStatusDto.status === 'lead') {
      activityType = ActivityType.REACTIVATED;
    }

    const updatedLead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: updateStatusDto.status,
        lost_reason:
          updateStatusDto.status === 'lost'
            ? updateStatusDto.lost_reason
            : null,
        lost_at: updateStatusDto.status === 'lost' ? new Date() : null,
      },
    });

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: activityType,
      description: `Status changed: ${lead.status} → ${updateStatusDto.status}${updateStatusDto.lost_reason ? ` (${updateStatusDto.lost_reason})` : ''}`,
      user_id: userId,
      metadata: {
        old_status: lead.status,
        new_status: updateStatusDto.status,
        lost_reason: updateStatusDto.lost_reason,
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'lead',
      entityId: leadId,
      tenantId,
      actorUserId: userId,
      before: { status: lead.status, lost_reason: lead.lost_reason },
      after: {
        status: updatedLead.status,
        lost_reason: updatedLead.lost_reason,
      },
      description: `Lead status changed to ${updateStatusDto.status}`,
    });

    return updatedLead;
  }

  /**
   * Delete a lead (soft delete - keeps data but marks as deleted)
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param userId - User performing the deletion
   */
  async delete(
    tenantId: string,
    leadId: string,
    userId: string,
  ): Promise<void> {
    const lead = await this.findOne(tenantId, leadId);

    // Hard delete (with cascade) - all related entities deleted automatically
    await this.prisma.lead.delete({
      where: { id: leadId },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'lead',
      entityId: leadId,
      tenantId,
      actorUserId: userId,
      before: lead,
      description: `Lead deleted: ${lead.first_name} ${lead.last_name}`,
    });
  }

  /**
   * Get dashboard statistics for leads
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @returns Dashboard stats
   */
  async getStats(tenantId: string): Promise<any> {
    const [totalLeads, leadsByStatus, leadsBySource, recentLeads] =
      await Promise.all([
        this.prisma.lead.count({ where: { tenant_id: tenantId } }),
        this.prisma.lead.groupBy({
          by: ['status'],
          where: { tenant_id: tenantId },
          _count: { id: true },
        }),
        this.prisma.lead.groupBy({
          by: ['source'],
          where: { tenant_id: tenantId },
          _count: { id: true },
        }),
        this.prisma.lead.findMany({
          where: { tenant_id: tenantId },
          orderBy: { created_at: 'desc' },
          take: 5,
          select: {
            id: true,
            first_name: true,
            last_name: true,
            status: true,
            source: true,
            created_at: true,
          },
        }),
      ]);

    return {
      total: totalLeads,
      by_status: leadsByStatus.reduce(
        (acc, curr) => {
          acc[curr.status] = curr._count.id;
          return acc;
        },
        {} as Record<string, number>,
      ),
      by_source: leadsBySource.reduce(
        (acc, curr) => {
          acc[curr.source] = curr._count.id;
          return acc;
        },
        {} as Record<string, number>,
      ),
      recent: recentLeads,
    };
  }

  /**
   * Find lead by external source ID (for webhook deduplication)
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param externalSourceId - External source identifier
   * @returns Lead or null
   */
  async findByExternalSourceId(
    tenantId: string,
    externalSourceId: string,
  ): Promise<any | null> {
    return this.prisma.lead.findFirst({
      where: {
        tenant_id: tenantId,
        external_source_id: externalSourceId,
      },
    });
  }

  /**
   * Check if phone exists for the tenant (webhook usage)
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param phone - Phone number (sanitized)
   * @returns boolean
   */
  async checkPhoneExists(tenantId: string, phone: string): Promise<boolean> {
    return this.phonesService.checkPhoneUniqueness(tenantId, phone);
  }

  /**
   * Create lead from webhook (used by webhook controller)
   * @param tenantId - Tenant ID from subdomain
   * @param webhookLeadDto - Lead data from webhook
   * @returns Created lead
   */
  async createFromWebhook(
    tenantId: string,
    webhookLeadDto: CreateLeadDto,
  ): Promise<any> {
    // Webhook source override
    const leadDto: CreateLeadDto = {
      ...webhookLeadDto,
      source: 'webhook',
    };

    // Create lead (no user ID for webhook - system action)
    return this.create(tenantId, null, leadDto);
  }

  /**
   * Retroactively link orphaned call records to a newly created lead.
   *
   * When a lead is created with phone numbers, find any call_record or
   * voice_call_log rows that have matching from_number but no lead_id,
   * and update them to point to this lead.
   *
   * @param tenantId - Tenant UUID (multi-tenant isolation)
   * @param leadId - Newly created lead UUID
   * @param phoneNumbers - Raw phone numbers from the lead
   */
  private async linkOrphanedCallsToLead(
    tenantId: string,
    leadId: string,
    phoneNumbers: string[],
  ): Promise<void> {
    // Generate all phone variations for each number
    const allVariations: string[] = [];
    for (const phone of phoneNumbers) {
      const sanitized = phone.replace(/\D/g, '');
      const last10 = sanitized.slice(-10);
      if (last10.length >= 10) {
        allVariations.push(
          last10,
          `1${last10}`,
          `+1${last10}`,
        );
      } else {
        allVariations.push(sanitized);
      }
    }

    const uniqueVariations = [...new Set(allVariations)];

    if (uniqueVariations.length === 0) return;

    // Update call_record rows with matching from_number and no lead
    const updatedCalls = await this.prisma.call_record.updateMany({
      where: {
        tenant_id: tenantId,
        lead_id: null,
        from_number: { in: uniqueVariations },
      },
      data: { lead_id: leadId },
    });

    // Update voice_call_log rows with matching from_number and no lead
    const updatedVoiceLogs = await this.prisma.voice_call_log.updateMany({
      where: {
        tenant_id: tenantId,
        lead_id: null,
        from_number: { in: uniqueVariations },
      },
      data: { lead_id: leadId },
    });

    if (updatedCalls.count > 0 || updatedVoiceLogs.count > 0) {
      this.logger.log(
        `🔗 Retroactively linked ${updatedCalls.count} call_record(s) and ${updatedVoiceLogs.count} voice_call_log(s) to lead ${leadId}`,
      );
    }
  }

  /**
   * Generate UUID v4
   * @returns UUID string
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}
