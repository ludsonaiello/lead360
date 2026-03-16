import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  startOfMonth,
  subMonths,
  subDays,
  startOfDay,
  endOfDay,
  format,
} from 'date-fns';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all dashboard metrics in parallel
   */
  async getMetrics() {
    try {
      const [
        activeTenants,
        tenantsGrowth,
        totalUsers,
        usersGrowth,
        jobSuccessRate,
        storageUsed,
        systemHealth,
        communicationMetrics,
      ] = await Promise.all([
        this.getActiveTenants(),
        this.getTenantsGrowth(),
        this.getTotalUsers(),
        this.getUsersGrowth(),
        this.getJobSuccessRate(),
        this.getStorageUsed(),
        this.getSystemHealth(),
        this.getCommunicationMetrics(), // Sprint 8: Twilio metrics
      ]);

      return {
        activeTenants: {
          count: activeTenants,
          growth: tenantsGrowth,
          sparkline: await this.getTenantSparkline(),
        },
        totalUsers: {
          count: totalUsers,
          growth: usersGrowth,
          sparkline: await this.getUserSparkline(),
        },
        jobSuccessRate: {
          percentage: jobSuccessRate.percentage,
          totalJobs: jobSuccessRate.totalJobs,
          failedJobs: jobSuccessRate.failedJobs,
          status:
            jobSuccessRate.percentage > 95
              ? 'healthy'
              : jobSuccessRate.percentage > 90
                ? 'warning'
                : 'critical',
        },
        storageUsed: {
          current: storageUsed.current,
          limit: storageUsed.limit,
          percentage:
            storageUsed.limit > 0
              ? (storageUsed.current / storageUsed.limit) * 100
              : 0,
        },
        systemHealth,
        communication: communicationMetrics, // Sprint 8: Twilio communication metrics
      };
    } catch (error) {
      this.logger.error(
        `Failed to get dashboard metrics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Count active tenants
   */
  async getActiveTenants(): Promise<number> {
    return await this.prisma.tenant.count({
      where: { is_active: true, deleted_at: null },
    });
  }

  /**
   * Calculate tenant growth (month-over-month)
   */
  async getTenantsGrowth() {
    const startOfCurrentMonth = startOfMonth(new Date());
    const startOfLastMonth = subMonths(startOfCurrentMonth, 1);

    const [newThisMonth, lastMonth] = await Promise.all([
      this.prisma.tenant.count({
        where: {
          created_at: { gte: startOfCurrentMonth },
        },
      }),
      this.prisma.tenant.count({
        where: {
          created_at: {
            gte: startOfLastMonth,
            lt: startOfCurrentMonth,
          },
        },
      }),
    ]);

    const percentageChange =
      lastMonth > 0 ? ((newThisMonth - lastMonth) / lastMonth) * 100 : 100;

    return {
      count: newThisMonth,
      percentage: Math.round(percentageChange * 10) / 10,
      trend:
        percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable',
    };
  }

  /**
   * Count total users across all tenants
   */
  async getTotalUsers(): Promise<number> {
    return await this.prisma.user.count({
      where: { deleted_at: null, is_active: true },
    });
  }

  /**
   * Calculate user growth (month-over-month)
   */
  async getUsersGrowth() {
    const startOfCurrentMonth = startOfMonth(new Date());
    const startOfLastMonth = subMonths(startOfCurrentMonth, 1);

    const [newThisMonth, lastMonth] = await Promise.all([
      this.prisma.user.count({
        where: {
          created_at: { gte: startOfCurrentMonth },
        },
      }),
      this.prisma.user.count({
        where: {
          created_at: {
            gte: startOfLastMonth,
            lt: startOfCurrentMonth,
          },
        },
      }),
    ]);

    const percentageChange =
      lastMonth > 0 ? ((newThisMonth - lastMonth) / lastMonth) * 100 : 100;

    return {
      count: newThisMonth,
      percentage: Math.round(percentageChange * 10) / 10,
      trend:
        percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable',
    };
  }

  /**
   * Calculate job success rate (last 24 hours)
   */
  async getJobSuccessRate() {
    const last24Hours = subDays(new Date(), 1);

    const [totalJobs, failedJobs] = await Promise.all([
      this.prisma.job.count({
        where: {
          created_at: { gte: last24Hours },
        },
      }),
      this.prisma.job.count({
        where: {
          created_at: { gte: last24Hours },
          status: 'failed',
        },
      }),
    ]);

    const successRate =
      totalJobs > 0 ? ((totalJobs - failedJobs) / totalJobs) * 100 : 100;

    return {
      percentage: Math.round(successRate * 10) / 10,
      totalJobs,
      failedJobs,
    };
  }

  /**
   * Get total storage used across all tenants
   */
  async getStorageUsed() {
    const totalSize = await this.prisma.file.aggregate({
      _sum: {
        size_bytes: true,
      },
      where: {
        is_trashed: false,
      },
    });

    // Get storage limit from system settings
    const storageLimitSetting = await this.prisma.system_setting.findUnique({
      where: { setting_key: 'max_storage_per_tenant_gb' },
    });

    const storageLimitPerTenantGB = storageLimitSetting
      ? parseInt(storageLimitSetting.setting_value, 10)
      : 500;

    const tenantCount = await this.getActiveTenants();
    const totalLimitGB = storageLimitPerTenantGB * tenantCount;

    const currentGB = (totalSize._sum.size_bytes || 0) / (1024 * 1024 * 1024);

    return {
      current: Math.round(currentGB * 100) / 100,
      limit: totalLimitGB,
    };
  }

  /**
   * Check system health (database, Redis connectivity)
   */
  async getSystemHealth() {
    const checks = {
      database: false,
      redis: false, // Will be implemented when Redis health check is available
    };

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
    }

    const allHealthy = Object.values(checks).every((check) => check === true);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks,
    };
  }

  /**
   * Get tenant sparkline data (last 30 days)
   */
  async getTenantSparkline(): Promise<number[]> {
    const last30Days = subDays(new Date(), 30);
    const dailyCounts: number[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const startOfDayDate = startOfDay(date);
      const endOfDayDate = endOfDay(date);

      const count = await this.prisma.tenant.count({
        where: {
          created_at: {
            gte: startOfDayDate,
            lte: endOfDayDate,
          },
        },
      });

      dailyCounts.push(count);
    }

    return dailyCounts;
  }

  /**
   * Get user sparkline data (last 30 days)
   */
  async getUserSparkline(): Promise<number[]> {
    const last30Days = subDays(new Date(), 30);
    const dailyCounts: number[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const startOfDayDate = startOfDay(date);
      const endOfDayDate = endOfDay(date);

      const count = await this.prisma.user.count({
        where: {
          created_at: {
            gte: startOfDayDate,
            lte: endOfDayDate,
          },
        },
      });

      dailyCounts.push(count);
    }

    return dailyCounts;
  }

  /**
   * Get chart data based on chart type
   */
  async getChartData(chartType: string, params?: any) {
    switch (chartType) {
      case 'tenant-growth':
        return this.getTenantGrowthChart();
      case 'user-signups':
        return this.getUserSignupsChart();
      case 'job-trends':
        return this.getJobTrendsChart();
      case 'tenants-by-industry':
        return this.getTenantsByIndustryChart();
      case 'tenants-by-size':
        return this.getTenantsBySizeChart();
      case 'users-by-role':
        return this.getUsersByRoleChart();
      default:
        throw new Error(`Unknown chart type: ${chartType}`);
    }
  }

  /**
   * Tenant growth chart (last 90 days)
   */
  private async getTenantGrowthChart() {
    const last90Days = subDays(new Date(), 90);
    const data: { date: string; count: number; cumulative: number }[] = [];
    let cumulative = 0;

    for (let i = 89; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const startOfDayDate = startOfDay(date);
      const endOfDayDate = endOfDay(date);

      const count = await this.prisma.tenant.count({
        where: {
          created_at: {
            gte: startOfDayDate,
            lte: endOfDayDate,
          },
        },
      });

      cumulative += count;

      data.push({
        date: format(date, 'yyyy-MM-dd'),
        count,
        cumulative,
      });
    }

    return data;
  }

  /**
   * User signups chart (last 90 days)
   */
  private async getUserSignupsChart() {
    const last90Days = subDays(new Date(), 90);
    const data: { date: string; count: number; cumulative: number }[] = [];
    let cumulative = 0;

    for (let i = 89; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const startOfDayDate = startOfDay(date);
      const endOfDayDate = endOfDay(date);

      const count = await this.prisma.user.count({
        where: {
          created_at: {
            gte: startOfDayDate,
            lte: endOfDayDate,
          },
        },
      });

      cumulative += count;

      data.push({
        date: format(date, 'yyyy-MM-dd'),
        count,
        cumulative,
      });
    }

    return data;
  }

  /**
   * Job execution trends chart (last 7 days)
   */
  private async getJobTrendsChart() {
    const data: {
      date: string;
      success: number;
      failed: number;
      successRate: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const startOfDayDate = startOfDay(date);
      const endOfDayDate = endOfDay(date);

      const [success, failed] = await Promise.all([
        this.prisma.job.count({
          where: {
            created_at: { gte: startOfDayDate, lte: endOfDayDate },
            status: 'completed',
          },
        }),
        this.prisma.job.count({
          where: {
            created_at: { gte: startOfDayDate, lte: endOfDayDate },
            status: 'failed',
          },
        }),
      ]);

      const total = success + failed;
      const successRate = total > 0 ? (success / total) * 100 : 100;

      data.push({
        date: format(date, 'yyyy-MM-dd'),
        success,
        failed,
        successRate: Math.round(successRate * 10) / 10,
      });
    }

    return data;
  }

  /**
   * Tenants by industry distribution
   */
  private async getTenantsByIndustryChart() {
    // Since industry is not yet in schema, return placeholder data
    // TODO: Add industry field to tenant schema
    return [
      { industry: 'Painting', count: 0, percentage: 0 },
      { industry: 'Gutter', count: 0, percentage: 0 },
      { industry: 'Cleaning', count: 0, percentage: 0 },
      { industry: 'HVAC', count: 0, percentage: 0 },
      { industry: 'Plumbing', count: 0, percentage: 0 },
      { industry: 'Other', count: 0, percentage: 0 },
    ];
  }

  /**
   * Tenants by size distribution
   */
  private async getTenantsBySizeChart() {
    const tenants = await this.prisma.tenant.findMany({
      where: { is_active: true, deleted_at: null },
      select: {
        id: true,
        _count: {
          select: {
            memberships: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    let small = 0;
    let medium = 0;
    let large = 0;

    tenants.forEach((tenant) => {
      const userCount = tenant._count.memberships;
      if (userCount >= 1 && userCount <= 5) {
        small++;
      } else if (userCount >= 6 && userCount <= 20) {
        medium++;
      } else if (userCount >= 21) {
        large++;
      }
    });

    const total = small + medium + large;

    return [
      {
        size: 'Small (1-5 users)',
        count: small,
        percentage: total > 0 ? Math.round((small / total) * 100 * 10) / 10 : 0,
      },
      {
        size: 'Medium (6-20 users)',
        count: medium,
        percentage:
          total > 0 ? Math.round((medium / total) * 100 * 10) / 10 : 0,
      },
      {
        size: 'Large (21+ users)',
        count: large,
        percentage: total > 0 ? Math.round((large / total) * 100 * 10) / 10 : 0,
      },
    ];
  }

  /**
   * Users by role distribution
   */
  private async getUsersByRoleChart() {
    const userRoles = await this.prisma.user_role.groupBy({
      by: ['role_id'],
      _count: {
        role_id: true,
      },
    });

    // Fetch role names
    const roleIds = userRoles.map((ur) => ur.role_id);
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true },
    });

    const roleMap = new Map(roles.map((r) => [r.id, r.name]));
    const total = userRoles.reduce((sum, ur) => sum + ur._count.role_id, 0);

    return userRoles.map((ur) => ({
      role: roleMap.get(ur.role_id) || 'Unknown',
      count: ur._count.role_id,
      percentage:
        total > 0 ? Math.round((ur._count.role_id / total) * 100 * 10) / 10 : 0,
    }));
  }

  /**
   * Get recent activity feed (last 10 actions from audit log)
   */
  async getRecentActivity(limit = 10) {
    const activities = await this.prisma.audit_log.findMany({
      where: {
        action_type: { in: ['created', 'deleted', 'failed'] },
        entity_type: { in: ['tenant', 'user', 'job'] },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
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

    return activities.map((activity) => ({
      id: activity.id,
      action: activity.action_type,
      entity: activity.entity_type,
      entityId: activity.entity_id,
      description: activity.description,
      actor: activity.user
        ? {
            id: activity.user.id,
            name: `${activity.user.first_name} ${activity.user.last_name}`,
            email: activity.user.email,
          }
        : null,
      timestamp: activity.created_at,
      status: activity.status,
    }));
  }

  /**
   * Get Twilio Communication Metrics (Sprint 8)
   *
   * Returns comprehensive communication statistics for the admin dashboard.
   * Includes call counts, SMS counts, transcription stats, and 24h activity.
   */
  async getCommunicationMetrics() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const [
        totalCalls,
        totalSms,
        totalWhatsapp,
        totalTranscriptions,
        failedTranscriptions,
        calls24h,
        sms24h,
      ] = await Promise.all([
        // Total calls (all time)
        this.prisma.call_record.count(),

        // Total SMS (all time)
        this.prisma.communication_event.count({
          where: { channel: 'sms' },
        }),

        // Total WhatsApp (all time)
        this.prisma.communication_event.count({
          where: { channel: 'whatsapp' },
        }),

        // Total transcriptions
        this.prisma.call_transcription.count(),

        // Failed transcriptions
        this.prisma.call_transcription.count({
          where: { status: 'failed' },
        }),

        // Calls in last 24 hours
        this.prisma.call_record.count({
          where: {
            created_at: {
              gte: yesterday,
            },
          },
        }),

        // SMS in last 24 hours
        this.prisma.communication_event.count({
          where: {
            channel: 'sms',
            created_at: {
              gte: yesterday,
            },
          },
        }),
      ]);

      // Calculate transcription success rate
      const transcriptionSuccessRate =
        totalTranscriptions > 0
          ? (
              ((totalTranscriptions - failedTranscriptions) /
                totalTranscriptions) *
              100
            ).toFixed(2)
          : '0.00';

      return {
        total_calls: totalCalls,
        total_sms: totalSms,
        total_whatsapp: totalWhatsapp,
        total_communications: totalCalls + totalSms + totalWhatsapp,
        total_transcriptions: totalTranscriptions,
        failed_transcriptions: failedTranscriptions,
        transcription_success_rate: parseFloat(transcriptionSuccessRate),
        activity_last_24h: {
          calls: calls24h,
          sms: sms24h,
          total: calls24h + sms24h,
        },
        status:
          failedTranscriptions === 0
            ? 'healthy'
            : failedTranscriptions < totalTranscriptions * 0.05
              ? 'warning'
              : 'critical',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get communication metrics: ${error.message}`,
        error.stack,
      );
      // Return empty metrics on error
      return {
        total_calls: 0,
        total_sms: 0,
        total_whatsapp: 0,
        total_communications: 0,
        total_transcriptions: 0,
        failed_transcriptions: 0,
        transcription_success_rate: 0,
        activity_last_24h: {
          calls: 0,
          sms: 0,
          total: 0,
        },
        status: 'unknown',
      };
    }
  }
}
