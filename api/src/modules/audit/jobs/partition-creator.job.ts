import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class PartitionCreatorJob {
  private readonly logger = new Logger(PartitionCreatorJob.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create next month's partition
   * Runs on the 1st of each month at midnight
   *
   * NOTE: Partitioning is optional and should be enabled after
   * the partitioning migration is applied (Day 4 of implementation)
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyPartitionCreation() {
    this.logger.log('Starting monthly partition creation job...');

    try {
      // Calculate next month's partition name
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const year = nextMonth.getFullYear();
      const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
      const partitionName = `audit_log_${year}_${month}`;

      // Calculate partition range
      const nextMonthStart = new Date(year, nextMonth.getMonth(), 1);
      const monthAfterStart = new Date(year, nextMonth.getMonth() + 1, 1);

      this.logger.log(`Creating partition: ${partitionName}`);
      this.logger.log(
        `Range: ${nextMonthStart.toISOString()} to ${monthAfterStart.toISOString()}`,
      );

      // Check if partitioning is enabled
      const isPartitioned = await this.checkIfTableIsPartitioned();

      if (!isPartitioned) {
        this.logger.warn(
          'Audit log table is not partitioned. Skipping partition creation.',
        );
        this.logger.warn(
          'To enable partitioning, run the partitioning migration first.',
        );
        return;
      }

      // Check if partition already exists
      const existingPartition = await this.checkPartitionExists(partitionName);

      if (existingPartition) {
        this.logger.log(
          `Partition ${partitionName} already exists. Skipping creation.`,
        );
        return;
      }

      // Create new partition by reorganizing default partition
      await this.createPartition(partitionName, monthAfterStart);

      this.logger.log(`Successfully created partition: ${partitionName}`);

      // Log the partition creation to audit log
      await this.logPartitionCreation(partitionName);
    } catch (error) {
      this.logger.error(
        `Failed to create monthly partition: ${error.message}`,
        error.stack,
      );
      // Don't throw - partition creation failure shouldn't crash the app
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
   * Check if specific partition exists
   */
  private async checkPartitionExists(partitionName: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT PARTITION_NAME
        FROM INFORMATION_SCHEMA.PARTITIONS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_log'
        AND PARTITION_NAME = ?
      `,
        partitionName,
      );

      return result.length > 0;
    } catch (error) {
      this.logger.error(`Error checking partition existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Create new partition
   */
  private async createPartition(
    partitionName: string,
    lessThanDate: Date,
  ): Promise<void> {
    // Calculate TO_DAYS value for MySQL
    const lessThanValue = `TO_DAYS('${lessThanDate.toISOString().split('T')[0]}')`;

    const sql = `
      ALTER TABLE audit_log
      REORGANIZE PARTITION audit_log_default INTO (
        PARTITION ${partitionName} VALUES LESS THAN (${lessThanValue}),
        PARTITION audit_log_default VALUES LESS THAN MAXVALUE
      )
    `;

    await this.prisma.$executeRawUnsafe(sql);
  }

  /**
   * Log partition creation to audit log
   */
  private async logPartitionCreation(partitionName: string): Promise<void> {
    try {
      await this.prisma.audit_log.create({
        data: {
          id: randomBytes(16).toString('hex'),
          actor_type: 'cron_job',
          entity_type: 'audit_log_partition',
          entity_id: partitionName,
          description: `Monthly partition created: ${partitionName}`,
          action_type: 'created',
          metadata_json: JSON.stringify({
            partition_name: partitionName,
            created_by: 'PartitionCreatorJob',
          }),
          status: 'success',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log partition creation: ${error.message}`);
      // Don't throw - logging failure shouldn't fail partition creation
    }
  }
}
