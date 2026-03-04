# Sprint 35: appointment_detail_cancel

**Sprint**: Backend Phase 2 (Frontend) - Sprint 35 of 42
**Module**: Calendar & Scheduling
**Estimated Duration**: 4-5 hours
**Prerequisites**: Sprint 34 complete

---

## 🎯 Sprint Goal

Create appointment detail modal and cancel flow with reason selection

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

Detail modal with all info, cancel modal with reason dropdown

---

## 📐 Critical Files to Review

Before starting, review these existing files:
- Modal patterns\n- Action buttons

---

## 🛠️ Implementation Steps

See the detailed implementation plan at:
`/root/.claude/plans/curried-petting-bachman.md` - Sprint 35 section

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

Detail/cancel tests

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

**Implementation Plan**: `/root/.claude/plans/curried-petting-bachman.md` - Sprint 35

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

**Next Sprint**: Sprint 36

