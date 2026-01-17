import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LeadActivitiesService, ActivityType } from './lead-activities.service';
import {
  CreateEmailDto,
  UpdateEmailDto,
} from '../dto/lead.dto';

@Injectable()
export class LeadEmailsService {
  private readonly logger = new Logger(LeadEmailsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: LeadActivitiesService,
  ) {}

  /**
   * Create multiple emails for a lead (used during lead creation)
   * @param leadId - Lead ID
   * @param emails - Array of email objects
   * @param prismaClient - Optional Prisma transaction client
   * @returns Created emails
   */
  async createMultiple(
    leadId: string,
    emails: CreateEmailDto[],
    prismaClient?: any,
  ): Promise<any[]> {
    if (!emails || emails.length === 0) {
      return [];
    }

    // Use transaction client if provided, otherwise use default prisma
    const client = prismaClient || this.prisma;

    // Validate at least one is primary if multiple emails provided
    const primaryCount = emails.filter((e) => e.is_primary).length;
    if (emails.length > 1 && primaryCount === 0) {
      // Auto-set first email as primary
      emails[0].is_primary = true;
    } else if (primaryCount > 1) {
      throw new BadRequestException(
        'Only one email can be marked as primary',
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const emailData of emails) {
      if (!emailRegex.test(emailData.email)) {
        throw new BadRequestException(
          `Invalid email format: ${emailData.email}`,
        );
      }
    }

    const createdEmails = await Promise.all(
      emails.map(async (emailData) => {
        const emailId = this.generateUUID();
        return client.lead_email.create({
          data: {
            id: emailId,
            lead_id: leadId,
            email: emailData.email.toLowerCase().trim(),
            // email_type not in schema,
            is_primary: emailData.is_primary || false,
          },
        });
      }),
    );

    return createdEmails;
  }

  /**
   * Create a single email for a lead
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param userId - User performing the action (for activity logging)
   * @param emailData - Email details
   * @returns Created email
   */
  async create(
    tenantId: string,
    leadId: string,
    userId: string,
    emailData: CreateEmailDto,
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.email)) {
      throw new BadRequestException(
        `Invalid email format: ${emailData.email}`,
      );
    }

    // If setting as primary, unset other primary emails
    if (emailData.is_primary) {
      await this.prisma.lead_email.updateMany({
        where: {
          lead_id: leadId,
          is_primary: true,
        },
        data: {
          is_primary: false,
        },
      });
    } else {
      // If this is the first email, make it primary automatically
      const existingEmailsCount = await this.prisma.lead_email.count({
        where: { lead_id: leadId },
      });
      if (existingEmailsCount === 0) {
        emailData.is_primary = true;
      }
    }

    const emailId = this.generateUUID();
    const email = await this.prisma.lead_email.create({
      data: {
        id: emailId,
        lead_id: leadId,
        email: emailData.email.toLowerCase().trim(),
        // email_type not in schema,
        is_primary: emailData.is_primary || false,
      },
    });

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.EMAIL_ADDED,
      description: `Email ${email.email} (${"personal"}) added`,
      user_id: userId,
      metadata: {
        email_id: email.id,
        email: email.email,
        email_type: "personal",
        is_primary: email.is_primary,
      },
    });

    return email;
  }

  /**
   * Update an email
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param emailId - Email ID
   * @param userId - User performing the action
   * @param updateData - Update data
   * @returns Updated email
   */
  async update(
    tenantId: string,
    leadId: string,
    emailId: string,
    userId: string,
    updateData: UpdateEmailDto,
  ): Promise<any> {
    // Verify email exists and belongs to tenant
    const email = await this.prisma.lead_email.findFirst({
      where: {
        id: emailId,
        lead_id: leadId,
        lead: {
          tenant_id: tenantId,
        },
      },
    });

    if (!email) {
      throw new NotFoundException(
        `Email with ID ${emailId} not found or access denied`,
      );
    }

    // Validate email format if updating email
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        throw new BadRequestException(
          `Invalid email format: ${updateData.email}`,
        );
      }
    }

    // If setting as primary, unset other primary emails
    if (updateData.is_primary === true) {
      await this.prisma.lead_email.updateMany({
        where: {
          lead_id: leadId,
          is_primary: true,
          id: { not: emailId },
        },
        data: {
          is_primary: false,
        },
      });
    }

    const updatedEmail = await this.prisma.lead_email.update({
      where: { id: emailId },
      data: {
        email: updateData.email
          ? updateData.email.toLowerCase().trim()
          : undefined,
        // email_type not in schema,
        is_primary: updateData.is_primary,
      },
    });

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.EMAIL_UPDATED,
      description: `Email ${updatedEmail.email} updated`,
      user_id: userId,
      metadata: {
        email_id: updatedEmail.id,
        changes: updateData,
      },
    });

    return updatedEmail;
  }

  /**
   * Delete an email
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param emailId - Email ID
   * @param userId - User performing the action
   */
  async delete(
    tenantId: string,
    leadId: string,
    emailId: string,
    userId: string,
  ): Promise<void> {
    // Verify email exists and belongs to tenant
    const email = await this.prisma.lead_email.findFirst({
      where: {
        id: emailId,
        lead_id: leadId,
        lead: {
          tenant_id: tenantId,
        },
      },
    });

    if (!email) {
      throw new NotFoundException(
        `Email with ID ${emailId} not found or access denied`,
      );
    }

    // Check if this is the last contact method (at least 1 email or phone required)
    const [emailCount, phoneCount] = await Promise.all([
      this.prisma.lead_email.count({ where: { lead_id: leadId } }),
      this.prisma.lead_phone.count({ where: { lead_id: leadId } }),
    ]);

    if (emailCount === 1 && phoneCount === 0) {
      throw new BadRequestException(
        'Cannot delete the last contact method. Lead must have at least one email or phone number.',
      );
    }

    await this.prisma.lead_email.delete({
      where: { id: emailId },
    });

    // If deleted email was primary, set another one as primary
    if (email.is_primary && emailCount > 1) {
      await this.ensurePrimaryFlag(leadId);
    }

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.EMAIL_DELETED,
      description: `Email ${email.email} (${"personal"}) deleted`,
      user_id: userId,
      metadata: {
        email_id: email.id,
        email: email.email,
        email_type: "personal",
      },
    });
  }

  /**
   * Get all emails for a lead
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @returns Array of emails
   */
  async findAllByLead(tenantId: string, leadId: string): Promise<any[]> {
    return this.prisma.lead_email.findMany({
      where: {
        lead_id: leadId,
        lead: {
          tenant_id: tenantId,
        },
      },
      orderBy: [
        { is_primary: 'desc' }, // Primary first
        { created_at: 'asc' }, // Then by creation date
      ],
    });
  }

  /**
   * Ensure at least one email is marked as primary
   * @param leadId - Lead ID
   */
  async ensurePrimaryFlag(leadId: string): Promise<void> {
    const emails = await this.prisma.lead_email.findMany({
      where: { lead_id: leadId },
      orderBy: { created_at: 'asc' },
    });

    if (emails.length === 0) {
      return;
    }

    const hasPrimary = emails.some((e) => e.is_primary);
    if (!hasPrimary) {
      // Set first email as primary
      await this.prisma.lead_email.update({
        where: { id: emails[0].id },
        data: { is_primary: true },
      });
    }
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
