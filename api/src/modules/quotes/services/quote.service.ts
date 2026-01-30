import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { LeadsService } from '../../leads/services/leads.service';
import { AddressType } from '../../leads/dto/lead.dto';
import { QuoteNumberGeneratorService } from './quote-number-generator.service';
import { QuoteJobsiteAddressService } from './quote-jobsite-address.service';
import { QuoteVersionService } from './quote-version.service';
import { QuotePricingService } from './quote-pricing.service';
import {
  CreateQuoteFromLeadDto,
  CreateQuoteWithCustomerDto,
  CreateQuoteDto,
  UpdateQuoteDto,
  UpdateQuoteStatusDto,
  UpdateJobsiteAddressDto,
  ListQuotesDto,
  QuoteStatus,
} from '../dto/quote';
import {
  AddBundleToQuoteDto,
  AddBundleToQuoteResponseDto,
} from '../dto/bundle';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly leadsService: LeadsService,
    private readonly quoteNumberService: QuoteNumberGeneratorService,
    private readonly jobsiteAddressService: QuoteJobsiteAddressService,
    private readonly versionService: QuoteVersionService,
    private readonly pricingService: QuotePricingService,
  ) {}

  /**
   * Create quote from existing lead
   * Updates lead status to "prospect"
   *
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @param leadId - Lead UUID
   * @param dto - Create quote DTO
   * @returns Created quote with relationships
   */
  async createFromLead(
    tenantId: string,
    userId: string,
    leadId: string,
    dto: CreateQuoteFromLeadDto,
  ): Promise<any> {
    // Validate lead exists and belongs to tenant
    const lead = await this.leadsService.findOne(tenantId, leadId);

    if (!lead) {
      throw new NotFoundException(`Lead not found: ${leadId}`);
    }

    const createdQuoteId = await this.prisma.$transaction(async (tx) => {
      // 1. Validate and create jobsite address
      const address = await this.jobsiteAddressService.createAndValidate(
        tenantId,
        dto.jobsite_address,
        tx,
      );

      // 2. Validate vendor exists and belongs to tenant
      const vendor = await tx.vendor.findFirst({
        where: {
          id: dto.vendor_id,
          tenant_id: tenantId,
          is_active: true,
        },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found or inactive');
      }

      // 3. Generate quote number
      const quoteNumber = await this.quoteNumberService.generate(tenantId, tx);

      // 4. Set expiration days (default 30) and calculate expiration date
      const expirationDays = dto.expiration_days || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      // 5. Create quote
      const quote = await tx.quote.create({
        data: {
          id: uuid(),
          tenant_id: tenantId,
          quote_number: quoteNumber,
          lead_id: leadId,
          vendor_id: dto.vendor_id,
          jobsite_address_id: address.id,
          title: dto.title,
          po_number: dto.po_number || null,
          status: QuoteStatus.DRAFT,
          active_version_number: new Decimal(1.0),
          expiration_days: expirationDays,
          expires_at: expiresAt,
          custom_profit_percent: dto.custom_profit_percent
            ? new Decimal(dto.custom_profit_percent)
            : null,
          custom_overhead_percent: dto.custom_overhead_percent
            ? new Decimal(dto.custom_overhead_percent)
            : null,
          private_notes: dto.private_notes || null,
          created_by_user_id: userId,
          subtotal: new Decimal(0),
          tax_amount: new Decimal(0),
          discount_amount: new Decimal(0),
          total: new Decimal(0),
        },
      });

      // 6. Create initial version (v1.0)
      await this.versionService.createInitialVersion(quote.id, quote, tx);

      // 7. Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote',
        entityId: quote.id,
        tenantId,
        actorUserId: userId,
        before: {} as any,
        after: quote,
        description: `Quote created from lead: ${quoteNumber} - ${dto.title}`,
      });

      this.logger.log(
        `Quote created from lead: ${quoteNumber} for tenant: ${tenantId}`,
      );

      return quote.id;
    });

    // Fetch and return the complete quote after transaction commits
    return this.findOne(tenantId, createdQuoteId);
  }

  /**
   * Create quote with new customer (creates lead first)
   * Transaction: create lead → create quote
   *
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @param dto - Create quote with customer DTO
   * @returns Created quote with relationships
   */
  async createWithNewCustomer(
    tenantId: string,
    userId: string,
    dto: CreateQuoteWithCustomerDto,
  ): Promise<any> {
    const createdQuoteId = await this.prisma.$transaction(async (tx) => {
      // 1. Create lead via LeadsService (using jobsite address as primary address)
      const lead = await this.leadsService.create(tenantId, userId, {
        first_name: dto.customer.first_name,
        last_name: dto.customer.last_name,
        emails: [{ email: dto.customer.email, is_primary: true }],
        phones: [{ phone: dto.customer.phone, is_primary: true }],
        addresses: [{
          address_line1: dto.jobsite_address.address_line1,
          address_line2: dto.jobsite_address.address_line2,
          city: dto.jobsite_address.city,
          state: dto.jobsite_address.state,
          zip_code: dto.jobsite_address.zip_code,
          latitude: dto.jobsite_address.latitude,
          longitude: dto.jobsite_address.longitude,
          address_type: AddressType.SERVICE,
          is_primary: true,
        }],
        source: 'manual',
      });

      // 2. Validate and create jobsite address
      const address = await this.jobsiteAddressService.createAndValidate(
        tenantId,
        dto.jobsite_address,
        tx,
      );

      // 3. Validate vendor
      const vendor = await tx.vendor.findFirst({
        where: {
          id: dto.vendor_id,
          tenant_id: tenantId,
          is_active: true,
        },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found or inactive');
      }

      // 4. Generate quote number
      const quoteNumber = await this.quoteNumberService.generate(tenantId, tx);

      // 5. Set expiration days (default 30) and calculate expiration date
      const expirationDays = dto.expiration_days || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      // 6. Create quote
      const quote = await tx.quote.create({
        data: {
          id: uuid(),
          tenant_id: tenantId,
          quote_number: quoteNumber,
          lead_id: lead.id,
          vendor_id: dto.vendor_id,
          jobsite_address_id: address.id,
          title: dto.title,
          po_number: dto.po_number || null,
          status: QuoteStatus.DRAFT,
          active_version_number: new Decimal(1.0),
          expiration_days: expirationDays,
          expires_at: expiresAt,
          custom_profit_percent: dto.custom_profit_percent
            ? new Decimal(dto.custom_profit_percent)
            : null,
          custom_overhead_percent: dto.custom_overhead_percent
            ? new Decimal(dto.custom_overhead_percent)
            : null,
          private_notes: dto.private_notes || null,
          created_by_user_id: userId,
          subtotal: new Decimal(0),
          tax_amount: new Decimal(0),
          discount_amount: new Decimal(0),
          total: new Decimal(0),
        },
      });

      // 7. Create initial version
      await this.versionService.createInitialVersion(quote.id, quote, tx);

      // 8. Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote',
        entityId: quote.id,
        tenantId,
        actorUserId: userId,
        before: {} as any,
        after: quote,
        description: `Quote created with new customer: ${quoteNumber} - ${dto.title}`,
      });

      this.logger.log(
        `Quote created with new customer: ${quoteNumber} for tenant: ${tenantId}`,
      );

      return quote.id;
    });

    // Fetch and return the complete quote after transaction commits
    return this.findOne(tenantId, createdQuoteId);
  }

  /**
   * Create quote manually (requires existing lead)
   *
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @param dto - Create quote DTO
   * @returns Created quote with relationships
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateQuoteDto,
  ): Promise<any> {
    // Validate lead exists
    const lead = await this.leadsService.findOne(tenantId, dto.lead_id);

    if (!lead) {
      throw new NotFoundException(`Lead not found: ${dto.lead_id}`);
    }

    const createdQuoteId = await this.prisma.$transaction(async (tx) => {
      // 1. Validate and create jobsite address
      const address = await this.jobsiteAddressService.createAndValidate(
        tenantId,
        dto.jobsite_address,
        tx,
      );

      // 2. Validate vendor
      const vendor = await tx.vendor.findFirst({
        where: {
          id: dto.vendor_id,
          tenant_id: tenantId,
          is_active: true,
        },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found or inactive');
      }

      // 3. Generate quote number
      const quoteNumber = await this.quoteNumberService.generate(tenantId, tx);

      // 4. Set expiration days (default 30) and calculate expiration date
      const expirationDays = dto.expiration_days || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      // 5. Create quote
      const quote = await tx.quote.create({
        data: {
          id: uuid(),
          tenant_id: tenantId,
          quote_number: quoteNumber,
          lead_id: dto.lead_id,
          vendor_id: dto.vendor_id,
          jobsite_address_id: address.id,
          title: dto.title,
          po_number: dto.po_number || null,
          status: QuoteStatus.DRAFT,
          active_version_number: new Decimal(1.0),
          expiration_days: expirationDays,
          expires_at: expiresAt,
          custom_profit_percent: dto.custom_profit_percent
            ? new Decimal(dto.custom_profit_percent)
            : null,
          custom_overhead_percent: dto.custom_overhead_percent
            ? new Decimal(dto.custom_overhead_percent)
            : null,
          private_notes: dto.private_notes || null,
          created_by_user_id: userId,
          subtotal: new Decimal(0),
          tax_amount: new Decimal(0),
          discount_amount: new Decimal(0),
          total: new Decimal(0),
        },
      });

      // 6. Create initial version
      await this.versionService.createInitialVersion(quote.id, quote, tx);

      // 7. Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote',
        entityId: quote.id,
        tenantId,
        actorUserId: userId,
        before: {} as any,
        after: quote,
        description: `Quote created: ${quoteNumber} - ${dto.title}`,
      });

      this.logger.log(
        `Quote created: ${quoteNumber} for tenant: ${tenantId}`,
      );

      return quote.id;
    });

    // Fetch and return the complete quote after transaction commits
    return this.findOne(tenantId, createdQuoteId);
  }

  /**
   * List quotes with pagination, filters, and search
   *
   * @param tenantId - Tenant UUID
   * @param listDto - List filters and pagination
   * @returns Paginated quotes list
   */
  async findAll(tenantId: string, listDto: ListQuotesDto): Promise<any> {
    const {
      page = 1,
      limit = 20,
      status,
      vendor_id,
      lead_id,
      search,
      created_from,
      created_to,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = listDto;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
      is_archived: false,
    };

    if (status) {
      where.status = status;
    }

    if (vendor_id) {
      where.vendor_id = vendor_id;
    }

    if (lead_id) {
      where.lead_id = lead_id;
    }

    if (created_from || created_to) {
      where.created_at = {};
      if (created_from) {
        // Start of day (00:00:00.000)
        const fromDate = new Date(created_from);
        fromDate.setHours(0, 0, 0, 0);
        where.created_at.gte = fromDate;
      }
      if (created_to) {
        // End of day (23:59:59.999)
        const toDate = new Date(created_to);
        toDate.setHours(23, 59, 59, 999);
        where.created_at.lte = toDate;
      }
    }

    if (search) {
      where.OR = [
        { quote_number: { contains: search } },
        { title: { contains: search } },
        {
          lead: {
            OR: [
              { first_name: { contains: search } },
              { last_name: { contains: search } },
            ],
          },
        },
      ];
    }

    // Execute query
    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          jobsite_address: true,
        },
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
      }),
      this.prisma.quote.count({ where }),
    ]);

    return {
      data: quotes.map((quote) => ({
        ...quote,
        active_version_number: Number(quote.active_version_number),
        custom_profit_percent: quote.custom_profit_percent
          ? Number(quote.custom_profit_percent)
          : null,
        custom_overhead_percent: quote.custom_overhead_percent
          ? Number(quote.custom_overhead_percent)
          : null,
        subtotal: Number(quote.subtotal),
        tax_amount: Number(quote.tax_amount),
        discount_amount: Number(quote.discount_amount),
        total: Number(quote.total),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single quote with all relationships
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @returns Complete quote with relationships
   */
  async findOne(tenantId: string, quoteId: string): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
      include: {
        lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            emails: true,
            phones: true,
          },
        },
        vendor: true,
        jobsite_address: true,
        items: {
          include: {
            unit_measurement: true,
            quote_group: true,
          },
          orderBy: { order_index: 'asc' },
        },
        groups: {
          include: {
            items: {
              include: {
                unit_measurement: true,
              },
              orderBy: { order_index: 'asc' },
            },
          },
          orderBy: { order_index: 'asc' },
        },
        discount_rules: {
          orderBy: { order_index: 'asc' },
        },
        draw_schedule: {
          orderBy: { draw_number: 'asc' },
        },
        attachments: true,
        tag_assignments: {
          include: {
            quote_tag: true,
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Convert Decimal fields to numbers
    return {
      ...quote,
      active_version_number: Number(quote.active_version_number),
      custom_profit_percent: quote.custom_profit_percent
        ? Number(quote.custom_profit_percent)
        : null,
      custom_overhead_percent: quote.custom_overhead_percent
        ? Number(quote.custom_overhead_percent)
        : null,
      subtotal: Number(quote.subtotal),
      tax_amount: Number(quote.tax_amount),
      discount_amount: Number(quote.discount_amount),
      total: Number(quote.total),
      jobsite_address: (quote as any).jobsite_address
        ? {
            ...(quote as any).jobsite_address,
            latitude: Number((quote as any).jobsite_address.latitude),
            longitude: Number((quote as any).jobsite_address.longitude),
          }
        : null,
      items: (quote as any).items?.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        material_cost_per_unit: Number(item.material_cost_per_unit),
        labor_cost_per_unit: Number(item.labor_cost_per_unit),
        equipment_cost_per_unit: Number(item.equipment_cost_per_unit),
        subcontract_cost_per_unit: Number(item.subcontract_cost_per_unit),
        other_cost_per_unit: Number(item.other_cost_per_unit),
        total_cost: Number(item.total_cost),
      })) || [],
      discount_rules: (quote as any).discount_rules?.map((rule) => ({
        ...rule,
        value: Number(rule.value),
      })) || [],
      draw_schedule: (quote as any).draw_schedule?.map((draw) => ({
        ...draw,
        value: Number(draw.value),
      })) || [],
    };
  }

  /**
   * Update quote basic information
   * Creates version (+0.1)
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param userId - User UUID
   * @param dto - Update quote DTO
   * @returns Updated quote
   */
  async update(
    tenantId: string,
    quoteId: string,
    userId: string,
    dto: UpdateQuoteDto,
  ): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Cannot edit approved quote
    if (quote.status === QuoteStatus.APPROVED) {
      throw new BadRequestException('Cannot edit approved quote');
    }

    await this.prisma.$transaction(async (tx) => {
      // Validate vendor if provided
      if (dto.vendor_id) {
        const vendor = await tx.vendor.findFirst({
          where: {
            id: dto.vendor_id,
            tenant_id: tenantId,
            is_active: true,
          },
        });

        if (!vendor) {
          throw new NotFoundException('Vendor not found or inactive');
        }
      }

      // Build update data
      const updateData: any = {};

      if (dto.vendor_id) {
        updateData.vendor = {
          connect: { id: dto.vendor_id },
        };
      }
      if (dto.title) updateData.title = dto.title;
      if (dto.po_number !== undefined) updateData.po_number = dto.po_number;
      if (dto.expiration_date) updateData.expires_at = new Date(dto.expiration_date);
      if (dto.custom_profit_percent !== undefined)
        updateData.custom_profit_percent =
          dto.custom_profit_percent !== null
            ? new Decimal(dto.custom_profit_percent)
            : null;
      if (dto.custom_overhead_percent !== undefined)
        updateData.custom_overhead_percent =
          dto.custom_overhead_percent !== null
            ? new Decimal(dto.custom_overhead_percent)
            : null;
      if (dto.custom_contingency_percent !== undefined)
        updateData.custom_contingency_percent =
          dto.custom_contingency_percent !== null
            ? new Decimal(dto.custom_contingency_percent)
            : null;
      if (dto.custom_tax_rate !== undefined)
        updateData.custom_tax_rate =
          dto.custom_tax_rate !== null
            ? new Decimal(dto.custom_tax_rate)
            : null;
      if (dto.show_line_items !== undefined)
        updateData.show_line_items = dto.show_line_items;
      if (dto.show_cost_breakdown !== undefined)
        updateData.show_cost_breakdown = dto.show_cost_breakdown;
      if (dto.private_notes !== undefined)
        updateData.private_notes = dto.private_notes;
      if (dto.custom_terms !== undefined)
        updateData.custom_terms = dto.custom_terms;
      if (dto.custom_payment_instructions !== undefined)
        updateData.custom_payment_instructions = dto.custom_payment_instructions;

      // Update quote
      const updatedQuote = await tx.quote.update({
        where: { id: quoteId },
        data: updateData,
      });

      // Create version (+0.1)
      await this.versionService.createVersion(
        quoteId,
        0.1,
        'Quote updated',
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'quote',
        entityId: quoteId,
        tenantId,
        actorUserId: userId,
        before: quote,
        after: updatedQuote,
        description: `Quote updated: ${quote.quote_number}`,
      });

      this.logger.log(`Quote updated: ${quoteId}`);
    });

    // Fetch and return the complete quote after transaction commits
    return this.findOne(tenantId, quoteId);
  }

  /**
   * Update quote status with validation
   * Creates version (+1.0 for major changes)
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param userId - User UUID
   * @param dto - Update status DTO
   * @returns Updated quote
   */
  async updateStatus(
    tenantId: string,
    quoteId: string,
    userId: string,
    dto: UpdateQuoteStatusDto,
  ): Promise<any> {
    const quote = await this.findOne(tenantId, quoteId);

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      draft: ['pending_approval', 'ready'],
      pending_approval: ['ready', 'draft'],
      ready: ['sent', 'draft'],
      sent: ['delivered', 'read', 'opened', 'downloaded', 'approved', 'denied', 'lost'],
      delivered: ['opened', 'read', 'downloaded', 'approved', 'denied', 'lost'],
      opened: ['read', 'downloaded', 'approved', 'denied', 'lost'],
      read: ['downloaded', 'approved', 'denied', 'lost'],
      downloaded: ['approved', 'denied', 'lost'],
      approved: ['started', 'concluded'],
      started: ['concluded'],
      concluded: [], // Final status - project complete
      denied: ['draft'], // Can reopen
      lost: ['draft'], // Can reopen
      email_failed: ['sent'], // Can retry
    };

    const allowedStatuses = validTransitions[quote.status] || [];

    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition: ${quote.status} → ${dto.status}`,
      );
    }

    // Ready status requires validation
    if (dto.status === QuoteStatus.READY) {
      await this.validateReadyStatus(quote);
    }

    await this.prisma.$transaction(async (tx) => {
      // Update quote status
      const updatedQuote = await tx.quote.update({
        where: { id: quoteId },
        data: { status: dto.status },
      });

      // Create version (+1.0 for status changes)
      await this.versionService.createVersion(
        quoteId,
        1.0,
        dto.reason || `Status changed: ${quote.status} → ${dto.status}`,
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'quote',
        entityId: quoteId,
        tenantId,
        actorUserId: userId,
        before: quote,
        after: updatedQuote,
        description: `Quote status changed: ${quote.status} → ${dto.status}`,
      });

      this.logger.log(`Quote status updated: ${quoteId} → ${dto.status}`);
    });

    // Auto-update lead status based on quote progression
    if (quote.lead_id) {
      const wonStatuses = ['approved', 'started', 'concluded'];
      const activeStatuses = ['sent', 'delivered', 'read', 'opened', 'downloaded', 'email_failed'];

      try {
        // Convert to customer when quote is won
        if (wonStatuses.includes(dto.status)) {
          await this.leadsService.updateStatus(tenantId, quote.lead_id, userId, {
            status: 'customer',
          });
          this.logger.log(
            `Lead ${quote.lead_id} automatically converted to customer (quote ${quoteId} → ${dto.status})`,
          );
        }
        // Convert to prospect when quote becomes active (sent, etc.)
        else if (activeStatuses.includes(dto.status)) {
          await this.leadsService.updateStatus(tenantId, quote.lead_id, userId, {
            status: 'prospect',
          });
          this.logger.log(
            `Lead ${quote.lead_id} automatically converted to prospect (quote ${quoteId} → ${dto.status})`,
          );
        }
      } catch (error) {
        // Don't fail quote status update if lead update fails
        this.logger.error(
          `Failed to auto-update lead ${quote.lead_id} status: ${error.message}`,
        );
      }
    }

    // Fetch and return the complete quote after transaction commits
    return this.findOne(tenantId, quoteId);
  }

  /**
   * Validate quote can be marked as "ready"
   * Requires: items, vendor, valid address, future expiration
   */
  private async validateReadyStatus(quote: any): Promise<void> {
    if (quote.items.length === 0) {
      throw new BadRequestException(
        'Quote must have at least one item to be marked as ready',
      );
    }

    if (!quote.vendor_id) {
      throw new BadRequestException('Quote must have a vendor to be marked as ready');
    }

    if (!quote.jobsite_address_id) {
      throw new BadRequestException('Quote must have a valid address to be marked as ready');
    }

    if (new Date(quote.expiration_date) <= new Date()) {
      throw new BadRequestException(
        'Quote expiration date must be in the future to be marked as ready',
      );
    }
  }

  /**
   * Update jobsite address with re-validation
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param userId - User UUID
   * @param dto - Update jobsite address DTO
   * @returns Updated quote
   */
  async updateJobsiteAddress(
    tenantId: string,
    quoteId: string,
    userId: string,
    dto: UpdateJobsiteAddressDto,
  ): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === QuoteStatus.APPROVED) {
      throw new BadRequestException('Cannot edit approved quote');
    }

    await this.prisma.$transaction(async (tx) => {
      // Update and validate address
      await this.jobsiteAddressService.updateAndValidate(
        tenantId,
        quote.jobsite_address_id,
        dto.jobsite_address,
        tx,
      );

      // Create version
      await this.versionService.createVersion(
        quoteId,
        0.1,
        'Jobsite address updated',
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'quote',
        entityId: quoteId,
        tenantId,
        actorUserId: userId,
        before: quote,
        after: quote,
        description: `Quote jobsite address updated: ${quote.quote_number}`,
      });

      this.logger.log(`Quote jobsite address updated: ${quoteId}`);
    });

    // Fetch and return the complete quote after transaction commits
    return this.findOne(tenantId, quoteId);
  }

  /**
   * Soft delete quote (archive)
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param userId - User UUID
   */
  async delete(tenantId: string, quoteId: string, userId: string): Promise<void> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    await this.prisma.quote.update({
      where: { id: quoteId },
      data: { is_archived: true },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'quote',
      entityId: quoteId,
      tenantId,
      actorUserId: userId,
      before: quote,
      after: {} as any,
      description: `Quote archived: ${quote.quote_number}`,
    });

    this.logger.log(`Quote archived: ${quoteId}`);
  }

  /**
   * Deep clone quote with all relationships
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param userId - User UUID
   * @returns Cloned quote
   */
  async clone(tenantId: string, quoteId: string, userId: string): Promise<any> {
    const sourceQuote = await this.findOne(tenantId, quoteId);

    if (!sourceQuote) {
      throw new NotFoundException('Source quote not found');
    }

    const clonedQuoteId = await this.prisma.$transaction(async (tx) => {
      // 1. Clone jobsite address
      const newAddress = await this.jobsiteAddressService.clone(
        tenantId,
        sourceQuote.jobsite_address_id,
        tx,
      );

      // 2. Generate new quote number
      const newQuoteNumber = await this.quoteNumberService.generate(tenantId, tx);

      // 3. Calculate new expiration date based on expiration_days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (sourceQuote.expiration_days || 30));

      // 4. Create new quote
      const newQuote = await tx.quote.create({
        data: {
          id: uuid(),
          tenant_id: tenantId,
          quote_number: newQuoteNumber,
          lead_id: sourceQuote.lead_id,
          vendor_id: sourceQuote.vendor_id,
          jobsite_address_id: newAddress.id,
          title: `${sourceQuote.title} (Copy)`,
          po_number: sourceQuote.po_number,
          status: QuoteStatus.DRAFT,
          active_version_number: new Decimal(1.0),
          expiration_days: sourceQuote.expiration_days,
          expires_at: expiresAt,
          custom_profit_percent: sourceQuote.custom_profit_percent
            ? new Decimal(sourceQuote.custom_profit_percent)
            : null,
          custom_overhead_percent: sourceQuote.custom_overhead_percent
            ? new Decimal(sourceQuote.custom_overhead_percent)
            : null,
          private_notes: sourceQuote.private_notes,
          custom_terms: sourceQuote.custom_terms,
          custom_payment_instructions: sourceQuote.custom_payment_instructions,
          created_by_user_id: userId,
          subtotal: new Decimal(sourceQuote.subtotal),
          tax_amount: new Decimal(sourceQuote.tax_amount),
          discount_amount: new Decimal(sourceQuote.discount_amount),
          total: new Decimal(sourceQuote.total),
        },
      });

      // 4. Clone all groups
      const groupIdMap = new Map<string, string>();
      for (const group of sourceQuote.groups) {
        const newGroupId = uuid();
        groupIdMap.set(group.id, newGroupId);

        await tx.quote_group.create({
          data: {
            id: newGroupId,
            quote_id: newQuote.id,
            name: group.name,
            description: group.description,
            order_index: group.order_index,
          },
        });
      }

      // 5. Clone all items
      for (const item of sourceQuote.items) {
        await tx.quote_item.create({
          data: {
            id: uuid(),
            quote_id: newQuote.id,
            quote_group_id: item.quote_group_id
              ? groupIdMap.get(item.quote_group_id)
              : null,
            title: item.title,
            description: item.description,
            quantity: new Decimal(item.quantity),
            unit_measurement_id: item.unit_measurement_id,
            material_cost_per_unit: new Decimal(item.material_cost_per_unit),
            labor_cost_per_unit: new Decimal(item.labor_cost_per_unit),
            equipment_cost_per_unit: new Decimal(item.equipment_cost_per_unit),
            subcontract_cost_per_unit: new Decimal(item.subcontract_cost_per_unit),
            other_cost_per_unit: new Decimal(item.other_cost_per_unit),
            total_cost: new Decimal(item.total_cost),
            order_index: item.order_index,
          },
        });
      }

      // 6. Clone discount rules
      for (const rule of sourceQuote.discount_rules) {
        await tx.quote_discount_rule.create({
          data: {
            id: uuid(),
            quote_id: newQuote.id,
            rule_type: rule.rule_type,
            value: new Decimal(rule.value),
            reason: rule.reason,
            apply_to: rule.apply_to,
            order_index: rule.order_index,
          },
        });
      }

      // 7. Clone draw schedule
      for (const draw of sourceQuote.draw_schedule) {
        await tx.draw_schedule_entry.create({
          data: {
            id: uuid(),
            quote_id: newQuote.id,
            draw_number: draw.draw_number,
            description: draw.description,
            calculation_type: draw.calculation_type,
            value: new Decimal(draw.value),
            order_index: draw.order_index,
          },
        });
      }

      // 8. Clone attachments (reference same files)
      for (const attachment of sourceQuote.attachments) {
        await tx.quote_attachment.create({
          data: {
            id: uuid(),
            quote_id: newQuote.id,
            attachment_type: attachment.attachment_type,
            file_id: attachment.file_id,
            url: attachment.url,
            title: attachment.title,
            qr_code_file_id: attachment.qr_code_file_id,
            grid_layout: attachment.grid_layout,
            order_index: attachment.order_index,
          },
        });
      }

      // 9. Create initial version
      await this.versionService.createInitialVersion(newQuote.id, newQuote, tx);

      // 10. Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote',
        entityId: newQuote.id,
        tenantId,
        actorUserId: userId,
        before: {} as any,
        after: newQuote,
        description: `Quote cloned from ${sourceQuote.quote_number}: ${newQuoteNumber}`,
      });

      this.logger.log(`Quote cloned: ${sourceQuote.quote_number} → ${newQuoteNumber}`);

      return newQuote.id;
    });

    // Fetch and return the complete quote after transaction commits
    return this.findOne(tenantId, clonedQuoteId);
  }

  /**
   * Search quotes by multiple fields
   *
   * @param tenantId - Tenant UUID
   * @param searchTerm - Search term
   * @returns Matching quotes
   */
  async search(tenantId: string, searchTerm: string): Promise<any[]> {
    const quotes = await this.prisma.quote.findMany({
      where: {
        tenant_id: tenantId,
        is_archived: false,
        OR: [
          { quote_number: { contains: searchTerm } },
          { title: { contains: searchTerm } },
          {
            lead: {
              OR: [
                { first_name: { contains: searchTerm } },
                { last_name: { contains: searchTerm } },
              ],
            },
          },
          {
            items: {
              some: {
                OR: [
                  { title: { contains: searchTerm } },
                  { description: { contains: searchTerm } },
                ],
              },
            },
          },
        ],
      },
      include: {
        lead: true,
        vendor: true,
      },
      take: 50,
    });

    return quotes;
  }

  /**
   * Add bundle to quote
   * Creates quote group (optional) and converts bundle items to quote items
   * Optionally applies bundle discount as quote discount rule
   *
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @param quoteId - Quote UUID
   * @param bundleId - Bundle UUID
   * @param dto - Add bundle DTO
   * @returns Response with created items count and IDs
   */
  async addBundle(
    tenantId: string,
    userId: string,
    quoteId: string,
    bundleId: string,
    dto: AddBundleToQuoteDto,
  ): Promise<AddBundleToQuoteResponseDto> {
    // Step 1: Validate quote exists and is editable
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      select: { id: true, status: true, quote_number: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot add bundle to approved quote');
    }

    // Step 2: Validate bundle exists and is active
    const bundle = await this.prisma.quote_bundle.findFirst({
      where: { id: bundleId, tenant_id: tenantId },
      include: {
        items: {
          orderBy: { order_index: 'asc' },
          include: {
            unit_measurement: {
              select: { id: true, name: true, abbreviation: true },
            },
          },
        },
      },
    });

    if (!bundle) {
      throw new NotFoundException('Bundle not found');
    }

    if (!bundle.is_active) {
      throw new BadRequestException('Cannot add inactive bundle to quote');
    }

    if (bundle.items.length === 0) {
      throw new BadRequestException('Bundle has no items');
    }

    // Step 3: Execute in transaction
    return await this.prisma.$transaction(async (tx) => {
      let quoteGroupId: string | undefined;
      let discountRuleId: string | undefined;

      // Step 3a: Create quote group (if requested)
      if (dto.create_group !== false) {
        // Get max order_index for groups
        const maxGroupIndex = await tx.quote_group.findFirst({
          where: { quote_id: quoteId },
          orderBy: { order_index: 'desc' },
          select: { order_index: true },
        });

        const groupOrderIndex = maxGroupIndex ? maxGroupIndex.order_index + 1 : 0;

        const group = await tx.quote_group.create({
          data: {
            id: uuid(),
            quote_id: quoteId,
            name: dto.group_name || bundle.name,
            description: bundle.description,
            order_index: groupOrderIndex,
          },
        });

        quoteGroupId = group.id;
      }

      // Step 3b: Get max order_index for items
      const maxItemIndex = await tx.quote_item.findFirst({
        where: { quote_id: quoteId },
        orderBy: { order_index: 'desc' },
        select: { order_index: true },
      });

      let nextItemOrderIndex = maxItemIndex ? maxItemIndex.order_index + 1 : 1;

      // Step 3c: Convert bundle items to quote items
      const quoteItemsData = bundle.items.map((bundleItem) => {
        const totalCostPerUnit =
          Number(bundleItem.material_cost_per_unit) +
          Number(bundleItem.labor_cost_per_unit) +
          Number(bundleItem.equipment_cost_per_unit) +
          Number(bundleItem.subcontract_cost_per_unit) +
          Number(bundleItem.other_cost_per_unit);

        const totalCost = totalCostPerUnit * Number(bundleItem.quantity);

        const itemData = {
          id: uuid(),
          quote_id: quoteId,
          quote_group_id: quoteGroupId || null,
          item_library_id: bundleItem.item_library_id,
          quote_bundle_id: bundleId,  // Track source bundle
          title: bundleItem.title,
          description: bundleItem.description,
          quantity: bundleItem.quantity,
          unit_measurement_id: bundleItem.unit_measurement_id,
          material_cost_per_unit: bundleItem.material_cost_per_unit,
          labor_cost_per_unit: bundleItem.labor_cost_per_unit,
          equipment_cost_per_unit: bundleItem.equipment_cost_per_unit,
          subcontract_cost_per_unit: bundleItem.subcontract_cost_per_unit,
          other_cost_per_unit: bundleItem.other_cost_per_unit,
          total_cost: new Decimal(totalCost),
          order_index: nextItemOrderIndex++,
          // Note: Custom margins NOT copied from bundle - user can set manually
          custom_profit_percent: null,
          custom_overhead_percent: null,
          custom_contingency_percent: null,
          custom_discount_percentage: null,
          custom_discount_amount: null,
        };

        return itemData;
      });

      await tx.quote_item.createMany({
        data: quoteItemsData,
      });

      // Step 3d: Apply bundle discount (if requested and exists)
      if (
        dto.apply_discount !== false &&
        bundle.discount_type &&
        bundle.discount_value
      ) {
        // Get max order_index for discount rules
        const maxDiscountIndex = await tx.quote_discount_rule.findFirst({
          where: { quote_id: quoteId },
          orderBy: { order_index: 'desc' },
          select: { order_index: true },
        });

        const discountOrderIndex = maxDiscountIndex
          ? maxDiscountIndex.order_index + 1
          : 0;

        const discountRule = await tx.quote_discount_rule.create({
          data: {
            id: uuid(),
            quote_id: quoteId,
            rule_type: bundle.discount_type,
            value: bundle.discount_value,
            reason: `Bundle discount: ${bundle.name}`,
            apply_to: 'subtotal',
            order_index: discountOrderIndex,
          },
        });

        discountRuleId = discountRule.id;
      }

      // Step 3e: Recalculate quote totals
      await this.pricingService.updateQuoteFinancials(quoteId, tx);

      // Step 3f: Create version snapshot (increment by 0.1)
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Added bundle: ${bundle.name} (${bundle.items.length} items)`,
        userId,
        tx,
      );

      // Step 3g: Audit log
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'quote',
        entityId: quoteId,
        tenantId,
        actorUserId: userId,
        description: `Bundle "${bundle.name}" added to quote ${quote.quote_number} (${bundle.items.length} items)`,
      });

      return {
        success: true,
        message: `Bundle '${bundle.name}' added to quote`,
        quote_group_id: quoteGroupId,
        items_created: bundle.items.length,
        discount_applied:
          dto.apply_discount !== false && !!discountRuleId,
        discount_rule_id: discountRuleId,
      };
    });
  }

  /**
   * Get quote statistics for tenant
   *
   * @param tenantId - Tenant UUID
   * @param createdFrom - Optional start date filter
   * @param createdTo - Optional end date filter
   * @param status - Optional status filter
   * @returns Aggregated statistics
   */
  async getStatistics(
    tenantId: string,
    createdFrom?: string,
    createdTo?: string,
    status?: string,
  ): Promise<any> {
    // Build where clause with optional date filters
    const where: any = {
      tenant_id: tenantId,
      is_archived: false,
    };

    if (createdFrom || createdTo) {
      where.created_at = {};
      if (createdFrom) {
        // Start of day (00:00:00.000)
        const fromDate = new Date(createdFrom);
        fromDate.setHours(0, 0, 0, 0);
        where.created_at.gte = fromDate;
      }
      if (createdTo) {
        // End of day (23:59:59.999)
        const toDate = new Date(createdTo);
        toDate.setHours(23, 59, 59, 999);
        where.created_at.lte = toDate;
      }
    }

    // Add status filter if provided
    if (status) {
      where.status = status;
    }

    const [totalQuotes, byStatus, revenue, allQuotes] = await Promise.all([
      this.prisma.quote.count({ where }),
      this.prisma.quote.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.quote.aggregate({
        where: {
          ...where,
          status: { in: [QuoteStatus.APPROVED, QuoteStatus.STARTED, QuoteStatus.CONCLUDED] },
        },
        _sum: { total: true },
      }),
      this.prisma.quote.findMany({
        where,
        select: {
          status: true,
          total: true,
        },
      }),
    ]);

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Calculate conversion rate: successful quotes / all quotes that were sent
    const approvedCount =
      (statusCounts[QuoteStatus.APPROVED] || 0) +
      (statusCounts[QuoteStatus.STARTED] || 0) +
      (statusCounts[QuoteStatus.CONCLUDED] || 0);

    // Count all quotes that have been sent (any status >= sent)
    const sentCount =
      (statusCounts[QuoteStatus.SENT] || 0) +
      (statusCounts[QuoteStatus.DELIVERED] || 0) +
      (statusCounts[QuoteStatus.READ] || 0) +
      (statusCounts[QuoteStatus.OPENED] || 0) +
      (statusCounts[QuoteStatus.DOWNLOADED] || 0) +
      (statusCounts[QuoteStatus.APPROVED] || 0) +
      (statusCounts[QuoteStatus.STARTED] || 0) +
      (statusCounts[QuoteStatus.CONCLUDED] || 0) +
      (statusCounts[QuoteStatus.DENIED] || 0) +
      (statusCounts[QuoteStatus.LOST] || 0) +
      (statusCounts[QuoteStatus.EMAIL_FAILED] || 0);

    const conversionRate =
      sentCount > 0 ? (approvedCount / sentCount) * 100 : 0;

    // Calculate new metrics
    const sentStatuses = ['sent', 'delivered', 'read', 'opened', 'downloaded', 'approved', 'started', 'concluded', 'denied', 'lost', 'email_failed'];
    const amountSent = allQuotes
      .filter((q) => sentStatuses.includes(q.status))
      .reduce((sum, q) => sum + Number(q.total || 0), 0);

    const amountLost = allQuotes
      .filter((q) => q.status === 'lost')
      .reduce((sum, q) => sum + Number(q.total || 0), 0);

    const amountDenied = allQuotes
      .filter((q) => q.status === 'denied')
      .reduce((sum, q) => sum + Number(q.total || 0), 0);

    const amountPendingApproval = allQuotes
      .filter((q) => q.status === 'pending_approval')
      .reduce((sum, q) => sum + Number(q.total || 0), 0);

    // Average quote value (excluding drafts)
    const generatedQuotes = allQuotes.filter((q) => q.status !== 'draft');
    const totalGenerated = generatedQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0);
    const avgQuoteValue = generatedQuotes.length > 0 ? totalGenerated / generatedQuotes.length : 0;

    return {
      total_quotes: totalQuotes,
      by_status: statusCounts,
      total_revenue: revenue._sum.total ? Number(revenue._sum.total) : 0,
      avg_quote_value: Math.round(avgQuoteValue * 100) / 100,
      amount_sent: Math.round(amountSent * 100) / 100,
      amount_lost: Math.round(amountLost * 100) / 100,
      amount_denied: Math.round(amountDenied * 100) / 100,
      amount_pending_approval: Math.round(amountPendingApproval * 100) / 100,
      conversion_rate: Math.round(conversionRate * 100) / 100,
    };
  }
}
