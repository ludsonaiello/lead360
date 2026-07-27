import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import {
  ClockInDto,
  ClockOutDto,
  ListClockSessionsDto,
  ListMyClockSessionsDto,
  LocationSourceEnum,
} from '../dto/clock-session.dto';
import { GeofenceService } from './geofence.service';
import { LaborCostAttributionService } from './labor-cost-attribution.service';
import { OvertimeService } from './overtime.service';
import { TimeClockSettingsService } from './time-clock-settings.service';

type SessionStatus = 'active' | 'on_break' | 'completed';
type LocationSource = 'browser_gps' | 'native_gps' | 'kiosk' | 'manual';
type GeofenceStatusValue =
  | 'inside'
  | 'outside'
  | 'unavailable'
  | 'not_enforced';

interface TimeClockSettingsLike {
  clock_in_mode: string;
  geofence_violation_action: string;
  gps_required: boolean;
  gps_unavailable_action: string;
  require_job_tag: boolean;
  require_task_tag: boolean;
}

const SHIFT_MATCH_WINDOW_MS = 2 * 60 * 60 * 1000; // ±2 hours
const ADMIN_ROLE_NAMES = ['Owner', 'Admin'] as const;

const DETAIL_INCLUDE = {
  employee_profile: {
    include: {
      user: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
      },
      crew_member: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
  },
  project: {
    select: { id: true, name: true, project_number: true, status: true },
  },
  task: { select: { id: true, title: true, status: true } },
  work_shift: {
    select: {
      id: true,
      scheduled_start: true,
      scheduled_end: true,
      status: true,
      title: true,
    },
  },
  clockin_address: {
    select: { id: true, label: true, latitude: true, longitude: true },
  },
  break_entries: {
    orderBy: { started_at: 'asc' },
  },
  edit_logs: {
    orderBy: { edited_at: 'desc' },
    include: {
      edited_by: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
  },
  disputes: {
    orderBy: { created_at: 'desc' },
  },
} satisfies Prisma.clock_sessionInclude;

const LIST_INCLUDE = {
  employee_profile: {
    include: {
      user: {
        select: { id: true, first_name: true, last_name: true, email: true },
      },
    },
  },
  project: { select: { id: true, name: true, project_number: true } },
  task: { select: { id: true, title: true } },
  work_shift: {
    select: {
      id: true,
      scheduled_start: true,
      scheduled_end: true,
      status: true,
    },
  },
} satisfies Prisma.clock_sessionInclude;

const ACTIVE_LIST_INCLUDE = {
  employee_profile: {
    include: {
      user: {
        select: { id: true, first_name: true, last_name: true, email: true },
      },
    },
  },
  project: { select: { id: true, name: true, project_number: true } },
  task: { select: { id: true, title: true } },
  clockin_address: { select: { id: true, label: true } },
  break_entries: {
    where: { ended_at: null },
  },
} satisfies Prisma.clock_sessionInclude;

const MY_ACTIVE_INCLUDE = {
  project: { select: { id: true, name: true, project_number: true } },
  task: { select: { id: true, title: true } },
  work_shift: {
    select: {
      id: true,
      scheduled_start: true,
      scheduled_end: true,
      status: true,
    },
  },
  clockin_address: {
    select: { id: true, label: true, latitude: true, longitude: true },
  },
  break_entries: {
    where: { ended_at: null },
    orderBy: { started_at: 'asc' },
  },
} satisfies Prisma.clock_sessionInclude;

const MINE_LIST_INCLUDE = {
  project: { select: { id: true, name: true, project_number: true } },
  task: { select: { id: true, title: true } },
  work_shift: {
    select: {
      id: true,
      scheduled_start: true,
      scheduled_end: true,
      status: true,
    },
  },
} satisfies Prisma.clock_sessionInclude;

@Injectable()
export class ClockSessionService {
  private readonly logger = new Logger(ClockSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geofenceService: GeofenceService,
    private readonly overtimeService: OvertimeService,
    private readonly laborCostAttributionService: LaborCostAttributionService,
    private readonly notificationsService: NotificationsService,
    private readonly timeClockSettingsService: TimeClockSettingsService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // CLOCK IN — BR-001, BR-003, BR-004, BR-009
  // ────────────────────────────────────────────────────────────────
  async clockIn(tenantId: string, userId: string, dto: ClockInDto) {
    // Step 1 — find active employee profile
    const profile = await this.prisma.employee_profile.findFirst({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        user: { select: { id: true, first_name: true, last_name: true } },
      },
    });

    if (!profile) {
      throw new NotFoundException('Employee profile not found or inactive');
    }

    // Step 2 — BR-001: one-active-session enforcement
    const existingActive = await this.prisma.clock_session.findFirst({
      where: {
        tenant_id: tenantId,
        employee_profile_id: profile.id,
        status: { in: ['active', 'on_break'] },
      },
      select: { id: true },
    });

    if (existingActive) {
      throw new ConflictException(
        'You already have an active clock session. Please clock out first.',
      );
    }

    // Step 3 — load tenant settings (always returns defaults if none exist)
    const settings = (await this.timeClockSettingsService.getSettings(
      tenantId,
    )) as unknown as TimeClockSettingsLike;

    // Step 4 — require_job_tag enforcement
    if (settings.require_job_tag === true && !dto.project_id) {
      throw new BadRequestException('Project selection is required');
    }

    // Step 5 — require_task_tag enforcement
    if (settings.require_task_tag === true && !dto.task_id) {
      throw new BadRequestException('Task selection is required');
    }

    // Step 6 — BR-004: GPS availability check
    let geofenceStatus: GeofenceStatusValue = 'not_enforced';
    let isFlagged = false;
    let flagReason: string | null = null;
    let clockinAddressId: string | null = null;

    const hasCoordinates =
      dto.latitude !== undefined &&
      dto.latitude !== null &&
      dto.longitude !== undefined &&
      dto.longitude !== null;

    const employeeDisplayName = this.buildEmployeeDisplayName(
      profile.user?.first_name ?? null,
      profile.user?.last_name ?? null,
    );

    // Per BR-004: when gps_required === false, geofence is skipped entirely
    // regardless of whether coordinates were captured.
    if (settings.gps_required === true) {
      if (!hasCoordinates) {
        if (settings.gps_unavailable_action === 'block') {
          throw new ForbiddenException('GPS location is required to clock in.');
        }
        isFlagged = true;
        flagReason =
          'GPS location unavailable — employee denied or browser blocked location access';
        geofenceStatus = 'unavailable';

        await this.notifyAdmins(
          tenantId,
          'timeclock_gps_unavailable',
          'GPS Unavailable',
          `${employeeDisplayName} clocked in without GPS — location unavailable`,
          '/workforce/timesheets',
        );
      } else if (settings.clock_in_mode !== 'anywhere') {
        // Step 7 — BR-003: geofence enforcement
        const result = await this.geofenceService.checkGeofence({
          tenantId,
          latitude: dto.latitude as number,
          longitude: dto.longitude as number,
          projectId: dto.project_id ?? undefined,
          clockInMode: settings.clock_in_mode,
        });

        if (result.geofence_status === 'outside') {
          if (settings.geofence_violation_action === 'block') {
            await this.notifyAdmins(
              tenantId,
              'timeclock_geofence_block',
              'Clock-In Blocked',
              `${employeeDisplayName} was blocked from clocking in — outside all configured locations`,
              '/workforce/timesheets',
            );
            throw new ForbiddenException(
              'You are outside all configured clock-in locations',
            );
          }
          isFlagged = true;
          flagReason =
            result.flag_reason ?? 'Outside all configured locations';
          geofenceStatus = 'outside';
          await this.notifyAdmins(
            tenantId,
            'timeclock_geofence_warning',
            'Geofence Warning',
            `${employeeDisplayName} clocked in outside configured locations`,
            '/workforce/timesheets',
          );
        } else if (result.geofence_status === 'inside') {
          geofenceStatus = 'inside';
          clockinAddressId = result.clockin_address_id;
        }
      }
    }

    // Step 8 — BR-009: shift auto-match
    const now = new Date();
    const windowStart = new Date(now.getTime() - SHIFT_MATCH_WINDOW_MS);
    const windowEnd = new Date(now.getTime() + SHIFT_MATCH_WINDOW_MS);

    const candidateShifts = await this.prisma.work_shift.findMany({
      where: {
        tenant_id: tenantId,
        employee_profile_id: profile.id,
        status: 'scheduled',
        scheduled_start: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { scheduled_start: 'asc' },
    });

    let matchedShiftId: string | null = null;
    if (candidateShifts.length > 0) {
      let closest = candidateShifts[0];
      let closestDelta = Math.abs(
        new Date(closest.scheduled_start).getTime() - now.getTime(),
      );
      for (let i = 1; i < candidateShifts.length; i += 1) {
        const delta = Math.abs(
          new Date(candidateShifts[i].scheduled_start).getTime() -
            now.getTime(),
        );
        if (delta < closestDelta) {
          closest = candidateShifts[i];
          closestDelta = delta;
        }
      }
      matchedShiftId = closest.id;

      await this.prisma.work_shift.update({
        where: { id: matchedShiftId },
        data: { status: 'in_progress' },
      });
    }

    // Step 9 — create the session
    const created = await this.prisma.clock_session.create({
      data: {
        tenant_id: tenantId,
        employee_profile_id: profile.id,
        work_shift_id: matchedShiftId,
        project_id: dto.project_id ?? null,
        task_id: dto.task_id ?? null,
        clockin_address_id: clockinAddressId,
        status: 'active',
        clock_in_at: now,
        clock_in_latitude:
          dto.latitude !== undefined && dto.latitude !== null
            ? new Prisma.Decimal(dto.latitude)
            : null,
        clock_in_longitude:
          dto.longitude !== undefined && dto.longitude !== null
            ? new Prisma.Decimal(dto.longitude)
            : null,
        clock_in_location_source: (dto.location_source ??
          LocationSourceEnum.BROWSER_GPS) as LocationSource,
        clock_in_geofence_status: geofenceStatus,
        is_flagged: isFlagged,
        flag_reason: flagReason,
        notes: dto.notes ?? null,
      },
    });

    // Step 10 — return with includes
    const session = await this.prisma.clock_session.findFirst({
      where: { id: created.id, tenant_id: tenantId },
      include: DETAIL_INCLUDE,
    });

    return session;
  }

  // ────────────────────────────────────────────────────────────────
  // CLOCK OUT
  // ────────────────────────────────────────────────────────────────
  async clockOut(tenantId: string, userId: string, dto: ClockOutDto) {
    const profile = await this.prisma.employee_profile.findFirst({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        user: { select: { id: true, first_name: true, last_name: true } },
        crew_member: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            default_hourly_rate: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Employee profile not found or inactive');
    }

    const session = await this.prisma.clock_session.findFirst({
      where: {
        tenant_id: tenantId,
        employee_profile_id: profile.id,
        status: { in: ['active', 'on_break'] },
      },
    });

    if (!session) {
      throw new NotFoundException('No active clock session found');
    }

    const clockOutAt = new Date();

    // Step 2 — auto-end active break if session is on_break
    if (session.status === 'on_break') {
      const openBreak = await this.prisma.break_entry.findFirst({
        where: {
          tenant_id: tenantId,
          clock_session_id: session.id,
          ended_at: null,
        },
        orderBy: { started_at: 'desc' },
      });

      if (openBreak) {
        const startedAt = new Date(openBreak.started_at);
        const durationMinutes = Math.max(
          0,
          Math.floor((clockOutAt.getTime() - startedAt.getTime()) / 60000),
        );

        await this.prisma.break_entry.update({
          where: { id: openBreak.id },
          data: {
            ended_at: clockOutAt,
            duration_minutes: durationMinutes,
          },
        });
      }
    }

    // Step 4 — compute total_worked_minutes (subtract unpaid breaks only)
    const unpaidBreaks = await this.prisma.break_entry.findMany({
      where: {
        tenant_id: tenantId,
        clock_session_id: session.id,
        break_type: 'unpaid',
        duration_minutes: { not: null },
      },
      select: { duration_minutes: true },
    });

    const unpaidBreakMinutes = unpaidBreaks.reduce(
      (sum, entry) => sum + (entry.duration_minutes ?? 0),
      0,
    );

    const clockInAt = new Date(session.clock_in_at);
    const rawMinutes = Math.floor(
      (clockOutAt.getTime() - clockInAt.getTime()) / 60000,
    );
    const totalWorkedMinutes = Math.max(0, rawMinutes - unpaidBreakMinutes);

    // Step 5 — calculate overtime
    const { regular_minutes, overtime_minutes } =
      await this.overtimeService.calculateOvertime({
        tenantId,
        employeeProfileId: session.employee_profile_id,
        sessionId: session.id,
        totalWorkedMinutes,
        clockInAt,
      });

    // Step 6 — update matched work shift status
    if (session.work_shift_id) {
      try {
        await this.prisma.work_shift.update({
          where: { id: session.work_shift_id },
          data: { status: 'completed' },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to mark work_shift ${session.work_shift_id} completed for session ${session.id}: ${
            (error as Error).message
          }`,
        );
      }
    }

    // Step 8 — update session to completed (persist totals before posting labor cost)
    const updated = await this.prisma.clock_session.update({
      where: { id: session.id },
      data: {
        status: 'completed',
        clock_out_at: clockOutAt,
        clock_out_latitude:
          dto.latitude !== undefined && dto.latitude !== null
            ? new Prisma.Decimal(dto.latitude)
            : null,
        clock_out_longitude:
          dto.longitude !== undefined && dto.longitude !== null
            ? new Prisma.Decimal(dto.longitude)
            : null,
        clock_out_location_source: (dto.location_source ??
          LocationSourceEnum.BROWSER_GPS) as LocationSource,
        total_worked_minutes: totalWorkedMinutes,
        regular_minutes,
        overtime_minutes,
        notes: dto.notes ?? session.notes,
      },
    });

    // Step 7 — BR-005: post labor cost (non-blocking)
    try {
      await this.laborCostAttributionService.postLaborCost(
        {
          id: updated.id,
          project_id: updated.project_id,
          task_id: updated.task_id,
          clock_in_at: updated.clock_in_at,
          regular_minutes: updated.regular_minutes,
          overtime_minutes: updated.overtime_minutes,
          labor_cost_posted: updated.labor_cost_posted,
        },
        {
          id: profile.id,
          user_id: profile.user_id,
          crew_member_id: profile.crew_member_id,
          hourly_rate: profile.hourly_rate as unknown as number | null,
          crew_member: profile.crew_member
            ? {
                first_name: profile.crew_member.first_name,
                last_name: profile.crew_member.last_name,
                default_hourly_rate: profile.crew_member
                  .default_hourly_rate as unknown as number | null,
              }
            : null,
          user: profile.user
            ? {
                first_name: profile.user.first_name,
                last_name: profile.user.last_name,
              }
            : null,
        },
        tenantId,
      );
    } catch (error) {
      this.logger.error(
        `Labor cost attribution failed for session ${session.id}: ${
          (error as Error).message
        }`,
      );
    }

    return this.prisma.clock_session.findFirst({
      where: { id: session.id, tenant_id: tenantId },
      include: DETAIL_INCLUDE,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // FIND ALL (admin listing)
  // ────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, query: ListClockSessionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.clock_sessionWhereInput = { tenant_id: tenantId };

    if (query.employee_profile_id) {
      where.employee_profile_id = query.employee_profile_id;
    }
    if (query.project_id) {
      where.project_id = query.project_id;
    }
    if (query.status) {
      where.status = query.status as SessionStatus;
    }
    if (query.is_flagged !== undefined) {
      where.is_flagged = query.is_flagged;
    }
    if (query.is_manual_edit !== undefined) {
      where.is_manual_edit = query.is_manual_edit;
    }
    if (query.date_from || query.date_to) {
      const range: Prisma.DateTimeFilter = {};
      if (query.date_from) range.gte = new Date(query.date_from);
      if (query.date_to) range.lte = new Date(query.date_to);
      where.clock_in_at = range;
    }

    const [data, total] = await Promise.all([
      this.prisma.clock_session.findMany({
        where,
        skip,
        take: limit,
        orderBy: { clock_in_at: 'desc' },
        include: LIST_INCLUDE,
      }),
      this.prisma.clock_session.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────
  // FIND MY ACTIVE
  // ────────────────────────────────────────────────────────────────
  async findMyActive(tenantId: string, userId: string) {
    const profile = await this.prisma.employee_profile.findFirst({
      where: { user_id: userId, tenant_id: tenantId, is_active: true },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Employee profile not found or inactive');
    }

    const session = await this.prisma.clock_session.findFirst({
      where: {
        tenant_id: tenantId,
        employee_profile_id: profile.id,
        status: { in: ['active', 'on_break'] },
      },
      include: MY_ACTIVE_INCLUDE,
      orderBy: { clock_in_at: 'desc' },
    });

    return { data: session ?? null };
  }

  // ────────────────────────────────────────────────────────────────
  // FIND AVAILABLE PROJECTS — BR-015
  // ────────────────────────────────────────────────────────────────
  async findAvailableProjects(tenantId: string, userId: string) {
    const profile = await this.prisma.employee_profile.findFirst({
      where: { user_id: userId, tenant_id: tenantId, is_active: true },
      select: { id: true, crew_member_id: true },
    });

    if (!profile) {
      throw new NotFoundException('Employee profile not found or inactive');
    }

    const settings = (await this.timeClockSettingsService.getSettings(
      tenantId,
    )) as unknown as TimeClockSettingsLike;

    if (
      settings.clock_in_mode === 'anywhere' ||
      settings.clock_in_mode === 'specific_addresses'
    ) {
      const projects = await this.prisma.project.findMany({
        where: {
          tenant_id: tenantId,
          status: { in: ['planned', 'in_progress'] },
        },
        select: {
          id: true,
          name: true,
          project_number: true,
          clockin_addresses: {
            where: { is_active: true },
            select: {
              id: true,
              label: true,
              address_line1: true,
              address_line2: true,
              city: true,
              state: true,
              zip_code: true,
              latitude: true,
              longitude: true,
              radius_meters: true,
            },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });
      return { data: projects };
    }

    // active_job_sites mode — union assignments + task_assignees
    const [assignments, taskAssignees] = await Promise.all([
      this.prisma.employee_project_assignment.findMany({
        where: { tenant_id: tenantId, employee_profile_id: profile.id },
        select: { project_id: true },
      }),
      this.prisma.task_assignee.findMany({
        where: {
          tenant_id: tenantId,
          OR: [
            { user_id: userId },
            ...(profile.crew_member_id
              ? [{ crew_member_id: profile.crew_member_id }]
              : []),
          ],
        },
        select: {
          task: { select: { project_id: true } },
        },
      }),
    ]);

    const projectIds = new Set<string>();
    for (const assignment of assignments) {
      if (assignment.project_id) projectIds.add(assignment.project_id);
    }
    for (const assignee of taskAssignees) {
      const projectId = assignee.task?.project_id;
      if (projectId) projectIds.add(projectId);
    }

    if (projectIds.size === 0) {
      return { data: [] };
    }

    const projects = await this.prisma.project.findMany({
      where: {
        tenant_id: tenantId,
        id: { in: Array.from(projectIds) },
        status: { in: ['planned', 'in_progress'] },
      },
      select: {
        id: true,
        name: true,
        project_number: true,
        clockin_addresses: {
          where: { is_active: true },
          select: {
            id: true,
            label: true,
            address_line1: true,
            address_line2: true,
            city: true,
            state: true,
            zip_code: true,
            latitude: true,
            longitude: true,
            radius_meters: true,
          },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return { data: projects };
  }

  // ────────────────────────────────────────────────────────────────
  // FIND MINE (employee own history)
  // ────────────────────────────────────────────────────────────────
  async findMine(
    tenantId: string,
    userId: string,
    query: ListMyClockSessionsDto,
  ) {
    const profile = await this.prisma.employee_profile.findFirst({
      where: { user_id: userId, tenant_id: tenantId, is_active: true },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Employee profile not found or inactive');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.clock_sessionWhereInput = {
      tenant_id: tenantId,
      employee_profile_id: profile.id,
    };

    if (query.status) {
      where.status = query.status as SessionStatus;
    }
    if (query.project_id) {
      where.project_id = query.project_id;
    }
    if (query.date_from || query.date_to) {
      const range: Prisma.DateTimeFilter = {};
      if (query.date_from) range.gte = new Date(query.date_from);
      if (query.date_to) range.lte = new Date(query.date_to);
      where.clock_in_at = range;
    }

    const [data, total] = await Promise.all([
      this.prisma.clock_session.findMany({
        where,
        skip,
        take: limit,
        orderBy: { clock_in_at: 'desc' },
        include: MINE_LIST_INCLUDE,
      }),
      this.prisma.clock_session.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────
  // FIND ALL ACTIVE (admin live view)
  // ────────────────────────────────────────────────────────────────
  async findAllActive(tenantId: string) {
    const where: Prisma.clock_sessionWhereInput = {
      tenant_id: tenantId,
      status: { in: ['active', 'on_break'] },
    };

    const [data, total] = await Promise.all([
      this.prisma.clock_session.findMany({
        where,
        orderBy: { clock_in_at: 'asc' },
        include: ACTIVE_LIST_INCLUDE,
      }),
      this.prisma.clock_session.count({ where }),
    ]);

    return { data, total };
  }

  // ────────────────────────────────────────────────────────────────
  // FIND ONE (full detail)
  // ────────────────────────────────────────────────────────────────
  async findOne(tenantId: string, sessionId: string) {
    const session = await this.prisma.clock_session.findFirst({
      where: { id: sessionId, tenant_id: tenantId },
      include: DETAIL_INCLUDE,
    });

    if (!session) {
      throw new NotFoundException('Clock session not found');
    }

    return session;
  }

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────
  private buildEmployeeDisplayName(
    firstName: string | null,
    lastName: string | null,
  ): string {
    const name = `${firstName ?? ''} ${lastName ?? ''}`.trim();
    return name.length > 0 ? name : 'An employee';
  }

  private async notifyAdmins(
    tenantId: string,
    type: string,
    title: string,
    message: string,
    actionUrl?: string,
  ): Promise<void> {
    try {
      const admins = await this.prisma.user_tenant_membership.findMany({
        where: {
          tenant_id: tenantId,
          status: 'ACTIVE',
          role: { name: { in: [...ADMIN_ROLE_NAMES] } },
        },
        select: { user_id: true },
      });

      if (admins.length === 0) {
        return;
      }

      await Promise.all(
        admins.map((admin) =>
          this.notificationsService.createNotification({
            tenant_id: tenantId,
            user_id: admin.user_id,
            type,
            title,
            message,
            action_url: actionUrl,
            related_entity_type: 'clock_session',
          }),
        ),
      );
    } catch (error) {
      this.logger.error(
        `notifyAdmins failed (${type}) for tenant ${tenantId}: ${
          (error as Error).message
        }`,
      );
    }
  }
}
