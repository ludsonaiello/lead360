import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';

/**
 * TwilioAdminService
 *
 * CRITICAL SERVICE - Fulfills AC-16: "System Admin can view all tenant activity"
 *
 * Responsibilities:
 * - Cross-tenant visibility for all communication activity
 * - View all calls across all tenants (paginated)
 * - View all SMS/WhatsApp messages across all tenants (paginated)
 * - View all tenant configurations (SMS/WhatsApp/IVR)
 * - Get tenant-specific and system-wide communication metrics
 * - Monitor failed transcriptions
 * - Retry failed transcriptions
 * - Export communication data for analysis
 *
 * Key Features:
 * - Multi-tenant aggregation (no tenant isolation for admin)
 * - Comprehensive filtering and pagination
 * - Real-time metrics and analytics
 * - Graceful error handling
 * - Audit logging for admin actions
 *
 * Security:
 * - All endpoints require PlatformAdminGuard
 * - Admin actions are audit logged
 * - Sensitive data (credentials) are excluded from responses
 *
 * @class TwilioAdminService
 * @since Sprint 8
 */
@Injectable()
export class TwilioAdminService {
  private readonly logger = new Logger(TwilioAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get all calls across all tenants (paginated)
   *
   * Provides system administrators with comprehensive visibility
   * into all voice calls across the platform.
   *
   * Supports filtering by:
   * - Tenant ID (optional - view specific tenant)
   * - Call status (initiated, completed, failed, etc.)
   * - Direction (inbound, outbound)
   * - Date range (start_date, end_date)
   *
   * @param filters - Filter and pagination options
   * @returns Promise<PaginatedCallList> - Paginated call records with tenant info
   *
   * @example
   * const calls = await service.getAllCalls({
   *   status: 'completed',
   *   page: 1,
   *   limit: 20
   * });
   */
  async getAllCalls(filters: AdminCallFilters): Promise<PaginatedCallList> {
    this.logger.debug('Fetching all calls across tenants with filters:', filters);

    try {
      // Build dynamic where clause
      const where: any = {};

      if (filters.tenant_id) {
        where.tenant_id = filters.tenant_id;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.direction) {
        where.direction = filters.direction;
      }

      if (filters.start_date) {
        where.created_at = { gte: new Date(filters.start_date) };
      }

      if (filters.end_date) {
        where.created_at = {
          ...where.created_at,
          lte: new Date(filters.end_date),
        };
      }

      // Set pagination defaults
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      // Execute queries in parallel for performance
      const [calls, total] = await Promise.all([
        this.prisma.call_record.findMany({
          where,
          include: {
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
              },
            },
            lead: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
              include: {
                phones: {
                  where: { is_primary: true },
                  take: 1,
                },
                emails: {
                  where: { is_primary: true },
                  take: 1,
                },
              },
            },
            initiated_by_user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
            transcription: {
              select: {
                id: true,
                status: true,
                transcription_provider: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.call_record.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      this.logger.debug(
        `Fetched ${calls.length} calls (page ${page}/${totalPages}, total: ${total})`,
      );

      return {
        data: calls,
        pagination: {
          total,
          page,
          limit,
          pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch all calls:', error.message);
      throw error;
    }
  }

  /**
   * Get all SMS/WhatsApp messages across all tenants (paginated)
   *
   * Provides visibility into all text messaging across the platform.
   *
   * @param filters - Filter and pagination options
   * @returns Promise<PaginatedSmsList> - Paginated SMS/WhatsApp messages
   *
   * @example
   * const messages = await service.getAllSmsMessages({
   *   status: 'delivered',
   *   page: 1,
   *   limit: 50
   * });
   */
  async getAllSmsMessages(filters: AdminSmsFilters): Promise<PaginatedSmsList> {
    this.logger.debug('Fetching all SMS messages across tenants with filters:', filters);

    try {
      // Build where clause
      const where: any = {
        channel: filters.channel || { in: ['sms', 'whatsapp'] },
      };

      if (filters.tenant_id) {
        where.tenant_id = filters.tenant_id;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.direction) {
        where.direction = filters.direction;
      }

      if (filters.start_date) {
        where.created_at = { gte: new Date(filters.start_date) };
      }

      if (filters.end_date) {
        where.created_at = {
          ...where.created_at,
          lte: new Date(filters.end_date),
        };
      }

      // Pagination
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      // Execute queries in parallel
      const [messages, total] = await Promise.all([
        this.prisma.communication_event.findMany({
          where,
          include: {
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
              },
            },
            provider: {
              select: {
                id: true,
                provider_name: true,
                provider_type: true,
              },
            },
            created_by_user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.communication_event.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      this.logger.debug(
        `Fetched ${messages.length} SMS/WhatsApp messages (page ${page}/${totalPages}, total: ${total})`,
      );

      return {
        data: messages,
        pagination: {
          total,
          page,
          limit,
          pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch SMS messages:', error.message);
      throw error;
    }
  }

  /**
   * View all tenant configurations (SMS/WhatsApp/IVR)
   *
   * Provides comprehensive overview of all tenant communication configurations.
   * Excludes sensitive credentials for security.
   *
   * @returns Promise<AllTenantConfigs> - All active tenant configurations
   *
   * @example
   * const configs = await service.getAllTenantConfigs();
   * // Returns: {
   * //   sms_configs: [...],
   * //   whatsapp_configs: [...],
   * //   ivr_configs: [...]
   * // }
   */
  async getAllTenantConfigs(): Promise<AllTenantConfigs> {
    this.logger.debug('Fetching all tenant configurations');

    try {
      // Fetch all configuration types in parallel
      const [smsConfigs, whatsappConfigs, ivrConfigs] = await Promise.all([
        // SMS Configurations
        this.prisma.tenant_sms_config.findMany({
          where: { is_active: true },
          select: {
            id: true,
            tenant_id: true,
            from_phone: true,
            is_verified: true,
            created_at: true,
            updated_at: true,
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
                is_active: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
        }),

        // WhatsApp Configurations
        this.prisma.tenant_whatsapp_config.findMany({
          where: { is_active: true },
          select: {
            id: true,
            tenant_id: true,
            from_phone: true,
            is_verified: true,
            created_at: true,
            updated_at: true,
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
                is_active: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
        }),

        // IVR Configurations
        this.prisma.ivr_configuration.findMany({
          where: { ivr_enabled: true },
          select: {
            id: true,
            tenant_id: true,
            ivr_enabled: true,
            greeting_message: true,
            menu_options: true,
            default_action: true,
            timeout_seconds: true,
            max_retries: true,
            status: true,
            created_at: true,
            updated_at: true,
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
                is_active: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
        }),
      ]);

      this.logger.debug(
        `Fetched configurations: ${smsConfigs.length} SMS, ${whatsappConfigs.length} WhatsApp, ${ivrConfigs.length} IVR`,
      );

      return {
        sms_configs: smsConfigs.map((config) => ({
          id: config.id,
          tenant: config.tenant,
          from_phone: config.from_phone,
          is_verified: config.is_verified,
          created_at: config.created_at,
        })),
        whatsapp_configs: whatsappConfigs.map((config) => ({
          id: config.id,
          tenant: config.tenant,
          from_phone: config.from_phone,
          is_verified: config.is_verified,
          created_at: config.created_at,
        })),
        ivr_configs: ivrConfigs.map((config) => ({
          id: config.id,
          tenant: config.tenant,
          greeting_text: config.greeting_message?.substring(0, 100) || '',
          menu_options_count: Array.isArray(config.menu_options)
            ? config.menu_options.length
            : 0,
          timeout_seconds: config.timeout_seconds,
          max_retries: config.max_retries,
          status: config.status,
          created_at: config.created_at,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch tenant configurations:', error.message);
      throw error;
    }
  }

  /**
   * Get tenant-specific communication metrics
   *
   * Provides detailed metrics for a single tenant's communication activity.
   *
   * @param tenantId - UUID of the tenant
   * @returns Promise<TenantMetrics> - Comprehensive tenant metrics
   *
   * @example
   * const metrics = await service.getTenantMetrics('tenant-uuid');
   */
  async getTenantMetrics(tenantId: string): Promise<TenantMetrics> {
    this.logger.debug(`Generating metrics for tenant ${tenantId}`);

    try {
      // Execute all metric queries in parallel
      const [
        callsCount,
        smsCount,
        whatsappCount,
        avgCallDuration,
        failedTranscriptions,
        totalTranscriptions,
        last7DaysCalls,
        last30DaysCalls,
        last7DaysSms,
        last30DaysSms,
      ] = await Promise.all([
        // Total calls
        this.prisma.call_record.count({
          where: { tenant_id: tenantId },
        }),

        // Total SMS
        this.prisma.communication_event.count({
          where: {
            tenant_id: tenantId,
            channel: 'sms',
          },
        }),

        // Total WhatsApp
        this.prisma.communication_event.count({
          where: {
            tenant_id: tenantId,
            channel: 'whatsapp',
          },
        }),

        // Average call duration
        this.prisma.call_record.aggregate({
          where: {
            tenant_id: tenantId,
            status: 'completed',
          },
          _avg: {
            recording_duration_seconds: true,
          },
        }),

        // Failed transcriptions
        this.prisma.call_transcription.count({
          where: {
            tenant_id: tenantId,
            status: 'failed',
          },
        }),

        // Total transcriptions
        this.prisma.call_transcription.count({
          where: { tenant_id: tenantId },
        }),

        // Last 7 days calls
        this.prisma.call_record.count({
          where: {
            tenant_id: tenantId,
            created_at: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),

        // Last 30 days calls
        this.prisma.call_record.count({
          where: {
            tenant_id: tenantId,
            created_at: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),

        // Last 7 days SMS
        this.prisma.communication_event.count({
          where: {
            tenant_id: tenantId,
            channel: 'sms',
            created_at: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),

        // Last 30 days SMS
        this.prisma.communication_event.count({
          where: {
            tenant_id: tenantId,
            channel: 'sms',
            created_at: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      const metrics: TenantMetrics = {
        tenant_id: tenantId,
        total_calls: callsCount,
        total_sms: smsCount,
        total_whatsapp: whatsappCount,
        avg_call_duration_seconds: Math.round(
          avgCallDuration._avg.recording_duration_seconds || 0,
        ),
        failed_transcriptions: failedTranscriptions,
        total_transcriptions: totalTranscriptions,
        transcription_success_rate:
          totalTranscriptions > 0
            ? (
                ((totalTranscriptions - failedTranscriptions) /
                  totalTranscriptions) *
                100
              ).toFixed(2)
            : '0.00',
        activity_last_7_days: {
          calls: last7DaysCalls,
          sms: last7DaysSms,
        },
        activity_last_30_days: {
          calls: last30DaysCalls,
          sms: last30DaysSms,
        },
      };

      this.logger.debug(`Metrics generated for tenant ${tenantId}`);

      return metrics;
    } catch (error) {
      this.logger.error(
        `Failed to generate metrics for tenant ${tenantId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get system-wide metrics (all tenants)
   *
   * Provides platform-level overview of communication activity.
   *
   * @returns Promise<SystemMetrics> - Platform-wide metrics
   *
   * @example
   * const metrics = await service.getSystemWideMetrics();
   */
  async getSystemWideMetrics(): Promise<SystemMetrics> {
    this.logger.debug('Generating system-wide metrics');

    try {
      // Execute all metric queries in parallel
      const [
        totalCalls,
        totalSms,
        totalWhatsapp,
        activeTenants,
        totalTranscriptions,
        failedTranscriptions,
        tenantsWithSmsConfig,
        tenantsWithWhatsappConfig,
        tenantsWithIvrConfig,
        last24hCalls,
        last24hSms,
      ] = await Promise.all([
        this.prisma.call_record.count(),
        this.prisma.communication_event.count({
          where: { channel: 'sms' },
        }),
        this.prisma.communication_event.count({
          where: { channel: 'whatsapp' },
        }),
        this.prisma.tenant.count({ where: { is_active: true } }),
        this.prisma.call_transcription.count(),
        this.prisma.call_transcription.count({
          where: { status: 'failed' },
        }),
        this.prisma.tenant_sms_config.count({
          where: { is_active: true },
        }),
        this.prisma.tenant_whatsapp_config.count({
          where: { is_active: true },
        }),
        this.prisma.ivr_configuration.count({
          where: { ivr_enabled: true },
        }),
        this.prisma.call_record.count({
          where: {
            created_at: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        }),
        this.prisma.communication_event.count({
          where: {
            channel: 'sms',
            created_at: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      const metrics: SystemMetrics = {
        total_calls: totalCalls,
        total_sms: totalSms,
        total_whatsapp: totalWhatsapp,
        total_communications: totalCalls + totalSms + totalWhatsapp,
        active_tenants: activeTenants,
        total_transcriptions: totalTranscriptions,
        failed_transcriptions: failedTranscriptions,
        transcription_success_rate:
          totalTranscriptions > 0
            ? (
                ((totalTranscriptions - failedTranscriptions) /
                  totalTranscriptions) *
                100
              ).toFixed(2)
            : '0.00',
        tenants_with_sms_config: tenantsWithSmsConfig,
        tenants_with_whatsapp_config: tenantsWithWhatsappConfig,
        tenants_with_ivr_config: tenantsWithIvrConfig,
        activity_last_24h: {
          calls: last24hCalls,
          sms: last24hSms,
        },
      };

      this.logger.debug('System-wide metrics generated successfully');

      return metrics;
    } catch (error) {
      this.logger.error('Failed to generate system-wide metrics:', error.message);
      throw error;
    }
  }

  /**
   * Get all failed transcriptions across all tenants
   *
   * Provides visibility into transcription failures for troubleshooting.
   *
   * @returns Promise<FailedTranscription[]> - List of failed transcriptions
   *
   * @example
   * const failures = await service.getFailedTranscriptions();
   */
  async getFailedTranscriptions(): Promise<FailedTranscription[]> {
    this.logger.debug('Fetching all failed transcriptions');

    try {
      const failed = await this.prisma.call_transcription.findMany({
        where: { status: 'failed' },
        include: {
          call_record: {
            include: {
              tenant: {
                select: {
                  id: true,
                  company_name: true,
                  subdomain: true,
                },
              },
              lead: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                },
                include: {
                  phones: {
                    where: { is_primary: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 100, // Limit to recent 100 failures
      });

      const failures: FailedTranscription[] = failed.map((transcription) => ({
        id: transcription.id,
        tenant: transcription.call_record.tenant
          ? {
              id: transcription.call_record.tenant.id,
              company_name: transcription.call_record.tenant.company_name,
            }
          : null,
        call_id: transcription.call_record.id,
        call_sid: transcription.call_record.twilio_call_sid,
        lead: transcription.call_record.lead
          ? {
              id: transcription.call_record.lead.id,
              name: `${transcription.call_record.lead.first_name} ${transcription.call_record.lead.last_name}`,
              phone: transcription.call_record.lead.phones?.[0]?.phone || null,
            }
          : null,
        transcription_provider: transcription.transcription_provider,
        error_message: transcription.error_message,
        failed_at: transcription.completed_at,
        created_at: transcription.created_at,
      }));

      this.logger.debug(`Fetched ${failures.length} failed transcriptions`);

      return failures;
    } catch (error) {
      this.logger.error('Failed to fetch failed transcriptions:', error.message);
      throw error;
    }
  }

  /**
   * Retry failed transcription
   *
   * Resets transcription status to PENDING and queues it for re-processing.
   *
   * @param transcriptionId - UUID of the transcription to retry
   * @returns Promise<void>
   *
   * @example
   * await service.retryFailedTranscription('transcription-uuid');
   */
  async retryFailedTranscription(transcriptionId: string): Promise<void> {
    this.logger.log(`Retrying transcription ${transcriptionId}`);

    try {
      // Verify transcription exists and is failed
      const transcription = await this.prisma.call_transcription.findUnique({
        where: { id: transcriptionId },
        include: {
          call_record: {
            select: {
              id: true,
              tenant_id: true,
              recording_url: true,
            },
          },
        },
      });

      if (!transcription) {
        throw new NotFoundException(
          `Transcription ${transcriptionId} not found`,
        );
      }

      if (transcription.status !== 'failed') {
        throw new BadRequestException(
          `Cannot retry transcription ${transcriptionId} with status ${transcription.status}`,
        );
      }

      if (!transcription.call_record.recording_url) {
        throw new BadRequestException(
          'Cannot retry transcription: no recording URL available',
        );
      }

      // Reset transcription status to 'queued'
      // The TranscriptionJobProcessor will automatically pick up queued transcriptions
      await this.prisma.call_transcription.update({
        where: { id: transcriptionId },
        data: {
          status: 'queued',
          error_message: null,
        },
      });

      this.logger.log(
        `Transcription ${transcriptionId} queued for retry - will be processed by TranscriptionJobProcessor`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to retry transcription ${transcriptionId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get top active tenants by communication volume
   *
   * Identifies tenants with highest communication activity.
   *
   * @param limit - Number of top tenants to return (default: 10)
   * @returns Promise<TopTenant[]> - Top tenants by volume
   */
  async getTopTenantsByVolume(limit: number = 10): Promise<TopTenant[]> {
    this.logger.debug(`Fetching top ${limit} tenants by communication volume`);

    try {
      // Get call counts per tenant
      const callStats = await this.prisma.call_record.groupBy({
        by: ['tenant_id'],
        where: {
          tenant_id: { not: null },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: limit,
      });

      // Fetch tenant details
      const topTenants: TopTenant[] = await Promise.all(
        callStats.map(async (stat) => {
          const tenant = await this.prisma.tenant.findUnique({
            where: { id: stat.tenant_id! },
            select: {
              id: true,
              company_name: true,
              subdomain: true,
            },
          });

          // Get SMS count for this tenant
          const smsCount = await this.prisma.communication_event.count({
            where: {
              tenant_id: stat.tenant_id,
              channel: 'sms',
            },
          });

          return {
            tenant: tenant!,
            total_calls: stat._count.id,
            total_sms: smsCount,
            total_communications: stat._count.id + smsCount,
          };
        }),
      );

      // Sort by total communications
      topTenants.sort(
        (a, b) => b.total_communications - a.total_communications,
      );

      this.logger.debug(`Fetched top ${topTenants.length} tenants by volume`);

      return topTenants;
    } catch (error) {
      this.logger.error('Failed to fetch top tenants by volume:', error.message);
      throw error;
    }
  }
}

/**
 * Type Definitions
 */

export interface AdminCallFilters {
  tenant_id?: string;
  status?: string;
  direction?: 'inbound' | 'outbound';
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface AdminSmsFilters {
  tenant_id?: string;
  status?: string;
  direction?: string;
  channel?: 'sms' | 'whatsapp';
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedCallList {
  data: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface PaginatedSmsList {
  data: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface AllTenantConfigs {
  sms_configs: any[];
  whatsapp_configs: any[];
  ivr_configs: any[];
}

export interface TenantMetrics {
  tenant_id: string;
  total_calls: number;
  total_sms: number;
  total_whatsapp: number;
  avg_call_duration_seconds: number;
  failed_transcriptions: number;
  total_transcriptions: number;
  transcription_success_rate: string;
  activity_last_7_days: {
    calls: number;
    sms: number;
  };
  activity_last_30_days: {
    calls: number;
    sms: number;
  };
}

export interface SystemMetrics {
  total_calls: number;
  total_sms: number;
  total_whatsapp: number;
  total_communications: number;
  active_tenants: number;
  total_transcriptions: number;
  failed_transcriptions: number;
  transcription_success_rate: string;
  tenants_with_sms_config: number;
  tenants_with_whatsapp_config: number;
  tenants_with_ivr_config: number;
  activity_last_24h: {
    calls: number;
    sms: number;
  };
}

export interface FailedTranscription {
  id: string;
  tenant: {
    id: string;
    company_name: string;
  } | null;
  call_id: string;
  call_sid: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  transcription_provider: string;
  error_message: string | null;
  failed_at: Date | null;
  created_at: Date;
}

export interface TopTenant {
  tenant: {
    id: string;
    company_name: string;
    subdomain: string;
  };
  total_calls: number;
  total_sms: number;
  total_communications: number;
}
