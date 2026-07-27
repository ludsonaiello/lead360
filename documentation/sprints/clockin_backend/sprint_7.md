# Sprint 7 — Work Shifts DTOs + Service + Controller
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_7.md
**Type:** Backend — CRUD
**Depends On:** Sprint 4
**Gate:** STOP — All 7 endpoints respond correctly before Sprint 9
**Estimated Complexity:** Medium

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts.

---

## Objective

Implement the complete Work Shifts CRUD (7 endpoints) including bulk creation, a "my shifts" endpoint for employees, and full audit logging. Shifts represent scheduled work periods for employees, optionally tied to projects and tasks.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 4 is complete (time-clock settings, module scaffold functional)
- [ ] Read `api/prisma/schema.prisma` — verify `work_shift` model exists with all fields, including `status` enum (`scheduled`, `in_progress`, `completed`, `missed`, `cancelled`)
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand current providers/controllers
- [ ] Read `api/src/modules/time-clock/services/employee-profile.service.ts` — understand employee profile lookup patterns
- [ ] Read `api/src/modules/audit/services/audit-logger.service.ts` — exact `logTenantChange()` signature
- [ ] Read any existing controller in the time-clock module — understand route prefix and guard pattern
- [ ] Read `api/src/modules/auth/guards/jwt-auth.guard.ts` and `api/src/modules/rbac/guards/roles.guard.ts`

---

## Environment

- **This project does NOT use PM2.**
- **Database credentials**: from `.env` file. Never hardcode.
- **Dev server**: `npm run start:dev` (watch mode)
- Port: 8000 | Prefix: api/v1 | Swagger: http://127.0.0.1:8000/api/docs
- Validation pipe: whitelist: true, forbidNonWhitelisted: true
- Tenant ID / User ID: ALWAYS from JWT, NEVER from body
- Every DB query MUST include tenant_id

---

## Dev Server

```
CHECK: lsof -i :8000
KILL if found: kill {PID} (then kill -9 if needed)
CONFIRM free: lsof -i :8000 → empty
START: cd /var/www/lead360.app/api && npm run start:dev
WAIT 60-120s for compile. Health check: curl -s http://localhost:8000/health → 200
KEEP running entire sprint. SHUTDOWN before marking complete.
```

**Test credentials:**
- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Tasks

### Task 1 — Work Shift DTOs

**What:** Create `api/src/modules/time-clock/dto/work-shift.dto.ts` with these DTOs:

**CreateWorkShiftDto:**
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsUUID, IsDateString, IsEnum,
  MaxLength, ValidateNested, ArrayMinSize, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkShiftDto {
  @ApiProperty({ description: 'Employee profile ID' })
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiPropertyOptional({ description: 'Project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Task ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiProperty({ description: 'Scheduled start time (ISO 8601)', example: '2026-04-10T08:00:00.000Z' })
  @IsDateString()
  scheduled_start: string;

  @ApiProperty({ description: 'Scheduled end time (ISO 8601)', example: '2026-04-10T17:00:00.000Z' })
  @IsDateString()
  scheduled_end: string;

  @ApiPropertyOptional({ description: 'Shift title', example: 'Morning Shift' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

**BulkCreateWorkShiftDto:**
```typescript
export class BulkCreateWorkShiftDto {
  @ApiProperty({ description: 'Array of shifts to create', type: [CreateWorkShiftDto] })
  @ValidateNested({ each: true })
  @Type(() => CreateWorkShiftDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  shifts: CreateWorkShiftDto[];
}
```

**UpdateWorkShiftDto:**
```typescript
export class UpdateWorkShiftDto {
  @ApiPropertyOptional({ description: 'Employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional({ description: 'Project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Task ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({ description: 'Scheduled start time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduled_start?: string;

  @ApiPropertyOptional({ description: 'Scheduled end time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduled_end?: string;

  @ApiPropertyOptional({ description: 'Shift title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Shift status', enum: ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'])
  status?: string;
}
```

**ListWorkShiftsDto (query params):**
```typescript
import { IsOptional, IsInt, Min, Max, IsUUID, IsString, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ description: 'Filter by employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Filter shifts starting from this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Filter shifts ending before this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'])
  status?: string;
}
```

**ListMyShiftsDto (query params — same as ListWorkShiftsDto but without employee_profile_id):**
```typescript
export class ListMyShiftsDto {
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

  @ApiPropertyOptional({ description: 'Filter shifts starting from this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Filter shifts ending before this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'])
  status?: string;
}
```

**Acceptance:** File compiles with zero TypeScript errors.
**Do NOT:** Add fields not listed above.

---

### Task 2 — WorkShiftService

**What:** Create or replace `api/src/modules/time-clock/services/work-shift.service.ts` with full implementation.

**Imports required:**
```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateWorkShiftDto,
  BulkCreateWorkShiftDto,
  UpdateWorkShiftDto,
  ListWorkShiftsDto,
  ListMyShiftsDto,
} from '../dto/work-shift.dto';
```

**Constructor injection:**
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLogger: AuditLoggerService,
) {}
```

**Methods (7 total):**

#### Method 1: `findAll(tenantId: string, query: ListWorkShiftsDto)`

```typescript
async findAll(tenantId: string, query: ListWorkShiftsDto) {
  const { page = 1, limit = 20, employee_profile_id, project_id, date_from, date_to, status } = query;
  const skip = (page - 1) * limit;

  const where: any = { tenant_id: tenantId };

  if (employee_profile_id) where.employee_profile_id = employee_profile_id;
  if (project_id) where.project_id = project_id;
  if (status) where.status = status;

  if (date_from || date_to) {
    where.scheduled_start = {};
    if (date_from) where.scheduled_start.gte = new Date(date_from);
    if (date_to) where.scheduled_start.lte = new Date(date_to);
  }

  const [data, total] = await Promise.all([
    this.prisma.work_shift.findMany({
      where,
      include: {
        employee_profile: {
          include: {
            user: { select: { id: true, first_name: true, last_name: true, email: true } },
          },
        },
        project: { select: { id: true, name: true } },
      },
      orderBy: { scheduled_start: 'asc' },
      skip,
      take: limit,
    }),
    this.prisma.work_shift.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
```

**Key:** Paginated. Filters by employee_profile_id, project_id, status, and date range on `scheduled_start`. Includes `employee_profile.user` and `project`.

---

#### Method 2: `create(tenantId: string, userId: string, dto: CreateWorkShiftDto)`

```typescript
async create(tenantId: string, userId: string, dto: CreateWorkShiftDto) {
  // 1. Validate scheduled_end > scheduled_start
  const startDate = new Date(dto.scheduled_start);
  const endDate = new Date(dto.scheduled_end);
  if (endDate <= startDate) {
    throw new BadRequestException('scheduled_end must be after scheduled_start');
  }

  // 2. Validate employee_profile belongs to tenant
  const employeeProfile = await this.prisma.employee_profile.findFirst({
    where: { id: dto.employee_profile_id, tenant_id: tenantId },
  });
  if (!employeeProfile) {
    throw new NotFoundException('Employee profile not found');
  }

  // 3. Validate project belongs to tenant (if provided)
  if (dto.project_id) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.project_id, tenant_id: tenantId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  // 4. Validate task belongs to tenant (if provided)
  if (dto.task_id) {
    const task = await this.prisma.project_task.findFirst({
      where: { id: dto.task_id, tenant_id: tenantId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
  }

  // 5. Create shift with status='scheduled', published_at=now()
  const shift = await this.prisma.work_shift.create({
    data: {
      tenant_id: tenantId,
      employee_profile_id: dto.employee_profile_id,
      project_id: dto.project_id || null,
      task_id: dto.task_id || null,
      scheduled_start: startDate,
      scheduled_end: endDate,
      title: dto.title || null,
      notes: dto.notes || null,
      status: 'scheduled',
      published_at: new Date(),
      created_by_user_id: userId,
    },
    include: {
      employee_profile: {
        include: {
          user: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      },
      project: { select: { id: true, name: true } },
    },
  });

  // 6. Audit log
  await this.auditLogger.logTenantChange({
    action: 'created',
    entityType: 'work_shift',
    entityId: shift.id,
    tenantId,
    actorUserId: userId,
    after: shift,
    description: `Created work shift for employee`,
  });

  return shift;
}
```

**Key:** Validate `end > start` (400 if not). Validate employee, project, task belong to tenant. Status = 'scheduled'. Set `published_at = now()`. Audit log.

---

#### Method 3: `bulkCreate(tenantId: string, userId: string, dto: BulkCreateWorkShiftDto)`

```typescript
async bulkCreate(tenantId: string, userId: string, dto: BulkCreateWorkShiftDto) {
  // 1. Validate every shift in the array BEFORE creating any
  for (const shiftDto of dto.shifts) {
    const startDate = new Date(shiftDto.scheduled_start);
    const endDate = new Date(shiftDto.scheduled_end);
    if (endDate <= startDate) {
      throw new BadRequestException(
        `scheduled_end must be after scheduled_start for shift with employee_profile_id ${shiftDto.employee_profile_id}`,
      );
    }

    // Validate employee_profile
    const employeeProfile = await this.prisma.employee_profile.findFirst({
      where: { id: shiftDto.employee_profile_id, tenant_id: tenantId },
    });
    if (!employeeProfile) {
      throw new NotFoundException(
        `Employee profile not found: ${shiftDto.employee_profile_id}`,
      );
    }

    // Validate project
    if (shiftDto.project_id) {
      const project = await this.prisma.project.findFirst({
        where: { id: shiftDto.project_id, tenant_id: tenantId },
      });
      if (!project) {
        throw new NotFoundException(`Project not found: ${shiftDto.project_id}`);
      }
    }

    // Validate task
    if (shiftDto.task_id) {
      const task = await this.prisma.project_task.findFirst({
        where: { id: shiftDto.task_id, tenant_id: tenantId },
      });
      if (!task) {
        throw new NotFoundException(`Task not found: ${shiftDto.task_id}`);
      }
    }
  }

  // 2. Create all shifts in a transaction — reject entire batch if any fails
  const shifts = await this.prisma.$transaction(
    dto.shifts.map((shiftDto) =>
      this.prisma.work_shift.create({
        data: {
          tenant_id: tenantId,
          employee_profile_id: shiftDto.employee_profile_id,
          project_id: shiftDto.project_id || null,
          task_id: shiftDto.task_id || null,
          scheduled_start: new Date(shiftDto.scheduled_start),
          scheduled_end: new Date(shiftDto.scheduled_end),
          title: shiftDto.title || null,
          notes: shiftDto.notes || null,
          status: 'scheduled',
          published_at: new Date(),
          created_by_user_id: userId,
        },
        include: {
          employee_profile: {
            include: {
              user: { select: { id: true, first_name: true, last_name: true, email: true } },
            },
          },
          project: { select: { id: true, name: true } },
        },
      }),
    ),
  );

  // 3. Audit log per shift
  for (const shift of shifts) {
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'work_shift',
      entityId: shift.id,
      tenantId,
      actorUserId: userId,
      after: shift,
      description: `Created work shift (bulk) for employee`,
    });
  }

  return { created: shifts.length, shifts };
}
```

**Key:** Validate ALL shifts first, reject entire batch if any fails. Use `prisma.$transaction()` for atomicity. ArrayMinSize(1), ArrayMaxSize(50). Audit per shift. Return `{ created: N, shifts: [...] }`.

---

#### Method 4: `findOne(tenantId: string, id: string)`

```typescript
async findOne(tenantId: string, id: string) {
  const shift = await this.prisma.work_shift.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      employee_profile: {
        include: {
          user: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      },
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  if (!shift) {
    throw new NotFoundException('Work shift not found');
  }

  return shift;
}
```

---

#### Method 5: `update(tenantId: string, userId: string, id: string, dto: UpdateWorkShiftDto)`

```typescript
async update(tenantId: string, userId: string, id: string, dto: UpdateWorkShiftDto) {
  const existing = await this.prisma.work_shift.findFirst({
    where: { id, tenant_id: tenantId },
  });
  if (!existing) {
    throw new NotFoundException('Work shift not found');
  }

  // Validate end > start if both provided (or mixed with existing)
  const startDate = dto.scheduled_start ? new Date(dto.scheduled_start) : existing.scheduled_start;
  const endDate = dto.scheduled_end ? new Date(dto.scheduled_end) : existing.scheduled_end;
  if (endDate <= startDate) {
    throw new BadRequestException('scheduled_end must be after scheduled_start');
  }

  // Validate employee if changing
  if (dto.employee_profile_id) {
    const ep = await this.prisma.employee_profile.findFirst({
      where: { id: dto.employee_profile_id, tenant_id: tenantId },
    });
    if (!ep) throw new NotFoundException('Employee profile not found');
  }

  // Validate project if changing
  if (dto.project_id) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.project_id, tenant_id: tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  // Validate task if changing
  if (dto.task_id) {
    const task = await this.prisma.project_task.findFirst({
      where: { id: dto.task_id, tenant_id: tenantId },
    });
    if (!task) throw new NotFoundException('Task not found');
  }

  const updateData: Record<string, any> = {};
  if (dto.employee_profile_id !== undefined) updateData.employee_profile_id = dto.employee_profile_id;
  if (dto.project_id !== undefined) updateData.project_id = dto.project_id;
  if (dto.task_id !== undefined) updateData.task_id = dto.task_id;
  if (dto.scheduled_start !== undefined) updateData.scheduled_start = new Date(dto.scheduled_start);
  if (dto.scheduled_end !== undefined) updateData.scheduled_end = new Date(dto.scheduled_end);
  if (dto.title !== undefined) updateData.title = dto.title;
  if (dto.notes !== undefined) updateData.notes = dto.notes;
  if (dto.status !== undefined) updateData.status = dto.status;

  const updated = await this.prisma.work_shift.update({
    where: { id },
    data: updateData,
    include: {
      employee_profile: {
        include: {
          user: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      },
      project: { select: { id: true, name: true } },
    },
  });

  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'work_shift',
    entityId: id,
    tenantId,
    actorUserId: userId,
    before: existing,
    after: updated,
    description: `Updated work shift`,
  });

  return updated;
}
```

**Key:** Validate end > start if both provided (compare with existing values for partial updates). Audit.

---

#### Method 6: `remove(tenantId: string, userId: string, id: string)`

```typescript
async remove(tenantId: string, userId: string, id: string) {
  const shift = await this.prisma.work_shift.findFirst({
    where: { id, tenant_id: tenantId },
  });
  if (!shift) {
    throw new NotFoundException('Work shift not found');
  }

  // Only allow delete if status is 'scheduled' or 'cancelled'
  if (shift.status !== 'scheduled' && shift.status !== 'cancelled') {
    throw new BadRequestException(`Cannot delete shift with status ${shift.status}`);
  }

  await this.prisma.work_shift.delete({ where: { id } });

  await this.auditLogger.logTenantChange({
    action: 'deleted',
    entityType: 'work_shift',
    entityId: id,
    tenantId,
    actorUserId: userId,
    before: shift,
    description: `Deleted work shift`,
  });

  return { message: 'Shift deleted successfully' };
}
```

**Key:** Only allow delete if status is `'scheduled'` or `'cancelled'`. Otherwise return 400 "Cannot delete shift with status {status}". Hard delete. Audit.

---

#### Method 7: `findMine(tenantId: string, userId: string, query: ListMyShiftsDto)`

```typescript
async findMine(tenantId: string, userId: string, query: ListMyShiftsDto) {
  const { page = 1, limit = 20, date_from, date_to, status } = query;
  const skip = (page - 1) * limit;

  // 1. Find employee_profile by user_id + tenant_id
  const employeeProfile = await this.prisma.employee_profile.findFirst({
    where: { user_id: userId, tenant_id: tenantId },
  });
  if (!employeeProfile) {
    throw new NotFoundException('No employee profile found for current user');
  }

  // 2. Build query — only return published shifts
  const where: any = {
    tenant_id: tenantId,
    employee_profile_id: employeeProfile.id,
    published_at: { not: null },
  };

  if (status) where.status = status;

  if (date_from || date_to) {
    where.scheduled_start = {};
    if (date_from) where.scheduled_start.gte = new Date(date_from);
    if (date_to) where.scheduled_start.lte = new Date(date_to);
  }

  const [data, total] = await Promise.all([
    this.prisma.work_shift.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { scheduled_start: 'asc' },
      skip,
      take: limit,
    }),
    this.prisma.work_shift.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
```

**Key:** Look up employee_profile by `req.user.id` + `tenant_id` (404 if not found). Only return shifts where `published_at IS NOT NULL`. Include `project` and `task`. Accessible by Employee role.

---

### Task 3 — WorkShiftController

**What:** Create or replace `api/src/modules/time-clock/controllers/work-shift.controller.ts`.

**CRITICAL ROUTE ORDER:** `/shifts/mine` and `/shifts/bulk` MUST be defined BEFORE any `/:id` routes. NestJS matches routes top-to-bottom — if `/:id` comes first, "mine" and "bulk" will be interpreted as UUID parameters and fail.

```typescript
@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkShiftController {
  constructor(private readonly workShiftService: WorkShiftService) {}

  // ──── STATIC ROUTES FIRST (before /:id) ────────────────────────

  @Get('shifts/mine')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @ApiOperation({ summary: 'Get my scheduled shifts' })
  async findMine(@Request() req, @Query() query: ListMyShiftsDto) {
    return this.workShiftService.findMine(req.user.tenant_id, req.user.id, query);
  }

  @Post('shifts/bulk')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Bulk create work shifts' })
  async bulkCreate(@Request() req, @Body() dto: BulkCreateWorkShiftDto) {
    return this.workShiftService.bulkCreate(req.user.tenant_id, req.user.id, dto);
  }

  // ──── COLLECTION ROUTES ────────────────────────────────────────

  @Get('shifts')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'List work shifts' })
  async findAll(@Request() req, @Query() query: ListWorkShiftsDto) {
    return this.workShiftService.findAll(req.user.tenant_id, query);
  }

  @Post('shifts')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Create work shift' })
  async create(@Request() req, @Body() dto: CreateWorkShiftDto) {
    return this.workShiftService.create(req.user.tenant_id, req.user.id, dto);
  }

  // ──── PARAMETERIZED ROUTES LAST ────────────────────────────────

  @Get('shifts/:id')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Get work shift by ID' })
  async findOne(@Request() req, @Param('id') id: string) {
    return this.workShiftService.findOne(req.user.tenant_id, id);
  }

  @Patch('shifts/:id')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Update work shift' })
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateWorkShiftDto) {
    return this.workShiftService.update(req.user.tenant_id, req.user.id, id, dto);
  }

  @Delete('shifts/:id')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Delete work shift' })
  async remove(@Request() req, @Param('id') id: string) {
    return this.workShiftService.remove(req.user.tenant_id, req.user.id, id);
  }
}
```

**CRITICAL:** The order above is NOT optional. `/shifts/mine` and `/shifts/bulk` MUST appear before `/shifts/:id`, `/shifts/:id` (PATCH), and `/shifts/:id` (DELETE). If you reorder these routes, "mine" and "bulk" will 404 or match as `:id` params.

---

### Task 4 — Update Module Registration

**What:** Update `time-clock.module.ts` to register `WorkShiftService` and `WorkShiftController`.

---

### Task 5 — Verify All 7 Endpoints

Test with JWT from admin login. Verify:

1. `GET /api/v1/time-clock/shifts` — returns paginated list with employee and project includes
   - Test filter by `employee_profile_id`
   - Test filter by `project_id`
   - Test filter by `status=scheduled`
   - Test filter by `date_from` and `date_to`
2. `POST /api/v1/time-clock/shifts` — creates single shift
   - Test with valid data → 201 with status='scheduled' and published_at set
   - Test with end < start → 400
   - Test with invalid employee_profile_id → 404
3. `POST /api/v1/time-clock/shifts/bulk` — bulk creates shifts
   - Test with 2 valid shifts → `{ created: 2, shifts: [...] }`
   - Test with 1 invalid in batch → entire batch rejected
   - Test with empty array → validation error (ArrayMinSize)
   - Test with >50 shifts → validation error (ArrayMaxSize)
4. `GET /api/v1/time-clock/shifts/:id` — returns full shift with includes
5. `PATCH /api/v1/time-clock/shifts/:id` — updates shift, validates end > start
6. `DELETE /api/v1/time-clock/shifts/:id` — deletes shift
   - Test with status='scheduled' → success
   - Test with status='in_progress' → 400 "Cannot delete shift with status in_progress"
7. `GET /api/v1/time-clock/shifts/mine` — returns current user's published shifts
   - Test returns only published shifts (published_at not null)
   - Test includes project and task
   - Test accessible by Employee role

---

## Integration Points
- `PrismaService` — `api/src/core/database/prisma.service.ts`
- `AuditLoggerService` — `api/src/modules/audit/services/audit-logger.service.ts`

---

## Business Rules Enforced in This Sprint
- **Scheduling**: All shifts created with status='scheduled' and published_at=now()
- **Validation**: scheduled_end MUST be after scheduled_start
- **Bulk atomicity**: Bulk create validates ALL first, creates in transaction, rejects entire batch on any failure
- **Delete guard**: Only shifts with status 'scheduled' or 'cancelled' can be deleted
- **Employee visibility**: /shifts/mine only returns published shifts, accessible by all roles including Employee
- **Route order**: Static routes (/mine, /bulk) must precede parameterized routes (/:id)

---

## Acceptance Criteria
- [ ] 5 DTOs created with full validation (CreateWorkShiftDto, BulkCreateWorkShiftDto, UpdateWorkShiftDto, ListWorkShiftsDto, ListMyShiftsDto)
- [ ] WorkShiftService with 7 methods (findAll, create, bulkCreate, findOne, update, remove, findMine)
- [ ] WorkShiftController with 7 endpoints in correct route order
- [ ] scheduled_end > scheduled_start validated on create and update
- [ ] Bulk create uses $transaction, rejects entire batch on failure
- [ ] Delete only allowed for 'scheduled' or 'cancelled' status
- [ ] /shifts/mine accessible by Employee role, returns only published shifts
- [ ] Audit logs for create (single + bulk), update, delete
- [ ] All Prisma queries include `tenant_id` filter
- [ ] `npm run lint` passes
- [ ] No frontend code modified
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — All 7 endpoints must respond correctly before Sprint 9 begins.

---

## Handoff Notes
- `work_shift` records are used by Sprint 9 (ClockSessionService) to match clock-in events against scheduled shifts
- `work_shift` records are used by the missed shift detector background job (Sprint 10) to flag shifts that were never started
- `/shifts/mine` is the primary endpoint used by the employee mobile UI to view their schedule
- The `status` field transitions: scheduled → in_progress → completed (or missed/cancelled) — managed by ClockSessionService on clock-in/out
