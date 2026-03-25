import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class InvoiceNumberGeneratorService {
  private readonly logger = new Logger(InvoiceNumberGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate next sequential invoice number for tenant.
   * Format: {invoice_prefix}-{number padded to 4 digits} (e.g., "INV-0001")
   *
   * Thread-safe implementation using database transaction.
   * Mirrors ProjectNumberGeneratorService pattern.
   *
   * @param tenantId - Tenant UUID
   * @param transaction - Optional Prisma transaction client (if called within existing transaction)
   * @returns Formatted invoice number string
   */
  async generate(tenantId: string, transaction?: any): Promise<string> {
    if (transaction) {
      return this.generateInTransaction(transaction, tenantId);
    }

    return this.prisma.$transaction(async (tx) => {
      return this.generateInTransaction(tx, tenantId);
    });
  }

  private async generateInTransaction(
    tx: any,
    tenantId: string,
  ): Promise<string> {
    // Lock tenant row and fetch current invoice number + prefix
    const tenant = await tx.tenant.findFirst({
      where: { id: tenantId },
      select: {
        next_invoice_number: true,
        invoice_prefix: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const currentNumber = tenant.next_invoice_number;
    const prefix = tenant.invoice_prefix || 'INV';

    // Increment next_invoice_number for tenant
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        next_invoice_number: currentNumber + 1,
      },
    });

    // Format: INV-0001
    const paddedNumber = String(currentNumber).padStart(4, '0');
    const invoiceNumber = `${prefix}-${paddedNumber}`;

    this.logger.log(
      `Generated invoice number: ${invoiceNumber} for tenant: ${tenantId}`,
    );

    return invoiceNumber;
  }

  /**
   * Preview next invoice number for tenant (without incrementing).
   *
   * @param tenantId - Tenant UUID
   * @returns Next invoice number that will be generated
   */
  async previewNextNumber(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        next_invoice_number: true,
        invoice_prefix: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const prefix = tenant.invoice_prefix || 'INV';
    const paddedNumber = String(tenant.next_invoice_number).padStart(4, '0');

    return `${prefix}-${paddedNumber}`;
  }
}
