import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { OcrService } from '../../financial/services/ocr.service';

/**
 * OCR Processing Job Payload
 */
interface OcrJobPayload {
  receiptId: string;
  tenantId: string;
  fileId: string;
}

@Processor('ocr-processing')
export class OcrProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocrService: OcrService,
  ) {
    super();
    this.logger.log('🚀 OcrProcessingProcessor worker initialized and ready');
  }

  async process(job: Job<OcrJobPayload>): Promise<any> {
    const { receiptId, tenantId, fileId } = job.data;
    const jobId = job.id as string;
    const attemptNumber = job.attemptsMade + 1;

    this.logger.log(
      `🔄 PROCESSING: OCR job ${jobId} for receipt ${receiptId} (tenant: ${tenantId}, attempt: ${attemptNumber}/3)`,
    );

    try {
      // Verify receipt exists and is in 'processing' state
      const receipt = await this.prisma.receipt.findFirst({
        where: { id: receiptId, tenant_id: tenantId },
        select: { id: true, ocr_status: true },
      });

      if (!receipt) {
        this.logger.warn(
          `OCR job ${jobId}: Receipt ${receiptId} not found. Marking job as complete.`,
        );
        return { success: false, reason: 'receipt_not_found' };
      }

      if (receipt.ocr_status !== 'processing') {
        this.logger.warn(
          `OCR job ${jobId}: Receipt ${receiptId} status is '${receipt.ocr_status}', expected 'processing'. Skipping.`,
        );
        return { success: false, reason: 'invalid_status' };
      }

      // Delegate to OcrService — it handles all Vision API calls, parsing, and DB updates
      await this.ocrService.processReceipt(receiptId, tenantId, fileId);

      this.logger.log(`✅ OCR job ${jobId} completed for receipt ${receiptId}`);
      return { success: true, receiptId };
    } catch (error) {
      this.logger.error(
        `❌ OCR job ${jobId} failed (attempt ${attemptNumber}/3): ${error.message}`,
        error.stack,
      );

      // On final attempt (attempt 3), set receipt status to failed and DON'T throw
      // This prevents the job from going to the dead letter queue
      if (attemptNumber >= 3) {
        this.logger.warn(
          `OCR job ${jobId}: Final attempt failed. Setting receipt ${receiptId} to 'failed' and completing job.`,
        );
        try {
          await this.prisma.receipt.update({
            where: { id: receiptId },
            data: { ocr_status: 'failed' },
          });
        } catch (updateError) {
          this.logger.error(
            `Failed to update receipt status: ${updateError.message}`,
          );
        }
        // Return instead of throw — job completes, no more retries
        return { success: false, error: error.message, finalAttempt: true };
      }

      // On non-final attempts, throw so BullMQ retries
      throw error;
    }
  }
}
