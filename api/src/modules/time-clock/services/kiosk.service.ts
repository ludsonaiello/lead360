import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import {
  ClockInDto,
  ClockOutDto,
  LocationSourceEnum,
} from '../dto/clock-session.dto';
import { KioskClockInDto, KioskClockOutDto } from '../dto/kiosk.dto';
import { ClockSessionService } from './clock-session.service';

const PIN_MAX_FAILED_ATTEMPTS = 5;
const PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const ADMIN_ROLE_NAMES = ['Owner', 'Admin'] as const;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class KioskService {
  private readonly logger = new Logger(KioskService.name);
  private readonly pinAttemptMap = new Map<string, RateLimitEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockSessionService: ClockSessionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // GET EMPLOYEES — kiosk-eligible (active + has PIN)
  // ────────────────────────────────────────────────────────────────
  async getEmployees(tenantId: string) {
    const employees = await this.prisma.employee_profile.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        kiosk_pin_hash: { not: null },
      },
      select: {
        id: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: [
        { user: { first_name: 'asc' } },
        { user: { last_name: 'asc' } },
      ],
    });

    if (employees.length === 0) {
      return { data: [] };
    }

    const employeeIds = employees.map((emp) => emp.id);

    const activeSessions = await this.prisma.clock_session.findMany({
      where: {
        tenant_id: tenantId,
        employee_profile_id: { in: employeeIds },
        status: { in: ['active', 'on_break'] },
      },
      select: { employee_profile_id: true },
    });

    const clockedInSet = new Set<string>(
      activeSessions.map((session) => session.employee_profile_id),
    );

    return {
      data: employees.map((emp) => ({
        id: emp.id,
        user: {
          first_name: emp.user.first_name,
          last_name: this.truncateLastName(emp.user.last_name),
        },
        has_pin: true,
        is_clocked_in: clockedInSet.has(emp.id),
      })),
    };
  }

  // ────────────────────────────────────────────────────────────────
  // CLOCK IN — kiosk PIN auth + delegation
  // ────────────────────────────────────────────────────────────────
  async clockIn(
    tenantId: string,
    dto: KioskClockInDto,
    kioskTokenHash: string,
  ) {
    this.checkRateLimit(kioskTokenHash);

    const employee = await this.loadEmployeeForKiosk(
      tenantId,
      dto.employee_profile_id,
    );
    this.assertNotLockedOut(employee.kiosk_pin_locked_until);
    await this.validatePin(tenantId, employee, dto.pin);

    const clockInDto: ClockInDto = {
      project_id: dto.project_id,
      task_id: dto.task_id,
      notes: dto.notes,
      location_source: LocationSourceEnum.KIOSK,
    };

    return this.clockSessionService.clockIn(
      tenantId,
      employee.user_id,
      clockInDto,
    );
  }

  // ────────────────────────────────────────────────────────────────
  // CLOCK OUT — kiosk PIN auth + delegation
  // ────────────────────────────────────────────────────────────────
  async clockOut(
    tenantId: string,
    dto: KioskClockOutDto,
    kioskTokenHash: string,
  ) {
    this.checkRateLimit(kioskTokenHash);

    const employee = await this.loadEmployeeForKiosk(
      tenantId,
      dto.employee_profile_id,
    );
    this.assertNotLockedOut(employee.kiosk_pin_locked_until);
    await this.validatePin(tenantId, employee, dto.pin);

    const clockOutDto: ClockOutDto = {
      notes: dto.notes,
      location_source: LocationSourceEnum.KIOSK,
    };

    return this.clockSessionService.clockOut(
      tenantId,
      employee.user_id,
      clockOutDto,
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Internal — employee lookup
  // ────────────────────────────────────────────────────────────────
  private async loadEmployeeForKiosk(
    tenantId: string,
    employeeProfileId: string,
  ) {
    const employee = await this.prisma.employee_profile.findFirst({
      where: {
        id: employeeProfileId,
        tenant_id: tenantId,
        is_active: true,
      },
      select: {
        id: true,
        user_id: true,
        kiosk_pin_hash: true,
        kiosk_pin_failed_attempts: true,
        kiosk_pin_locked_until: true,
        user: {
          select: { first_name: true, last_name: true },
        },
      },
    });

    if (!employee || !employee.kiosk_pin_hash) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  // ────────────────────────────────────────────────────────────────
  // Internal — lockout check
  // ────────────────────────────────────────────────────────────────
  private assertNotLockedOut(lockedUntil: Date | null): void {
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      throw new HttpException(
        'Account locked for 15 minutes',
        HttpStatus.LOCKED,
      );
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Internal — PIN validation + lockout/notification on failure
  // ────────────────────────────────────────────────────────────────
  private async validatePin(
    tenantId: string,
    employee: {
      id: string;
      kiosk_pin_hash: string | null;
      kiosk_pin_failed_attempts: number;
      user: { first_name: string | null; last_name: string | null } | null;
    },
    plaintextPin: string,
  ): Promise<void> {
    if (!employee.kiosk_pin_hash) {
      throw new NotFoundException('Employee not found');
    }

    const isValid = await bcrypt.compare(plaintextPin, employee.kiosk_pin_hash);

    if (isValid) {
      if (employee.kiosk_pin_failed_attempts > 0) {
        await this.prisma.employee_profile.update({
          where: { id: employee.id },
          data: {
            kiosk_pin_failed_attempts: 0,
            kiosk_pin_locked_until: null,
          },
        });
      }
      return;
    }

    const newFailedAttempts = employee.kiosk_pin_failed_attempts + 1;
    const shouldLock = newFailedAttempts >= PIN_MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + PIN_LOCKOUT_DURATION_MS)
      : null;

    await this.prisma.employee_profile.update({
      where: { id: employee.id },
      data: {
        kiosk_pin_failed_attempts: newFailedAttempts,
        ...(shouldLock ? { kiosk_pin_locked_until: lockedUntil } : {}),
      },
    });

    if (shouldLock) {
      await this.notifyAdminsOfLockout(tenantId, employee);
    }

    throw new UnauthorizedException({
      message: 'Invalid PIN',
      remaining_attempts: Math.max(
        0,
        PIN_MAX_FAILED_ATTEMPTS - newFailedAttempts,
      ),
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Internal — admin notification on lockout
  // ────────────────────────────────────────────────────────────────
  private async notifyAdminsOfLockout(
    tenantId: string,
    employee: {
      user: { first_name: string | null; last_name: string | null } | null;
    },
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

      const employeeName = this.buildEmployeeFullName(
        employee.user?.first_name ?? null,
        employee.user?.last_name ?? null,
      );

      await Promise.all(
        admins.map((admin) =>
          this.notificationsService.createNotification({
            tenant_id: tenantId,
            user_id: admin.user_id,
            type: 'timeclock_kiosk_lockout',
            title: 'Kiosk Account Locked',
            message: `${employeeName} has been locked out of the kiosk after 5 failed PIN attempts`,
            action_url: '/settings/time-clock',
            related_entity_type: 'employee_profile',
          }),
        ),
      );
    } catch (error) {
      this.logger.error(
        `notifyAdminsOfLockout failed for tenant ${tenantId}: ${
          (error as Error).message
        }`,
      );
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Internal — rate limiting (in-memory, per kiosk token)
  // ────────────────────────────────────────────────────────────────
  private checkRateLimit(kioskTokenHash: string): void {
    const now = Date.now();
    const entry = this.pinAttemptMap.get(kioskTokenHash);

    if (!entry || now >= entry.resetAt) {
      this.pinAttemptMap.set(kioskTokenHash, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      return;
    }

    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many PIN attempts. Please wait.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Internal — name helpers
  // ────────────────────────────────────────────────────────────────
  private truncateLastName(lastName: string | null): string {
    if (!lastName || lastName.length === 0) {
      return '';
    }
    return `${lastName.charAt(0)}.`;
  }

  private buildEmployeeFullName(
    firstName: string | null,
    lastName: string | null,
  ): string {
    const name = `${firstName ?? ''} ${lastName ?? ''}`.trim();
    return name.length > 0 ? name : 'An employee';
  }
}
