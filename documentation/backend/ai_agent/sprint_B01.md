YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B01 — Database Schema + Migration

**Module**: Voice AI
**Sprint**: B01
**Depends on**: Nothing (first sprint)

---

## Objective

Create all 7 new Prisma models for the Voice AI module, extend `subscription_plan` with voice AI fields, and run the migration.

---

## Pre-Coding Checklist

- [ ] Read `/api/prisma/schema.prisma` fully — especially `subscription_plan`, `tenant`, `ivr_configuration`, `call_record` models as reference
- [ ] Read `documentation/contracts/ai_agent/voice_ai_contract.md` (Data Model section)
- [ ] Verify DB connection: check `/var/www/lead360.app/api/.env` for `DATABASE_URL`

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: Add Voice AI Models to Prisma Schema

Add the following models to `/api/prisma/schema.prisma`. Place them after the IVR/call models section.

### Model: voice_ai_provider

```prisma
model voice_ai_provider {
  id               String   @id @default(uuid()) @db.VarChar(36)
  provider_key     String   @unique @db.VarChar(50)   // e.g. 'deepgram', 'openai', 'cartesia'
  provider_type    String   @db.VarChar(10)            // STT, LLM, TTS
  display_name     String   @db.VarChar(100)
  description      String?  @db.Text
  logo_url         String?  @db.VarChar(500)
  documentation_url String? @db.VarChar(500)
  capabilities     String?  @db.Text    // JSON: ["streaming", "multilingual", "emotion"]
  config_schema    String?  @db.LongText // JSON Schema for provider-specific config options
  default_config   String?  @db.Text    // JSON: default config values for this provider
  pricing_info     String?  @db.Text    // JSON: { per_minute, per_token, currency }
  is_active        Boolean  @default(true)
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  credentials      voice_ai_credentials?
  usage_records    voice_usage_record[]
  global_config_stt voice_ai_global_config[] @relation("stt_provider")
  global_config_llm voice_ai_global_config[] @relation("llm_provider")
  global_config_tts voice_ai_global_config[] @relation("tts_provider")

  @@index([provider_type])
  @@index([is_active])
  @@map("voice_ai_provider")
}
```

### Model: voice_ai_credentials

```prisma
model voice_ai_credentials {
  id                String   @id @default(uuid()) @db.VarChar(36)
  provider_id       String   @unique @db.VarChar(36)
  encrypted_api_key String   @db.LongText   // AES-256-GCM via EncryptionService
  masked_api_key    String   @db.VarChar(20) // e.g. "sk-...XYZ9"
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  updated_by        String?  @db.VarChar(36) // admin user ID who last updated

  provider voice_ai_provider @relation(fields: [provider_id], references: [id])

  @@map("voice_ai_credentials")
}
```

### Model: voice_ai_global_config

```prisma
model voice_ai_global_config {
  id                               String   @id @db.VarChar(36)
  // Provider selection
  default_stt_provider_id          String?  @db.VarChar(36)
  default_llm_provider_id          String?  @db.VarChar(36)
  default_tts_provider_id          String?  @db.VarChar(36)
  // Per-provider default config (JSON blobs matching each provider's config_schema)
  default_stt_config               String?  @db.Text  // JSON e.g. {"model":"nova-2","punctuate":true}
  default_llm_config               String?  @db.Text  // JSON e.g. {"model":"gpt-4o-mini","temperature":0.7}
  default_tts_config               String?  @db.Text  // JSON e.g. {"model":"sonic-english","speed":1.0}
  // Default behavior
  default_voice_id                 String?  @db.VarChar(100)
  default_language                 String   @default("en") @db.VarChar(10)
  default_languages                String   @default("[\"en\"]") @db.Text // JSON array of enabled langs
  default_greeting_template        String   @default("Hello, thank you for calling {business_name}! How can I help you today?") @db.Text
  default_system_prompt            String   @default("You are a helpful phone assistant. Be concise, friendly, and professional.") @db.Text
  default_max_call_duration_seconds Int     @default(600)
  default_transfer_behavior        String   @default("end_call") @db.VarChar(20) // end_call | voicemail | hold
  // Default tools enabled
  default_tools_enabled            String   @default("{\"booking\":true,\"lead_creation\":true,\"call_transfer\":true}") @db.Text
  // LiveKit infrastructure
  livekit_sip_trunk_url            String?  @db.VarChar(255)
  livekit_api_key                  String?  @db.Text     // encrypted
  livekit_api_secret               String?  @db.Text     // encrypted
  // Agent auth
  agent_api_key_hash               String?  @db.VarChar(128)
  agent_api_key_preview            String?  @db.VarChar(10)
  // Limits
  max_concurrent_calls             Int      @default(100)
  updated_at                       DateTime @updatedAt
  updated_by                       String?  @db.VarChar(36)

  stt_provider voice_ai_provider? @relation("stt_provider", fields: [default_stt_provider_id], references: [id])
  llm_provider voice_ai_provider? @relation("llm_provider", fields: [default_llm_provider_id], references: [id])
  tts_provider voice_ai_provider? @relation("tts_provider", fields: [default_tts_provider_id], references: [id])

  @@map("voice_ai_global_config")
}
```

### Model: tenant_voice_ai_settings

```prisma
model tenant_voice_ai_settings {
  id                          String   @id @default(uuid()) @db.VarChar(36)
  tenant_id                   String   @unique @db.VarChar(36)
  is_enabled                  Boolean  @default(false)
  // Language config
  default_language            String   @default("en") @db.VarChar(10)
  enabled_languages           String   @default("[\"en\"]") @db.Text // JSON array
  // Behavior
  custom_greeting             String?  @db.Text
  custom_instructions         String?  @db.Text
  after_hours_behavior        String?  @db.VarChar(20) // transfer | voicemail | end_call | null=inherit
  // Tool enablement (null = inherit from global)
  booking_enabled             Boolean? // null means inherit global default
  lead_creation_enabled       Boolean? // null means inherit global default
  transfer_enabled            Boolean? // null means inherit global default
  default_transfer_number     String?  @db.VarChar(20)
  // Call duration
  max_call_duration_seconds   Int?     // null = inherit global default
  // Admin controls
  monthly_minutes_override    Int?
  admin_notes                 String?  @db.Text // internal notes by platform admin
  // Provider overrides (null = use global defaults)
  stt_provider_override_id    String?  @db.VarChar(36)
  llm_provider_override_id    String?  @db.VarChar(36)
  tts_provider_override_id    String?  @db.VarChar(36)
  // Per-provider config overrides (null = use global defaults)
  stt_config_override         String?  @db.Text // JSON
  llm_config_override         String?  @db.Text // JSON
  tts_config_override         String?  @db.Text // JSON
  voice_id_override           String?  @db.VarChar(100)
  // Audit
  created_at                  DateTime @default(now())
  updated_at                  DateTime @updatedAt
  updated_by                  String?  @db.VarChar(36)

  tenant tenant @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id])
  @@map("tenant_voice_ai_settings")
}
```

### Model: tenant_voice_transfer_number

```prisma
model tenant_voice_transfer_number {
  id              String    @id @default(uuid()) @db.VarChar(36)
  tenant_id       String    @db.VarChar(36)
  label           String    @db.VarChar(100)         // e.g. "Sales", "Emergency"
  phone_number    String    @db.VarChar(20)           // E.164 format
  transfer_type   String    @default("primary") @db.VarChar(20)  // primary | overflow | after_hours | emergency
  description     String?   @db.VarChar(255)         // human-readable note
  is_default      Boolean   @default(false)
  display_order   Int       @default(0)              // for reordering
  available_hours String?   @db.Text                 // JSON: {"mon":["09:00","17:00"],"tue":...} null=always
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  tenant tenant @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id])
  @@index([tenant_id, is_default])
  @@index([tenant_id, display_order])
  @@map("tenant_voice_transfer_number")
}
```

**CONSTRAINT NOTE**: Only one row per tenant can have `is_default=true`. Enforce this in the service layer (transaction: set all `is_default=false` for tenant, then set `is_default=true` for the target row).

### Model: voice_call_log

```prisma
model voice_call_log {
  id                  String    @id @default(uuid()) @db.VarChar(36)
  tenant_id           String    @db.VarChar(36)
  call_sid            String    @unique @db.VarChar(100)  // LiveKit call identifier
  from_number         String    @db.VarChar(20)
  to_number           String    @db.VarChar(20)
  direction           String    @default("inbound") @db.VarChar(10)
  status              String    @default("in_progress") @db.VarChar(20)  // in_progress | completed | failed
  outcome             String?   @db.VarChar(50)   // completed | transferred | voicemail | abandoned | error
  is_overage          Boolean   @default(false)
  duration_seconds    Int?
  transcript_summary  String?   @db.Text
  full_transcript     String?   @db.LongText
  actions_taken       String?   @db.Text          // JSON array of action names
  lead_id             String?   @db.VarChar(36)
  // Provider tracking (which provider handled this call)
  stt_provider_id     String?   @db.VarChar(36)
  llm_provider_id     String?   @db.VarChar(36)
  tts_provider_id     String?   @db.VarChar(36)
  // Timestamps
  started_at          DateTime  @default(now())
  ended_at            DateTime?
  created_at          DateTime  @default(now())

  tenant           tenant              @relation(fields: [tenant_id], references: [id])
  usage_records    voice_usage_record[]

  @@index([tenant_id])
  @@index([tenant_id, started_at])
  @@index([call_sid])
  @@index([tenant_id, outcome])
  @@map("voice_call_log")
}
```

### Model: voice_usage_record

**ARCHITECTURE**: Per-call, per-provider granular billing records. NOT a monthly aggregate counter. This enables accurate cost tracking and reconciliation.

```prisma
model voice_usage_record {
  id               String    @id @default(uuid()) @db.VarChar(36)
  tenant_id        String    @db.VarChar(36)
  call_log_id      String    @db.VarChar(36)     // which call generated this usage
  provider_id      String    @db.VarChar(36)     // which provider (Deepgram, OpenAI, Cartesia)
  provider_type    String    @db.VarChar(10)     // STT | LLM | TTS
  usage_quantity   Decimal   @db.Decimal(12, 4)  // seconds, tokens, characters depending on unit
  usage_unit       String    @db.VarChar(20)     // seconds | tokens | characters
  estimated_cost   Decimal?  @db.Decimal(12, 6)  // in USD
  year             Int       // for efficient monthly reporting queries
  month            Int       // for efficient monthly reporting queries
  billed_at        DateTime  @default(now())
  created_at       DateTime  @default(now())

  tenant    tenant          @relation(fields: [tenant_id], references: [id])
  call_log  voice_call_log  @relation(fields: [call_log_id], references: [id])
  provider  voice_ai_provider @relation(fields: [provider_id], references: [id])

  @@index([tenant_id])
  @@index([tenant_id, year, month])
  @@index([call_log_id])
  @@index([provider_id])
  @@map("voice_usage_record")
}
```

---

## Task 2: Extend subscription_plan

Find the `subscription_plan` model in the schema and add these fields:

```prisma
  voice_ai_enabled           Boolean  @default(false)
  voice_ai_minutes_included  Int      @default(0)
  voice_ai_overage_rate      Decimal? @db.Decimal(10, 4)  // USD per minute, null = no overage allowed
```

---

## Task 3: Add Relations to Tenant Model

Add to the `tenant` model relations:

```prisma
  voice_ai_settings      tenant_voice_ai_settings?
  voice_transfer_numbers tenant_voice_transfer_number[]
  voice_call_logs        voice_call_log[]
  voice_usage_records    voice_usage_record[]
```

---

## Task 4: Run Migration

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_voice_ai_module
npx prisma generate
```

Verify migration applied: check that all 7 new tables exist in the database.

---

## Task 5: Update PrismaService TENANT_SCOPED_MODELS

Find `/api/src/core/database/prisma.service.ts` (or equivalent tenant middleware). Add the new tenant-scoped models to the list that gets tenant_id validation:

- `tenant_voice_ai_settings`
- `tenant_voice_transfer_number`
- `voice_call_log`
- `voice_usage_record`

**Note**: `voice_ai_provider`, `voice_ai_credentials`, `voice_ai_global_config` are NOT tenant-scoped — do NOT add them to tenant validation.

---

## Task 6: Seed Default Global Config + Providers

Create or update `/api/prisma/seed.ts` to insert:

**1. Singleton global config row:**
```typescript
await prisma.voice_ai_global_config.upsert({
  where: { id: 'default' },
  update: {},
  create: {
    id: 'default',
    default_language: 'en',
    default_languages: JSON.stringify(['en']),
    default_tools_enabled: JSON.stringify({ booking: true, lead_creation: true, call_transfer: true }),
    default_transfer_behavior: 'end_call',
  },
});
```

**2. Three default providers:**
```typescript
const providers = [
  {
    provider_key: 'deepgram',
    provider_type: 'STT',
    display_name: 'Deepgram',
    description: 'State-of-the-art speech recognition with Nova-2 model',
    logo_url: 'https://deepgram.com/favicon.ico',
    documentation_url: 'https://developers.deepgram.com',
    capabilities: JSON.stringify(['streaming', 'multilingual', 'punctuation', 'diarization']),
    default_config: JSON.stringify({ model: 'nova-2', punctuate: true, interim_results: true }),
    config_schema: JSON.stringify({
      type: 'object',
      properties: {
        model: { type: 'string', enum: ['nova-2', 'nova-2-general', 'nova-2-phonecall'], default: 'nova-2' },
        punctuate: { type: 'boolean', default: true },
        interim_results: { type: 'boolean', default: true },
      }
    }),
  },
  {
    provider_key: 'openai',
    provider_type: 'LLM',
    display_name: 'OpenAI',
    description: 'GPT-4o-mini optimized for low-latency voice conversations',
    logo_url: 'https://openai.com/favicon.ico',
    documentation_url: 'https://platform.openai.com/docs',
    capabilities: JSON.stringify(['function_calling', 'streaming', 'multilingual']),
    default_config: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 500 }),
    config_schema: JSON.stringify({
      type: 'object',
      properties: {
        model: { type: 'string', enum: ['gpt-4o-mini', 'gpt-4o'], default: 'gpt-4o-mini' },
        temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
        max_tokens: { type: 'integer', minimum: 100, maximum: 4096, default: 500 },
      }
    }),
  },
  {
    provider_key: 'cartesia',
    provider_type: 'TTS',
    display_name: 'Cartesia',
    description: 'Ultra-low latency neural text-to-speech with natural voices',
    logo_url: 'https://cartesia.ai/favicon.ico',
    documentation_url: 'https://docs.cartesia.ai',
    capabilities: JSON.stringify(['streaming', 'voice_cloning', 'multilingual', 'emotion']),
    default_config: JSON.stringify({ model: 'sonic-english', speed: 1.0, emotion: [] }),
    config_schema: JSON.stringify({
      type: 'object',
      properties: {
        model: { type: 'string', enum: ['sonic-english', 'sonic-multilingual'], default: 'sonic-english' },
        speed: { type: 'number', minimum: 0.5, maximum: 2.0, default: 1.0 },
      }
    }),
  },
];

for (const p of providers) {
  await prisma.voice_ai_provider.upsert({
    where: { provider_key: p.provider_key },
    update: p,
    create: p,
  });
}
```

---

## Acceptance Criteria

- [ ] All 7 new tables created in database with correct columns
- [ ] `subscription_plan` has 3 new voice AI columns
- [ ] `voice_ai_provider` has `config_schema`, `default_config`, `capabilities`, `pricing_info`, `logo_url`, `documentation_url`
- [ ] `voice_ai_credentials` has `updated_by`
- [ ] `voice_ai_global_config` has `default_stt_config`, `default_llm_config`, `default_tts_config`, `default_tools_enabled`, `default_languages`, `default_transfer_behavior`
- [ ] `tenant_voice_ai_settings` has `stt_config_override`, `llm_config_override`, `tts_config_override`, `voice_id_override`, `admin_notes`, `default_language`, `after_hours_behavior`, `updated_by`
- [ ] `tenant_voice_transfer_number` has `transfer_type`, `description`, `available_hours`, `display_order`
- [ ] `voice_call_log` has `stt_provider_id`, `llm_provider_id`, `tts_provider_id`
- [ ] `voice_usage_record` is per-call per-provider (NOT monthly aggregate): has `call_log_id`, `provider_id`, `provider_type`, `usage_quantity`, `usage_unit`, `estimated_cost`, `year`, `month`
- [ ] Migration runs without errors
- [ ] `npx prisma generate` completes without errors
- [ ] `npm run build` completes without TypeScript errors
- [ ] `voice_ai_global_config` has one row with id='default'
- [ ] 3 provider rows seeded (deepgram, openai, cartesia)
