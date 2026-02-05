import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'json2csv';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminTenantService } from './admin-tenant.service';
import {
  PricingBenchmarksResponseDto,
  PricingBenchmarkItemDto,
  PricingStatsDto,
  GenerateReportResponseDto,
  ReportStatusResponseDto,
  ReportType,
  ExportFormat,
} from '../dto/admin';

@Injectable()
export class AdminReportingService {
  private readonly logger = new Logger(AdminReportingService.name);
  private readonly CACHE_TTL_BENCHMARKS = 900; // 15 minutes
  private readonly EXPORTS_DIR = path.join(process.cwd(), 'exports');

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    @InjectQueue('export') private exportQueue: Queue,
    @InjectQueue('scheduled-reports') private scheduledReportsQueue: Queue,
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly adminTenantService: AdminTenantService,
  ) {
    // Ensure exports directory exists
    if (!fs.existsSync(this.EXPORTS_DIR)) {
      fs.mkdirSync(this.EXPORTS_DIR, { recursive: true });
      this.logger.log(`Created exports directory: ${this.EXPORTS_DIR}`);
    }
  }

  /**
   * Generate global pricing benchmarks across all tenants (anonymized)
   * @param filters - Filtering options
   * @returns Pricing benchmarks with anonymization
   */
  async generatePricingBenchmarks(filters: {
    item_title_contains?: string;
    min_tenant_count?: number;
    date_from?: Date;
    date_to?: Date;
    limit?: number;
  }): Promise<PricingBenchmarksResponseDto> {
    // Set defaults
    const minTenantCount = filters.min_tenant_count || 5;
    const limit = filters.limit || 50;
    const { dateFrom, dateTo } = this.getDefaultDateRange(
      filters.date_from,
      filters.date_to,
    );

    // Validate date range
    this.validateDateRange(dateFrom, dateTo);

    // Build cache key
    const cacheKey = `admin:pricing-benchmarks:${filters.item_title_contains || 'all'}:${dateFrom.toISOString()}:${dateTo.toISOString()}:${minTenantCount}:${limit}`;

    // Check cache
    const cached = await this.cacheService.get<PricingBenchmarksResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    this.logger.log(
      `Generating pricing benchmarks: date_from=${dateFrom.toISOString()}, date_to=${dateTo.toISOString()}, min_tenant_count=${minTenantCount}, limit=${limit}`,
    );

    // Query quote items with cross-tenant aggregation
    // Using raw SQL for complex aggregation with HAVING clause
    // SECURITY: Using parameterized queries to prevent SQL injection
    const titleFilter = filters.item_title_contains
      ? `AND LOWER(qi.title) LIKE LOWER(CONCAT('%', ?, '%'))`
      : '';

    const rawQuery = `
      SELECT
        LOWER(TRIM(qi.title)) as normalized_title,
        COUNT(DISTINCT q.tenant_id) as tenant_count,
        COUNT(*) as usage_count,
        AVG(qi.total_cost) as avg_price,
        MIN(qi.total_cost) as min_price,
        MAX(qi.total_cost) as max_price,
        STDDEV_POP(qi.total_cost) as std_deviation
      FROM quote_item qi
      JOIN quote q ON qi.quote_id = q.id
      WHERE qi.created_at >= ?
        AND qi.created_at <= ?
        AND q.is_archived = false
        ${titleFilter}
      GROUP BY normalized_title
      HAVING tenant_count >= ?
      ORDER BY usage_count DESC
      LIMIT ?
    `;

    // Build parameters array dynamically based on whether title filter is present
    const queryParams: any[] = [dateFrom, dateTo];
    if (filters.item_title_contains) {
      queryParams.push(filters.item_title_contains);
    }
    queryParams.push(minTenantCount, limit * 2); // Get more for median calculation

    const results: any[] = await this.prisma.$queryRawUnsafe(
      rawQuery,
      ...queryParams,
    );

    this.logger.log(`Found ${results.length} benchmarks meeting criteria`);

    // Calculate median for each benchmark group
    const benchmarksWithMedian = await Promise.all(
      results.map(async (result) => {
        const median = await this.calculateMedianPrice(
          result.normalized_title,
          dateFrom,
          dateTo,
        );
        return { ...result, median_price: median };
      }),
    );

    // Calculate total count (without limit)
    // SECURITY: Using same parameterized titleFilter as main query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT LOWER(TRIM(qi.title)) as normalized_title, COUNT(DISTINCT q.tenant_id) as tenant_count
        FROM quote_item qi
        JOIN quote q ON qi.quote_id = q.id
        WHERE qi.created_at >= ?
          AND qi.created_at <= ?
          AND q.is_archived = false
          ${titleFilter}
        GROUP BY normalized_title
        HAVING tenant_count >= ?
      ) as subquery
    `;

    // Build count parameters array (same logic as main query)
    const countParams: any[] = [dateFrom, dateTo];
    if (filters.item_title_contains) {
      countParams.push(filters.item_title_contains);
    }
    countParams.push(minTenantCount);

    const countResult: any[] = await this.prisma.$queryRawUnsafe(
      countQuery,
      ...countParams,
    );
    const totalCount = Number(countResult[0]?.total || 0);

    // Format benchmarks
    const benchmarks: PricingBenchmarkItemDto[] = benchmarksWithMedian
      .slice(0, limit)
      .map((row) => {
        const avgPrice = parseFloat(row.avg_price?.toString() || '0');
        const stdDev = parseFloat(row.std_deviation?.toString() || '0');
        const priceVariance = this.classifyPriceVariance(avgPrice, stdDev);

        return {
          task_title: row.normalized_title,
          tenant_count: Number(row.tenant_count),
          usage_count: Number(row.usage_count),
          pricing: {
            avg_price: parseFloat(avgPrice.toFixed(2)),
            min_price: parseFloat(
              parseFloat(row.min_price?.toString() || '0').toFixed(2),
            ),
            max_price: parseFloat(
              parseFloat(row.max_price?.toString() || '0').toFixed(2),
            ),
            median_price: parseFloat(row.median_price.toFixed(2)),
            std_deviation: parseFloat(stdDev.toFixed(2)),
          },
          price_variance: priceVariance,
        };
      });

    const response: PricingBenchmarksResponseDto = {
      benchmarks,
      privacy_notice: `Data anonymized, minimum ${minTenantCount} tenants per benchmark`,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
      min_tenant_count: minTenantCount,
      total_count: totalCount,
      returned_count: benchmarks.length,
    };

    // Cache result
    await this.cacheService.set(
      cacheKey,
      response,
      this.CACHE_TTL_BENCHMARKS,
    );

    return response;
  }

  /**
   * Calculate median price for a specific task title
   * @param normalizedTitle - Normalized task title
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @returns Median price
   */
  private async calculateMedianPrice(
    normalizedTitle: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<number> {
    const items = await this.prisma.quote_item.findMany({
      where: {
        created_at: { gte: dateFrom, lte: dateTo },
        quote: { is_archived: false },
      },
      select: { total_cost: true, title: true },
    });

    // Filter by normalized title
    const prices = items
      .filter((item) => item.title.toLowerCase().trim() === normalizedTitle)
      .map((item) => parseFloat(item.total_cost?.toString() || '0'))
      .sort((a, b) => a - b);

    if (prices.length === 0) return 0;

    const mid = Math.floor(prices.length / 2);
    if (prices.length % 2 === 0) {
      return (prices[mid - 1] + prices[mid]) / 2;
    } else {
      return prices[mid];
    }
  }

  /**
   * Classify price variance based on standard deviation relative to average
   * @param avgPrice - Average price
   * @param stdDev - Standard deviation
   * @returns Variance classification
   */
  private classifyPriceVariance(
    avgPrice: number,
    stdDev: number,
  ): 'low' | 'medium' | 'high' {
    if (avgPrice === 0) return 'low';

    const coefficientOfVariation = (stdDev / avgPrice) * 100;

    if (coefficientOfVariation < 20) return 'low';
    if (coefficientOfVariation < 50) return 'medium';
    return 'high';
  }

  /**
   * Get default date range (last 30 days if not provided)
   * @param dateFrom - Optional start date
   * @param dateTo - Optional end date
   * @returns Date range object
   */
  private getDefaultDateRange(
    dateFrom?: Date,
    dateTo?: Date,
  ): { dateFrom: Date; dateTo: Date } {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    return {
      dateFrom: dateFrom || thirtyDaysAgo,
      dateTo: dateTo || now,
    };
  }

  /**
   * Validate date range constraints
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @throws BadRequestException if validation fails
   */
  private validateDateRange(dateFrom: Date, dateTo: Date): void {
    const now = new Date();
    // Add 24 hour tolerance to handle timezone differences and end-of-day timestamps
    const futureThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (dateFrom > dateTo) {
      throw new BadRequestException('date_from must be before date_to');
    }

    if (dateTo > futureThreshold) {
      throw new BadRequestException('date_to cannot be in the future');
    }

    const rangeDays =
      (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays > 365) {
      throw new BadRequestException('Date range cannot exceed 365 days');
    }
  }

  // ============================================================================
  // REPORT GENERATION & QUEUEING
  // ============================================================================

  /**
   * Queue report generation job
   * @param reportType - Type of report
   * @param parameters - Report parameters
   * @param format - Export format
   * @param adminUserId - Admin user ID
   * @returns Job information
   */
  async queueReportGeneration(
    reportType: ReportType,
    parameters: {
      date_from: Date;
      date_to: Date;
      tenant_ids?: string[];
      group_by?: string;
    },
    format: ExportFormat,
    adminUserId: string,
    scheduledReportId?: string, // Optional: if this is from a scheduled report
  ): Promise<GenerateReportResponseDto> {
    // Validate parameters
    this.validateDateRange(parameters.date_from, parameters.date_to);

    const jobId = randomBytes(16).toString('hex');

    this.logger.log(
      `Queueing report generation: type=${reportType}, format=${format}, jobId=${jobId}${scheduledReportId ? `, scheduledReportId=${scheduledReportId}` : ''}`,
    );

    // Create export_job record with scheduledReportId in filters if provided
    const filters = { ...parameters } as any;
    if (scheduledReportId) {
      filters._scheduledReportId = scheduledReportId; // Store in filters for later retrieval
    }

    await this.prisma.export_job.create({
      data: {
        id: jobId,
        admin_user_id: adminUserId,
        export_type: reportType,
        format,
        filters,
        status: 'pending',
        created_at: new Date(),
      },
    });

    // Queue to BullMQ
    const jobData = {
      exportJobId: jobId,
      exportType: reportType,
      filters: parameters,
      format,
      scheduledReportId, // Pass through to processor
    };

    this.logger.log(`[DEBUG] Queuing job with data: ${JSON.stringify({ ...jobData, filters: 'omitted' })}`);

    await this.exportQueue.add(
      'process-export',
      jobData,
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    // Estimate completion time (2 minutes from now)
    const estimatedCompletion = new Date();
    estimatedCompletion.setMinutes(estimatedCompletion.getMinutes() + 2);

    return {
      job_id: jobId,
      status: 'queued',
      estimated_completion: estimatedCompletion.toISOString(),
    };
  }

  /**
   * Get report generation status
   * @param jobId - Job ID
   * @returns Report status
   */
  async getReportStatus(jobId: string): Promise<ReportStatusResponseDto> {
    const job = await this.prisma.export_job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Report job ${jobId} not found`);
    }

    // Map status
    let status: 'queued' | 'processing' | 'completed' | 'failed';
    if (job.status === 'pending') status = 'queued';
    else if (job.status === 'processing') status = 'processing';
    else if (job.status === 'completed') status = 'completed';
    else status = 'failed';

    const response: ReportStatusResponseDto = {
      job_id: job.id,
      status,
      report_type: job.export_type,
      format: job.format,
      created_at: job.created_at.toISOString(),
      completed_at: job.completed_at?.toISOString(),
      row_count: job.row_count || undefined,
      error_message: job.error_message || undefined,
    };

    // Add download URL if completed
    if (status === 'completed' && job.file_path) {
      response.download_url = `/admin/quotes/reports/${jobId}/download`;
      // Files expire after 24 hours
      const expiresAt = new Date(job.completed_at!);
      expiresAt.setHours(expiresAt.getHours() + 24);
      response.expires_at = expiresAt.toISOString();
    }

    return response;
  }

  /**
   * Generate quote summary report
   * @param params - Report parameters
   * @param format - Export format
   * @returns File path
   */
  async generateQuoteSummaryReport(
    params: { date_from: Date; date_to: Date; tenant_ids?: string[] },
    format: ExportFormat,
  ): Promise<string> {
    this.logger.log('Generating quote summary report');

    const { date_from, date_to, tenant_ids } = params;

    // Build query filters
    const where: any = {
      is_archived: false,
      created_at: {
        gte: date_from,
        lte: date_to,
      },
    };

    if (tenant_ids && tenant_ids.length > 0) {
      where.tenant_id = { in: tenant_ids };
    }

    // Fetch quotes with related data
    const quotes = await this.prisma.quote.findMany({
      where,
      include: {
        tenant: { select: { company_name: true, subdomain: true } },
        lead: { select: { first_name: true, last_name: true } },
        vendor: { select: { name: true } },
        created_by_user: { select: { first_name: true, last_name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 5000, // Limit to prevent memory issues
    });

    // Format for export
    const exportData = quotes.map((q) => ({
      'Quote Number': q.quote_number,
      Tenant: q.tenant?.company_name || '',
      'Customer Name': q.lead ? `${q.lead.first_name} ${q.lead.last_name}` : '',
      Vendor: q.vendor?.name || '',
      Status: q.status,
      Subtotal: q.subtotal ? parseFloat(q.subtotal.toString()) : 0,
      Total: q.total ? parseFloat(q.total.toString()) : 0,
      'Created By': q.created_by_user
        ? `${q.created_by_user.first_name} ${q.created_by_user.last_name}`
        : '',
      'Created At': q.created_at.toISOString(),
      'Expires At': q.expires_at?.toISOString() || '',
    }));

    const filename = `quote_summary_${Date.now()}`;
    return await this.exportReport(exportData, filename, format, 'Quote Summary Report');
  }

  /**
   * Generate tenant performance report
   * @param params - Report parameters
   * @param format - Export format
   * @returns File path
   */
  async generateTenantPerformanceReport(
    params: { date_from: Date; date_to: Date; tenant_ids?: string[] },
    format: ExportFormat,
  ): Promise<string> {
    this.logger.log('Generating tenant performance report');

    const { date_from, date_to, tenant_ids } = params;

    // Get tenant stats (reuse existing service)
    const tenants = await this.adminTenantService.listTenantsWithQuoteActivity(
      {
        status: 'all',
        sortBy: 'quote_count',
      },
      { page: 1, limit: 1000 },
    );

    // Filter by tenant_ids if provided
    let data = tenants.tenants;
    if (tenant_ids && tenant_ids.length > 0) {
      data = data.filter((t) => tenant_ids.includes(t.tenant_id));
    }

    // Format for export
    const exportData = data.map((tenant) => ({
      'Tenant ID': tenant.tenant_id,
      'Company Name': tenant.company_name,
      'Total Quotes': tenant.total_quotes,
      'Quotes Last 30 Days': tenant.quotes_last_30_days,
      'Total Revenue': tenant.total_revenue,
      'Conversion Rate (%)': tenant.conversion_rate,
      'Avg Quote Value': tenant.avg_quote_value,
      Status: tenant.is_active ? 'Active' : 'Inactive',
    }));

    const filename = `tenant_performance_${Date.now()}`;
    return await this.exportReport(exportData, filename, format, 'Tenant Performance Report');
  }

  /**
   * Generate revenue analysis report
   * @param params - Report parameters
   * @param format - Export format
   * @returns File path
   */
  async generateRevenueAnalysisReport(
    params: { date_from: Date; date_to: Date; group_by?: string },
    format: ExportFormat,
  ): Promise<string> {
    this.logger.log('Generating revenue analysis report');

    const { date_from, date_to, group_by } = params;

    // Get revenue analytics (reuse existing service)
    const analytics = await this.adminAnalyticsService.getRevenueAnalytics(
      date_from,
      date_to,
      group_by === 'none' ? undefined : (group_by as 'vendor' | 'tenant' | undefined),
    );

    // Format for export
    const exportData = analytics.breakdown.map((item) => ({
      Group: item.group_name,
      'Total Revenue': item.total_revenue,
      'Quote Count': item.quote_count,
      'Avg Quote Value': item.avg_quote_value,
      'Conversion Rate (%)': item.conversion_rate,
    }));

    const filename = `revenue_analysis_${Date.now()}`;
    return await this.exportReport(exportData, filename, format, 'Revenue Analysis Report');
  }

  /**
   * Generate conversion analysis report
   * @param params - Report parameters
   * @param format - Export format
   * @returns File path
   */
  async generateConversionAnalysisReport(
    params: { date_from: Date; date_to: Date },
    format: ExportFormat,
  ): Promise<string> {
    this.logger.log('Generating conversion analysis report');

    const { date_from, date_to } = params;

    // Get conversion funnel (reuse existing service)
    const funnel = await this.adminAnalyticsService.getConversionFunnel(
      date_from,
      date_to,
    );

    // Format for export
    const exportData = funnel.stages.map((stage) => ({
      Stage: stage.stage_name,
      Count: stage.count,
      'Percentage (%)': stage.percentage,
      'Conversion Rate from Previous (%)': stage.conversion_rate_from_previous || 'N/A',
    }));

    const filename = `conversion_analysis_${Date.now()}`;
    return await this.exportReport(exportData, filename, format, 'Conversion Analysis Report');
  }

  // ============================================================================
  // EXPORT UTILITIES
  // ============================================================================

  /**
   * Export report in specified format
   * @param data - Data to export
   * @param filename - Base filename (without extension)
   * @param format - Export format
   * @param title - Report title (for PDF)
   * @returns File path
   */
  private async exportReport(
    data: any[],
    filename: string,
    format: ExportFormat,
    title: string,
  ): Promise<string> {
    switch (format) {
      case ExportFormat.CSV:
        return await this.exportToCSV(data, filename);
      case ExportFormat.XLSX:
        return await this.exportToXLSX(data, filename);
      case ExportFormat.PDF:
        return await this.exportToPDF(data, filename, title);
      default:
        throw new BadRequestException(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export to CSV
   * @param data - Data array
   * @param filename - Filename without extension
   * @returns File path
   */
  private async exportToCSV(data: any[], filename: string): Promise<string> {
    const parser = new Parser();
    const csv = parser.parse(data);

    const filePath = path.join(this.EXPORTS_DIR, `${filename}.csv`);
    fs.writeFileSync(filePath, csv);

    this.logger.log(`CSV exported: ${filePath}`);
    return filePath;
  }

  /**
   * Export to XLSX
   * @param data - Data array
   * @param filename - Filename without extension
   * @returns File path
   */
  private async exportToXLSX(data: any[], filename: string): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    if (data.length > 0) {
      // Add headers
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data rows
      data.forEach((row) => {
        const values = headers.map((header) => row[header]);
        worksheet.addRow(values);
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, cellValue.length);
        });
        column.width = Math.min(maxLength + 2, 50);
      });
    }

    const filePath = path.join(this.EXPORTS_DIR, `${filename}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    this.logger.log(`XLSX exported: ${filePath}`);
    return filePath;
  }

  /**
   * Export to PDF
   * @param data - Data array
   * @param filename - Filename without extension
   * @param title - Report title
   * @returns File path
   */
  private async exportToPDF(
    data: any[],
    filename: string,
    title: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.EXPORTS_DIR, `${filename}.pdf`);
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Title
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();

      // Date range
      doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, {
        align: 'center',
      });
      doc.moveDown(2);

      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const columnWidth = (doc.page.width - 100) / headers.length;

        // Table headers
        doc.fontSize(10).font('Helvetica-Bold');
        let x = 50;
        headers.forEach((header) => {
          doc.text(header, x, doc.y, {
            width: columnWidth,
            align: 'left',
          });
          x += columnWidth;
        });
        doc.moveDown();

        // Table rows
        doc.font('Helvetica').fontSize(9);
        data.forEach((row) => {
          x = 50;
          const y = doc.y;
          headers.forEach((header) => {
            const value = row[header]?.toString() || '';
            doc.text(value, x, y, {
              width: columnWidth,
              align: 'left',
            });
            x += columnWidth;
          });
          doc.moveDown(0.5);

          // Add new page if needed
          if (doc.y > doc.page.height - 100) {
            doc.addPage();
          }
        });
      } else {
        doc.text('No data available', { align: 'center' });
      }

      doc.end();

      stream.on('finish', () => {
        this.logger.log(`PDF exported: ${filePath}`);
        resolve(filePath);
      });

      stream.on('error', (err) => {
        this.logger.error(`PDF export failed: ${err.message}`);
        reject(err);
      });
    });
  }

  // ========================================================================
  // SCHEDULED REPORTS (Phase 3)
  // ========================================================================

  /**
   * Create a scheduled report
   * @param adminUserId - Admin user creating the schedule
   * @param dto - Scheduled report data
   * @returns Created scheduled report
   */
  async createScheduledReport(
    adminUserId: string,
    dto: {
      name: string;
      report_type: ReportType;
      schedule: 'daily' | 'weekly' | 'monthly';
      parameters?: {
        date_from?: string;
        date_to?: string;
        tenant_ids?: string[];
        group_by?: string;
      };
      format: ExportFormat;
      recipients: string[];
      is_active?: boolean;
    },
  ): Promise<any> {
    this.logger.log(
      `Creating scheduled report: ${dto.name} for admin ${adminUserId}`,
    );

    // Calculate next_run_at based on schedule
    const next_run_at = this.calculateNextRunTime(dto.schedule);

    // Default parameters if not provided (last 30 days)
    const parameters = dto.parameters || {
      date_from: 'relative:-30d',
      date_to: 'relative:now',
    };

    const scheduledReport = await this.prisma.scheduled_report.create({
      data: {
        admin_user_id: adminUserId,
        name: dto.name,
        report_type: dto.report_type,
        schedule: dto.schedule,
        parameters,
        format: dto.format,
        recipients: dto.recipients,
        is_active: dto.is_active !== undefined ? dto.is_active : true,
        next_run_at,
      },
      include: {
        admin_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // Schedule BullMQ repeatable job if active
    if (scheduledReport.is_active) {
      const cronPattern = this.getCronPattern(dto.schedule);
      await this.scheduledReportsQueue.add(
        'scheduled-report',
        {
          scheduledReportId: scheduledReport.id,
          report_type: dto.report_type,
          parameters,
          format: dto.format,
        },
        {
          repeat: {
            pattern: cronPattern,
          },
          jobId: `scheduled-report-${scheduledReport.id}`,
        },
      );
      this.logger.log(
        `BullMQ repeatable job created for scheduled report: ${scheduledReport.id} with cron: ${cronPattern}`,
      );
    }

    this.logger.log(`Scheduled report created: ${scheduledReport.id}`);
    return scheduledReport;
  }

  /**
   * List all scheduled reports for platform admin
   * @returns List of scheduled reports
   */
  async listScheduledReports(): Promise<any[]> {
    this.logger.log('Fetching all scheduled reports');

    const reports = await this.prisma.scheduled_report.findMany({
      include: {
        admin_user: {
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
    });

    this.logger.log(`Found ${reports.length} scheduled reports`);
    return reports;
  }

  /**
   * Get a single scheduled report by ID
   * @param id - Scheduled report ID
   * @returns Scheduled report details
   */
  async getScheduledReport(id: string): Promise<any> {
    this.logger.log(`Fetching scheduled report: ${id}`);

    const report = await this.prisma.scheduled_report.findUnique({
      where: { id },
      include: {
        admin_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException(`Scheduled report ${id} not found`);
    }

    return report;
  }

  /**
   * Update a scheduled report
   * @param id - Scheduled report ID
   * @param dto - Update data
   * @returns Updated scheduled report
   */
  async updateScheduledReport(
    id: string,
    dto: {
      name?: string;
      schedule?: 'daily' | 'weekly' | 'monthly';
      parameters?: {
        date_from?: string;
        date_to?: string;
        tenant_ids?: string[];
        group_by?: string;
      };
      format?: ExportFormat;
      recipients?: string[];
      is_active?: boolean;
    },
  ): Promise<any> {
    this.logger.log(`Updating scheduled report: ${id}`);

    // Check if report exists
    const existingReport = await this.getScheduledReport(id);

    // If schedule is being changed, recalculate next_run_at
    const updateData: any = { ...dto };
    if (dto.schedule) {
      updateData.next_run_at = this.calculateNextRunTime(dto.schedule);
    }

    const updated = await this.prisma.scheduled_report.update({
      where: { id },
      data: updateData,
      include: {
        admin_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // Reschedule BullMQ job if schedule changed or is_active changed
    const scheduleChanged = dto.schedule && dto.schedule !== existingReport.schedule;
    const activeChanged = dto.is_active !== undefined && dto.is_active !== existingReport.is_active;

    if (scheduleChanged || activeChanged) {
      // Remove old job
      try {
        const jobId = `scheduled-report-${id}`;
        const repeatableJobs = await this.scheduledReportsQueue.getRepeatableJobs();
        const job = repeatableJobs.find((j) => j.id === jobId || j.name === 'scheduled-report');

        if (job && job.key) {
          await this.scheduledReportsQueue.removeRepeatableByKey(job.key);
          this.logger.log(`Removed old BullMQ job for scheduled report: ${id}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to remove old BullMQ job: ${error.message}`);
      }

      // Add new job if active
      if (updated.is_active) {
        const schedule = updated.schedule as 'daily' | 'weekly' | 'monthly';
        const cronPattern = this.getCronPattern(schedule);
        await this.scheduledReportsQueue.add(
          'scheduled-report',
          {
            scheduledReportId: updated.id,
            report_type: updated.report_type,
            parameters: updated.parameters,
            format: updated.format,
          },
          {
            repeat: {
              pattern: cronPattern,
            },
            jobId: `scheduled-report-${updated.id}`,
          },
        );
        this.logger.log(
          `Rescheduled BullMQ job for scheduled report: ${id} with cron: ${cronPattern}`,
        );
      }
    }

    this.logger.log(`Scheduled report updated: ${id}`);
    return updated;
  }

  /**
   * Delete a scheduled report
   * @param id - Scheduled report ID
   */
  async deleteScheduledReport(id: string): Promise<void> {
    this.logger.log(`Deleting scheduled report: ${id}`);

    // Check if report exists
    await this.getScheduledReport(id);

    // Remove BullMQ repeatable job
    try {
      const jobId = `scheduled-report-${id}`;
      const repeatableJobs = await this.scheduledReportsQueue.getRepeatableJobs();
      const job = repeatableJobs.find((j) => j.id === jobId || j.name === 'scheduled-report');

      if (job && job.key) {
        await this.scheduledReportsQueue.removeRepeatableByKey(job.key);
        this.logger.log(`Removed BullMQ repeatable job: ${jobId}`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to remove BullMQ job for scheduled report ${id}: ${error.message}`,
      );
    }

    await this.prisma.scheduled_report.delete({
      where: { id },
    });

    this.logger.log(`Scheduled report deleted: ${id}`);
  }

  /**
   * Calculate next run time based on schedule
   * @param schedule - Schedule frequency
   * @returns Next run DateTime
   */
  private calculateNextRunTime(
    schedule: 'daily' | 'weekly' | 'monthly',
  ): Date {
    const now = new Date();
    const next = new Date(now);

    // Set to midnight
    next.setHours(0, 0, 0, 0);

    switch (schedule) {
      case 'daily':
        // Tomorrow at midnight
        next.setDate(next.getDate() + 1);
        break;

      case 'weekly':
        // Next Monday at midnight
        const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
        next.setDate(next.getDate() + daysUntilMonday);
        break;

      case 'monthly':
        // First day of next month at midnight
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        break;
    }

    return next;
  }

  /**
   * Get cron pattern for schedule frequency
   * @param schedule - Schedule frequency
   * @returns Cron pattern string
   */
  private getCronPattern(schedule: 'daily' | 'weekly' | 'monthly'): string {
    switch (schedule) {
      case 'daily':
        return '0 0 * * *'; // Every day at midnight
      case 'weekly':
        return '0 0 * * 1'; // Every Monday at midnight
      case 'monthly':
        return '0 0 1 * *'; // First day of month at midnight
      default:
        return '0 0 * * *'; // Default to daily
    }
  }

  /**
   * Execute scheduled reports that are due
   * Called by cron job
   */
  async executeScheduledReports(): Promise<void> {
    this.logger.log('Checking for scheduled reports to execute');

    const now = new Date();

    // Find reports that are due
    const dueReports = await this.prisma.scheduled_report.findMany({
      where: {
        is_active: true,
        next_run_at: {
          lte: now,
        },
      },
      include: {
        admin_user: true,
      },
    });

    this.logger.log(`Found ${dueReports.length} scheduled reports to execute`);

    for (const report of dueReports) {
      try {
        this.logger.log(`Executing scheduled report: ${report.id} - ${report.name}`);

        // Calculate date range for relative dates
        const params = this.calculateDateRangeForSchedule(
          report.schedule,
          report.parameters,
        );

        // Queue the report generation
        await this.queueReportGeneration(
          report.report_type as ReportType,
          params,
          report.format as ExportFormat,
          report.admin_user_id,
        );

        // Update last_run_at and next_run_at
        await this.prisma.scheduled_report.update({
          where: { id: report.id },
          data: {
            last_run_at: now,
            next_run_at: this.calculateNextRunTime(
              report.schedule as 'daily' | 'weekly' | 'monthly',
            ),
          },
        });

        this.logger.log(`Scheduled report executed: ${report.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to execute scheduled report ${report.id}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  /**
   * Calculate date range for scheduled report based on schedule type
   * @param schedule - Schedule frequency
   * @param parameters - Report parameters
   * @returns Parameters with calculated date range
   */
  private calculateDateRangeForSchedule(
    schedule: string,
    parameters: any,
  ): {
    date_from: Date;
    date_to: Date;
    tenant_ids?: string[];
    group_by?: string;
  } {
    const now = new Date();
    let date_from: Date;
    let date_to: Date;

    switch (schedule) {
      case 'daily':
        // Yesterday
        date_from = new Date(now);
        date_from.setDate(date_from.getDate() - 1);
        date_from.setHours(0, 0, 0, 0);
        date_to = new Date(date_from);
        date_to.setHours(23, 59, 59, 999);
        break;

      case 'weekly':
        // Last week (Monday to Sunday)
        date_to = new Date(now);
        date_to.setDate(date_to.getDate() - date_to.getDay()); // Last Sunday
        date_to.setHours(23, 59, 59, 999);
        date_from = new Date(date_to);
        date_from.setDate(date_from.getDate() - 6); // Previous Monday
        date_from.setHours(0, 0, 0, 0);
        break;

      case 'monthly':
        // Last month (first to last day)
        date_to = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
        date_to.setHours(23, 59, 59, 999);
        date_from = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of previous month
        date_from.setHours(0, 0, 0, 0);
        break;

      default:
        // Fallback: last 30 days
        date_to = new Date(now);
        date_from = new Date(now);
        date_from.setDate(date_from.getDate() - 30);
    }

    return {
      date_from,
      date_to,
      tenant_ids: parameters.tenant_ids,
      group_by: parameters.group_by,
    };
  }
}
