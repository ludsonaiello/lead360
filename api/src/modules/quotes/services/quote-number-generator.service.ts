import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class QuoteNumberGeneratorService {
  private readonly logger = new Logger(QuoteNumberGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate next sequential quote number for tenant
   * Format: {prefix}-{year}-{number} (e.g., "Q-2026-001")
   *
   * Thread-safe implementation using database transaction
   *
   * @param tenantId - Tenant UUID
   * @param transaction - Optional Prisma transaction client (if called within existing transaction)
   * @returns Formatted quote number string
   */
  async generate(
    tenantId: string,
    transaction?: any,
  ): Promise<string> {
    // If already in a transaction, use it directly; otherwise create a new one
    if (transaction) {
      return this.generateInTransaction(transaction, tenantId);
    }

    // Use transaction to ensure thread-safety
    return this.prisma.$transaction(async (tx) => {
      return this.generateInTransaction(tx, tenantId);
    });
  }

  private async generateInTransaction(tx: any, tenantId: string): Promise<string> {
    // Lock tenant row and fetch current quote number
    const tenant = await tx.tenant.findFirst({
      where: { id: tenantId },
      select: {
        quote_prefix: true,
        next_quote_number: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const currentNumber = tenant.next_quote_number;
    const prefix = tenant.quote_prefix || 'Q-';
    const year = new Date().getFullYear();

    // Increment next_quote_number for tenant
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        next_quote_number: currentNumber + 1,
      },
    });

    // Format: Q-2026-001
    const paddedNumber = String(currentNumber).padStart(3, '0');
    const quoteNumber = `${prefix}${year}-${paddedNumber}`;

    this.logger.log(
      `Generated quote number: ${quoteNumber} for tenant: ${tenantId}`,
    );

    return quoteNumber;
  }

  /**
   * Validate quote number format
   * @param quoteNumber - Quote number to validate
   * @returns true if valid format
   */
  validateFormat(quoteNumber: string): boolean {
    // Format: {prefix}-{year}-{number}
    // Example: Q-2026-001
    const pattern = /^[A-Z]+-\d{4}-\d{3,}$/;
    return pattern.test(quoteNumber);
  }

  /**
   * Get current next quote number for tenant (without incrementing)
   * Used for preview or validation purposes
   *
   * @param tenantId - Tenant UUID
   * @returns Next quote number that will be generated
   */
  async previewNextNumber(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        quote_prefix: true,
        next_quote_number: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const prefix = tenant.quote_prefix || 'Q-';
    const year = new Date().getFullYear();
    const paddedNumber = String(tenant.next_quote_number).padStart(3, '0');

    return `${prefix}${year}-${paddedNumber}`;
  }
}
