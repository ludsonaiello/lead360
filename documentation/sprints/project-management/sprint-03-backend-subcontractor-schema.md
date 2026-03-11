# Sprint 03 — Subcontractor + Contacts + Documents Schema + Migration

## Sprint Goal
Create the `subcontractor`, `subcontractor_contact`, and `subcontractor_document` database tables with all fields, encrypted bank fields, compliance status computation logic, and document management via FilesService.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 01 must be complete (reason: crew_member_payment_method enum already exists and will be reused for subcontractor; ProjectsModule exists)

## Codebase Reference
- Module path: `api/src/modules/projects/`
- Prisma schema: `api/prisma/schema.prisma`
- EncryptionService: `api/src/core/encryption/encryption.service.ts`
- FilesService: `api/src/modules/files/files.service.ts`

## Tasks

### Task 3.1 — Add subcontractor model to Prisma schema
**Type**: Schema
**Complexity**: High
**Description**: Add the `subcontractor` model to `api/prisma/schema.prisma` with all fields. Create the `subcontractor_compliance_status` enum and `subcontractor_document_type` enum.

**Field Table — subcontractor**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| business_name | String @db.VarChar(200) | no | — | |
| trade_specialty | String? @db.VarChar(200) | yes | null | e.g. Electrical, Plumbing, Framing |
| email | String? @db.VarChar(255) | yes | null | Primary contact email |
| website | String? @db.VarChar(500) | yes | null | |
| insurance_provider | String? @db.VarChar(200) | yes | null | |
| insurance_policy_number | String? @db.VarChar(100) | yes | null | |
| insurance_expiry_date | DateTime? @db.Date | yes | null | Source of truth for compliance_status |
| coi_on_file | Boolean | no | false | Certificate of Insurance on file |
| compliance_status | subcontractor_compliance_status | no | unknown | COMPUTED on every read — NOT stored static |
| default_payment_method | crew_member_payment_method? | yes | null | Reuse existing enum |
| bank_name | String? @db.VarChar(200) | yes | null | |
| bank_routing_encrypted | String? @db.Text | yes | null | EncryptionService |
| bank_account_encrypted | String? @db.Text | yes | null | EncryptionService |
| venmo_handle | String? @db.VarChar(100) | yes | null | |
| zelle_contact | String? @db.VarChar(100) | yes | null | |
| notes | String? @db.Text | yes | null | |
| is_active | Boolean | no | true | @default(true) |
| created_by_user_id | String @db.VarChar(36) | no | — | FK → user |
| created_at | DateTime | no | @default(now()) | Auto |
| updated_at | DateTime | no | @updatedAt | Auto |

**Enums to create**:
```
enum subcontractor_compliance_status {
  valid
  expiring_soon
  expired
  unknown
}

enum subcontractor_document_type {
  insurance
  agreement
  coi
  contract
  license
  other
}
```

**Indexes**:
- @@index([tenant_id, compliance_status])
- @@index([tenant_id, is_active])
- @@index([tenant_id, insurance_expiry_date])
- @@map("subcontractor")

**Relations**: tenant (Cascade), created_by_user (Restrict), contacts (one-to-many), documents (one-to-many)

---

**Field Table — subcontractor_contact**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | Tenant isolation |
| subcontractor_id | String @db.VarChar(36) | no | — | FK → subcontractor |
| contact_name | String @db.VarChar(200) | no | — | |
| phone | String @db.VarChar(20) | no | — | |
| role | String? @db.VarChar(100) | yes | null | e.g. Owner, PM, Billing |
| email | String? @db.VarChar(255) | yes | null | |
| is_primary | Boolean | no | false | |
| created_at | DateTime | no | @default(now()) | Auto |

**Indexes**:
- @@index([tenant_id, subcontractor_id])
- @@map("subcontractor_contact")

---

**Field Table — subcontractor_document**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | Tenant isolation |
| subcontractor_id | String @db.VarChar(36) | no | — | FK → subcontractor |
| file_id | String @db.VarChar(36) | no | — | FK → file table |
| file_url | String @db.VarChar(500) | no | — | Nginx-served URL from FilesService |
| file_name | String @db.VarChar(255) | no | — | Original filename |
| document_type | subcontractor_document_type | no | — | insurance, agreement, coi, contract, license, other |
| description | String? @db.VarChar(500) | yes | null | |
| uploaded_by_user_id | String @db.VarChar(36) | no | — | FK → user |
| created_at | DateTime | no | @default(now()) | Auto |

**Indexes**:
- @@index([tenant_id, subcontractor_id])
- @@map("subcontractor_document")

**Reverse relations**: Add to tenant, user, and file models.

**Expected Outcome**: All three models exist in Prisma schema with all fields, enums, and relations.

**Acceptance Criteria**:
- [ ] subcontractor model added with all 22 fields
- [ ] subcontractor_contact model added with all 9 fields
- [ ] subcontractor_document model added with all 10 fields
- [ ] All enums created
- [ ] All indexes defined
- [ ] Reverse relations added to tenant, user, file models

**Files Expected**:
- api/prisma/schema.prisma (modified)

**Blocker**: NONE

---

### Task 3.2 — Run Prisma migration
**Type**: Migration
**Complexity**: Low
**Description**: Generate and apply the Prisma migration.

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_subcontractor_entities
npx prisma generate
```

**Expected Outcome**: Migration applied, Prisma Client regenerated.

**Acceptance Criteria**:
- [ ] Migration file exists
- [ ] Migration applied successfully
- [ ] Tables subcontractor, subcontractor_contact, subcontractor_document exist

**Files Expected**:
- api/prisma/migrations/[timestamp]_add_subcontractor_entities/migration.sql (created)

**Blocker**: Task 3.1 must be complete

---

## Sprint Acceptance Criteria
- [ ] All three tables exist in database with correct columns
- [ ] All enums created
- [ ] All indexes applied
- [ ] Migration clean with no errors
- [ ] Prisma Client regenerated

## Gate Marker
NONE

## Handoff Notes
- The subcontractor, subcontractor_contact, and subcontractor_document tables are ready for Sprint 04.
- compliance_status is stored in DB column but MUST be recomputed on every read in the service layer (see Sprint 04 for computation logic).
- Encrypted fields: bank_routing_encrypted, bank_account_encrypted — same pattern as crew_member.
- Document uploads will use FilesService with FileCategory: 'contract', 'insurance', or 'misc'.
