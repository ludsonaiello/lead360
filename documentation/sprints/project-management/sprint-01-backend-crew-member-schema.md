# Sprint 01 — Crew Member Schema + Migration

## Sprint Goal
Create the `crew_member` database table with all fields including encrypted sensitive columns, plus verify EncryptionService is operational.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- None. This is the first sprint in the Project Management module.

## Codebase Reference
- New module path: `api/src/modules/projects/`
- EncryptionService: `api/src/core/encryption/encryption.service.ts`
- EncryptionModule: `api/src/core/encryption/encryption.module.ts`
- Prisma schema: `api/prisma/schema.prisma`
- Existing module pattern: follow `api/src/modules/leads/` structure

## Tasks

### Task 1.1 — Add crew_member model to Prisma schema
**Type**: Schema
**Complexity**: High
**Description**: Add the `crew_member` model to `api/prisma/schema.prisma` with all fields defined below. Add the `crew_member_payment_method` enum. Add the relation to the `tenant` model (add `crew_members crew_member[]` to the tenant model's relations). Add the relation to the `user` model (add `crew_member_profile crew_member?` to the user model's relations — optional one-to-one for future clockin system).

**Field Table**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| user_id | String? @db.VarChar(36) | yes | null | FK → user. Reserved for clockin system (Field role). |
| first_name | String @db.VarChar(100) | no | — | |
| last_name | String @db.VarChar(100) | no | — | |
| email | String? @db.VarChar(255) | yes | null | |
| phone | String? @db.VarChar(20) | yes | null | |
| address_line1 | String? @db.VarChar(200) | yes | null | |
| address_line2 | String? @db.VarChar(100) | yes | null | |
| address_city | String? @db.VarChar(100) | yes | null | |
| address_state | String? @db.VarChar(2) | yes | null | 2-letter US state code |
| address_zip | String? @db.VarChar(10) | yes | null | |
| date_of_birth | DateTime? @db.Date | yes | null | |
| ssn_encrypted | String? @db.Text | yes | null | EncryptionService. Mask: ***-**-1234 |
| itin_encrypted | String? @db.Text | yes | null | EncryptionService. Mask: ***-**-1234 |
| has_drivers_license | Boolean? | yes | null | |
| drivers_license_number_encrypted | String? @db.Text | yes | null | EncryptionService. Mask: ****5678 |
| default_hourly_rate | Decimal? @db.Decimal(8, 2) | yes | null | |
| weekly_hours_schedule | Int? | yes | null | e.g. 36, 40, 50 |
| overtime_enabled | Boolean | no | false | |
| overtime_rate_multiplier | Decimal? @db.Decimal(4, 2) | yes | null | e.g. 1.5 = time-and-a-half |
| default_payment_method | crew_member_payment_method? | yes | null | Enum: cash, check, bank_transfer, venmo, zelle |
| bank_name | String? @db.VarChar(200) | yes | null | |
| bank_routing_encrypted | String? @db.Text | yes | null | EncryptionService. Mask: ****1234 |
| bank_account_encrypted | String? @db.Text | yes | null | EncryptionService. Mask: ****1234 |
| venmo_handle | String? @db.VarChar(100) | yes | null | |
| zelle_contact | String? @db.VarChar(100) | yes | null | Phone or email for Zelle |
| profile_photo_file_id | String? @db.VarChar(36) | yes | null | FK → file table |
| notes | String? @db.Text | yes | null | |
| is_active | Boolean | no | true | @default(true) |
| created_by_user_id | String @db.VarChar(36) | no | — | FK → user |
| created_at | DateTime | no | @default(now()) | Auto |
| updated_at | DateTime | no | @updatedAt | Auto |

**Enum to create**:
```
enum crew_member_payment_method {
  cash
  check
  bank_transfer
  venmo
  zelle
}
```

**Indexes**:
- @@index([tenant_id, is_active]) — filter active crew by tenant
- @@index([tenant_id, user_id]) — clockin system lookup
- @@index([tenant_id, created_at]) — list ordering
- @@map("crew_member")

**Relations**:
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- user: `user? @relation("crew_member_user", fields: [user_id], references: [id], onDelete: SetNull)`
- created_by: `user @relation("crew_member_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)`
- profile_photo: `file? @relation("crew_member_photo", fields: [profile_photo_file_id], references: [file_id], onDelete: SetNull)`

Note: You must also add the reverse relations to the `tenant`, `user`, and `file` models in schema.prisma.

**Expected Outcome**: The `crew_member` model exists in Prisma schema with all fields, relations, and indexes.

**Acceptance Criteria**:
- [ ] crew_member model added to schema.prisma with all 31 fields
- [ ] crew_member_payment_method enum created
- [ ] All relations defined (tenant, user, created_by, profile_photo)
- [ ] Reverse relations added to tenant, user, and file models
- [ ] All indexes defined

**Files Expected**:
- api/prisma/schema.prisma (modified)

**Blocker**: NONE

---

### Task 1.2 — Run Prisma migration
**Type**: Migration
**Complexity**: Low
**Description**: Generate and apply the Prisma migration for the crew_member model.

Run:
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_crew_member
npx prisma generate
```

**Expected Outcome**: Migration file created in `api/prisma/migrations/` and applied to the database. Prisma Client regenerated.

**Acceptance Criteria**:
- [ ] Migration file exists in api/prisma/migrations/
- [ ] Migration applied successfully (no errors)
- [ ] Prisma Client regenerated
- [ ] Database table crew_member exists with correct columns

**Files Expected**:
- api/prisma/migrations/[timestamp]_add_crew_member/migration.sql (created)

**Blocker**: Task 1.1 must be complete

---

### Task 1.3 — Verify EncryptionService is operational
**Type**: Service (verification)
**Complexity**: Low
**Description**: Write a simple verification test that imports EncryptionService, encrypts a test value, decrypts it, and asserts they match. This confirms the ENCRYPTION_KEY env var is configured and AES-256-GCM is working. The test goes next to the service file.

Verify the .env file has ENCRYPTION_KEY set (64-char hex string). If not, generate one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Expected Outcome**: EncryptionService.encrypt() and .decrypt() work correctly with the configured ENCRYPTION_KEY.

**Acceptance Criteria**:
- [ ] ENCRYPTION_KEY exists in api/.env
- [ ] EncryptionService.encrypt('test-ssn') returns a JSON string
- [ ] EncryptionService.decrypt(encrypted) returns 'test-ssn'
- [ ] Verification test passes

**Files Expected**:
- api/.env (verified/modified if ENCRYPTION_KEY missing)

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] crew_member table exists in the database with correct columns and types
- [ ] crew_member_payment_method enum exists
- [ ] All indexes created
- [ ] Migration applied cleanly
- [ ] EncryptionService operational (encrypt/decrypt verified)
- [ ] Prisma Client regenerated and importable

## Gate Marker
NONE

## Handoff Notes
- The crew_member model is now available for Sprint 02 to build DTOs, service, controller, and tests.
- Encrypted fields: ssn_encrypted, itin_encrypted, drivers_license_number_encrypted, bank_routing_encrypted, bank_account_encrypted — all stored as TEXT columns containing JSON {iv, encrypted, authTag}.
- The EncryptionService import path is: `import { EncryptionService } from '../../core/encryption/encryption.service';`
- The EncryptionModule import path is: `import { EncryptionModule } from '../../core/encryption/encryption.module';`
