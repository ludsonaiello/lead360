# Sprint BAS01 — Database Schema

**Module**: Voice AI
**Sprint**: BAS01
**Depends on**: BAS00 (cleanup complete)
**Estimated size**: 1 file modified, 1 migration, ~200 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `api/prisma/schema.prisma` completely — all 3600+ lines
- Understand every existing relation before adding new models
- NEVER guess column types — check existing similar models for patterns
- Use existing naming conventions: snake_case tables, uuid PKs, `created_at`/`updated_at`
- Run `npm run build` before AND after your changes — 0 errors required

---

## Objective

Verify the Prisma schema contains all 6 Voice AI tables required by the contract. Add any missing models or columns. Run the migration. The schema must exactly match the contract spec — no extra columns, no missing ones.

---

## Pre-Coding Checklist

- [ ] BAS00 complete (Python agent removed)
- [ ] Read `api/prisma/schema.prisma` — find all existing `voice_ai_*` models
- [ ] Read `api/prisma/schema.prisma` — find `subscription_plan` model (for extension)
- [ ] Read `api/prisma/schema.prisma` — find `tenant` model (for relation FK)
- [ ] Read `api/prisma/schema.prisma` — find `lead` model (for relation FK in call log)
- [ ] Read `api/prisma/schema.prisma` — find `user` model (for `updated_by` FKs)
- [ ] Verify `.env` has `DATABASE_URL` — `cat /var/www/lead360.app/api/.env | grep DATABASE_URL`

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Tenant login | `contato@honeydo4you.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |
| Encryption key | Read `ENCRYPTION_KEY` from `/var/www/lead360.app/api/.env` |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/prisma/schema.prisma` | Understand ALL existing models before modifying — DO NOT guess |
| `api/src/modules/voice-ai/voice-ai.module.ts` | Understand what's already registered |
| `documentation/contracts/ai_agent/node_ai_Agent_contract.md` | Section "DATA MODEL" — source of truth for required schema |

---

## Task 1: Audit Existing Voice AI Models

Open `api/prisma/schema.prisma` and search for these model names:

```
voice_ai_provider
voice_ai_credentials
voice_ai_global_config
tenant_voice_ai_settings
tenant_voice_transfer_number
voice_call_log
voice_monthly_usage
```

For each model found, compare it against the contract spec. Check:
- All columns present with correct types
- All indexes defined
- All relations correct (FK names, `onDelete` behavior)
- `@@map()` name matches exact table name in contract

---

## Task 2: Verify Required Models

The schema MUST have exactly these 6 new models (plus subscription_plan extension):

### voice_ai_provider

```prisma
model voice_ai_provider {
  id                String   @id @default(uuid()) @db.VarChar(36)
  provider_key      String   @unique @db.VarChar(50)
  provider_type     String   @db.VarChar(10)       // 'STT', 'LLM', 'TTS'
  display_name      String   @db.VarChar(100)
  description       String?  @db.Text
  logo_url          String?  @db.VarChar(500)
  documentation_url String?  @db.VarChar(500)
  capabilities      String?  @db.Text               // JSON array
  config_schema     String?  @db.LongText           // JSON Schema for credentials
  default_config    String?  @db.Text               // JSON defaults
  pricing_info      String?  @db.Text               // JSON pricing
  is_active         Boolean  @default(true)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  credentials       voice_ai_credentials?

  @@index([provider_type])
  @@index([is_active])
  @@map("voice_ai_provider")
}
```

### voice_ai_credentials

```prisma
model voice_ai_credentials {
  id                String   @id @default(uuid()) @db.VarChar(36)
  provider_id       String   @unique @db.VarChar(36)
  encrypted_api_key String   @db.LongText
  masked_api_key    String   @db.VarChar(20)        // 'sk-...xyz'
  additional_config String?  @db.Text               // JSON extra settings
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  updated_by        String?  @db.VarChar(36)

  provider          voice_ai_provider @relation(fields: [provider_id], references: [id], onDelete: Cascade)
  updated_by_user   user?             @relation(fields: [updated_by], references: [id])

  @@map("voice_ai_credentials")
}
```

### voice_ai_global_config

```prisma
model voice_ai_global_config {
  id                           String   @id @default("default") @db.VarChar(36)
  agent_enabled                Boolean  @default(false)
  default_stt_provider_id      String?  @db.VarChar(36)
  default_llm_provider_id      String?  @db.VarChar(36)
  default_tts_provider_id      String?  @db.VarChar(36)
  default_voice_id             String?  @db.VarChar(100)
  default_language             String   @default("en") @db.VarChar(10)
  default_greeting_template    String?  @db.Text
  default_system_prompt        String?  @db.LongText
  default_max_call_seconds     Int      @default(300)
  livekit_url                  String?  @db.VarChar(255)       // LiveKit WebSocket URL (wss://...)
  livekit_api_key_encrypted    String?  @db.LongText           // Encrypted LiveKit API key
  livekit_api_secret_encrypted String?  @db.LongText           // Encrypted LiveKit API secret
  max_concurrent_calls         Int      @default(10)
  // IMPORTANT: The existing voice-ai-sip.service.ts may reference `livekit_sip_trunk_url`
  // which is NOT a column in this schema. After running migration, search for that reference:
  //   grep -r "livekit_sip_trunk_url" /var/www/lead360.app/api/src/
  // If found, update those references to use `livekit_url` instead.
  created_at                   DateTime @default(now())
  updated_at                   DateTime @updatedAt
  updated_by                   String?  @db.VarChar(36)

  stt_provider                 voice_ai_provider? @relation("global_stt", fields: [default_stt_provider_id], references: [id])
  llm_provider                 voice_ai_provider? @relation("global_llm", fields: [default_llm_provider_id], references: [id])
  tts_provider                 voice_ai_provider? @relation("global_tts", fields: [default_tts_provider_id], references: [id])

  @@map("voice_ai_global_config")
}
```

**Note**: The `voice_ai_provider` model needs 3 named reverse-relations for the global config. Check if they exist:
```prisma
// In voice_ai_provider, add if missing:
global_config_stt  voice_ai_global_config[] @relation("global_stt")
global_config_llm  voice_ai_global_config[] @relation("global_llm")
global_config_tts  voice_ai_global_config[] @relation("global_tts")
```

### tenant_voice_ai_settings

```prisma
model tenant_voice_ai_settings {
  id                         String   @id @default(uuid()) @db.VarChar(36)
  tenant_id                  String   @unique @db.VarChar(36)
  is_enabled                 Boolean  @default(false)
  enabled_languages          String?  @db.Text          // JSON: ["en","es","pt"]
  custom_greeting            String?  @db.Text
  custom_instructions        String?  @db.LongText
  booking_enabled            Boolean  @default(true)
  lead_creation_enabled      Boolean  @default(true)
  transfer_enabled           Boolean  @default(true)
  default_transfer_number_id String?  @db.VarChar(36)
  max_call_duration_seconds  Int?
  monthly_minutes_override   Int?
  created_at                 DateTime @default(now())
  updated_at                 DateTime @updatedAt

  tenant                     tenant                       @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  default_transfer_number    tenant_voice_transfer_number? @relation(fields: [default_transfer_number_id], references: [id])

  @@map("tenant_voice_ai_settings")
}
```

### tenant_voice_transfer_number

```prisma
model tenant_voice_transfer_number {
  id            String   @id @default(uuid()) @db.VarChar(36)
  tenant_id     String   @db.VarChar(36)
  label         String   @db.VarChar(100)
  phone_number  String   @db.VarChar(20)
  is_default    Boolean  @default(false)
  is_active     Boolean  @default(true)
  display_order Int      @default(0)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  tenant        tenant                    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  settings      tenant_voice_ai_settings[]

  @@index([tenant_id, is_active])
  @@map("tenant_voice_transfer_number")
}
```

### voice_call_log

```prisma
model voice_call_log {
  id                 String    @id @default(uuid()) @db.VarChar(36)
  tenant_id          String    @db.VarChar(36)
  call_sid           String    @unique @db.VarChar(100)
  room_name          String?   @db.VarChar(100)
  from_number        String    @db.VarChar(20)
  to_number          String    @db.VarChar(20)
  language_used      String?   @db.VarChar(10)
  intent             String?   @db.VarChar(50)
  status             String    @db.VarChar(20)       // 'in_progress','completed','failed','transferred'
  outcome            String?   @db.VarChar(50)       // 'lead_created','transferred','abandoned'
  duration_seconds   Int?
  transcript_summary String?   @db.Text
  full_transcript    String?   @db.LongText
  actions_taken      String?   @db.Text              // JSON array
  lead_id            String?   @db.VarChar(36)
  transferred_to     String?   @db.VarChar(20)
  error_message      String?   @db.Text
  started_at         DateTime  @default(now())
  ended_at           DateTime?
  created_at         DateTime  @default(now())

  tenant             tenant    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  lead               lead?     @relation(fields: [lead_id], references: [id])

  @@index([tenant_id, started_at])
  @@index([tenant_id, status])
  @@map("voice_call_log")
}
```

**Note**: Check the `lead` model in schema — add `voice_call_logs voice_call_log[]` reverse relation if missing.

### voice_monthly_usage

```prisma
model voice_monthly_usage {
  id                     String   @id @default(uuid()) @db.VarChar(36)
  tenant_id              String   @db.VarChar(36)
  year                   Int
  month                  Int
  minutes_used           Int      @default(0)
  overage_minutes        Int      @default(0)
  estimated_overage_cost Decimal? @db.Decimal(10, 4)
  total_calls            Int      @default(0)
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt

  tenant                 tenant   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@unique([tenant_id, year, month])
  @@map("voice_monthly_usage")
}
```

### subscription_plan extension

```prisma
// ADD to existing subscription_plan model (if not already there):
voice_ai_enabled          Boolean  @default(false)
voice_ai_minutes_included Int      @default(0)
voice_ai_overage_rate     Decimal? @db.Decimal(10, 4)
```

---

## Task 3: Fix Discrepancies

After comparing existing schema against the required spec:
1. Add any missing models
2. Add any missing columns to existing models
3. Fix any wrong types or constraints
4. Add missing relations and reverse relations on `tenant`, `lead`, `user`

**Read the existing models carefully before adding relations** — if `tenant` already has `voice_ai_settings tenant_voice_ai_settings?`, do not add it again.

---

## Task 4: Run Migration

```bash
cd /var/www/lead360.app/api

# Generate migration (do NOT use --force-reset in production)
npx prisma migrate dev --name voice_ai_schema

# Verify migration applied
npx prisma migrate status

# Verify tables were created
# Parse credentials from DATABASE_URL in .env (format: mysql://user:password@host:port/database)
# Parse from DATABASE_URL in .env (format: mysql://user:pass@host:port/db)
mysql -u "<user_from_URL>" -p"<pass_from_URL>" "<db_from_URL>" -e "SHOW TABLES LIKE 'voice_%';"
```

---

## Task 5: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

Fix all TypeScript errors before marking this sprint complete. Errors in the Prisma client types indicate a schema mismatch — read the error, find the file causing it, fix it.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/prisma/schema.prisma` | MODIFY | Add/fix Voice AI models |
| `api/prisma/migrations/<timestamp>_voice_ai_schema/migration.sql` | AUTO-CREATED | Migration file (auto-generated by Prisma) |

---

## Acceptance Criteria

- [ ] All 6 voice AI tables exist in the database
- [ ] `subscription_plan` has `voice_ai_enabled`, `voice_ai_minutes_included`, `voice_ai_overage_rate`
- [ ] All `@@index`, `@@unique`, `@@map` directives are correct
- [ ] All FK relations have `onDelete: Cascade` where required
- [ ] `npx prisma migrate status` shows all migrations applied
- [ ] `grep -r "livekit_sip_trunk_url" /var/www/lead360.app/api/src/` — if found, fix those references to use `livekit_url`
- [ ] `npm run build` passes with 0 errors
- [ ] `npx prisma studio` (optional) shows tables with correct columns

---

## Testing

```bash
# Parse DATABASE_URL from .env: mysql://user:password@host:port/database
# Extract and connect — replace <user>, <pass>, <db> with values from DATABASE_URL
mysql -u "<user>" -p"<pass>" "<db>" <<'SQL'
SHOW TABLES LIKE 'voice%';
DESCRIBE voice_ai_provider;
DESCRIBE voice_ai_credentials;
DESCRIBE voice_ai_global_config;
DESCRIBE tenant_voice_ai_settings;
DESCRIBE tenant_voice_transfer_number;
DESCRIBE voice_call_log;
DESCRIBE voice_monthly_usage;
SQL
```
