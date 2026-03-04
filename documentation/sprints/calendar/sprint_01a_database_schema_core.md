# Sprint 01A: Database Schema - Core Tables

**Sprint**: Backend Phase 1 - Sprint 1A of 42
**Module**: Calendar & Scheduling
**Estimated Duration**: 4-6 hours
**Prerequisites**: None (first sprint)

---

## 🎯 Sprint Goal

Design and implement Prisma schema for the 4 core calendar tables and modify the tenant table to add timezone support. Create the first database migration.

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

1. **tenant** (MODIFY): Add `timezone` column
2. **appointment_type**: Defines appointment categories (MVP: "Quote Visit" only)
3. **appointment_type_schedule**: Weekly availability windows (7 rows per type)
4. **appointment**: Core appointment entity with lifecycle management

### Critical Patterns to Follow

Review these existing files BEFORE starting:
- `/var/www/lead360.app/api/prisma/schema.prisma` - Existing schema patterns
- `/var/www/lead360.app/api/src/modules/leads/` - Multi-tenant patterns
- `/var/www/lead360.app/api/src/modules/tenant/` - Tenant table structure

---

## 📐 Detailed Specifications

### 1. Modify Existing Table: tenant

**File**: `/var/www/lead360.app/api/prisma/schema.prisma`

**Add Column**:
```prisma
model tenant {
  // ... existing fields ...

  timezone            String        @default("America/New_York") @db.VarChar(50)  // NEW FIELD

  // ... existing relations ...

  // NEW RELATIONS
  appointment_types   appointment_type[]
  appointments        appointment[]
  calendar_provider_connections calendar_provider_connection[]
  calendar_external_blocks calendar_external_block[]
}
```

**Validation Rules**:
- Must be valid IANA timezone identifier
- Default value: "America/New_York"
- Examples: "America/New_York", "America/Los_Angeles", "America/Chicago", "America/Denver"

---

### 2. New Table: appointment_type

**Purpose**: Defines a category of appointment a tenant offers. MVP ships with one default type ("Quote Visit"). Architecture supports multiple types per tenant.

```prisma
model appointment_type {
  id                      String                      @id @default(uuid()) @db.VarChar(36)
  tenant_id               String                      @db.VarChar(36)
  name                    String                      @db.VarChar(100)
  description             String?                     @db.VarChar(500)
  slot_duration_minutes   Int                         @default(60)          // 15, 30, 45, 60, 90, 120, ... 360, or 0 (All Day)
  max_lookahead_weeks     Int                         @default(8)           // Min 1, Max 52
  reminder_24h_enabled    Boolean                     @default(true)
  reminder_1h_enabled     Boolean                     @default(true)
  is_active               Boolean                     @default(true)
  is_default              Boolean                     @default(false)       // Only one per tenant
  created_at              DateTime                    @default(now())
  updated_at              DateTime                    @updatedAt
  created_by_user_id      String?                     @db.VarChar(36)

  // Relations
  tenant                  tenant                      @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  created_by              user?                       @relation("AppointmentTypeCreatedBy", fields: [created_by_user_id], references: [id], onDelete: SetNull)

  // Child relations
  schedules               appointment_type_schedule[]
  appointments            appointment[]

  // Indexes
  @@index([tenant_id, is_active])
  @@index([tenant_id, is_default])
  @@index([tenant_id, created_at])
}
```

**Business Rules**:
- Only one `is_default = true` per tenant
- `slot_duration_minutes` must be one of: 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360, or 0 (All Day)
- `max_lookahead_weeks` must be between 1 and 52
- Deactivating (`is_active = false`) does NOT delete existing appointments

---

### 3. New Table: appointment_type_schedule

**Purpose**: Defines weekly recurring availability windows for an appointment type. Each row represents one day of the week with up to two time windows (same dual-shift pattern as `tenant_business_hours`).

```prisma
model appointment_type_schedule {
  id                      String              @id @default(uuid()) @db.VarChar(36)
  appointment_type_id     String              @db.VarChar(36)
  day_of_week             Int                 // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  is_available            Boolean             @default(false)
  window1_start           String?             @db.VarChar(5)      // HH:MM (24-hour format)
  window1_end             String?             @db.VarChar(5)      // HH:MM
  window2_start           String?             @db.VarChar(5)      // HH:MM (optional second shift)
  window2_end             String?             @db.VarChar(5)      // HH:MM
  created_at              DateTime            @default(now())
  updated_at              DateTime            @updatedAt

  // Relations
  appointment_type        appointment_type    @relation(fields: [appointment_type_id], references: [id], onDelete: Cascade)

  // Constraints
  @@unique([appointment_type_id, day_of_week])  // One row per day per type
  @@index([appointment_type_id])
}
```

**Business Rules**:
- Exactly 7 rows per appointment type (one for each day of the week)
- `day_of_week`: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
- Times stored in HH:MM format (24-hour), tenant local time
- If `is_available = false`, time windows are ignored
- Time validation: `window1_start < window1_end`. If window2: `window1_end < window2_start < window2_end`

---

### 4. New Table: appointment

**Purpose**: The core scheduling entity. Represents a booked appointment linking a lead to a time slot. This is the system of record — Google Calendar events are synced copies.

```prisma
model appointment {
  id                          String                  @id @default(uuid()) @db.VarChar(36)
  tenant_id                   String                  @db.VarChar(36)
  appointment_type_id         String                  @db.VarChar(36)
  lead_id                     String                  @db.VarChar(36)
  service_request_id          String?                 @db.VarChar(36)

  // Date and Time (local + UTC)
  scheduled_date              String                  @db.VarChar(10)     // YYYY-MM-DD
  start_time                  String                  @db.VarChar(5)      // HH:MM (tenant local time)
  end_time                    String                  @db.VarChar(5)      // HH:MM (tenant local time)
  start_datetime_utc          DateTime                                    // Calculated from date + time + tenant.timezone
  end_datetime_utc            DateTime                                    // Calculated

  // Status and Lifecycle
  status                      String                  @default("scheduled") @db.VarChar(20)   // scheduled, confirmed, completed, cancelled, no_show, rescheduled
  cancellation_reason         String?                 @db.VarChar(30)     // customer_cancelled, business_cancelled, no_show, rescheduled, other
  cancellation_notes          String?                 @db.Text            // Max 1000 chars
  notes                       String?                 @db.Text            // Max 2000 chars

  // Metadata
  source                      String                  @default("manual") @db.VarChar(20)     // voice_ai, manual, system
  external_calendar_event_id  String?                 @db.VarChar(255)    // Google Calendar event ID
  rescheduled_from_id         String?                 @db.VarChar(36)     // Self-reference to original appointment
  assigned_user_id            String?                 @db.VarChar(36)     // Estimator/staff (future use)
  acknowledged_at             DateTime?                                   // When staff acknowledged new appointment

  // Timestamps and Audit
  created_at                  DateTime                @default(now())
  updated_at                  DateTime                @updatedAt
  created_by_user_id          String?                 @db.VarChar(36)
  cancelled_at                DateTime?
  cancelled_by_user_id        String?                 @db.VarChar(36)
  completed_at                DateTime?

  // Relations
  tenant                      tenant                  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  appointment_type            appointment_type        @relation(fields: [appointment_type_id], references: [id], onDelete: Restrict)
  lead                        lead                    @relation(fields: [lead_id], references: [id], onDelete: Cascade)
  service_request             service_request?        @relation(fields: [service_request_id], references: [id], onDelete: SetNull)
  assigned_user               user?                   @relation("AppointmentAssignedTo", fields: [assigned_user_id], references: [id], onDelete: SetNull)
  created_by                  user?                   @relation("AppointmentCreatedBy", fields: [created_by_user_id], references: [id], onDelete: SetNull)
  cancelled_by                user?                   @relation("AppointmentCancelledBy", fields: [cancelled_by_user_id], references: [id], onDelete: SetNull)
  rescheduled_from            appointment?            @relation("AppointmentRescheduleChain", fields: [rescheduled_from_id], references: [id], onDelete: SetNull)
  rescheduled_to              appointment[]           @relation("AppointmentRescheduleChain")

  // Indexes
  @@index([tenant_id, scheduled_date, status])                        // Primary query for slot calculation
  @@index([tenant_id, status, start_datetime_utc])                    // Upcoming appointments query
  @@index([tenant_id, lead_id, status])                               // Find appointments for lead (Voice AI)
  @@index([tenant_id, appointment_type_id, scheduled_date])          // Availability by type
  @@index([tenant_id, created_at(sort: Desc)])                       // Recent appointments
  @@index([external_calendar_event_id])                               // Google Calendar sync lookup
  @@index([rescheduled_from_id])                                      // Reschedule chain tracking
  @@index([acknowledged_at])                                          // Dashboard "new" appointments
}
```

**Business Rules**:
- `lead_id` is REQUIRED (every appointment must be tied to a lead)
- `start_datetime_utc` and `end_datetime_utc` calculated server-side from `scheduled_date` + times + `tenant.timezone`
- When status changes to `cancelled` or `no_show`, `cancellation_reason` becomes required
- Status transitions (see contract line 397-406 for state machine)
- Terminal states: `completed`, `cancelled`, `no_show`, `rescheduled` - no further modifications allowed

---

## 🛠️ Implementation Steps

### Step 1: Review Existing Schema Patterns

```bash
# Read existing Prisma schema
cat /var/www/lead360.app/api/prisma/schema.prisma

# Look for:
# - How tenant table is structured
# - How multi-tenant relations are defined
# - How indexes are created
# - How enums are defined
```

### Step 2: Update Prisma Schema

1. Open `/var/www/lead360.app/api/prisma/schema.prisma`
2. Find the `tenant` model
3. Add the `timezone` field with default value
4. Add the 3 new models (appointment_type, appointment_type_schedule, appointment)
5. Define all relationships correctly
6. Add all indexes as specified

### Step 3: Create Migration

```bash
cd /var/www/lead360.app/api

# Generate migration
npx prisma migrate dev --name calendar_core_tables

# This will:
# 1. Create migration file in prisma/migrations/
# 2. Apply migration to database
# 3. Regenerate Prisma Client
```

### Step 4: Verify Migration

```bash
# Check migration was created
ls prisma/migrations/ | grep calendar_core_tables

# Verify tables exist in database
npx prisma studio
# Navigate to each new table and verify structure
```

---

## ✅ Definition of Done

- [ ] Prisma schema updated with all 4 models
- [ ] `tenant.timezone` field added with default "America/New_York"
- [ ] All relations correctly defined
- [ ] All indexes created as specified
- [ ] Migration file created successfully
- [ ] Migration applied to database without errors
- [ ] Prisma Client regenerated
- [ ] Can open Prisma Studio and see all 4 tables
- [ ] No TypeScript errors in schema file
- [ ] All field types match specifications exactly

---

## 🧪 Testing & Verification

### Manual Testing

1. **Verify Tenant Table**:
   ```bash
   # In Prisma Studio or MySQL client
   DESCRIBE tenant;
   # Verify timezone column exists with VARCHAR(50)
   ```

2. **Verify New Tables**:
   ```bash
   DESCRIBE appointment_type;
   DESCRIBE appointment_type_schedule;
   DESCRIBE appointment;
   ```

3. **Verify Indexes**:
   ```bash
   SHOW INDEX FROM appointment_type;
   SHOW INDEX FROM appointment;
   # Verify composite indexes exist
   ```

4. **Test Foreign Keys**:
   ```bash
   # Verify cascade behavior
   SHOW CREATE TABLE appointment_type;
   # Look for ON DELETE CASCADE
   ```

### Database Connection

```env
DATABASE_URL="mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360"
```

### Test User Credentials

**System Admin**:
- Email: `ludsonaiello@gmail.com`
- Password: `978@F32c`

**Tenant User**:
- Email: `contact@honeydo4you.com`
- Password: `978@F32c`

---

## 📝 Notes

### Development Server

**Run with**: `npm run start:dev` (NOT PM2)

The backend API runs on `http://localhost:8000`

### Multi-Tenant Isolation

All tables include `tenant_id` with composite indexes starting with `tenant_id`. This ensures:
1. Fast queries filtered by tenant
2. Data isolation between tenants
3. Efficient slot calculation

### Timezone Handling

Times are stored in **dual format**:
- **Local time** (`scheduled_date`, `start_time`, `end_time`) - User-facing, in tenant timezone
- **UTC** (`start_datetime_utc`, `end_datetime_utc`) - For cross-timezone operations, Google Calendar sync

### Common Pitfalls to Avoid

❌ **DON'T**:
- Add indexes without `tenant_id` first
- Use global unique constraints (must be scoped to tenant)
- Skip the `onDelete: Cascade` for tenant relations
- Forget to regenerate Prisma Client after schema changes

✅ **DO**:
- Always use composite indexes: `@@index([tenant_id, other_field])`
- Use `@@unique([tenant_id, field])` for tenant-scoped uniqueness
- Set proper cascade behavior on foreign keys
- Run `npx prisma generate` after schema changes

---

## 📚 References

**Contract**: `/var/www/lead360.app/documentation/contracts/calendar-contract.md`
**Sections**: Lines 111-260 (Data Model)

**Existing Patterns**:
- `/var/www/lead360.app/api/prisma/schema.prisma` - Schema structure
- `/var/www/lead360.app/api/src/modules/tenant/` - Tenant patterns
- `/var/www/lead360.app/api/src/modules/leads/` - Multi-tenant patterns

---

## 🎯 Success Criteria

When this sprint is complete:
1. ✅ All 4 tables exist in database
2. ✅ Migration applied successfully
3. ✅ Prisma Client regenerated
4. ✅ No schema validation errors
5. ✅ Ready for Sprint 1B (integration tables)

---

**Next Sprint**: Sprint 01B - Database Schema - Integration Tables
**File**: `documentation/sprints/calendar/sprint_01b_database_schema_integration.md`
