import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Voice AI Usage Sync Processor
 *
 * Processes the daily usage audit job — verifies usage records are consistent
 * with completed call logs for the current month and logs any discrepancies
 * for ops visibility.
 *
 * Queue: voice-ai-usage-sync
 * Job: daily-sync
 *
 * Responsibilities:
 * - Count completed calls for the current month
 * - Count usage records for the current month
 * - Aggregate STT seconds → convert to minutes for reporting
 * - Warn if completed calls outnumber usage records (missing billing data)
 *
 * @class VoiceAiUsageSyncProcessor
 * @since Sprint B10
 */
@Processor('voice-ai-usage-sync')
export class VoiceAiUsageSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(VoiceAiUsageSyncProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
    this.logger.log('Voice AI Usage Sync Processor initialized');
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing daily usage sync job [${job.id}]`);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    try {
      // Count completed calls this month
      const callCount = await this.prisma.voice_call_log.count({
        where: {
          started_at: { gte: monthStart, lt: monthEnd },
          status: 'completed',
        },
      });

      // Count usage records this month
      const usageCount = await this.prisma.voice_usage_record.count({
        where: { year, month },
      });

      // Aggregate STT seconds → convert to minutes for reporting
      const sttAgg = await this.prisma.voice_usage_record.aggregate({
        where: { year, month, provider_type: 'STT' },
        _sum: { usage_quantity: true },
      });

      const totalMinutes = Math.ceil(
        Number(sttAgg._sum.usage_quantity ?? 0) / 60,
      );

      this.logger.log(
        `Voice AI usage sync ${month}/${year}: ` +
          `${callCount} completed calls, ${usageCount} usage records, ` +
          `~${totalMinutes} total STT minutes`,
      );

      // Warn if calls exist without usage records (indicates missing billing data)
      if (callCount > 0 && usageCount < callCount) {
        this.logger.warn(
          `WARNING: ${callCount} completed calls but only ${usageCount} usage records — ` +
            `some calls may be missing usage tracking`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Voice AI usage sync failed for ${month}/${year}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error; // BullMQ will log the failure
    }
  }
}
