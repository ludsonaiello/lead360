import { Injectable, Logger } from '@nestjs/common';
import { format, fromZonedTime } from 'date-fns-tz';
import { PrismaService } from '../../../core/database';

interface CalculateOvertimeParams {
  tenantId: string;
  employeeProfileId: string;
  sessionId: string;
  totalWorkedMinutes: number;
  clockInAt: Date;
}

interface OvertimeResult {
  regular_minutes: number;
  overtime_minutes: number;
}

const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_DAILY_THRESHOLD_HOURS = 8;
const DEFAULT_WEEKLY_THRESHOLD_HOURS = 40;
const DEFAULT_PAY_PERIOD_START_DAY = 0;

@Injectable()
export class OvertimeService {
  private readonly logger = new Logger(OvertimeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates the regular / overtime split for a completed work period,
   * applying BR-006 rules (tenant thresholds, optional employee override,
   * daily + weekly caps, tenant-timezone calendar boundaries).
   */
  async calculateOvertime(
    params: CalculateOvertimeParams,
  ): Promise<OvertimeResult> {
    const {
      tenantId,
      employeeProfileId,
      sessionId,
      totalWorkedMinutes,
      clockInAt,
    } = params;

    const normalizedTotal = Math.max(0, Math.floor(totalWorkedMinutes));

    const employeeProfile = await this.prisma.employee_profile.findFirst({
      where: { id: employeeProfileId, tenant_id: tenantId },
      include: {
        crew_member: true,
      },
    });

    if (!employeeProfile) {
      this.logger.warn(
        `Employee profile ${employeeProfileId} not found for tenant ${tenantId} — treating all minutes as regular`,
      );
      return { regular_minutes: normalizedTotal, overtime_minutes: 0 };
    }

    const settings = await this.prisma.time_clock_settings.findFirst({
      where: { tenant_id: tenantId },
    });

    const overtimeEnabled = settings ? settings.overtime_enabled : false;
    if (!overtimeEnabled) {
      return { regular_minutes: normalizedTotal, overtime_minutes: 0 };
    }

    const useEmployeeOverride = employeeProfile.overtime_rule_override === true;

    const dailyThresholdHours = this.resolveThresholdHours(
      useEmployeeOverride
        ? employeeProfile.overtime_daily_threshold_hours
        : settings?.overtime_daily_threshold_hours,
      DEFAULT_DAILY_THRESHOLD_HOURS,
    );

    const weeklyThresholdHours = this.resolveThresholdHours(
      useEmployeeOverride
        ? employeeProfile.overtime_weekly_threshold_hours
        : settings?.overtime_weekly_threshold_hours,
      DEFAULT_WEEKLY_THRESHOLD_HOURS,
    );

    const dailyThresholdMinutes = Math.round(dailyThresholdHours * 60);
    const weeklyThresholdMinutes = Math.round(weeklyThresholdHours * 60);

    const tenantRecord = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const timezone = tenantRecord?.timezone || DEFAULT_TIMEZONE;

    const payPeriodStartDay =
      settings?.pay_period_start_day ?? DEFAULT_PAY_PERIOD_START_DAY;

    const { dayStartUtc, dayEndUtc, weekStartUtc, weekEndUtc } =
      this.computeBoundaries(clockInAt, timezone, payPeriodStartDay);

    const [dailyPriorSessions, weeklyPriorSessions] = await Promise.all([
      this.prisma.clock_session.findMany({
        where: {
          tenant_id: tenantId,
          employee_profile_id: employeeProfileId,
          status: 'completed',
          clock_in_at: { gte: dayStartUtc, lte: dayEndUtc },
          id: { not: sessionId },
        },
        select: { regular_minutes: true },
      }),
      this.prisma.clock_session.findMany({
        where: {
          tenant_id: tenantId,
          employee_profile_id: employeeProfileId,
          status: 'completed',
          clock_in_at: { gte: weekStartUtc, lt: weekEndUtc },
          id: { not: sessionId },
        },
        select: { regular_minutes: true },
      }),
    ]);

    const priorRegularToday = this.sumMinutes(dailyPriorSessions);
    const priorRegularThisWeek = this.sumMinutes(weeklyPriorSessions);

    const remainingDaily = Math.max(
      0,
      dailyThresholdMinutes - priorRegularToday,
    );
    const remainingWeekly = Math.max(
      0,
      weeklyThresholdMinutes - priorRegularThisWeek,
    );

    const regularMinutes = Math.min(
      normalizedTotal,
      remainingDaily,
      remainingWeekly,
    );
    const overtimeMinutes = normalizedTotal - regularMinutes;

    return {
      regular_minutes: regularMinutes,
      overtime_minutes: overtimeMinutes,
    };
  }

  private resolveThresholdHours(value: unknown, fallback: number): number {
    if (value === null || value === undefined) {
      return fallback;
    }
    const numeric =
      typeof value === 'number'
        ? value
        : Number(
            typeof (value as { toString?: () => string }).toString ===
              'function'
              ? (value as { toString: () => string }).toString()
              : value,
          );
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return fallback;
    }
    return numeric;
  }

  private sumMinutes(rows: Array<{ regular_minutes: number | null }>): number {
    return rows.reduce((acc, row) => acc + (row.regular_minutes ?? 0), 0);
  }

  private computeBoundaries(
    clockInAt: Date,
    timezone: string,
    payPeriodStartDay: number,
  ): {
    dayStartUtc: Date;
    dayEndUtc: Date;
    weekStartUtc: Date;
    weekEndUtc: Date;
  } {
    const dayStr = format(clockInAt, 'yyyy-MM-dd', { timeZone: timezone });
    const dayStartUtc = fromZonedTime(`${dayStr}T00:00:00.000`, timezone);
    const dayEndUtc = fromZonedTime(`${dayStr}T23:59:59.999`, timezone);

    const [yearStr, monthStr, domStr] = dayStr.split('-');
    const calendarDay = new Date(
      Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(domStr)),
    );
    const dayOfWeek = calendarDay.getUTCDay();

    const normalizedStartDay = ((payPeriodStartDay % 7) + 7) % 7;
    const daysBack = (dayOfWeek - normalizedStartDay + 7) % 7;

    const weekStartCalendar = new Date(calendarDay.getTime());
    weekStartCalendar.setUTCDate(weekStartCalendar.getUTCDate() - daysBack);

    const weekEndCalendar = new Date(weekStartCalendar.getTime());
    weekEndCalendar.setUTCDate(weekEndCalendar.getUTCDate() + 7);

    const weekStartStr = this.formatCalendarDay(weekStartCalendar);
    const weekEndStr = this.formatCalendarDay(weekEndCalendar);

    const weekStartUtc = fromZonedTime(
      `${weekStartStr}T00:00:00.000`,
      timezone,
    );
    const weekEndUtc = fromZonedTime(`${weekEndStr}T00:00:00.000`, timezone);

    return { dayStartUtc, dayEndUtc, weekStartUtc, weekEndUtc };
  }

  private formatCalendarDay(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
      date.getUTCDate(),
    )}`;
  }
}
