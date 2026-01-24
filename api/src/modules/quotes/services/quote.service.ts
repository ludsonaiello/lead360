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
import { QuoteNumberGeneratorService } from './quote-number-generator.service';
import { QuoteJobsiteAddressService } from './quote-jobsite-address.service';
import { QuoteVersionService } from './quote-version.service';
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

    return await this.prisma.$transaction(async (tx) => {
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

      // 4. Set expiration days (default 30)
      const expirationDays = dto.expiration_days || 30;

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

      // 7. Update lead status to "prospect"
      await this.leadsService.updateStatus(tenantId, leadId, userId, {
        status: 'prospect',
      });

      // 8. Log audit trail
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

      return this.findOne(tenantId, quote.id);
    });
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
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create lead via LeadsService
      const lead = await this.leadsService.create(tenantId, userId, {
        first_name: dto.customer.first_name,
        last_name: dto.customer.last_name,
        emails: [{ email: dto.customer.email, is_primary: true }],
        phones: [{ phone: dto.customer.phone, is_primary: true }],
        addresses: [],
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

      // 5. Set expiration days (default 30)
      const expirationDays = dto.expiration_days || 30;

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

      return this.findOne(tenantId, quote.id);
    });
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

    return await this.prisma.$transaction(async (tx) => {
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

      // 4. Set expiration days (default 30)
      const expirationDays = dto.expiration_days || 30;

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

      // 7. Update lead status to prospect
      await this.leadsService.updateStatus(tenantId, dto.lead_id, userId, {
        status: 'prospect',
      });

      // 8. Log audit trail
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

      return this.findOne(tenantId, quote.id);
    });
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
        where.created_at.gte = new Date(created_from);
      }
      if (created_to) {
        where.created_at.lte = new Date(created_to);
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
              { company_name: { contains: search } },
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

    return await this.prisma.$transaction(async (tx) => {
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

      if (dto.vendor_id) updateData.vendor_id = dto.vendor_id;
      if (dto.title) updateData.title = dto.title;
      if (dto.po_number !== undefined) updateData.po_number = dto.po_number;
      if (dto.expiration_date) updateData.expiration_date = new Date(dto.expiration_date);
      if (dto.custom_profit_percent !== undefined)
        updateData.custom_profit_percent = dto.custom_profit_percent
          ? new Decimal(dto.custom_profit_percent)
          : null;
      if (dto.custom_overhead_percent !== undefined)
        updateData.custom_overhead_percent = dto.custom_overhead_percent
          ? new Decimal(dto.custom_overhead_percent)
          : null;
      if (dto.show_line_items !== undefined)
        updateData.show_line_items = dto.show_line_items;
      if (dto.show_cost_breakdown !== undefined)
        updateData.show_cost_breakdown = dto.show_cost_breakdown;
      if (dto.internal_notes !== undefined)
        updateData.internal_notes = dto.internal_notes;
      if (dto.customer_notes !== undefined)
        updateData.customer_notes = dto.customer_notes;
      if (dto.payment_terms !== undefined)
        updateData.payment_terms = dto.payment_terms;
      if (dto.payment_schedule !== undefined)
        updateData.payment_schedule = dto.payment_schedule;

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

      return this.findOne(tenantId, quoteId);
    });
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
      draft: ['ready'],
      ready: ['sent', 'draft'],
      sent: ['read', 'ready'],
      read: ['approved', 'denied', 'lost', 'sent'],
      approved: [], // Cannot change from approved
      denied: ['draft'], // Can reopen
      lost: ['draft'], // Can reopen
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

    return await this.prisma.$transaction(async (tx) => {
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

      return this.findOne(tenantId, quoteId);
    });
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

    return await this.prisma.$transaction(async (tx) => {
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

      return this.findOne(tenantId, quoteId);
    });
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

    return await this.prisma.$transaction(async (tx) => {
      // 1. Clone jobsite address
      const newAddress = await this.jobsiteAddressService.clone(
        tenantId,
        sourceQuote.jobsite_address_id,
        tx,
      );

      // 2. Generate new quote number
      const newQuoteNumber = await this.quoteNumberService.generate(tenantId, tx);

      // 3. Create new quote
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

      return this.findOne(tenantId, newQuote.id);
    });
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
   * Get quote statistics for tenant
   *
   * @param tenantId - Tenant UUID
   * @returns Aggregated statistics
   */
  async getStatistics(tenantId: string): Promise<any> {
    const [totalQuotes, byStatus, revenue] = await Promise.all([
      this.prisma.quote.count({
        where: { tenant_id: tenantId, is_archived: false },
      }),
      this.prisma.quote.groupBy({
        by: ['status'],
        where: { tenant_id: tenantId, is_archived: false },
        _count: { id: true },
      }),
      this.prisma.quote.aggregate({
        where: {
          tenant_id: tenantId,
          is_archived: false,
          status: QuoteStatus.APPROVED,
        },
        _sum: { total: true },
      }),
    ]);

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const approvedCount = statusCounts[QuoteStatus.APPROVED] || 0;
    const sentCount = statusCounts[QuoteStatus.SENT] || 0;
    const conversionRate =
      sentCount > 0 ? (approvedCount / sentCount) * 100 : 0;

    return {
      total_quotes: totalQuotes,
      by_status: statusCounts,
      total_revenue: revenue._sum.total ? Number(revenue._sum.total) : 0,
      conversion_rate: Math.round(conversionRate * 100) / 100,
    };
  }
}
