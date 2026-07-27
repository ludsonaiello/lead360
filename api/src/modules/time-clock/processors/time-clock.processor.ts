import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MissedShiftService } from '../services/missed-shift.service';
import { ShiftReminderService } from '../services/shift-reminder.service';

/**
 * Time Clock Processor
 *
 * BullMQ consumer for the `time-clock` queue. Routes jobs by `job.name`
 * to dedicated services.
 *
 * Supported job names:
 *  - `missed-shift-check` -> MissedShiftService.detectMissedShifts()
 *  - `shift-reminder`     -> ShiftReminderService.sendReminders()
 *
 * Errors are re-thrown so BullMQ's retry/backoff policy applies.
 */
@Processor('time-clock')
export class TimeClockProcessor extends WorkerHost {
  private readonly logger = new Logger(TimeClockProcessor.name);

  constructor(
    private readonly missedShiftService: MissedShiftService,
    private readonly shiftReminderService: ShiftReminderService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const startedAt = Date.now();
    this.logger.log(`Processing job: ${job.name} (id=${job.id})`);

    try {
      switch (job.name) {
        case 'missed-shift-check':
          await this.missedShiftService.detectMissedShifts();
          break;
        case 'shift-reminder':
          await this.shiftReminderService.sendReminders();
          break;
        default:
          this.logger.warn(`Unknown job name: ${job.name} (id=${job.id})`);
          return;
      }

      this.logger.log(
        `Completed job: ${job.name} (id=${job.id}) in ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Job failed: ${job.name} (id=${job.id}) - ${message}`,
        stack,
      );
      throw error;
    }
  }
}
