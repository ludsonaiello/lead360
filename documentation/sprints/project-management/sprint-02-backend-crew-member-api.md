# Sprint 02 — Crew Member DTO + Service + Controller + API + Tests + Docs

## Sprint Goal
Deliver complete CRUD API for crew members including encrypted field handling, reveal endpoint with audit logging, profile photo upload, and comprehensive tests.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 01 must be complete (reason: crew_member table must exist in database, EncryptionService verified)

## Codebase Reference
- Module path: `api/src/modules/projects/`
- EncryptionService: `import { EncryptionService } from '../../core/encryption/encryption.service';`
- EncryptionModule: `import { EncryptionModule } from '../../core/encryption/encryption.module';`
- AuditLoggerService: `import { AuditLoggerService } from '../../audit/services/audit-logger.service';`
- AuditModule: `import { AuditModule } from '../audit/audit.module';`
- FilesService: `import { FilesService } from '../../files/files.service';`
- FilesModule: `import { FilesModule } from '../files/files.module';`
- FileCategory for profile photo: `photo`
- TenantId: `import { TenantId } from '../../auth/decorators/tenant-id.decorator';`
- JwtAuthGuard: `import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';`
- RolesGuard: `import { RolesGuard } from '../auth/guards/roles.guard';`
- Roles: `import { Roles } from '../auth/decorators/roles.decorator';`

## Tasks

### Task 2.1 — Create DTOs
**Type**: DTO
**Complexity**: Medium
**Description**: Create the following DTO files using class-validator decorators for validation.

**CreateCrewMemberDto** (`dto/create-crew-member.dto.ts`):
- first_name: string (required, max 100)
- last_name: string (required, max 100)
- email: string (optional, valid email, max 255)
- phone: string (optional, max 20)
- address_line1: string (optional, max 200)
- address_line2: string (optional, max 100)
- address_city: string (optional, max 100)
- address_state: string (optional, exactly 2 chars, uppercase)
- address_zip: string (optional, max 10)
- date_of_birth: string (optional, ISO date format)
- ssn: string (optional, format XXX-XX-XXXX or XXXXXXXXX — validated, then encrypted before storage)
- itin: string (optional, format XXX-XX-XXXX or XXXXXXXXX — validated, then encrypted before storage)
- has_drivers_license: boolean (optional)
- drivers_license_number: string (optional — encrypted before storage)
- default_hourly_rate: number (optional, > 0)
- weekly_hours_schedule: number (optional, integer, 1-168)
- overtime_enabled: boolean (optional, default false)
- overtime_rate_multiplier: number (optional, > 1)
- default_payment_method: enum (optional: cash, check, bank_transfer, venmo, zelle)
- bank_name: string (optional, max 200)
- bank_routing_number: string (optional — encrypted before storage)
- bank_account_number: string (optional — encrypted before storage)
- venmo_handle: string (optional, max 100)
- zelle_contact: string (optional, max 100)
- notes: string (optional)

Important: The DTO accepts PLAIN TEXT for sensitive fields (ssn, itin, drivers_license_number, bank_routing_number, bank_account_number). The SERVICE encrypts them before storage. The DTO never stores encrypted values.

**UpdateCrewMemberDto** (`dto/update-crew-member.dto.ts`):
- Same fields as Create, all optional (use PartialType from @nestjs/mapped-types)
- is_active: boolean (optional — allows soft-deactivation)

**CrewMemberResponseDto** — not a class file, but a documented response shape for the controller. All standard GETs return masked values:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+19781234567",
  "address_line1": "123 Main St",
  "address_line2": null,
  "address_city": "Boston",
  "address_state": "MA",
  "address_zip": "02101",
  "date_of_birth": "1990-01-15",
  "ssn_masked": "***-**-1234",
  "has_ssn": true,
  "itin_masked": null,
  "has_itin": false,
  "has_drivers_license": true,
  "drivers_license_masked": "****5678",
  "has_drivers_license_number": true,
  "default_hourly_rate": 25.00,
  "weekly_hours_schedule": 40,
  "overtime_enabled": true,
  "overtime_rate_multiplier": 1.50,
  "default_payment_method": "bank_transfer",
  "bank_name": "Bank of America",
  "bank_routing_masked": "****1234",
  "has_bank_routing": true,
  "bank_account_masked": "****5678",
  "has_bank_account": true,
  "venmo_handle": "@johndoe",
  "zelle_contact": "john@email.com",
  "profile_photo_url": "/public/tenant-uuid/images/photo-uuid.webp",   // RESOLVED AT READ TIME — see service instruction below
  "notes": "Experienced framer",
  "is_active": true,
  "created_by_user_id": "uuid",
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T10:30:00.000Z"
}
```

**List response**:
```json
{
  "data": [{ ...crew member response... }],
  "meta": { "total": 25, "page": 1, "limit": 20, "totalPages": 2 }
}
```

**Reveal response** (GET /crew/:id/reveal/:field):
```json
{
  "field": "ssn",
  "value": "123-45-6789"
}
```

**Expected Outcome**: All DTO files created with proper validation decorators.

**Acceptance Criteria**:
- [ ] CreateCrewMemberDto validates all required fields
- [ ] Sensitive fields accepted as plain text in DTO
- [ ] UpdateCrewMemberDto extends CreateCrewMemberDto with PartialType
- [ ] Response shapes documented and used consistently

**Files Expected**:
- api/src/modules/projects/dto/create-crew-member.dto.ts (created)
- api/src/modules/projects/dto/update-crew-member.dto.ts (created)

**Blocker**: NONE

---

### Task 2.2 — Create CrewMemberService
**Type**: Service
**Complexity**: High
**Description**: Create `api/src/modules/projects/services/crew-member.service.ts` with the following methods.

**Dependencies to inject**:
- PrismaService (from '../../prisma/prisma.service' or '@prisma' — follow existing pattern)
- EncryptionService
- AuditLoggerService
- FilesService

**Methods**:

1. **create(tenantId: string, userId: string, dto: CreateCrewMemberDto): Promise<CrewMemberResponse>**
   - Encrypt sensitive fields before storage: ssn → ssn_encrypted, itin → itin_encrypted, drivers_license_number → drivers_license_number_encrypted, bank_routing_number → bank_routing_encrypted, bank_account_number → bank_account_encrypted
   - Call prisma.crew_member.create with all fields
   - Call auditLoggerService.logTenantChange({ action: 'created', entityType: 'crew_member', entityId: created.id, tenantId, actorUserId: userId, after: { ...sanitized data without raw sensitive fields }, description: 'Created crew member: FirstName LastName' })
   - Return masked response (never raw encrypted values)

2. **findAll(tenantId: string, query: { page?, limit?, is_active?, search? }): Promise<PaginatedResponse>**
   - WHERE: { tenant_id: tenantId, is_active (if provided), OR search on first_name, last_name, email, phone }
   - Return paginated with masked values
   - All queries include `where: { tenant_id: tenantId }`

3. **findOne(tenantId: string, id: string): Promise<CrewMemberResponse>**
   - WHERE: { id, tenant_id: tenantId }
   - Return masked response
   - Throw NotFoundException if not found

4. **update(tenantId: string, id: string, userId: string, dto: UpdateCrewMemberDto): Promise<CrewMemberResponse>**
   - Fetch existing record (with tenant_id filter)
   - If sensitive fields provided, encrypt them
   - Update record
   - Audit log with before/after (sanitized — no raw encrypted values in log)
   - Return masked response

5. **softDelete(tenantId: string, id: string, userId: string): Promise<void>**
   - Set is_active = false (do NOT delete the row)
   - Audit log with action: 'deleted'

6. **revealField(tenantId: string, id: string, userId: string, field: string): Promise<{ field: string, value: string }>**
   - Allowed fields: 'ssn', 'itin', 'drivers_license_number', 'bank_routing', 'bank_account'
   - Fetch crew member with tenant_id filter
   - Decrypt the requested field using EncryptionService.decrypt()
   - Audit log: logTenantChange({ action: 'accessed', entityType: 'crew_member', entityId: id, tenantId, actorUserId: userId, metadata: { field_revealed: field, timestamp: new Date().toISOString() }, description: `Revealed ${field} for crew member ${id}` })
   - Return { field, value: decrypted }
   - Throw BadRequestException if field is not in allowed list
   - Throw NotFoundException if crew member not found or field is null

7. **uploadProfilePhoto(tenantId: string, crewMemberId: string, userId: string, file: Express.Multer.File): Promise<CrewMemberResponse>**
   - Call filesService.uploadFile(tenantId, userId, file, { category: 'photo' as FileCategory, entity_type: 'crew_member', entity_id: crewMemberId })
   - Update crew_member.profile_photo_file_id = result.file.file_id (note: use file_id not id)
   - Return updated masked response

**Private helper method**:
- `maskResponse(crewMember: any): CrewMemberResponse` — Converts raw DB record to masked response. For each encrypted field:
  - If field is not null: decrypt to get last 4 digits, then mask. SSN: `***-**-${last4}`, Bank: `****${last4}`, DL: `****${last4}`
  - Set `has_{field}` = true
  - If field is null: set masked to null, has_{field} = false
  - For profile_photo_file_id: In the crew member service, when building the response object, call `FilesService.getFileUrl(crew_member.profile_photo_file_id)` to resolve the URL. Return this as `profile_photo_url` in the response. If `profile_photo_file_id` is null, return `profile_photo_url: null`. Do not store the URL in the database. FilesService import path: `api/src/modules/files/services/files.service.ts`. Register FilesModule in the ProjectsModule imports.

**Business Rules**:
- All queries include `where: { tenant_id }` filter — non-negotiable
- Sensitive fields are NEVER returned raw — always masked
- Reveal endpoint requires separate audit log entry with action: 'accessed'
- Soft delete sets is_active = false, does not remove the row
- Profile photo uses FilesService with category: 'photo'

**Expected Outcome**: CrewMemberService fully implements all CRUD + reveal + photo upload operations.

**Acceptance Criteria**:
- [ ] All 7 methods implemented
- [ ] All queries include where: { tenant_id } filter
- [ ] Sensitive fields encrypted before storage
- [ ] Sensitive fields masked in all responses
- [ ] Reveal endpoint decrypts and logs audit
- [ ] Profile photo upload uses FilesService
- [ ] Audit logging on create, update, delete, reveal

**Files Expected**:
- api/src/modules/projects/services/crew-member.service.ts (created)

**Blocker**: Task 2.1 must be complete

---

### Task 2.3 — Create CrewMemberController
**Type**: Controller
**Complexity**: Medium
**Description**: Create `api/src/modules/projects/controllers/crew-member.controller.ts` with the following endpoints.

**All endpoints require**: `@UseGuards(JwtAuthGuard, RolesGuard)`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /api/v1/crew | Owner, Admin, Manager | Create crew member |
| GET | /api/v1/crew | Owner, Admin, Manager | List crew members (paginated) |
| GET | /api/v1/crew/:id | Owner, Admin, Manager | Get crew detail (masked) |
| GET | /api/v1/crew/:id/reveal/:field | Owner, Admin | Reveal sensitive field (audit logged) |
| PATCH | /api/v1/crew/:id | Owner, Admin, Manager | Update crew member |
| DELETE | /api/v1/crew/:id | Owner, Admin | Soft delete (set is_active = false) |
| POST | /api/v1/crew/:id/photo | Owner, Admin, Manager | Upload profile photo |
| DELETE | /api/v1/crew/:id/photo | Owner, Admin | Delete profile photo (hard delete) |

**Controller decorator**: `@Controller('api/v1/crew')`

**DELETE /api/v1/crew/:id/photo**:
- Roles: Owner, Admin
- Logic: Fetch crew_member (verify tenant). If `profile_photo_file_id` is null: return 404. Call `FilesService.deleteFile(file_id)` to remove from storage. Set `profile_photo_file_id = null` on the crew_member record. Audit log. Return 200.
- This is a hard delete only. No soft-delete for photo removal.

**Query parameters for GET /crew**:
- page (number, default 1)
- limit (number, default 20)
- is_active (boolean, optional)
- search (string, optional — searches first_name, last_name, email, phone)

**Photo upload endpoint**:
- Uses `@UseInterceptors(FileInterceptor('file'))` from @nestjs/platform-express
- Accepts `@UploadedFile() file: Express.Multer.File`
- Calls crewMemberService.uploadProfilePhoto()

**Each handler extracts**:
- `@TenantId() tenantId: string` — from JWT
- `@Request() req` — for req.user.id (actorUserId)

**Expected Outcome**: All 7 endpoints operational and returning correct response shapes.

**Acceptance Criteria**:
- [ ] All 7 endpoints created with correct paths
- [ ] Guards and Roles decorators applied to every endpoint
- [ ] Reveal endpoint restricted to Owner, Admin only
- [ ] Photo upload uses FileInterceptor
- [ ] TenantId extracted from JWT on every endpoint
- [ ] Query params for list endpoint (page, limit, is_active, search)

**Files Expected**:
- api/src/modules/projects/controllers/crew-member.controller.ts (created)

**Blocker**: Task 2.2 must be complete

---

### Task 2.4 — Create ProjectsModule
**Type**: Module
**Complexity**: Low
**Description**: Create `api/src/modules/projects/projects.module.ts` that imports all dependencies and registers the crew member controller and service.

**Imports**:
- PrismaModule (follow existing pattern from other modules)
- EncryptionModule
- AuditModule
- FilesModule

**Controllers**: [CrewMemberController]
**Providers**: [CrewMemberService]
**Exports**: [CrewMemberService] — exported for future cross-module use

Register ProjectsModule in the root AppModule (`api/src/app.module.ts`).

**Expected Outcome**: ProjectsModule registered in AppModule, all dependencies resolved, app starts without errors.

**Acceptance Criteria**:
- [ ] projects.module.ts created with correct imports
- [ ] Module registered in app.module.ts
- [ ] Application starts without dependency errors
- [ ] All crew endpoints accessible

**Files Expected**:
- api/src/modules/projects/projects.module.ts (created)
- api/src/app.module.ts (modified — add ProjectsModule to imports)

**Blocker**: Tasks 2.1-2.3 must be complete

---

### Task 2.5 — Unit Tests
**Type**: Test
**Complexity**: High
**Description**: Write unit tests for CrewMemberService. Place the test file next to the service.

**Test file**: `api/src/modules/projects/services/crew-member.service.spec.ts`

**Test cases**:
1. `create()` — encrypts sensitive fields, calls prisma.create, returns masked response
2. `create()` — calls auditLoggerService.logTenantChange with action 'created'
3. `findAll()` — includes tenant_id in query, returns paginated response
4. `findAll()` — applies search filter across first_name, last_name, email, phone
5. `findOne()` — returns masked response with has_ssn, ssn_masked etc.
6. `findOne()` — throws NotFoundException when not found
7. `findOne()` — throws NotFoundException when tenant_id doesn't match
8. `update()` — encrypts new sensitive fields, calls audit log
9. `softDelete()` — sets is_active = false, calls audit log
10. `revealField()` — decrypts field, returns raw value, calls audit log with action 'accessed'
11. `revealField()` — throws BadRequestException for disallowed field name
12. `revealField()` — throws NotFoundException when field value is null
13. `uploadProfilePhoto()` — calls FilesService.uploadFile, updates profile_photo_file_id

**Mock dependencies**: PrismaService, EncryptionService, AuditLoggerService, FilesService

**Coverage target**: >80% for CrewMemberService

**Test credentials**: contact@honeydo4you.com / 978@F32c

**Expected Outcome**: All 13 test cases pass.

**Acceptance Criteria**:
- [ ] 13 unit tests written and passing
- [ ] All dependencies mocked
- [ ] Encryption, masking, and audit logging verified
- [ ] Tenant isolation verified (tenant_id always in queries)

**Files Expected**:
- api/src/modules/projects/services/crew-member.service.spec.ts (created)

**Blocker**: Task 2.2 must be complete

---

### Task 2.6 — Integration Tests
**Type**: Test
**Complexity**: Medium
**Description**: Write integration tests for the crew member API endpoints.

**Test file**: `api/test/crew-member.e2e-spec.ts`

**Test cases**:
1. POST /api/v1/crew — creates crew member, returns masked response (201)
2. POST /api/v1/crew — validates required fields (400)
3. GET /api/v1/crew — returns paginated list with masked values
4. GET /api/v1/crew?search=John — filters by search
5. GET /api/v1/crew/:id — returns single crew member with masked values
6. GET /api/v1/crew/:id/reveal/ssn — returns decrypted SSN (Owner role required)
7. GET /api/v1/crew/:id/reveal/ssn — returns 403 for Manager role
8. PATCH /api/v1/crew/:id — updates fields, returns masked response
9. DELETE /api/v1/crew/:id — soft deletes (sets is_active = false)

**Test credentials**: contact@honeydo4you.com / 978@F32c (login first, use JWT)

**Expected Outcome**: All integration tests pass against running API.

**Acceptance Criteria**:
- [ ] All 9 integration test cases written
- [ ] Tests run with real database (test tenant)
- [ ] Tenant isolation verified
- [ ] RBAC verified (reveal restricted to Owner/Admin)

**Files Expected**:
- api/test/crew-member.e2e-spec.ts (created)

**Blocker**: Task 2.4 must be complete (full module registered)

---

### Task 2.7 — REST API Documentation
**Type**: Documentation
**Complexity**: Medium
**Description**: Write comprehensive REST API documentation for all crew member endpoints.

**Output file**: `api/documentation/crew_member_REST_API.md`

**Must document**:
1. POST /api/v1/crew — request body, response (201), validation errors (400)
2. GET /api/v1/crew — query params, paginated response, search behavior
3. GET /api/v1/crew/:id — response with masked fields
4. GET /api/v1/crew/:id/reveal/:field — allowed fields, response, RBAC, audit logging
5. PATCH /api/v1/crew/:id — updatable fields, response
6. DELETE /api/v1/crew/:id — soft delete behavior
7. POST /api/v1/crew/:id/photo — multipart upload, response

Each endpoint must include: HTTP method, path, roles required, request body schema, response body example (JSON), error responses, and notes.

**Expected Outcome**: Frontend agent can implement crew UI from this document alone.

**Acceptance Criteria**:
- [ ] All 7 endpoints documented
- [ ] Request/response examples for each
- [ ] RBAC requirements listed per endpoint
- [ ] Masking behavior explained
- [ ] Reveal endpoint audit logging documented

**Files Expected**:
- api/documentation/crew_member_REST_API.md (created)

**Blocker**: Task 2.3 must be complete

---

## Sprint Acceptance Criteria
- [ ] All 7 crew member endpoints operational
- [ ] Sensitive fields encrypted at rest, masked in responses
- [ ] Reveal endpoint decrypts and creates audit log
- [ ] Profile photo upload works via FilesService
- [ ] All queries include where: { tenant_id } filter
- [ ] Unit tests passing with >80% service coverage
- [ ] Integration tests passing
- [ ] REST API documentation complete at api/documentation/crew_member_REST_API.md

## Gate Marker
NONE

## Handoff Notes
- Crew member CRUD is fully operational at `/api/v1/crew`
- CrewMemberService is exported from ProjectsModule for cross-module use
- Encrypted fields: ssn, itin, drivers_license_number, bank_routing, bank_account
- Reveal endpoint: GET /api/v1/crew/:id/reveal/:field (Owner, Admin only)
- Photo upload: POST /api/v1/crew/:id/photo (FileCategory: photo)
- The ProjectsModule now exists and will be extended in subsequent sprints
