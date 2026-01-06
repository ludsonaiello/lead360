import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateAuditLogDto } from '../dto';

@Processor('audit-log-write')
export class AuditLogWriteJob {
  private readonly logger = new Logger(AuditLogWriteJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('write-log')
  async handleWriteLog(job: Job<CreateAuditLogDto>) {
    const logData = job.data;

    this.logger.debug(`Processing audit log write: ${logData.description}`);

    try {
      await this.prisma.auditLog.create({
        data: logData,
      });

      this.logger.debug(`Audit log written successfully: ${logData.entity_type}/${logData.entity_id}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${error.message}`, error.stack);
      throw error; // BullMQ will retry
    }
  }
}
