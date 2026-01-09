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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
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
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all scheduled jobs' })
  @ApiResponse({ status: 200, description: 'Scheduled jobs retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async listScheduledJobs(@Query() pagination: PaginationDto) {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const [schedules, total] = await Promise.all([
      this.prisma.scheduled_job.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.scheduled_job.count(),
    ]);

    return {
      data: schedules,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_count: total,
        limit,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scheduled job details' })
  @ApiParam({ name: 'id', description: 'Scheduled Job ID', type: String })
  @ApiResponse({ status: 200, description: 'Scheduled job retrieved' })
  @ApiResponse({ status: 404, description: 'Scheduled job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async getScheduledJob(@Param('id') id: string) {
    const schedule = await this.prisma.scheduled_job.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Scheduled job not found');
    }

    return schedule;
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
  @ApiOperation({ summary: 'Manually trigger a scheduled job to run immediately' })
  @ApiParam({ name: 'id', description: 'Scheduled Job ID', type: String })
  @ApiResponse({ status: 200, description: 'Job triggered successfully' })
  @ApiResponse({ status: 404, description: 'Scheduled job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async triggerScheduledJob(@Param('id') id: string) {
    const schedule = await this.prisma.scheduled_job.findUnique({ where: { id } });

    if (!schedule) {
      throw new NotFoundException('Scheduled job not found');
    }

    const { jobId } = await this.jobQueue.queueScheduledJob(schedule.job_type, {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      manualTrigger: true,
    });

    return {
      message: 'Job triggered successfully',
      job_id: jobId,
    };
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get last 100 execution runs for a scheduled job' })
  @ApiParam({ name: 'id', description: 'Scheduled Job ID', type: String })
  @ApiResponse({ status: 200, description: 'Execution history retrieved' })
  @ApiResponse({ status: 404, description: 'Scheduled job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async getScheduleHistory(
    @Param('id') id: string,
    @Query('limit') limit: number = 100,
  ) {
    return this.scheduledJobService.getScheduleHistory(id, limit);
  }
}
