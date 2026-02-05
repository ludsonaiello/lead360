import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateQuoteNoteDto, UpdateQuoteNoteDto } from '../dto/notes';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

@Injectable()
export class QuoteNotesService {
  private readonly logger = new Logger(QuoteNotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLoggerService: AuditLoggerService,
  ) {}

  /**
   * Create a note for a quote
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param quoteId - Quote ID
   * @param userId - User performing the action
   * @param noteData - Note details
   * @returns Created note
   */
  async create(
    tenantId: string,
    quoteId: string,
    userId: string,
    noteData: CreateQuoteNoteDto,
  ): Promise<any> {
    // Verify quote exists and belongs to tenant
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        quote_number: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(
        `Quote with ID ${quoteId} not found or access denied`,
      );
    }

    // Validate note text
    if (!noteData.note_text || noteData.note_text.trim().length === 0) {
      throw new BadRequestException('Note text cannot be empty');
    }

    if (noteData.note_text.length > 5000) {
      throw new BadRequestException(
        'Note text cannot exceed 5000 characters',
      );
    }

    const noteId = this.generateUUID();
    const note = await this.prisma.quote_note.create({
      data: {
        id: noteId,
        quote_id: quoteId,
        note_text: noteData.note_text.trim(),
        is_pinned: noteData.is_pinned || false,
        user_id: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // Log to audit log
    await this.auditLoggerService.log({
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'quote',
      entity_id: quoteId,
      action_type: 'note_added',
      description: `Note added to quote ${quote.quote_number}${noteData.is_pinned ? ' (pinned)' : ''}`,
      metadata_json: {
        note_id: note.id,
        note_preview: noteData.note_text.substring(0, 100),
        is_pinned: note.is_pinned,
      },
    });

    return {
      id: note.id,
      quote_id: note.quote_id,
      note_text: note.note_text,
      is_pinned: note.is_pinned,
      user: note.user,
      created_at: note.created_at.toISOString(),
      updated_at: note.updated_at.toISOString(),
    };
  }

  /**
   * Update a note
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param quoteId - Quote ID
   * @param noteId - Note ID
   * @param userId - User performing the action
   * @param updateData - Update data
   * @returns Updated note
   */
  async update(
    tenantId: string,
    quoteId: string,
    noteId: string,
    userId: string,
    updateData: UpdateQuoteNoteDto,
  ): Promise<any> {
    // Verify note exists and belongs to tenant
    const note = await this.prisma.quote_note.findFirst({
      where: {
        id: noteId,
        quote_id: quoteId,
        quote: {
          tenant_id: tenantId,
        },
      },
      include: {
        quote: {
          select: {
            quote_number: true,
          },
        },
      },
    });

    if (!note) {
      throw new NotFoundException(
        `Note with ID ${noteId} not found or access denied`,
      );
    }

    // Validate note text if provided
    if (updateData.note_text !== undefined) {
      if (updateData.note_text.trim().length === 0) {
        throw new BadRequestException('Note text cannot be empty');
      }
      if (updateData.note_text.length > 5000) {
        throw new BadRequestException(
          'Note text cannot exceed 5000 characters',
        );
      }
    }

    const updatedNote = await this.prisma.quote_note.update({
      where: { id: noteId },
      data: {
        note_text: updateData.note_text
          ? updateData.note_text.trim()
          : undefined,
        is_pinned: updateData.is_pinned,
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // Log to audit log
    await this.auditLoggerService.log({
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'quote',
      entity_id: quoteId,
      action_type: 'note_updated',
      description: `Note updated on quote ${(note as any).quote.quote_number}${updatedNote.is_pinned ? ' (pinned)' : ''}`,
      metadata_json: {
        note_id: updatedNote.id,
        changes: updateData,
      },
    });

    return {
      id: updatedNote.id,
      quote_id: updatedNote.quote_id,
      note_text: updatedNote.note_text,
      is_pinned: updatedNote.is_pinned,
      user: updatedNote.user,
      created_at: updatedNote.created_at.toISOString(),
      updated_at: updatedNote.updated_at.toISOString(),
    };
  }

  /**
   * Delete a note
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param quoteId - Quote ID
   * @param noteId - Note ID
   * @param userId - User performing the action
   */
  async delete(
    tenantId: string,
    quoteId: string,
    noteId: string,
    userId: string,
  ): Promise<void> {
    // Verify note exists and belongs to tenant
    const note = await this.prisma.quote_note.findFirst({
      where: {
        id: noteId,
        quote_id: quoteId,
        quote: {
          tenant_id: tenantId,
        },
      },
      include: {
        quote: {
          select: {
            quote_number: true,
          },
        },
      },
    });

    if (!note) {
      throw new NotFoundException(
        `Note with ID ${noteId} not found or access denied`,
      );
    }

    await this.prisma.quote_note.delete({
      where: { id: noteId },
    });

    // Log to audit log
    await this.auditLoggerService.log({
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'quote',
      entity_id: quoteId,
      action_type: 'note_deleted',
      description: `Note deleted from quote ${(note as any).quote.quote_number}`,
      metadata_json: {
        note_id: note.id,
        note_preview: note.note_text.substring(0, 100),
      },
    });
  }

  /**
   * Get all notes for a quote (pinned first)
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param quoteId - Quote ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated notes
   */
  async findAllByQuote(
    tenantId: string,
    quoteId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ notes: any[]; total: number }> {
    const skip = (page - 1) * limit;

    // Verify quote exists and belongs to tenant
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
    });

    if (!quote) {
      throw new NotFoundException(
        `Quote with ID ${quoteId} not found or access denied`,
      );
    }

    const [notes, total] = await Promise.all([
      this.prisma.quote_note.findMany({
        where: {
          quote_id: quoteId,
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
        orderBy: [
          { is_pinned: 'desc' }, // Pinned notes first
          { created_at: 'desc' }, // Then by creation date (newest first)
        ],
        skip,
        take: limit,
      }),
      this.prisma.quote_note.count({
        where: {
          quote_id: quoteId,
        },
      }),
    ]);

    return {
      notes: notes.map((note) => ({
        id: note.id,
        quote_id: note.quote_id,
        note_text: note.note_text,
        is_pinned: note.is_pinned,
        user: note.user,
        created_at: note.created_at.toISOString(),
        updated_at: note.updated_at.toISOString(),
      })),
      total,
    };
  }

  /**
   * Get a single note by ID
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param noteId - Note ID
   * @returns Note or null
   */
  async findOne(tenantId: string, noteId: string): Promise<any | null> {
    const note = await this.prisma.quote_note.findFirst({
      where: {
        id: noteId,
        quote: {
          tenant_id: tenantId,
        },
      },
      include: {
        quote: {
          select: {
            id: true,
            quote_number: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!note) {
      return null;
    }

    return {
      id: note.id,
      quote_id: note.quote_id,
      note_text: note.note_text,
      is_pinned: note.is_pinned,
      user: note.user,
      created_at: note.created_at.toISOString(),
      updated_at: note.updated_at.toISOString(),
    };
  }

  /**
   * Generate UUID v4
   * @returns UUID string
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}
