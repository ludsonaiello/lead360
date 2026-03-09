import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Voice AI Stuck Call Cleanup Processor
 *
 * Processes the hourly stuck call cleanup job — auto-fails calls that have been
 * stuck in 'in_progress' status for more than 2 hours.
 *
 * Queue: voice-ai-stuck-call-cleanup
 * Job: cleanup-stuck-calls
 *
 * Responsibilities:
 * - Find calls with status='in_progress' and started_at > 2 hours ago
 * - Update their status to 'failed'
 * - Set ended_at to started_at + 2 hours (estimated end time)
 * - Set duration_seconds to 7200 (2 hours in seconds)
 * - Set error_message to 'Call timed out - auto-cleaned by system'
 * - Set outcome to 'system_timeout'
 * - Log the cleanup action for ops visibility
 *
 * Why 2 hours?
 * - Typical calls last 1-10 minutes
 * - Long calls rarely exceed 30 minutes
 * - 2-hour threshold provides generous buffer to avoid false positives
 * - Stuck calls are usually due to webhook failures or worker crashes
 *
 * @class VoiceAiStuckCallCleanupProcessor
 * @since February 2026 (Post-BAS27 hotfix)
 */
@Processor('voice-ai-stuck-call-cleanup')
export class VoiceAiStuckCallCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(VoiceAiStuckCallCleanupProcessor.name);

  // Threshold in seconds (2 hours = 7200 seconds)
  private readonly STUCK_THRESHOLD_SECONDS = 7200;

  constructor(private readonly prisma: PrismaService) {
    super();
    this.logger.log('Voice AI Stuck Call Cleanup Processor initialized');
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing stuck call cleanup job [${job.id}]`);

    const now = new Date();
    const thresholdTime = new Date(
      now.getTime() - this.STUCK_THRESHOLD_SECONDS * 1000,
    );

    try {
      // Find calls stuck in 'in_progress' status for > 2 hours
      const stuckCalls = await this.prisma.voice_call_log.findMany({
        where: {
          status: 'in_progress',
          started_at: {
            lt: thresholdTime,
          },
        },
        select: {
          id: true,
          call_sid: true,
          tenant_id: true,
          started_at: true,
        },
      });

      if (stuckCalls.length === 0) {
        this.logger.log('No stuck calls found - all clear');
        return;
      }

      this.logger.warn(
        `Found ${stuckCalls.length} stuck call(s) - auto-failing them now`,
      );

      // Auto-fail each stuck call
      for (const call of stuckCalls) {
        const minutesStuck = Math.floor(
          (now.getTime() - call.started_at.getTime()) / 1000 / 60,
        );

        const estimatedEndedAt = new Date(
          call.started_at.getTime() + this.STUCK_THRESHOLD_SECONDS * 1000,
        );

        await this.prisma.voice_call_log.update({
          where: { id: call.id },
          data: {
            status: 'failed',
            ended_at: estimatedEndedAt,
            duration_seconds: this.STUCK_THRESHOLD_SECONDS,
            error_message: `Call timed out - auto-cleaned by system (stuck for ${minutesStuck} minutes)`,
            outcome: 'system_timeout',
          },
        });

        this.logger.warn(
          `Auto-failed stuck call: ${call.call_sid} ` +
            `(tenant: ${call.tenant_id}, stuck for ${minutesStuck} minutes)`,
        );
      }

      this.logger.log(
        `Stuck call cleanup completed - ${stuckCalls.length} call(s) auto-failed`,
      );
    } catch (error) {
      this.logger.error(
        `Stuck call cleanup failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error; // BullMQ will log the failure and retry
    }
  }
}
