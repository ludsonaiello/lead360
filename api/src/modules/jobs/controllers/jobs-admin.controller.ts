import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../rbac/guards/platform-admin.guard';
import { PrismaService } from '../../../core/database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobFilterDto } from '../dto/job.dto';
import { PaginatedResponseDto } from '../dto/common.dto';

@ApiTags('Background Jobs - Admin')
@ApiBearerAuth()
@Controller('admin/jobs')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class JobsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('scheduled') private scheduledQueue: Queue,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all jobs with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async listJobs(
    @Query() filters: JobFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const {
      page = 1,
      limit = 50,
      status,
      job_type,
      tenant_id,
      date_from,
      date_to,
    } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (job_type) where.job_type = job_type;
    if (tenant_id) where.tenant_id = tenant_id;
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at.gte = new Date(date_from);
      if (date_to) where.created_at.lte = new Date(date_to);
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data: jobs,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_count: total,
        limit,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job details with logs' })
  @ApiParam({ name: 'id', description: 'Job ID', type: String })
  @ApiResponse({ status: 200, description: 'Job details retrieved' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async getJob(@Param('id') id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        job_log: {
          orderBy: { timestamp: 'asc' },
        },
        email_queue: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'id', description: 'Job ID', type: String })
  @ApiResponse({ status: 200, description: 'Job requeued successfully' })
  @ApiResponse({ status: 400, description: 'Job cannot be retried' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async retryJob(@Param('id') id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== 'failed') {
      throw new BadRequestException('Only failed jobs can be retried');
    }

    // Reset job status
    await this.prisma.job.update({
      where: { id },
      data: {
        status: 'pending',
        started_at: null,
        failed_at: null,
        error_message: null,
      },
    });

    // Re-queue to appropriate queue
    const queue =
      job.job_type === 'send-email' ? this.emailQueue : this.scheduledQueue;
    await queue.add(job.job_type, job.payload, { jobId: id });

    return { message: 'Job requeued successfully', job_id: id };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a specific job' })
  @ApiParam({ name: 'id', description: 'Job ID', type: String })
  @ApiResponse({ status: 204, description: 'Job deleted successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async deleteJob(@Param('id') id: string) {
    await this.prisma.job.delete({ where: { id } });
  }

  @Get('failed/list')
  @ApiOperation({ summary: 'List all failed jobs' })
  @ApiResponse({ status: 200, description: 'Failed jobs retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async listFailedJobs(@Query() filters: JobFilterDto) {
    return this.listJobs({ ...filters, status: 'failed' });
  }

  @Post('failed/retry-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry all failed jobs' })
  @ApiResponse({ status: 200, description: 'All failed jobs requeued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async retryAllFailedJobs() {
    const failedJobs = await this.prisma.job.findMany({
      where: { status: 'failed' },
    });

    for (const job of failedJobs) {
      try {
        await this.retryJob(job.id);
      } catch (error) {
        // Continue with other jobs even if one fails
        console.error(`Failed to retry job ${job.id}:`, error.message);
      }
    }

    return {
      message: `${failedJobs.length} failed jobs requeued successfully`,
      count: failedJobs.length,
    };
  }

  @Delete('failed/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all failed jobs from database' })
  @ApiResponse({ status: 200, description: 'Failed jobs cleared' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async clearFailedJobs() {
    const result = await this.prisma.job.deleteMany({
      where: { status: 'failed' },
    });

    return {
      message: `${result.count} failed jobs deleted`,
      count: result.count,
    };
  }

  @Get('health/status')
  @ApiOperation({ summary: 'Get queue health metrics' })
  @ApiResponse({ status: 200, description: 'Queue health retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async getQueueHealth() {
    const [emailCounts, scheduledCounts] = await Promise.all([
      this.emailQueue.getJobCounts(),
      this.scheduledQueue.getJobCounts(),
    ]);

    const jobStats = await this.prisma.job.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      queues: {
        email: emailCounts,
        scheduled: scheduledCounts,
      },
      database: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        ...jobStats.reduce(
          (acc, stat) => {
            acc[stat.status] = stat._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    };
  }
}
