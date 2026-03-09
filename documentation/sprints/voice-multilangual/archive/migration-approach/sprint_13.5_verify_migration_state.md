# Sprint 13.5: Verify Migration State (CRITICAL PRE-FLIGHT CHECK)
## Voice Multilingual Architecture Fix

**Sprint Number**: 13.5 (NEW - MANDATORY BEFORE SPRINT 14)
**Sprint Owner**: Database Architect
**Estimated Effort**: 30 minutes - 1 hour
**Prerequisites**: Sprint 13 complete

---

## ⚠️ CRITICAL: THIS SPRINT IS MANDATORY

**WHY THIS EXISTS**: Git status shows migration `20260304_add_multi_language_voice_agent_profiles/` already exists. We MUST verify if it was applied before proceeding.

**IF SKIPPED**: Sprint 14 will either:
- Fail completely (migration already applied)
- Create duplicate tables (catastrophic)
- Corrupt database schema

---

## Sprint Owner Role

You are a **masterclass Database Architect**. You verify BEFORE you act. You never assume migration state.

---

## Goal

**Determine current database state**:
1. Is `voice_ai_agent_profile` table already created?
2. Is `tenant_voice_agent_profile` already renamed?
3. Has data migration already happened?
4. What is the ACTUAL current state?

Based on findings, determine which sprints to execute.

---

## Task 1: Check Prisma Migration Status

### 1.1 Run Migration Status Check

```bash
cd /var/www/lead360.app/api
npx prisma migrate status
```

**Expected Output**:
```
# Scenario A: Migration applied
✔ Database schema is in sync with Prisma schema
Applied migrations:
  ├─ 20260304_add_multi_language_voice_agent_profiles

# Scenario B: Migration not applied
⚠ The following migrations have not been applied:
  └─ 20260304_add_multi_language_voice_agent_profiles

# Scenario C: Schema drift
⚠ Database schema is not in sync with Prisma schema
```

**Document**: Which scenario matches your system?

---

## Task 2: Check Database Tables Directly

### 2.1 Query Database for Table Existence

```bash
mysql -u lead360_user -p lead360_production -e "
SHOW TABLES LIKE '%voice%agent%profile%';
"
```

**Expected Results**:

**Scenario A** (Migration Already Applied):
```
+----------------------------------------+
| Tables_in_lead360 (%voice%agent%...)   |
+----------------------------------------+
| voice_ai_agent_profile                 |  ← GLOBAL PROFILES (new)
| tenant_voice_ai_agent_profile_override | ← OVERRIDES (renamed)
+----------------------------------------+
```

**Scenario B** (Migration NOT Applied):
```
+----------------------------------------+
| Tables_in_lead360 (%voice%agent%...)   |
+----------------------------------------+
| tenant_voice_agent_profile             | ← OLD TABLE (original)
+----------------------------------------+
```

### 2.2 Check Table Structure

**If `voice_ai_agent_profile` exists**:
```bash
mysql -u lead360_user -p lead360_production -e "
DESCRIBE voice_ai_agent_profile;
"
```

**If `tenant_voice_agent_profile` exists**:
```bash
mysql -u lead360_user -p lead360_production -e "
DESCRIBE tenant_voice_agent_profile;
"
```

**Document**: Table structures found.

---

## Task 3: Check for Data

### 3.1 Count Records

**If global profiles table exists**:
```sql
SELECT COUNT(*) as global_profile_count
FROM voice_ai_agent_profile;
```

**If tenant profiles table exists**:
```sql
SELECT COUNT(*) as tenant_profile_count
FROM tenant_voice_agent_profile;
```

**If override table exists**:
```sql
SELECT COUNT(*) as override_count
FROM tenant_voice_ai_agent_profile_override;
```

**Document**: Record counts for each table found.

---

## Task 4: Decision Matrix

Based on findings, determine which sprints to execute:

### **SCENARIO A: Migration Already Applied, Data Migrated**

**Evidence**:
- ✅ `voice_ai_agent_profile` table exists
- ✅ `tenant_voice_ai_agent_profile_override` table exists (renamed)
- ✅ Global profiles exist (count > 0)
- ✅ Overrides exist (count > 0)
- ❌ OLD `tenant_voice_agent_profile` table does NOT exist

**Decision**:
```
SKIP: Sprint 14 (schema already changed)
SKIP: Sprint 15 (data already migrated)
START: Sprint 16 (admin controller)
```

**Actions**:
1. Verify backend code uses CORRECT table names
2. Check if IVR configs were migrated (if not, run Sprint 15B)
3. Proceed to Sprint 16

---

### **SCENARIO B: Migration Applied, Data NOT Migrated**

**Evidence**:
- ✅ `voice_ai_agent_profile` table exists
- ✅ `tenant_voice_ai_agent_profile_override` table exists (renamed)
- ❌ Global profiles DO NOT exist (count = 0)
- ❌ Overrides table empty OR has unmigrated data

**Decision**:
```
SKIP: Sprint 14 (schema already changed)
RUN: Sprint 15 (data migration needed)
RUN: Sprint 15B (IVR migration needed)
START: Sprint 16 after Sprint 15/15B complete
```

**Actions**:
1. Execute Sprint 15 data migration
2. Execute Sprint 15B IVR migration
3. Verify all data migrated correctly
4. Proceed to Sprint 16

---

### **SCENARIO C: Migration NOT Applied (Original State)**

**Evidence**:
- ❌ `voice_ai_agent_profile` table does NOT exist
- ✅ `tenant_voice_agent_profile` table exists (original name)
- ✅ Tenant profiles exist in original table

**Decision**:
```
RUN: Sprint 14 (schema migration)
RUN: Sprint 15 (data migration)
RUN: Sprint 15B (IVR migration)
START: Sprint 16 after all migrations complete
```

**Actions**:
1. Execute Sprint 14 schema migration
2. Execute Sprint 15 data migration
3. Execute Sprint 15B IVR migration
4. Proceed to Sprint 16

---

### **SCENARIO D: Partial/Corrupted State**

**Evidence**:
- Mixed state (some tables exist, some don't)
- Unexpected table names
- Data in wrong places

**Decision**:
```
STOP: Do NOT proceed
ACTION: Restore from backup
ESCALATE: Database corruption, need manual intervention
```

**Actions**:
1. Document exact state found
2. Restore database from backup
3. Investigate what went wrong
4. Start fresh from Sprint 13

---

## Task 5: Document Findings

### 5.1 Create State Report

**File**: `documentation/sprints/voice-multilangual/migration_state_report.md`

```markdown
# Migration State Report

**Date**: YYYY-MM-DD
**Checked by**: [Your name]
**Scenario**: [A, B, C, or D]

## Database State

### Tables Found:
- [ ] voice_ai_agent_profile (global profiles)
- [ ] tenant_voice_ai_agent_profile_override (overrides)
- [ ] tenant_voice_agent_profile (original - should not exist if migrated)

### Record Counts:
- Global profiles: [count]
- Overrides: [count]
- Original tenant profiles: [count]

### Prisma Migration Status:
[Output of npx prisma migrate status]

## Decision

**Sprints to Execute**:
- [ ] Sprint 14 (YES/NO/SKIP)
- [ ] Sprint 15 (YES/NO/SKIP)
- [ ] Sprint 15B (YES/NO/SKIP)
- [ ] Sprint 16+ (READY/WAIT)

**Reasoning**: [Explain why based on scenario]

## Next Steps

1. [First action]
2. [Second action]
3. [etc.]
```

---

## Acceptance Criteria

Sprint 13.5 is complete when:

- [ ] Prisma migration status checked
- [ ] Database tables verified
- [ ] Record counts documented
- [ ] Scenario identified (A, B, C, or D)
- [ ] Decision made (which sprints to run)
- [ ] State report created
- [ ] Team informed of findings

---

## Critical Outputs

**Required File**: `migration_state_report.md` with clear decision

**Required Communication**: Inform team which sprints to execute based on scenario

---

## Next Sprint

**Depends on Scenario**:
- Scenario A → Skip to Sprint 16
- Scenario B → Run Sprint 15
- Scenario C → Run Sprint 14
- Scenario D → STOP and escalate

---

**Sprint Status**: MANDATORY BEFORE PROCEEDING
**Owner**: Database Architect

---

## Quick Reference Decision Table

| Table `voice_ai_agent_profile` | Table `tenant_voice_ai_agent_profile_override` | Data Exists | Scenario | Run Sprints |
|-------------------------------|------------------------------------------------|-------------|----------|-------------|
| ✅ Exists | ✅ Exists | ✅ Yes | A | 16+ only |
| ✅ Exists | ✅ Exists | ❌ No | B | 15, 15B, then 16+ |
| ❌ Missing | ❌ Missing | N/A | C | 14, 15, 15B, then 16+ |
| Mixed | Mixed | Mixed | D | STOP - Corruption |

**Use this table for quick reference during verification.**
