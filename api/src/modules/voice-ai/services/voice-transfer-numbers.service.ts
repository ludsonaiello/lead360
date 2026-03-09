import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, tenant_voice_transfer_number } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateTransferNumberDto } from '../dto/create-transfer-number.dto';
import { UpdateTransferNumberDto } from '../dto/update-transfer-number.dto';
import { ReorderItemDto } from '../dto/reorder-transfer-numbers.dto';

/**
 * VoiceTransferNumbersService
 *
 * Manages per-tenant call transfer destinations.
 * Each tenant may have up to 10 transfer numbers.
 *
 * Security rules:
 *   - All operations scope queries to `tenant_id` — cross-tenant access is impossible by design
 *   - is_default uniqueness is enforced in a transaction: unsetting old default before setting new one
 *   - reorder() verifies ALL supplied IDs belong to the tenant before writing
 *
 * Used by:
 *   - VoiceTransferNumbersController (B05)
 *   - VoiceAiContextBuilderService (B04 → updated in B05)
 */
@Injectable()
export class VoiceTransferNumbersService {
  private readonly MAX_TRANSFER_NUMBERS = 10;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all active transfer numbers for a tenant, ordered by display_order ASC then created_at ASC.
   */
  async findAll(tenantId: string): Promise<tenant_voice_transfer_number[]> {
    return this.prisma.tenant_voice_transfer_number.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  /**
   * Get a single transfer number by ID.
   *
   * @throws NotFoundException if the record does not exist or belongs to a different tenant
   */
  async findById(
    tenantId: string,
    id: string,
  ): Promise<tenant_voice_transfer_number> {
    return this.findOneOrFail(tenantId, id);
  }

  /**
   * Create a new transfer number for the tenant.
   *
   * Enforces max 10 per tenant.
   * If is_default is true, unsets any existing default first (within a transaction).
   *
   * @throws BadRequestException if tenant already has 10 transfer numbers
   */
  async create(
    tenantId: string,
    dto: CreateTransferNumberDto,
  ): Promise<tenant_voice_transfer_number> {
    const count = await this.prisma.tenant_voice_transfer_number.count({
      where: { tenant_id: tenantId, is_active: true },
    });

    if (count >= this.MAX_TRANSFER_NUMBERS) {
      throw new BadRequestException(
        `Maximum of ${this.MAX_TRANSFER_NUMBERS} transfer numbers per tenant has been reached.`,
      );
    }

    if (dto.is_default === true) {
      return this.prisma.$transaction(async (tx) => {
        await this.ensureSingleDefault(tenantId, tx);
        return tx.tenant_voice_transfer_number.create({
          data: {
            tenant_id: tenantId,
            label: dto.label,
            phone_number: dto.phone_number,
            transfer_type: dto.transfer_type ?? 'primary',
            description: dto.description,
            is_default: true,
            available_hours: dto.available_hours,
            display_order: dto.display_order ?? 0,
          },
        });
      });
    }

    return this.prisma.tenant_voice_transfer_number.create({
      data: {
        tenant_id: tenantId,
        label: dto.label,
        phone_number: dto.phone_number,
        transfer_type: dto.transfer_type ?? 'primary',
        description: dto.description,
        is_default: dto.is_default ?? false,
        available_hours: dto.available_hours,
        display_order: dto.display_order ?? 0,
      },
    });
  }

  /**
   * Update an existing transfer number.
   *
   * If is_default is set to true, unsets any existing default first (within a transaction).
   *
   * @throws NotFoundException if the record does not exist or belongs to a different tenant
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateTransferNumberDto,
  ): Promise<tenant_voice_transfer_number> {
    await this.findOneOrFail(tenantId, id);

    if (dto.is_default === true) {
      return this.prisma.$transaction(async (tx) => {
        await this.ensureSingleDefault(tenantId, tx);
        return tx.tenant_voice_transfer_number.update({
          where: { id },
          data: dto,
        });
      });
    }

    return this.prisma.tenant_voice_transfer_number.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Soft-delete a transfer number by setting is_active = false.
   *
   * @throws NotFoundException if the record does not exist or belongs to a different tenant
   */
  async deactivate(
    tenantId: string,
    id: string,
  ): Promise<tenant_voice_transfer_number> {
    await this.findOneOrFail(tenantId, id);
    return this.prisma.tenant_voice_transfer_number.update({
      where: { id },
      data: { is_active: false },
    });
  }

  /**
   * Bulk-update display_order for multiple transfer numbers in a single transaction.
   *
   * Verifies ALL supplied IDs belong to the tenant before writing any updates.
   * Returns the full updated list ordered by display_order ASC.
   *
   * @throws BadRequestException if any supplied ID does not belong to the tenant
   */
  async reorder(
    tenantId: string,
    items: ReorderItemDto[],
  ): Promise<tenant_voice_transfer_number[]> {
    const ids = items.map((item) => item.id);

    // Reject duplicate IDs upfront — SQL IN deduplicates, making the ownership
    // check unreliable (e.g. ['a','a'] → existing.length=1, ids.length=2 → wrong error).
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException(
        'Duplicate transfer number IDs are not allowed in a reorder request.',
      );
    }

    // Verify all IDs belong to this tenant in one query
    const existing = await this.prisma.tenant_voice_transfer_number.findMany({
      where: { tenant_id: tenantId, id: { in: ids } },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      const foundIds = new Set(existing.map((r) => r.id));
      const invalid = ids.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `The following transfer number IDs do not belong to your account: ${invalid.join(', ')}`,
      );
    }

    // Bulk-update in a single transaction
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.tenant_voice_transfer_number.update({
          where: { id: item.id },
          data: { display_order: item.display_order },
        }),
      ),
    );

    return this.findAll(tenantId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Assert that a transfer number exists and belongs to the given tenant.
   *
   * @throws NotFoundException if the record is not found or belongs to a different tenant
   */
  private async findOneOrFail(
    tenantId: string,
    id: string,
  ): Promise<tenant_voice_transfer_number> {
    const record = await this.prisma.tenant_voice_transfer_number.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!record) {
      throw new NotFoundException(`Transfer number with ID "${id}" not found.`);
    }

    return record;
  }

  /**
   * Unset is_default for all transfer numbers belonging to the tenant.
   * Called inside a transaction before setting a new default.
   */
  private async ensureSingleDefault(
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.tenant_voice_transfer_number.updateMany({
      where: { tenant_id: tenantId, is_default: true },
      data: { is_default: false },
    });
  }
}
