import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SmsExportService } from '../services/sms-export.service';

/**
 * Export Cleanup Scheduler
 *
 * Automatic Export File Cleanup
 *
 * Responsibilities:
 * - Runs every hour to clean up old export files
 * - Deletes CSV and Excel files older than 24 hours
 * - Prevents disk space accumulation from temporary exports
 * - Ensures privacy by removing exported data after retention period
 *
 * Schedule: Every hour
 * Cron Pattern: 0 * * * * (at minute 0 of every hour)
 *
 * Why Every Hour:
 * - Prevents large accumulation of export files
 * - Balances cleanup frequency with system overhead
 * - Ensures 24-hour retention policy is enforced promptly
 * - Low overhead - only scans export directory once per hour
 * - Minimal disk I/O impact
 *
 * Cleanup Strategy:
 * - Scan /var/www/lead360.app/api/exports directory
 * - Check file modification time (mtime)
 * - Delete files older than 24 hours (86400000 ms)
 * - Log each deletion for audit trail
 * - Continue on individual file errors (don't fail entire cleanup)
 *
 * Security & Privacy:
 * - Prevents sensitive SMS data from being retained indefinitely
 * - Ensures compliance with data retention policies
 * - Reduces attack surface by minimizing stored exports
 * - Automatic cleanup prevents manual intervention
 *
 * Performance:
 * - Typical execution time: <100ms for ~100 files
 * - Only stat operations needed (no file reads)
 * - No database queries required
 * - Synchronous file operations (simple implementation)
 *
 * File Selection Criteria:
 * - Matches: sms_export_*.csv, sms_analytics_*.xlsx
 * - Age: mtime > 24 hours old
 * - Location: /var/www/lead360.app/api/exports
 *
 * Error Handling:
 * - Individual file errors logged but don't stop cleanup
 * - Overall cleanup errors logged but don't crash application
 * - Next hourly run will retry failed deletions
 *
 * Integration:
 * - Works with SmsExportService for cleanup logic
 * - Independent of export generation (decoupled)
 * - No external dependencies or API calls
 *
 * @class ExportCleanupScheduler
 * @since Sprint 10
 */
@Injectable()
export class ExportCleanupScheduler {
  private readonly logger = new Logger(ExportCleanupScheduler.name);

  constructor(private readonly exportService: SmsExportService) {}

  /**
   * Periodic Export Cleanup Job
   *
   * Runs every hour to delete old export files.
   *
   * @Cron(CronExpression.EVERY_HOUR)
   * Executes at minute 0 of every hour (e.g., 1:00, 2:00, 3:00)
   *
   * @returns Promise<void>
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleExportCleanup(): Promise<void> {
    this.logger.debug('🧹 Running export cleanup scheduler...');

    const startTime = Date.now();

    try {
      // Clean up old export files (24 hour retention)
      await this.exportService.cleanupOldExports();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.debug(
        `✅ Export cleanup scheduler completed in ${duration}s`,
      );
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.error(
        `❌ Export cleanup scheduler failed after ${duration}s: ${error.message}`,
      );
      this.logger.error('Error stack:', error.stack);

      // Don't throw - scheduler should continue running
      // Next run in 1 hour will retry
    }
  }

  /**
   * Manual trigger for testing or admin operations
   *
   * This method can be called manually for testing or admin operations.
   * In production, the cron job handles automatic execution.
   *
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * // In your test or admin endpoint:
   * await exportCleanupScheduler.triggerManualCleanup();
   * ```
   */
  async triggerManualCleanup(): Promise<void> {
    this.logger.log('🔧 Manual export cleanup triggered');
    await this.handleExportCleanup();
  }
}
