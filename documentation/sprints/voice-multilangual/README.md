# Multi-Language Voice Agent Profiles - Sprint Summary

**Feature**: Language-specific voice agent profiles with IVR integration
**Total Sprints**: 12 (9 backend + 3 frontend)
**Estimated Timeline**: 55-70 hours full-stack
**Status**: ✅ Planning Complete - Ready for Implementation

---

## 📋 Complete Sprint List

### Backend Implementation (Sprints 1-9)

| Sprint | Title | Owner Type | Estimated Time | Dependencies |
|--------|-------|------------|----------------|--------------|
| 1 | Database Foundation & Schema Migration | Database Specialist | 4-6 hours | None |
| 2 | Core DTOs & Service Logic | Service Layer Specialist | 5-7 hours | Sprint 1 |
| 3 | Tenant CRUD Controller & Module Registration | API Layer Specialist | 4-6 hours | Sprint 2 |
| 4 | Admin API Extensions | Admin API Specialist | 3-4 hours | Sprint 3 |
| 5 | IVR Integration | IVR Integration Specialist | 5-6 hours | Sprint 3 |
| 6 | SIP Service TwiML Update | Telephony Integration Specialist | 3-4 hours | Sprint 5 |
| 7 | Context Builder Integration | Context Assembly Specialist | 5-7 hours | Sprint 6 |
| 8 | Internal Endpoint Update | Internal API Specialist | 2-3 hours | Sprint 7 |
| 9 | API Documentation & E2E Testing | Documentation & QA Specialist | 6-8 hours | Sprint 1-8 |

**Backend Total**: 40-50 hours

---

### Frontend Implementation (Sprints 10-12)

| Sprint | Title | Owner Type | Estimated Time | Dependencies |
|--------|-------|------------|----------------|--------------|
| 10 | Frontend - Voice Agent Profile Management UI | Frontend UI Specialist | 6-8 hours | Sprint 9 (API complete) |
| 11 | Frontend - IVR Builder Extension | IVR UI Specialist | 5-7 hours | Sprint 5, 10 |
| 12 | Frontend - Admin UI Extensions | Admin UI Specialist | 4-5 hours | Sprint 4, 10 |

**Frontend Total**: 15-20 hours

---

## 🚀 Quick Start Guide

### For Backend Developers

**Start with Sprint 1**:
```bash
# Read the sprint file
cat /var/www/lead360.app/documentation/sprints/voice-multilangual/sprint_1_database_foundation.md

# Follow instructions exactly
# Complete all acceptance criteria
# Fill out completion report
```

**Progress sequentially**: Sprint 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

---

### For Frontend Developers

**⚠️ CRITICAL**: Backend must complete Sprint 9 (API documentation) BEFORE starting Sprint 10.

**Start with Sprint 10**:
```bash
# Read the sprint file
cat /var/www/lead360.app/documentation/sprints/voice-multilangual/sprint_10_frontend_profile_crud.md

# FIRST: Hit all API endpoints with curl to verify
# THEN: Build the UI
```

**Key Rule**: **ALWAYS verify API endpoints FIRST** before developing UI. Never rely solely on documentation.

---

## 🔐 Test Credentials

**Database**:
```
mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360
```

**User Accounts**:
- **System Admin**: `ludsonaiello@gmail.com` / `978@F32c`
- **Tenant User**: `contact@honeydo4you.com` / `978@F32c`

**Server**:
- Backend: `npm run start:dev` in `/var/www/lead360.app/api/`
- Frontend: `npm run dev` in `/var/www/lead360.app/app/`
- API Base: `http://localhost:8000/api/v1`
- Swagger Docs: `http://localhost:8000/api/docs`

---

## 📊 Sprint Dependencies Diagram

```
Backend Flow:
Sprint 1 (DB) → Sprint 2 (Service) → Sprint 3 (API)
                                       ↓
                Sprint 4 (Admin) ←────┘
                       ↓
                Sprint 5 (IVR) → Sprint 6 (SIP) → Sprint 7 (Context) → Sprint 8 (Internal)
                       ↓                                                       ↓
                Sprint 9 (API Docs & Testing) ←────────────────────────────────┘

Frontend Flow:
Sprint 9 (Backend Complete) → Sprint 10 (Profile UI)
                                    ↓
            Sprint 11 (IVR UI) ←────┴────→ Sprint 12 (Admin UI)
```

---

## ✅ Acceptance Criteria Overview

### Backend Complete When:
- ✅ All 5 tenant endpoints working (POST, GET, GET/:id, PATCH, DELETE)
- ✅ All 2 admin extensions working (plan config + tenant override)
- ✅ IVR accepts `agent_profile_id` in voice_ai config
- ✅ SIP headers include `X-Agent-Profile-Id`
- ✅ Context builder resolves language/voice from profile
- ✅ 100% API documentation written
- ✅ All tests passing (>80% coverage)
- ✅ Multi-tenant isolation verified
- ✅ RBAC enforced on all endpoints

### Frontend Complete When:
- ✅ Profile management UI (list, create, edit, delete) working
- ✅ IVR builder shows profile selector for voice_ai actions
- ✅ Admin UI shows plan limit + default profile settings
- ✅ All forms validate correctly
- ✅ Error handling works (403, 409 errors shown)
- ✅ Mobile responsive
- ✅ Loading/success states shown

### Full Feature Complete When:
- ✅ End-to-end flow works: Create profile → Add to IVR → Call arrives → Correct language/voice used
- ✅ Plan limits enforced (UI + API)
- ✅ Multi-tenant isolation perfect (UI + API)
- ✅ Graceful fallbacks (inactive profile, missing profile)

---

## 🎯 Key Business Rules

1. **Plan Limits**: Active profiles ≤ `subscription_plan.voice_ai_max_agent_profiles`
2. **Uniqueness**: `(language_code + title)` unique per tenant
3. **Voice AI Enabled**: Tenant's plan must have `voice_ai_enabled = true`
4. **IVR References**: Cannot delete profile if used in active IVR config
5. **Deactivation**: Deactivating default profile clears `tenant_voice_ai_settings.default_agent_profile_id`
6. **Tenant Isolation**: ALL queries filter by `tenant_id` (CRITICAL)

---

## 📚 Key Documents

### Planning & Architecture
- **Main Plan**: `/root/.claude/plans/agile-rolling-clock.md`
- **Feature Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md`

### API Documentation (Created in Sprint 9)
- **API Docs**: `/var/www/lead360.app/api/documentation/voice_agent_profiles_REST_API.md`

### Sprint Files
- **Backend**: `/var/www/lead360.app/documentation/sprints/voice-multilangual/sprint_1_*.md` through `sprint_9_*.md`
- **Frontend**: `/var/www/lead360.app/documentation/sprints/voice-multilangual/sprint_10_*.md` through `sprint_12_*.md`

---

## 🔍 Quality Standards

Every sprint developer must be a **MASTERCLASS DEVELOPER**:
- ✅ **Think deeply** - No rushing, no guessing
- ✅ **Review existing code** - Understand patterns before writing
- ✅ **Respect tenant isolation** - EVERY query filters by tenant_id
- ✅ **Enforce RBAC** - Correct guards on all endpoints/pages
- ✅ **Write tests** - Unit + integration, >80% coverage
- ✅ **Verify API first** (frontend only) - Hit endpoints before building UI
- ✅ **100% quality or beyond** - Production-ready code only

---

## 🚨 Critical Rules for Frontend Developers

### Rule #1: API Verification FIRST (NON-NEGOTIABLE)

**BEFORE writing ANY UI code**:
1. Login and get JWT token
2. Hit ALL API endpoints with curl
3. Save actual responses
4. Verify responses match API documentation 100%
5. Report ANY mismatches to backend team
6. Only proceed after API is verified

**Example Verification**:
```bash
# Get token
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' \
  | jq -r '.access_token')

# Test create endpoint
curl -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","language_code":"en","voice_id":"test"}' | jq

# If response doesn't match docs → STOP and report
```

### Rule #2: Use Existing UI Components

**Before creating ANY new component**, check:
- `/var/www/lead360.app/app/src/components/ui/` - Button, Input, Select, Modal, etc.
- Existing admin pages (`app/src/app/(dashboard)/admin/rbac/`) - patterns to follow

**NEVER create new components for common UI elements** - reuse existing.

---

## 📈 Progress Tracking

Use this checklist to track sprint completion:

**Backend**:
- [ ] Sprint 1: Database Foundation
- [ ] Sprint 2: Core Service & DTOs
- [ ] Sprint 3: Tenant CRUD Controller
- [ ] Sprint 4: Admin Extensions
- [ ] Sprint 5: IVR Integration
- [ ] Sprint 6: SIP Service TwiML
- [ ] Sprint 7: Context Builder
- [ ] Sprint 8: Internal Endpoint
- [ ] Sprint 9: API Documentation & Testing

**Frontend**:
- [ ] Sprint 10: Profile Management UI
- [ ] Sprint 11: IVR Builder Extension
- [ ] Sprint 12: Admin UI Extensions

**Integration Testing**:
- [ ] End-to-end flow tested
- [ ] All acceptance criteria verified
- [ ] Production deployment checklist complete

---

## 🎉 Definition of Done

The multi-language voice agent profiles feature is **DONE** when:

1. ✅ All 12 sprints complete
2. ✅ All acceptance criteria met
3. ✅ End-to-end flow tested: Create profile → Add to IVR → Make call → Verify language/voice
4. ✅ All tests passing (backend + frontend)
5. ✅ API documentation 100% complete
6. ✅ Multi-tenant isolation verified
7. ✅ Plan limits enforced
8. ✅ RBAC working
9. ✅ Mobile responsive
10. ✅ Production-ready

---

**Ready to build? Start with Sprint 1!** 🚀
