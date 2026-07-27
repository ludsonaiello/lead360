# Sprint 6 — Employee-Project Assignments DTOs + Service + Controller
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_6.md
**Type:** Backend — CRUD
**Depends On:** Sprint 4
**Gate:** NONE
**Estimated Complexity:** Low

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts.

---

## Objective

Implement the complete Employee-Project Assignment CRUD (3 endpoints) for the Time Clock module. This sprint adds the ability to assign employees to projects, which is used by the clock-in flow to determine project-scoped geofencing and shift matching.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 4 is complete (time-clock settings, module scaffold functional)
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand current providers/controllers
- [ ] Read `api/prisma/schema.prisma` — verify `employee_project_assignment` model exists with all fields, unique constraint on `[tenant_id, employee_profile_id, project_id]`
- [ ] Read `api/src/modules/time-clock/services/employee-profile.service.ts` — understand service patterns
- [ ] Read any existing controller in the time-clock module — understand route prefix and guard pattern

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

### Task 1 — Employee-Project Assignment DTOs

**What:** Create `api/src/modules/time-clock/dto/employee-project-assignment.dto.ts` with these DTOs:

**ListEmployeeProjectAssignmentsDto (query params):**
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListEmployeeProjectAssignmentsDto {
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
}
```

**CreateEmployeeProjectAssignmentDto:**
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateEmployeeProjectAssignmentDto {
  @ApiProperty({ description: 'Employee profile ID to assign' })
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiProperty({ description: 'Project ID to assign to' })
  @IsString()
  @IsUUID()
  project_id: string;
}
```

**Acceptance:** File compiles with zero TypeScript errors.
**Do NOT:** Add fields not listed above.

---

### Task 2 — EmployeeProjectAssignmentService

**What:** Create or replace `api/src/modules/time-clock/services/employee-project-assignment.service.ts` with full implementation.

**Imports required:**
```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../core/database';
import {
  ListEmployeeProjectAssignmentsDto,
  CreateEmployeeProjectAssignmentDto,
} from '../dto/employee-project-assignment.dto';
```

**Constructor injection:**
```typescript
constructor(private readonly prisma: PrismaService) {}
```

**Methods (3 total):**

#### Method 1: `findAll(tenantId: string, query: ListEmployeeProjectAssignmentsDto)`

```typescript
async findAll(tenantId: string, query: ListEmployeeProjectAssignmentsDto) {
  const { page = 1, limit = 50, employee_profile_id, project_id } = query;
  const skip = (page - 1) * limit;

  const where: any = { tenant_id: tenantId };

  if (employee_profile_id) {
    where.employee_profile_id = employee_profile_id;
  }

  if (project_id) {
    where.project_id = project_id;
  }

  const [data, total] = await Promise.all([
    this.prisma.employee_project_assignment.findMany({
      where,
      include: {
        employee_profile: {
          include: {
            user: { select: { id: true, first_name: true, last_name: true, email: true } },
          },
        },
        project: { select: { id: true, name: true } },
      },
      orderBy: { assigned_at: 'desc' },
      skip,
      take: limit,
    }),
    this.prisma.employee_project_assignment.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

**Key:** Always include `tenant_id` in `where`. Include `employee_profile.user` (id, first_name, last_name, email) and `project` (id, name). Paginated response with `meta`. Default limit = 50, max = 100.

---

#### Method 2: `create(tenantId: string, userId: string, dto: CreateEmployeeProjectAssignmentDto)`

```typescript
async create(tenantId: string, userId: string, dto: CreateEmployeeProjectAssignmentDto) {
  // 1. Validate employee_profile belongs to tenant
  const employeeProfile = await this.prisma.employee_profile.findFirst({
    where: { id: dto.employee_profile_id, tenant_id: tenantId },
  });
  if (!employeeProfile) {
    throw new NotFoundException('Employee profile not found');
  }

  // 2. Validate project belongs to tenant
  const project = await this.prisma.project.findFirst({
    where: { id: dto.project_id, tenant_id: tenantId },
  });
  if (!project) {
    throw new NotFoundException('Project not found');
  }

  // 3. Check unique constraint [tenant_id, employee_profile_id, project_id]
  const existing = await this.prisma.employee_project_assignment.findFirst({
    where: {
      tenant_id: tenantId,
      employee_profile_id: dto.employee_profile_id,
      project_id: dto.project_id,
    },
  });
  if (existing) {
    throw new ConflictException('Employee is already assigned to this project');
  }

  // 4. Create assignment
  const assignment = await this.prisma.employee_project_assignment.create({
    data: {
      tenant_id: tenantId,
      employee_profile_id: dto.employee_profile_id,
      project_id: dto.project_id,
      assigned_by_user_id: userId,
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

  return assignment;
}
```

**Key:** Validate both `employee_profile` and `project` belong to tenant (404 if not). Check unique constraint on `[tenant_id, employee_profile_id, project_id]` (409 if duplicate). Set `assigned_by_user_id` = `req.user.id` from JWT.

---

#### Method 3: `remove(tenantId: string, id: string)`

```typescript
async remove(tenantId: string, id: string) {
  // 1. Find by id + tenant_id
  const assignment = await this.prisma.employee_project_assignment.findFirst({
    where: { id, tenant_id: tenantId },
  });
  if (!assignment) {
    throw new NotFoundException('Assignment not found');
  }

  // 2. Hard delete
  await this.prisma.employee_project_assignment.delete({
    where: { id },
  });

  return { message: 'Assignment removed successfully' };
}
```

**Key:** Hard delete (not soft delete). Find by `id` + `tenant_id` first (404 if not found). Return confirmation message.

---

### Task 3 — EmployeeProjectAssignmentController

**What:** Create or replace `api/src/modules/time-clock/controllers/employee-project-assignment.controller.ts`.

```typescript
@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeProjectAssignmentController {
  constructor(
    private readonly assignmentService: EmployeeProjectAssignmentService,
  ) {}

  @Get('employee-projects')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List employee-project assignments' })
  async findAll(@Request() req, @Query() query: ListEmployeeProjectAssignmentsDto) {
    return this.assignmentService.findAll(req.user.tenant_id, query);
  }

  @Post('employee-projects')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Assign employee to project' })
  async create(@Request() req, @Body() dto: CreateEmployeeProjectAssignmentDto) {
    return this.assignmentService.create(req.user.tenant_id, req.user.id, dto);
  }

  @Delete('employee-projects/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Remove employee-project assignment' })
  async remove(@Request() req, @Param('id') id: string) {
    return this.assignmentService.remove(req.user.tenant_id, id);
  }
}
```

---

### Task 4 — Update Module Registration

**What:** Update `time-clock.module.ts` to register `EmployeeProjectAssignmentService` and `EmployeeProjectAssignmentController`.

---

### Task 5 — Verify All 3 Endpoints

Test with JWT from admin login. Verify:

1. `GET /api/v1/time-clock/employee-projects` — returns paginated list with `employee_profile.user` and `project` includes
   - Test filter by `employee_profile_id` query param
   - Test filter by `project_id` query param
   - Test pagination (page, limit)
2. `POST /api/v1/time-clock/employee-projects` — creates assignment
   - Test with valid employee_profile_id + project_id → 201
   - Test with invalid employee_profile_id → 404
   - Test with invalid project_id → 404
   - Test duplicate assignment → 409 "Employee is already assigned to this project"
3. `DELETE /api/v1/time-clock/employee-projects/:id` — hard deletes assignment
   - Test with valid id → `{ message: "Assignment removed successfully" }`
   - Test with invalid id → 404

---

## Integration Points
- `PrismaService` — `api/src/core/database/prisma.service.ts`

---

## Acceptance Criteria
- [ ] 2 DTOs created with full validation (ListEmployeeProjectAssignmentsDto, CreateEmployeeProjectAssignmentDto)
- [ ] EmployeeProjectAssignmentService with 3 methods (findAll, create, remove)
- [ ] EmployeeProjectAssignmentController with 3 endpoints
- [ ] Employee profile and project validated as belonging to tenant (404)
- [ ] Duplicate [tenant_id, employee_profile_id, project_id] returns 409
- [ ] Hard delete on remove
- [ ] `assigned_by_user_id` set from JWT
- [ ] All Prisma queries include `tenant_id` filter
- [ ] `npm run lint` passes
- [ ] No frontend code modified
- [ ] Dev server shut down before sprint is marked complete

---

## Handoff Notes
- `employee_project_assignment` is used by the clock-in flow (Sprint 9) to scope geofencing to project-specific addresses
- `employee_project_assignment` is used by the shift assignment flow (Sprint 7) to validate employee can be assigned shifts on a project
- The list endpoint provides the UI data for managing which employees work on which projects
