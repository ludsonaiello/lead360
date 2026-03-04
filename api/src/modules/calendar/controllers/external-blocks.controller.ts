import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PrismaService } from '../../../core/database/prisma.service';
import { DateTimeConverterService } from '../services/datetime-converter.service';
import {
  GetExternalBlocksDto,
  ExternalBlocksResponseDto,
  ExternalBlockDto,
} from '../dto';

/**
 * ExternalBlocksController
 *
 * Sprint 13B: External Block Management
 * Sprint 31: Visual display of external blocks on calendar UI
 *
 * Provides external calendar blocks (from Google Calendar integration)
 * for visual display on the calendar as "Busy — Blocked (External)" indicators.
 *
 * Note: External blocks are ALREADY factored into availability calculation
 * (see SlotCalculationService). This endpoint is solely for visual display.
 */
@ApiTags('Calendar - External Blocks')
@ApiBearerAuth()
@Controller('calendar/external-blocks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExternalBlocksController {
  private readonly logger = new Logger(ExternalBlocksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly datetimeConverter: DateTimeConverterService,
  ) {}

  @Get()
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get external calendar blocks',
    description:
      'Returns external calendar blocks (from Google Calendar integration) for visual display on the calendar UI. ' +
      'External blocks represent busy times from external calendars and are displayed as "Busy — Blocked (External)" indicators. ' +
      'Note: These blocks are already factored into availability calculation - this endpoint is for visual display only.',
  })
  @ApiQuery({
    name: 'date_from',
    description: 'Start of date range (YYYY-MM-DD)',
    required: true,
    type: String,
    example: '2026-03-02',
  })
  @ApiQuery({
    name: 'date_to',
    description: 'End of date range (YYYY-MM-DD)',
    required: true,
    type: String,
    example: '2026-03-16',
  })
  @ApiQuery({
    name: 'appointment_type_id',
    description:
      'Optional appointment type ID (reserved for future filtering)',
    required: false,
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'External blocks retrieved successfully',
    type: ExternalBlocksResponseDto,
    schema: {
      example: {
        date_range: {
          from: '2026-03-02',
          to: '2026-03-16',
        },
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            start_datetime_utc: '2026-03-15T14:00:00.000Z',
            end_datetime_utc: '2026-03-15T15:30:00.000Z',
            is_all_day: false,
            source: 'google_calendar',
          },
          {
            id: '223e4567-e89b-12d3-a456-426614174001',
            start_datetime_utc: '2026-03-10T00:00:00.000Z',
            end_datetime_utc: '2026-03-11T00:00:00.000Z',
            is_all_day: true,
            source: 'google_calendar',
          },
        ],
        total_blocks: 2,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters (e.g., invalid date format)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async getExternalBlocks(
    @Request() req,
    @Query() query: GetExternalBlocksDto,
  ): Promise<ExternalBlocksResponseDto> {
    const tenantId = req.user.tenant_id;

    // CRITICAL: Tenant ID must be present (platform admins don't have calendar data)
    if (!tenantId) {
      this.logger.error(
        `External blocks request without tenant_id - User: ${req.user.sub}`,
      );
      throw new Error(
        'Tenant ID is required. Platform admins cannot access tenant-specific calendar data.',
      );
    }

    this.logger.log(
      `GET /calendar/external-blocks - Tenant: ${tenantId}, Range: ${query.date_from} to ${query.date_to}`,
    );

    // Get tenant for timezone information
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });

    if (!tenant) {
      this.logger.error(`Tenant ${tenantId} not found`);
      throw new Error('Tenant not found');
    }

    // Convert date range to UTC for database query
    // External blocks are stored in UTC, so we need to query the full UTC range
    // that covers the local date range
    const dateFromUtc = this.datetimeConverter.localToUtc(
      query.date_from,
      '00:00',
      tenant.timezone,
    );
    const dateToUtc = this.datetimeConverter.localToUtc(
      query.date_to,
      '23:59',
      tenant.timezone,
    );

    this.logger.debug(
      `Querying external blocks: Local range ${query.date_from} to ${query.date_to} ` +
        `(${tenant.timezone}) -> UTC range ${dateFromUtc.toISOString()} to ${dateToUtc.toISOString()}`,
    );

    // Query external blocks
    // Block overlaps with date range if: block_start <= dateTo AND block_end >= dateFrom
    const externalBlocks = await this.prisma.calendar_external_block.findMany({
      where: {
        tenant_id: tenantId, // CRITICAL: Multi-tenant isolation
        start_datetime_utc: {
          lte: dateToUtc,
        },
        end_datetime_utc: {
          gte: dateFromUtc,
        },
      },
      select: {
        id: true,
        start_datetime_utc: true,
        end_datetime_utc: true,
        is_all_day: true,
        source: true,
      },
      orderBy: {
        start_datetime_utc: 'asc',
      },
    });

    this.logger.log(
      `Found ${externalBlocks.length} external blocks for tenant ${tenantId}`,
    );

    // Map to DTO format
    const data: ExternalBlockDto[] = externalBlocks.map((block) => ({
      id: block.id,
      start_datetime_utc: block.start_datetime_utc.toISOString(),
      end_datetime_utc: block.end_datetime_utc.toISOString(),
      is_all_day: block.is_all_day,
      source: block.source,
    }));

    return {
      date_range: {
        from: query.date_from,
        to: query.date_to,
      },
      data,
      total_blocks: data.length,
    };
  }
}
