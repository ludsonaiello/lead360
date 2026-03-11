# Sprint 04 — Subcontractor DTO + Service + Controller + API + Tests + Docs

## Sprint Goal
Deliver complete CRUD API for subcontractors including compliance status computation, contacts management, document uploads via FilesService, encrypted bank field handling, and comprehensive tests.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 03 must be complete (reason: subcontractor, subcontractor_contact, subcontractor_document tables must exist)
- Sprint 02 must be complete (reason: ProjectsModule exists and is registered in AppModule)

## Codebase Reference
- Module path: `api/src/modules/projects/`
- EncryptionService: `import { EncryptionService } from '../../core/encryption/encryption.service';`
- EncryptionModule: `import { EncryptionModule } from '../../core/encryption/encryption.module';`
- AuditLoggerService: `import { AuditLoggerService } from '../../audit/services/audit-logger.service';`
- FilesService: `import { FilesService } from '../../files/files.service';`
- FilesModule: `import { FilesModule } from '../files/files.module';`
- TenantId: `import { TenantId } from '../../auth/decorators/tenant-id.decorator';`
- Guards: JwtAuthGuard, RolesGuard, @Roles

## Tasks

### Task 4.1 — Create Subcontractor DTOs
**Type**: DTO
**Complexity**: Medium
**Description**: Create DTOs for subcontractor, contact, and document operations.

**CreateSubcontractorDto**:
- business_name: string (required, max 200)
- trade_specialty: string (optional, max 200)
- email: string (optional, valid email)
- website: string (optional, max 500)
- insurance_provider: string (optional, max 200)
- insurance_policy_number: string (optional, max 100)
- insurance_expiry_date: string (optional, ISO date)
- coi_on_file: boolean (optional, default false)
- default_payment_method: enum (optional: cash, check, bank_transfer, venmo, zelle)
- bank_name: string (optional, max 200)
- bank_routing_number: string (optional — plain text, encrypted by service)
- bank_account_number: string (optional — plain text, encrypted by service)
- venmo_handle: string (optional, max 100)
- zelle_contact: string (optional, max 100)
- notes: string (optional)

**UpdateSubcontractorDto**: PartialType of Create + is_active: boolean (optional)

**CreateSubcontractorContactDto**:
- contact_name: string (required, max 200)
- phone: string (required, max 20)
- role: string (optional, max 100)
- email: string (optional, valid email)
- is_primary: boolean (optional, default false)

**UploadSubcontractorDocumentDto**:
- document_type: enum (required: insurance, agreement, coi, contract, license, other)
- description: string (optional, max 500)

**Response shapes**:

Subcontractor response:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "business_name": "ABC Electrical",
  "trade_specialty": "Electrical",
  "email": "info@abc.com",
  "website": "https://abc-electrical.com",
  "insurance_provider": "State Farm",
  "insurance_policy_number": "POL-12345",
  "insurance_expiry_date": "2027-06-15",
  "coi_on_file": true,
  "compliance_status": "valid",
  "default_payment_method": "check",
  "bank_name": "Chase",
  "bank_routing_masked": "****1234",
  "has_bank_routing": true,
  "bank_account_masked": "****5678",
  "has_bank_account": true,
  "venmo_handle": null,
  "zelle_contact": null,
  "notes": "Reliable electrician",
  "is_active": true,
  "contacts": [
    { "id": "uuid", "contact_name": "Mike", "phone": "555-0101", "role": "Owner", "email": "mike@abc.com", "is_primary": true }
  ],
  "documents": [
    { "id": "uuid", "file_url": "/public/tenant-uuid/files/doc-uuid.pdf", "file_name": "coi.pdf", "document_type": "coi", "description": "COI 2026" }
  ],
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T10:30:00.000Z"
}
```

**Expected Outcome**: All DTO files created.

**Acceptance Criteria**:
- [ ] CreateSubcontractorDto validates all required fields
- [ ] CreateSubcontractorContactDto validates required fields
- [ ] UploadSubcontractorDocumentDto validates document_type enum
- [ ] UpdateSubcontractorDto extends with PartialType

**Files Expected**:
- api/src/modules/projects/dto/create-subcontractor.dto.ts (created)
- api/src/modules/projects/dto/update-subcontractor.dto.ts (created)
- api/src/modules/projects/dto/create-subcontractor-contact.dto.ts (created)
- api/src/modules/projects/dto/upload-subcontractor-document.dto.ts (created)

**Blocker**: NONE

---

### Task 4.2 — Create SubcontractorService
**Type**: Service
**Complexity**: High
**Description**: Create `api/src/modules/projects/services/subcontractor.service.ts`.

**Dependencies**: PrismaService, EncryptionService, AuditLoggerService, FilesService

**Methods**:

1. **create(tenantId, userId, dto)** — Encrypt bank fields. Create record. Compute compliance_status before returning. Audit log.
2. **findAll(tenantId, query: { page?, limit?, is_active?, compliance_status?, search? })** — Paginated. Recompute compliance_status for each row on read. Mask bank fields.
3. **findOne(tenantId, id)** — Include contacts and documents. Recompute compliance_status. Mask bank fields.
4. **update(tenantId, id, userId, dto)** — Encrypt new bank fields if provided. Audit log with before/after.
5. **softDelete(tenantId, id, userId)** — Set is_active = false. Audit log.
6. **revealField(tenantId, id, userId, field: 'bank_routing' | 'bank_account')** — Decrypt, audit log with action 'accessed', return raw value.
7. **addContact(tenantId, subcontractorId, dto)** — Create subcontractor_contact. If is_primary = true, set all other contacts for this sub to is_primary = false.
8. **listContacts(tenantId, subcontractorId)** — Return all contacts for sub.
9. **removeContact(tenantId, subcontractorId, contactId)** — Delete contact.
10. **uploadDocument(tenantId, subcontractorId, userId, file, dto)** — Call FilesService.uploadFile(tenantId, userId, file, { category: mapDocTypeToFileCategory(dto.document_type), entity_type: 'subcontractor', entity_id: subcontractorId }). Create subcontractor_document record with file_id, file_url, file_name from response.
11. **listDocuments(tenantId, subcontractorId)** — Return all documents.
12. **removeDocument(tenantId, subcontractorId, documentId, userId)** — Delete document record. Audit log.

**Compliance Status Computation** (private helper, applied on every read):
```
computeComplianceStatus(insurance_expiry_date: Date | null): string {
  if (!insurance_expiry_date) return 'unknown';
  const today = new Date();
  const expiry = new Date(insurance_expiry_date);
  if (expiry < today) return 'expired';
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
  if (expiry <= thirtyDaysOut) return 'expiring_soon';
  return 'valid';
}
```

**FileCategory mapping for documents**:
- insurance → 'insurance'
- coi → 'insurance'
- contract → 'contract'
- agreement → 'contract'
- license → 'license'
- other → 'misc'

**Business Rules**:
- All queries include where: { tenant_id } filter — non-negotiable
- compliance_status MUST be recomputed on every read from insurance_expiry_date
- Bank fields encrypted before storage, masked in all responses
- Only Owner/Admin can reveal bank fields
- Document uploads use FilesService — never custom file logic

**Expected Outcome**: SubcontractorService fully implements all 12 methods.

**Acceptance Criteria**:
- [ ] All 12 methods implemented
- [ ] All queries include where: { tenant_id } filter
- [ ] compliance_status computed on every read
- [ ] Bank fields encrypted/masked
- [ ] Document uploads use FilesService
- [ ] Audit logging on create, update, delete, reveal

**Files Expected**:
- api/src/modules/projects/services/subcontractor.service.ts (created)

**Blocker**: Task 4.1 must be complete

---

### Task 4.3 — Create SubcontractorController
**Type**: Controller
**Complexity**: Medium
**Description**: Create `api/src/modules/projects/controllers/subcontractor.controller.ts`.

**Controller decorator**: `@Controller('api/v1/subcontractors')`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /subcontractors | Owner, Admin, Manager | Create subcontractor |
| GET | /subcontractors | Owner, Admin, Manager | List with compliance filter |
| GET | /subcontractors/:id | Owner, Admin, Manager | Get detail (compliance recomputed) |
| PATCH | /subcontractors/:id | Owner, Admin, Manager | Update subcontractor |
| DELETE | /subcontractors/:id | Owner, Admin | Soft delete |
| GET | /subcontractors/:id/reveal/:field | Owner, Admin | Reveal bank field (audit) |
| POST | /subcontractors/:id/contacts | Owner, Admin, Manager | Add contact |
| GET | /subcontractors/:id/contacts | Owner, Admin, Manager | List contacts |
| DELETE | /subcontractors/:id/contacts/:contactId | Owner, Admin, Manager | Remove contact |
| POST | /subcontractors/:id/documents | Owner, Admin, Manager | Upload document (multipart) |
| GET | /subcontractors/:id/documents | Owner, Admin, Manager | List documents |
| DELETE | /subcontractors/:id/documents/:documentId | Owner, Admin | Delete document |

**Query params for GET /subcontractors**: page, limit, is_active, compliance_status, search (business_name, trade_specialty, email)

**Document upload**: Uses FileInterceptor('file'), passes file + UploadSubcontractorDocumentDto to service.

**Expected Outcome**: All 12 endpoints operational.

**Acceptance Criteria**:
- [ ] All 12 endpoints created
- [ ] Guards and roles applied
- [ ] Reveal restricted to Owner, Admin
- [ ] Document upload uses FileInterceptor

**Files Expected**:
- api/src/modules/projects/controllers/subcontractor.controller.ts (created)

**Blocker**: Task 4.2 must be complete

---

### Task 4.4 — Register in ProjectsModule
**Type**: Module
**Complexity**: Low
**Description**: Add SubcontractorService and SubcontractorController to the existing ProjectsModule. Export SubcontractorService.

**Expected Outcome**: All subcontractor endpoints accessible.

**Acceptance Criteria**:
- [ ] SubcontractorController added to controllers array
- [ ] SubcontractorService added to providers and exports
- [ ] Application starts without errors

**Files Expected**:
- api/src/modules/projects/projects.module.ts (modified)

**Blocker**: Task 4.3 must be complete

---

### Task 4.5 — Unit Tests
**Type**: Test
**Complexity**: High
**Description**: Write unit tests for SubcontractorService.

**Test file**: `api/src/modules/projects/services/subcontractor.service.spec.ts`

**Test cases**:
1. create() — encrypts bank fields, returns response with computed compliance_status
2. findAll() — includes tenant_id filter, returns paginated with recomputed compliance
3. findAll() — filters by compliance_status
4. findOne() — includes contacts and documents, recomputes compliance
5. update() — encrypts new bank fields, audit logs
6. softDelete() — sets is_active = false
7. revealField() — decrypts bank_routing, creates audit log with action 'accessed'
8. revealField() — throws for disallowed field
9. addContact() — creates contact, sets is_primary correctly
10. removeContact() — deletes contact with tenant validation
11. uploadDocument() — calls FilesService.uploadFile, creates document record
12. removeDocument() — deletes document record
13. computeComplianceStatus() — returns 'unknown' for null date
14. computeComplianceStatus() — returns 'expired' for past date
15. computeComplianceStatus() — returns 'expiring_soon' for date within 30 days
16. computeComplianceStatus() — returns 'valid' for date > 30 days out

**Coverage target**: >80%

**Expected Outcome**: All 16 test cases pass.

**Acceptance Criteria**:
- [ ] 16 unit tests written and passing
- [ ] Compliance computation tested with all edge cases
- [ ] Tenant isolation verified

**Files Expected**:
- api/src/modules/projects/services/subcontractor.service.spec.ts (created)

**Blocker**: Task 4.2 must be complete

---

### Task 4.6 — Integration Tests
**Type**: Test
**Complexity**: Medium
**Description**: Write integration tests for subcontractor API.

**Test file**: `api/test/subcontractor.e2e-spec.ts`

**Test cases**:
1. POST /subcontractors — creates with masked bank fields (201)
2. GET /subcontractors — paginated list with compliance_status computed
3. GET /subcontractors?compliance_status=expired — filters correctly
4. GET /subcontractors/:id — detail with contacts and documents
5. GET /subcontractors/:id/reveal/bank_routing — decrypts (Owner only)
6. POST /subcontractors/:id/contacts — adds contact
7. POST /subcontractors/:id/documents — uploads document via FilesService

**Test credentials**: contact@honeydo4you.com / 978@F32c

**Expected Outcome**: All 7 integration tests pass.

**Acceptance Criteria**:
- [ ] All integration tests pass
- [ ] Compliance computation verified end-to-end

**Files Expected**:
- api/test/subcontractor.e2e-spec.ts (created)

**Blocker**: Task 4.4 must be complete

---

### Task 4.7 — REST API Documentation
**Type**: Documentation
**Complexity**: Medium
**Description**: Write comprehensive REST API documentation for all subcontractor endpoints.

**Output file**: `api/documentation/subcontractor_REST_API.md`

**Must document all 12 endpoints** with request/response examples, RBAC, compliance_status computation logic, and document upload flow.

**Expected Outcome**: Frontend agent can implement subcontractor UI from this document alone.

**Acceptance Criteria**:
- [ ] All 12 endpoints documented
- [ ] Compliance computation logic explained
- [ ] Document upload flow documented
- [ ] Response shapes with concrete JSON examples

**Files Expected**:
- api/documentation/subcontractor_REST_API.md (created)

**Blocker**: Task 4.3 must be complete

---

## Sprint Acceptance Criteria
- [ ] All 12 subcontractor endpoints operational
- [ ] Compliance status computed on every read
- [ ] Bank fields encrypted/masked
- [ ] Contacts CRUD working
- [ ] Document upload via FilesService working
- [ ] All queries include where: { tenant_id } filter
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] REST API documentation complete

## Gate Marker
NONE

## Handoff Notes
- Subcontractor CRUD at `/api/v1/subcontractors`
- Contacts at `/api/v1/subcontractors/:id/contacts`
- Documents at `/api/v1/subcontractors/:id/documents`
- SubcontractorService exported from ProjectsModule
- compliance_status is recomputed on every read: unknown/expired/expiring_soon/valid
- Bank reveal: GET /subcontractors/:id/reveal/:field (Owner, Admin only)
