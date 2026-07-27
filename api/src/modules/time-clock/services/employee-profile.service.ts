import * as bcrypt from 'bcrypt';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateEmployeeProfileDto,
  ListEmployeeProfilesDto,
  SavePushSubscriptionDto,
  SetEmployeePinDto,
  UpdateEmployeeProfileDto,
} from '../dto/employee-profile.dto';

const PIN_BCRYPT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
} as const;

const CREW_MEMBER_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  default_hourly_rate: true,
} as const;

const PROJECT_SELECT = {
  id: true,
  name: true,
  status: true,
} as const;

type EmployeeProfileRecord = Prisma.employee_profileGetPayload<
  Record<string, never>
> & {
  user?: unknown;
  crew_member?: unknown;
  project_assignments?: unknown;
};

@Injectable()
export class EmployeeProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLoggerService: AuditLoggerService,
  ) {}

  async findAll(tenantId: string, query: ListEmployeeProfilesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.employee_profileWhereInput = { tenant_id: tenantId };

    if (query.is_active !== undefined) {
      where.is_active = query.is_active;
    }

    if (query.search) {
      const term = query.search;
      where.user = {
        OR: [
          { first_name: { contains: term } },
          { last_name: { contains: term } },
          { email: { contains: term } },
        ],
      };
    }

    const [records, total] = await Promise.all([
      this.prisma.employee_profile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: USER_SELECT },
          crew_member: { select: CREW_MEMBER_SELECT },
        },
      }),
      this.prisma.employee_profile.count({ where }),
    ]);

    return {
      data: records.map((record) => this.stripSensitive(record)),
      meta: {
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateEmployeeProfileDto,
  ) {
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: {
        user_id: dto.user_id,
        tenant_id: tenantId,
        status: 'ACTIVE',
      },
    });
    if (!membership) {
      throw new NotFoundException('User not found in this tenant');
    }

    const existing = await this.prisma.employee_profile.findFirst({
      where: { tenant_id: tenantId, user_id: dto.user_id },
    });
    if (existing) {
      throw new ConflictException(
        'Employee profile already exists for this user',
      );
    }

    let resolvedCrewMemberId: string | null = null;

    if (dto.crew_member_id) {
      const crewMember = await this.prisma.crew_member.findFirst({
        where: { id: dto.crew_member_id, tenant_id: tenantId },
      });
      if (!crewMember) {
        throw new NotFoundException('Crew member not found');
      }
      resolvedCrewMemberId = crewMember.id;
    } else {
      const autoLinked = await this.prisma.crew_member.findFirst({
        where: { user_id: dto.user_id, tenant_id: tenantId },
      });
      if (autoLinked) {
        resolvedCrewMemberId = autoLinked.id;
      }
    }

    const created = await this.prisma.employee_profile.create({
      data: {
        tenant_id: tenantId,
        user_id: dto.user_id,
        crew_member_id: resolvedCrewMemberId,
        hourly_rate: dto.hourly_rate ?? null,
        overtime_rule_override: dto.overtime_rule_override ?? false,
        overtime_daily_threshold_hours:
          dto.overtime_daily_threshold_hours ?? null,
        overtime_weekly_threshold_hours:
          dto.overtime_weekly_threshold_hours ?? null,
      },
      include: {
        user: { select: USER_SELECT },
        crew_member: { select: CREW_MEMBER_SELECT },
      },
    });

    const sanitized = this.stripSensitive(created);

    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'employee_profile',
      entityId: created.id,
      tenantId,
      actorUserId: userId,
      after: sanitized,
      description: 'Created employee profile',
    });

    return sanitized;
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.employee_profile.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        user: { select: USER_SELECT },
        crew_member: { select: CREW_MEMBER_SELECT },
        project_assignments: {
          include: {
            project: { select: PROJECT_SELECT },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Employee profile not found');
    }

    return this.stripSensitive(record);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateEmployeeProfileDto,
  ) {
    const existing = await this.prisma.employee_profile.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        user: { select: USER_SELECT },
        crew_member: { select: CREW_MEMBER_SELECT },
      },
    });
    if (!existing) {
      throw new NotFoundException('Employee profile not found');
    }

    if (dto.crew_member_id !== undefined && dto.crew_member_id !== null) {
      const crewMember = await this.prisma.crew_member.findFirst({
        where: { id: dto.crew_member_id, tenant_id: tenantId },
      });
      if (!crewMember) {
        throw new NotFoundException('Crew member not found');
      }
    }

    const data: Prisma.employee_profileUpdateInput = {};
    if (dto.crew_member_id !== undefined) {
      data.crew_member =
        dto.crew_member_id === null
          ? { disconnect: true }
          : { connect: { id: dto.crew_member_id } };
    }
    if (dto.hourly_rate !== undefined) {
      data.hourly_rate = dto.hourly_rate;
    }
    if (dto.overtime_rule_override !== undefined) {
      data.overtime_rule_override = dto.overtime_rule_override;
    }
    if (dto.overtime_daily_threshold_hours !== undefined) {
      data.overtime_daily_threshold_hours = dto.overtime_daily_threshold_hours;
    }
    if (dto.overtime_weekly_threshold_hours !== undefined) {
      data.overtime_weekly_threshold_hours =
        dto.overtime_weekly_threshold_hours;
    }
    if (dto.is_active !== undefined) {
      data.is_active = dto.is_active;
    }

    const updated = await this.prisma.employee_profile.update({
      where: { id },
      data,
      include: {
        user: { select: USER_SELECT },
        crew_member: { select: CREW_MEMBER_SELECT },
      },
    });

    const sanitizedBefore = this.stripSensitive(existing);
    const sanitizedAfter = this.stripSensitive(updated);

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'employee_profile',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: sanitizedBefore,
      after: sanitizedAfter,
      description: 'Updated employee profile',
    });

    return sanitizedAfter;
  }

  async setPin(
    tenantId: string,
    userId: string,
    id: string,
    dto: SetEmployeePinDto,
  ) {
    const existing = await this.prisma.employee_profile.findFirst({
      where: { id, tenant_id: tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Employee profile not found');
    }

    const hash = await bcrypt.hash(dto.pin, PIN_BCRYPT_ROUNDS);

    await this.prisma.employee_profile.update({
      where: { id },
      data: {
        kiosk_pin_hash: hash,
        kiosk_pin_failed_attempts: 0,
        kiosk_pin_locked_until: null,
      },
    });

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'employee_profile',
      entityId: id,
      tenantId,
      actorUserId: userId,
      description: 'Updated kiosk PIN for employee',
    });

    return { message: 'PIN updated successfully' };
  }

  async removePin(tenantId: string, userId: string, id: string) {
    const existing = await this.prisma.employee_profile.findFirst({
      where: { id, tenant_id: tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Employee profile not found');
    }

    await this.prisma.employee_profile.update({
      where: { id },
      data: {
        kiosk_pin_hash: null,
        kiosk_pin_failed_attempts: 0,
        kiosk_pin_locked_until: null,
      },
    });

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'employee_profile',
      entityId: id,
      tenantId,
      actorUserId: userId,
      description: 'Removed kiosk PIN for employee',
    });

    return { message: 'PIN removed successfully' };
  }

  async savePushSubscription(
    tenantId: string,
    userId: string,
    dto: SavePushSubscriptionDto,
  ) {
    const profile = await this.prisma.employee_profile.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('No employee profile found for current user');
    }

    await this.prisma.employee_profile.update({
      where: { id: profile.id },
      data: { push_subscription_json: dto.push_subscription_json },
    });

    return { message: 'Push subscription saved' };
  }

  private stripSensitive<T extends Partial<EmployeeProfileRecord>>(
    record: T,
  ): Omit<T, 'kiosk_pin_hash' | 'push_subscription_json'> & {
    has_pin: boolean;
    is_locked: boolean;
  } {
    const {
      kiosk_pin_hash,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      push_subscription_json,
      ...rest
    } = record as EmployeeProfileRecord;

    const lockedUntil = (rest as { kiosk_pin_locked_until?: Date | null })
      .kiosk_pin_locked_until;

    return {
      ...(rest as Omit<T, 'kiosk_pin_hash' | 'push_subscription_json'>),
      has_pin: kiosk_pin_hash != null,
      is_locked: lockedUntil != null && lockedUntil.getTime() > Date.now(),
    };
  }
}
