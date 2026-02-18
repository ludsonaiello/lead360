import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Voice AI Quota Reset Processor
 *
 * Processes the monthly quota reset job on the 1st of each month.
 *
 * Queue: voice-ai-quota-reset
 * Job: monthly-reset
 *
 * Responsibilities:
 * - Aggregates STT usage for the previous month (immutable per-call rows)
 * - Logs monthly summary for billing/ops visibility
 * - Does NOT delete historical records (kept for billing history)
 * - New month records auto-create on first call via VoiceUsageService
 *
 * @class VoiceAiQuotaResetProcessor
 * @since Sprint B10
 */
@Processor('voice-ai-quota-reset')
export class VoiceAiQuotaResetProcessor extends WorkerHost {
  private readonly logger = new Logger(VoiceAiQuotaResetProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
    this.logger.log('Voice AI Quota Reset Processor initialized');
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing monthly quota reset job [${job.id}]`);

    // Determine previous month — handles January → December rollover correctly
    const now = new Date();
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevDate.getMonth() + 1; // getMonth() is 0-indexed
    const prevYear = prevDate.getFullYear();

    try {
      // Aggregate STT usage for the previous month across all tenants
      // voice_usage_record is per-call per-provider — aggregate via _sum, not monthly counter
      const sttAgg = await this.prisma.voice_usage_record.aggregate({
        where: {
          year: prevYear,
          month: prevMonth,
          provider_type: 'STT',
        },
        _sum: { usage_quantity: true },
        _count: { id: true },
      });

      const totalMinutes = Math.ceil(
        Number(sttAgg._sum.usage_quantity ?? 0) / 60,
      );

      this.logger.log(
        `Voice AI monthly reset complete: ${sttAgg._count.id} STT records, ` +
          `~${totalMinutes} minutes used in ${prevMonth}/${prevYear}`,
      );
    } catch (error) {
      this.logger.error(
        `Voice AI quota reset failed for ${prevMonth}/${prevYear}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error; // BullMQ will log the failure
    }
  }
}
