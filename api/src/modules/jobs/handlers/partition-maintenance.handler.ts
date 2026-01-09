import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';

@Injectable()
export class PartitionMaintenanceHandler {
  private readonly logger = new Logger(PartitionMaintenanceHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
  ) {
    this.logger.log('PartitionMaintenanceHandler initialized');
  }

  async execute(jobId: string, payload: any): Promise<any> {
    this.logger.log(`🔄 PROCESSING: Starting partition maintenance job ${jobId}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      // Check if audit_log table is partitioned
      // MySQL/MariaDB: Check INFORMATION_SCHEMA.PARTITIONS
      const partitionCheck = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT PARTITION_NAME
        FROM INFORMATION_SCHEMA.PARTITIONS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'audit_log'
          AND PARTITION_NAME IS NOT NULL
        LIMIT 1
      `);

      const isPartitioned = partitionCheck && partitionCheck.length > 0;

      if (!isPartitioned) {
        // Table is not partitioned - skip partition maintenance
        this.logger.log('audit_log table is not partitioned - skipping partition maintenance');

        await this.jobQueue.logJobExecution(
          jobId,
          'info',
          'Partition maintenance skipped: audit_log table is not partitioned',
        );

        await this.jobQueue.updateJobStatus(jobId, 'completed', {
          result: { skipped: true, reason: 'Table not partitioned' },
        });

        return { success: true, skipped: true, reason: 'Table not partitioned' };
      }

      // If we get here, table IS partitioned - proceed with maintenance
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const yearMonth = `${nextMonth.getFullYear()}_${(nextMonth.getMonth() + 1).toString().padStart(2, '0')}`;
      const partitionName = `p_${yearMonth}`;

      try {
        // MariaDB partitioning syntax (ALTER TABLE ... ADD PARTITION)
        await this.prisma.$executeRawUnsafe(`
          ALTER TABLE audit_log
          ADD PARTITION IF NOT EXISTS (
            PARTITION ${partitionName} VALUES LESS THAN (
              UNIX_TIMESTAMP('${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 2).toString().padStart(2, '0')}-01 00:00:00')
            )
          )
        `);

        await this.jobQueue.logJobExecution(
          jobId,
          'info',
          `Created partition: ${partitionName}`,
        );

        this.logger.log(`Created partition: ${partitionName}`);
      } catch (error) {
        this.logger.warn(
          `Partition ${partitionName} already exists or creation failed: ${error.message}`,
        );

        await this.jobQueue.logJobExecution(
          jobId,
          'warn',
          `Partition ${partitionName} already exists or creation failed: ${error.message}`,
        );
      }

      // Enforce 7-year retention
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 7);

      // TODO: Drop old partitions older than 7 years
      // This requires checking existing partitions and dropping them

      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { partitionCreated: partitionName },
      });

      await this.jobQueue.logJobExecution(
        jobId,
        'info',
        'Partition maintenance completed successfully',
        { partitionCreated: partitionName },
      );

      return { success: true, partitionCreated: partitionName };
    } catch (error) {
      this.logger.error(
        `Partition maintenance job ${jobId} failed: ${error.message}`,
        error.stack,
      );

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      throw error;
    }
  }
}
