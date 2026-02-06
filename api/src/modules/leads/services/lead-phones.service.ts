import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LeadActivitiesService, ActivityType } from './lead-activities.service';
import { CreatePhoneDto, UpdatePhoneDto } from '../dto/lead.dto';

@Injectable()
export class LeadPhonesService {
  private readonly logger = new Logger(LeadPhonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: LeadActivitiesService,
  ) {}

  /**
   * CRITICAL: Check if phone number exists for the tenant (phone unique per tenant)
   * @param tenantId - Tenant ID for tenant-scoped uniqueness check
   * @param phone - Phone number (sanitized, 10 digits)
   * @param excludeLeadId - Optional lead ID to exclude (for updates)
   * @returns true if phone exists, false otherwise
   */
  async checkPhoneUniqueness(
    tenantId: string,
    phone: string,
    excludeLeadId?: string,
  ): Promise<boolean> {
    // Sanitize phone number (remove all non-digits)
    const sanitizedPhone = phone.replace(/\D/g, '');

    // Query: lead_phone → lead → filter by tenant_id
    const existingPhone = await this.prisma.lead_phone.findFirst({
      where: {
        phone: sanitizedPhone,
        lead: {
          tenant_id: tenantId, // CRITICAL: Tenant-scoped uniqueness
          ...(excludeLeadId && { id: { not: excludeLeadId } }), // Exclude current lead if updating
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            tenant_id: true,
          },
        },
      },
    });

    if (existingPhone) {
      this.logger.warn(
        `Phone ${sanitizedPhone} already exists for tenant ${tenantId} on lead ${existingPhone.lead.id} (${existingPhone.lead.first_name} ${existingPhone.lead.last_name})`,
      );
      return true; // Phone exists
    }

    return false; // Phone is unique
  }

  /**
   * Create multiple phones for a lead (used during lead creation)
   * @param tenantId - Tenant ID for uniqueness check
   * @param leadId - Lead ID
   * @param phones - Array of phone objects
   * @param prismaClient - Optional Prisma transaction client
   * @returns Created phones
   */
  async createMultiple(
    tenantId: string,
    leadId: string,
    phones: CreatePhoneDto[],
    prismaClient?: any,
  ): Promise<any[]> {
    if (!phones || phones.length === 0) {
      return [];
    }

    // Use transaction client if provided, otherwise use default prisma
    const client = prismaClient || this.prisma;

    // Validate at least one is primary if multiple phones provided
    const primaryCount = phones.filter((p) => p.is_primary).length;
    if (phones.length > 1 && primaryCount === 0) {
      // Auto-set first phone as primary
      phones[0].is_primary = true;
    } else if (primaryCount > 1) {
      throw new BadRequestException('Only one phone can be marked as primary');
    }

    // Validate phone format and check uniqueness for each phone
    for (const phoneData of phones) {
      const sanitizedPhone = phoneData.phone.replace(/\D/g, '');

      if (sanitizedPhone.length !== 10) {
        throw new BadRequestException(
          `Invalid phone number: ${phoneData.phone}. Must be 10 digits.`,
        );
      }

      // Check phone uniqueness (tenant-scoped)
      const phoneExists = await this.checkPhoneUniqueness(
        tenantId,
        sanitizedPhone,
      );
      if (phoneExists) {
        throw new ConflictException(
          `Phone number ${phoneData.phone} is already assigned to another lead in this account.`,
        );
      }
    }

    const createdPhones = await Promise.all(
      phones.map(async (phoneData) => {
        const phoneId = this.generateUUID();
        const sanitizedPhone = phoneData.phone.replace(/\D/g, '');

        return client.lead_phone.create({
          data: {
            id: phoneId,
            lead_id: leadId,
            phone: sanitizedPhone,
            phone_type: phoneData.phone_type || 'mobile',
            is_primary: phoneData.is_primary || false,
          },
        });
      }),
    );

    return createdPhones;
  }

  /**
   * Create a single phone for a lead
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param userId - User performing the action (for activity logging)
   * @param phoneData - Phone details
   * @returns Created phone
   */
  async create(
    tenantId: string,
    leadId: string,
    userId: string,
    phoneData: CreatePhoneDto,
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

    // Validate phone format
    const sanitizedPhone = phoneData.phone.replace(/\D/g, '');
    if (sanitizedPhone.length !== 10) {
      throw new BadRequestException(
        `Invalid phone number: ${phoneData.phone}. Must be 10 digits.`,
      );
    }

    // CRITICAL: Check phone uniqueness (tenant-scoped)
    const phoneExists = await this.checkPhoneUniqueness(
      tenantId,
      sanitizedPhone,
    );
    if (phoneExists) {
      throw new ConflictException(
        `Phone number ${phoneData.phone} is already assigned to another lead in this account.`,
      );
    }

    // If setting as primary, unset other primary phones
    if (phoneData.is_primary) {
      await this.prisma.lead_phone.updateMany({
        where: {
          lead_id: leadId,
          is_primary: true,
        },
        data: {
          is_primary: false,
        },
      });
    } else {
      // If this is the first phone, make it primary automatically
      const existingPhonesCount = await this.prisma.lead_phone.count({
        where: { lead_id: leadId },
      });
      if (existingPhonesCount === 0) {
        phoneData.is_primary = true;
      }
    }

    const phoneId = this.generateUUID();
    const phone = await this.prisma.lead_phone.create({
      data: {
        id: phoneId,
        lead_id: leadId,
        phone: sanitizedPhone,
        phone_type: phoneData.phone_type || 'mobile',
        is_primary: phoneData.is_primary || false,
      },
    });

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.PHONE_ADDED,
      description: `Phone ${this.formatPhone(phone.phone)} (${phone.phone_type}) added`,
      user_id: userId,
      metadata: {
        phone_id: phone.id,
        phone: phone.phone,
        phone_type: phone.phone_type,
        is_primary: phone.is_primary,
      },
    });

    return phone;
  }

  /**
   * Update a phone
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param phoneId - Phone ID
   * @param userId - User performing the action
   * @param updateData - Update data
   * @returns Updated phone
   */
  async update(
    tenantId: string,
    leadId: string,
    phoneId: string,
    userId: string,
    updateData: UpdatePhoneDto,
  ): Promise<any> {
    // Verify phone exists and belongs to tenant
    const phone = await this.prisma.lead_phone.findFirst({
      where: {
        id: phoneId,
        lead_id: leadId,
        lead: {
          tenant_id: tenantId,
        },
      },
    });

    if (!phone) {
      throw new NotFoundException(
        `Phone with ID ${phoneId} not found or access denied`,
      );
    }

    // Validate phone format if updating phone number
    let sanitizedPhone: string | undefined;
    if (updateData.phone) {
      sanitizedPhone = updateData.phone.replace(/\D/g, '');
      if (sanitizedPhone.length !== 10) {
        throw new BadRequestException(
          `Invalid phone number: ${updateData.phone}. Must be 10 digits.`,
        );
      }

      // CRITICAL: Check phone uniqueness if changing the phone number
      if (sanitizedPhone !== phone.phone) {
        const phoneExists = await this.checkPhoneUniqueness(
          tenantId,
          sanitizedPhone,
          leadId, // Exclude current lead
        );
        if (phoneExists) {
          throw new ConflictException(
            `Phone number ${updateData.phone} is already assigned to another lead in this account.`,
          );
        }
      }
    }

    // If setting as primary, unset other primary phones
    if (updateData.is_primary === true) {
      await this.prisma.lead_phone.updateMany({
        where: {
          lead_id: leadId,
          is_primary: true,
          id: { not: phoneId },
        },
        data: {
          is_primary: false,
        },
      });
    }

    const updatedPhone = await this.prisma.lead_phone.update({
      where: { id: phoneId },
      data: {
        phone: sanitizedPhone,
        phone_type: updateData.phone_type,
        is_primary: updateData.is_primary,
      },
    });

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.PHONE_UPDATED,
      description: `Phone ${this.formatPhone(updatedPhone.phone)} updated`,
      user_id: userId,
      metadata: {
        phone_id: updatedPhone.id,
        changes: updateData,
      },
    });

    return updatedPhone;
  }

  /**
   * Delete a phone
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param phoneId - Phone ID
   * @param userId - User performing the action
   */
  async delete(
    tenantId: string,
    leadId: string,
    phoneId: string,
    userId: string,
  ): Promise<void> {
    // Verify phone exists and belongs to tenant
    const phone = await this.prisma.lead_phone.findFirst({
      where: {
        id: phoneId,
        lead_id: leadId,
        lead: {
          tenant_id: tenantId,
        },
      },
    });

    if (!phone) {
      throw new NotFoundException(
        `Phone with ID ${phoneId} not found or access denied`,
      );
    }

    // Check if this is the last contact method (at least 1 email or phone required)
    const [emailCount, phoneCount] = await Promise.all([
      this.prisma.lead_email.count({ where: { lead_id: leadId } }),
      this.prisma.lead_phone.count({ where: { lead_id: leadId } }),
    ]);

    if (phoneCount === 1 && emailCount === 0) {
      throw new BadRequestException(
        'Cannot delete the last contact method. Lead must have at least one email or phone number.',
      );
    }

    await this.prisma.lead_phone.delete({
      where: { id: phoneId },
    });

    // If deleted phone was primary, set another one as primary
    if (phone.is_primary && phoneCount > 1) {
      await this.ensurePrimaryFlag(leadId);
    }

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.PHONE_DELETED,
      description: `Phone ${this.formatPhone(phone.phone)} (${phone.phone_type}) deleted`,
      user_id: userId,
      metadata: {
        phone_id: phone.id,
        phone: phone.phone,
        phone_type: phone.phone_type,
      },
    });
  }

  /**
   * Get all phones for a lead
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @returns Array of phones
   */
  async findAllByLead(tenantId: string, leadId: string): Promise<any[]> {
    return this.prisma.lead_phone.findMany({
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
   * Ensure at least one phone is marked as primary
   * @param leadId - Lead ID
   */
  async ensurePrimaryFlag(leadId: string): Promise<void> {
    const phones = await this.prisma.lead_phone.findMany({
      where: { lead_id: leadId },
      orderBy: { created_at: 'asc' },
    });

    if (phones.length === 0) {
      return;
    }

    const hasPrimary = phones.some((p) => p.is_primary);
    if (!hasPrimary) {
      // Set first phone as primary
      await this.prisma.lead_phone.update({
        where: { id: phones[0].id },
        data: { is_primary: true },
      });
    }
  }

  /**
   * Format phone number for display (XXX) XXX-XXXX
   * @param phone - 10-digit phone number
   * @returns Formatted phone
   */
  private formatPhone(phone: string): string {
    if (phone.length !== 10) return phone;
    return `(${phone.substring(0, 3)}) ${phone.substring(3, 6)}-${phone.substring(6)}`;
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
