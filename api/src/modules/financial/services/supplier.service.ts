import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  GoogleMapsService,
  PartialAddress,
  ValidatedAddress,
} from '../../leads/services/google-maps.service';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { ListSuppliersDto, SupplierSortBy, SortOrder } from '../dto/list-suppliers.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(tenantId: string, userId: string, dto: CreateSupplierDto) {
    // 1. Case-insensitive name uniqueness (MySQL ci collation handles case matching)
    const existing = await this.prisma.supplier.findFirst({
      where: {
        tenant_id: tenantId,
        name: dto.name,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Supplier "${dto.name}" already exists for this tenant.`,
      );
    }

    // 2. Validate category_ids if provided
    if (dto.category_ids && dto.category_ids.length > 0) {
      const categories = await this.prisma.supplier_category.findMany({
        where: {
          id: { in: dto.category_ids },
          tenant_id: tenantId,
        },
      });
      if (categories.length !== dto.category_ids.length) {
        throw new BadRequestException(
          'One or more category IDs are invalid or do not belong to this tenant.',
        );
      }
    }

    // 3. Google Places / Address resolution
    let resolvedAddress: ValidatedAddress | null = null;

    const hasAddressInfo =
      dto.address_line1 ||
      dto.zip_code ||
      (dto.latitude != null && dto.longitude != null);

    if (hasAddressInfo) {
      try {
        const partialAddress: PartialAddress = {
          address_line1: dto.address_line1 || '',
          address_line2: dto.address_line2,
          city: dto.city,
          state: dto.state,
          zip_code: dto.zip_code || '',
          latitude: dto.latitude,
          longitude: dto.longitude,
        };
        resolvedAddress =
          await this.googleMapsService.validateAddress(partialAddress);
      } catch (error) {
        // If Google Maps fails, log but don't block supplier creation
        // Only throw if explicitly requested via google_place_id
        if (dto.google_place_id) {
          throw new UnprocessableEntityException(
            `Address resolution failed: ${error.message}`,
          );
        }
        this.logger.warn(
          `Address validation failed for supplier "${dto.name}": ${error.message}`,
        );
      }
    }

    // 4. Create supplier in a transaction (with category assignments)
    const supplierId = randomUUID();

    const supplier = await this.prisma.$transaction(async (tx) => {
      const newSupplier = await tx.supplier.create({
        data: {
          id: supplierId,
          tenant_id: tenantId,
          name: dto.name,
          legal_name: dto.legal_name || null,
          website: dto.website || null,
          phone: dto.phone || null,
          email: dto.email || null,
          contact_name: dto.contact_name || null,
          address_line1:
            resolvedAddress?.address_line1 || dto.address_line1 || null,
          address_line2:
            resolvedAddress?.address_line2 || dto.address_line2 || null,
          city: resolvedAddress?.city || dto.city || null,
          state: resolvedAddress?.state || dto.state || null,
          zip_code: resolvedAddress?.zip_code || dto.zip_code || null,
          country: resolvedAddress?.country || dto.country || 'US',
          latitude: resolvedAddress
            ? new Decimal(resolvedAddress.latitude)
            : dto.latitude != null
              ? new Decimal(dto.latitude)
              : null,
          longitude: resolvedAddress
            ? new Decimal(resolvedAddress.longitude)
            : dto.longitude != null
              ? new Decimal(dto.longitude)
              : null,
          google_place_id:
            resolvedAddress?.google_place_id || dto.google_place_id || null,
          notes: dto.notes || null,
          is_preferred: dto.is_preferred || false,
          created_by_user_id: userId,
        },
      });

      // Create category assignments if provided
      if (dto.category_ids && dto.category_ids.length > 0) {
        await tx.supplier_category_assignment.createMany({
          data: dto.category_ids.map((catId) => ({
            id: randomUUID(),
            supplier_id: supplierId,
            supplier_category_id: catId,
            tenant_id: tenantId,
          })),
        });
      }

      return newSupplier;
    });

    // 5. Fetch the full supplier with relations for response
    const fullSupplier = await this.findOne(tenantId, supplierId);

    // 6. Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'supplier',
      entityId: supplierId,
      tenantId,
      actorUserId: userId,
      after: fullSupplier,
      description: `Supplier created: ${supplier.name}`,
    });

    // 7. Return full supplier
    return fullSupplier;
  }

  // ---------------------------------------------------------------------------
  // FIND ALL (Paginated + Filtered)
  // ---------------------------------------------------------------------------

  async findAll(tenantId: string, query: ListSuppliersDto) {
    const {
      search,
      category_id,
      is_active = true,
      is_preferred,
      page = 1,
      limit = 20,
      sort_by = SupplierSortBy.NAME,
      sort_order = SortOrder.ASC,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
      is_active,
    };

    if (is_preferred !== undefined) {
      where.is_preferred = is_preferred;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contact_name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (category_id) {
      where.category_assignments = {
        some: { supplier_category_id: category_id },
      };
    }

    // Build orderBy
    const orderBy: any = {};
    orderBy[sort_by] = sort_order;

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category_assignments: {
            include: {
              supplier_category: {
                select: { id: true, name: true, color: true },
              },
            },
          },
          _count: {
            select: { products: true },
          },
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    // Transform response
    const data = suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      legal_name: s.legal_name,
      phone: s.phone,
      email: s.email,
      contact_name: s.contact_name,
      city: s.city,
      state: s.state,
      is_preferred: s.is_preferred,
      is_active: s.is_active,
      total_spend: s.total_spend,
      last_purchase_date: s.last_purchase_date,
      categories: s.category_assignments.map((a) => ({
        id: a.supplier_category.id,
        name: a.supplier_category.name,
        color: a.supplier_category.color,
      })),
      product_count: s._count.products,
      created_at: s.created_at,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // FIND ONE
  // ---------------------------------------------------------------------------

  async findOne(tenantId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenant_id: tenantId },
      include: {
        category_assignments: {
          include: {
            supplier_category: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        products: {
          where: { is_active: true },
          select: {
            id: true,
            name: true,
            unit_of_measure: true,
            unit_price: true,
            price_last_updated_at: true,
            is_active: true,
          },
          orderBy: { name: 'asc' },
        },
        created_by: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }

    // Transform to flatten categories
    return {
      ...supplier,
      categories: supplier.category_assignments.map((a) => ({
        id: a.supplier_category.id,
        name: a.supplier_category.name,
        color: a.supplier_category.color,
      })),
      category_assignments: undefined, // Remove raw junction data
    };
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    supplierId: string,
    userId: string,
    dto: UpdateSupplierDto,
  ) {
    // 1. Find existing supplier
    const existing = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenant_id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Supplier not found.');
    }

    // 2. Name uniqueness check (if name is changing)
    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.supplier.findFirst({
        where: {
          tenant_id: tenantId,
          name: dto.name,
          id: { not: supplierId },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Supplier "${dto.name}" already exists for this tenant.`,
        );
      }
    }

    // 3. Validate category_ids if provided
    if (dto.category_ids !== undefined) {
      if (dto.category_ids && dto.category_ids.length > 0) {
        const categories = await this.prisma.supplier_category.findMany({
          where: {
            id: { in: dto.category_ids },
            tenant_id: tenantId,
          },
        });
        if (categories.length !== dto.category_ids.length) {
          throw new BadRequestException(
            'One or more category IDs are invalid or do not belong to this tenant.',
          );
        }
      }
    }

    // 4. Address re-resolution (if address fields or google_place_id changed)
    let resolvedAddress: ValidatedAddress | null = null;
    const addressFieldsChanged =
      dto.address_line1 ||
      dto.city ||
      dto.state ||
      dto.zip_code ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined;
    const placeIdChanged =
      dto.google_place_id &&
      dto.google_place_id !== existing.google_place_id;

    if (addressFieldsChanged || placeIdChanged) {
      try {
        const partialAddress: PartialAddress = {
          address_line1: dto.address_line1 || existing.address_line1 || '',
          address_line2:
            dto.address_line2 !== undefined
              ? dto.address_line2
              : existing.address_line2 || undefined,
          city: dto.city || existing.city || undefined,
          state: dto.state || existing.state || undefined,
          zip_code: dto.zip_code || existing.zip_code || '',
          latitude:
            dto.latitude !== undefined
              ? dto.latitude
              : existing.latitude
                ? Number(existing.latitude)
                : undefined,
          longitude:
            dto.longitude !== undefined
              ? dto.longitude
              : existing.longitude
                ? Number(existing.longitude)
                : undefined,
        };
        resolvedAddress =
          await this.googleMapsService.validateAddress(partialAddress);
      } catch (error) {
        this.logger.warn(
          `Address re-validation failed for supplier "${existing.name}": ${error.message}`,
        );
        // Don't block update if address resolution fails — allow manual address
      }
    }

    // 5. Build update data
    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.legal_name !== undefined) updateData.legal_name = dto.legal_name;
    if (dto.website !== undefined) updateData.website = dto.website;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.contact_name !== undefined)
      updateData.contact_name = dto.contact_name;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.is_preferred !== undefined)
      updateData.is_preferred = dto.is_preferred;
    if (dto.country !== undefined) updateData.country = dto.country;
    // Gap fix: UpdateSupplierDto defines is_active but sprint omitted it
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;

    if (resolvedAddress) {
      updateData.address_line1 = resolvedAddress.address_line1;
      updateData.address_line2 = resolvedAddress.address_line2;
      updateData.city = resolvedAddress.city;
      updateData.state = resolvedAddress.state;
      updateData.zip_code = resolvedAddress.zip_code;
      updateData.latitude = new Decimal(resolvedAddress.latitude);
      updateData.longitude = new Decimal(resolvedAddress.longitude);
      updateData.google_place_id = resolvedAddress.google_place_id;
    } else {
      // Manual address fields (no Google resolution)
      if (dto.address_line1 !== undefined)
        updateData.address_line1 = dto.address_line1;
      if (dto.address_line2 !== undefined)
        updateData.address_line2 = dto.address_line2;
      if (dto.city !== undefined) updateData.city = dto.city;
      if (dto.state !== undefined) updateData.state = dto.state;
      if (dto.zip_code !== undefined) updateData.zip_code = dto.zip_code;
      if (dto.latitude !== undefined)
        updateData.latitude =
          dto.latitude != null ? new Decimal(dto.latitude) : null;
      if (dto.longitude !== undefined)
        updateData.longitude =
          dto.longitude != null ? new Decimal(dto.longitude) : null;
      if (dto.google_place_id !== undefined)
        updateData.google_place_id = dto.google_place_id;
    }

    updateData.updated_by_user_id = userId;

    // 6. Update supplier + replace category assignments in transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id: supplierId },
        data: updateData,
      });

      // Replace category assignments if category_ids provided
      if (dto.category_ids !== undefined) {
        // Delete all existing assignments
        await tx.supplier_category_assignment.deleteMany({
          where: { supplier_id: supplierId, tenant_id: tenantId },
        });

        // Create new assignments
        if (dto.category_ids && dto.category_ids.length > 0) {
          await tx.supplier_category_assignment.createMany({
            data: dto.category_ids.map((catId) => ({
              id: randomUUID(),
              supplier_id: supplierId,
              supplier_category_id: catId,
              tenant_id: tenantId,
            })),
          });
        }
      }
    });

    // 7. Fetch and return full supplier
    const updatedSupplier = await this.findOne(tenantId, supplierId);

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'supplier',
      entityId: supplierId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updatedSupplier,
      description: `Supplier updated: ${updatedSupplier.name}`,
    });

    return updatedSupplier;
  }

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  // ---------------------------------------------------------------------------

  async softDelete(
    tenantId: string,
    supplierId: string,
    userId: string,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenant_id: tenantId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }

    const updated = await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        is_active: false,
        updated_by_user_id: userId,
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'supplier',
      entityId: supplierId,
      tenantId,
      actorUserId: userId,
      before: supplier,
      after: updated,
      description: `Supplier soft-deleted: ${supplier.name}`,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // FIND FOR MAP
  // ---------------------------------------------------------------------------

  async findForMap(tenantId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        city: true,
        state: true,
        is_preferred: true,
        total_spend: true,
        category_assignments: {
          include: {
            supplier_category: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
    });

    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      city: s.city,
      state: s.state,
      is_preferred: s.is_preferred,
      total_spend: s.total_spend,
      categories: s.category_assignments.map((a) => ({
        id: a.supplier_category.id,
        name: a.supplier_category.name,
        color: a.supplier_category.color,
      })),
    }));
  }

  // ---------------------------------------------------------------------------
  // GET STATISTICS
  // ---------------------------------------------------------------------------

  async getStatistics(tenantId: string, supplierId: string) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenant_id: tenantId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }

    // Aggregate from financial_entry (source of truth)
    const [
      totalSpendResult,
      transactionCount,
      dateRange,
      spendByCategory,
      spendByMonth,
    ] = await Promise.all([
      // Total spend
      this.prisma.financial_entry.aggregate({
        where: { tenant_id: tenantId, supplier_id: supplierId },
        _sum: { amount: true },
      }),

      // Transaction count
      this.prisma.financial_entry.count({
        where: { tenant_id: tenantId, supplier_id: supplierId },
      }),

      // Date range
      this.prisma.financial_entry.aggregate({
        where: { tenant_id: tenantId, supplier_id: supplierId },
        _min: { entry_date: true },
        _max: { entry_date: true },
      }),

      // Spend by financial category
      this.prisma.financial_entry.groupBy({
        by: ['category_id'],
        where: { tenant_id: tenantId, supplier_id: supplierId },
        _sum: { amount: true },
      }),

      // Spend by month (last 12 months) — raw query for date grouping
      this.prisma.$queryRaw`
        SELECT
          YEAR(entry_date) as year,
          MONTH(entry_date) as month,
          SUM(amount) as total_spend
        FROM financial_entry
        WHERE tenant_id = ${tenantId}
          AND supplier_id = ${supplierId}
          AND entry_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY YEAR(entry_date), MONTH(entry_date)
        ORDER BY year DESC, month DESC
      `,
    ]);

    // Resolve category names for spend_by_category
    let spendByCategoryResolved: any[] = [];
    if (spendByCategory.length > 0) {
      const categoryIds = spendByCategory.map((s) => s.category_id);
      const categories = await this.prisma.financial_category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      });
      const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

      spendByCategoryResolved = spendByCategory.map((s) => ({
        category_name: categoryMap.get(s.category_id) || 'Unknown',
        total_spend: s._sum.amount || 0,
      }));
    }

    return {
      supplier_id: supplierId,
      total_spend: totalSpendResult._sum.amount || 0,
      transaction_count: transactionCount,
      last_purchase_date: dateRange._max.entry_date || null,
      first_purchase_date: dateRange._min.entry_date || null,
      spend_by_category: spendByCategoryResolved,
      spend_by_month: spendByMonth,
    };
  }

  // ---------------------------------------------------------------------------
  // UPDATE SPEND TOTALS (called by FinancialEntryService)
  // ---------------------------------------------------------------------------

  async updateSpendTotals(tenantId: string, supplierId: string) {
    // Use Prisma aggregate — NOT loading all entries and summing in JavaScript
    const [spendResult, lastPurchase] = await Promise.all([
      this.prisma.financial_entry.aggregate({
        where: { tenant_id: tenantId, supplier_id: supplierId },
        _sum: { amount: true },
      }),
      this.prisma.financial_entry.aggregate({
        where: { tenant_id: tenantId, supplier_id: supplierId },
        _max: { entry_date: true },
      }),
    ]);

    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        total_spend: spendResult._sum.amount || new Decimal(0),
        last_purchase_date: lastPurchase._max.entry_date || null,
      },
    });
  }
}
