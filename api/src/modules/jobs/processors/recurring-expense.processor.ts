import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RecurringExpenseService } from '../../financial/services/recurring-expense.service';

interface RecurringExpenseJobPayload {
  ruleId: string;
  tenantId: string;
  manualTrigger?: boolean;
}

@Processor('recurring-expense-generation')
export class RecurringExpenseProcessor extends WorkerHost {
  private readonly logger = new Logger(RecurringExpenseProcessor.name);

  constructor(
    private readonly recurringExpenseService: RecurringExpenseService,
  ) {
    super();
    this.logger.log('RecurringExpenseProcessor worker initialized and ready');
  }

  async process(job: Job<RecurringExpenseJobPayload>): Promise<any> {
    const { ruleId, tenantId, manualTrigger } = job.data;

    this.logger.log(
      `Processing recurring expense job: rule ${ruleId}, tenant ${tenantId}${manualTrigger ? ' (manual trigger)' : ''}`,
    );

    try {
      const entry = await this.recurringExpenseService.processRule(
        ruleId,
        tenantId,
        manualTrigger,
      );

      if (entry) {
        this.logger.log(
          `Successfully generated entry ${entry.id} for rule ${ruleId}`,
        );
        return { success: true, entryId: entry.id };
      } else {
        this.logger.log(
          `Rule ${ruleId} skipped (not due, paused, or duplicate)`,
        );
        return { success: true, skipped: true };
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Failed to process recurring expense rule ${ruleId}: ${error.message}`,
        error.stack,
      );

      // On final attempt, log but don't poison the queue
      if (job.attemptsMade >= (job.opts?.attempts ?? 3) - 1) {
        this.logger.error(
          `Final attempt failed for rule ${ruleId} — marking complete to prevent queue poisoning`,
        );
        return {
          success: false,
          error: error.message,
          finalAttempt: true,
        };
      }

      throw error; // Throw to trigger retry
    }
  }
}
