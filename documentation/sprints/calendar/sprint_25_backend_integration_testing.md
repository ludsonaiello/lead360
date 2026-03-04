# Sprint 25: Backend Integration Testing

**Sprint**: Backend Phase 5 - Sprint 25 of 42
**Module**: Calendar & Scheduling
**Estimated Duration**: 6-8 hours
**Prerequisites**: Sprint 24 complete (multi-tenant isolation tests passing)

---

## 🎯 Sprint Goal

Write comprehensive integration tests for all API endpoints and end-to-end flows including appointment lifecycle, Google Calendar sync, and Voice AI booking.

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

**Core Requirements:**
- Integration tests for ALL calendar endpoints (45+ endpoints)
- End-to-end test flows:
  - Full appointment lifecycle (create → reschedule → cancel)
  - Google Calendar sync flow (appointment → event creation)
  - Voice AI booking flow (tool call → appointment created)
  - Reminder scheduling and delivery
  - Slot calculation with external blocks
- Mock Google Calendar API calls
- Test database state changes
- Test RBAC for all roles
- All tests must pass

**Test Coverage Goals:**
- Integration tests: 100% of endpoints
- E2E flows: All critical user journeys
- Mock external dependencies (Google Calendar API)

---

## 📐 Critical Files to Review

Before starting, review these existing files:
- `/var/www/lead360.app/api/src/modules/leads/` - Integration test patterns
- `/var/www/lead360.app/api/src/modules/communication/` - Complex E2E tests
- `/var/www/lead360.app/api/test/` - Test utilities and helpers

---

## 🛠️ Implementation Steps

See the detailed implementation plan at:
`/root/.claude/plans/curried-petting-bachman.md` - Sprint 25 section

### Test Structure

Create integration test files:
```
/var/www/lead360.app/api/src/modules/calendar/tests/integration/
├── appointment-types.integration.spec.ts
├── appointment-schedules.integration.spec.ts
├── appointments.integration.spec.ts
├── appointment-lifecycle.integration.spec.ts
├── slot-calculation.integration.spec.ts
├── google-calendar-oauth.integration.spec.ts
├── google-calendar-sync.integration.spec.ts
├── voice-ai-booking.integration.spec.ts
├── reminders.integration.spec.ts
└── e2e-flows.integration.spec.ts
```

### Example Integration Test

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../core/database/prisma.service';

describe('Appointment Lifecycle (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let tenantId: string;
  let leadId: string;
  let appointmentTypeId: string;
  let appointmentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup test data
    authToken = await getTestAuthToken('contact@honeydo4you.com', '978@F32c');
    tenantId = await getTenantIdFromToken(authToken);
    leadId = await createTestLead(tenantId);
    appointmentTypeId = await getDefaultAppointmentType(tenantId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('should create appointment successfully', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/calendar/appointments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        appointment_type_id: appointmentTypeId,
        lead_id: leadId,
        scheduled_date: '2026-03-10',
        start_time: '09:00',
        notes: 'Test appointment',
      })
      .expect(201);

    appointmentId = response.body.id;
    expect(response.body.status).toBe('scheduled');
    expect(response.body.start_datetime_utc).toBeDefined();
  });

  it('should reschedule appointment successfully', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/calendar/appointments/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        new_scheduled_date: '2026-03-12',
        new_start_time: '10:00',
      })
      .expect(200);

    const newAppointmentId = response.body.id;
    expect(newAppointmentId).not.toBe(appointmentId);
    expect(response.body.rescheduled_from_id).toBe(appointmentId);

    // Verify old appointment marked as rescheduled
    const oldAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    expect(oldAppointment.status).toBe('rescheduled');

    appointmentId = newAppointmentId;
  });

  it('should cancel appointment successfully', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/calendar/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        cancellation_reason: 'customer_cancelled',
        cancellation_notes: 'Test cancellation',
      })
      .expect(200);

    // Verify appointment cancelled in database
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    expect(appointment.status).toBe('cancelled');
    expect(appointment.cancellation_reason).toBe('customer_cancelled');
    expect(appointment.cancelled_at).not.toBeNull();
  });
});
```

---

## ✅ Definition of Done

- [ ] Integration tests for all 45+ endpoints created
- [ ] E2E test flows for critical journeys implemented
- [ ] Google Calendar API mocked properly
- [ ] All tests passing (100% success rate)
- [ ] Test coverage >90% for calendar module
- [ ] RBAC tested for all roles
- [ ] Multi-tenant isolation verified in integration tests
- [ ] No flaky tests (run suite 5 times, all pass)
- [ ] All tests run in CI/CD pipeline

---

## 🧪 Testing & Verification

### Run All Integration Tests

```bash
cd /var/www/lead360.app/api

# Run all calendar integration tests
npm run test -- --testPathPattern=calendar/tests/integration

# Run specific test file
npm run test -- appointment-lifecycle.integration.spec.ts

# Run with coverage
npm run test:cov -- --testPathPattern=calendar
```

### Database Connection

```env
DATABASE_URL="mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360"
```

### Test Users

**System Admin**:
- Email: `ludsonaiello@gmail.com`
- Password: `978@F32c`

**Tenant User**:
- Email: `contact@honeydo4you.com`
- Password: `978@F32c`

### Development Server

**Run with**: `npm run start:dev` (NOT PM2)
- Backend API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/api/docs`

---

## 📚 References

**Contract**: `/var/www/lead360.app/documentation/contracts/calendar-contract.md`

**Implementation Plan**: `/root/.claude/plans/curried-petting-bachman.md` - Sprint 25

**Existing Patterns**:
- `/var/www/lead360.app/api/src/modules/leads/` - Integration test examples
- `/var/www/lead360.app/api/src/modules/communication/` - Complex test scenarios

---

## 🎯 Success Criteria

When this sprint is complete, you should be able to demonstrate:
1. ✅ All integration tests passing (100%)
2. ✅ E2E flows tested and working
3. ✅ Google Calendar sync mocked and tested
4. ✅ Voice AI booking tested end-to-end
5. ✅ Test coverage >90%
6. ✅ Ready for Sprint 26 (Backend Completion Report)

---

**Next Sprint**: Sprint 26 - Backend Complete - Verification & Report
