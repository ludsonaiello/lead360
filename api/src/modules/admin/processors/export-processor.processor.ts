import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExportService } from '../services/export.service';

/**
 * Export Processor
 *
 * BullMQ worker that processes export jobs asynchronously.
 * Handles CSV and PDF generation for tenants, users, and audit logs.
 */
@Processor('export')
export class ExportProcessorProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportProcessorProcessor.name);

  constructor(private readonly exportService: ExportService) {
    super();
    this.logger.log('🚀 ExportProcessorProcessor worker initialized and ready');
  }

  async process(job: Job): Promise<any> {
    const { exportJobId, exportType, filters, format } = job.data;
    const jobId = job.id as string;

    this.logger.log(
      `🔄 PROCESSING: Export job ${jobId} - Type: ${exportType}, Format: ${format}`,
    );

    try {
      const startTime = Date.now();

      // Process export job
      const result = await this.exportService.processExportJob(exportJobId);

      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ Export job ${jobId} completed - ${result.rowCount} rows exported in ${duration}ms`,
      );

      return {
        success: true,
        filePath: result.filePath,
        rowCount: result.rowCount,
        duration,
      };
    } catch (error) {
      this.logger.error(`❌ Export job ${jobId} failed: ${error.message}`, error.stack);
      throw error; // BullMQ will retry based on attempts config
    }
  }
}
