import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export enum ActivityType {
  CREATED = 'created',
  UPDATED = 'updated',
  STATUS_CHANGED = 'status_changed',
  EMAIL_ADDED = 'email_added',
  EMAIL_UPDATED = 'email_updated',
  EMAIL_DELETED = 'email_deleted',
  PHONE_ADDED = 'phone_added',
  PHONE_UPDATED = 'phone_updated',
  PHONE_DELETED = 'phone_deleted',
  ADDRESS_ADDED = 'address_added',
  ADDRESS_UPDATED = 'address_updated',
  ADDRESS_DELETED = 'address_deleted',
  NOTE_ADDED = 'note_added',
  NOTE_UPDATED = 'note_updated',
  NOTE_DELETED = 'note_deleted',
  SERVICE_REQUEST_CREATED = 'service_request_created',
  SERVICE_REQUEST_UPDATED = 'service_request_updated',
  CONVERTED_TO_CUSTOMER = 'converted_to_customer',
  MARKED_AS_LOST = 'marked_as_lost',
  REACTIVATED = 'reactivated',
}

export interface CreateActivityDto {
  lead_id: string;
  activity_type: ActivityType;
  description: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class LeadActivitiesService {
  private readonly logger = new Logger(LeadActivitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an activity for a lead
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param activityData - Activity details
   * @returns Created activity
   */
  async logActivity(
    tenantId: string,
    activityData: CreateActivityDto,
  ): Promise<any> {
    try {
      // Generate UUID for activity
      const activityId = this.generateUUID();

      const activity = await this.prisma.lead_activity.create({
        data: {
          id: activityId,
          lead_id: activityData.lead_id,
          activity_type: activityData.activity_type,
          description: activityData.description,
          user_id: activityData.user_id,
          metadata: activityData.metadata || {},
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

      // Verify tenant isolation
      if (activity.lead.tenant_id !== tenantId) {
        this.logger.error(
          `Tenant isolation violation: Activity ${activity.id} belongs to tenant ${activity.lead.tenant_id} but was created under tenant ${tenantId}`,
        );
        throw new Error('Tenant isolation violation detected');
      }

      return activity;
    } catch (error) {
      this.logger.error(
        `Failed to log activity for lead ${activityData.lead_id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get all activities for a lead (paginated)
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @returns Paginated activities
   */
  async findAllByLead(
    tenantId: string,
    leadId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: any[]; meta: any }> {
    const skip = (page - 1) * limit;

    // Get activities with tenant isolation check
    const [activities, total] = await Promise.all([
      this.prisma.lead_activity.findMany({
        where: {
          lead_id: leadId,
          lead: {
            tenant_id: tenantId, // CRITICAL: Tenant isolation
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
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.lead_activity.count({
        where: {
          lead_id: leadId,
          lead: {
            tenant_id: tenantId,
          },
        },
      }),
    ]);

    return {
      data: activities,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single activity by ID
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param activityId - Activity ID
   * @returns Activity or null
   */
  async findOne(tenantId: string, activityId: string): Promise<any | null> {
    return this.prisma.lead_activity.findFirst({
      where: {
        id: activityId,
        lead: {
          tenant_id: tenantId, // CRITICAL: Tenant isolation
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
