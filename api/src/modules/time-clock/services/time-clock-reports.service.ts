import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  ActivityFeedDto,
  GeoViolationsReportDto,
  PayrollReportDto,
  ShiftVarianceReportDto,
  TimesheetReportDto,
} from '../dto/reports.dto';
import { GeofenceService } from './geofence.service';

export interface UserSummary {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface UserSummaryWithEmail extends UserSummary {
  email: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
}

export interface NearestAddress {
  id: string;
  label: string;
  distance_meters: number;
}

export interface ActivityEvent {
  event_type: string;
  timestamp: string;
  employee_profile_id: string;
  user: UserSummary;
  session_id: string | null;
  project: ProjectSummary | null;
  details: Record<string, unknown>;
}

const EARTH_RADIUS_METERS = 6371000;

@Injectable()
export class TimeClockReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geofenceService: GeofenceService,
    private readonly auditLogger: AuditLoggerService,
  ) {
    // Reference geofenceService to keep DI signature stable while we use the
    // local haversine implementation that exposes the closest address record.
    void this.geofenceService;
  }

  // ────────────────────────────────────────────────────────────────
  // 3a — TIMESHEET REPORT
  // ────────────────────────────────────────────────────────────────
  async getTimesheetReport(tenantId: string, query: TimesheetReportDto) {
    const { dateFrom, dateToExclusive } = this.parseDateRange(
      query.date_from,
      query.date_to,
    );

    const where: Prisma.clock_sessionWhereInput = {
      tenant_id: tenantId,
      status: 'completed',
      clock_in_at: { gte: dateFrom, lt: dateToExclusive },
    };

    if (query.employee_profile_id) {
      where.employee_profile_id = query.employee_profile_id;
    }
    if (query.project_id) {
      where.project_id = query.project_id;
    }

    const sessions = await this.prisma.clock_session.findMany({
      where,
      orderBy: [{ employee_profile_id: 'asc' }, { clock_in_at: 'asc' }],
      include: {
        employee_profile: {
          include: {
            user: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
        },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    });

    const employeeMap = new Map<
      string,
      {
        employee_profile_id: string;
        user: UserSummary;
        total_regular_minutes: number;
        total_overtime_minutes: number;
        total_sessions: number;
        days: Map<
          string,
          {
            date: string;
            sessions: Array<{
              id: string;
              clock_in_at: Date;
              clock_out_at: Date | null;
              total_worked_minutes: number;
              regular_minutes: number;
              overtime_minutes: number;
              project: ProjectSummary | null;
              task: { id: string; title: string } | null;
              is_flagged: boolean;
              is_manual_edit: boolean;
            }>;
            day_regular_minutes: number;
            day_overtime_minutes: number;
            day_total_minutes: number;
          }
        >;
      }
    >();

    for (const session of sessions) {
      const employeeId = session.employee_profile_id;
      let employeeBucket = employeeMap.get(employeeId);
      if (!employeeBucket) {
        employeeBucket = {
          employee_profile_id: employeeId,
          user: {
            id: session.employee_profile.user.id,
            first_name: session.employee_profile.user.first_name,
            last_name: session.employee_profile.user.last_name,
          },
          total_regular_minutes: 0,
          total_overtime_minutes: 0,
          total_sessions: 0,
          days: new Map(),
        };
        employeeMap.set(employeeId, employeeBucket);
      }

      const dateKey = this.formatDateKey(session.clock_in_at);
      let dayBucket = employeeBucket.days.get(dateKey);
      if (!dayBucket) {
        dayBucket = {
          date: dateKey,
          sessions: [],
          day_regular_minutes: 0,
          day_overtime_minutes: 0,
          day_total_minutes: 0,
        };
        employeeBucket.days.set(dateKey, dayBucket);
      }

      const regularMinutes = session.regular_minutes ?? 0;
      const overtimeMinutes = session.overtime_minutes ?? 0;
      const totalWorkedMinutes = session.total_worked_minutes ?? 0;

      dayBucket.sessions.push({
        id: session.id,
        clock_in_at: session.clock_in_at,
        clock_out_at: session.clock_out_at,
        total_worked_minutes: totalWorkedMinutes,
        regular_minutes: regularMinutes,
        overtime_minutes: overtimeMinutes,
        project: session.project
          ? { id: session.project.id, name: session.project.name }
          : null,
        task: session.task
          ? { id: session.task.id, title: session.task.title }
          : null,
        is_flagged: session.is_flagged,
        is_manual_edit: session.is_manual_edit,
      });

      dayBucket.day_regular_minutes += regularMinutes;
      dayBucket.day_overtime_minutes += overtimeMinutes;
      dayBucket.day_total_minutes += totalWorkedMinutes;

      employeeBucket.total_regular_minutes += regularMinutes;
      employeeBucket.total_overtime_minutes += overtimeMinutes;
      employeeBucket.total_sessions += 1;
    }

    const employees = Array.from(employeeMap.values()).map((bucket) => ({
      employee_profile_id: bucket.employee_profile_id,
      user: bucket.user,
      total_regular_minutes: bucket.total_regular_minutes,
      total_overtime_minutes: bucket.total_overtime_minutes,
      total_sessions: bucket.total_sessions,
      days: Array.from(bucket.days.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    }));

    return {
      date_from: query.date_from,
      date_to: query.date_to,
      employees,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 3b — PAYROLL REPORT
  // ────────────────────────────────────────────────────────────────
  async getPayrollReport(tenantId: string, query: PayrollReportDto) {
    const { dateFrom, dateToExclusive } = this.parseDateRange(
      query.date_from,
      query.date_to,
    );

    const where: Prisma.clock_sessionWhereInput = {
      tenant_id: tenantId,
      status: 'completed',
      clock_in_at: { gte: dateFrom, lt: dateToExclusive },
    };

    if (query.employee_profile_id) {
      where.employee_profile_id = query.employee_profile_id;
    }

    const [sessions, settings] = await Promise.all([
      this.prisma.clock_session.findMany({
        where,
        orderBy: { clock_in_at: 'asc' },
        include: {
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
                select: { default_hourly_rate: true },
              },
            },
          },
        },
      }),
      this.prisma.time_clock_settings.findFirst({
        where: { tenant_id: tenantId },
        select: { overtime_multiplier: true },
      }),
    ]);

    const tenantMultiplier = this.toNumber(settings?.overtime_multiplier, 1.5);

    interface PayrollBucket {
      employee_profile_id: string;
      user: UserSummaryWithEmail;
      hourly_rate: number;
      regular_minutes: number;
      overtime_minutes: number;
      sessions_count: number;
      flagged_sessions: number;
      manual_edits: number;
    }

    const buckets = new Map<string, PayrollBucket>();

    for (const session of sessions) {
      const employeeId = session.employee_profile_id;
      let bucket = buckets.get(employeeId);
      if (!bucket) {
        const profile = session.employee_profile;
        const rateFromProfile = this.toNumberOrNull(profile.hourly_rate);
        const rateFromCrew = this.toNumberOrNull(
          profile.crew_member?.default_hourly_rate ?? null,
        );
        const hourlyRate =
          rateFromProfile !== null
            ? rateFromProfile
            : rateFromCrew !== null
              ? rateFromCrew
              : 0;

        bucket = {
          employee_profile_id: employeeId,
          user: {
            id: profile.user.id,
            first_name: profile.user.first_name,
            last_name: profile.user.last_name,
            email: profile.user.email,
          },
          hourly_rate: hourlyRate,
          regular_minutes: 0,
          overtime_minutes: 0,
          sessions_count: 0,
          flagged_sessions: 0,
          manual_edits: 0,
        };
        buckets.set(employeeId, bucket);
      }

      bucket.regular_minutes += session.regular_minutes ?? 0;
      bucket.overtime_minutes += session.overtime_minutes ?? 0;
      bucket.sessions_count += 1;
      if (session.is_flagged) bucket.flagged_sessions += 1;
      if (session.is_manual_edit) bucket.manual_edits += 1;
    }

    const employees = Array.from(buckets.values()).map((bucket) => {
      const regularHours = this.round2(bucket.regular_minutes / 60);
      const overtimeHours = this.round2(bucket.overtime_minutes / 60);
      const overtimeMultiplier = this.round2(tenantMultiplier);
      const regularPay = this.round2(regularHours * bucket.hourly_rate);
      const overtimePay = this.round2(
        overtimeHours * bucket.hourly_rate * overtimeMultiplier,
      );
      const totalPay = this.round2(regularPay + overtimePay);

      return {
        employee_profile_id: bucket.employee_profile_id,
        user: bucket.user,
        hourly_rate: this.round2(bucket.hourly_rate),
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        overtime_multiplier: overtimeMultiplier,
        regular_pay: regularPay,
        overtime_pay: overtimePay,
        total_pay: totalPay,
        sessions_count: bucket.sessions_count,
        flagged_sessions: bucket.flagged_sessions,
        manual_edits: bucket.manual_edits,
      };
    });

    const summary = employees.reduce(
      (acc, emp) => {
        acc.total_regular_hours += emp.regular_hours;
        acc.total_overtime_hours += emp.overtime_hours;
        acc.total_regular_pay += emp.regular_pay;
        acc.total_overtime_pay += emp.overtime_pay;
        acc.total_pay += emp.total_pay;
        return acc;
      },
      {
        total_employees: employees.length,
        total_regular_hours: 0,
        total_overtime_hours: 0,
        total_regular_pay: 0,
        total_overtime_pay: 0,
        total_pay: 0,
      },
    );

    summary.total_regular_hours = this.round2(summary.total_regular_hours);
    summary.total_overtime_hours = this.round2(summary.total_overtime_hours);
    summary.total_regular_pay = this.round2(summary.total_regular_pay);
    summary.total_overtime_pay = this.round2(summary.total_overtime_pay);
    summary.total_pay = this.round2(summary.total_pay);

    return {
      date_from: query.date_from,
      date_to: query.date_to,
      summary,
      employees,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 3c — PAYROLL CSV EXPORT
  // ────────────────────────────────────────────────────────────────
  async exportPayrollCsv(
    tenantId: string,
    userId: string,
    query: PayrollReportDto,
  ): Promise<{ csv: string; filename: string }> {
    const report = await this.getPayrollReport(tenantId, query);

    const headers = [
      'Employee Name',
      'Employee ID',
      'Email',
      'Hourly Rate',
      'Regular Hours',
      'Overtime Hours',
      'Overtime Multiplier',
      'Regular Pay',
      'Overtime Pay',
      'Total Pay',
      'Sessions Count',
      'Flagged Sessions',
      'Manual Edits',
    ];

    const lines: string[] = [headers.join(',')];

    for (const emp of report.employees) {
      const fullName = `${emp.user.first_name ?? ''} ${
        emp.user.last_name ?? ''
      }`.trim();
      const row = [
        this.csvEscape(fullName),
        this.csvEscape(emp.employee_profile_id),
        this.csvEscape(emp.user.email ?? ''),
        emp.hourly_rate.toFixed(2),
        emp.regular_hours.toFixed(2),
        emp.overtime_hours.toFixed(2),
        emp.overtime_multiplier.toFixed(2),
        emp.regular_pay.toFixed(2),
        emp.overtime_pay.toFixed(2),
        emp.total_pay.toFixed(2),
        String(emp.sessions_count),
        String(emp.flagged_sessions),
        String(emp.manual_edits),
      ];
      lines.push(row.join(','));
    }

    const csv = lines.join('\n') + '\n';
    const filename = `payroll_${query.date_from}_${query.date_to}.csv`;

    await this.auditLogger.logTenantChange({
      // Spec calls for action='accessed'; the audit logger's typed union
      // doesn't include it but writes the value through to `action_type`
      // verbatim — cast through `unknown` to satisfy the compiler.
      action: 'accessed' as unknown as 'created' | 'updated' | 'deleted',
      entityType: 'payroll_export',
      entityId: 'payroll_export',
      tenantId,
      actorUserId: userId,
      metadata: {
        date_from: query.date_from,
        date_to: query.date_to,
        employee_profile_id: query.employee_profile_id ?? null,
        total_employees: report.summary.total_employees,
        total_pay: report.summary.total_pay,
      },
      description: 'Exported payroll report to CSV',
    });

    return { csv, filename };
  }

  // ────────────────────────────────────────────────────────────────
  // 3d — SHIFT VARIANCE REPORT
  // ────────────────────────────────────────────────────────────────
  async getShiftVarianceReport(
    tenantId: string,
    query: ShiftVarianceReportDto,
  ) {
    const { dateFrom, dateToExclusive } = this.parseDateRange(
      query.date_from,
      query.date_to,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.work_shiftWhereInput = {
      tenant_id: tenantId,
      scheduled_start: { gte: dateFrom, lt: dateToExclusive },
    };

    if (query.employee_profile_id) {
      where.employee_profile_id = query.employee_profile_id;
    }
    if (query.project_id) {
      where.project_id = query.project_id;
    }

    const [shifts, total] = await Promise.all([
      this.prisma.work_shift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduled_start: 'asc' },
        include: {
          employee_profile: {
            include: {
              user: {
                select: { id: true, first_name: true, last_name: true },
              },
            },
          },
          project: { select: { id: true, name: true } },
          clock_sessions: {
            orderBy: { clock_in_at: 'asc' },
            take: 1,
          },
        },
      }),
      this.prisma.work_shift.count({ where }),
    ]);

    const data = shifts.map((shift) => {
      const scheduledStart = new Date(shift.scheduled_start);
      const scheduledEnd = new Date(shift.scheduled_end);
      const scheduledMinutes = Math.max(
        0,
        Math.floor((scheduledEnd.getTime() - scheduledStart.getTime()) / 60000),
      );

      const session = shift.clock_sessions[0];
      const isMissed = shift.status === 'missed' || !session;

      let actualClockInAt: Date | null = null;
      let actualClockOutAt: Date | null = null;
      let actualWorkedMinutes: number | null = null;
      let varianceStartMinutes: number | null = null;
      let varianceEndMinutes: number | null = null;
      let varianceTotalMinutes: number | null = null;
      let sessionId: string | null = null;

      if (!isMissed && session) {
        actualClockInAt = session.clock_in_at;
        actualClockOutAt = session.clock_out_at;
        actualWorkedMinutes = session.total_worked_minutes;
        sessionId = session.id;
        varianceStartMinutes = Math.floor(
          (new Date(session.clock_in_at).getTime() - scheduledStart.getTime()) /
            60000,
        );
        if (session.clock_out_at) {
          varianceEndMinutes = Math.floor(
            (new Date(session.clock_out_at).getTime() -
              scheduledEnd.getTime()) /
              60000,
          );
        }
        if (session.total_worked_minutes !== null) {
          varianceTotalMinutes =
            session.total_worked_minutes - scheduledMinutes;
        }
      }

      return {
        work_shift_id: shift.id,
        employee_profile_id: shift.employee_profile_id,
        user: {
          id: shift.employee_profile.user.id,
          first_name: shift.employee_profile.user.first_name,
          last_name: shift.employee_profile.user.last_name,
        },
        project: shift.project
          ? { id: shift.project.id, name: shift.project.name }
          : null,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        scheduled_minutes: scheduledMinutes,
        actual_clock_in_at: actualClockInAt,
        actual_clock_out_at: actualClockOutAt,
        actual_worked_minutes: actualWorkedMinutes,
        variance_start_minutes: varianceStartMinutes,
        variance_end_minutes: varianceEndMinutes,
        variance_total_minutes: varianceTotalMinutes,
        shift_status: shift.status,
        session_id: sessionId,
      };
    });

    return {
      date_from: query.date_from,
      date_to: query.date_to,
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
  // 3e — GEO VIOLATIONS REPORT
  // ────────────────────────────────────────────────────────────────
  async getGeoViolationsReport(
    tenantId: string,
    query: GeoViolationsReportDto,
  ) {
    const { dateFrom, dateToExclusive } = this.parseDateRange(
      query.date_from,
      query.date_to,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.clock_sessionWhereInput = {
      tenant_id: tenantId,
      is_flagged: true,
      clock_in_geofence_status: { in: ['outside', 'unavailable'] },
      clock_in_at: { gte: dateFrom, lt: dateToExclusive },
    };

    if (query.employee_profile_id) {
      where.employee_profile_id = query.employee_profile_id;
    }

    const [sessions, total, addresses] = await Promise.all([
      this.prisma.clock_session.findMany({
        where,
        skip,
        take: limit,
        orderBy: { clock_in_at: 'desc' },
        include: {
          employee_profile: {
            include: {
              user: {
                select: { id: true, first_name: true, last_name: true },
              },
            },
          },
          project: { select: { id: true, name: true } },
        },
      }),
      this.prisma.clock_session.count({ where }),
      this.prisma.clockin_address.findMany({
        where: { tenant_id: tenantId, is_active: true },
        select: { id: true, label: true, latitude: true, longitude: true },
      }),
    ]);

    const data = sessions.map((session) => {
      const lat = this.toNumberOrNull(session.clock_in_latitude);
      const lon = this.toNumberOrNull(session.clock_in_longitude);

      let nearestAddress: NearestAddress | null = null;
      if (lat !== null && lon !== null && addresses.length > 0) {
        let closest: { id: string; label: string; distance: number } | null =
          null;
        for (const addr of addresses) {
          const addrLat = this.toNumberOrNull(addr.latitude);
          const addrLon = this.toNumberOrNull(addr.longitude);
          if (addrLat === null || addrLon === null) continue;
          const distance = this.haversineDistance(lat, lon, addrLat, addrLon);
          if (!closest || distance < closest.distance) {
            closest = { id: addr.id, label: addr.label, distance };
          }
        }
        if (closest) {
          nearestAddress = {
            id: closest.id,
            label: closest.label,
            distance_meters: Math.round(closest.distance),
          };
        }
      }

      return {
        session_id: session.id,
        employee_profile_id: session.employee_profile_id,
        user: {
          id: session.employee_profile.user.id,
          first_name: session.employee_profile.user.first_name,
          last_name: session.employee_profile.user.last_name,
        },
        clock_in_at: session.clock_in_at,
        clock_in_latitude: lat,
        clock_in_longitude: lon,
        clock_in_geofence_status: session.clock_in_geofence_status,
        is_flagged: session.is_flagged,
        flag_reason: session.flag_reason,
        nearest_address: nearestAddress,
        project: session.project
          ? { id: session.project.id, name: session.project.name }
          : null,
        status: session.status,
      };
    });

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
  // 3f — ACTIVITY FEED
  // ────────────────────────────────────────────────────────────────
  async getActivityFeed(tenantId: string, query: ActivityFeedDto) {
    const limit = query.limit ?? 50;
    const after = query.after ? new Date(query.after) : null;
    const employeeFilter = query.employee_profile_id ?? null;

    const sessionWhere: Prisma.clock_sessionWhereInput = {
      tenant_id: tenantId,
    };
    if (employeeFilter) sessionWhere.employee_profile_id = employeeFilter;
    if (after) {
      sessionWhere.OR = [
        { clock_in_at: { lt: after } },
        { clock_out_at: { lt: after } },
      ];
    }

    const breakWhere: Prisma.break_entryWhereInput = { tenant_id: tenantId };
    if (employeeFilter) {
      breakWhere.clock_session = { employee_profile_id: employeeFilter };
    }
    if (after) {
      breakWhere.OR = [
        { started_at: { lt: after } },
        { ended_at: { lt: after } },
      ];
    }

    const disputeWhere: Prisma.time_disputeWhereInput = {
      tenant_id: tenantId,
    };
    if (employeeFilter) {
      disputeWhere.clock_session = { employee_profile_id: employeeFilter };
    }
    if (after) {
      disputeWhere.OR = [
        { created_at: { lt: after } },
        { reviewed_at: { lt: after } },
      ];
    }

    const editLogWhere: Prisma.clock_session_edit_logWhereInput = {
      tenant_id: tenantId,
    };
    if (employeeFilter) {
      editLogWhere.clock_session = { employee_profile_id: employeeFilter };
    }
    if (after) {
      editLogWhere.edited_at = { lt: after };
    }

    const shiftWhere: Prisma.work_shiftWhereInput = {
      tenant_id: tenantId,
      status: 'missed',
    };
    if (employeeFilter) shiftWhere.employee_profile_id = employeeFilter;
    if (after) shiftWhere.updated_at = { lt: after };

    const employeeUserInclude = {
      employee_profile: {
        include: {
          user: { select: { id: true, first_name: true, last_name: true } },
        },
      },
    };

    const sessionEmployeeInclude = {
      clock_session: {
        include: {
          ...employeeUserInclude,
          project: { select: { id: true, name: true } },
        },
      },
    };

    const [sessionRows, breakRows, disputeRows, editRows, shiftRows] =
      await Promise.all([
        this.prisma.clock_session.findMany({
          where: sessionWhere,
          take: limit,
          orderBy: { clock_in_at: 'desc' },
          include: {
            ...employeeUserInclude,
            project: { select: { id: true, name: true } },
          },
        }),
        this.prisma.break_entry.findMany({
          where: breakWhere,
          take: limit,
          orderBy: { started_at: 'desc' },
          include: sessionEmployeeInclude,
        }),
        this.prisma.time_dispute.findMany({
          where: disputeWhere,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: sessionEmployeeInclude,
        }),
        this.prisma.clock_session_edit_log.findMany({
          where: editLogWhere,
          take: limit,
          orderBy: { edited_at: 'desc' },
          include: sessionEmployeeInclude,
        }),
        this.prisma.work_shift.findMany({
          where: shiftWhere,
          take: limit,
          orderBy: { updated_at: 'desc' },
          include: {
            ...employeeUserInclude,
            project: { select: { id: true, name: true } },
          },
        }),
      ]);

    const events: ActivityEvent[] = [];

    // clock_session → clock_in + clock_out
    for (const session of sessionRows) {
      const user = this.mapUser(session.employee_profile.user);
      const project = session.project
        ? { id: session.project.id, name: session.project.name }
        : null;

      if (!after || new Date(session.clock_in_at) < after) {
        events.push({
          event_type: 'clock_in',
          timestamp: new Date(session.clock_in_at).toISOString(),
          employee_profile_id: session.employee_profile_id,
          user,
          session_id: session.id,
          project,
          details: session.notes ? { notes: session.notes } : {},
        });
      }

      if (
        session.clock_out_at &&
        (!after || new Date(session.clock_out_at) < after)
      ) {
        events.push({
          event_type: 'clock_out',
          timestamp: new Date(session.clock_out_at).toISOString(),
          employee_profile_id: session.employee_profile_id,
          user,
          session_id: session.id,
          project,
          details: {
            total_worked_minutes: session.total_worked_minutes,
            regular_minutes: session.regular_minutes,
            overtime_minutes: session.overtime_minutes,
          },
        });
      }
    }

    // break_entry → break_start + break_end
    for (const entry of breakRows) {
      const session = entry.clock_session;
      const user = this.mapUser(session.employee_profile.user);
      const project = session.project
        ? { id: session.project.id, name: session.project.name }
        : null;

      if (!after || new Date(entry.started_at) < after) {
        events.push({
          event_type: 'break_start',
          timestamp: new Date(entry.started_at).toISOString(),
          employee_profile_id: session.employee_profile_id,
          user,
          session_id: session.id,
          project,
          details: {
            break_type: entry.break_type,
            break_label: entry.break_label,
          },
        });
      }

      if (entry.ended_at && (!after || new Date(entry.ended_at) < after)) {
        events.push({
          event_type: 'break_end',
          timestamp: new Date(entry.ended_at).toISOString(),
          employee_profile_id: session.employee_profile_id,
          user,
          session_id: session.id,
          project,
          details: {
            break_type: entry.break_type,
            break_label: entry.break_label,
            duration_minutes: entry.duration_minutes,
          },
        });
      }
    }

    // time_dispute → submitted, approved, rejected
    for (const dispute of disputeRows) {
      const session = dispute.clock_session;
      const user = this.mapUser(session.employee_profile.user);
      const project = session.project
        ? { id: session.project.id, name: session.project.name }
        : null;

      if (!after || new Date(dispute.created_at) < after) {
        events.push({
          event_type: 'dispute_submitted',
          timestamp: new Date(dispute.created_at).toISOString(),
          employee_profile_id: session.employee_profile_id,
          user,
          session_id: session.id,
          project,
          details: {
            dispute_type: dispute.dispute_type,
            dispute_id: dispute.id,
          },
        });
      }

      if (
        dispute.reviewed_at &&
        (dispute.status === 'approved' || dispute.status === 'rejected') &&
        (!after || new Date(dispute.reviewed_at) < after)
      ) {
        events.push({
          event_type:
            dispute.status === 'approved'
              ? 'dispute_approved'
              : 'dispute_rejected',
          timestamp: new Date(dispute.reviewed_at).toISOString(),
          employee_profile_id: session.employee_profile_id,
          user,
          session_id: session.id,
          project,
          details: {
            dispute_type: dispute.dispute_type,
            dispute_id: dispute.id,
            review_notes: dispute.review_notes,
          },
        });
      }
    }

    // clock_session_edit_log → manual_edit
    for (const edit of editRows) {
      const session = edit.clock_session;
      const user = this.mapUser(session.employee_profile.user);
      const project = session.project
        ? { id: session.project.id, name: session.project.name }
        : null;

      events.push({
        event_type: 'manual_edit',
        timestamp: new Date(edit.edited_at).toISOString(),
        employee_profile_id: session.employee_profile_id,
        user,
        session_id: session.id,
        project,
        details: {
          field_changed: edit.field_changed,
          original_value: edit.original_value,
          new_value: edit.new_value,
          reason: edit.reason,
          edited_by_user_id: edit.edited_by_user_id,
        },
      });
    }

    // work_shift → shift_missed
    for (const shift of shiftRows) {
      const user = this.mapUser(shift.employee_profile.user);
      events.push({
        event_type: 'shift_missed',
        timestamp: new Date(shift.updated_at).toISOString(),
        employee_profile_id: shift.employee_profile_id,
        user,
        session_id: null,
        project: shift.project
          ? { id: shift.project.id, name: shift.project.name }
          : null,
        details: {
          shift_id: shift.id,
          scheduled_start: new Date(shift.scheduled_start).toISOString(),
          scheduled_end: new Date(shift.scheduled_end).toISOString(),
        },
      });
    }

    events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

    return { data: events.slice(0, limit) };
  }

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────
  private parseDateRange(
    dateFromInput: string,
    dateToInput: string,
  ): { dateFrom: Date; dateToExclusive: Date } {
    const dateFrom = new Date(`${dateFromInput.slice(0, 10)}T00:00:00.000Z`);
    const dateTo = new Date(`${dateToInput.slice(0, 10)}T00:00:00.000Z`);
    const dateToExclusive = new Date(dateTo.getTime() + 24 * 60 * 60 * 1000);
    return { dateFrom, dateToExclusive };
  }

  private formatDateKey(date: Date): string {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toNumber(value: unknown, fallback: number): number {
    const parsed = this.toNumberOrNull(value);
    return parsed === null ? fallback : parsed;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === 'object' && value !== null) {
      const candidate = value as { toString?: () => string };
      if (typeof candidate.toString === 'function') {
        const parsed = Number(candidate.toString());
        return Number.isFinite(parsed) ? parsed : null;
      }
    }
    return null;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private csvEscape(value: string): string {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const phi1 = lat1 * (Math.PI / 180);
    const phi2 = lat2 * (Math.PI / 180);
    const deltaPhi = (lat2 - lat1) * (Math.PI / 180);
    const deltaLambda = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
  }

  private mapUser(user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  }): UserSummary {
    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
    };
  }
}
