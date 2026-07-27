# Sprint 5 — Clock-In Addresses CRUD + Import Endpoints + GeofenceService
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_5.md
**Type:** Backend — CRUD + Utility
**Depends On:** Sprint 2
**Gate:** STOP — All 7 endpoints respond correctly, GeofenceService haversine verified
**Estimated Complexity:** Medium

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts.

---

## Objective

Implement the full CRUD for `clockin_address` (7 endpoints), including two import endpoints (from quote and from lead), and the `GeofenceService` with Haversine-based distance checking. All endpoints require Owner or Admin role. All address creation/import flows geocode via `GoogleMapsService.validateAddress()`.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 2 is complete (employee profiles working, module compiles)
- [ ] Read `api/prisma/schema.prisma` — understand `clockin_address` model, relations to `project`, `tenant`, `user`, `clock_session`
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand current module imports (LeadsModule already imported from Sprint 1)
- [ ] Read `api/src/modules/leads/services/google-maps.service.ts` — understand `validateAddress()` signature and return shape
- [ ] Read `api/src/modules/audit/services/audit-logger.service.ts` — exact `logTenantChange()` signature
- [ ] Read `api/src/modules/time-clock/controllers/time-clock-settings.controller.ts` — understand controller patterns (guards, decorators, `@Request() req`)
- [ ] Read `api/src/modules/time-clock/services/time-clock-settings.service.ts` — understand service patterns (PrismaService injection, audit logging)
- [ ] Read `api/prisma/schema.prisma` — understand `quote` model and `jobsite_address` relation
- [ ] Read `api/prisma/schema.prisma` — understand `lead_address` model and `lead` relation (note: `lead_address` has NO `tenant_id` column)

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

### Task 1 — Create Clock-In Address DTOs

**What:** Create `api/src/modules/time-clock/dto/clockin-address.dto.ts` with all 5 DTOs.

**CreateClockinAddressDto:**
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsBoolean, IsInt, IsUUID,
  MinLength, MaxLength, Min, Max, IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateClockinAddressDto {
  @ApiProperty({ description: 'Human-readable label for this address', example: 'Main Office' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @ApiProperty({ description: 'Street address line 1', example: '123 Main St' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address_line1: string;

  @ApiPropertyOptional({ description: 'Street address line 2 (apt, suite, etc.)', example: 'Suite 200' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Austin' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'US state abbreviation (2 characters)', example: 'TX' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiProperty({ description: 'ZIP code', example: '78701' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  zip_code: string;

  @ApiPropertyOptional({ description: 'Latitude override (skip geocoding if provided with longitude)' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude override (skip geocoding if provided with latitude)' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Geofence radius in meters (default: 100)', example: 100 })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;

  @ApiPropertyOptional({ description: 'Link to a project ID' })
  @IsOptional()
  @IsUUID()
  project_id?: string;
}
```

**UpdateClockinAddressDto:**
```typescript
export class UpdateClockinAddressDto {
  @ApiPropertyOptional({ description: 'Human-readable label', example: 'Main Office' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({ description: 'Street address line 1', example: '123 Main St' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address_line1?: string;

  @ApiPropertyOptional({ description: 'Street address line 2', example: 'Suite 200' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Austin' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'US state abbreviation', example: 'TX' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiPropertyOptional({ description: 'ZIP code', example: '78701' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  zip_code?: string;

  @ApiPropertyOptional({ description: 'Geofence radius in meters', example: 150 })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;

  @ApiPropertyOptional({ description: 'Whether this address is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Link to a project ID' })
  @IsOptional()
  @IsUUID()
  project_id?: string;
}
```

**ListClockinAddressesDto (query params):**
```typescript
export class ListClockinAddressesDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Search by label (contains match)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
```

**ImportAddressFromQuoteDto:**
```typescript
export class ImportAddressFromQuoteDto {
  @ApiProperty({ description: 'Quote ID to import jobsite address from' })
  @IsUUID()
  quote_id: string;

  @ApiProperty({ description: 'Human-readable label for the imported address', example: 'Quote #1042 Jobsite' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @ApiPropertyOptional({ description: 'Link to a project ID' })
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Geofence radius in meters (default: 100)', example: 100 })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;
}
```

**ImportAddressFromLeadDto:**
```typescript
export class ImportAddressFromLeadDto {
  @ApiProperty({ description: 'Lead address ID to import from' })
  @IsUUID()
  lead_address_id: string;

  @ApiProperty({ description: 'Human-readable label for the imported address', example: 'Lead - John Doe Residence' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @ApiPropertyOptional({ description: 'Link to a project ID' })
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Geofence radius in meters (default: 100)', example: 100 })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;
}
```

**Acceptance:** File compiles with zero TypeScript errors.
**Do NOT:** Add fields not listed above.

---

### Task 2 — Implement ClockinAddressService

**What:** Create or replace `api/src/modules/time-clock/services/clockin-address.service.ts` with full implementation.

**Imports required:**
```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { GoogleMapsService } from '../../leads/services/google-maps.service';
import {
  CreateClockinAddressDto,
  UpdateClockinAddressDto,
  ListClockinAddressesDto,
  ImportAddressFromQuoteDto,
  ImportAddressFromLeadDto,
} from '../dto/clockin-address.dto';
```

**Constructor injection:**
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLogger: AuditLoggerService,
  private readonly googleMapsService: GoogleMapsService,
) {}
```

**Methods (7 total):**

#### Method 1: `list(tenantId: string, dto: ListClockinAddressesDto)`

```typescript
async list(tenantId: string, dto: ListClockinAddressesDto) {
  const { page = 1, limit = 20, project_id, is_active, search } = dto;
  const skip = (page - 1) * limit;

  const where: any = { tenant_id: tenantId };

  if (typeof is_active === 'boolean') {
    where.is_active = is_active;
  }

  if (project_id) {
    where.project_id = project_id;
  }

  if (search) {
    where.label = { contains: search };
  }

  const [data, total] = await Promise.all([
    this.prisma.clockin_address.findMany({
      where,
      include: { project: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    this.prisma.clockin_address.count({ where }),
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

**Key:** Always include `tenant_id` in `where`. Search matches `label` using `contains`. Include `project` relation (id + name only). Paginated response with `meta`.

---

#### Method 2: `create(tenantId: string, userId: string, dto: CreateClockinAddressDto)`

```typescript
async create(tenantId: string, userId: string, dto: CreateClockinAddressDto) {
  // 1. Validate project belongs to tenant (if provided)
  if (dto.project_id) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.project_id, tenant_id: tenantId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  // 2. Geocode via GoogleMapsService
  const validated = await this.googleMapsService.validateAddress({
    address_line1: dto.address_line1,
    address_line2: dto.address_line2,
    city: dto.city,
    state: dto.state,
    zip_code: dto.zip_code,
  });

  // 3. Create the record
  const address = await this.prisma.clockin_address.create({
    data: {
      tenant_id: tenantId,
      label: dto.label,
      address_line1: validated.address_line1,
      address_line2: dto.address_line2 || null,
      city: validated.city,
      state: validated.state,
      zip_code: validated.zip_code,
      latitude: validated.latitude,
      longitude: validated.longitude,
      radius_meters: dto.radius_meters ?? 100,
      source: 'manual',
      project_id: dto.project_id || null,
      created_by_user_id: userId,
    },
    include: { project: { select: { id: true, name: true } } },
  });

  // 4. Audit log
  await this.auditLogger.logTenantChange({
    action: 'created',
    entityType: 'clockin_address',
    entityId: address.id,
    tenantId,
    actorUserId: userId,
    after: address,
    description: `Created clock-in address: ${address.label}`,
  });

  return address;
}
```

**Key:** Source is always `'manual'` for direct creation. Use validated/geocoded coordinates from GoogleMapsService. Store `validated.address_line1`, `validated.city`, `validated.state`, `validated.zip_code` (Google-normalized values). Keep `address_line2` from the original DTO.

---

#### Method 3: `findOne(tenantId: string, id: string)`

```typescript
async findOne(tenantId: string, id: string) {
  const address = await this.prisma.clockin_address.findFirst({
    where: { id, tenant_id: tenantId },
    include: { project: { select: { id: true, name: true } } },
  });

  if (!address) {
    throw new NotFoundException('Clock-in address not found');
  }

  return address;
}
```

**Key:** Always filter by `tenant_id`. Include `project` relation.

---

#### Method 4: `update(tenantId: string, userId: string, id: string, dto: UpdateClockinAddressDto)`

```typescript
async update(tenantId: string, userId: string, id: string, dto: UpdateClockinAddressDto) {
  // 1. Find existing record
  const existing = await this.prisma.clockin_address.findFirst({
    where: { id, tenant_id: tenantId },
  });
  if (!existing) {
    throw new NotFoundException('Clock-in address not found');
  }

  // 2. Validate project belongs to tenant (if project_id is being changed)
  if (dto.project_id !== undefined && dto.project_id !== null) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.project_id, tenant_id: tenantId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  // 3. Determine if re-geocoding is needed
  // Re-geocode ONLY if address_line1, city, state, or zip_code changed
  // Skip geocoding for radius/label/is_active only changes
  const addressFieldsChanged =
    (dto.address_line1 !== undefined && dto.address_line1 !== existing.address_line1) ||
    (dto.city !== undefined && dto.city !== existing.city) ||
    (dto.state !== undefined && dto.state !== existing.state) ||
    (dto.zip_code !== undefined && dto.zip_code !== existing.zip_code);

  let geocodeData: Record<string, any> = {};

  if (addressFieldsChanged) {
    const validated = await this.googleMapsService.validateAddress({
      address_line1: dto.address_line1 ?? existing.address_line1,
      address_line2: dto.address_line2 ?? existing.address_line2,
      city: dto.city ?? existing.city,
      state: dto.state ?? existing.state,
      zip_code: dto.zip_code ?? existing.zip_code,
    });

    geocodeData = {
      address_line1: validated.address_line1,
      city: validated.city,
      state: validated.state,
      zip_code: validated.zip_code,
      latitude: validated.latitude,
      longitude: validated.longitude,
    };
  }

  // 4. Build update data — only include fields that were provided
  const updateData: Record<string, any> = {};

  if (dto.label !== undefined) updateData.label = dto.label;
  if (dto.address_line2 !== undefined) updateData.address_line2 = dto.address_line2;
  if (dto.radius_meters !== undefined) updateData.radius_meters = dto.radius_meters;
  if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
  if (dto.project_id !== undefined) updateData.project_id = dto.project_id;

  const updated = await this.prisma.clockin_address.update({
    where: { id },
    data: { ...updateData, ...geocodeData },
    include: { project: { select: { id: true, name: true } } },
  });

  // 5. Audit log
  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'clockin_address',
    entityId: id,
    tenantId,
    actorUserId: userId,
    before: existing,
    after: updated,
    description: `Updated clock-in address: ${updated.label}`,
  });

  return updated;
}
```

**Key:** Re-geocode ONLY when address_line1, city, state, or zip_code changes. Skip geocoding for radius-only, label-only, or is_active-only changes.

---

#### Method 5: `softDelete(tenantId: string, userId: string, id: string)`

```typescript
async softDelete(tenantId: string, userId: string, id: string) {
  const existing = await this.prisma.clockin_address.findFirst({
    where: { id, tenant_id: tenantId },
  });
  if (!existing) {
    throw new NotFoundException('Clock-in address not found');
  }

  await this.prisma.clockin_address.update({
    where: { id },
    data: { is_active: false },
  });

  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'clockin_address',
    entityId: id,
    tenantId,
    actorUserId: userId,
    before: existing,
    after: { ...existing, is_active: false },
    description: `Deactivated clock-in address: ${existing.label}`,
  });

  return { message: 'Address deactivated successfully' };
}
```

**Key:** Soft-delete means set `is_active = false`, NOT a hard delete. Return confirmation message.

---

#### Method 6: `importFromQuote(tenantId: string, userId: string, dto: ImportAddressFromQuoteDto)`

```typescript
async importFromQuote(tenantId: string, userId: string, dto: ImportAddressFromQuoteDto) {
  // 1. Look up quote + jobsite address
  const quote = await this.prisma.quote.findFirst({
    where: { id: dto.quote_id, tenant_id: tenantId },
    include: { jobsite_address: true },
  });

  if (!quote) {
    throw new NotFoundException('Quote not found');
  }
  if (!quote.jobsite_address) {
    throw new BadRequestException('Quote does not have a jobsite address');
  }

  // 2. Validate project if provided
  if (dto.project_id) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.project_id, tenant_id: tenantId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  const jobsite = quote.jobsite_address;

  // 3. Create the clock-in address with data from jobsite
  const address = await this.prisma.clockin_address.create({
    data: {
      tenant_id: tenantId,
      label: dto.label,
      address_line1: jobsite.address_line1,
      address_line2: jobsite.address_line2 || null,
      city: jobsite.city,
      state: jobsite.state,
      zip_code: jobsite.zip_code,
      latitude: jobsite.latitude,
      longitude: jobsite.longitude,
      radius_meters: dto.radius_meters ?? 100,
      source: 'imported_from_quote',
      source_address_id: jobsite.id,
      project_id: dto.project_id || null,
      created_by_user_id: userId,
    },
    include: { project: { select: { id: true, name: true } } },
  });

  // 4. Audit log
  await this.auditLogger.logTenantChange({
    action: 'created',
    entityType: 'clockin_address',
    entityId: address.id,
    tenantId,
    actorUserId: userId,
    after: address,
    description: `Imported clock-in address from quote: ${address.label}`,
  });

  return address;
}
```

**Key:** Source = `'imported_from_quote'`. Set `source_address_id` = jobsite_address.id. Copy all address fields from jobsite.

---

#### Method 7: `importFromLead(tenantId: string, userId: string, dto: ImportAddressFromLeadDto)`

**CRITICAL:** `lead_address` has NO `tenant_id` column. Tenant validation must join through the `lead` relation.

```typescript
async importFromLead(tenantId: string, userId: string, dto: ImportAddressFromLeadDto) {
  // 1. Look up lead_address — MUST join through lead to verify tenant_id
  const leadAddress = await this.prisma.lead_address.findFirst({
    where: { id: dto.lead_address_id },
    include: { lead: true },
  });

  if (!leadAddress || leadAddress.lead.tenant_id !== tenantId) {
    throw new NotFoundException('Lead address not found');
  }

  // 2. Validate project if provided
  if (dto.project_id) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.project_id, tenant_id: tenantId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  // 3. Create the clock-in address with data from lead address
  const address = await this.prisma.clockin_address.create({
    data: {
      tenant_id: tenantId,
      label: dto.label,
      address_line1: leadAddress.address_line1,
      address_line2: leadAddress.address_line2 || null,
      city: leadAddress.city,
      state: leadAddress.state,
      zip_code: leadAddress.zip_code,
      latitude: leadAddress.latitude,
      longitude: leadAddress.longitude,
      radius_meters: dto.radius_meters ?? 100,
      source: 'imported_from_lead',
      source_address_id: leadAddress.id,
      project_id: dto.project_id || null,
      created_by_user_id: userId,
    },
    include: { project: { select: { id: true, name: true } } },
  });

  // 4. Audit log
  await this.auditLogger.logTenantChange({
    action: 'created',
    entityType: 'clockin_address',
    entityId: address.id,
    tenantId,
    actorUserId: userId,
    after: address,
    description: `Imported clock-in address from lead: ${address.label}`,
  });

  return address;
}
```

**Key:** `lead_address` has NO `tenant_id`. Must `findFirst` by `id` with `include: { lead: true }`, then verify `leadAddress.lead.tenant_id !== tenantId` → 404. Source = `'imported_from_lead'`.

---

### Task 3 — Implement GeofenceService

**What:** Create `api/src/modules/time-clock/services/geofence.service.ts`.

**Constructor:**
```typescript
@Injectable()
export class GeofenceService {
  constructor(private readonly prisma: PrismaService) {}
```

**Method: `checkGeofence(params)`**

```typescript
async checkGeofence(params: {
  tenantId: string;
  latitude: number;
  longitude: number;
  projectId?: string;
  clockInMode?: string;
}): Promise<{
  geofence_status: string;
  clockin_address_id: string | null;
  nearest_distance_meters: number | null;
  flag_reason: string | null;
}> {
  const { tenantId, latitude, longitude, projectId } = params;

  // 1. Query active addresses for tenant, optionally filtered by project
  const addresses = await this.prisma.clockin_address.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      ...(projectId ? { OR: [{ project_id: null }, { project_id: projectId }] } : {}),
    },
  });

  // 2. If no addresses configured, geofencing is not enforced
  if (addresses.length === 0) {
    return {
      geofence_status: 'not_enforced',
      clockin_address_id: null,
      nearest_distance_meters: null,
      flag_reason: null,
    };
  }

  // 3. Calculate distance to each address using haversine
  let closestInside: { id: string; distance: number } | null = null;
  let nearestDistance = Infinity;

  for (const addr of addresses) {
    if (addr.latitude === null || addr.longitude === null) continue;

    const distance = this.haversineDistance(
      latitude,
      longitude,
      Number(addr.latitude),
      Number(addr.longitude),
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
    }

    if (distance <= addr.radius_meters) {
      if (!closestInside || distance < closestInside.distance) {
        closestInside = { id: addr.id, distance };
      }
    }
  }

  // 4. If any address is within radius, return 'inside'
  if (closestInside) {
    return {
      geofence_status: 'inside',
      clockin_address_id: closestInside.id,
      nearest_distance_meters: Math.round(closestInside.distance),
      flag_reason: null,
    };
  }

  // 5. All outside
  return {
    geofence_status: 'outside',
    clockin_address_id: null,
    nearest_distance_meters: Math.round(nearestDistance),
    flag_reason: `Outside all configured locations — ${Math.round(nearestDistance)}m from nearest`,
  };
}
```

**Haversine formula — inline, NO external library:**

```typescript
private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = lat1 * (Math.PI / 180);
  const phi2 = lat2 * (Math.PI / 180);
  const deltaPhi = (lat2 - lat1) * (Math.PI / 180);
  const deltaLambda = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

**Key:** Haversine is a private method on the service class. R = 6371000 (Earth radius in meters). Returns distance in meters. No npm library.

---

### Task 4 — Implement ClockinAddressController

**What:** Create or replace `api/src/modules/time-clock/controllers/clockin-address.controller.ts`.

```typescript
@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClockinAddressController {
  constructor(private readonly clockinAddressService: ClockinAddressService) {}

  @Get('addresses')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List clock-in addresses' })
  async list(@Request() req, @Query() query: ListClockinAddressesDto) {
    return this.clockinAddressService.list(req.user.tenant_id, query);
  }

  @Post('addresses')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Create clock-in address' })
  async create(@Request() req, @Body() dto: CreateClockinAddressDto) {
    return this.clockinAddressService.create(req.user.tenant_id, req.user.id, dto);
  }

  // IMPORTANT: Import routes MUST be defined BEFORE /:id routes
  // to prevent NestJS from matching "import-from-quote" as a UUID :id param

  @Post('addresses/import-from-quote')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Import address from quote jobsite' })
  async importFromQuote(@Request() req, @Body() dto: ImportAddressFromQuoteDto) {
    return this.clockinAddressService.importFromQuote(req.user.tenant_id, req.user.id, dto);
  }

  @Post('addresses/import-from-lead')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Import address from lead address' })
  async importFromLead(@Request() req, @Body() dto: ImportAddressFromLeadDto) {
    return this.clockinAddressService.importFromLead(req.user.tenant_id, req.user.id, dto);
  }

  @Get('addresses/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get clock-in address by ID' })
  async findOne(@Request() req, @Param('id') id: string) {
    return this.clockinAddressService.findOne(req.user.tenant_id, id);
  }

  @Patch('addresses/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update clock-in address' })
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateClockinAddressDto) {
    return this.clockinAddressService.update(req.user.tenant_id, req.user.id, id, dto);
  }

  @Delete('addresses/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Deactivate clock-in address (soft delete)' })
  async remove(@Request() req, @Param('id') id: string) {
    return this.clockinAddressService.softDelete(req.user.tenant_id, req.user.id, id);
  }
}
```

---

### Task 5 — Update Module Registration

**What:** Update `time-clock.module.ts` to register `ClockinAddressService`, `GeofenceService`, and `ClockinAddressController`. Ensure `GoogleMapsService` is available (LeadsModule already imported).

---

### Task 6 — Verify All 7 Endpoints

Test with JWT from admin login. Verify:

1. `GET /api/v1/time-clock/addresses` — returns paginated list with `data` + `meta`
2. `POST /api/v1/time-clock/addresses` — creates address, geocodes, returns record with project include
3. `GET /api/v1/time-clock/addresses/:id` — returns single address with project include
4. `PATCH /api/v1/time-clock/addresses/:id` — updates address, re-geocodes only when address fields change
5. `DELETE /api/v1/time-clock/addresses/:id` — soft-deletes (sets is_active=false), returns `{ message: "Address deactivated successfully" }`
6. `POST /api/v1/time-clock/addresses/import-from-quote` — imports from quote jobsite address, source='imported_from_quote'
7. `POST /api/v1/time-clock/addresses/import-from-lead` — imports from lead address (tenant check through lead join), source='imported_from_lead'

### Task 7 — Verify GeofenceService

Write or execute a quick validation that:
- Haversine computes correct distance for known lat/lng pairs
- `checkGeofence` returns `'not_enforced'` when no active addresses exist
- `checkGeofence` returns `'inside'` when location is within radius
- `checkGeofence` returns `'outside'` with distance and flag_reason when location is outside all radii

---

## Integration Points
- `PrismaService` — `api/src/core/database/prisma.service.ts`
- `AuditLoggerService` — `api/src/modules/audit/services/audit-logger.service.ts`
- `GoogleMapsService` — `api/src/modules/leads/services/google-maps.service.ts` (TimeClockModule already imports LeadsModule)

---

## Business Rules Enforced in This Sprint
- **Soft delete**: DELETE does not remove — sets `is_active = false`
- **Geocoding**: All creates geocode via GoogleMapsService. Updates only re-geocode if address_line1, city, state, or zip_code change.
- **Import sources**: `source` field tracks origin (`'manual'`, `'imported_from_quote'`, `'imported_from_lead'`). `source_address_id` links back to the origin record.
- **Lead address tenant isolation**: `lead_address` has NO `tenant_id` — must join through `lead` to verify tenant ownership.

---

## Acceptance Criteria
- [ ] All 5 DTOs created with full validation
- [ ] ClockinAddressService with 7 methods (list, create, findOne, update, softDelete, importFromQuote, importFromLead)
- [ ] GeofenceService with `checkGeofence()` and private `haversineDistance()`
- [ ] ClockinAddressController with 7 endpoints
- [ ] All endpoints return correct responses
- [ ] Geocoding fires on create, skipped on non-address updates
- [ ] Lead address import validates tenant through lead join
- [ ] Audit logs for every write operation (create, update, soft-delete, both imports)
- [ ] All Prisma queries include `tenant_id` filter
- [ ] `npm run lint` passes
- [ ] No frontend code modified
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — All 7 endpoints must respond correctly and GeofenceService haversine must be verified before proceeding to Sprint 6.

---

## Handoff Notes
- `GeofenceService.checkGeofence()` is consumed by `ClockSessionService` in Sprint 9 (clock-in flow)
- `ClockinAddressService` provides addresses referenced by `clock_session.clockin_address_id`
- Import endpoints allow reuse of addresses from existing quotes and leads without manual re-entry
