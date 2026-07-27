import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Time Clock Scheduler
 *
 * Cron-driven producer that enqueues background jobs onto the `time-clock`
 * BullMQ queue. The processor (`TimeClockProcessor`) consumes them and
 * delegates execution to dedicated services.
 *
 * Jobs:
 *  - `missed-shift-check`  -> every 15 minutes (BR-010)
 *  - `shift-reminder`      -> every minute
 */
@Injectable()
export class TimeClockScheduler {
  private readonly logger = new Logger(TimeClockScheduler.name);

  constructor(
    @InjectQueue('time-clock') private readonly timeClockQueue: Queue,
  ) {}

  @Cron('*/15 * * * *', { name: 'time-clock:missed-shift-check' })
  async missedShiftCheck(): Promise<void> {
    try {
      await this.timeClockQueue.add(
        'missed-shift-check',
        {},
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      );
      this.logger.debug('Enqueued missed-shift-check job');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to enqueue missed-shift-check job: ${message}`,
        stack,
      );
    }
  }

  @Cron('* * * * *', { name: 'time-clock:shift-reminder' })
  async shiftReminder(): Promise<void> {
    try {
      await this.timeClockQueue.add(
        'shift-reminder',
        {},
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      );
      this.logger.debug('Enqueued shift-reminder job');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to enqueue shift-reminder job: ${message}`,
        stack,
      );
    }
  }
}
