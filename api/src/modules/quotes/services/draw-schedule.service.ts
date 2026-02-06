import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuoteVersionService } from './quote-version.service';
import { CreateDrawScheduleDto } from '../dto/draw-schedule';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';

@Injectable()
export class DrawScheduleService {
  private readonly logger = new Logger(DrawScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly versionService: QuoteVersionService,
  ) {}

  /**
   * Create draw schedule
   * Validates:
   * - Percentage entries sum to 100%
   * - Fixed amount entries sum close to quote total (±5% warning)
   * - Draw numbers are sequential (1, 2, 3...)
   * Replaces existing schedule if any
   *
   * @param quoteId - Quote UUID
   * @param dto - Create draw schedule DTO
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @returns Created draw schedule entries
   */
  async create(
    quoteId: string,
    dto: CreateDrawScheduleDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Validate entries sum
    const sum = dto.entries.reduce((total, entry) => total + entry.value, 0);

    if (dto.calculation_type === 'percentage') {
      // Percentage entries must sum to 100% (allow 0.01% tolerance for rounding)
      if (Math.abs(sum - 100) > 0.01) {
        throw new BadRequestException(
          `Percentage entries must sum to 100% (current sum: ${sum}%)`,
        );
      }
    } else {
      // Fixed amount - warn if sum differs from total by >5%
      const quoteTotal = Number(quote.total);
      const variance = Math.abs(sum - quoteTotal) / quoteTotal;
      if (variance > 0.05) {
        this.logger.warn(
          `Draw schedule sum ($${sum}) differs from quote total ($${quoteTotal}) by ${(variance * 100).toFixed(2)}%`,
        );
      }
    }

    // Validate sequential draw numbers
    const sortedEntries = [...dto.entries].sort(
      (a, b) => a.draw_number - b.draw_number,
    );
    for (let i = 0; i < sortedEntries.length; i++) {
      if (sortedEntries[i].draw_number !== i + 1) {
        throw new BadRequestException(
          'Draw numbers must be sequential starting from 1',
        );
      }
    }

    // Transaction: Delete existing + Create new
    const entries = await this.prisma.$transaction(async (tx) => {
      // Delete existing entries
      await tx.draw_schedule_entry.deleteMany({
        where: { quote_id: quoteId },
      });

      // Create new entries
      const createdEntries = await Promise.all(
        dto.entries.map((entry) =>
          tx.draw_schedule_entry.create({
            data: {
              id: uuid(),
              quote_id: quoteId,
              draw_number: entry.draw_number,
              description: entry.description,
              calculation_type: dto.calculation_type,
              value: new Decimal(entry.value),
              order_index: entry.draw_number,
            },
          }),
        ),
      );

      // Create version
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Draw schedule created (${dto.calculation_type})`,
        userId,
        tx,
      );

      this.logger.log(`Draw schedule created for quote: ${quoteId}`);

      return createdEntries;
    });

    return entries.map((entry) => ({
      id: entry.id,
      quote_id: entry.quote_id,
      draw_number: entry.draw_number,
      description: entry.description,
      calculation_type: entry.calculation_type,
      value: Number(entry.value),
      order_index: entry.order_index,
      created_at: entry.created_at,
    }));
  }

  /**
   * Get draw schedule for quote
   * Calculates amounts based on current quote total
   * Returns validation info (sum, variance, etc.)
   *
   * @param quoteId - Quote UUID
   * @param tenantId - Tenant UUID
   * @returns Draw schedule with calculated amounts
   */
  async findByQuote(quoteId: string, tenantId: string): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: {
        draw_schedule: {
          orderBy: { draw_number: 'asc' },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.draw_schedule.length === 0) {
      return {
        quote_id: quoteId,
        quote_total: Number(quote.total),
        calculation_type: null,
        entries: [],
        validation: {
          is_valid: true,
          percentage_sum: null,
          amount_sum: null,
          variance: null,
        },
      };
    }

    // Calculate amounts and running totals
    let runningTotal = new Decimal(0);
    const calculationType = quote.draw_schedule[0].calculation_type;

    const entries = quote.draw_schedule.map((entry) => {
      // Calculate amount based on type
      const calculatedAmount =
        entry.calculation_type === 'percentage'
          ? quote.total.mul(entry.value).div(100)
          : entry.value;

      runningTotal = runningTotal.add(calculatedAmount);

      return {
        id: entry.id,
        draw_number: entry.draw_number,
        description: entry.description,
        value: Number(entry.value),
        calculated_amount: Number(calculatedAmount),
        running_total: Number(runningTotal),
        percentage_of_total: Number(
          runningTotal.div(quote.total).mul(100).toDecimalPlaces(2),
        ),
        created_at: entry.created_at,
      };
    });

    // Calculate validation info
    const valueSum = entries.reduce((total, e) => total + e.value, 0);
    const amountSum = entries.reduce(
      (total, e) => total + e.calculated_amount,
      0,
    );
    const quoteTotal = Number(quote.total);

    let isValid = false;
    if (calculationType === 'percentage') {
      isValid = Math.abs(valueSum - 100) < 0.01;
    } else {
      isValid = Math.abs(amountSum - quoteTotal) / quoteTotal <= 0.05;
    }

    return {
      quote_id: quoteId,
      quote_total: quoteTotal,
      calculation_type: calculationType,
      entries,
      validation: {
        is_valid: isValid,
        percentage_sum: calculationType === 'percentage' ? valueSum : null,
        amount_sum: amountSum,
        variance: amountSum - quoteTotal,
        variance_percent: ((amountSum - quoteTotal) / quoteTotal) * 100,
      },
    };
  }

  /**
   * Update draw schedule (replaces entire schedule)
   * Same as create - deletes existing and creates new
   *
   * @param quoteId - Quote UUID
   * @param dto - Create draw schedule DTO
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @returns Updated draw schedule entries
   */
  async update(
    quoteId: string,
    dto: CreateDrawScheduleDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    // Same logic as create (replaces entire schedule)
    return this.create(quoteId, dto, tenantId, userId);
  }

  /**
   * Delete draw schedule
   * Hard deletes all entries for quote
   *
   * @param quoteId - Quote UUID
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   */
  async delete(
    quoteId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete all entries
      await tx.draw_schedule_entry.deleteMany({
        where: { quote_id: quoteId },
      });

      // Create version
      await this.versionService.createVersion(
        quoteId,
        0.1,
        'Draw schedule removed',
        userId,
        tx,
      );

      this.logger.log(`Draw schedule deleted for quote: ${quoteId}`);
    });
  }
}
