import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateWarrantyTierDto,
  UpdateWarrantyTierDto,
  WarrantyTierResponseDto,
} from '../dto/warranty';
import { randomUUID } from 'crypto';

/**
 * WarrantyTierService
 *
 * Manages warranty tiers for quote items
 *
 * Business Rules:
 * - Multiple tiers allowed per tenant
 * - Price can be fixed or percentage-based
 * - Cannot delete tier if assigned to any quote item
 * - Warranty price adds to item total
 *
 * @author Backend Developer
 */
@Injectable()
export class WarrantyTierService {
  private readonly logger = new Logger(WarrantyTierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create a new warranty tier
   */
  async createTier(
    tenantId: string,
    dto: CreateWarrantyTierDto,
    userId: string,
  ): Promise<WarrantyTierResponseDto> {
    this.logger.log(
      `Creating warranty tier "${dto.tier_name}" for tenant ${tenantId}`,
    );

    const tier = await this.prisma.quote_warranty_tier.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        tier_name: dto.tier_name,
        description: dto.description,
        price_type: dto.price_type,
        price_value: dto.price_value,
        duration_months: dto.duration_months,
        is_active: true,
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'quote_warranty_tier',
      entityId: tier.id,
      tenantId,
      actorUserId: userId,
      after: tier,
      description: `Warranty tier created: ${dto.tier_name}`,
    });

    return this.mapToResponseDto(tier, 0);
  }

  /**
   * List all warranty tiers for a tenant
   */
  async listTiers(
    tenantId: string,
    includeInactive: boolean = false,
  ): Promise<WarrantyTierResponseDto[]> {
    this.logger.log(`Listing warranty tiers for tenant ${tenantId}`);

    const tiers = await this.prisma.quote_warranty_tier.findMany({
      where: {
        tenant_id: tenantId,
        ...(includeInactive ? {} : { is_active: true }),
      },
      include: {
        _count: {
          select: { quote_items: true },
        },
      },
      orderBy: { tier_name: 'asc' },
    });

    return tiers.map((tier) =>
      this.mapToResponseDto(tier, tier._count.quote_items),
    );
  }

  /**
   * Get single warranty tier
   */
  async getTier(
    tenantId: string,
    tierId: string,
  ): Promise<WarrantyTierResponseDto> {
    this.logger.log(`Getting warranty tier ${tierId} for tenant ${tenantId}`);

    const tier = await this.prisma.quote_warranty_tier.findFirst({
      where: {
        id: tierId,
        tenant_id: tenantId,
      },
      include: {
        _count: {
          select: { quote_items: true },
        },
      },
    });

    if (!tier) {
      throw new NotFoundException(`Warranty tier ${tierId} not found`);
    }

    return this.mapToResponseDto(tier, tier._count.quote_items);
  }

  /**
   * Update warranty tier
   */
  async updateTier(
    tenantId: string,
    tierId: string,
    dto: UpdateWarrantyTierDto,
    userId: string,
  ): Promise<WarrantyTierResponseDto> {
    this.logger.log(`Updating warranty tier ${tierId} for tenant ${tenantId}`);

    // Verify tier exists
    const existing = await this.prisma.quote_warranty_tier.findFirst({
      where: {
        id: tierId,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Warranty tier ${tierId} not found`);
    }

    const updated = await this.prisma.quote_warranty_tier.update({
      where: { id: tierId },
      data: {
        ...(dto.tier_name && { tier_name: dto.tier_name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price_type && { price_type: dto.price_type }),
        ...(dto.price_value !== undefined && { price_value: dto.price_value }),
        ...(dto.duration_months && { duration_months: dto.duration_months }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
      include: {
        _count: {
          select: { quote_items: true },
        },
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'quote_warranty_tier',
      entityId: tierId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Warranty tier updated: ${updated.tier_name}`,
    });

    return this.mapToResponseDto(updated, updated._count.quote_items);
  }

  /**
   * Delete warranty tier (only if not assigned)
   */
  async deleteTier(
    tenantId: string,
    tierId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Deleting warranty tier ${tierId} for tenant ${tenantId}`);

    // Verify tier exists
    const existing = await this.prisma.quote_warranty_tier.findFirst({
      where: {
        id: tierId,
        tenant_id: tenantId,
      },
      include: {
        _count: {
          select: { quote_items: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Warranty tier ${tierId} not found`);
    }

    // Check if tier is assigned to any quote items
    if (existing._count.quote_items > 0) {
      throw new BadRequestException(
        `Cannot delete warranty tier that is assigned to ${existing._count.quote_items} quote item(s). Mark as inactive instead.`,
      );
    }

    await this.prisma.quote_warranty_tier.delete({
      where: { id: tierId },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'quote_warranty_tier',
      entityId: tierId,
      tenantId,
      actorUserId: userId,
      before: existing,
      description: `Warranty tier deleted: ${existing.tier_name}`,
    });
  }

  /**
   * Map database entity to response DTO
   */
  private mapToResponseDto(
    tier: any,
    usageCount: number,
  ): WarrantyTierResponseDto {
    return {
      id: tier.id,
      tier_name: tier.tier_name,
      description: tier.description,
      price_type: tier.price_type,
      price_value: parseFloat(tier.price_value),
      duration_months: tier.duration_months,
      is_active: tier.is_active,
      usage_count: usageCount,
      created_at: tier.created_at,
      updated_at: tier.updated_at,
    };
  }
}
