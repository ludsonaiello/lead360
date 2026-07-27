import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { UpdateTimeClockSettingsDto } from '../dto/time-clock-settings.dto';

const KIOSK_TOKEN_PREFIX = 'tc_k_';
const KIOSK_TOKEN_BYTES = 48;
const BCRYPT_ROUNDS = 12;

const DECIMAL_FIELDS = [
  'overtime_daily_threshold_hours',
  'overtime_weekly_threshold_hours',
  'overtime_multiplier',
] as const;

@Injectable()
export class TimeClockSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLoggerService: AuditLoggerService,
  ) {}

  async getSettings(tenantId: string) {
    const settings = await this.prisma.time_clock_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    if (settings) {
      return this.formatResponse(settings);
    }

    const now = new Date();
    return {
      id: null,
      tenant_id: tenantId,
      clock_in_mode: 'anywhere',
      geofence_violation_action: 'warn_only',
      gps_required: true,
      gps_unavailable_action: 'allow_flagged',
      require_job_tag: false,
      require_task_tag: false,
      overtime_enabled: true,
      overtime_daily_threshold_hours: '8.00',
      overtime_weekly_threshold_hours: '40.00',
      overtime_multiplier: '1.50',
      pay_period_type: 'biweekly',
      pay_period_start_day: null,
      pay_period_anchor_date: null,
      kiosk_mode_enabled: false,
      kiosk_token_hash: null,
      shift_reminder_minutes: 30,
      missed_shift_threshold_minutes: 30,
      native_app_features_enabled: false,
      created_at: now,
      updated_at: now,
    };
  }

  async upsertSettings(
    tenantId: string,
    userId: string,
    dto: UpdateTimeClockSettingsDto,
  ) {
    const before = await this.prisma.time_clock_settings.findUnique({
      where: { tenant_id: tenantId },
    });
    const existedBefore = before !== null;

    const data = this.buildPrismaData(dto);

    const result = await this.prisma.time_clock_settings.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        ...data,
      } as Prisma.time_clock_settingsUncheckedCreateInput,
      update: data as Prisma.time_clock_settingsUncheckedUpdateInput,
    });

    const formatted = this.formatResponse(result);

    await this.auditLoggerService.logTenantChange({
      action: existedBefore ? 'updated' : 'created',
      entityType: 'time_clock_settings',
      entityId: result.id,
      tenantId,
      actorUserId: userId,
      before: before ? this.formatResponse(before) : undefined,
      after: formatted,
      description: existedBefore
        ? 'Updated time clock settings'
        : 'Created time clock settings',
    });

    return formatted;
  }

  async regenerateKioskToken(tenantId: string, userId: string) {
    const plaintextToken =
      KIOSK_TOKEN_PREFIX +
      crypto.randomBytes(KIOSK_TOKEN_BYTES).toString('hex');
    const hash = await bcrypt.hash(plaintextToken, BCRYPT_ROUNDS);

    const result = await this.prisma.time_clock_settings.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        kiosk_token_hash: hash,
      },
      update: {
        kiosk_token_hash: hash,
      },
    });

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'time_clock_settings',
      entityId: result.id,
      tenantId,
      actorUserId: userId,
      description: 'Regenerated kiosk authentication token',
    });

    return { kiosk_token: plaintextToken };
  }

  private buildPrismaData(
    dto: UpdateTimeClockSettingsDto,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (dto.clock_in_mode !== undefined) {
      data.clock_in_mode = dto.clock_in_mode;
    }
    if (dto.geofence_violation_action !== undefined) {
      data.geofence_violation_action = dto.geofence_violation_action;
    }
    if (dto.gps_required !== undefined) {
      data.gps_required = dto.gps_required;
    }
    if (dto.gps_unavailable_action !== undefined) {
      data.gps_unavailable_action = dto.gps_unavailable_action;
    }
    if (dto.require_job_tag !== undefined) {
      data.require_job_tag = dto.require_job_tag;
    }
    if (dto.require_task_tag !== undefined) {
      data.require_task_tag = dto.require_task_tag;
    }
    if (dto.overtime_enabled !== undefined) {
      data.overtime_enabled = dto.overtime_enabled;
    }
    if (dto.overtime_daily_threshold_hours !== undefined) {
      data.overtime_daily_threshold_hours = new Decimal(
        dto.overtime_daily_threshold_hours,
      );
    }
    if (dto.overtime_weekly_threshold_hours !== undefined) {
      data.overtime_weekly_threshold_hours = new Decimal(
        dto.overtime_weekly_threshold_hours,
      );
    }
    if (dto.overtime_multiplier !== undefined) {
      data.overtime_multiplier = new Decimal(dto.overtime_multiplier);
    }
    if (dto.pay_period_type !== undefined) {
      data.pay_period_type = dto.pay_period_type;
    }
    if (dto.pay_period_start_day !== undefined) {
      data.pay_period_start_day = dto.pay_period_start_day;
    }
    if (dto.pay_period_anchor_date !== undefined) {
      data.pay_period_anchor_date = new Date(dto.pay_period_anchor_date);
    }
    if (dto.kiosk_mode_enabled !== undefined) {
      data.kiosk_mode_enabled = dto.kiosk_mode_enabled;
    }
    if (dto.shift_reminder_minutes !== undefined) {
      data.shift_reminder_minutes = dto.shift_reminder_minutes;
    }
    if (dto.missed_shift_threshold_minutes !== undefined) {
      data.missed_shift_threshold_minutes = dto.missed_shift_threshold_minutes;
    }

    return data;
  }

  private formatResponse(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...record };
    for (const field of DECIMAL_FIELDS) {
      const value = out[field];
      if (value === null || value === undefined) {
        continue;
      }
      if (value instanceof Decimal) {
        out[field] = value.toFixed(2);
      } else if (typeof value === 'number') {
        out[field] = value.toFixed(2);
      } else if (typeof value === 'string') {
        out[field] = new Decimal(value).toFixed(2);
      }
    }
    return out;
  }
}
