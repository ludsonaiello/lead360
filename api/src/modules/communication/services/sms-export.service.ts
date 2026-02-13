import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { SmsAnalyticsService } from './sms-analytics.service';
import { createObjectCsvWriter } from 'csv-writer';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SMS Export Service
 *
 * Provides SMS data export capabilities:
 * - CSV export for raw SMS history
 * - Excel export for analytics with multiple sheets (Summary, Trends, Failures)
 * - Automatic cleanup of old export files (24 hour retention)
 *
 * Features:
 * - Multi-tenant isolation (CRITICAL)
 * - Date range filtering
 * - Temporary file storage with auto-cleanup
 * - Reuses analytics service for consistent metrics
 * - Secure file handling (no permanent storage)
 *
 * Export Directory: /var/www/lead360.app/api/exports
 * File Retention: 24 hours
 */
@Injectable()
export class SmsExportService {
  private readonly logger = new Logger(SmsExportService.name);
  private readonly EXPORT_DIR = '/var/www/lead360.app/api/exports';

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: SmsAnalyticsService,
  ) {
    // Ensure export directory exists on service initialization
    this.ensureExportDirectory();
  }

  /**
   * Ensure export directory exists
   * Creates directory with proper permissions if it doesn't exist
   */
  private ensureExportDirectory(): void {
    if (!fs.existsSync(this.EXPORT_DIR)) {
      fs.mkdirSync(this.EXPORT_DIR, { recursive: true });
      this.logger.log(`Created export directory: ${this.EXPORT_DIR}`);
    }
  }

  /**
   * Export SMS history to CSV
   * CRITICAL: Filter by tenant_id
   *
   * @param tenantId - The tenant ID (from JWT)
   * @param startDate - Start date for export
   * @param endDate - End date for export
   * @returns Filename of the generated CSV file
   */
  async exportToCsv(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<string> {
    this.logger.log(
      `Exporting SMS history to CSV for tenant ${tenantId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const filename = `sms_export_${tenantId}_${Date.now()}.csv`;
    const filepath = path.join(this.EXPORT_DIR, filename);

    try {
      // Ensure export directory exists
      this.ensureExportDirectory();

      // Fetch SMS data with multi-tenant isolation
      const smsData = await this.prisma.communication_event.findMany({
        where: {
          tenant_id: tenantId,
          channel: 'sms',
          created_at: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          direction: true,
          to_phone: true,
          text_body: true,
          status: true,
          sent_at: true,
          delivered_at: true,
          error_message: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      });

      // Create CSV writer
      const csvWriter = createObjectCsvWriter({
        path: filepath,
        header: [
          { id: 'id', title: 'Event ID' },
          { id: 'direction', title: 'Direction' },
          { id: 'to_phone', title: 'To Phone' },
          { id: 'text_body', title: 'Message' },
          { id: 'status', title: 'Status' },
          { id: 'sent_at', title: 'Sent At' },
          { id: 'delivered_at', title: 'Delivered At' },
          { id: 'error_message', title: 'Error' },
          { id: 'created_at', title: 'Created At' },
        ],
      });

      // Format data for CSV (convert dates to strings)
      const formattedData = smsData.map((record) => ({
        ...record,
        sent_at: record.sent_at?.toISOString() || '',
        delivered_at: record.delivered_at?.toISOString() || '',
        created_at: record.created_at.toISOString(),
        text_body: record.text_body || '',
        error_message: record.error_message || '',
      }));

      await csvWriter.writeRecords(formattedData);

      this.logger.log(
        `Successfully exported ${smsData.length} SMS records to ${filename}`,
      );

      return filename;
    } catch (error) {
      this.logger.error(
        `Failed to export SMS history to CSV for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Export SMS analytics to Excel with multiple sheets
   * CRITICAL: Filter by tenant_id
   *
   * Sheets:
   * 1. Summary - Key metrics (sent, delivered, failed, delivery rate, cost, etc.)
   * 2. Daily Trends - Daily breakdown of sent/delivered/failed counts
   * 3. Failures - Error code breakdown
   *
   * @param tenantId - The tenant ID (from JWT)
   * @param startDate - Start date for export
   * @param endDate - End date for export
   * @returns Filename of the generated Excel file
   */
  async exportToExcel(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<string> {
    this.logger.log(
      `Exporting SMS analytics to Excel for tenant ${tenantId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const filename = `sms_analytics_${tenantId}_${Date.now()}.xlsx`;
    const filepath = path.join(this.EXPORT_DIR, filename);

    try {
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Summary
      const summarySheet = workbook.addWorksheet('Summary');
      const summary = await this.analyticsService.getSummary(
        tenantId,
        startDate,
        endDate,
      );

      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 },
      ];

      summarySheet.addRows([
        { metric: 'Total Sent', value: summary.total_sent },
        { metric: 'Total Delivered', value: summary.total_delivered },
        { metric: 'Total Failed', value: summary.total_failed },
        { metric: 'Delivery Rate (%)', value: summary.delivery_rate },
        { metric: 'Total Cost ($)', value: summary.total_cost },
        { metric: 'Unique Recipients', value: summary.unique_recipients },
        { metric: 'Opt-Out Count', value: summary.opt_out_count },
      ]);

      // Style header row
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Sheet 2: Daily Trends
      const trendsSheet = workbook.addWorksheet('Daily Trends');
      const trends = await this.analyticsService.getTrends(
        tenantId,
        startDate,
        endDate,
      );

      trendsSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Sent', key: 'sent_count', width: 15 },
        { header: 'Delivered', key: 'delivered_count', width: 15 },
        { header: 'Failed', key: 'failed_count', width: 15 },
      ];

      trendsSheet.addRows(trends);

      // Style header row
      trendsSheet.getRow(1).font = { bold: true };
      trendsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Sheet 3: Failure Breakdown
      const failuresSheet = workbook.addWorksheet('Failures');
      const failures = await this.analyticsService.getFailureBreakdown(
        tenantId,
        startDate,
        endDate,
      );

      failuresSheet.columns = [
        { header: 'Error Code', key: 'error_code', width: 20 },
        { header: 'Count', key: 'count', width: 15 },
      ];

      failuresSheet.addRows(failures);

      // Style header row
      failuresSheet.getRow(1).font = { bold: true };
      failuresSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Save workbook
      await workbook.xlsx.writeFile(filepath);

      this.logger.log(
        `Successfully exported SMS analytics to ${filename} with ${trends.length} days of data and ${failures.length} error codes`,
      );

      return filename;
    } catch (error) {
      this.logger.error(
        `Failed to export SMS analytics to Excel for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clean up old export files (older than 24 hours)
   * Automatically called by cron job every hour
   *
   * Security: Prevents export files from accumulating and consuming disk space
   * Privacy: Ensures exported data is not retained longer than necessary
   */
  async cleanupOldExports(): Promise<void> {
    this.logger.log('Starting cleanup of old export files');

    try {
      if (!fs.existsSync(this.EXPORT_DIR)) {
        this.logger.log('Export directory does not exist, skipping cleanup');
        return;
      }

      const files = fs.readdirSync(this.EXPORT_DIR);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      let deletedCount = 0;

      for (const file of files) {
        const filepath = path.join(this.EXPORT_DIR, file);

        try {
          const stats = fs.statSync(filepath);

          // Check if file is older than 24 hours
          if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filepath);
            deletedCount++;
            this.logger.log(`Deleted old export file: ${file}`);
          }
        } catch (fileError) {
          // Log error but continue processing other files
          this.logger.warn(
            `Failed to process file ${file}: ${fileError.message}`,
          );
        }
      }

      this.logger.log(
        `Cleanup completed: ${deletedCount} old export files deleted, ${files.length - deletedCount} files retained`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old export files: ${error.message}`,
        error.stack,
      );
      // Don't throw - cleanup failures should not crash the application
    }
  }
}
