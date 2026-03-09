# Sprint 14: Clean Schema Setup (CLEAN UPGRADE)
## Voice Multilingual Architecture - Fresh Implementation

**Sprint 14** of 21 (SIMPLIFIED)
**Owner**: Database Architect
**Effort**: 1-2 hours
**Type**: CLEAN UPGRADE (No migration complexity)

---

## 🎯 CLEAN UPGRADE APPROACH

**No backward compatibility needed**
**No data migration**
**Fresh schema setup**
**Clean slate implementation**

---

## Goal

Create fresh database schema for global profiles + tenant overrides architecture:

1. Drop old tables (if exist)
2. Create `voice_ai_agent_profile` (global)
3. Create `tenant_voice_agent_profile_override` (tenant customizations)
4. Add all indexes and constraints
5. Done!

---

## Task 1: Update Prisma Schema

**File**: `/var/www/lead360.app/api/prisma/schema.prisma`

### 1.1 Add Global Profile Model

```prisma
/// Global voice agent profiles (system admin managed)
model voice_ai_agent_profile {
  id                   String   @id @default(uuid()) @db.VarChar(36)
  language_code        String   @db.VarChar(10)
  language_name        String   @db.VarChar(100)
  voice_id             String   @db.VarChar(200)
  voice_provider_type  String   @default("tts") @db.VarChar(20)
  default_greeting     String?  @db.Text
  default_instructions String?  @db.LongText
  display_name         String   @unique @db.VarChar(100)
  description          String?  @db.Text
  is_active            Boolean  @default(true)
  display_order        Int      @default(0)
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt
  updated_by           String?  @db.VarChar(36)

  tenant_overrides     tenant_voice_agent_profile_override[]

  @@index([language_code])
  @@index([is_active])
  @@map("voice_ai_agent_profile")
}
```

### 1.2 Create Override Model (Fresh)

```prisma
/// Tenant overrides for global profiles
model tenant_voice_agent_profile_override {
  id                  String   @id @default(uuid()) @db.VarChar(36)
  tenant_id           String   @db.VarChar(36)
  agent_profile_id    String   @db.VarChar(36)
  custom_greeting     String?  @db.Text
  custom_instructions String?  @db.LongText
  is_active           Boolean  @default(true)
  display_order       Int      @default(0)
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
  updated_by          String?  @db.VarChar(36)

  tenant              tenant                 @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  agent_profile       voice_ai_agent_profile @relation(fields: [agent_profile_id], references: [id], onDelete: Cascade)

  @@index([tenant_id])
  @@index([tenant_id, agent_profile_id])
  @@index([agent_profile_id])
  @@map("tenant_voice_agent_profile_override")
}
```

### 1.3 Update Tenant Relation

In `tenant` model:
```prisma
voice_agent_profile_overrides tenant_voice_agent_profile_override[]
```

---

## Task 2: Drop Old Tables (If Exist)

**SQL**:
```sql
-- Drop old table if exists
DROP TABLE IF EXISTS `tenant_voice_agent_profile`;
```

**Execute**:
```bash
mysql -u lead360_user -p lead360_production -e "
DROP TABLE IF EXISTS tenant_voice_agent_profile;
"
```

---

## Task 3: Create Migration

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name clean_voice_profiles_setup
```

**This creates fresh tables with correct structure.**

---

## Task 4: Verify

```bash
mysql -u lead360_user -p lead360_production -e "
SHOW TABLES LIKE '%voice%agent%profile%';
DESCRIBE voice_ai_agent_profile;
DESCRIBE tenant_voice_agent_profile_override;
"
```

**Expected**:
- ✅ `voice_ai_agent_profile` exists
- ✅ `tenant_voice_agent_profile_override` exists
- ✅ All columns correct
- ✅ All constraints in place

---

## Acceptance Criteria

- [ ] Old table dropped
- [ ] New tables created
- [ ] All indexes present
- [ ] FK constraints working
- [ ] Prisma client regenerated
- [ ] No TypeScript errors

---

**Next**: Sprint 15 - Seed default global profiles

**Status**: CLEAN & SIMPLE ✅
