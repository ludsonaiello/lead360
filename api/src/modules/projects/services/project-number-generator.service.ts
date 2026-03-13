import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class ProjectNumberGeneratorService {
  private readonly logger = new Logger(ProjectNumberGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate next sequential project number for tenant.
   * Format: PRJ-{year}-{number padded to 4 digits} (e.g., "PRJ-2026-0001")
   *
   * Thread-safe implementation using database transaction.
   * Mirrors QuoteNumberGeneratorService pattern.
   *
   * @param tenantId - Tenant UUID
   * @param transaction - Optional Prisma transaction client (if called within existing transaction)
   * @returns Formatted project number string
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
    // Lock tenant row and fetch current project number
    const tenant = await tx.tenant.findFirst({
      where: { id: tenantId },
      select: {
        next_project_number: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const currentNumber = tenant.next_project_number;
    const year = new Date().getFullYear();

    // Increment next_project_number for tenant
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        next_project_number: currentNumber + 1,
      },
    });

    // Format: PRJ-2026-0001
    const paddedNumber = String(currentNumber).padStart(4, '0');
    const projectNumber = `PRJ-${year}-${paddedNumber}`;

    this.logger.log(
      `Generated project number: ${projectNumber} for tenant: ${tenantId}`,
    );

    return projectNumber;
  }

  /**
   * Validate project number format.
   * @param projectNumber - Project number to validate
   * @returns true if valid format
   */
  validateFormat(projectNumber: string): boolean {
    const pattern = /^PRJ-\d{4}-\d{4,}$/;
    return pattern.test(projectNumber);
  }

  /**
   * Preview next project number for tenant (without incrementing).
   *
   * @param tenantId - Tenant UUID
   * @returns Next project number that will be generated
   */
  async previewNextNumber(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        next_project_number: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const year = new Date().getFullYear();
    const paddedNumber = String(tenant.next_project_number).padStart(4, '0');

    return `PRJ-${year}-${paddedNumber}`;
  }
}
