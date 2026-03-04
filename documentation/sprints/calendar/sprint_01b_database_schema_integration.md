# Sprint 01B: Database Schema - Integration Tables

**Sprint**: Backend Phase 1 - Sprint 1B of 42
**Module**: Calendar & Scheduling
**Estimated Duration**: 3-4 hours
**Prerequisites**: Sprint 01A complete (core tables created)

---

## 🎯 Sprint Goal

Design and implement Prisma schema for the 3 Google Calendar integration tables: calendar provider connection, sync log, and external blocks. Create the second database migration.

---

## 👨‍💻 Sprint Owner Role

You are a **masterclass backend developer** that makes Google, Amazon, and Apple engineers jealous. You build **masterclass code** with thoughtful architecture, never rushing, always breathing and thinking through each decision. You:

- ✅ **Never guess** names, properties, modules, or paths
- ✅ **Always review** existing codebase patterns before writing new code
- ✅ **Always verify** tenant isolation (`tenant_id` filtering) in every query
- ✅ **Always enforce** RBAC (role-based access control)
- ✅ **Always write** unit and integration tests
- ✅ **Review your work** multiple times before considering it complete
- ✅ **Deliver 100% quality** or beyond specification

---

## 📋 Requirements

### Tables to Create

1. **calendar_provider_connection**: OAuth credentials and sync status
2. **calendar_sync_log**: Audit trail for all sync operations
3. **calendar_external_block**: External event time blocks (no personal data)

### Security Requirements

- **CRITICAL**: OAuth tokens MUST be encrypted at rest
- No personal event details stored (only time blocks)
- Webhook channel tokens for signature verification

---

## 📐 Detailed Specifications

### 1. New Table: calendar_provider_connection

**Purpose**: Stores the tenant's connection to an external calendar provider. MVP supports Google Calendar only. Follows the Provider Registry pattern used by the Communication module.

```prisma
model calendar_provider_connection {
  id                        String                  @id @default(uuid()) @db.VarChar(36)
  tenant_id                 String                  @unique @db.VarChar(36)      // One connection per tenant (MVP)
  provider_type             String                  @db.VarChar(30)              // google_calendar (extensible)

  // OAuth Tokens (MUST BE ENCRYPTED)
  access_token              String                  @db.Text                      // Encrypted via EncryptionService
  refresh_token             String                  @db.Text                      // Encrypted via EncryptionService
  token_expires_at          DateTime

  // Connected Calendar
  connected_calendar_id     String                  @db.VarChar(255)              // e.g., "primary" or specific calendar ID
  connected_calendar_name   String?                 @db.VarChar(255)

  // Google Push Notifications (Webhooks)
  webhook_channel_id        String?                 @db.VarChar(255)
  webhook_resource_id       String?                 @db.VarChar(255)
  webhook_channel_token     String?                 @db.VarChar(255)              // For signature verification
  webhook_expiration        DateTime?                                            // Google requires renewal ~7 days

  // Sync Status
  sync_status               String                  @default("active") @db.VarChar(20)   // active, disconnected, error, syncing
  last_sync_at              DateTime?
  last_sync_token           String?                 @db.Text                      // Google incremental sync token
  error_message             String?                 @db.Text

  is_active                 Boolean                 @default(true)
  created_at                DateTime                @default(now())
  updated_at                DateTime                @updatedAt
  connected_by_user_id      String?                 @db.VarChar(36)

  // Relations
  tenant                    tenant                  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  connected_by              user?                   @relation(fields: [connected_by_user_id], references: [id], onDelete: SetNull)

  // Child relations
  sync_logs                 calendar_sync_log[]
  external_blocks           calendar_external_block[]

  // Indexes
  @@unique([tenant_id, provider_type])              // One connection per provider per tenant
  @@index([tenant_id, is_active])
  @@index([sync_status])
  @@index([webhook_expiration])                      // For webhook renewal cron job
}
```

**Business Rules**:
- OAuth tokens (`access_token`, `refresh_token`) MUST be encrypted at rest using EncryptionService
- Tokens are NEVER returned in API responses
- Token refresh: when `token_expires_at` < 5 minutes, auto-refresh using `refresh_token`
- On refresh failure: set `sync_status = 'disconnected'`, notify Owner/Admin
- Webhook renewal: Google channels expire ~7 days, must be renewed before expiration
- On disconnect: purge all `calendar_external_block` records for this tenant

**Enum Values**:
- `provider_type`: `"google_calendar"` (extensible for `"apple_calendar"`, `"outlook"`, etc.)
- `sync_status`: `"active"`, `"disconnected"`, `"error"`, `"syncing"`

---

### 2. New Table: calendar_sync_log

**Purpose**: Audit trail for every sync operation between Lead360 and Google Calendar. Used for debugging sync issues and monitoring health.

```prisma
model calendar_sync_log {
  id                        String                            @id @default(uuid()) @db.VarChar(36)
  tenant_id                 String                            @db.VarChar(36)
  connection_id             String                            @db.VarChar(36)

  // Sync Details
  direction                 String                            @db.VarChar(10)      // outbound (Lead360→Google), inbound (Google→Lead360)
  action                    String                            @db.VarChar(20)      // event_created, event_updated, event_deleted, block_created, etc.
  appointment_id            String?                           @db.VarChar(36)      // For outbound syncs
  external_event_id         String?                           @db.VarChar(255)     // Google Calendar event ID

  status                    String                            @db.VarChar(10)      // success, failed, skipped
  error_message             String?                           @db.Text
  metadata                  Json?                                                  // Additional context (response codes, retry count, etc.)

  created_at                DateTime                          @default(now())

  // Relations
  tenant                    tenant                            @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  connection                calendar_provider_connection      @relation(fields: [connection_id], references: [id], onDelete: Cascade)
  appointment               appointment?                      @relation(fields: [appointment_id], references: [id], onDelete: SetNull)

  // Indexes
  @@index([tenant_id, created_at(sort: Desc)])       // Recent sync activity
  @@index([tenant_id, status])                        // Failed sync lookup
  @@index([connection_id])
  @@index([appointment_id])
}
```

**Business Rules**:
- Log entries are **immutable** (insert-only, no updates or deletes)
- Retention: logs older than 90 days may be purged by scheduled cleanup job
- Every outbound sync (create/update/delete Google Calendar event) must create a log entry
- Every inbound sync (webhook received, full sync executed) must create a log entry

**Enum Values**:
- `direction`: `"outbound"`, `"inbound"`
- `action`: `"event_created"`, `"event_updated"`, `"event_deleted"`, `"block_created"`, `"block_updated"`, `"block_deleted"`, `"full_sync"`, `"token_refreshed"`, `"webhook_renewed"`
- `status`: `"success"`, `"failed"`, `"skipped"`

---

### 3. New Table: calendar_external_block

**Purpose**: Stores blocked time periods detected from the connected Google Calendar. These represent events the tenant has on their personal/external calendar that should prevent appointment booking in Lead360. **NO personal event details are stored** — only the time block and sync reference.

```prisma
model calendar_external_block {
  id                        String                            @id @default(uuid()) @db.VarChar(36)
  tenant_id                 String                            @db.VarChar(36)
  connection_id             String                            @db.VarChar(36)

  // External Event Reference
  external_event_id         String                            @db.VarChar(255)     // Google Calendar event ID (for sync tracking)

  // Time Block (ONLY - no personal details)
  start_datetime_utc        DateTime
  end_datetime_utc          DateTime
  is_all_day                Boolean                           @default(false)

  source                    String                            @db.VarChar(30)      // google_calendar (extensible)
  created_at                DateTime                          @default(now())
  updated_at                DateTime                          @updatedAt

  // Relations
  tenant                    tenant                            @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  connection                calendar_provider_connection      @relation(fields: [connection_id], references: [id], onDelete: Cascade)

  // Indexes
  @@index([tenant_id, start_datetime_utc, end_datetime_utc])  // Slot calculation overlap check
  @@unique([tenant_id, external_event_id])                    // Prevent duplicate blocks for same event
  @@index([connection_id])
}
```

**Business Rules**:
- This table stores **ONLY time blocks**. No event title, description, attendees, or any personal information
- When an external event is deleted from Google Calendar, the corresponding block is deleted from this table
- When an external event is modified (time changed), the block is updated to reflect new times
- Events created BY Lead360 (identified by `external_calendar_event_id` matching an appointment's field) are **EXCLUDED** from this table
- All-day events: `is_all_day = true` blocks the entire day from availability
- On calendar disconnection, all blocks for that tenant + connection are purged

**Privacy Compliance**:
- ✅ **GDPR/Privacy Safe**: Only stores time blocks, no personal event data
- ✅ **Purpose**: Prevent double-booking, not event snooping
- ✅ **Display**: Shows as "Busy — Blocked (External)" in calendar UI

---

## 🛠️ Implementation Steps

### Step 1: Review Sprint 01A Results

```bash
# Verify core tables exist
npx prisma studio
# Check: tenant (with timezone), appointment_type, appointment_type_schedule, appointment
```

### Step 2: Update Prisma Schema

1. Open `/var/www/lead360.app/api/prisma/schema.prisma`
2. Add the 3 new models (calendar_provider_connection, calendar_sync_log, calendar_external_block)
3. Update the `tenant` model to include new relations:
   ```prisma
   model tenant {
     // ... existing fields ...

     // NEW RELATIONS (add to existing relations)
     calendar_provider_connections calendar_provider_connection[]
     calendar_sync_logs            calendar_sync_log[]
     calendar_external_blocks      calendar_external_block[]
   }
   ```
4. Update the `appointment` model to include sync log relation:
   ```prisma
   model appointment {
     // ... existing fields ...

     // NEW RELATION
     sync_logs                     calendar_sync_log[]
   }
   ```

### Step 3: Create Migration

```bash
cd /var/www/lead360.app/api

# Generate migration
npx prisma migrate dev --name calendar_integration_tables

# This will:
# 1. Create migration file in prisma/migrations/
# 2. Apply migration to database
# 3. Regenerate Prisma Client
```

### Step 4: Verify Migration

```bash
# Check migration was created
ls prisma/migrations/ | grep calendar_integration_tables

# Verify tables exist
npx prisma studio
# Navigate to: calendar_provider_connection, calendar_sync_log, calendar_external_block

# Verify indexes
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW INDEX FROM calendar_provider_connection;"
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW INDEX FROM calendar_sync_log;"
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW INDEX FROM calendar_external_block;"
```

---

## ✅ Definition of Done

- [ ] Prisma schema updated with all 3 integration models
- [ ] All relations correctly defined (tenant, connection, appointment)
- [ ] All indexes created as specified
- [ ] Unique constraint on `[tenant_id, provider_type]` for calendar_provider_connection
- [ ] Unique constraint on `[tenant_id, external_event_id]` for calendar_external_block
- [ ] Migration file created successfully
- [ ] Migration applied to database without errors
- [ ] Prisma Client regenerated
- [ ] Can open Prisma Studio and see all 3 new tables
- [ ] All foreign keys have proper cascade behavior
- [ ] No TypeScript errors in schema file

---

## 🧪 Testing & Verification

### Manual Testing

1. **Verify calendar_provider_connection**:
   ```sql
   DESCRIBE calendar_provider_connection;
   SHOW INDEX FROM calendar_provider_connection;
   -- Verify unique constraint on (tenant_id, provider_type)
   ```

2. **Verify calendar_sync_log**:
   ```sql
   DESCRIBE calendar_sync_log;
   -- Verify composite index on (tenant_id, created_at DESC)
   ```

3. **Verify calendar_external_block**:
   ```sql
   DESCRIBE calendar_external_block;
   SHOW INDEX FROM calendar_external_block;
   -- Verify unique constraint on (tenant_id, external_event_id)
   ```

4. **Test Relations**:
   ```sql
   SHOW CREATE TABLE calendar_provider_connection;
   SHOW CREATE TABLE calendar_sync_log;
   SHOW CREATE TABLE calendar_external_block;
   -- Verify all ON DELETE CASCADE and ON DELETE SET NULL behaviors
   ```

### Database Connection

```env
DATABASE_URL="mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360"
```

---

## 📝 Notes

### Security: Token Encryption

The `access_token` and `refresh_token` fields will be encrypted using `EncryptionService` (implemented in Sprint 09). For now, the schema supports storing encrypted text.

**Encryption Implementation** (Sprint 09):
```typescript
// Before storage
const encryptedAccessToken = await this.encryptionService.encrypt(tokens.access_token);
await prisma.calendar_provider_connection.create({
  data: {
    access_token: encryptedAccessToken,
    refresh_token: await this.encryptionService.encrypt(tokens.refresh_token),
  },
});

// On read (never expose in API responses)
const decryptedToken = await this.encryptionService.decrypt(connection.access_token);
// Use for Google Calendar API calls only
```

### Privacy: External Blocks

**What is stored**:
- ✅ Event ID (for sync tracking)
- ✅ Start/end times (UTC)
- ✅ All-day flag

**What is NOT stored**:
- ❌ Event title
- ❌ Event description
- ❌ Attendees
- ❌ Location
- ❌ Any personal information

**Display in UI**: "Busy — Blocked (External)" with no details

### Webhook Channel Renewal

Google Calendar push notifications expire after ~7 days. A cron job (Sprint 15) will:
1. Query connections where `webhook_expiration < NOW() + INTERVAL 1 DAY`
2. Renew webhook subscription
3. Update `webhook_channel_id`, `webhook_resource_id`, `webhook_expiration`

---

## 📚 References

**Contract**: `/var/www/lead360.app/documentation/contracts/calendar-contract.md`
**Sections**: Lines 262-380 (Integration Tables)

**Existing Patterns**:
- `/var/www/lead360.app/api/prisma/schema.prisma` - Schema structure
- `/var/www/lead360.app/api/src/modules/communication/` - Provider connection pattern

---

## 🎯 Success Criteria

When this sprint is complete:
1. ✅ All 3 integration tables exist in database
2. ✅ Migration applied successfully
3. ✅ Prisma Client regenerated
4. ✅ Unique constraints enforced
5. ✅ All 7 calendar tables ready for backend development
6. ✅ Ready for Sprint 2 (Seed Data & Tenant Lifecycle Hooks)

---

**Next Sprint**: Sprint 02 - Seed Data & Tenant Lifecycle Hooks
**File**: `documentation/sprints/calendar/sprint_02_seed_data_tenant_hooks.md`
