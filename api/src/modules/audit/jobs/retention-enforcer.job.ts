import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class RetentionEnforcerJob {
  private readonly logger = new Logger(RetentionEnforcerJob.name);
  private readonly DEFAULT_RETENTION_DAYS = 2557; // 7 years

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enforce retention policy by dropping old partitions
   * Runs on the 1st of each month at 2:00 AM
   *
   * NOTE: This job only runs after partitioning is enabled
   */
  @Cron('0 2 1 * *') // 2:00 AM on the 1st of every month
  async handleRetentionEnforcement() {
    this.logger.log('Starting retention enforcement job...');

    try {
      // Check if partitioning is enabled
      const isPartitioned = await this.checkIfTableIsPartitioned();

      if (!isPartitioned) {
        this.logger.warn(
          'Audit log table is not partitioned. Skipping retention enforcement.',
        );
        return;
      }

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.DEFAULT_RETENTION_DAYS);

      this.logger.log(`Retention policy: ${this.DEFAULT_RETENTION_DAYS} days`);
      this.logger.log(`Cutoff date: ${cutoffDate.toISOString()}`);

      // Get all partitions
      const partitions = await this.getAllPartitions();

      this.logger.log(`Found ${partitions.length} partitions`);

      // Identify old partitions
      const oldPartitions = await this.identifyOldPartitions(
        partitions,
        cutoffDate,
      );

      if (oldPartitions.length === 0) {
        this.logger.log('No old partitions to archive/drop');
        return;
      }

      this.logger.log(
        `Found ${oldPartitions.length} old partitions to process`,
      );

      // Process each old partition
      for (const partition of oldPartitions) {
        await this.processOldPartition(partition);
      }

      this.logger.log('Retention enforcement completed successfully');

      // Log retention enforcement
      await this.logRetentionEnforcement(oldPartitions);
    } catch (error) {
      this.logger.error(
        `Failed to enforce retention policy: ${error.message}`,
        error.stack,
      );
      // Don't throw - retention failure shouldn't crash the app
    }
  }

  /**
   * Check if audit_log table is partitioned
   */
  private async checkIfTableIsPartitioned(): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT PARTITION_NAME
        FROM INFORMATION_SCHEMA.PARTITIONS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_log'
        AND PARTITION_NAME IS NOT NULL
        LIMIT 1
      `);

      return result.length > 0;
    } catch (error) {
      this.logger.error(`Error checking partitioning status: ${error.message}`);
      return false;
    }
  }

  /**
   * Get all partitions for audit_log table
   */
  private async getAllPartitions(): Promise<string[]> {
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT PARTITION_NAME
      FROM INFORMATION_SCHEMA.PARTITIONS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'audit_log'
      AND PARTITION_NAME IS NOT NULL
      AND PARTITION_NAME != 'audit_log_default'
      ORDER BY PARTITION_NAME
    `);

    return result.map((row) => row.PARTITION_NAME);
  }

  /**
   * Identify partitions older than cutoff date
   */
  private async identifyOldPartitions(
    partitions: string[],
    cutoffDate: Date,
  ): Promise<string[]> {
    const oldPartitions: string[] = [];

    for (const partition of partitions) {
      // Parse partition name (format: audit_log_YYYY_MM)
      const match = partition.match(/audit_log_(\d{4})_(\d{2})/);
      if (!match) {
        continue;
      }

      const year = parseInt(match[1]);
      const month = parseInt(match[2]);

      // Get last day of the partition month
      const partitionEndDate = new Date(year, month, 0); // Day 0 = last day of previous month

      if (partitionEndDate < cutoffDate) {
        oldPartitions.push(partition);
      }
    }

    return oldPartitions;
  }

  /**
   * Process old partition (archive and drop)
   */
  private async processOldPartition(partitionName: string): Promise<void> {
    this.logger.log(`Processing old partition: ${partitionName}`);

    try {
      // TODO: Archive to S3 before dropping (Phase 2 enhancement)
      // await this.archivePartitionToS3(partitionName);

      // For now, we just drop the partition
      // CRITICAL: This permanently deletes data!
      await this.dropPartition(partitionName);

      this.logger.log(`Successfully dropped partition: ${partitionName}`);
    } catch (error) {
      this.logger.error(
        `Failed to process partition ${partitionName}: ${error.message}`,
        error.stack,
      );
      // Continue with next partition
    }
  }

  /**
   * Drop partition
   * WARNING: This permanently deletes data!
   */
  private async dropPartition(partitionName: string): Promise<void> {
    // Safety check: Don't drop partitions from last 365 days
    const match = partitionName.match(/audit_log_(\d{4})_(\d{2})/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const partitionDate = new Date(year, month - 1, 1);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      if (partitionDate > oneYearAgo) {
        this.logger.warn(`Refusing to drop recent partition: ${partitionName}`);
        return;
      }
    }

    const sql = `ALTER TABLE audit_log DROP PARTITION ${partitionName}`;
    await this.prisma.$executeRawUnsafe(sql);
  }

  /**
   * Log retention enforcement to audit log
   */
  private async logRetentionEnforcement(
    droppedPartitions: string[],
  ): Promise<void> {
    try {
      await this.prisma.audit_log.create({
        data: {
          id: randomBytes(16).toString('hex'),
          actor_type: 'cron_job',
          entity_type: 'audit_log_retention',
          entity_id: 'retention_enforcement',
          description: `Retention policy enforced: ${droppedPartitions.length} old partitions dropped`,
          action_type: 'deleted',
          metadata_json: JSON.stringify({
            dropped_partitions: droppedPartitions,
            retention_days: this.DEFAULT_RETENTION_DAYS,
            enforced_by: 'RetentionEnforcerJob',
          }),
          status: 'success',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to log retention enforcement: ${error.message}`,
      );
      // Don't throw - logging failure shouldn't fail retention enforcement
    }
  }
}
