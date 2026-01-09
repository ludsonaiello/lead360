import { randomBytes } from 'crypto';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateAuditLogDto } from '../dto';

@Processor('audit-log-write')
export class AuditLogWriteJob extends WorkerHost {
  private readonly logger = new Logger(AuditLogWriteJob.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<CreateAuditLogDto, any, string>): Promise<any> {
    const logData = job.data;

    this.logger.debug(`Processing audit log write: ${logData.description}`);

    try {
      await this.prisma.audit_log.create({
        data: {
          id: randomBytes(16).toString('hex'),
          ...logData,
          // Convert JSON objects to strings for Prisma
          before_json: logData.before_json ? JSON.stringify(logData.before_json) : null,
          after_json: logData.after_json ? JSON.stringify(logData.after_json) : null,
          metadata_json: logData.metadata_json ? JSON.stringify(logData.metadata_json) : null,
        } as any,
      });

      this.logger.debug(`Audit log written successfully: ${logData.entity_type}/${logData.entity_id}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${error.message}`, error.stack);
      throw error; // BullMQ will retry
    }
  }
}
