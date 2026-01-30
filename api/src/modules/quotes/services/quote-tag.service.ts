import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateQuoteTagDto,
  UpdateQuoteTagDto,
  QuoteTagResponseDto,
  AssignTagDto,
} from '../dto/tag';
import { randomUUID } from 'crypto';

/**
 * QuoteTagService
 *
 * Manages quote tags for organizing and categorizing quotes
 *
 * Business Rules:
 * - Tag names must be unique per tenant (case-insensitive)
 * - Cannot delete tag if assigned to any quote (mark inactive instead)
 * - Multiple tags can be assigned per quote
 *
 * @author Backend Developer
 */
@Injectable()
export class QuoteTagService {
  private readonly logger = new Logger(QuoteTagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create a new quote tag
   */
  async createTag(
    tenantId: string,
    dto: CreateQuoteTagDto,
    userId: string,
  ): Promise<QuoteTagResponseDto> {
    this.logger.log(`Creating tag "${dto.name}" for tenant ${tenantId}`);

    // Create tag (unique constraint will catch duplicates - MySQL collation is case-insensitive)
    let tag;
    try {
      tag = await this.prisma.quote_tag.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          name: dto.name,
          color: dto.color,
          is_active: true,
        },
      });
    } catch (error) {
      // P2002 = Unique constraint violation
      if (error.code === 'P2002') {
        throw new ConflictException(
          `Tag with name "${dto.name}" already exists`,
        );
      }
      throw error;
    }

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'quote_tag',
      entityId: tag.id,
      tenantId,
      actorUserId: userId,
      after: tag,
      description: `Quote tag created: ${dto.name}`,
    });

    return this.mapToResponseDto(tag, 0);
  }

  /**
   * List all tags for a tenant
   */
  async listTags(
    tenantId: string,
    includeInactive: boolean = false,
  ): Promise<QuoteTagResponseDto[]> {
    this.logger.log(`Listing tags for tenant ${tenantId}`);

    const tags = await this.prisma.quote_tag.findMany({
      where: {
        tenant_id: tenantId,
        ...(includeInactive ? {} : { is_active: true }),
      },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return tags.map((tag) => this.mapToResponseDto(tag, tag._count.assignments));
  }

  /**
   * Get single tag
   */
  async getTag(tenantId: string, tagId: string): Promise<QuoteTagResponseDto> {
    this.logger.log(`Getting tag ${tagId} for tenant ${tenantId}`);

    const tag = await this.prisma.quote_tag.findFirst({
      where: {
        id: tagId,
        tenant_id: tenantId,
      },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException(`Tag ${tagId} not found`);
    }

    return this.mapToResponseDto(tag, tag._count.assignments);
  }

  /**
   * Update tag
   */
  async updateTag(
    tenantId: string,
    tagId: string,
    dto: UpdateQuoteTagDto,
    userId: string,
  ): Promise<QuoteTagResponseDto> {
    this.logger.log(`Updating tag ${tagId} for tenant ${tenantId}`);

    // Verify tag exists
    const existing = await this.prisma.quote_tag.findFirst({
      where: {
        id: tagId,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Tag ${tagId} not found`);
    }

    // Update tag (unique constraint will catch duplicate names - MySQL collation is case-insensitive)
    let updated;
    try {
      updated = await this.prisma.quote_tag.update({
        where: { id: tagId },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.color && { color: dto.color }),
          ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        },
        include: {
          _count: {
            select: { assignments: true },
          },
        },
      });
    } catch (error) {
      // P2002 = Unique constraint violation
      if (error.code === 'P2002') {
        throw new ConflictException(
          `Tag with name "${dto.name}" already exists`,
        );
      }
      throw error;
    }

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'quote_tag',
      entityId: tagId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Quote tag updated: ${updated.name}`,
    });

    return this.mapToResponseDto(updated, updated._count.assignments);
  }

  /**
   * Delete tag (only if not assigned)
   */
  async deleteTag(
    tenantId: string,
    tagId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Deleting tag ${tagId} for tenant ${tenantId}`);

    // Verify tag exists
    const existing = await this.prisma.quote_tag.findFirst({
      where: {
        id: tagId,
        tenant_id: tenantId,
      },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Tag ${tagId} not found`);
    }

    // Check if tag is assigned to any quotes
    if (existing._count.assignments > 0) {
      throw new BadRequestException(
        `Cannot delete tag that is assigned to ${existing._count.assignments} quote(s). Mark as inactive instead.`,
      );
    }

    await this.prisma.quote_tag.delete({
      where: { id: tagId },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'quote_tag',
      entityId: tagId,
      tenantId,
      actorUserId: userId,
      before: existing,
      description: `Quote tag deleted: ${existing.name}`,
    });
  }

  /**
   * Assign tags to a quote
   */
  async assignTagsToQuote(
    tenantId: string,
    quoteId: string,
    dto: AssignTagDto,
    userId: string,
  ): Promise<QuoteTagResponseDto[]> {
    this.logger.log(`Assigning ${dto.tag_ids.length} tags to quote ${quoteId}`);

    // Verify quote exists
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    // Verify all tags exist and belong to tenant
    const tags = await this.prisma.quote_tag.findMany({
      where: {
        id: { in: dto.tag_ids },
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (tags.length !== dto.tag_ids.length) {
      const foundIds = tags.map((t) => t.id);
      const missingIds = dto.tag_ids.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Tags not found or inactive: ${missingIds.join(', ')}`,
      );
    }

    // Delete existing assignments
    await this.prisma.quote_tag_assignment.deleteMany({
      where: { quote_id: quoteId },
    });

    // Create new assignments
    await this.prisma.quote_tag_assignment.createMany({
      data: dto.tag_ids.map((tag_id) => ({
        id: randomUUID(),
        quote_id: quoteId,
        quote_tag_id: tag_id,
      })),
      skipDuplicates: true,
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'quote',
      entityId: quoteId,
      tenantId,
      actorUserId: userId,
      after: { tags_assigned: dto.tag_ids },
      description: `Tags assigned to quote (${dto.tag_ids.length} tags)`,
    });

    return tags.map((tag) => this.mapToResponseDto(tag, 0));
  }

  /**
   * Remove tag from quote
   */
  async removeTagFromQuote(
    tenantId: string,
    quoteId: string,
    tagId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Removing tag ${tagId} from quote ${quoteId}`);

    // Verify quote exists
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    // Delete assignment
    const deleted = await this.prisma.quote_tag_assignment.deleteMany({
      where: {
        quote_id: quoteId,
        quote_tag_id: tagId,
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(
        `Tag ${tagId} is not assigned to quote ${quoteId}`,
      );
    }

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'quote',
      entityId: quoteId,
      tenantId,
      actorUserId: userId,
      after: { tag_removed: tagId },
      description: `Tag removed from quote`,
    });
  }

  /**
   * Get tags assigned to a quote
   */
  async getQuoteTags(
    tenantId: string,
    quoteId: string,
  ): Promise<QuoteTagResponseDto[]> {
    this.logger.log(`Getting tags for quote ${quoteId}`);

    // Verify quote exists
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    const assignments = await this.prisma.quote_tag_assignment.findMany({
      where: { quote_id: quoteId },
      include: {
        quote_tag: {
          include: {
            _count: {
              select: { assignments: true },
            },
          },
        },
      },
    });

    return assignments.map((a) =>
      this.mapToResponseDto(a.quote_tag, a.quote_tag._count.assignments),
    );
  }

  /**
   * Map database entity to response DTO
   */
  private mapToResponseDto(tag: any, usageCount: number): QuoteTagResponseDto {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      is_active: tag.is_active,
      usage_count: usageCount,
      created_at: tag.created_at,
      updated_at: tag.updated_at,
    };
  }
}
