import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../rbac/guards/platform-admin.guard';
import { ScheduledJobService } from '../services/scheduled-job.service';
import { JobQueueService } from '../services/job-queue.service';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  CreateScheduledJobDto,
  UpdateScheduledJobDto,
} from '../dto/scheduled-job.dto';
import { PaginationDto } from '../dto/common.dto';

@ApiTags('Background Jobs - Scheduled Jobs')
@ApiBearerAuth()
@Controller('admin/jobs/schedules')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class ScheduledJobsController {
  constructor(
    private readonly scheduledJobService: ScheduledJobService,
    private readonly jobQueue: JobQueueService,
    private readonly prisma: PrismaService,
    @InjectQueue('scheduled-reports')
    private readonly scheduledReportsQueue: Queue,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all scheduled jobs (system jobs + scheduled reports)',
  })
  @ApiResponse({ status: 200, description: 'Scheduled jobs retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async listScheduledJobs(@Query() pagination: PaginationDto) {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    // Fetch both system jobs and scheduled reports in parallel
    const [systemJobs, scheduledReports] = await Promise.all([
      this.prisma.scheduled_job.findMany({
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.scheduled_report.findMany({
        orderBy: { created_at: 'desc' },
        include: {
          admin_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    // Transform system jobs to common format
    const transformedSystemJobs = systemJobs.map((job) => ({
      id: job.id,
      type: 'system' as const,
      name: job.name,
      description: job.description || null,
      schedule: job.schedule, // Cron expression
      schedule_type: this.parseCronToType(job.schedule), // 'daily', 'weekly', 'monthly', 'custom'
      is_active: job.is_enabled,
      next_run_at: job.next_run_at?.toISOString() || null,
      last_run_at: job.last_run_at?.toISOString() || null,
      created_at: job.created_at.toISOString(),
      updated_at: job.updated_at.toISOString(),
      metadata: {
        job_type: job.job_type,
        timezone: job.timezone,
        max_retries: job.max_retries,
        timeout_seconds: job.timeout_seconds,
      },
    }));

    // Transform scheduled reports to common format
    const transformedReports = scheduledReports.map((report) => ({
      id: report.id,
      type: 'quote-report' as const,
      name: report.name,
      description: `${report.report_type} report (${report.format.toUpperCase()})`,
      schedule: this.scheduleToCron(report.schedule), // Convert 'daily' -> '0 0 * * *'
      schedule_type: report.schedule, // 'daily', 'weekly', 'monthly'
      is_active: report.is_active,
      next_run_at: report.next_run_at.toISOString(),
      last_run_at: report.last_run_at?.toISOString() || null,
      created_at: report.created_at.toISOString(),
      updated_at: report.updated_at.toISOString(),
      metadata: {
        report_type: report.report_type,
        format: report.format,
        recipients: report.recipients,
        parameters: report.parameters,
        admin_user: report.admin_user,
      },
    }));

    // Combine both types
    const allJobs = [...transformedSystemJobs, ...transformedReports];

    // Sort by next_run_at (nulls last) or created_at
    allJobs.sort((a, b) => {
      if (a.next_run_at && b.next_run_at) {
        return (
          new Date(a.next_run_at).getTime() - new Date(b.next_run_at).getTime()
        );
      }
      if (a.next_run_at) return -1;
      if (b.next_run_at) return 1;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    // Apply pagination
    const total = allJobs.length;
    const paginatedJobs = allJobs.slice(skip, skip + limit);

    return {
      data: paginatedJobs,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_count: total,
        limit,
      },
      summary: {
        total_jobs: allJobs.length,
        system_jobs: transformedSystemJobs.length,
        quote_reports: transformedReports.length,
        active_jobs: allJobs.filter((j) => j.is_active).length,
      },
    };
  }

  /**
   * Convert schedule string to cron expression
   */
  private scheduleToCron(schedule: string): string {
    switch (schedule) {
      case 'daily':
        return '0 0 * * *'; // Every day at midnight
      case 'weekly':
        return '0 0 * * 1'; // Every Monday at midnight
      case 'monthly':
        return '0 0 1 * *'; // First day of month at midnight
      default:
        return schedule; // Return as-is if already a cron expression
    }
  }

  /**
   * Parse cron expression to simple schedule type
   */
  private parseCronToType(cron: string): string {
    if (cron === '0 0 * * *') return 'daily';
    if (cron === '0 0 * * 1') return 'weekly';
    if (cron === '0 0 1 * *') return 'monthly';
    return 'custom';
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scheduled job or report details' })
  @ApiParam({
    name: 'id',
    description: 'Scheduled Job or Report ID',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Scheduled job/report retrieved' })
  @ApiResponse({ status: 404, description: 'Scheduled job/report not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async getScheduledJob(@Param('id') id: string) {
    // First, try to find as a system job
    const systemJob = await this.prisma.scheduled_job.findUnique({
      where: { id },
    });

    if (systemJob) {
      return {
        ...systemJob,
        type: 'system',
      };
    }

    // Then, try to find as a scheduled report
    const scheduledReport = await this.prisma.scheduled_report.findUnique({
      where: { id },
      include: {
        admin_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (scheduledReport) {
      return {
        ...scheduledReport,
        type: 'quote-report',
      };
    }

    throw new NotFoundException('Scheduled job or report not found');
  }

  @Post()
  @ApiOperation({ summary: 'Create a new scheduled job' })
  @ApiResponse({ status: 201, description: 'Scheduled job created' })
  @ApiResponse({ status: 400, description: 'Invalid cron expression or data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async createScheduledJob(@Body() dto: CreateScheduledJobDto) {
    return this.scheduledJobService.registerScheduledJob(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update scheduled job configuration' })
  @ApiParam({ name: 'id', description: 'Scheduled Job ID', type: String })
  @ApiResponse({ status: 200, description: 'Scheduled job updated' })
  @ApiResponse({ status: 404, description: 'Scheduled job not found' })
  @ApiResponse({ status: 400, description: 'Invalid cron expression or data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async updateScheduledJob(
    @Param('id') id: string,
    @Body() dto: UpdateScheduledJobDto,
  ) {
    return this.scheduledJobService.updateSchedule(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a scheduled job' })
  @ApiParam({ name: 'id', description: 'Scheduled Job ID', type: String })
  @ApiResponse({ status: 204, description: 'Scheduled job deleted' })
  @ApiResponse({ status: 404, description: 'Scheduled job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async deleteScheduledJob(@Param('id') id: string) {
    await this.prisma.scheduled_job.delete({ where: { id } });
  }

  @Post(':id/trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger a scheduled job or report to run immediately',
  })
  @ApiParam({
    name: 'id',
    description: 'Scheduled Job ID or Scheduled Report ID',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Job triggered successfully' })
  @ApiResponse({
    status: 404,
    description: 'Scheduled job or report not found',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async triggerScheduledJob(@Param('id') id: string) {
    // First, try to find in scheduled_job table (system jobs)
    const systemJob = await this.prisma.scheduled_job.findUnique({
      where: { id },
    });

    if (systemJob) {
      // Handle system job trigger
      const { jobId } = await this.jobQueue.queueScheduledJob(
        systemJob.job_type,
        {
          scheduleId: systemJob.id,
          scheduleName: systemJob.name,
          manualTrigger: true,
        },
      );

      // Update last_run_at so the dashboard reflects the manual run
      await this.scheduledJobService.updateLastRun(
        systemJob.id,
        systemJob.schedule,
        systemJob.timezone,
      );

      return {
        message: 'System job triggered successfully',
        job_id: jobId,
        type: 'system',
      };
    }

    // If not found in system jobs, try scheduled_report table
    const scheduledReport = await this.prisma.scheduled_report.findUnique({
      where: { id },
    });

    if (!scheduledReport) {
      throw new NotFoundException('Scheduled job or report not found');
    }

    // Handle scheduled report trigger
    // Queue as "scheduled-report" job so ScheduledReportProcessor handles it
    // This ensures the same flow as automatic execution:
    // - Calls queueReportGeneration (creates export_job and queues process-export)
    // - Updates scheduled_report's last_run_at and next_run_at
    // - Any future email sending logic works automatically

    const { randomBytes } = require('crypto');
    const jobId = `manual-${randomBytes(8).toString('hex')}`;

    const job = await this.scheduledReportsQueue.add(
      'scheduled-report', // Use same job name as automatic execution
      {
        scheduledReportId: scheduledReport.id,
        report_type: scheduledReport.report_type,
        parameters: scheduledReport.parameters, // Pass raw parameters, processor will resolve
        format: scheduledReport.format,
      },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    return {
      message: 'Scheduled report triggered successfully',
      job_id: job.id,
      type: 'quote-report',
    };
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get last 100 execution runs for a scheduled job or report',
  })
  @ApiParam({
    name: 'id',
    description: 'Scheduled Job or Report ID',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Execution history retrieved' })
  @ApiResponse({ status: 404, description: 'Scheduled job/report not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async getScheduleHistory(
    @Param('id') id: string,
    @Query('limit') limit: number = 100,
  ) {
    // First, check if it's a system job
    const systemJob = await this.prisma.scheduled_job.findUnique({
      where: { id },
      select: { job_type: true },
    });

    if (systemJob) {
      // Return job execution history for system jobs
      return this.scheduledJobService.getScheduleHistory(id, limit);
    }

    // Then, check if it's a scheduled report
    const scheduledReport = await this.prisma.scheduled_report.findUnique({
      where: { id },
    });

    if (!scheduledReport) {
      throw new NotFoundException('Scheduled job or report not found');
    }

    // Return export_job history for scheduled reports
    // Find all export jobs that were created by this scheduled report
    const exportJobs = await this.prisma.export_job.findMany({
      where: {
        filters: {
          path: '$._scheduledReportId',
          equals: id,
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        admin_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    return exportJobs;
  }
}
