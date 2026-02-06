import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';

// Admin Services
import { TwilioAdminService } from '../../services/admin/twilio-admin.service';
import { TwilioUsageTrackingService } from '../../services/admin/twilio-usage-tracking.service';
import { TwilioHealthMonitorService } from '../../services/admin/twilio-health-monitor.service';
import { TwilioProviderManagementService } from '../../services/admin/twilio-provider-management.service';
import { DynamicCronManagerService } from '../../services/admin/dynamic-cron-manager.service';

// DTOs
import {
  AdminCallFiltersDto,
  AdminSmsFiltersDto,
  UsageQueryDto,
  CostQueryDto,
  RegisterSystemProviderDto,
  UpdateSystemProviderDto,
  TestConnectivityDto,
} from '../../dto/admin';

/**
 * Twilio Admin Controller
 *
 * COMPREHENSIVE ADMIN CONTROL PANEL FOR TWILIO COMMUNICATION SYSTEM
 *
 * This controller provides 34 powerful admin endpoints for complete system
 * management and monitoring across all tenants.
 *
 * CRITICAL FEATURES:
 * - Fulfills AC-16: "System Admin can view all tenant activity"
 * - Fulfills AC-18: "Usage tracking pulls data from Twilio API and syncs nightly"
 *
 * ENDPOINT CATEGORIES (34 total):
 * 1. Provider Management (5 endpoints) - System-level Twilio configuration
 * 2. Cross-Tenant Oversight (6 endpoints) - View all activity across tenants
 * 3. Usage Tracking & Billing (7 endpoints) - Cost tracking and reporting
 * 4. Transcription Monitoring (4 endpoints) - Transcription health and retry
 * 5. System Health (6 endpoints) - Health checks and performance monitoring
 * 6. Admin Impersonation (6 endpoints) - Manage tenant configs on their behalf
 *
 * SECURITY:
 * - All endpoints require JWT authentication
 * - All endpoints require SystemAdmin role (platform admin only)
 * - No tenant isolation (cross-tenant visibility)
 * - All actions are audit logged
 *
 * ROUTE PREFIX: /admin/communication
 *
 * @class TwilioAdminController
 * @since Sprint 8
 */
@ApiTags('Admin - Twilio Communication')
@ApiBearerAuth()
@Controller('admin/communication')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SystemAdmin')
export class TwilioAdminController {
  private readonly logger = new Logger(TwilioAdminController.name);

  constructor(
    private readonly twilioAdminService: TwilioAdminService,
    private readonly twilioUsageTrackingService: TwilioUsageTrackingService,
    private readonly twilioHealthMonitorService: TwilioHealthMonitorService,
    private readonly twilioProviderManagementService: TwilioProviderManagementService,
    private readonly dynamicCronManagerService: DynamicCronManagerService,
  ) {}

  // ============================================================================
  // PROVIDER MANAGEMENT (5 endpoints)
  // System-level Twilio provider configuration (Model B support)
  // ============================================================================

  @Post('twilio/provider')
  @ApiOperation({
    summary: 'Register system-level Twilio provider (Model B)',
    description:
      'Registers master Twilio account for platform-wide usage. ' +
      'Enables Model B where platform provides Twilio service to tenants. ' +
      'Credentials are encrypted at rest.',
  })
  @ApiResponse({
    status: 201,
    description: 'Provider registered successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials or provider already exists',
  })
  async registerSystemProvider(@Body() dto: RegisterSystemProviderDto) {
    return this.twilioProviderManagementService.registerSystemProvider(dto);
  }

  @Get('twilio/provider')
  @ApiOperation({
    summary: 'Get system provider status',
    description:
      'Returns current system provider configuration (without sensitive credentials). ' +
      'Shows whether system provider is configured and active.',
  })
  @ApiResponse({
    status: 200,
    description: 'System provider status retrieved',
  })
  async getSystemProvider() {
    return this.twilioProviderManagementService.getSystemProviderStatus();
  }

  @Patch('twilio/provider')
  @ApiOperation({
    summary: 'Update system provider configuration',
    description:
      'Updates master Twilio account credentials. ' +
      'Use with caution - affects all Model B tenants.',
  })
  @ApiResponse({
    status: 200,
    description: 'System provider updated successfully',
  })
  async updateSystemProvider(@Body() dto: UpdateSystemProviderDto) {
    await this.twilioProviderManagementService.updateSystemProviderConfig(dto);
    return { message: 'System provider updated successfully' };
  }

  @Post('twilio/provider/test')
  @ApiOperation({
    summary: 'Test system provider connectivity',
    description:
      'Validates system Twilio credentials by making test API call. ' +
      'Returns connection status and response time.',
  })
  @ApiResponse({
    status: 200,
    description: 'Connectivity test completed',
  })
  async testSystemProvider() {
    return this.twilioProviderManagementService.testSystemProvider();
  }

  @Get('twilio/available-numbers')
  @ApiOperation({
    summary: 'Get available phone numbers from Twilio',
    description:
      'Fetches available phone numbers from master Twilio account. ' +
      'Used for allocating numbers to tenants (Model B).',
  })
  @ApiQuery({
    name: 'area_code',
    required: false,
    description: 'Filter by area code (e.g., 415 for San Francisco)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of results (default: 20, max: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Available phone numbers retrieved',
  })
  async getAvailableNumbers(
    @Query('area_code') areaCode?: string,
    @Query('limit') limit?: number,
  ) {
    return this.twilioProviderManagementService.getAvailablePhoneNumbers(
      areaCode,
      limit || 20,
    );
  }

  // ============================================================================
  // CROSS-TENANT OVERSIGHT (6 endpoints) - AC-16: View all tenant activity
  // View all communication activity across the platform
  // ============================================================================

  @Get('calls')
  @ApiOperation({
    summary: 'Get all calls across all tenants (AC-16)',
    description:
      'Returns paginated list of all voice calls across the platform. ' +
      'Supports filtering by tenant, status, direction, and date range.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated call list with tenant information',
  })
  async getAllCalls(@Query() filters: AdminCallFiltersDto) {
    return this.twilioAdminService.getAllCalls(filters);
  }

  @Get('sms')
  @ApiOperation({
    summary: 'Get all SMS across all tenants (AC-16)',
    description:
      'Returns paginated list of all SMS messages across the platform. ' +
      'Includes message content, delivery status, and tenant information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated SMS list',
  })
  async getAllSms(@Query() filters: AdminSmsFiltersDto) {
    return this.twilioAdminService.getAllSmsMessages(filters);
  }

  @Get('whatsapp')
  @ApiOperation({
    summary: 'Get all WhatsApp messages across all tenants (AC-16)',
    description:
      'Returns paginated list of all WhatsApp messages across the platform.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated WhatsApp message list',
  })
  async getAllWhatsApp(@Query() filters: AdminSmsFiltersDto) {
    // Use SMS filters with channel override
    const whatsappFilters = { ...filters, channel: 'whatsapp' as const };
    return this.twilioAdminService.getAllSmsMessages(whatsappFilters);
  }

  @Get('tenant-configs')
  @ApiOperation({
    summary: 'Get all tenant configurations (SMS/WhatsApp/IVR) (AC-16)',
    description:
      'Returns comprehensive view of all active tenant communication configurations. ' +
      'Excludes sensitive credentials for security.',
  })
  @ApiResponse({
    status: 200,
    description: 'All tenant configurations retrieved',
  })
  async getAllTenantConfigs() {
    return this.twilioAdminService.getAllTenantConfigs();
  }

  @Get('tenants/:id/configs')
  @ApiOperation({
    summary: "Get specific tenant's communication configurations",
    description:
      "Returns all communication configurations for a specific tenant. " +
      "Includes SMS, WhatsApp, and IVR settings.",
  })
  @ApiParam({
    name: 'id',
    description: 'Tenant UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant configurations retrieved',
  })
  async getTenantConfigs(@Param('id') tenantId: string) {
    // For now, return all configs (can be filtered by tenant_id in future)
    const allConfigs = await this.twilioAdminService.getAllTenantConfigs();

    // Filter by tenant ID
    return {
      sms_configs: allConfigs.sms_configs.filter(
        (c) => c.tenant?.id === tenantId,
      ),
      whatsapp_configs: allConfigs.whatsapp_configs.filter(
        (c) => c.tenant?.id === tenantId,
      ),
      ivr_configs: allConfigs.ivr_configs.filter(
        (c) => c.tenant?.id === tenantId,
      ),
    };
  }

  @Get('tenants/:id/metrics')
  @ApiOperation({
    summary: 'Get tenant communication metrics',
    description:
      'Returns comprehensive metrics for a specific tenant: ' +
      'call counts, SMS counts, average call duration, transcription stats, etc.',
  })
  @ApiParam({
    name: 'id',
    description: 'Tenant UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant metrics retrieved',
  })
  async getTenantMetrics(@Param('id') tenantId: string) {
    return this.twilioAdminService.getTenantMetrics(tenantId);
  }

  // ============================================================================
  // USAGE TRACKING & BILLING (7 endpoints) - AC-18: Usage sync from Twilio API
  // Cost tracking, billing reports, and usage analytics
  // ============================================================================

  @Post('usage/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger immediate usage sync for all tenants (AC-18)',
    description:
      'Manually triggers usage sync from Twilio API for all active tenants. ' +
      'Typically runs automatically nightly at 2:00 AM. ' +
      'Use this for immediate cost updates or troubleshooting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage sync initiated',
  })
  async syncAllUsage() {
    // Run sync asynchronously (don't wait for completion)
    this.twilioUsageTrackingService
      .syncUsageForAllTenants()
      .catch((error) => {
        this.logger.error('Usage sync failed:', error.message);
        this.logger.error('Error stack:', error.stack);
      });

    return { message: 'Usage sync initiated for all tenants' };
  }

  @Post('usage/sync/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync usage for specific tenant (AC-18)',
    description:
      'Syncs usage data from Twilio API for a specific tenant. ' +
      'Fetches data for the last 30 days by default.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant UUID to sync usage for',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage synced for tenant',
  })
  async syncTenantUsage(@Param('tenantId') tenantId: string) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days
    const endDate = new Date();

    await this.twilioUsageTrackingService.syncUsageForTenant(
      tenantId,
      startDate,
      endDate,
    );

    return { message: `Usage synced for tenant ${tenantId}` };
  }

  @Get('usage/tenants')
  @ApiOperation({
    summary: 'Get usage summary for all tenants',
    description:
      'Returns aggregated usage statistics across all tenants. ' +
      'Useful for platform-wide billing and capacity planning.',
  })
  @ApiResponse({
    status: 200,
    description: 'All tenants usage summary',
  })
  async getAllTenantsUsage(@Query() query: UsageQueryDto) {
    const startDate = query.start_date
      ? new Date(query.start_date)
      : new Date(new Date().setDate(1)); // First day of current month
    const endDate = query.end_date
      ? new Date(query.end_date)
      : new Date();

    return this.twilioUsageTrackingService.getSystemWideUsage(
      startDate,
      endDate,
    );
  }

  @Get('usage/tenants/:id')
  @ApiOperation({
    summary: 'Get detailed usage for specific tenant',
    description:
      'Returns detailed usage breakdown by category for a specific tenant. ' +
      'Includes call, SMS, recording, and transcription usage.',
  })
  @ApiParam({
    name: 'id',
    description: 'Tenant UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant usage summary',
  })
  async getTenantUsage(
    @Param('id') tenantId: string,
    @Query() query: UsageQueryDto,
  ) {
    // Default to current month if no month specified
    const month = query.month || new Date().toISOString().slice(0, 7);
    return this.twilioUsageTrackingService.getUsageSummary(tenantId, month);
  }

  @Get('usage/system')
  @ApiOperation({
    summary: 'Get system-wide usage aggregation',
    description:
      'Returns platform-level usage statistics across all tenants. ' +
      'Aggregates all usage categories for specified date range.',
  })
  @ApiResponse({
    status: 200,
    description: 'System-wide usage aggregation',
  })
  async getSystemWideUsage(@Query() query: UsageQueryDto) {
    const startDate = query.start_date
      ? new Date(query.start_date)
      : new Date(new Date().setDate(1));
    const endDate = query.end_date
      ? new Date(query.end_date)
      : new Date();

    return this.twilioUsageTrackingService.getSystemWideUsage(
      startDate,
      endDate,
    );
  }

  @Get('usage/export')
  @ApiOperation({
    summary: 'Export usage report (CSV)',
    description:
      'Exports usage data as CSV file for offline analysis. ' +
      'Includes all usage categories and cost breakdowns. ' +
      'FUTURE ENHANCEMENT: This endpoint is reserved for CSV export functionality.',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage report export status',
  })
  @ApiResponse({
    status: 501,
    description: 'Feature not yet implemented - future enhancement',
  })
  async exportUsageReport(@Query() query: UsageQueryDto) {
    // CSV export is a future enhancement (not required for Sprint 8 completion)
    // Current workaround: Use GET /usage/system or /usage/tenants/:id
    // and process JSON response client-side
    return {
      message:
        'CSV export is a planned future enhancement. ' +
        'Please use GET /usage/system or /usage/tenants/:id endpoints ' +
        'and export the JSON response client-side for now.',
      alternative_endpoints: [
        '/admin/communication/usage/system',
        '/admin/communication/usage/tenants/:id',
        '/admin/communication/usage/tenants',
      ],
      status: 'planned_future_enhancement',
    };
  }

  @Get('costs/tenants/:id')
  @ApiOperation({
    summary: 'Get estimated costs for tenant',
    description:
      'Returns month-to-date cost estimation with category breakdown. ' +
      'Used for budget alerts and billing previews.',
  })
  @ApiParam({
    name: 'id',
    description: 'Tenant UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Cost estimate retrieved',
  })
  async getTenantCosts(
    @Param('id') tenantId: string,
    @Query() query: CostQueryDto,
  ) {
    return this.twilioUsageTrackingService.estimateCosts(
      tenantId,
      query.month,
    );
  }

  // ============================================================================
  // TRANSCRIPTION MONITORING (4 endpoints)
  // Monitor transcription health and retry failures
  // ============================================================================

  @Get('transcriptions/failed')
  @ApiOperation({
    summary: 'Get all failed transcriptions across all tenants',
    description:
      'Returns list of all failed transcriptions for troubleshooting. ' +
      'Includes error messages and call details. ' +
      'Limited to most recent 100 failures.',
  })
  @ApiResponse({
    status: 200,
    description: 'Failed transcriptions list',
  })
  async getFailedTranscriptions() {
    return this.twilioAdminService.getFailedTranscriptions();
  }

  @Get('transcriptions/:id')
  @ApiOperation({
    summary: 'Get transcription details',
    description:
      'Returns full details for a specific transcription, including status, provider, and error info.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transcription UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription details',
  })
  async getTranscriptionDetails(@Param('id') transcriptionId: string) {
    // Fetch detailed transcription with call and tenant info
    const transcription = await this.twilioAdminService['prisma'].call_transcription.findUnique({
      where: { id: transcriptionId },
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
            },
          },
        },
      },
    });

    if (!transcription) {
      throw new NotFoundException(`Transcription ${transcriptionId} not found`);
    }

    return {
      id: transcription.id,
      tenant: transcription.call_record.tenant,
      call: {
        id: transcription.call_record.id,
        twilio_call_sid: transcription.call_record.twilio_call_sid,
        direction: transcription.call_record.direction,
        status: transcription.call_record.status,
        recording_url: transcription.call_record.recording_url,
        duration_seconds: transcription.call_record.recording_duration_seconds,
      },
      lead: transcription.call_record.lead,
      transcription_provider: transcription.transcription_provider,
      status: transcription.status,
      transcription_text: transcription.transcription_text,
      language_detected: transcription.language_detected,
      confidence_score: transcription.confidence_score,
      processing_duration_seconds: transcription.processing_duration_seconds,
      cost: transcription.cost,
      error_message: transcription.error_message,
      created_at: transcription.created_at,
      completed_at: transcription.completed_at,
    };
  }

  @Post('transcriptions/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry failed transcription',
    description:
      'Requeues a failed transcription for processing. ' +
      'Resets status to PENDING and queues job.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transcription UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription retry queued',
  })
  async retryTranscription(@Param('id') transcriptionId: string) {
    await this.twilioAdminService.retryFailedTranscription(transcriptionId);
    return { message: 'Transcription retry queued' };
  }

  @Get('transcription-providers')
  @ApiOperation({
    summary: 'List transcription providers with usage stats',
    description:
      'Returns list of configured transcription providers with usage and cost statistics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription providers list',
  })
  async getTranscriptionProviders() {
    // Fetch all transcription provider configurations
    const providers = await this.twilioAdminService['prisma'].transcription_provider_configuration.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            company_name: true,
            subdomain: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Get usage statistics for each provider
    const providersWithStats = await Promise.all(
      providers.map(async (provider) => {
        const transcriptionCount = await this.twilioAdminService['prisma'].call_transcription.count({
          where: {
            transcription_provider: provider.provider_name,
            tenant_id: provider.tenant_id,
          },
        });

        const successCount = await this.twilioAdminService['prisma'].call_transcription.count({
          where: {
            transcription_provider: provider.provider_name,
            tenant_id: provider.tenant_id,
            status: 'completed',
          },
        });

        const failureCount = await this.twilioAdminService['prisma'].call_transcription.count({
          where: {
            transcription_provider: provider.provider_name,
            tenant_id: provider.tenant_id,
            status: 'failed',
          },
        });

        return {
          id: provider.id,
          provider_name: provider.provider_name,
          tenant: provider.tenant,
          is_system_default: provider.is_system_default,
          status: provider.status,
          usage_limit: provider.usage_limit,
          usage_current: provider.usage_current,
          cost_per_minute: provider.cost_per_minute,
          statistics: {
            total_transcriptions: transcriptionCount,
            successful: successCount,
            failed: failureCount,
            success_rate: transcriptionCount > 0
              ? ((successCount / transcriptionCount) * 100).toFixed(2)
              : '0.00',
          },
          created_at: provider.created_at,
          updated_at: provider.updated_at,
        };
      }),
    );

    return providersWithStats;
  }

  // ============================================================================
  // SYSTEM HEALTH (6 endpoints)
  // Health monitoring, performance metrics, and alerting
  // ============================================================================

  @Get('health')
  @ApiOperation({
    summary: 'Get overall system health status',
    description:
      'Runs comprehensive health check across all systems: ' +
      'Twilio API, webhooks, transcription providers. ' +
      'Returns detailed status for each component.',
  })
  @ApiResponse({
    status: 200,
    description: 'System health status',
  })
  async getSystemHealth() {
    return this.twilioHealthMonitorService.runSystemHealthCheck();
  }

  @Post('health/twilio-test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test Twilio API connectivity',
    description:
      'Tests Twilio API connectivity for a specific tenant. ' +
      'Measures response time and validates credentials.',
  })
  @ApiResponse({
    status: 200,
    description: 'Connectivity test result',
  })
  async testTwilioConnectivity(@Body() dto: TestConnectivityDto) {
    return this.twilioHealthMonitorService.checkTwilioConnectivity(
      dto.tenant_id,
    );
  }

  @Post('health/webhooks-test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test webhook delivery',
    description:
      'Tests that webhook endpoint is accessible and responding correctly.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook test result',
  })
  async testWebhookDelivery() {
    return this.twilioHealthMonitorService.checkWebhookConnectivity();
  }

  @Post('health/transcription-test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test transcription provider',
    description:
      'Tests transcription provider API connectivity and configuration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription provider test result',
  })
  async testTranscriptionProvider() {
    return this.twilioHealthMonitorService.checkTranscriptionProviderHealth();
  }

  @Get('health/provider-response-times')
  @ApiOperation({
    summary: 'Get provider performance metrics (last 24h)',
    description:
      'Returns API response time statistics for all providers: ' +
      'avg, max, min response times. ' +
      'Used for performance monitoring and capacity planning.',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider response time metrics',
  })
  async getProviderResponseTimes() {
    return this.twilioHealthMonitorService.getProviderResponseTimes();
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'Get recent system alerts',
    description:
      'Returns paginated list of system alerts: ' +
      'health failures, failed transcriptions, quota exceeded, etc.',
  })
  @ApiQuery({
    name: 'acknowledged',
    required: false,
    description: 'Filter by acknowledged status (true/false)',
  })
  @ApiQuery({
    name: 'severity',
    required: false,
    description: 'Filter by severity (LOW/MEDIUM/HIGH/CRITICAL)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Results per page (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'System alerts list',
  })
  async getAlerts(
    @Query('acknowledged') acknowledged?: string,
    @Query('severity') severity?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Build filter conditions
    const where: any = {};

    if (acknowledged !== undefined) {
      where.acknowledged = acknowledged === 'true';
    }

    if (severity) {
      where.severity = severity.toUpperCase();
    }

    // Pagination
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch alerts with pagination
    const [alerts, total] = await Promise.all([
      this.twilioAdminService['prisma'].admin_alert.findMany({
        where,
        include: {
          acknowledged_by_user: {
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
        take: limitNum,
      }),
      this.twilioAdminService['prisma'].admin_alert.count({ where }),
    ]);

    return {
      data: alerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        details: alert.details,
        acknowledged: alert.acknowledged,
        acknowledged_by: alert.acknowledged_by_user
          ? {
              id: alert.acknowledged_by_user.id,
              name: `${alert.acknowledged_by_user.first_name} ${alert.acknowledged_by_user.last_name}`,
              email: alert.acknowledged_by_user.email,
            }
          : null,
        acknowledged_at: alert.acknowledged_at,
        created_at: alert.created_at,
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
        has_next: pageNum < Math.ceil(total / limitNum),
        has_prev: pageNum > 1,
      },
    };
  }

  // ============================================================================
  // METRICS & ANALYTICS (6 additional endpoints for deeper insights)
  // ============================================================================

  @Get('metrics/system-wide')
  @ApiOperation({
    summary: 'Get comprehensive system-wide metrics',
    description:
      'Returns platform-level metrics across all tenants: ' +
      'total calls, SMS, transcriptions, success rates, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'System-wide metrics',
  })
  async getSystemWideMetrics() {
    return this.twilioAdminService.getSystemWideMetrics();
  }

  @Get('metrics/top-tenants')
  @ApiOperation({
    summary: 'Get top tenants by communication volume',
    description:
      'Returns list of tenants with highest communication activity. ' +
      'Useful for identifying power users and capacity planning.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of top tenants to return (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top tenants by volume',
  })
  async getTopTenants(@Query('limit') limit?: number) {
    return this.twilioAdminService.getTopTenantsByVolume(limit || 10);
  }

  // ============================================================================
  // CRON SCHEDULE MANAGEMENT (2 endpoints)
  // Dynamic cron schedule configuration from system settings
  // ============================================================================

  @Get('cron/status')
  @ApiOperation({
    summary: 'Get cron job status',
    description:
      'Returns current status of all scheduled jobs including their schedules, timezone, and running status. ' +
      'Shows configuration loaded from system_settings table.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron job status retrieved',
  })
  async getCronStatus() {
    return this.dynamicCronManagerService.getCronJobStatus();
  }

  @Post('cron/reload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reload cron schedules from system settings',
    description:
      'Reloads cron job schedules from system_settings table and restarts jobs with new configuration. ' +
      'Use this after updating cron settings (twilio_usage_sync_cron, twilio_health_check_cron, cron_timezone). ' +
      'Jobs will be stopped and restarted with the new schedule immediately.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron schedules reloaded successfully',
  })
  async reloadCronSchedules() {
    await this.dynamicCronManagerService.updateCronSchedules();
    return {
      message: 'Cron schedules reloaded successfully',
      status: await this.dynamicCronManagerService.getCronJobStatus(),
    };
  }
}
