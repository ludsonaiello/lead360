import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LeadActivitiesService, ActivityType } from './lead-activities.service';

export interface CreateNoteDto {
  note_text: string;
  is_pinned?: boolean;
}

export interface UpdateNoteDto {
  note_text?: string;
  is_pinned?: boolean;
}

@Injectable()
export class LeadNotesService {
  private readonly logger = new Logger(LeadNotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: LeadActivitiesService,
  ) {}

  /**
   * Create a note for a lead
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param userId - User performing the action
   * @param noteData - Note details
   * @returns Created note
   */
  async create(
    tenantId: string,
    leadId: string,
    userId: string,
    noteData: CreateNoteDto,
  ): Promise<any> {
    // Verify lead exists and belongs to tenant
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenant_id: tenantId,
      },
    });

    if (!lead) {
      throw new NotFoundException(
        `Lead with ID ${leadId} not found or access denied`,
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
    const note = await this.prisma.lead_note.create({
      data: {
        id: noteId,
        lead_id: leadId,
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

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.NOTE_ADDED,
      description: `Note added${noteData.is_pinned ? ' (pinned)' : ''}`,
      user_id: userId,
      metadata: {
        note_id: note.id,
        note_preview: noteData.note_text.substring(0, 100),
        is_pinned: note.is_pinned,
      },
    });

    return note;
  }

  /**
   * Update a note
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param noteId - Note ID
   * @param userId - User performing the action
   * @param updateData - Update data
   * @returns Updated note
   */
  async update(
    tenantId: string,
    leadId: string,
    noteId: string,
    userId: string,
    updateData: UpdateNoteDto,
  ): Promise<any> {
    // Verify note exists and belongs to tenant
    const note = await this.prisma.lead_note.findFirst({
      where: {
        id: noteId,
        lead_id: leadId,
        lead: {
          tenant_id: tenantId,
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

    const updatedNote = await this.prisma.lead_note.update({
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

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.NOTE_UPDATED,
      description: `Note updated${updatedNote.is_pinned ? ' (pinned)' : ''}`,
      user_id: userId,
      metadata: {
        note_id: updatedNote.id,
        changes: updateData,
      },
    });

    return updatedNote;
  }

  /**
   * Delete a note
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param noteId - Note ID
   * @param userId - User performing the action
   */
  async delete(
    tenantId: string,
    leadId: string,
    noteId: string,
    userId: string,
  ): Promise<void> {
    // Verify note exists and belongs to tenant
    const note = await this.prisma.lead_note.findFirst({
      where: {
        id: noteId,
        lead_id: leadId,
        lead: {
          tenant_id: tenantId,
        },
      },
    });

    if (!note) {
      throw new NotFoundException(
        `Note with ID ${noteId} not found or access denied`,
      );
    }

    await this.prisma.lead_note.delete({
      where: { id: noteId },
    });

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.NOTE_DELETED,
      description: 'Note deleted',
      user_id: userId,
      metadata: {
        note_id: note.id,
        note_preview: note.note_text.substring(0, 100),
      },
    });
  }

  /**
   * Get all notes for a lead (pinned first)
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated notes
   */
  async findAllByLead(
    tenantId: string,
    leadId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: any[]; meta: any }> {
    const skip = (page - 1) * limit;

    const [notes, total] = await Promise.all([
      this.prisma.lead_note.findMany({
        where: {
          lead_id: leadId,
          lead: {
            tenant_id: tenantId,
          },
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
      this.prisma.lead_note.count({
        where: {
          lead_id: leadId,
          lead: {
            tenant_id: tenantId,
          },
        },
      }),
    ]);

    return {
      data: notes,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single note by ID
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param noteId - Note ID
   * @returns Note or null
   */
  async findOne(tenantId: string, noteId: string): Promise<any | null> {
    return this.prisma.lead_note.findFirst({
      where: {
        id: noteId,
        lead: {
          tenant_id: tenantId,
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
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
