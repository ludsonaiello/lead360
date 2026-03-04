# Sprint 02: Seed Data & Tenant Lifecycle Hooks

**Sprint**: Backend Phase 1 - Sprint 2 of 42
**Module**: Calendar & Scheduling
**Estimated Duration**: 3-4 hours
**Prerequisites**: Sprints 01A & 01B complete (all 7 tables created)

---

## 🎯 Sprint Goal

Create seed data to add default "Quote Visit" appointment type for all existing tenants, and implement lifecycle hooks to auto-create appointment types when new tenants are created.

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

### Part 1: Seed Default Appointment Type for Existing Tenants

- Create "Quote Visit" appointment type for ALL existing tenants
- Create 7 schedule rows (Monday-Sunday) for each appointment type
- Set default availability: Monday-Friday, 9 AM - 5 PM (8-hour window)
- Mark as `is_default = true`

### Part 2: Tenant Creation Lifecycle Hook

- Modify `TenantService.create()` to auto-create default appointment type
- Ensure new tenants get "Quote Visit" + 7 schedule rows automatically
- Set default timezone to "America/New_York"

---

## 📐 Detailed Specifications

### Part 1: Seed Script

**File**: `/var/www/lead360.app/api/prisma/seed.ts`

#### Review Existing Seed Pattern

```bash
# Read existing seed script
cat /var/www/lead360.app/api/prisma/seed.ts

# Look for:
# - How existing data is seeded
# - How transactions are handled
# - How UUIDs are generated
```

#### Add Calendar Seeding Logic

```typescript
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function seedCalendarModule() {
  console.log('🗓️  Seeding Calendar Module...');

  // Get all existing tenants
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
  });

  console.log(`Found ${tenants.length} existing tenants`);

  for (const tenant of tenants) {
    console.log(`  ➜ Seeding calendar for tenant: ${tenant.name}`);

    // Check if tenant already has appointment types
    const existingTypes = await prisma.appointment_type.count({
      where: { tenant_id: tenant.id },
    });

    if (existingTypes > 0) {
      console.log(`    ✓ Tenant already has ${existingTypes} appointment type(s), skipping`);
      continue;
    }

    // Create default "Quote Visit" appointment type
    const appointmentType = await prisma.appointment_type.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant.id,
        name: 'Quote Visit',
        description: 'Schedule a quote visit with the customer to assess the job',
        slot_duration_minutes: 60,           // 1-hour slots
        max_lookahead_weeks: 8,              // 8 weeks forward
        reminder_24h_enabled: true,
        reminder_1h_enabled: true,
        is_active: true,
        is_default: true,
        created_by_user_id: null,            // System-created
      },
    });

    console.log(`    ✓ Created appointment type: ${appointmentType.name}`);

    // Create 7 schedule rows (Mon-Sun)
    const scheduleRows = [
      // Sunday (0) - Not available
      { day_of_week: 0, is_available: false, window1_start: null, window1_end: null },

      // Monday (1) - 9 AM to 5 PM
      { day_of_week: 1, is_available: true, window1_start: '09:00', window1_end: '17:00' },

      // Tuesday (2) - 9 AM to 5 PM
      { day_of_week: 2, is_available: true, window1_start: '09:00', window1_end: '17:00' },

      // Wednesday (3) - 9 AM to 5 PM
      { day_of_week: 3, is_available: true, window1_start: '09:00', window1_end: '17:00' },

      // Thursday (4) - 9 AM to 5 PM
      { day_of_week: 4, is_available: true, window1_start: '09:00', window1_end: '17:00' },

      // Friday (5) - 9 AM to 5 PM
      { day_of_week: 5, is_available: true, window1_start: '09:00', window1_end: '17:00' },

      // Saturday (6) - Not available
      { day_of_week: 6, is_available: false, window1_start: null, window1_end: null },
    ];

    for (const schedule of scheduleRows) {
      await prisma.appointment_type_schedule.create({
        data: {
          id: uuidv4(),
          appointment_type_id: appointmentType.id,
          ...schedule,
        },
      });
    }

    console.log(`    ✓ Created 7 schedule rows (Mon-Fri: 9 AM - 5 PM)`);
  }

  console.log('✅ Calendar Module seeding complete\n');
}

async function main() {
  // ... existing seed logic ...

  // Add calendar seeding
  await seedCalendarModule();

  // ... rest of seed logic ...
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

#### Run Seed Script

```bash
cd /var/www/lead360.app/api

# Run seed
npx prisma db seed

# Verify in Prisma Studio
npx prisma studio
# Check: appointment_type table should have 1 row per existing tenant
# Check: appointment_type_schedule should have 7 rows per appointment type
```

---

### Part 2: Tenant Creation Lifecycle Hook

**File**: `/var/www/lead360.app/api/src/modules/tenant/services/tenant.service.ts`

#### Review Existing Tenant Service

```bash
# Read existing tenant service
cat /var/www/lead360.app/api/src/modules/tenant/services/tenant.service.ts

# Look for:
# - create() method
# - How transactions are used
# - How related entities are created
```

#### Modify create() Method

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto): Promise<any> {
    // Use transaction to create tenant + default appointment type atomically
    return this.prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          id: uuidv4(),
          name: createTenantDto.name,
          subdomain: createTenantDto.subdomain,
          timezone: 'America/New_York',  // Default timezone
          // ... other tenant fields
        },
      });

      // 2. Create default "Quote Visit" appointment type
      const appointmentType = await tx.appointment_type.create({
        data: {
          id: uuidv4(),
          tenant_id: tenant.id,
          name: 'Quote Visit',
          description: 'Schedule a quote visit with the customer to assess the job',
          slot_duration_minutes: 60,
          max_lookahead_weeks: 8,
          reminder_24h_enabled: true,
          reminder_1h_enabled: true,
          is_active: true,
          is_default: true,
          created_by_user_id: null,  // System-created
        },
      });

      // 3. Create 7 schedule rows (Mon-Sun)
      const scheduleRows = [
        { day_of_week: 0, is_available: false, window1_start: null, window1_end: null },
        { day_of_week: 1, is_available: true, window1_start: '09:00', window1_end: '17:00' },
        { day_of_week: 2, is_available: true, window1_start: '09:00', window1_end: '17:00' },
        { day_of_week: 3, is_available: true, window1_start: '09:00', window1_end: '17:00' },
        { day_of_week: 4, is_available: true, window1_start: '09:00', window1_end: '17:00' },
        { day_of_week: 5, is_available: true, window1_start: '09:00', window1_end: '17:00' },
        { day_of_week: 6, is_available: false, window1_start: null, window1_end: null },
      ];

      const schedulePromises = scheduleRows.map((schedule) =>
        tx.appointment_type_schedule.create({
          data: {
            id: uuidv4(),
            appointment_type_id: appointmentType.id,
            ...schedule,
          },
        }),
      );

      await Promise.all(schedulePromises);

      // 4. Return tenant (with appointment type included if needed)
      return tenant;
    });
  }

  // ... rest of service methods
}
```

#### Test Tenant Creation

```typescript
// In tenant.service.spec.ts or manual test

describe('TenantService', () => {
  it('should create default appointment type on tenant creation', async () => {
    const tenant = await tenantService.create({
      name: 'Test Tenant',
      subdomain: 'test-tenant',
    });

    // Verify appointment type created
    const appointmentTypes = await prisma.appointment_type.findMany({
      where: { tenant_id: tenant.id },
    });

    expect(appointmentTypes).toHaveLength(1);
    expect(appointmentTypes[0].name).toBe('Quote Visit');
    expect(appointmentTypes[0].is_default).toBe(true);

    // Verify 7 schedule rows created
    const schedules = await prisma.appointment_type_schedule.findMany({
      where: { appointment_type_id: appointmentTypes[0].id },
    });

    expect(schedules).toHaveLength(7);

    // Verify Mon-Fri available, Sat-Sun not available
    const monday = schedules.find(s => s.day_of_week === 1);
    expect(monday.is_available).toBe(true);
    expect(monday.window1_start).toBe('09:00');
    expect(monday.window1_end).toBe('17:00');

    const sunday = schedules.find(s => s.day_of_week === 0);
    expect(sunday.is_available).toBe(false);
  });
});
```

---

## 🛠️ Implementation Steps

### Step 1: Update Seed Script

1. Open `/var/www/lead360.app/api/prisma/seed.ts`
2. Add `seedCalendarModule()` function as shown above
3. Call it from `main()` function
4. Run seed script: `npx prisma db seed`
5. Verify in Prisma Studio

### Step 2: Modify Tenant Service

1. Open `/var/www/lead360.app/api/src/modules/tenant/services/tenant.service.ts`
2. Import `appointment_type` and `appointment_type_schedule` if needed
3. Modify `create()` method to use transaction
4. Add appointment type creation logic
5. Add schedule creation logic

### Step 3: Test Lifecycle Hook

```bash
# Option 1: Manual test via API
curl -X POST http://localhost:8000/api/v1/admin/tenants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Lifecycle Tenant",
    "subdomain": "test-lifecycle",
    "contact_email": "test@example.com"
  }'

# Option 2: Unit test
npm run test -- tenant.service.spec.ts

# Verify in database
npx prisma studio
# Check appointment_type and appointment_type_schedule for new tenant
```

---

## ✅ Definition of Done

- [ ] Seed script updated with `seedCalendarModule()` function
- [ ] Seed script creates "Quote Visit" for all existing tenants
- [ ] Seed script creates 7 schedule rows per appointment type
- [ ] Default schedule: Mon-Fri 9 AM - 5 PM, Sat-Sun unavailable
- [ ] Tenant creation hook implemented in `TenantService.create()`
- [ ] New tenants automatically get default appointment type + schedule
- [ ] Default timezone set to "America/New_York"
- [ ] Transaction ensures atomic creation (tenant + appointment type + schedules)
- [ ] Unit test verifies lifecycle hook works
- [ ] Seed script can run multiple times (idempotent - skips existing)
- [ ] All tests passing

---

## 🧪 Testing & Verification

### Manual Testing

1. **Run Seed Script**:
   ```bash
   npx prisma db seed
   # Check console output - should create types for all tenants

   # Verify in Prisma Studio
   npx prisma studio
   # Count rows: appointment_type should = number of tenants
   ```

2. **Test Tenant Creation**:
   ```bash
   # Create new tenant via API or Prisma Studio
   # Verify appointment_type and schedules auto-created
   ```

3. **Verify Default Schedule**:
   ```sql
   SELECT * FROM appointment_type_schedule
   WHERE appointment_type_id = '<newly-created-type-id>'
   ORDER BY day_of_week;

   -- Should see 7 rows:
   -- day_of_week 0 (Sun): is_available = false
   -- day_of_week 1-5 (Mon-Fri): is_available = true, 09:00 - 17:00
   -- day_of_week 6 (Sat): is_available = false
   ```

### Unit Tests

```bash
# Run tenant service tests
npm run test -- tenant.service.spec.ts

# All tests should pass, including new lifecycle test
```

### Database Connection

```env
DATABASE_URL="mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360"
```

---

## 📝 Notes

### Idempotent Seeding

The seed script checks if a tenant already has appointment types before creating new ones:

```typescript
const existingTypes = await prisma.appointment_type.count({
  where: { tenant_id: tenant.id },
});

if (existingTypes > 0) {
  console.log(`Tenant already has ${existingTypes} appointment type(s), skipping`);
  continue;
}
```

This allows the seed script to be run multiple times safely.

### Default Schedule Rationale

**Mon-Fri, 9 AM - 5 PM** is a reasonable default for service businesses:
- Standard business hours
- 8-hour window
- No weekend availability (tenants can enable if needed)

Tenants can customize their schedule later via Settings page (Sprint 38).

### Transaction Usage

Using `prisma.$transaction()` ensures that:
- If tenant creation fails, appointment type is NOT created
- If appointment type creation fails, tenant is NOT created
- Atomic operation - all or nothing

### Common Pitfalls to Avoid

❌ **DON'T**:
- Create appointment type without transaction (can leave tenant without default type)
- Hardcode tenant IDs in seed script
- Skip verification that appointment type was created

✅ **DO**:
- Use transactions for multi-step creation
- Make seed script idempotent (check before creating)
- Verify creation in both seed and lifecycle hook

---

## 📚 References

**Contract**: `/var/www/lead360.app/documentation/contracts/calendar-contract.md`
**Sections**: Lines 162-163 (Auto-create default appointment type on tenant creation)

**Existing Patterns**:
- `/var/www/lead360.app/api/prisma/seed.ts` - Seeding patterns
- `/var/www/lead360.app/api/src/modules/tenant/services/tenant.service.ts` - Tenant creation

---

## 🎯 Success Criteria

When this sprint is complete:
1. ✅ All existing tenants have "Quote Visit" appointment type
2. ✅ All existing tenants have 7 schedule rows
3. ✅ New tenant creation auto-creates appointment type + schedules
4. ✅ Default schedule is Mon-Fri 9 AM - 5 PM
5. ✅ Seed script is idempotent
6. ✅ All tests passing
7. ✅ Ready for Sprint 3 (Appointment Type Module - CRUD)

---

**Next Sprint**: Sprint 03 - Appointment Type Module - CRUD Operations
**File**: `documentation/sprints/calendar/sprint_03_appointment_type_crud.md`
