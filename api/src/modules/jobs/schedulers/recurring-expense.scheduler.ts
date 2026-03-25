import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class RecurringExpenseScheduler {
  private readonly logger = new Logger(RecurringExpenseScheduler.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('recurring-expense-generation')
    private readonly recurringExpenseQueue: Queue,
  ) {}

  /**
   * Runs nightly at 02:00 AM server time.
   * Queries all active recurring rules that are due (next_due_date <= today).
   * Enqueues a job for each due rule.
   * Does NOT generate entries directly — only enqueues jobs.
   */
  @Cron('0 2 * * *') // Every day at 02:00 AM
  async processRecurringExpenses() {
    if (this.isRunning) {
      this.logger.warn(
        'Recurring expense scheduler already running — skipping',
      );
      return;
    }

    this.isRunning = true;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Add one day to make the comparison inclusive of today
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find all active rules with next_due_date <= today
      const dueRules = await this.prisma.recurring_expense_rule.findMany({
        where: {
          status: 'active',
          next_due_date: {
            lt: tomorrow, // next_due_date < tomorrow (i.e., <= today for DATE fields)
          },
        },
        select: {
          id: true,
          tenant_id: true,
          name: true,
        },
      });

      this.logger.log(
        `Found ${dueRules.length} recurring expense rules due for processing`,
      );

      let enqueued = 0;
      let failed = 0;

      for (const rule of dueRules) {
        try {
          await this.recurringExpenseQueue.add(
            'recurring-expense-generate',
            {
              ruleId: rule.id,
              tenantId: rule.tenant_id,
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 10000, // Start at 10 seconds
              },
              removeOnComplete: {
                age: 86400, // Keep completed jobs for 24 hours
                count: 500,
              },
              removeOnFail: false, // Keep failed for inspection
            },
          );

          enqueued++;
          this.logger.debug(
            `Enqueued recurring expense job for rule: ${rule.name} (${rule.id})`,
          );
        } catch (err) {
          failed++;
          const error = err instanceof Error ? err : new Error(String(err));
          this.logger.error(
            `Failed to enqueue job for rule ${rule.name} (${rule.id}): ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Recurring expense scheduler complete: ${enqueued} enqueued, ${failed} failed`,
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Recurring expense scheduler failed: ${error.message}`,
        error.stack,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
