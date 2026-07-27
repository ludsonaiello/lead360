# Time Clock & Workforce Module -- Backend Implementation Guide

**Module**: `time-clock`
**Version**: 1.0
**Created**: 2026-04-10
**Working Directory**: `/var/www/lead360.app/api/`
**Database**: MySQL/MariaDB via Prisma ORM
**Framework**: NestJS (modular monolith)

---

## 1. Mandatory Reading Checklist

Before writing any code, you MUST read these files in their entirety:

| File | Purpose |
|------|---------|
| `api/prisma/schema.prisma` | Current schema -- understand existing models, relations, enums |
| `api/src/modules/audit/services/audit-logger.service.ts` | Exact `logTenantChange()` signature and interface |
| `api/src/modules/communication/services/notifications.service.ts` | Exact `createNotification()` signature |
| `api/src/modules/financial/services/crew-hour-log.service.ts` | Understand `logHours()` to know why we bypass it |
| `api/src/modules/leads/services/google-maps.service.ts` | `validateAddress()` interface for geocoding |
| `api/src/modules/projects/services/project.service.ts` | Project queries for address import |
| `api/src/modules/projects/services/task-assignment.service.ts` | Task assignee checks |
| `api/src/modules/rbac/services/rbac.service.ts` | `hasAnyRole()` call used by RolesGuard |
| `api/src/modules/rbac/guards/roles.guard.ts` | How RolesGuard invokes RBAC checks |
| `api/src/modules/auth/decorators/tenant-id.decorator.ts` | `@TenantId()` decorator |
| `api/src/modules/auth/decorators/current-user.decorator.ts` | `@CurrentUser()` decorator |
| `api/src/modules/auth/guards/jwt-auth.guard.ts` | `JwtAuthGuard` and `@Public()` bypass |
| `api/src/modules/rbac/decorators/roles.decorator.ts` | `@Roles()` decorator |
| `api/src/app.module.ts` | Where to register TimeClockModule |
| `api/src/main.ts` | Port, global prefix, validation pipe config |
| `api/prisma/seeds/rbac.seed.ts` | Permission upsert pattern, module definitions |
| `api/src/modules/jobs/` (all files) | BullMQ patterns, processor/scheduler patterns |

---

## 2. Server Rules

| Rule | Value |
|------|-------|
| Port | `8000` |
| Global prefix | `api/v1` |
| Base URL | `http://127.0.0.1:8000/api/v1` |
| Swagger docs | `http://127.0.0.1:8000/api/docs` |
| Dev server | `npm run start:dev` (NO PM2) |
| DATABASE_URL | From `.env` file |
| Validation pipe | `whitelist: true, forbidNonWhitelisted: true` |
| Prisma lookups | Always use `findFirst` not `findUnique` (except by actual unique fields like `tenant_id` on settings) |
| Tenant ID | **ALWAYS** from JWT (`req.user.tenant_id`), **NEVER** from request body |
| User ID | **ALWAYS** from JWT (`req.user.id`), **NEVER** from request body |
| Every DB query | MUST include `tenant_id` filter -- no exceptions |

---

## 3. Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Tenant Contact / Employee | `contact@honeydo4you.com` | `978@F32c` |
| Sys Admin | `ludsonaiello@gmail.com` | `978@F32c` |

---

## 4. Decorators and Guards

| Item | Import Path | Usage |
|------|-------------|-------|
| `@TenantId()` | `../auth/decorators/tenant-id.decorator` | Extracts `tenant_id` from JWT |
| `@CurrentUser()` | `../auth/decorators/current-user.decorator` | Extracts user or property (e.g., `@CurrentUser('id')`) |
| `JwtAuthGuard` | `../auth/guards/jwt-auth.guard` | JWT validation, supports `@Public()` bypass |
| `RolesGuard` | `../rbac/guards/roles.guard` | Calls `rbacService.hasAnyRole()` |
| `@Roles()` | `../rbac/decorators/roles.decorator` | Sets required role names metadata |
| `@Public()` | `../auth/guards/jwt-auth.guard` | Bypasses JWT auth for public endpoints |

**NOTE**: Existing controllers use `@Request() req` and access `req.user.tenant_id`, `req.user.id`. Follow this pattern.

---

## 5. Controller Pattern

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { Roles } from '../rbac/decorators/roles.decorator';

@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SomeController {
  constructor(private readonly someService: SomeService) {}

  @Post('endpoint')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Description' })
  @ApiResponse({ status: 201, description: 'Created' })
  async create(@Request() req, @Body() dto: CreateDto) {
    return this.someService.create(req.user.tenant_id, req.user.id, dto);
  }

  @Get('endpoint')
  @Roles('Owner', 'Admin', 'Project Manager', 'Bookkeeper')
  async findAll(@Request() req, @Query() query: ListQueryDto) {
    return this.someService.findAll(req.user.tenant_id, query);
  }
}
```

---

## 6. DTO Pattern

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsUUID, IsNumber, IsOptional, IsDateString,
  IsBoolean, IsEnum, IsInt, Min, Max, IsDecimal,
  MaxLength, MinLength, IsNotEmpty, ValidateIf, IsArray,
  ValidateNested, ArrayMinSize, ArrayMaxSize, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSomethingDto {
  @ApiProperty({ description: 'Project ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsUUID()
  project_id: string;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
```

---

## 7. Service Signatures (External Dependencies)

### AuditLoggerService.logTenantChange()

```typescript
// Import: '../../audit/services/audit-logger.service'
// Inject: private readonly auditLogger: AuditLoggerService

async logTenantChange(params: {
  action: 'created' | 'updated' | 'deleted';
  entityType: string;
  entityId: string;
  tenantId: string | null;
  actorUserId: string;
  before?: object;
  after?: object;
  metadata?: object;
  description: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void>
```

### NotificationsService.createNotification()

```typescript
// Import: '../../communication/services/notifications.service'
// Inject: private readonly notificationsService: NotificationsService

async createNotification(data: {
  tenant_id: string;
  user_id?: string | null;   // null = tenant-wide broadcast
  type: string;
  title: string;
  message: string;
  action_url?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  expires_at?: Date;
}): Promise<notification>
```

### GoogleMapsService.validateAddress()

```typescript
// Import: '../../leads/services/google-maps.service'
// Cross-module from LeadsModule -- TimeClockModule must import LeadsModule
// Inject: private readonly googleMapsService: GoogleMapsService

interface PartialAddress {
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface ValidatedAddress {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

async validateAddress(address: PartialAddress): Promise<ValidatedAddress>
```

### Pagination Response Shape

```json
{
  "data": [],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

## 8. Module Registration

### TimeClockModule

```typescript
// File: api/src/modules/time-clock/time-clock.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { CommunicationModule } from '../communication/communication.module';
import { LeadsModule } from '../leads/leads.module'; // for GoogleMapsService

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    CommunicationModule,
    LeadsModule,
    BullModule.registerQueue({ name: 'time-clock' }),
  ],
  controllers: [
    TimeClockSettingsController,
    EmployeeProfileController,
    ClockinAddressController,
    EmployeeProjectAssignmentController,
    WorkShiftController,
    ClockSessionController,
    BreakEntryController,
    TimeDisputeController,
    KioskController,
    TimeClockDashboardController,
    TimeClockReportsController,
  ],
  providers: [
    TimeClockSettingsService,
    EmployeeProfileService,
    ClockinAddressService,
    EmployeeProjectAssignmentService,
    WorkShiftService,
    ClockSessionService,
    BreakEntryService,
    ClockSessionEditService,
    TimeDisputeService,
    KioskService,
    GeofenceService,
    OvertimeService,
    LaborCostAttributionService,
    TimeClockDashboardService,
    TimeClockReportsService,
    TimeClockProcessor,
    TimeClockScheduler,
    KioskTokenGuard,
  ],
  exports: [
    ClockSessionService,
    EmployeeProfileService,
    GeofenceService,
    OvertimeService,
  ],
})
export class TimeClockModule {}
```

### AppModule Registration

File: `api/src/app.module.ts`

Add `TimeClockModule` to the imports array:

```typescript
import { TimeClockModule } from './modules/time-clock/time-clock.module';

@Module({
  imports: [
    // ... existing imports ...
    PortalModule,
    TimeClockModule,  // <-- ADD HERE
  ],
  // ...
})
export class AppModule {}
```

### BullMQ Root Config (already configured in AppModule)

```typescript
BullModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    connection: {
      host: configService.get('REDIS_HOST') || '127.0.0.1',
      port: configService.get('REDIS_PORT') || 6379,
      password: configService.get('REDIS_PASSWORD'),
    },
  }),
  inject: [ConfigService],
})
```

---

## 9. Complete Prisma Schema Additions

Add the following to `api/prisma/schema.prisma`.

### 9.1 New Enums (12)

```prisma
// ============================================================================
// TIME CLOCK MODULE ENUMS
// ============================================================================

enum clock_in_mode {
  anywhere
  specific_addresses
  active_job_sites
}

enum geofence_violation_action {
  block
  warn_only
}

enum gps_unavailable_action {
  block
  allow_flagged
}

enum pay_period_type {
  weekly
  biweekly
  semimonthly
  monthly
}

enum clock_session_status {
  active
  on_break
  completed
  flagged
}

enum location_source {
  browser_gps
  native_gps
  kiosk
  manual
}

enum geofence_status {
  inside
  outside
  unavailable
  not_enforced
}

enum work_shift_status {
  scheduled
  in_progress
  completed
  missed
  cancelled
}

enum break_type {
  paid
  unpaid
}

enum dispute_type {
  flag_only
  correction_request
}

enum dispute_status {
  pending
  approved
  rejected
  resolved
}

enum address_source {
  manual
  imported_from_quote
  imported_from_lead
}
```

### 9.2 New Models (10 tables)

#### time_clock_settings

```prisma
model time_clock_settings {
  id                              String                     @id @default(uuid()) @db.VarChar(36)
  tenant_id                       String                     @unique @db.VarChar(36)
  clock_in_mode                   clock_in_mode              @default(anywhere)
  geofence_violation_action       geofence_violation_action  @default(warn_only)
  gps_required                    Boolean                    @default(true)
  gps_unavailable_action          gps_unavailable_action     @default(allow_flagged)
  require_job_tag                 Boolean                    @default(false)
  require_task_tag                Boolean                    @default(false)
  overtime_enabled                Boolean                    @default(true)
  overtime_daily_threshold_hours  Decimal?                   @default(8.00) @db.Decimal(4, 2)
  overtime_weekly_threshold_hours Decimal?                   @default(40.00) @db.Decimal(5, 2)
  overtime_multiplier             Decimal?                   @default(1.50) @db.Decimal(3, 2)
  pay_period_type                 pay_period_type            @default(biweekly)
  pay_period_start_day            Int?
  pay_period_anchor_date          DateTime?                  @db.Date
  kiosk_mode_enabled              Boolean                    @default(false)
  kiosk_token_hash                String?                    @db.VarChar(255)
  shift_reminder_minutes          Int                        @default(30)
  missed_shift_threshold_minutes  Int                        @default(30)
  native_app_features_enabled     Boolean                    @default(false)
  created_at                      DateTime                   @default(now())
  updated_at                      DateTime                   @updatedAt

  // Relations
  tenant tenant @relation("time_clock_settings_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)

  @@map("time_clock_settings")
}
```

#### employee_profile

```prisma
model employee_profile {
  id                              String    @id @default(uuid()) @db.VarChar(36)
  tenant_id                       String    @db.VarChar(36)
  user_id                         String    @db.VarChar(36)
  crew_member_id                  String?   @db.VarChar(36)
  hourly_rate                     Decimal?  @db.Decimal(10, 2)
  overtime_rule_override          Boolean   @default(false)
  overtime_daily_threshold_hours  Decimal?  @db.Decimal(4, 2)
  overtime_weekly_threshold_hours Decimal?  @db.Decimal(5, 2)
  kiosk_pin_hash                  String?   @db.VarChar(255)
  kiosk_pin_failed_attempts       Int       @default(0)
  kiosk_pin_locked_until          DateTime?
  is_active                       Boolean   @default(true)
  push_subscription_json          String?   @db.Text
  push_token_native               String?   @db.VarChar(500)
  created_at                      DateTime  @default(now())
  updated_at                      DateTime  @updatedAt

  // Relations
  tenant                  tenant                       @relation("employee_profile_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  user                    user                         @relation("employee_profile_user", fields: [user_id], references: [id], onDelete: Restrict)
  crew_member             crew_member?                 @relation("employee_profile_crew_member", fields: [crew_member_id], references: [id], onDelete: SetNull)
  project_assignments     employee_project_assignment[] @relation("employee_project_assignment_employee")
  work_shifts             work_shift[]                 @relation("work_shift_employee")
  clock_sessions          clock_session[]              @relation("clock_session_employee")

  @@unique([tenant_id, user_id])
  @@index([tenant_id, is_active])
  @@index([tenant_id, crew_member_id])
  @@map("employee_profile")
}
```

#### clockin_address

```prisma
model clockin_address {
  id                 String         @id @default(uuid()) @db.VarChar(36)
  tenant_id          String         @db.VarChar(36)
  project_id         String?        @db.VarChar(36)
  label              String         @db.VarChar(100)
  address_line1      String         @db.VarChar(255)
  address_line2      String?        @db.VarChar(255)
  city               String         @db.VarChar(100)
  state              String         @db.VarChar(2)
  zip_code           String         @db.VarChar(10)
  latitude           Decimal        @db.Decimal(10, 8)
  longitude          Decimal        @db.Decimal(11, 8)
  radius_meters      Int            @default(100)
  is_active          Boolean        @default(true)
  source             address_source @default(manual)
  source_address_id  String?        @db.VarChar(36)
  created_by_user_id String         @db.VarChar(36)
  created_at         DateTime       @default(now())
  updated_at         DateTime       @updatedAt

  // Relations
  tenant         tenant          @relation("clockin_address_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  project        project?        @relation("clockin_address_project", fields: [project_id], references: [id], onDelete: SetNull)
  created_by     user            @relation("clockin_address_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  clock_sessions clock_session[] @relation("clock_session_clockin_address")

  @@index([tenant_id, is_active])
  @@index([tenant_id, project_id])
  @@map("clockin_address")
}
```

#### employee_project_assignment

```prisma
model employee_project_assignment {
  id                  String   @id @default(uuid()) @db.VarChar(36)
  tenant_id           String   @db.VarChar(36)
  employee_profile_id String   @db.VarChar(36)
  project_id          String   @db.VarChar(36)
  assigned_by_user_id String   @db.VarChar(36)
  created_at          DateTime @default(now())

  // Relations
  tenant           tenant           @relation("employee_project_assignment_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  employee_profile employee_profile @relation("employee_project_assignment_employee", fields: [employee_profile_id], references: [id], onDelete: Cascade)
  project          project          @relation("employee_project_assignment_project", fields: [project_id], references: [id], onDelete: Cascade)
  assigned_by      user             @relation("employee_project_assignment_assigned_by", fields: [assigned_by_user_id], references: [id], onDelete: Restrict)

  @@unique([tenant_id, employee_profile_id, project_id])
  @@index([tenant_id, project_id])
  @@map("employee_project_assignment")
}
```

#### work_shift

```prisma
model work_shift {
  id                  String            @id @default(uuid()) @db.VarChar(36)
  tenant_id           String            @db.VarChar(36)
  employee_profile_id String            @db.VarChar(36)
  project_id          String?           @db.VarChar(36)
  task_id             String?           @db.VarChar(36)
  scheduled_start     DateTime
  scheduled_end       DateTime
  title               String?           @db.VarChar(100)
  notes               String?           @db.Text
  status              work_shift_status @default(scheduled)
  reminder_sent_at    DateTime?
  published_at        DateTime?
  created_by_user_id  String            @db.VarChar(36)
  created_at          DateTime          @default(now())
  updated_at          DateTime          @updatedAt

  // Relations
  tenant           tenant           @relation("work_shift_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  employee_profile employee_profile @relation("work_shift_employee", fields: [employee_profile_id], references: [id], onDelete: Cascade)
  project          project?         @relation("work_shift_project", fields: [project_id], references: [id], onDelete: SetNull)
  task             project_task?    @relation("work_shift_task", fields: [task_id], references: [id], onDelete: SetNull)
  created_by       user             @relation("work_shift_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  clock_sessions   clock_session[]  @relation("clock_session_work_shift")

  @@index([tenant_id, employee_profile_id, scheduled_start])
  @@index([tenant_id, status])
  @@index([tenant_id, scheduled_start])
  @@map("work_shift")
}
```

#### clock_session

```prisma
model clock_session {
  id                               String               @id @default(uuid()) @db.VarChar(36)
  tenant_id                        String               @db.VarChar(36)
  employee_profile_id              String               @db.VarChar(36)
  work_shift_id                    String?              @db.VarChar(36)
  project_id                       String?              @db.VarChar(36)
  task_id                          String?              @db.VarChar(36)
  clockin_address_id               String?              @db.VarChar(36)
  status                           clock_session_status @default(active)
  clock_in_at                      DateTime
  clock_out_at                     DateTime?
  clock_in_latitude                Decimal?             @db.Decimal(10, 8)
  clock_in_longitude               Decimal?             @db.Decimal(11, 8)
  clock_in_location_source         location_source      @default(browser_gps)
  clock_in_geofence_status         geofence_status      @default(not_enforced)
  clock_out_latitude               Decimal?             @db.Decimal(10, 8)
  clock_out_longitude              Decimal?             @db.Decimal(11, 8)
  clock_out_location_source        location_source      @default(browser_gps)
  clock_out_geofence_status        geofence_status      @default(not_enforced)
  total_worked_minutes             Int?
  regular_minutes                  Int?
  overtime_minutes                 Int?
  is_manual_edit                   Boolean              @default(false)
  is_flagged                       Boolean              @default(false)
  flag_reason                      String?              @db.VarChar(255)
  labor_cost_posted                Boolean              @default(false)
  labor_cost_entry_id              String?              @db.VarChar(36)
  labor_cost_reconciliation_needed Boolean              @default(false)
  notes                            String?              @db.Text
  created_at                       DateTime             @default(now())
  updated_at                       DateTime             @updatedAt

  // Relations
  tenant           tenant            @relation("clock_session_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  employee_profile employee_profile  @relation("clock_session_employee", fields: [employee_profile_id], references: [id], onDelete: Restrict)
  work_shift       work_shift?       @relation("clock_session_work_shift", fields: [work_shift_id], references: [id], onDelete: SetNull)
  project          project?          @relation("clock_session_project", fields: [project_id], references: [id], onDelete: SetNull)
  task             project_task?     @relation("clock_session_task", fields: [task_id], references: [id], onDelete: SetNull)
  clockin_address  clockin_address?  @relation("clock_session_clockin_address", fields: [clockin_address_id], references: [id], onDelete: SetNull)
  break_entries    break_entry[]     @relation("break_entry_session")
  edit_logs        clock_session_edit_log[] @relation("clock_session_edit_log_session")
  disputes         time_dispute[]    @relation("time_dispute_session")
  location_logs    clock_session_location_log[] @relation("clock_session_location_log_session")

  @@index([tenant_id, employee_profile_id, clock_in_at])
  @@index([tenant_id, status])
  @@index([tenant_id, project_id])
  @@index([tenant_id, is_flagged])
  @@index([tenant_id, clock_in_at])
  @@index([tenant_id, labor_cost_posted])
  @@map("clock_session")
}
```

#### break_entry

```prisma
model break_entry {
  id               String     @id @default(uuid()) @db.VarChar(36)
  tenant_id        String     @db.VarChar(36)
  clock_session_id String     @db.VarChar(36)
  break_type       break_type @default(unpaid)
  break_label      String?    @db.VarChar(50)
  started_at       DateTime
  ended_at         DateTime?
  duration_minutes Int?
  created_at       DateTime   @default(now())
  updated_at       DateTime   @updatedAt

  // Relations
  tenant        tenant        @relation("break_entry_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  clock_session clock_session @relation("break_entry_session", fields: [clock_session_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, clock_session_id])
  @@map("break_entry")
}
```

#### clock_session_edit_log

```prisma
model clock_session_edit_log {
  id                String   @id @default(uuid()) @db.VarChar(36)
  tenant_id         String   @db.VarChar(36)
  clock_session_id  String   @db.VarChar(36)
  edited_by_user_id String   @db.VarChar(36)
  field_changed     String   @db.VarChar(100)
  original_value    String?  @db.Text
  new_value         String?  @db.Text
  reason            String   @db.Text
  edited_at         DateTime @default(now())

  // Relations
  tenant        tenant        @relation("clock_session_edit_log_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  clock_session clock_session @relation("clock_session_edit_log_session", fields: [clock_session_id], references: [id], onDelete: Cascade)
  edited_by     user          @relation("clock_session_edit_log_editor", fields: [edited_by_user_id], references: [id], onDelete: Restrict)

  @@index([tenant_id, clock_session_id])
  @@map("clock_session_edit_log")
}
```

#### time_dispute

```prisma
model time_dispute {
  id                    String         @id @default(uuid()) @db.VarChar(36)
  tenant_id             String         @db.VarChar(36)
  clock_session_id      String         @db.VarChar(36)
  submitted_by_user_id  String         @db.VarChar(36)
  dispute_type          dispute_type
  description           String         @db.Text
  proposed_clock_in_at  DateTime?
  proposed_clock_out_at DateTime?
  proposed_project_id   String?        @db.VarChar(36)
  proposed_task_id      String?        @db.VarChar(36)
  proposed_notes        String?        @db.Text
  status                dispute_status @default(pending)
  reviewed_by_user_id   String?        @db.VarChar(36)
  review_notes          String?        @db.Text
  reviewed_at           DateTime?
  created_at            DateTime       @default(now())
  updated_at            DateTime       @updatedAt

  // Relations
  tenant        tenant        @relation("time_dispute_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  clock_session clock_session @relation("time_dispute_session", fields: [clock_session_id], references: [id], onDelete: Cascade)
  submitted_by  user          @relation("time_dispute_submitter", fields: [submitted_by_user_id], references: [id], onDelete: Restrict)
  reviewed_by   user?         @relation("time_dispute_reviewer", fields: [reviewed_by_user_id], references: [id], onDelete: SetNull)

  @@index([tenant_id, clock_session_id])
  @@index([tenant_id, status])
  @@map("time_dispute")
}
```

#### clock_session_location_log (Phase 2 Placeholder)

Create table now, write no data in Phase 1.

```prisma
model clock_session_location_log {
  id               String          @id @default(uuid()) @db.VarChar(36)
  tenant_id        String          @db.VarChar(36)
  clock_session_id String          @db.VarChar(36)
  captured_at      DateTime
  latitude         Decimal         @db.Decimal(10, 8)
  longitude        Decimal         @db.Decimal(11, 8)
  accuracy_meters  Decimal?        @db.Decimal(6, 2)
  geofence_status  geofence_status

  // Relations
  tenant        tenant        @relation("clock_session_location_log_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  clock_session clock_session @relation("clock_session_location_log_session", fields: [clock_session_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, clock_session_id])
  @@map("clock_session_location_log")
}
```

**Note**: Reuses the shared `geofence_status` enum (4 values: `inside`, `outside`, `unavailable`, `not_enforced`). In practice, periodic location logs will only use `inside` or `outside`. The shared enum avoids creating a redundant 2-value enum. Service logic in Phase 2 should only write `inside`/`outside` to this table.

### 9.3 Relation Additions to Existing Models

Add these relation fields to existing models in `schema.prisma`:

**In `model tenant`** (add alongside existing relation fields):
```prisma
  time_clock_settings              time_clock_settings?               @relation("time_clock_settings_tenant")
  employee_profiles                employee_profile[]                 @relation("employee_profile_tenant")
  clockin_addresses                clockin_address[]                  @relation("clockin_address_tenant")
  employee_project_assignments     employee_project_assignment[]      @relation("employee_project_assignment_tenant")
  work_shifts                      work_shift[]                       @relation("work_shift_tenant")
  clock_sessions                   clock_session[]                    @relation("clock_session_tenant")
  break_entries                    break_entry[]                      @relation("break_entry_tenant")
  clock_session_edit_logs          clock_session_edit_log[]           @relation("clock_session_edit_log_tenant")
  time_disputes                    time_dispute[]                     @relation("time_dispute_tenant")
  clock_session_location_logs      clock_session_location_log[]       @relation("clock_session_location_log_tenant")
```

**In `model user`** (add alongside existing relation fields):
```prisma
  employee_profiles                employee_profile[]                 @relation("employee_profile_user")
  clockin_addresses_created        clockin_address[]                  @relation("clockin_address_created_by")
  employee_project_assignments_by  employee_project_assignment[]      @relation("employee_project_assignment_assigned_by")
  work_shifts_created              work_shift[]                       @relation("work_shift_created_by")
  clock_session_edit_logs          clock_session_edit_log[]           @relation("clock_session_edit_log_editor")
  time_disputes_submitted          time_dispute[]                     @relation("time_dispute_submitter")
  time_disputes_reviewed           time_dispute[]                     @relation("time_dispute_reviewer")
```

**In `model crew_member`** (add alongside existing relation fields):
```prisma
  employee_profiles                employee_profile[]                 @relation("employee_profile_crew_member")
```

**In `model project`** (add alongside existing relation fields):
```prisma
  clockin_addresses                clockin_address[]                  @relation("clockin_address_project")
  employee_project_assignments     employee_project_assignment[]      @relation("employee_project_assignment_project")
  work_shifts                      work_shift[]                       @relation("work_shift_project")
  clock_sessions                   clock_session[]                    @relation("clock_session_project")
```

**In `model project_task`** (add alongside existing relation fields):
```prisma
  work_shifts                      work_shift[]                       @relation("work_shift_task")
  clock_sessions                   clock_session[]                    @relation("clock_session_task")
```

---

## 10. Migration Notes

### BREAKING CHANGE: crew_hour_log.project_id

The existing `crew_hour_log.project_id` is `String @db.VarChar(36)` (NOT nullable). It must become `String? @db.VarChar(36)` (nullable) because the time clock module may create `crew_hour_log` entries where project assignment is optional.

**Schema change**:

```prisma
// BEFORE (current)
model crew_hour_log {
  project_id  String       @db.VarChar(36)
  project     project      @relation("crew_hour_log_project", fields: [project_id], references: [id], onDelete: Cascade)
}

// AFTER (new)
model crew_hour_log {
  project_id  String?      @db.VarChar(36)
  project     project?     @relation("crew_hour_log_project", fields: [project_id], references: [id], onDelete: Cascade)
}
```

**Run this migration BEFORE deploying any time clock code.** Existing code that creates `crew_hour_log` entries always provides `project_id`, so it will continue to work without changes.

---

## 11. Module File Structure

```
api/src/modules/time-clock/
├── time-clock.module.ts
├── controllers/
│   ├── time-clock-settings.controller.ts
│   ├── employee-profile.controller.ts
│   ├── clockin-address.controller.ts
│   ├── employee-project-assignment.controller.ts
│   ├── work-shift.controller.ts
│   ├── clock-session.controller.ts
│   ├── break-entry.controller.ts
│   ├── time-dispute.controller.ts
│   ├── kiosk.controller.ts
│   ├── time-clock-dashboard.controller.ts
│   └── time-clock-reports.controller.ts
├── services/
│   ├── time-clock-settings.service.ts
│   ├── employee-profile.service.ts
│   ├── clockin-address.service.ts
│   ├── employee-project-assignment.service.ts
│   ├── work-shift.service.ts
│   ├── clock-session.service.ts
│   ├── break-entry.service.ts
│   ├── clock-session-edit.service.ts
│   ├── time-dispute.service.ts
│   ├── kiosk.service.ts
│   ├── geofence.service.ts
│   ├── overtime.service.ts
│   ├── labor-cost-attribution.service.ts
│   ├── time-clock-dashboard.service.ts
│   └── time-clock-reports.service.ts
├── processors/
│   └── time-clock.processor.ts
├── schedulers/
│   └── time-clock.scheduler.ts
├── guards/
│   └── kiosk-token.guard.ts
└── dto/
    ├── time-clock-settings.dto.ts
    ├── employee-profile.dto.ts
    ├── clockin-address.dto.ts
    ├── employee-project-assignment.dto.ts
    ├── work-shift.dto.ts
    ├── clock-session.dto.ts
    ├── break-entry.dto.ts
    ├── time-dispute.dto.ts
    ├── kiosk.dto.ts
    ├── dashboard.dto.ts
    └── reports.dto.ts
```

---

## 12. Business Rules Reference

### BR-001: One Active Session Per Employee (Per-Tenant)
An employee can only have one `active` or `on_break` clock session at a time **within the same tenant**. Clock-in when a session is already open returns HTTP 409: `"You already have an active clock session. Please clock out first."` Check is made before creating any session.

**Scope clarification**: The check is per-tenant only. Cross-tenant queries would violate the platform's absolute tenant isolation rule. If an employee works for multiple tenants, they may have concurrent sessions across different tenants — this is by design.

### BR-002: Multi-Site Clock-In
Employee may clock out of Site A and clock into Site B unlimited times per day. Each session is independent. Gap time between sessions is NOT tracked. Overtime is calculated by aggregating across all sessions for the day and week.

### BR-003: Geofence Enforcement at Clock-In
If `clock_in_mode` is `specific_addresses` or `active_job_sites`:
1. Query `clockin_address` where `tenant_id` matches AND `is_active = true` AND (`project_id IS NULL` OR `project_id = selected_project_id`)
2. Compute haversine distance between employee GPS and each address
3. If inside any address radius: `geofence_status = inside`, set `clockin_address_id` to matched address
4. If outside ALL addresses:
   - `block`: return HTTP 403, do NOT create session, queue admin notification
   - `warn_only`: create session with `is_flagged = true`, `flag_reason = "Outside all configured locations -- {distance}m from nearest"`, queue admin notification
5. If no addresses found: `geofence_status = not_enforced`

### BR-004: GPS Permission Denied
If browser denies GPS (no coordinates sent):
- `gps_unavailable_action = block`: return HTTP 403
- `gps_unavailable_action = allow_flagged`: create session with `clock_in_geofence_status = unavailable`, `is_flagged = true`

### BR-005: Auto Labor Cost Attribution on Clock-Out
On every successful clock-out:
1. Check `clock_session.project_id` -- if null, skip entirely
2. Check `employee_profile.crew_member_id` -- if null, skip, log warning
3. Resolve hourly rate: `employee_profile.hourly_rate` if set; else `crew_member.default_hourly_rate`
4. Check `clock_session.labor_cost_posted = false` -- if true, skip (idempotency)
5. Call `prisma.crew_hour_log.create()` DIRECTLY (not through `CrewHourLogService.logHours()` -- that hardcodes `source: 'manual'`)
6. On success: set `labor_cost_posted = true`, `labor_cost_entry_id = created_record.id`
7. On failure: do NOT fail clock-out. Log error. Queue admin notification.

### BR-006: Overtime Calculation
Run on every clock-out:
1. Resolve thresholds (employee override or tenant settings)
2. If `overtime_enabled = false`: all minutes are regular, skip OT
3. Fetch completed sessions for same day and week
4. Calculate remaining daily/weekly capacity
5. Split current session minutes into regular/overtime

### BR-007: Kiosk Mode
- Kiosk endpoints are PUBLIC -- no JWT required
- Authenticated by `X-Kiosk-Token` header
- Employee PIN stored as bcrypt hash in `employee_profile.kiosk_pin_hash`
- After 5 consecutive wrong PIN: lock for 15 minutes, send admin alert
- **Rate limit**: 10 PIN attempts per minute per kiosk token. Implement via in-memory counter keyed by token hash (or Redis if available). Return HTTP 429 `"Too many PIN attempts. Please wait."` when exceeded.
- `location_source = kiosk` on sessions created via kiosk

### BR-008: Manual Edit Rules
Only Owner or Admin can edit a `clock_session`.
For every edit:
1. Create `clock_session_edit_log` entry (mandatory reason)
2. Set `clock_session.is_manual_edit = true`
3. Recalculate `total_worked_minutes`, `regular_minutes`, `overtime_minutes`
4. If `labor_cost_posted = true`: set `labor_cost_reconciliation_needed = true`, queue admin alert
5. `clock_session_edit_log` records are IMMUTABLE

### BR-009: Shift Auto-Match on Clock-In
When employee clocks in:
1. Query `work_shift` where `employee_profile_id` matches AND `status = scheduled` AND `scheduled_start BETWEEN (clock_in_at - 2h) AND (clock_in_at + 2h)`
2. If multiple: pick closest `ABS(scheduled_start - clock_in_at)`
3. If match: set `clock_session.work_shift_id`, update `work_shift.status = in_progress`
4. If no match: `work_shift_id = null`

### BR-010: Missed Shift Auto-Detection
Background job every 15 minutes. Per-tenant, error-isolated.

**Detection logic**:
1. Find all `work_shift` where `status = scheduled` AND `scheduled_start < now() - tenant.missed_shift_threshold_minutes`
2. For each: check if any `clock_session` exists with `work_shift_id = shift.id` OR `clock_in_at` within +/-2h window for same employee
3. If no session found: set `work_shift.status = missed`
4. Queue notifications:
   - **Admin**: type `timeclock_missed_shift`, title `"Missed Shift"`, message `"{employee_name} has not clocked in — shift started {minutes_ago} minutes ago"`, action_url `/workforce/timesheets`
   - **Employee**: type `timeclock_missed_shift`, title `"Missed Shift"`, message `"You were marked as missed for your shift on {date} at {time}"`, action_url `/workforce/my-shifts`
5. Process per tenant. One tenant failure must not stop others. Log errors per tenant.

### BR-011: Dispute Lifecycle
Employee submits ONE active dispute per session at a time. Two types: `flag_only` and `correction_request`.

On approval of `correction_request`:
1. Apply proposed values to `clock_session` (only non-null proposed fields)
2. For each changed field: create `clock_session_edit_log` with `reason = "Approved dispute: {description}"`
3. Recalculate `total_worked_minutes`, `regular_minutes`, `overtime_minutes`
4. If `labor_cost_posted = true`: set `labor_cost_reconciliation_needed = true`
5. Set `time_dispute.status = approved`, `reviewed_by_user_id`, `reviewed_at`
6. Notify employee

On rejection:
1. No changes to `clock_session`
2. Set `status = rejected`, `review_notes` (mandatory), `reviewed_by_user_id`, `reviewed_at`
3. Notify employee

Employee can cancel a `pending` dispute (sets `status = resolved`).

### BR-012: Pay Period Boundary Calculation
Always computed dynamically. Never stored.
- `weekly`: starts on `pay_period_start_day` (0=Sun, 6=Sat) of current week in tenant timezone
- `biweekly`: requires `pay_period_anchor_date`. Current period = most recent `anchor_date + N*14 days <= today`. Length = 14 days.
- `semimonthly`: Period 1 = 1st-15th. Period 2 = 16th-last day of month.
- `monthly`: 1st through last day of month.
- Timezone: use `tenant.timezone` field (default `"America/New_York"`)

### BR-013: Employee Profile Lifecycle
- Created manually by Admin/Owner
- Admin selects existing `user` from tenant's user list
- Admin optionally selects existing `crew_member` to link
- Auto-link: If `crew_member` exists where `crew_member.user_id = selected_user.id`, auto-set `employee_profile.crew_member_id`
- If `crew_member_id` is null: clock-in still works, labor cost attribution skipped
- If `employee_profile` already exists for `user_id` within tenant: reject with HTTP 409

### BR-014: Clock-In Address Resolution
`clockin_address` is standalone. Sources: `manual` (geocoded via GoogleMapsService), `imported_from_quote`, `imported_from_lead`.

### BR-015: Employee-Project Assignment
When `clock_in_mode = active_job_sites`: project selector shows ONLY projects where `employee_project_assignment` exists OR where employee has a `task_assignee` record on any task within the project.

### BR-016: Break Rules
1. Only ONE active break (where `ended_at IS NULL`) per session at a time. Starting a second break returns HTTP 409.
2. Breaks can only be started on sessions with `status = 'active'`. Starting a break on a non-active session returns HTTP 400.
3. **Auto-end on clock-out**: If employee clocks out while `status = 'on_break'`, the active break is automatically ended (`ended_at = now()`, `duration_minutes` computed) before processing clock-out.
4. **Paid vs unpaid subtraction**: Only `unpaid` break durations are subtracted from `total_worked_minutes`. Paid breaks are NOT subtracted — they count as worked time.
5. No maximum break count or duration limit per session. Multiple breaks (sequential, not concurrent) are allowed.
6. `duration_minutes = FLOOR((ended_at - started_at) / 60000)`. Minimum 0.

---

## 13. API Endpoints (57 total)

### 13.1 Settings Endpoints (3)

---

#### GET /api/v1/time-clock/settings

**Roles**: `Owner`, `Admin`

**Description**: Get tenant time clock settings. If no settings record exists, return a **default-values response** with `id = null` (indicating no record saved yet). This allows the frontend settings page to render with defaults without requiring the admin to PATCH first.

**Behavior**:
- If record exists: return it.
- If no record exists: return the default shape below with `id: null`. Do NOT return 404. The PATCH endpoint will upsert (create on first save).

**Request**: No body. No query parameters.

**Response 200**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "clock_in_mode": "anywhere",
  "geofence_violation_action": "warn_only",
  "gps_required": true,
  "gps_unavailable_action": "allow_flagged",
  "require_job_tag": false,
  "require_task_tag": false,
  "overtime_enabled": true,
  "overtime_daily_threshold_hours": "8.00",
  "overtime_weekly_threshold_hours": "40.00",
  "overtime_multiplier": "1.50",
  "pay_period_type": "biweekly",
  "pay_period_start_day": null,
  "pay_period_anchor_date": null,
  "kiosk_mode_enabled": false,
  "kiosk_token_hash": null,
  "shift_reminder_minutes": 30,
  "missed_shift_threshold_minutes": 30,
  "native_app_features_enabled": false,
  "created_at": "2026-04-10T00:00:00.000Z",
  "updated_at": "2026-04-10T00:00:00.000Z"
}
```

**Errors**:
- 401: Unauthorized (no/invalid JWT)
- 403: Forbidden (insufficient role)

**Business Rules**: None

**Audit Log**: No

---

#### PATCH /api/v1/time-clock/settings

**Roles**: `Owner`, `Admin`

**Description**: Create or update tenant time clock settings (upsert). Returns the full updated record.

**Request Body DTO** (`UpdateTimeClockSettingsDto`):

```typescript
export class UpdateTimeClockSettingsDto {
  @ApiPropertyOptional({ description: 'Clock-in location mode', enum: ['anywhere', 'specific_addresses', 'active_job_sites'] })
  @IsOptional()
  @IsEnum(['anywhere', 'specific_addresses', 'active_job_sites'])
  clock_in_mode?: string;

  @ApiPropertyOptional({ description: 'Action when outside geofence', enum: ['block', 'warn_only'] })
  @IsOptional()
  @IsEnum(['block', 'warn_only'])
  geofence_violation_action?: string;

  @ApiPropertyOptional({ description: 'Whether GPS is required' })
  @IsOptional()
  @IsBoolean()
  gps_required?: boolean;

  @ApiPropertyOptional({ description: 'Action when GPS unavailable', enum: ['block', 'allow_flagged'] })
  @IsOptional()
  @IsEnum(['block', 'allow_flagged'])
  gps_unavailable_action?: string;

  @ApiPropertyOptional({ description: 'Require project selection at clock-in' })
  @IsOptional()
  @IsBoolean()
  require_job_tag?: boolean;

  @ApiPropertyOptional({ description: 'Require task selection at clock-in' })
  @IsOptional()
  @IsBoolean()
  require_task_tag?: boolean;

  @ApiPropertyOptional({ description: 'Enable overtime calculation' })
  @IsOptional()
  @IsBoolean()
  overtime_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Daily overtime threshold in hours', example: 8.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtime_daily_threshold_hours?: number;

  @ApiPropertyOptional({ description: 'Weekly overtime threshold in hours', example: 40.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  overtime_weekly_threshold_hours?: number;

  @ApiPropertyOptional({ description: 'Overtime rate multiplier', example: 1.50 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(5)
  overtime_multiplier?: number;

  @ApiPropertyOptional({ description: 'Pay period type', enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'] })
  @IsOptional()
  @IsEnum(['weekly', 'biweekly', 'semimonthly', 'monthly'])
  pay_period_type?: string;

  @ApiPropertyOptional({ description: 'Pay period start day (0=Sun, 6=Sat)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  pay_period_start_day?: number;

  @ApiPropertyOptional({ description: 'Anchor date for biweekly pay period', example: '2026-01-06' })
  @IsOptional()
  @IsDateString()
  pay_period_anchor_date?: string;

  @ApiPropertyOptional({ description: 'Enable kiosk mode' })
  @IsOptional()
  @IsBoolean()
  kiosk_mode_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Minutes before shift to send reminder', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  shift_reminder_minutes?: number;

  @ApiPropertyOptional({ description: 'Minutes after shift start to mark as missed', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  missed_shift_threshold_minutes?: number;
}
```

**Response 200**: Full settings object (same shape as GET response).

**Errors**: 400 (validation), 401, 403

**Audit Log**: YES -- `logTenantChange({ action: existedBefore ? 'updated' : 'created', entityType: 'time_clock_settings', ... })`

---

#### POST /api/v1/time-clock/settings/kiosk-token/regenerate

**Roles**: `Owner`, `Admin`

**Description**: Generate a new kiosk token. Returns the plaintext token ONCE. The bcrypt hash is stored in `time_clock_settings.kiosk_token_hash`. Previous token becomes invalid immediately.

**Request**: No body.

**Response 201**:
```json
{
  "kiosk_token": "tc_k_a1b2c3d4e5f6g7h8i9j0..."
}
```

Token format: `tc_k_` prefix + 48 random bytes hex-encoded.

**Implementation**: If no `time_clock_settings` record exists yet, auto-create one with defaults first, then store the token hash. This avoids requiring the admin to save settings before generating a token.

**Errors**: 401, 403

**Audit Log**: YES -- `logTenantChange({ action: 'updated', entityType: 'time_clock_settings', description: 'Regenerated kiosk authentication token' })`

---

### 13.2 Employee Profile Endpoints (7)

---

#### GET /api/v1/time-clock/employees

**Roles**: `Owner`, `Admin`

**Description**: List all employee profiles for the tenant. Paginated.

**Query Parameters DTO** (`ListEmployeeProfilesDto`):

```typescript
export class ListEmployeeProfilesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Search by user name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
```

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "user_id": "uuid",
      "crew_member_id": "uuid or null",
      "hourly_rate": "25.00 or null",
      "overtime_rule_override": false,
      "overtime_daily_threshold_hours": null,
      "overtime_weekly_threshold_hours": null,
      "kiosk_pin_failed_attempts": 0,
      "kiosk_pin_locked_until": null,
      "is_active": true,
      "created_at": "2026-04-10T00:00:00.000Z",
      "updated_at": "2026-04-10T00:00:00.000Z",
      "user": {
        "id": "uuid",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com"
      },
      "crew_member": {
        "id": "uuid",
        "first_name": "John",
        "last_name": "Doe",
        "default_hourly_rate": "20.00"
      }
    }
  ],
  "meta": { "total": 15, "page": 1, "limit": 20, "totalPages": 1 }
}
```

NOTE: Never return `kiosk_pin_hash` or `push_subscription_json` in list responses. Use `select` to exclude sensitive fields.

**Errors**: 401, 403

**Audit Log**: No

---

#### POST /api/v1/time-clock/employees

**Roles**: `Owner`, `Admin`

**Description**: Create an employee profile. Links a user to the time clock system. (BR-013)

**Request Body DTO** (`CreateEmployeeProfileDto`):

```typescript
export class CreateEmployeeProfileDto {
  @ApiProperty({ description: 'User ID to create profile for' })
  @IsString()
  @IsUUID()
  user_id: string;

  @ApiPropertyOptional({ description: 'Crew member ID for labor cost linkage' })
  @IsOptional()
  @IsString()
  @IsUUID()
  crew_member_id?: string;

  @ApiPropertyOptional({ description: 'Override hourly rate', example: 25.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourly_rate?: number;

  @ApiPropertyOptional({ description: 'Use employee-level overtime thresholds' })
  @IsOptional()
  @IsBoolean()
  overtime_rule_override?: boolean;

  @ApiPropertyOptional({ description: 'Employee daily OT threshold', example: 8.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtime_daily_threshold_hours?: number;

  @ApiPropertyOptional({ description: 'Employee weekly OT threshold', example: 40.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  overtime_weekly_threshold_hours?: number;
}
```

**Response 201**: Full employee_profile object with user and crew_member includes.

**Implementation**:
- Validate `user` belongs to tenant (404 if not)
- Validate `crew_member` belongs to tenant (if provided, 404 if not)
- Auto-link: if `crew_member_id` not provided, check `crew_member` where `user_id = dto.user_id` and `tenant_id`. If found, auto-set.
- Reject duplicate: check unique constraint `[tenant_id, user_id]` (409)

**Errors**: 400, 401, 403, 404, 409 (duplicate)

**Business Rules**: BR-013

**Audit Log**: YES -- `logTenantChange({ action: 'created', entityType: 'employee_profile', ... })`

---

#### GET /api/v1/time-clock/employees/:id

**Roles**: `Owner`, `Admin`

**Path Parameters**: `id` (UUID) -- employee_profile.id

**Response 200**: Full employee_profile with user, crew_member, project_assignments includes.

**Errors**: 401, 403, 404

**Audit Log**: No

---

#### PATCH /api/v1/time-clock/employees/:id

**Roles**: `Owner`, `Admin`

**Path Parameters**: `id` (UUID)

**Request Body DTO** (`UpdateEmployeeProfileDto`):

```typescript
export class UpdateEmployeeProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  crew_member_id?: string;

  @ApiPropertyOptional({ example: 30.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourly_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overtime_rule_override?: boolean;

  @ApiPropertyOptional({ example: 8.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtime_daily_threshold_hours?: number;

  @ApiPropertyOptional({ example: 40.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  overtime_weekly_threshold_hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
```

**Response 200**: Updated employee_profile.

**Errors**: 400, 401, 403, 404

**Audit Log**: YES (action: 'updated', before/after)

---

#### POST /api/v1/time-clock/employees/:id/pin

**Roles**: `Owner`, `Admin`

**Path Parameters**: `id` (UUID)

**Request Body DTO** (`SetEmployeePinDto`):

```typescript
export class SetEmployeePinDto {
  @ApiProperty({ description: 'Kiosk PIN (4-6 digits)', example: '1234' })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin: string;
}
```

**Response 200**: `{ "message": "PIN updated successfully" }`

**Implementation**: Hash PIN with bcrypt (12 rounds). Store in `kiosk_pin_hash`. Reset `kiosk_pin_failed_attempts = 0`, `kiosk_pin_locked_until = null`.

**Errors**: 400, 401, 403, 404

**Audit Log**: YES (action: 'updated', description: 'Updated kiosk PIN for employee')

---

#### DELETE /api/v1/time-clock/employees/:id/pin

**Roles**: `Owner`, `Admin`

**Path Parameters**: `id` (UUID)

**Response 200**: `{ "message": "PIN removed successfully" }`

**Implementation**: Set `kiosk_pin_hash = null`, `kiosk_pin_failed_attempts = 0`, `kiosk_pin_locked_until = null`.

**Errors**: 401, 403, 404

**Audit Log**: YES (action: 'updated', description: 'Removed kiosk PIN for employee')

---

#### POST /api/v1/time-clock/employees/me/push-subscription

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Description**: Save web push subscription for the current user's employee profile.

**Request Body DTO** (`SavePushSubscriptionDto`):

```typescript
export class SavePushSubscriptionDto {
  @ApiProperty({ description: 'Web Push subscription JSON' })
  @IsString()
  @IsNotEmpty()
  push_subscription_json: string;
}
```

**Response 200**: `{ "message": "Push subscription saved" }`

**Errors**: 400, 401, 404 (no employee profile for this user)

**Audit Log**: No

---

### 13.3 Clock-In Address Endpoints (7)

---

#### GET /api/v1/time-clock/addresses

**Roles**: `Owner`, `Admin`

**Query Parameters DTO** (`ListClockinAddressesDto`):

```typescript
export class ListClockinAddressesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
```

**Response 200**: Paginated list with project include.

**Errors**: 401, 403

**Audit Log**: No

---

#### POST /api/v1/time-clock/addresses

**Roles**: `Owner`, `Admin`

**Description**: Create a clock-in address. Geocodes via GoogleMapsService. (BR-014)

**Request Body DTO** (`CreateClockinAddressDto`):

```typescript
export class CreateClockinAddressDto {
  @ApiProperty({ example: 'Home Depot Waltham' })
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: '100 Main St' })
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  address_line1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiProperty({ example: '02451' })
  @IsString()
  @MaxLength(10)
  @IsNotEmpty()
  zip_code: string;

  @ApiPropertyOptional({ example: 42.37627 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  latitude?: number;

  @ApiPropertyOptional({ example: -71.23567 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  longitude?: number;

  @ApiPropertyOptional({ default: 100, example: 150 })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;
}
```

**Response 201**: Full clockin_address object.

**Implementation**: Validate project if provided. Call `GoogleMapsService.validateAddress()`. Create with `source = 'manual'`.

**Errors**: 400, 401, 403, 404 (project), 422 (geocoding failed)

**Audit Log**: YES (action: 'created')

---

#### GET /api/v1/time-clock/addresses/:id

**Roles**: `Owner`, `Admin`

**Response 200**: Full clockin_address with project include.

**Errors**: 401, 403, 404

---

#### PATCH /api/v1/time-clock/addresses/:id

**Roles**: `Owner`, `Admin`

**Request Body DTO** (`UpdateClockinAddressDto`):

```typescript
export class UpdateClockinAddressDto {
  @ApiPropertyOptional({ example: 'Home Depot Waltham' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({ example: '100 Main St' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiPropertyOptional({ example: '02451' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  zip_code?: string;

  @ApiPropertyOptional({ example: 42.37627 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  latitude?: number;

  @ApiPropertyOptional({ example: -71.23567 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  longitude?: number;

  @ApiPropertyOptional({ default: 100, example: 150 })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
```

**Implementation**: Re-geocode via `GoogleMapsService.validateAddress()` if any of `address_line1`, `city`, `state`, `zip_code` changed. If only `radius_meters`, `label`, or `is_active` changed, skip geocoding.

**Errors**: 400, 401, 403, 404

**Audit Log**: YES (action: 'updated', before/after)

---

#### DELETE /api/v1/time-clock/addresses/:id

**Roles**: `Owner`, `Admin`

**Description**: Soft delete (sets `is_active = false`).

**Response 200**: `{ "message": "Address deactivated successfully" }`

**Errors**: 401, 403, 404

**Audit Log**: YES (action: 'deleted')

---

#### POST /api/v1/time-clock/addresses/import-from-quote

**Roles**: `Owner`, `Admin`

**Request Body DTO** (`ImportAddressFromQuoteDto`):

```typescript
export class ImportAddressFromQuoteDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  quote_id: string;

  @ApiProperty({ example: 'Job Site - Smith Kitchen' })
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;
}
```

**Response 201**: Full clockin_address with `source = 'imported_from_quote'`, `source_address_id = quote_jobsite_address.id`.

**Implementation**: Look up the quote by `quote_id` + `tenant_id`. The quote model has `jobsite_address_id` FK pointing to a single `quote_jobsite_address` record. Include the `jobsite_address` relation. Copy `address_line1`, `city`, `state`, `zip_code`, `latitude`, `longitude` from the jobsite address into the new `clockin_address`. Each quote has exactly ONE jobsite address.

```typescript
const quote = await this.prisma.quote.findFirst({
  where: { id: dto.quote_id, tenant_id: tenantId },
  include: { jobsite_address: true },
});
if (!quote || !quote.jobsite_address) throw new NotFoundException('Quote or jobsite address not found');
```

**Errors**: 400, 401, 403, 404 (quote not found or no jobsite address)

**Audit Log**: YES (action: 'created')

---

#### POST /api/v1/time-clock/addresses/import-from-lead

**Roles**: `Owner`, `Admin`

**Request Body DTO** (`ImportAddressFromLeadDto`):

```typescript
export class ImportAddressFromLeadDto {
  @ApiProperty({ description: 'ID of the lead_address record to import' })
  @IsString()
  @IsUUID()
  lead_address_id: string;

  @ApiProperty({ example: 'Job Site - Johnson' })
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;
}
```

**Response 201**: Full clockin_address with `source = 'imported_from_lead'`.

**IMPORTANT — `lead_address` has NO `tenant_id` column.** Unlike `quote_jobsite_address` (which has `tenant_id`), `lead_address` only has `lead_id`. To verify tenant ownership, join through `lead`:
```typescript
const leadAddress = await this.prisma.lead_address.findFirst({
  where: { id: dto.lead_address_id ?? undefined },
  include: { lead: true },
});
if (!leadAddress || leadAddress.lead.tenant_id !== tenantId) {
  throw new NotFoundException('Lead address not found');
}
```

**Errors**: 400, 401, 403, 404

**Audit Log**: YES (action: 'created')

---

### 13.4 Employee Project Assignment Endpoints (3)

---

#### GET /api/v1/time-clock/employee-projects

**Roles**: `Owner`, `Admin`

**Query Parameters DTO** (`ListEmployeeProjectAssignmentsDto`):

```typescript
export class ListEmployeeProjectAssignmentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

**Response 200**: Paginated list with employee_profile.user and project includes.

**Errors**: 401, 403

---

#### POST /api/v1/time-clock/employee-projects

**Roles**: `Owner`, `Admin`

**Request Body DTO** (`CreateEmployeeProjectAssignmentDto`):

```typescript
export class CreateEmployeeProjectAssignmentDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  project_id: string;
}
```

**Response 201**: Full assignment with includes.

**Implementation**: Validate both belong to tenant. Check unique constraint (409 if exists).

**Errors**: 400, 401, 403, 404, 409

---

#### DELETE /api/v1/time-clock/employee-projects/:id

**Roles**: `Owner`, `Admin`

**Response 200**: `{ "message": "Assignment removed successfully" }`

**Errors**: 401, 403, 404

---

### 13.5 Work Shift Endpoints (7)

---

#### GET /api/v1/time-clock/shifts

**Roles**: `Owner`, `Admin`, `Project Manager`

**Query Parameters DTO** (`ListWorkShiftsDto`):

```typescript
export class ListWorkShiftsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ enum: ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'])
  status?: string;
}
```

**Response 200**: Paginated list with employee_profile.user and project includes.

**Errors**: 401, 403

---

#### POST /api/v1/time-clock/shifts

**Roles**: `Owner`, `Admin`, `Project Manager`

**Request Body DTO** (`CreateWorkShiftDto`):

```typescript
export class CreateWorkShiftDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiProperty({ example: '2026-04-10T08:00:00.000Z' })
  @IsDateString()
  scheduled_start: string;

  @ApiProperty({ example: '2026-04-10T16:00:00.000Z' })
  @IsDateString()
  scheduled_end: string;

  @ApiPropertyOptional({ example: 'Morning shift' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
```

**Response 201**: Full work_shift with includes.

**Implementation**: Validate employee/project/task belong to tenant. Validate `scheduled_end > scheduled_start` (400). Create with `status = 'scheduled'`, `published_at = now()`.

**Errors**: 400 (end before start), 401, 403, 404

**Audit Log**: YES (action: 'created')

---

#### POST /api/v1/time-clock/shifts/bulk

**Roles**: `Owner`, `Admin`, `Project Manager`

**Request Body DTO** (`BulkCreateWorkShiftsDto`):

```typescript
export class BulkCreateWorkShiftsDto {
  @ApiProperty({ type: [CreateWorkShiftDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkShiftDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  shifts: CreateWorkShiftDto[];
}
```

**Response 201**: `{ "created": 5, "shifts": [...] }`

**Implementation**: Validate each. Reject entire batch if any fails. Use `prisma.$transaction()`.

**Errors**: 400, 401, 403, 404

**Audit Log**: YES (one per shift)

---

#### GET /api/v1/time-clock/shifts/:id

**Roles**: `Owner`, `Admin`, `Project Manager`

**Response 200**: Full work_shift with all includes.

**Errors**: 401, 403, 404

---

#### PATCH /api/v1/time-clock/shifts/:id

**Roles**: `Owner`, `Admin`, `Project Manager`

**Request Body DTO** (`UpdateWorkShiftDto`):

```typescript
export class UpdateWorkShiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({ example: '2026-04-10T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduled_start?: string;

  @ApiPropertyOptional({ example: '2026-04-10T16:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduled_end?: string;

  @ApiPropertyOptional({ example: 'Morning shift' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'])
  status?: string;
}
```

**Errors**: 400, 401, 403, 404

**Audit Log**: YES (action: 'updated', before/after)

---

#### DELETE /api/v1/time-clock/shifts/:id

**Roles**: `Owner`, `Admin`, `Project Manager`

**Description**: Hard delete. Only if `status = 'scheduled'` or `status = 'cancelled'`.

**Response 200**: `{ "message": "Shift deleted successfully" }`

**Errors**: 400 (cannot delete non-scheduled/cancelled), 401, 403, 404

**Audit Log**: YES (action: 'deleted')

---

#### GET /api/v1/time-clock/shifts/mine

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Description**: List the current user's own scheduled and past shifts. Paginated.

**Query Parameters DTO** (`ListMyWorkShiftsDto`):

```typescript
export class ListMyWorkShiftsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ enum: ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'])
  status?: string;
}
```

**Response 200**: Paginated list of shifts for the current user's employee profile. Includes project, task.

```json
{
  "data": [
    {
      "id": "uuid",
      "scheduled_start": "2026-04-10T08:00:00.000Z",
      "scheduled_end": "2026-04-10T16:00:00.000Z",
      "title": "Morning shift",
      "notes": null,
      "status": "scheduled",
      "project": { "id": "uuid", "name": "Kitchen Renovation", "project_number": "P-001" },
      "task": null,
      "published_at": "2026-04-09T12:00:00.000Z"
    }
  ],
  "meta": { "total": 10, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**Implementation**: Find `employee_profile` for `req.user.id` + `req.user.tenant_id` → 404 if not found. Filter shifts by `employee_profile_id`. Only return published shifts (`published_at IS NOT NULL`).

**Errors**: 401, 404 (no employee profile)

---

### 13.6 Clock Session Endpoints (10)

---

#### POST /api/v1/time-clock/sessions/clock-in

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Description**: Clock in. Enforces BR-001, BR-003, BR-004, BR-009.

**Request Body DTO** (`ClockInDto`):

```typescript
export class ClockInDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({ example: 42.37627 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  latitude?: number;

  @ApiPropertyOptional({ example: -71.23567 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  longitude?: number;

  @ApiPropertyOptional({ enum: ['browser_gps', 'native_gps', 'kiosk', 'manual'], default: 'browser_gps' })
  @IsOptional()
  @IsEnum(['browser_gps', 'native_gps', 'kiosk', 'manual'])
  location_source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

**Response 201**: Full clock_session with employee_profile, project, work_shift includes.

**Errors**: 400, 401, 403 (GPS/geofence blocked, inactive), 404, 409 (BR-001)

**Audit Log**: No

---

#### POST /api/v1/time-clock/sessions/clock-out

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Description**: Clock out. Enforces BR-005, BR-006.

**Request Body DTO** (`ClockOutDto`):

```typescript
export class ClockOutDto {
  @ApiPropertyOptional({ example: 42.37627 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  latitude?: number;

  @ApiPropertyOptional({ example: -71.23567 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  longitude?: number;

  @ApiPropertyOptional({ enum: ['browser_gps', 'native_gps', 'kiosk', 'manual'], default: 'browser_gps' })
  @IsOptional()
  @IsEnum(['browser_gps', 'native_gps', 'kiosk', 'manual'])
  location_source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

**Response 200**: Full completed clock_session with all computed fields.

**Errors**: 401, 404 (no active session)

**Audit Log**: No

---

#### GET /api/v1/time-clock/sessions

**Roles**: `Owner`, `Admin`, `Project Manager`, `Bookkeeper`

**Query Parameters DTO** (`ListClockSessionsDto`):

```typescript
export class ListClockSessionsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ enum: ['active', 'on_break', 'completed', 'flagged'] })
  @IsOptional()
  @IsEnum(['active', 'on_break', 'completed', 'flagged'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_flagged?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_manual_edit?: boolean;
}
```

**Response 200**: Paginated list with all includes.

**Errors**: 401, 403

---

#### GET /api/v1/time-clock/sessions/me/active

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Response 200**: Active clock_session or `null`.

**Errors**: 401, 404 (no employee profile)

---

#### GET /api/v1/time-clock/sessions/me/available-projects

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Purpose**: Returns projects the current employee can clock into, filtered by `clock_in_mode` setting (BR-015).

**Logic**:
1. Find `employee_profile` for current user → 404 if not found
2. Get `time_clock_settings` for tenant
3. If `clock_in_mode = 'anywhere'` or `'specific_addresses'`: return ALL active projects in tenant where `status IN ('planned', 'in_progress')`
4. If `clock_in_mode = 'active_job_sites'`: return UNION of:
   - Projects where `employee_project_assignment` exists for this employee
   - Projects where any `task_assignee` exists with matching user_id or crew_member_id
5. Filter to `project.status IN ('planned', 'in_progress')`

**Response 200**:
```json
{
  "data": [
    { "id": "uuid", "name": "Kitchen Remodel", "project_number": "P-001" }
  ]
}
```

**Errors**: 401, 404 (no employee profile)

---

#### GET /api/v1/time-clock/sessions/mine

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Description**: List the current user's own historical clock sessions. Paginated.

**Query Parameters DTO** (`ListMyClockSessionsDto`):

```typescript
export class ListMyClockSessionsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ['active', 'on_break', 'completed', 'flagged'] })
  @IsOptional()
  @IsEnum(['active', 'on_break', 'completed', 'flagged'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;
}
```

**Response 200**: Paginated list of sessions belonging to the current user's employee profile. Includes project, task, break_entries, work_shift. Same shape as `GET /sessions` response but filtered to `employee_profile.user_id = req.user.id`.

```json
{
  "data": [
    {
      "id": "uuid",
      "status": "completed",
      "clock_in_at": "2026-04-10T08:00:00.000Z",
      "clock_out_at": "2026-04-10T16:30:00.000Z",
      "total_worked_minutes": 480,
      "regular_minutes": 480,
      "overtime_minutes": 0,
      "is_flagged": false,
      "is_manual_edit": false,
      "project": { "id": "uuid", "name": "Kitchen Renovation" },
      "task": { "id": "uuid", "title": "Drywall" },
      "break_entries": [],
      "work_shift": null
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```

**Implementation**: Find `employee_profile` for `req.user.id` + `req.user.tenant_id` → 404 if not found. Filter sessions by `employee_profile_id`.

**Errors**: 401, 404 (no employee profile)

**Business Rules**: BR-016 (view_own permission)

---

#### GET /api/v1/time-clock/sessions/active/all

**Roles**: `Owner`, `Admin`, `Project Manager`

**Response 200**: `{ "data": [...], "total": 5 }`

---

#### GET /api/v1/time-clock/sessions/:id

**Roles**: `Owner`, `Admin`, `Project Manager`, `Bookkeeper`

**Response 200**: Full session with break_entries, edit_logs, disputes.

**Errors**: 401, 403, 404

---

#### PATCH /api/v1/time-clock/sessions/:id

**Roles**: `Owner`, `Admin`

**Description**: Manual edit. (BR-008)

**Request Body DTO** (`EditClockSessionDto`):

```typescript
export class EditClockSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clock_in_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clock_out_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ description: 'Reason for edit (mandatory)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
```

**Response 200**: Updated session with edit_logs.

**Implementation**: Create edit_log for each changed field. Set `is_manual_edit = true`. Recalculate minutes. Handle reconciliation flag.

**Errors**: 400 (no reason), 401, 403, 404

**Business Rules**: BR-008

**Audit Log**: YES

---

### 13.7 Break Endpoints (3)

---

#### POST /api/v1/time-clock/sessions/:id/breaks/start

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Request Body DTO** (`StartBreakDto`):

```typescript
export class StartBreakDto {
  @ApiPropertyOptional({ enum: ['paid', 'unpaid'], default: 'unpaid' })
  @IsOptional()
  @IsEnum(['paid', 'unpaid'])
  break_type?: string;

  @ApiPropertyOptional({ example: 'Lunch' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  break_label?: string;
}
```

**Response 201**: break_entry object.

**Implementation**: Session must be `active` (400). No active break (409). Create break, set session `status = 'on_break'`.

**Errors**: 400 (not active), 401, 403, 404, 409 (break in progress)

---

#### POST /api/v1/time-clock/sessions/:id/breaks/end

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Request**: No body.

**Response 200**: Ended break_entry with duration_minutes.

**Implementation**: Find active break (ended_at IS NULL). Set `ended_at = now()`, `duration_minutes`. Set session `status = 'active'`.

**Errors**: 401, 403, 404 (no active break)

---

#### GET /api/v1/time-clock/sessions/:id/breaks

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Response 200**: `{ "data": [...break_entries...] }`

**Errors**: 401, 403, 404

---

### 13.8 Dispute Endpoints (7)

---

#### POST /api/v1/time-clock/sessions/:id/disputes

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Request Body DTO** (`CreateTimeDisputeDto`):

```typescript
export class CreateTimeDisputeDto {
  @ApiProperty({ enum: ['flag_only', 'correction_request'] })
  @IsEnum(['flag_only', 'correction_request'])
  dispute_type: string;

  @ApiProperty({ example: 'I forgot to clock out' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  proposed_clock_in_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  proposed_clock_out_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  proposed_project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  proposed_task_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  proposed_notes?: string;
}
```

**Response 201**: Full dispute.

**Implementation**: Check no pending dispute (409). If `correction_request`: at least one proposed field required (400). Notify admins.

**Errors**: 400, 401, 403, 404, 409

**Business Rules**: BR-011

---

#### GET /api/v1/time-clock/disputes

**Roles**: `Owner`, `Admin`

**Query Parameters DTO** (`ListTimeDisputesDto`):

```typescript
export class ListTimeDisputesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected', 'resolved'] })
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected', 'resolved'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;
}
```

**Response 200**: Paginated with clock_session and submitted_by includes.

---

#### GET /api/v1/time-clock/disputes/mine

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Response 200**: Paginated, filtered by `submitted_by_user_id = req.user.id`.

---

#### GET /api/v1/time-clock/disputes/:id

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Implementation**: Employees can only view own disputes (403 otherwise).

---

#### PATCH /api/v1/time-clock/disputes/:id/approve

**Roles**: `Owner`, `Admin`

**Request Body DTO** (`ApproveDisputeDto`):

```typescript
export class ApproveDisputeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  review_notes?: string;
}
```

**Response 200**: Updated dispute + updated session.

**Implementation**: Apply proposed corrections, create edit_logs, recalculate, handle reconciliation. (BR-011)

**Errors**: 400 (not pending), 401, 403, 404

**Audit Log**: YES

---

#### PATCH /api/v1/time-clock/disputes/:id/reject

**Roles**: `Owner`, `Admin`

**Request Body DTO** (`RejectDisputeDto`):

```typescript
export class RejectDisputeDto {
  @ApiProperty({ description: 'Reason for rejection (mandatory)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  review_notes: string;
}
```

**Response 200**: Updated dispute.

**Errors**: 400 (not pending, missing notes), 401, 403, 404

**Audit Log**: YES

---

#### DELETE /api/v1/time-clock/disputes/:id

**Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`

**Description**: Cancel pending dispute. Sets `status = 'resolved'`.

**Implementation**: Only pending (400). Employee must be submitter (403).

**Response 200**: `{ "message": "Dispute cancelled" }`

---

### 13.9 Kiosk Endpoints (3 -- PUBLIC)

Use `@Public()` to bypass JWT. Use `KioskTokenGuard` for auth via `X-Kiosk-Token` header.

---

#### GET /api/v1/time-clock/kiosk/employees

**Auth**: `X-Kiosk-Token` header

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "user": { "first_name": "John", "last_name": "D." },
      "has_pin": true,
      "is_clocked_in": false
    }
  ]
}
```

Last name truncated to initial + period for privacy.

**Errors**: 401 (invalid token)

---

#### POST /api/v1/time-clock/kiosk/clock-in

**Auth**: `X-Kiosk-Token` + PIN

**Request Body DTO** (`KioskClockInDto`):

```typescript
export class KioskClockInDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  pin: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

**Response 201**: Clock session object.

**Implementation**: Validate PIN (bcrypt compare). Handle lockout (BR-007). Delegate to ClockSessionService with `location_source = 'kiosk'`.

**Errors**: 401 (PIN/token), 403 (locked), 404, 409 (already clocked in)

---

#### POST /api/v1/time-clock/kiosk/clock-out

**Auth**: `X-Kiosk-Token` + PIN

**Request Body DTO** (`KioskClockOutDto`):

```typescript
export class KioskClockOutDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  pin: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

**Response 200**: Completed session.

**Errors**: 401, 403 (locked), 404 (no active session)

---

### 13.10 Dashboard Endpoint (1)

---

#### GET /api/v1/time-clock/dashboard/whos-in

**Roles**: `Owner`, `Admin`, `Project Manager`

**Response 200**:
```json
{
  "total_clocked_in": 5,
  "total_on_break": 1,
  "employees": [
    {
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "session": {
        "id": "uuid",
        "status": "active",
        "clock_in_at": "2026-04-10T08:00:00.000Z",
        "elapsed_minutes": 240,
        "project": { "id": "uuid", "name": "Kitchen Renovation" },
        "task": { "id": "uuid", "title": "Drywall" },
        "clockin_address": { "label": "Home Depot Waltham" },
        "is_flagged": false,
        "current_break": null
      }
    }
  ]
}
```

**Errors**: 401, 403

---

### 13.11 Report Endpoints (6)

---

#### GET /api/v1/time-clock/reports/timesheet

**Roles**: `Owner`, `Admin`, `Project Manager`, `Bookkeeper`

**Query DTO** (`TimesheetReportDto`):

```typescript
export class TimesheetReportDto {
  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  date_from: string;

  @ApiProperty({ example: '2026-04-15' })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;
}
```

**Response 200**:
```json
{
  "date_from": "2026-04-01",
  "date_to": "2026-04-15",
  "employees": [
    {
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "total_regular_minutes": 2400,
      "total_overtime_minutes": 120,
      "total_sessions": 10,
      "days": [
        {
          "date": "2026-04-01",
          "sessions": [
            {
              "id": "uuid",
              "clock_in_at": "2026-04-01T08:00:00.000Z",
              "clock_out_at": "2026-04-01T16:30:00.000Z",
              "total_worked_minutes": 480,
              "regular_minutes": 480,
              "overtime_minutes": 0,
              "project": { "id": "uuid", "name": "Kitchen Renovation" },
              "task": null,
              "is_flagged": false,
              "is_manual_edit": false
            }
          ],
          "day_regular_minutes": 480,
          "day_overtime_minutes": 0,
          "day_total_minutes": 480
        }
      ]
    }
  ]
}
```

**Errors**: 400 (missing date_from/date_to), 401, 403

---

#### GET /api/v1/time-clock/reports/payroll

**Roles**: `Owner`, `Admin`, `Bookkeeper`

**Query DTO** (`PayrollReportDto`):

```typescript
export class PayrollReportDto {
  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  date_from: string;

  @ApiProperty({ example: '2026-04-15' })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;
}
```

**Response 200**:
```json
{
  "date_from": "2026-04-01",
  "date_to": "2026-04-15",
  "summary": {
    "total_employees": 5,
    "total_regular_hours": 320.5,
    "total_overtime_hours": 12.0,
    "total_regular_pay": 8012.50,
    "total_overtime_pay": 450.00,
    "total_pay": 8462.50
  },
  "employees": [
    {
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe", "email": "john@example.com" },
      "hourly_rate": 25.00,
      "regular_hours": 80.0,
      "overtime_hours": 4.0,
      "overtime_multiplier": 1.50,
      "regular_pay": 2000.00,
      "overtime_pay": 150.00,
      "total_pay": 2150.00,
      "sessions_count": 10,
      "flagged_sessions": 0,
      "manual_edits": 1
    }
  ]
}
```

**Errors**: 400, 401, 403

---

#### GET /api/v1/time-clock/reports/payroll/export

**Roles**: `Owner`, `Admin`, `Bookkeeper`

**Query Parameters**: Same as PayrollReportDto.

**Response 200**: CSV file download (`Content-Type: text/csv`, `Content-Disposition: attachment`).

**CSV Columns**: Employee Name, Employee ID, Hourly Rate, Regular Hours, Overtime Hours, Overtime Multiplier, Regular Pay, Overtime Pay, Total Pay, Sessions Count, Flagged Sessions, Manual Edits

**Audit Log**: YES (action: 'accessed', entityType: 'payroll_export')

---

#### GET /api/v1/time-clock/reports/shift-variance

**Roles**: `Owner`, `Admin`, `Project Manager`

**Query DTO** (`ShiftVarianceReportDto`):

```typescript
export class ShiftVarianceReportDto {
  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  date_from: string;

  @ApiProperty({ example: '2026-04-15' })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;
}
```

**Response 200**:
```json
{
  "date_from": "2026-04-01",
  "date_to": "2026-04-15",
  "data": [
    {
      "work_shift_id": "uuid",
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "project": { "id": "uuid", "name": "Kitchen Renovation" },
      "scheduled_start": "2026-04-01T08:00:00.000Z",
      "scheduled_end": "2026-04-01T16:00:00.000Z",
      "scheduled_minutes": 480,
      "actual_clock_in_at": "2026-04-01T08:12:00.000Z",
      "actual_clock_out_at": "2026-04-01T16:45:00.000Z",
      "actual_worked_minutes": 493,
      "variance_start_minutes": 12,
      "variance_end_minutes": 45,
      "variance_total_minutes": 13,
      "shift_status": "completed",
      "session_id": "uuid"
    }
  ],
  "meta": { "total": 25, "page": 1, "limit": 20, "totalPages": 2 }
}
```

**Note**: `variance_start_minutes` = positive means late, negative means early. `variance_total_minutes` = `actual_worked_minutes - scheduled_minutes` (positive = worked more, negative = worked less). Shifts with `status = 'missed'` have null actual fields and `session_id = null`.

**Errors**: 400, 401, 403

---

#### GET /api/v1/time-clock/reports/geo-violations

**Roles**: `Owner`, `Admin`

**Query DTO** (`GeoViolationsReportDto`):

```typescript
export class GeoViolationsReportDto {
  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  date_from: string;

  @ApiProperty({ example: '2026-04-15' })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

**Response 200**:
```json
{
  "data": [
    {
      "session_id": "uuid",
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "clock_in_at": "2026-04-05T08:15:00.000Z",
      "clock_in_latitude": 42.37627,
      "clock_in_longitude": -71.23567,
      "clock_in_geofence_status": "outside",
      "is_flagged": true,
      "flag_reason": "Outside all configured locations -- 350m from nearest",
      "nearest_address": { "id": "uuid", "label": "Home Depot Waltham", "distance_meters": 350 },
      "project": { "id": "uuid", "name": "Kitchen Renovation" },
      "status": "completed"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**Note**: `nearest_address` is computed at query time by re-running haversine against active addresses. If the address was deactivated since the session, `nearest_address` may be null.

**Errors**: 400, 401, 403

---

#### GET /api/v1/time-clock/reports/activity-feed

**Roles**: `Owner`, `Admin`, `Project Manager`

**Query DTO** (`ActivityFeedDto`):

```typescript
export class ActivityFeedDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  after?: string;
}
```

**Response 200**:
```json
{
  "data": [
    {
      "event_type": "clock_in",
      "timestamp": "2026-04-10T08:00:00.000Z",
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "session_id": "uuid",
      "project": { "id": "uuid", "name": "Kitchen Renovation" },
      "details": {}
    },
    {
      "event_type": "break_start",
      "timestamp": "2026-04-10T12:00:00.000Z",
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "session_id": "uuid",
      "project": null,
      "details": { "break_type": "unpaid", "break_label": "Lunch" }
    },
    {
      "event_type": "dispute_submitted",
      "timestamp": "2026-04-10T17:00:00.000Z",
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "Jane", "last_name": "Smith" },
      "session_id": "uuid",
      "project": null,
      "details": { "dispute_type": "correction_request", "dispute_id": "uuid" }
    }
  ]
}
```

**Event types**: `clock_in`, `clock_out`, `break_start`, `break_end`, `dispute_submitted`, `dispute_approved`, `dispute_rejected`, `manual_edit`, `shift_missed`

**Implementation**: Union query across `clock_session` (clock_in/out events from clock_in_at/clock_out_at), `break_entry` (start/end), `time_dispute` (created_at for submitted, reviewed_at for approved/rejected), `clock_session_edit_log` (edited_at for manual_edit). Sort by timestamp DESC. Use cursor-based pagination via `after` parameter.

**Errors**: 401, 403

---

## 14. Service Implementation Logic

### 14.1 GeofenceService

**File**: `api/src/modules/time-clock/services/geofence.service.ts`

**Constructor**: `private readonly prisma: PrismaService`

**Method: `checkGeofence()`**

```typescript
async checkGeofence(params: {
  tenantId: string;
  latitude: number;
  longitude: number;
  projectId?: string;
  clockInMode: string;
}): Promise<{
  geofence_status: string;
  clockin_address_id: string | null;
  nearest_distance_meters: number | null;
  flag_reason: string | null;
}>
```

**Logic**:
1. Query active clockin_addresses for tenant (and optionally project).
2. If none found: return `not_enforced`.
3. For each address, compute haversine distance.
4. If any inside radius: return `inside` + closest match.
5. If all outside: return `outside` + nearest distance + flag_reason.

**Haversine formula** (private helper):
```typescript
private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = lat1 * (Math.PI / 180);
  const phi2 = lat2 * (Math.PI / 180);
  const deltaPhi = (lat2 - lat1) * (Math.PI / 180);
  const deltaLambda = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(deltaPhi / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

---

### 14.2 OvertimeService

**File**: `api/src/modules/time-clock/services/overtime.service.ts`

**Constructor**: `private readonly prisma: PrismaService`

**Method: `calculateOvertime()`**

```typescript
async calculateOvertime(params: {
  tenantId: string;
  employeeProfileId: string;
  sessionId: string;
  totalWorkedMinutes: number;
  clockInAt: Date;
}): Promise<{ regular_minutes: number; overtime_minutes: number }>
```

**Logic**:
1. Resolve thresholds (employee override vs tenant settings).
2. If OT disabled: return all regular.
3. Get tenant timezone. Compute day/week boundaries.
4. Fetch prior completed sessions for same day (exclude current).
5. Fetch prior completed sessions for same week (exclude current).
6. Sum prior regular minutes.
7. `remainingDaily = max(0, dailyThreshold*60 - priorRegularToday)`
8. `remainingWeekly = max(0, weeklyThreshold*60 - priorRegularThisWeek)`
9. `regularMinutes = min(totalWorkedMinutes, remainingDaily, remainingWeekly)`
10. `overtimeMinutes = totalWorkedMinutes - regularMinutes`

---

### 14.3 LaborCostAttributionService

**File**: `api/src/modules/time-clock/services/labor-cost-attribution.service.ts`

**Constructor**: `PrismaService`, `NotificationsService`, `Logger`

**Method: `postLaborCost()`** -- see BR-005 for complete logic.

**CRITICAL**: Call `prisma.crew_hour_log.create()` DIRECTLY. Do NOT use `CrewHourLogService.logHours()` because it hardcodes `source: 'manual'`.

```typescript
const entry = await this.prisma.crew_hour_log.create({
  data: {
    tenant_id: session.tenant_id,
    crew_member_id: employeeProfile.crew_member_id,
    project_id: session.project_id,
    task_id: session.task_id ?? null,
    log_date: logDate, // clock_in_at date in tenant timezone
    hours_regular: (session.regular_minutes || 0) / 60,
    hours_overtime: (session.overtime_minutes || 0) / 60,
    source: 'clockin_system',
    clockin_event_id: session.id,
    notes: null,
    created_by_user_id: employeeProfile.user_id,
  },
});
```

On failure: log error, notify admin, do NOT throw.

---

### 14.4 ClockSessionService

**File**: `api/src/modules/time-clock/services/clock-session.service.ts`

**Constructor**: `PrismaService`, `GeofenceService`, `OvertimeService`, `LaborCostAttributionService`, `NotificationsService`

**clockIn()** -- see BR-001, BR-003, BR-004, BR-009 for complete flow.

**clockOut()** -- complete flow:
1. Find active/on_break session for this employee in tenant → 404 if none
2. If session `status = 'on_break'`: auto-end the active break (set `ended_at = now()`, compute `duration_minutes`)
3. Set `clock_out_at = now()`
4. Compute `total_worked_minutes`:
   ```
   total_worked_minutes = FLOOR((clock_out_at - clock_in_at) / 60000)
                        - SUM(duration_minutes) of all UNPAID break_entries
   ```
   Paid breaks are NOT subtracted. Result must be >= 0.
5. Calculate overtime via `OvertimeService` (BR-006)
6. Post labor cost via `LaborCostAttributionService` (BR-005) — non-blocking
7. Set `status = 'completed'`
8. If `work_shift_id` is set: update `work_shift.status = 'completed'`
9. Store clock-out GPS coordinates if provided (no geofence enforcement in Phase 1)
10. Return updated session

---

### 14.5 ClockSessionEditService

**File**: `api/src/modules/time-clock/services/clock-session-edit.service.ts`

**Constructor**: `PrismaService`, `OvertimeService`, `AuditLoggerService`, `NotificationsService`

For each changed field: create immutable `clock_session_edit_log`. Set `is_manual_edit = true`. Recalculate. Handle reconciliation.

---

### 14.6 TimeDisputeService

**File**: `api/src/modules/time-clock/services/time-dispute.service.ts`

**Constructor**: `PrismaService`, `ClockSessionEditService`, `NotificationsService`, `AuditLoggerService`

Approve: apply corrections via edit logs. Reject: require review_notes. Cancel: only pending, only submitter.

---

## 15. Background Jobs

### 15.1 TimeClockProcessor

**File**: `api/src/modules/time-clock/processors/time-clock.processor.ts`

```typescript
@Processor('time-clock')
export class TimeClockProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) { super(); }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case 'missed-shift-check': return this.handleMissedShiftCheck(job);
      case 'shift-reminder': return this.handleShiftReminder(job);
      default: this.logger.warn(`Unknown job: ${job.name}`);
    }
  }
}
```

### 15.2 Missed Shift Detector (BR-010)

Cron: `*/15 * * * *`. Multi-tenant, error-isolated.

Find `work_shift` where `status = scheduled` AND `scheduled_start < now() - threshold`. Check for matching sessions (by work_shift_id or within +/-2h window). Mark as missed. Notify admin + employee.

### 15.3 Shift Reminder

Cron: `* * * * *`. Multi-tenant, error-isolated.

Find `work_shift` where `status = scheduled` AND `scheduled_start` within reminder window AND `reminder_sent_at IS NULL`. Set `reminder_sent_at` BEFORE sending (prevent double-send). Notify employee.

### 15.4 TimeClockScheduler

**File**: `api/src/modules/time-clock/schedulers/time-clock.scheduler.ts`

```typescript
@Injectable()
export class TimeClockScheduler {
  constructor(
    @InjectQueue('time-clock') private readonly timeClockQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('*/15 * * * *')
  async missedShiftCheck() {
    await this.timeClockQueue.add('missed-shift-check', {}, {
      attempts: 3, backoff: { type: 'exponential', delay: 10000 },
    });
  }

  @Cron('* * * * *')
  async shiftReminder() {
    await this.timeClockQueue.add('shift-reminder', {}, {
      attempts: 2, backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
```

---

## 16. KioskTokenGuard

**File**: `api/src/modules/time-clock/guards/kiosk-token.guard.ts`

```typescript
@Injectable()
export class KioskTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-kiosk-token'];
    if (!token) throw new UnauthorizedException('Missing X-Kiosk-Token header');

    const settingsRecords = await this.prisma.time_clock_settings.findMany({
      where: { kiosk_mode_enabled: true, kiosk_token_hash: { not: null } },
      select: { tenant_id: true, kiosk_token_hash: true },
    });

    for (const settings of settingsRecords) {
      const isMatch = await bcrypt.compare(token, settings.kiosk_token_hash);
      if (isMatch) {
        request.kioskTenantId = settings.tenant_id;
        return true;
      }
    }

    throw new UnauthorizedException('Invalid kiosk token');
  }
}
```

**Usage**: `@Public() @UseGuards(KioskTokenGuard)` on KioskController. Access tenant via `req.kioskTenantId`.

---

## 17. Audit Log Requirements

| Action | entityType | action | Notes |
|--------|-----------|--------|-------|
| Settings created/updated | `time_clock_settings` | `created`/`updated` | before (if update), after |
| Kiosk token regenerated | `time_clock_settings` | `updated` | No before/after (security) |
| Employee profile created | `employee_profile` | `created` | after |
| Employee profile updated | `employee_profile` | `updated` | before, after |
| Employee PIN set/removed | `employee_profile` | `updated` | description only |
| Address created | `clockin_address` | `created` | after |
| Address updated | `clockin_address` | `updated` | before, after |
| Address soft-deleted | `clockin_address` | `deleted` | before |
| Session manually edited | `clock_session` | `updated` | before, after, metadata: edit_log_ids |
| Dispute approved | `time_dispute` | `updated` | before, after |
| Dispute rejected | `time_dispute` | `updated` | before, after |
| Shift created | `work_shift` | `created` | after |
| Shift updated | `work_shift` | `updated` | before, after |
| Shift deleted | `work_shift` | `deleted` | before |
| Payroll export | `payroll_export` | `accessed` | metadata: date_from, date_to |

---

## 17.1 Notification Event Table

All in-app notifications sent by the time clock module. Use `NotificationsService.createNotification()` with exact parameters below.

| Event | Trigger | Type String | Recipients | Title | Message Template | action_url |
|-------|---------|-------------|------------|-------|-----------------|------------|
| Geofence block | Clock-in blocked by geofence (BR-003, `block` mode) | `timeclock_geofence_block` | All tenant Admins | `"Geofence Block"` | `"{employee_name} was blocked from clocking in — {distance}m from nearest location ({address_label})"` | `/workforce/timesheets` |
| Geofence warning | Clock-in flagged by geofence (BR-003, `warn_only` mode) | `timeclock_geofence_warning` | All tenant Admins | `"Geofence Warning"` | `"{employee_name} clocked in outside all configured locations — {distance}m from nearest ({address_label})"` | `/workforce/timesheets` |
| GPS unavailable | Clock-in with GPS denied (BR-004, `allow_flagged` mode) | `timeclock_gps_unavailable` | All tenant Admins | `"GPS Unavailable"` | `"{employee_name} clocked in without GPS — session flagged for review"` | `/workforce/timesheets` |
| Labor cost failure | `crew_hour_log.create()` failed on clock-out (BR-005) | `timeclock_labor_cost_failed` | All tenant Admins | `"Labor Cost Error"` | `"Labor cost for {employee_name} session on {date} could not be posted — manual action required"` | `/workforce/timesheets` |
| Kiosk lockout | 5 wrong PIN attempts (BR-007) | `timeclock_kiosk_lockout` | All tenant Admins | `"Kiosk Lockout"` | `"{employee_name} has been locked out of kiosk after 5 failed PIN attempts"` | `/settings/time-clock` |
| Manual edit reconciliation | Session edited after labor cost posted (BR-008) | `timeclock_reconciliation_needed` | All tenant Admins | `"Reconciliation Needed"` | `"Clock session for {employee_name} on {date} was edited after labor cost was posted — manual reconciliation required"` | `/workforce/timesheets` |
| Missed shift — admin | Shift missed detection (BR-010) | `timeclock_missed_shift` | All tenant Admins | `"Missed Shift"` | `"{employee_name} has not clocked in — shift started {minutes_ago} minutes ago"` | `/workforce/timesheets` |
| Missed shift — employee | Shift missed detection (BR-010) | `timeclock_missed_shift` | Employee (user_id) | `"Missed Shift"` | `"You were marked as missed for your shift on {date} at {time}"` | `/workforce/my-shifts` |
| Shift reminder | Shift starting soon (background job) | `timeclock_shift_reminder` | Employee (user_id) | `"Upcoming Shift"` | `"Your shift starts in {minutes} minutes — {project_name}"` | `/workforce/my-shifts` |
| Dispute approved | Admin approves dispute (BR-011) | `timeclock_dispute_approved` | Employee (user_id) | `"Dispute Approved"` | `"Your time correction for {date} has been approved"` | `/workforce/my-hours` |
| Dispute rejected | Admin rejects dispute (BR-011) | `timeclock_dispute_rejected` | Employee (user_id) | `"Dispute Rejected"` | `"Your time correction for {date} was not approved. {review_notes}"` | `/workforce/my-hours` |
| Dispute submitted | Employee submits dispute (BR-011) | `timeclock_dispute_submitted` | All tenant Admins | `"New Time Dispute"` | `"{employee_name} submitted a {dispute_type} for {date}"` | `/workforce/disputes` |

**"All tenant Admins"** = query all users with `Owner` or `Admin` role in the tenant, send one notification per user via `createNotification({ user_id: adminUserId, ... })`.

**Template variables** (e.g., `{employee_name}`) are resolved at notification creation time and embedded directly in the `message` string. Do NOT store template variables — store the final rendered message.

**`related_entity_type` / `related_entity_id`**: Set `related_entity_type = 'clock_session'` and `related_entity_id = session.id` for all session-related notifications. For disputes, use `related_entity_type = 'time_dispute'`.

---

## 18. RBAC Seed Additions

Update `api/prisma/seeds/rbac.seed.ts`. Module `timeclock` already exists (sort_order: 11).

### 18.1 New Permission Actions

Add to `modulePermissions.timeclock` array (keep existing 5):

```typescript
timeclock: [
  // Existing
  { action: 'view', display_name: 'View Time Entries', description: 'View time clock entries' },
  { action: 'clock_in', display_name: 'Clock In', description: 'Clock in for work' },
  { action: 'clock_out', display_name: 'Clock Out', description: 'Clock out from work' },
  { action: 'edit', display_name: 'Edit Time Entries', description: 'Edit time clock entries' },
  { action: 'delete', display_name: 'Delete Time Entries', description: 'Delete time clock entries' },
  // NEW
  { action: 'manage_settings', display_name: 'Manage Time Clock Settings', description: 'Configure time clock tenant settings' },
  { action: 'manage_employees', display_name: 'Manage Employee Profiles', description: 'Create and manage employee time clock profiles' },
  { action: 'manage_addresses', display_name: 'Manage Clock-In Addresses', description: 'Create and manage geofence clock-in locations' },
  { action: 'manage_shifts', display_name: 'Manage Work Shifts', description: 'Create and manage scheduled work shifts' },
  { action: 'view_own', display_name: 'View Own Time Data', description: 'View own clock sessions and hours' },
  { action: 'view_all', display_name: 'View All Time Data', description: 'View all employee clock sessions and hours' },
  { action: 'edit_session', display_name: 'Edit Clock Sessions', description: 'Manually edit clock session times' },
  { action: 'submit_dispute', display_name: 'Submit Time Disputes', description: 'Submit time correction disputes' },
  { action: 'review_disputes', display_name: 'Review Time Disputes', description: 'Approve or reject time correction disputes' },
  { action: 'view_reports', display_name: 'View Time Reports', description: 'Access time clock reports and analytics' },
  { action: 'export_payroll', display_name: 'Export Payroll', description: 'Export payroll data to CSV' },
  { action: 'manage_kiosk', display_name: 'Manage Kiosk', description: 'Configure and manage kiosk mode' },
],
```

### 18.2 Role Template Permission Additions

**Project Manager** -- add:
```
'timeclock:view', 'timeclock:clock_in', 'timeclock:clock_out',
'timeclock:manage_shifts', 'timeclock:view_own', 'timeclock:view_all',
'timeclock:submit_dispute', 'timeclock:view_reports',
```

**Bookkeeper** -- add:
```
'timeclock:view', 'timeclock:view_all', 'timeclock:view_reports', 'timeclock:export_payroll',
```

**Employee** -- add (some may already exist):
```
'timeclock:view', 'timeclock:clock_in', 'timeclock:clock_out',
'timeclock:view_own', 'timeclock:submit_dispute',
```

**Owner** and **Admin** get ALL automatically.

---

## 19. Testing Requirements

### Unit Tests

- **GeofenceService**: haversine distance, inside/outside/not_enforced, multiple addresses
- **OvertimeService**: disabled, daily exceeded, weekly exceeded, both, prior sessions, employee override
- **LaborCostAttributionService**: success, skip null project, skip null crew_member, idempotency, failure handling
- **ClockSessionService**: clock-in success, BR-001 (409), BR-004 (403), BR-003 (geofence), BR-009 (shift match), clock-out with OT
- **KioskService**: valid PIN, invalid PIN, lockout after 5, lockout expiry

### Integration Tests

- Every API endpoint: success response shape, 401/403/404/409 cases, pagination, filtering

### Tenant Isolation Tests (MANDATORY)

- Create data in Tenant A, authenticate as Tenant B, verify no cross-tenant access

### RBAC Tests

- Owner/Admin can access all endpoints
- Employee gets 403 on admin endpoints
- Employee can only see own sessions/disputes

### Business Rule Tests

- BR-001: 409 on duplicate active session
- BR-003: geofence block vs warn_only
- BR-005: crew_hour_log created with `source = 'clockin_system'`
- BR-006: overtime split
- BR-007: PIN lockout
- BR-008: edit_log immutability, reconciliation flag
- BR-011: dispute lifecycle (submit, approve, reject, cancel)

---

## 20. Sprint Build Order

| Sprint | Focus | Endpoints | Dependencies |
|--------|-------|-----------|-------------|
| B-01 | Schema + migration + RBAC seed + module scaffold + Settings CRUD | 3 | None |
| B-02 | Employee Profiles CRUD + push subscription | 7 | B-01 |
| B-03 | Clock-in Addresses CRUD + import endpoints + GeofenceService | 7 | B-01, LeadsModule |
| B-04 | Employee-Project Assignments + Work Shifts CRUD + bulk + /shifts/mine | 10 | B-02 |
| B-05 | Clock Sessions (clock-in/out) + /sessions/mine + available-projects + OvertimeService + LaborCostAttributionService + Breaks | 13 | B-02, B-03, B-04 |
| B-06 | Manual Edit + Edit Log + Disputes lifecycle | 8 | B-05 |
| B-07 | KioskTokenGuard + Kiosk endpoints + Background Jobs | 3 + 2 jobs | B-05, B-04 |
| B-08 | Dashboard + Reports + Payroll Export | 7 | B-05, B-06 |
| | **Total** | **57 + 2 jobs** | |

### Sprint B-01 Checklist

- [ ] Add all 12 enums to schema.prisma
- [ ] Add all 10 models to schema.prisma
- [ ] Add relation fields to tenant, user, crew_member, project, project_task
- [ ] Migrate crew_hour_log.project_id to nullable
- [ ] Run `npx prisma migrate dev`
- [ ] Update rbac.seed.ts with new permissions (12 new actions)
- [ ] Update role template permissions (PM, Bookkeeper, Employee)
- [ ] Run seed
- [ ] Create module directory structure
- [ ] Implement TimeClockModule with all imports
- [ ] Register in AppModule
- [ ] Implement TimeClockSettingsService:
  - [ ] `getSettings()` — returns record or defaults with `id: null`
  - [ ] `upsertSettings()` — creates or updates
  - [ ] `regenerateKioskToken()` — generates `tc_k_` + 48 random hex, bcrypt hash, auto-creates settings if needed
- [ ] Implement TimeClockSettingsController (3 endpoints)
- [ ] Write tests
- [ ] `npm run lint` -- clean
- [ ] `npm run test` -- passing

### Sprint B-02 Checklist

- [ ] EmployeeProfileService (create with BR-013, findAll, findOne, update, setPin, removePin, pushSubscription)
- [ ] EmployeeProfileController (7 endpoints)
- [ ] All DTOs with validation (CreateEmployeeProfileDto, UpdateEmployeeProfileDto, SetEmployeePinDto, SavePushSubscriptionDto, ListEmployeeProfilesDto)
- [ ] Auto-link crew_member logic (BR-013)
- [ ] PIN hashing with bcrypt (12 rounds)
- [ ] Exclude `kiosk_pin_hash` and `push_subscription_json` from list responses
- [ ] Tests (unit + integration + tenant isolation)

### Sprint B-03 Checklist

- [ ] ClockinAddressService (create, findAll, findOne, update, softDelete, importFromQuote, importFromLead)
- [ ] ClockinAddressController (7 endpoints)
- [ ] Import LeadsModule for GoogleMapsService
- [ ] Import-from-quote: lookup via `quote.jobsite_address_id` FK (one address per quote)
- [ ] Import-from-lead: tenant ownership check via `lead_address.lead.tenant_id` join
- [ ] Re-geocode on address field changes only (not radius/label changes)
- [ ] GeofenceService with haversine distance calculation
- [ ] UpdateClockinAddressDto with all fields + `is_active`
- [ ] Tests for GeofenceService distance calculation
- [ ] Integration + tenant isolation tests

### Sprint B-04 Checklist

- [ ] EmployeeProjectAssignmentService + Controller (3 endpoints)
- [ ] WorkShiftService + Controller (6 endpoints including bulk + 1 /mine endpoint)
- [ ] GET /shifts/mine — employee's own shifts, filtered by employee_profile_id, published only
- [ ] ListMyWorkShiftsDto with date/status filters
- [ ] Validate scheduled_end > scheduled_start
- [ ] Bulk create with $transaction (reject entire batch on any validation failure)
- [ ] UpdateWorkShiftDto with all fields + status enum
- [ ] Tests

### Sprint B-05 Checklist

- [ ] OvertimeService (BR-006) — threshold resolution, daily/weekly capacity, split
- [ ] LaborCostAttributionService (BR-005) — direct Prisma call, `source: 'clockin_system'`
- [ ] ClockSessionService:
  - [ ] clockIn(): BR-001 (per-tenant 409), BR-003 (geofence), BR-004 (GPS denied), BR-009 (shift auto-match)
  - [ ] clockOut(): auto-end break (BR-016), compute minutes (subtract unpaid breaks only), BR-006 (OT), BR-005 (labor cost, non-blocking)
- [ ] BreakEntryService (BR-016: one active break, auto-end on clock-out, paid vs unpaid)
- [ ] ClockSessionController (10 endpoints):
  - [ ] POST /sessions/clock-in
  - [ ] POST /sessions/clock-out
  - [ ] GET /sessions (admin list)
  - [ ] GET /sessions/me/active
  - [ ] GET /sessions/me/available-projects (BR-015)
  - [ ] GET /sessions/mine (employee's own history)
  - [ ] GET /sessions/active/all
  - [ ] GET /sessions/:id
  - [ ] PATCH /sessions/:id
- [ ] BreakEntryController (3 endpoints)
- [ ] Verify crew_hour_log created with source='clockin_system'
- [ ] All notification events wired (see section 17.1)
- [ ] Tests for all business rules

### Sprint B-06 Checklist

- [ ] ClockSessionEditService (BR-008)
- [ ] TimeDisputeService (BR-011)
- [ ] TimeDisputeController (7 endpoints)
- [ ] Immutable edit_log creation (no update/delete)
- [ ] Dispute approve: apply corrections, create edit_logs, recalculate minutes
- [ ] Dispute reject: require review_notes (400 if empty)
- [ ] Dispute cancel: only pending, only submitter
- [ ] Reconciliation flag on edit when labor_cost_posted
- [ ] Notification events for dispute submitted/approved/rejected
- [ ] Tests

### Sprint B-07 Checklist

- [ ] KioskTokenGuard (bcrypt compare against all enabled tenants)
- [ ] KioskService (PIN validation, lockout after 5 attempts, 15-min lock duration)
- [ ] **Rate limiting**: 10 PIN attempts per minute per kiosk token (HTTP 429)
- [ ] KioskController (3 PUBLIC endpoints with @Public() + KioskTokenGuard)
- [ ] TimeClockProcessor + TimeClockScheduler
- [ ] Missed shift detector (BR-010) — every 15 min, per-tenant, with exact notification messages
- [ ] Shift reminder — every 1 min, prevent double-send via `reminder_sent_at`
- [ ] BullMQ queue registration (`time-clock`)
- [ ] Tests

### Sprint B-08 Checklist

- [ ] TimeClockDashboardService + Controller (1 endpoint)
- [ ] TimeClockReportsService + Controller (6 endpoints)
- [ ] Timesheet report: grouped by employee → date → sessions, with per-day and per-employee totals
- [ ] Payroll report: summary + per-employee breakdown with costs (hourly_rate * hours)
- [ ] CSV export with Content-Disposition header and all 12 columns
- [ ] Shift variance: per-shift actual vs scheduled comparison with signed variance minutes
- [ ] Geo-violations: paginated flagged sessions with nearest address (re-compute haversine at query time)
- [ ] Activity feed: union query across sessions, breaks, disputes, edit_logs, sorted DESC with cursor pagination
- [ ] Audit log for payroll export
- [ ] Tests

---

## 21. Important Implementation Notes

### Decimal Handling
Prisma returns `Decimal` objects. Convert to `Number()` for math:
```typescript
const rate = Number(profile.hourly_rate) || Number(profile.crew_member?.default_hourly_rate) || 0;
```

### Date Timezone Handling
`tenant.timezone` defaults to `"America/New_York"`. Convert UTC dates:
```typescript
function getDateInTimezone(utcDate: Date, timezone: string): Date {
  const dateStr = utcDate.toLocaleDateString('en-CA', { timeZone: timezone });
  return new Date(dateStr + 'T00:00:00.000Z');
}
```

### Error Response Format
NestJS default:
```json
{ "statusCode": 409, "message": "...", "error": "Conflict" }
```

### UUID / Token Generation
```typescript
import { randomBytes } from 'crypto';
const token = `tc_k_${randomBytes(48).toString('hex')}`;
```

### bcrypt Usage
```typescript
import * as bcrypt from 'bcrypt';
const hash = await bcrypt.hash(plaintext, 12);
const isMatch = await bcrypt.compare(plaintext, hash);
```

### Existing Enums (reference)
```prisma
enum project_status { planned, in_progress, on_hold, completed, canceled }
enum project_task_status { not_started, in_progress, blocked, done }
enum hour_log_source { manual, clockin_system }
```

### RBAC Role Names (EXACT)
`Owner`, `Admin`, `Estimator`, `Project Manager`, `Bookkeeper`, `Employee`, `Read-only`

### Role Access Matrix for Time Clock Module

| Role | Time Clock Access |
|------|------------------|
| **Owner** | Full access — all endpoints |
| **Admin** | Full access — all endpoints |
| **Project Manager** | Manage shifts, view all sessions/reports, clock in/out, submit disputes |
| **Bookkeeper** | View all sessions/reports, export payroll — read-only |
| **Employee** | Clock in/out, view own sessions/shifts, submit disputes |
| **Estimator** | **No time clock access** — not assigned any `timeclock:*` permissions. Returns 403 on all time clock endpoints. |
| **Read-only** | **No time clock access** — not assigned any `timeclock:*` permissions. Returns 403 on all time clock endpoints. |

**Note**: `Estimator` and `Read-only` roles are explicitly excluded from the time clock module. They do not receive any permissions in the RBAC seed. If future requirements change, add specific permissions to the seed file — do not add them to endpoint role decorators without updating the seed.

---

**End of Backend Implementation Guide**
