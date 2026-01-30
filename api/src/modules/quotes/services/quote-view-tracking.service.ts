import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import * as crypto from 'crypto';

/**
 * QuoteViewTrackingService
 *
 * Tracks quote views from public URLs and provides analytics.
 *
 * Key Features:
 * - Log every view (IP, device, duration)
 * - Calculate analytics (total views, unique viewers)
 * - Device detection from User-Agent
 * - Engagement scoring
 * - GDPR compliance (anonymize IPs after 90 days)
 *
 * @author Developer 5
 */
@Injectable()
export class QuoteViewTrackingService {
  private readonly logger = new Logger(QuoteViewTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Log a quote view
   *
   * @param token - Public access token
   * @param ipAddress - Client IP
   * @param userAgent - Browser User-Agent
   * @param referrerUrl - HTTP Referer
   * @param durationSeconds - Time spent viewing (optional)
   */
  async logView(
    token: string,
    ipAddress: string,
    userAgent: string,
    referrerUrl: string | null | undefined,
    durationSeconds: number | null | undefined,
  ): Promise<void> {
    // 1. Get quote_id from token
    const publicAccess = await this.prisma.quote_public_access.findUnique({
      where: { access_token: token },
      include: { quote: true },
    });

    if (!publicAccess) {
      this.logger.warn(`View log attempt with invalid token: ${token}`);
      return; // Silently fail for invalid tokens
    }

    const quoteId = publicAccess.quote_id;

    // 2. Detect device type
    const deviceType = this.detectDeviceType(userAgent);

    // 3. Create view log
    await this.prisma.quote_view_log.create({
      data: {
        id: crypto.randomUUID(),
        quote_id: quoteId,
        public_token: token,
        ip_address: ipAddress,
        device_type: deviceType,
        referrer_url: referrerUrl || null,
        view_duration_seconds: durationSeconds || null,
      },
    });

    this.logger.log(
      `Logged view for quote ${quoteId} via token ${token} from IP ${ipAddress} (${deviceType})`,
    );

    // 4. Check if this is the first view (sent/delivered/opened → read status change)
    const viewCount = await this.prisma.quote_view_log.count({
      where: { quote_id: quoteId },
    });

    if (viewCount === 1 && ['sent', 'delivered', 'opened'].includes(publicAccess.quote.status)) {
      // First view detected, update status to 'read'
      await this.prisma.quote.update({
        where: { id: quoteId },
        data: { status: 'read' },
      });

      this.logger.log(`Quote ${quoteId} status changed from '${publicAccess.quote.status}' to 'read' (first public URL view)`);
    }
  }

  /**
   * Log a quote download (PDF)
   *
   * @param token - Public access token
   * @param ipAddress - Client IP
   * @param userAgent - Browser User-Agent
   * @param fileId - File ID of downloaded PDF (optional)
   */
  async logDownload(
    token: string,
    ipAddress: string,
    userAgent: string,
    fileId: string | null | undefined,
  ): Promise<void> {
    // 1. Get quote_id from token
    const publicAccess = await this.prisma.quote_public_access.findUnique({
      where: { access_token: token },
      include: { quote: true },
    });

    if (!publicAccess) {
      this.logger.warn(`Download log attempt with invalid token: ${token}`);
      return; // Silently fail for invalid tokens
    }

    const quoteId = publicAccess.quote_id;

    // 2. Detect device type
    const deviceType = this.detectDeviceType(userAgent);

    // 3. Create download log
    await this.prisma.quote_download_log.create({
      data: {
        id: crypto.randomUUID(),
        quote_id: quoteId,
        public_token: token,
        ip_address: ipAddress,
        device_type: deviceType,
        file_id: fileId || null,
        download_type: 'pdf',
      },
    });

    this.logger.log(
      `Logged PDF download for quote ${quoteId} via token ${token} from IP ${ipAddress} (${deviceType})`,
    );

    // 4. Check if this is the first download (read/opened → downloaded status change)
    const downloadCount = await this.prisma.quote_download_log.count({
      where: { quote_id: quoteId },
    });

    if (downloadCount === 1 && ['read', 'opened'].includes(publicAccess.quote.status)) {
      // First download detected, update status to 'downloaded'
      await this.prisma.quote.update({
        where: { id: quoteId },
        data: { status: 'downloaded' },
      });

      this.logger.log(`Quote ${quoteId} status changed from '${publicAccess.quote.status}' to 'downloaded' (first PDF download)`);
    }
  }

  /**
   * Get analytics for a quote
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @returns Analytics data
   */
  async getAnalytics(tenantId: string, quoteId: string) {
    // Validate quote belongs to tenant
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
    });

    if (!quote) {
      throw new Error(`Quote ${quoteId} not found for tenant ${tenantId}`);
    }

    // Get all view logs and download logs for this quote
    const [viewLogs, downloadLogs] = await Promise.all([
      this.prisma.quote_view_log.findMany({
        where: { quote_id: quoteId },
        orderBy: { viewed_at: 'asc' },
      }),
      this.prisma.quote_download_log.findMany({
        where: { quote_id: quoteId },
        orderBy: { downloaded_at: 'asc' },
      }),
    ]);

    const totalViews = viewLogs.length;
    const totalDownloads = downloadLogs.length;

    if (totalViews === 0 && totalDownloads === 0) {
      // No activity yet, return empty analytics
      return {
        quote_id: quoteId,
        quote_status: quote.status, // Current quote status
        total_views: 0,
        unique_viewers: 0,
        average_duration_seconds: null,
        engagement_score: 0,
        views_by_date: [],
        views_by_device: {
          desktop: 0,
          mobile: 0,
          tablet: 0,
          unknown: 0,
        },
        first_viewed_at: null,
        last_viewed_at: null,
        total_downloads: 0,
        downloads_by_date: [],
        downloads_by_device: {
          desktop: 0,
          mobile: 0,
          tablet: 0,
          unknown: 0,
        },
        first_downloaded_at: null,
        last_downloaded_at: null,
      };
    }

    // Calculate unique viewers (distinct IP addresses) - only if we have views
    const uniqueIps = totalViews > 0 ? new Set(viewLogs.map((log) => log.ip_address)) : new Set();
    const uniqueViewers = uniqueIps.size;

    // Calculate average duration - only if we have views
    const durationsWithValues = totalViews > 0
      ? viewLogs
          .filter((log) => log.view_duration_seconds !== null)
          .map((log) => log.view_duration_seconds as number)
      : [];

    const averageDuration =
      durationsWithValues.length > 0
        ? durationsWithValues.reduce((sum, d) => sum + d, 0) / durationsWithValues.length
        : null;

    // Calculate engagement score
    const engagementScore = this.calculateEngagementScore(
      totalViews,
      uniqueViewers,
      averageDuration || 0,
    );

    // Group views by date
    const viewsByDateMap = new Map<string, number>();
    if (totalViews > 0) {
      viewLogs.forEach((log) => {
        const date = log.viewed_at.toISOString().split('T')[0]; // YYYY-MM-DD
        viewsByDateMap.set(date, (viewsByDateMap.get(date) || 0) + 1);
      });
    }

    const viewsByDate = Array.from(viewsByDateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group views by device type
    const viewsByDevice = {
      desktop: totalViews > 0 ? viewLogs.filter((log) => log.device_type === 'desktop').length : 0,
      mobile: totalViews > 0 ? viewLogs.filter((log) => log.device_type === 'mobile').length : 0,
      tablet: totalViews > 0 ? viewLogs.filter((log) => log.device_type === 'tablet').length : 0,
      unknown: totalViews > 0 ? viewLogs.filter((log) => log.device_type === 'unknown').length : 0,
    };

    // First and last viewed times
    const firstViewedAt = viewLogs[0]?.viewed_at.toISOString() || null;
    const lastViewedAt = viewLogs[viewLogs.length - 1]?.viewed_at.toISOString() || null;

    // Group downloads by date
    const downloadsByDateMap = new Map<string, number>();
    if (totalDownloads > 0) {
      downloadLogs.forEach((log) => {
        const date = log.downloaded_at.toISOString().split('T')[0]; // YYYY-MM-DD
        downloadsByDateMap.set(date, (downloadsByDateMap.get(date) || 0) + 1);
      });
    }

    const downloadsByDate = Array.from(downloadsByDateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group downloads by device type
    const downloadsByDevice = {
      desktop: totalDownloads > 0 ? downloadLogs.filter((log) => log.device_type === 'desktop').length : 0,
      mobile: totalDownloads > 0 ? downloadLogs.filter((log) => log.device_type === 'mobile').length : 0,
      tablet: totalDownloads > 0 ? downloadLogs.filter((log) => log.device_type === 'tablet').length : 0,
      unknown: totalDownloads > 0 ? downloadLogs.filter((log) => log.device_type === 'unknown').length : 0,
    };

    // First and last download times
    const firstDownloadedAt = downloadLogs[0]?.downloaded_at.toISOString() || null;
    const lastDownloadedAt = downloadLogs[downloadLogs.length - 1]?.downloaded_at.toISOString() || null;

    return {
      quote_id: quoteId,
      quote_status: quote.status, // Current quote status (draft, ready, sent, delivered, read, opened, approved, etc.)
      total_views: totalViews,
      unique_viewers: uniqueViewers,
      average_duration_seconds: averageDuration,
      engagement_score: engagementScore,
      views_by_date: viewsByDate,
      views_by_device: viewsByDevice,
      first_viewed_at: firstViewedAt,
      last_viewed_at: lastViewedAt,
      total_downloads: totalDownloads,
      downloads_by_date: downloadsByDate,
      downloads_by_device: downloadsByDevice,
      first_downloaded_at: firstDownloadedAt,
      last_downloaded_at: lastDownloadedAt,
    };
  }

  /**
   * Get view history with pagination
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated view logs
   */
  async getViewHistory(tenantId: string, quoteId: string, page: number, limit: number) {
    // Validate quote belongs to tenant
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
    });

    if (!quote) {
      throw new Error(`Quote ${quoteId} not found for tenant ${tenantId}`);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const total = await this.prisma.quote_view_log.count({
      where: { quote_id: quoteId },
    });

    // Get paginated view logs
    const viewLogs = await this.prisma.quote_view_log.findMany({
      where: { quote_id: quoteId },
      orderBy: { viewed_at: 'desc' }, // Most recent first
      skip,
      take: limit,
    });

    // Format response
    const data = viewLogs.map((log) => ({
      id: log.id,
      quote_id: log.quote_id,
      public_token: log.public_token,
      ip_address: log.ip_address,
      device_type: log.device_type,
      referrer_url: log.referrer_url,
      view_duration_seconds: log.view_duration_seconds,
      viewed_at: log.viewed_at.toISOString(),
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Anonymize IP addresses older than 90 days (GDPR compliance)
   *
   * @returns Count of anonymized records
   */
  async anonymizeOldViews(): Promise<number> {
    // Calculate cutoff date (90 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    this.logger.log(`Anonymizing view logs older than ${cutoffDate.toISOString()}`);

    // Find all view logs older than 90 days that haven't been anonymized yet
    const logsToAnonymize = await this.prisma.quote_view_log.findMany({
      where: {
        viewed_at: {
          lt: cutoffDate,
        },
        ip_address: {
          not: 'anonymized',
        },
      },
      select: {
        id: true,
      },
    });

    const count = logsToAnonymize.length;

    if (count === 0) {
      this.logger.log('No view logs to anonymize');
      return 0;
    }

    // Anonymize IP addresses
    await this.prisma.quote_view_log.updateMany({
      where: {
        id: {
          in: logsToAnonymize.map((log) => log.id),
        },
      },
      data: {
        ip_address: 'anonymized',
      },
    });

    this.logger.log(`Anonymized ${count} view logs for GDPR compliance`);

    return count;
  }

  /**
   * Detect device type from User-Agent
   *
   * @param userAgent - Browser User-Agent string
   * @returns Device type
   */
  private detectDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone/i.test(ua)) return 'mobile';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    if (/windows|mac|linux/i.test(ua)) return 'desktop';
    return 'unknown';
  }

  /**
   * Calculate engagement score (0-100)
   *
   * @param totalViews - Total view count
   * @param uniqueViewers - Unique IP count
   * @param avgDuration - Average viewing duration
   * @returns Score from 0-100
   */
  private calculateEngagementScore(
    totalViews: number,
    uniqueViewers: number,
    avgDuration: number,
  ): number {
    const viewScore = Math.min(totalViews * 5, 40);
    const uniqueScore = Math.min(uniqueViewers * 10, 30);
    const durationScore = Math.min((avgDuration || 0) / 10, 30);
    return Math.round(viewScore + uniqueScore + durationScore);
  }
}
