# Voice Multilingual - CLEAN UPGRADE Execution Order

**Status**: READY TO EXECUTE
**Approach**: Clean upgrade (no backward compatibility)
**Total Time**: 5-8 hours

---

## 🎯 **EXECUTE IN THIS ORDER**

### **PHASE 1: DATABASE (2 hours)**

#### **Sprint 14**: Clean Schema Setup
**File**: `sprint_14_CLEAN.md`
**Time**: 1-2 hours

```bash
# 1. Drop old table
mysql -u lead360_user -p lead360_production -e "
DROP TABLE IF EXISTS tenant_voice_agent_profile;
"

# 2. Update Prisma schema (follow sprint file)
cd /var/www/lead360.app/api

# 3. Create migration
npx prisma migrate dev --name clean_voice_profiles_setup

# 4. Verify tables created
mysql -u lead360_user -p -e "
SHOW TABLES LIKE '%voice%agent%profile%';
"
```

---

#### **Sprint 15**: Seed Default Data
**File**: `sprint_15_CLEAN.md`
**Time**: 30 minutes

```bash
# 1. Update voice IDs in seed script
# Edit: api/scripts/seed-global-profiles.ts
# Replace placeholder voice IDs with real Cartesia IDs

# 2. Run seed
npx ts-node scripts/seed-global-profiles.ts

# 3. Verify
mysql -u lead360_user -p -e "
SELECT display_name, language_code FROM voice_ai_agent_profile;
"
# Expected: 3 profiles (English, Portuguese, Spanish)
```

---

### **PHASE 2: BACKEND API (3-4 hours)**

#### **Sprint 16**: Admin Controller (Global Profiles)
**File**: `sprint_16_admin_global_profiles_controller.md`
**Time**: 1 hour

**Create**:
- `api/src/modules/voice-ai/controllers/admin/voice-ai-global-agent-profiles.controller.ts`
- `api/src/modules/voice-ai/services/voice-ai-global-agent-profiles.service.ts`
- `api/src/modules/voice-ai/dto/create-global-agent-profile.dto.ts`
- `api/src/modules/voice-ai/dto/update-global-agent-profile.dto.ts`

**Test**:
```bash
# POST create profile
curl -X POST /api/v1/system/voice-ai/agent-profiles

# GET list profiles
curl -X GET /api/v1/system/voice-ai/agent-profiles
```

---

#### **Sprint 17**: Tenant Override Controller
**File**: `sprint_17_tenant_override_controller_refactor.md`
**Time**: 1-2 hours

**IMPORTANT**: For clean upgrade, DELETE old files first:
```bash
# Remove old pattern files
rm api/src/modules/voice-ai/controllers/tenant/voice-agent-profiles.controller.ts
rm api/src/modules/voice-ai/services/voice-agent-profiles.service.ts
rm api/src/modules/voice-ai/dto/create-voice-agent-profile.dto.ts
rm api/src/modules/voice-ai/dto/update-voice-agent-profile.dto.ts
```

**Create NEW**:
- `api/src/modules/voice-ai/controllers/tenant/voice-agent-profile-overrides.controller.ts`
- `api/src/modules/voice-ai/services/voice-agent-profile-overrides.service.ts`
- `api/src/modules/voice-ai/dto/create-agent-profile-override.dto.ts`
- `api/src/modules/voice-ai/dto/update-agent-profile-override.dto.ts`

**Endpoints**:
```
GET    /api/v1/voice-ai/available-profiles (list global profiles)
POST   /api/v1/voice-ai/agent-profile-overrides (create override)
GET    /api/v1/voice-ai/agent-profile-overrides (list tenant overrides)
PATCH  /api/v1/voice-ai/agent-profile-overrides/:id (update override)
DELETE /api/v1/voice-ai/agent-profile-overrides/:id (delete override)
```

**Test**:
```bash
# List available profiles
curl -X GET /api/v1/voice-ai/available-profiles

# Create override
curl -X POST /api/v1/voice-ai/agent-profile-overrides \
  -d '{"agent_profile_id":"00000000-0000-0000-0000-000000000001","custom_greeting":"Hello!"}'
```

---

#### **Sprint 18**: Context Builder + IVR Integration
**File**: `sprint_18_context_builder_ivr_integration.md`
**Time**: 1 hour

**SIMPLIFIED FOR CLEAN UPGRADE**:
- No migration checks needed
- No legacy ID handling
- Just implement clean resolution logic

**Update**:
- `api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`
- `api/src/modules/communication/services/ivr-configuration.service.ts`

**Logic**:
1. Load global profile by ID
2. Check for tenant override
3. Merge: global defaults + tenant customizations
4. Return context

**Test**: Make a test call, verify context includes correct language + greeting

---

#### **Sprint 19**: API Documentation
**File**: `sprint_19_api_documentation_update.md`
**Time**: 30 minutes

**Update**:
- `api/documentation/voice_agent_profiles_REST_API.md`
- Document new endpoints
- Add examples

---

### **PHASE 3: FRONTEND (2-3 hours)**

#### **Sprint 20**: Admin UI (Global Profiles)
**File**: `sprint_20_admin_ui_global_profiles.md`
**Time**: 1-2 hours

**Create**:
- `app/src/app/(dashboard)/admin/voice-ai/agent-profiles/page.tsx`
- `app/src/app/(dashboard)/admin/voice-ai/agent-profiles/new/page.tsx`
- `app/src/app/(dashboard)/admin/voice-ai/agent-profiles/[id]/edit/page.tsx`
- `app/src/lib/api/voice-ai-admin.ts`

**Features**:
- List all global profiles
- Create new profile
- Edit existing profile
- Soft delete profile

---

#### **Sprint 21**: Tenant UI + IVR Builder
**File**: `sprint_21_tenant_ui_ivr_builder.md`
**Time**: 1-2 hours

**Create**:
- `app/src/app/(dashboard)/voice-ai/agent-profiles/page.tsx`
- `app/src/app/(dashboard)/voice-ai/agent-profiles/new/page.tsx`
- `app/src/lib/api/voice-ai-tenant.ts`

**Update**:
- IVR builder component (profile selector shows global profiles)

**Features**:
- View available global profiles
- Create override (customize)
- Edit override
- Delete override

---

## ✅ **COMPLETION CHECKLIST**

### **After Sprint 15**:
- [ ] 3 global profiles in database
- [ ] Can query: `SELECT * FROM voice_ai_agent_profile`

### **After Sprint 16**:
- [ ] Admin can create global profiles via API
- [ ] Swagger docs show admin endpoints

### **After Sprint 17**:
- [ ] Tenant can list available profiles
- [ ] Tenant can create override
- [ ] Plan limits enforced

### **After Sprint 18**:
- [ ] Test call works
- [ ] Context includes global profile + tenant override
- [ ] IVR validation accepts global profile IDs

### **After Sprint 21**:
- [ ] Admin UI works (create/edit global profiles)
- [ ] Tenant UI works (select + customize)
- [ ] IVR builder shows global profiles
- [ ] End-to-end flow complete

---

## 🚀 **QUICK REFERENCE**

**Total Sprints**: 8 (14-21)
**Time**: 5-8 hours
**Difficulty**: EASY (clean upgrade, no migration)

**Order**:
1. Sprint 14 (database schema)
2. Sprint 15 (seed data)
3. Sprint 16 (admin API)
4. Sprint 17 (tenant API)
5. Sprint 18 (context builder)
6. Sprint 19 (docs)
7. Sprint 20 (admin UI)
8. Sprint 21 (tenant UI)

---

## 📝 **NOTES**

- **Sprint 17**: DELETE old files first, then create new ones
- **Sprint 18**: No complex migration logic needed (clean implementation)
- **Test after each phase**: Database → Backend → Frontend

---

**START HERE**: Sprint 14 (database) → Work your way up sequentially

**DONE!** 🎉
