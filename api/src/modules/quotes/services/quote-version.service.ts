import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { v4 as uuid } from 'uuid';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class QuoteVersionService {
  private readonly logger = new Logger(QuoteVersionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create initial version (v1.0) when quote is first created
   *
   * @param quoteId - Quote UUID
   * @param quoteData - Complete quote data for snapshot
   * @param transaction - Optional Prisma transaction client
   */
  async createInitialVersion(
    quoteId: string,
    quoteData: any,
    transaction?: any,
  ): Promise<void> {
    const prismaClient = transaction || this.prisma;

    const snapshot = await this.buildSnapshot(quoteId, prismaClient);

    await prismaClient.quote_version.create({
      data: {
        id: uuid(),
        quote_id: quoteId,
        version_number: new Decimal(1.0),
        change_summary: 'Initial version',
        snapshot_data: JSON.stringify(snapshot),
      },
    });

    this.logger.log(`Created initial version 1.0 for quote: ${quoteId}`);
  }

  /**
   * Create new version with incremental change
   *
   * @param quoteId - Quote UUID
   * @param increment - Version increment (0.1 for minor, 1.0 for major)
   * @param changeDescription - Description of what changed
   * @param userId - User who made the change
   * @param transaction - Optional Prisma transaction client
   */
  async createVersion(
    quoteId: string,
    increment: number,
    changeDescription: string,
    userId: string,
    transaction?: any,
  ): Promise<void> {
    const prismaClient = transaction || this.prisma;

    // Get current version number from quote
    const quote = await prismaClient.quote.findUnique({
      where: { id: quoteId },
      select: { active_version_number: true },
    });

    if (!quote) {
      throw new Error(`Quote not found: ${quoteId}`);
    }

    const currentVersion = Number(quote.active_version_number);
    const newVersion = this.calculateNewVersion(currentVersion, increment);

    // Build complete snapshot
    const snapshot = await this.buildSnapshot(quoteId, prismaClient);

    // Create version record
    await prismaClient.quote_version.create({
      data: {
        id: uuid(),
        quote_id: quoteId,
        version_number: new Decimal(newVersion),
        change_summary: changeDescription,
        snapshot_data: JSON.stringify(snapshot),
      },
    });

    // Update quote's active_version_number
    await prismaClient.quote.update({
      where: { id: quoteId },
      data: { active_version_number: new Decimal(newVersion) },
    });

    this.logger.log(
      `Created version ${newVersion} for quote ${quoteId}: ${changeDescription}`,
    );
  }

  /**
   * Build complete snapshot of quote state
   *
   * Includes:
   * - Quote details
   * - Jobsite address
   * - All items (with groups)
   * - All groups
   * - Discount rules
   * - Draw schedule
   *
   * @param quoteId - Quote UUID
   * @param prismaClient - Prisma client (supports transactions)
   * @returns Complete quote snapshot object
   */
  async buildSnapshot(quoteId: string, prismaClient: any): Promise<any> {
    const quote = await prismaClient.quote.findUnique({
      where: { id: quoteId },
      include: {
        jobsite_address: true,
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        items: {
          include: {
            unit_measurement: {
              select: {
                id: true,
                name: true,
                abbreviation: true,
              },
            },
            quote_group: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
          orderBy: { order_index: 'asc' },
        },
        groups: {
          include: {
            items: {
              include: {
                unit_measurement: {
                  select: {
                    id: true,
                    name: true,
                    abbreviation: true,
                  },
                },
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
      },
    });

    if (!quote) {
      throw new Error(`Quote not found: ${quoteId}`);
    }

    // Convert Decimal fields to numbers for JSON serialization
    const snapshot = {
      quote: {
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
      },
      jobsite_address: quote.jobsite_address
        ? {
            ...quote.jobsite_address,
            latitude: Number(quote.jobsite_address.latitude),
            longitude: Number(quote.jobsite_address.longitude),
          }
        : null,
      vendor: quote.vendor,
      lead: quote.lead,
      items: quote.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        material_cost_per_unit: Number(item.material_cost_per_unit),
        labor_cost_per_unit: Number(item.labor_cost_per_unit),
        equipment_cost_per_unit: Number(item.equipment_cost_per_unit),
        subcontract_cost_per_unit: Number(item.subcontract_cost_per_unit),
        other_cost_per_unit: Number(item.other_cost_per_unit),
        total_cost: Number(item.total_cost),
      })),
      groups: quote.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          material_cost_per_unit: Number(item.material_cost_per_unit),
          labor_cost_per_unit: Number(item.labor_cost_per_unit),
          equipment_cost_per_unit: Number(item.equipment_cost_per_unit),
          subcontract_cost_per_unit: Number(item.subcontract_cost_per_unit),
          other_cost_per_unit: Number(item.other_cost_per_unit),
          total_cost: Number(item.total_cost),
        })),
      })),
      discount_rules: quote.discount_rules.map((rule) => ({
        ...rule,
        discount_value: Number(rule.discount_value),
      })),
      draw_schedule: quote.draw_schedule.map((draw) => ({
        ...draw,
        percentage: Number(draw.percentage),
        amount: Number(draw.amount),
      })),
    };

    return snapshot;
  }

  /**
   * Calculate new version number based on increment
   *
   * @param currentVersion - Current version number
   * @param increment - Increment amount (0.1 or 1.0)
   * @returns New version number
   */
  private calculateNewVersion(
    currentVersion: number,
    increment: number,
  ): number {
    if (increment >= 1.0) {
      // Major version change: round up to next major version
      return Math.ceil(currentVersion) + 1.0;
    } else {
      // Minor version change: add 0.1
      return Math.round((currentVersion + increment) * 10) / 10;
    }
  }

  /**
   * Get all versions for a quote
   *
   * @param quoteId - Quote UUID
   * @returns Array of quote_version records
   */
  async getVersionHistory(quoteId: string): Promise<any[]> {
    const versions = await this.prisma.quote_version.findMany({
      where: { quote_id: quoteId },
      orderBy: { created_at: 'desc' },
    });

    return versions.map((version) => ({
      ...version,
      version_number: Number(version.version_number),
      snapshot_data: JSON.parse(version.snapshot_data as string),
    }));
  }

  /**
   * Get specific version
   *
   * @param versionId - Version UUID
   * @returns quote_version record with parsed snapshot
   */
  async getVersion(versionId: string): Promise<any> {
    const version = await this.prisma.quote_version.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    return {
      ...version,
      version_number: Number(version.version_number),
      snapshot_data: JSON.parse(version.snapshot_data as string),
    };
  }
}
