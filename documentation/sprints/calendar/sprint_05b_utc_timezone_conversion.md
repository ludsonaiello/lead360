# Sprint 05b: utc_timezone_conversion

**Sprint**: Backend Phase 1 - Sprint 05b of 42
**Module**: Calendar & Scheduling
**Estimated Duration**: 3-4 hours
**Prerequisites**: Sprint 05A complete (Appointment CRUD working)

---

## 🎯 Sprint Goal

Implement timezone conversion service to handle local time <-> UTC conversion with DST support.

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
- Create DateTimeConverterService (IANA timezone support)
- Implement local time → UTC conversion
- Implement UTC → local time conversion
- Handle DST transitions (spring forward / fall back)
- Calculate end_time from start_time + slot_duration_minutes
- Store both local (date + time) and UTC (start_datetime_utc, end_datetime_utc)
- Unit tests for DST edge cases

**Install Dependency:**
```bash
npm install date-fns-tz
```

**Key Logic:**
```typescript
import { zonedTimeToUtc } from 'date-fns-tz';
const localDateTime = \`${scheduled_date}T${start_time}:00\`;
const utcDateTime = zonedTimeToUtc(localDateTime, tenant.timezone);
```

**DST Edge Cases:**
- Spring forward (2 AM doesn't exist): Use 3 AM
- Fall back (2 AM happens twice): Use first occurrence

---

## 📐 Critical Files to Review

Before starting, review these existing files:
- /var/www/lead360.app/api/package.json (install date-fns-tz)
- /var/www/lead360.app/api/src/modules/calendar/services/appointments.service.ts

---

## 🛠️ Implementation Steps

See the detailed implementation plan at:
`/root/.claude/plans/curried-petting-bachman.md` - Sprint 05b section

### Quick Reference

1. Review existing codebase patterns
2. Follow multi-tenant isolation rules (always filter by `tenant_id`)
3. Implement RBAC for all endpoints (Owner, Admin, Estimator roles)
4. Write unit tests (>80% coverage for business logic)
5. Write integration tests (all endpoints)
6. Update inline documentation and Swagger decorators
7. Verify all tests passing
8. Review code for security vulnerabilities

---

## ✅ Definition of Done

- [ ] Code follows existing patterns
- [ ] Multi-tenant isolation verified (`tenant_id` in all queries)
- [ ] RBAC enforced (correct roles for each endpoint)
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests for all endpoints
- [ ] Swagger documentation complete
- [ ] No console errors or warnings
- [ ] All tests passing
- [ ] Code reviewed for security issues
- [ ] Inline documentation for complex logic

---

## 🧪 Testing & Verification

**Unit Tests:**
- Test EST → PST conversion
- Test DST spring forward (March 2 AM)
- Test DST fall back (November 2 AM)
- Test midnight crossing (11:30 PM + 1 hour = 12:30 AM next day)

**Integration Tests:**
- Test appointment creation calculates UTC correctly
- Test appointments across different timezones

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

**Implementation Plan**: `/root/.claude/plans/curried-petting-bachman.md` - Sprint 05b

**Existing Patterns**:
- `/var/www/lead360.app/api/src/modules/leads/` - Multi-tenant patterns
- `/var/www/lead360.app/api/src/modules/communication/` - Complex module example
- `/var/www/lead360.app/api/prisma/schema.prisma` - Data model

---

## 🎯 Success Criteria

When this sprint is complete, you should be able to demonstrate:
1. ✅ All sprint requirements met
2. ✅ All tests passing (unit + integration)
3. ✅ Multi-tenant isolation verified
4. ✅ RBAC enforced correctly
5. ✅ No runtime errors or warnings
6. ✅ Ready for next sprint

---

**Next Sprint**: Sprint 06: Appointment Lifecycle & Status Transitions

