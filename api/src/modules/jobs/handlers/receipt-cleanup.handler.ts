import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';
import { ReceiptService } from '../../financial/services/receipt.service';

/**
 * Cleans up orphan receipts — receipts that are NOT linked to a financial entry.
 *
 * Runs daily as a scheduled system job. Finds receipts where:
 *   - financial_entry_id IS NULL (not attached to any entry)
 *   - created_at is older than 30 minutes (grace period for active uploads)
 *
 * For each orphan receipt:
 *   1. Deletes the receipt record
 *   2. Deletes the associated file record + physical file from disk
 *
 * Receipts linked to a financial entry are NEVER deleted.
 */
@Injectable()
export class ReceiptCleanupHandler {
  private readonly logger = new Logger(ReceiptCleanupHandler.name);

  /** Grace period in minutes — skip very recent uploads that may still be in the process of being linked */
  private readonly GRACE_MINUTES = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
    private readonly receiptService: ReceiptService,
  ) {
    this.logger.log('ReceiptCleanupHandler initialized');
  }

  async execute(jobId: string, payload: any): Promise<any> {
    this.logger.log(`Starting orphan receipt cleanup job ${jobId}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      // Grace period: skip receipts created in the last 30 minutes
      // (user may still be in the middle of attaching to an entry)
      const cutoffDate = new Date();
      cutoffDate.setMinutes(cutoffDate.getMinutes() - this.GRACE_MINUTES);

      // Find all orphan receipts older than retention period
      const orphanReceipts = await this.prisma.receipt.findMany({
        where: {
          financial_entry_id: null,
          created_at: { lt: cutoffDate },
        },
        select: {
          id: true,
          tenant_id: true,
          file_id: true,
          file_name: true,
          ocr_status: true,
          created_at: true,
        },
        take: 500, // Process in batches to avoid memory issues
      });

      if (orphanReceipts.length === 0) {
        this.logger.log('No orphan receipts found');

        await this.jobQueue.updateJobStatus(jobId, 'completed', {
          result: { deleted: 0, failed: 0 },
        });

        await this.jobQueue.logJobExecution(
          jobId,
          'info',
          'No orphan receipts to clean up',
        );

        return { success: true, deleted: 0, failed: 0 };
      }

      this.logger.log(`Found ${orphanReceipts.length} orphan receipts to clean up`);

      await this.jobQueue.logJobExecution(
        jobId,
        'info',
        `Found ${orphanReceipts.length} orphan receipts older than ${this.GRACE_MINUTES} minutes`,
      );

      let deleted = 0;
      let failed = 0;

      for (const receipt of orphanReceipts) {
        try {
          await this.receiptService.deleteReceipt(
            receipt.tenant_id,
            receipt.id,
            'system',
          );
          deleted++;
        } catch (error) {
          failed++;
          this.logger.warn(
            `Failed to delete orphan receipt ${receipt.id} (${receipt.file_name}): ${error.message}`,
          );
        }
      }

      const summary = `Orphan receipt cleanup completed: ${deleted} deleted, ${failed} failed out of ${orphanReceipts.length}`;
      this.logger.log(summary);

      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { deleted, failed, total: orphanReceipts.length },
      });

      await this.jobQueue.logJobExecution(jobId, 'info', summary, {
        deleted,
        failed,
        total: orphanReceipts.length,
        grace_minutes: this.GRACE_MINUTES,
      });

      return { success: true, deleted, failed, total: orphanReceipts.length };
    } catch (error) {
      this.logger.error(
        `Receipt cleanup job ${jobId} failed: ${error.message}`,
        error.stack,
      );

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      throw error;
    }
  }
}
