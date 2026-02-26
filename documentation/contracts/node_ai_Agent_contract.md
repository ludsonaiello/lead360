# Voice AI Module - Master Contract v4.3

**Module**: Voice AI  
**Version**: 4.3  
**Date**: February 2026  
**Status**: Final - Ready for Sprint Planning  
**Author**: Technical Product Manager

---

# INSTRUCTIONS FOR PLANNER AGENT

## Your Task

You are the **Planner Agent**. Your job is to:

1. **Read this entire contract** to understand what we're building
2. **Create sprint files** for the coding agents to execute
3. **Split the work** into small, manageable sprints

## Sprint File Naming Convention

Create sprint files with these prefixes:

| Prefix | Meaning | Location |
|--------|---------|----------|
| **BAS** | Backend Agent Sprint | `documentation/backend/voice_ai/sprint_BAS{XX}.md` |
| **FAS** | Frontend Agent Sprint | `documentation/frontend/voice_ai/sprint_FAS{XX}.md` |

Examples:
- `sprint_BAS01.md` - Backend: Database Schema
- `sprint_BAS02.md` - Backend: Provider CRUD
- `sprint_FAS01.md` - Frontend: Provider Management UI

## Sprint Execution Order

```
PHASE 1: BACKEND (BAS01 → BAS18)
All backend sprints must complete before frontend starts.

PHASE 2: FRONTEND (FAS01 → FAS07)
Frontend sprints start after backend is complete.
```

## Sprint Sizing Rules (CRITICAL)

Each sprint MUST be small enough for AI coding agents:

| Metric | Maximum |
|--------|---------|
| Files created/modified | 4 files |
| Lines of code | 300 lines |
| Responsibilities | 2 max |
| Estimated time | 2-4 hours |

**If a sprint is too big, SPLIT IT** into BAS01a, BAS01b, etc.

## Sprint File Template

Every sprint file MUST follow this structure:

```markdown
# Sprint {BAS/FAS}{XX} — {Title}

**Module**: Voice AI  
**Sprint**: {ID}  
**Depends on**: {List prerequisite sprints or "None"}  
**Estimated time**: {X hours}

---

## Objective

{1-2 sentences: What this sprint accomplishes}

---

## Pre-Coding Checklist

Before writing ANY code:

- [ ] {Prerequisite sprint} is complete
- [ ] Read `{file path}` — understand {what}
- [ ] Read `{file path}` — understand {what}
- [ ] Verify: {condition to check}

**Run with**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Development Credentials

- **Admin**: `ludsonaiello@gmail.com` / `978@F32c`
- **Tenant**: `contato@honeydo4you.com` / `978@F32c`
- **Database**: Read from `/var/www/lead360.app/api/.env`

---

## Task 1: {Task Name}

{Detailed step-by-step instructions}

{Code examples if needed - but keep minimal}

---

## Task 2: {Task Name}

{Detailed step-by-step instructions}

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `path/to/file.ts` | CREATE | {purpose} |
| `path/to/file.ts` | MODIFY | {what to change} |

---

## Acceptance Criteria

- [ ] {Specific testable criterion}
- [ ] {Specific testable criterion}
- [ ] {Specific testable criterion}
- [ ] `npm run build` passes
- [ ] `npm run test` passes (if tests added)

---

## Testing Instructions

{How to manually test this sprint's work}

```bash
# Example curl commands or steps
```
```

---

# WHAT WE ARE BUILDING

## Overview

We are building an **AI-powered voice agent** that answers phone calls for Lead360 tenant businesses. The agent:

1. Answers calls transferred from the IVR system
2. Speaks naturally in English, Spanish, or Portuguese
3. Collects lead information
4. Creates leads in the CRM
5. Checks service area coverage
6. Books appointments or transfers to humans

## Architecture Decision

The voice agent runs **inside the NestJS API** as a module (not a separate process):

```
/var/www/lead360.app/api/src/modules/voice-ai/
├── voice-ai.module.ts              ← Module definition
├── controllers/
│   ├── admin/                      ← Admin endpoints
│   └── tenant/                     ← Tenant endpoints
├── services/                       ← Business logic
├── agent/                          ← LiveKit worker (starts with API)
│   ├── voice-agent.service.ts      ← OnModuleInit starts worker
│   ├── providers/                  ← STT, LLM, TTS integrations
│   └── tools/                      ← Lead creation, service area check
├── dto/
└── guards/
```

**Why inside the API?**
- Direct access to existing services (LeadsService, EncryptionService)
- No HTTP overhead for internal calls
- One deployment, one PM2 process
- Shared database connection

## Call Flow

```
1. Caller dials tenant's phone number
2. Twilio receives call → webhook to Lead360 API
3. IVR plays language selection (Press 1 for English...)
4. IVR plays action selection (Press 1 for quote, Press 2 for appointment...)
5. If "voice_ai" action selected:
   a. Check tenant has Voice AI enabled
   b. Check tenant has minutes remaining
   c. Generate SIP transfer TwiML → LiveKit
6. LiveKit receives call, dispatches job to Voice Agent
7. Voice Agent (inside API) handles call:
   a. Fetches tenant context (greeting, instructions, services)
   b. Initializes STT (Deepgram), LLM (OpenAI), TTS (Cartesia)
   c. Converses with caller
   d. Uses tools: find lead, create lead, check service area
8. Call ends:
   a. Log call to voice_call_log
   b. Increment usage in voice_monthly_usage
   c. Save transcript
```

---

# EXISTING SERVICES TO REUSE

## DO NOT RECREATE THESE - Inject and use them:

### EncryptionService
**Location**: `api/src/core/encryption/encryption.service.ts`
**Use for**: Encrypting/decrypting API keys

### LeadsService
**Location**: `api/src/modules/leads/services/leads.service.ts`
**Use for**: Creating and finding leads

### LeadPhonesService
**Location**: `api/src/modules/leads/services/lead-phones.service.ts`
**Use for**: Finding leads by phone number

### IvrConfigurationService
**Location**: `api/src/modules/communication/services/ivr-configuration.service.ts`
**Use for**: Extending with `voice_ai` action type

### TranscriptionProviderService
**Location**: `api/src/modules/communication/services/transcription-provider.service.ts`
**Use for**: Saving call transcripts

### PrismaService
**Location**: `api/src/core/database/prisma.service.ts`
**Use for**: All database operations

---

# DATA MODEL

## New Tables to Create

### voice_ai_provider

Stores AI provider definitions (Deepgram, OpenAI, Cartesia).

```prisma
model voice_ai_provider {
  id                String   @id @default(uuid()) @db.VarChar(36)
  provider_key      String   @unique @db.VarChar(50)  // 'deepgram', 'openai', 'cartesia'
  provider_type     String   @db.VarChar(10)          // 'STT', 'LLM', 'TTS'
  display_name      String   @db.VarChar(100)
  description       String?  @db.Text
  logo_url          String?  @db.VarChar(500)
  documentation_url String?  @db.VarChar(500)
  capabilities      String?  @db.Text                 // JSON array
  config_schema     String?  @db.LongText             // JSON Schema
  default_config    String?  @db.Text                 // JSON defaults
  pricing_info      String?  @db.Text                 // JSON pricing
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

Stores encrypted API keys for each provider.

```prisma
model voice_ai_credentials {
  id                String   @id @default(uuid()) @db.VarChar(36)
  provider_id       String   @unique @db.VarChar(36)
  encrypted_api_key String   @db.LongText             // AES-256-GCM
  masked_api_key    String   @db.VarChar(20)          // 'sk-...xyz'
  additional_config String?  @db.Text                 // JSON for extra settings
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  updated_by        String?  @db.VarChar(36)

  provider          voice_ai_provider @relation(fields: [provider_id], references: [id], onDelete: Cascade)
  updated_by_user   user?             @relation(fields: [updated_by], references: [id])

  @@map("voice_ai_credentials")
}
```

### voice_ai_global_config

Singleton table for platform-wide Voice AI settings.

```prisma
model voice_ai_global_config {
  id                          String   @id @default("default") @db.VarChar(36)
  agent_enabled               Boolean  @default(false)
  default_stt_provider_id     String?  @db.VarChar(36)
  default_llm_provider_id     String?  @db.VarChar(36)
  default_tts_provider_id     String?  @db.VarChar(36)
  default_voice_id            String?  @db.VarChar(100)
  default_language            String   @default("en") @db.VarChar(10)
  default_greeting_template   String?  @db.Text       // "Hello, thank you for calling {business_name}"
  default_system_prompt       String?  @db.LongText   // Agent instructions
  default_max_call_seconds    Int      @default(300)
  livekit_url                 String?  @db.VarChar(255)
  livekit_api_key_encrypted   String?  @db.LongText
  livekit_api_secret_encrypted String? @db.LongText
  max_concurrent_calls        Int      @default(10)
  created_at                  DateTime @default(now())
  updated_at                  DateTime @updatedAt
  updated_by                  String?  @db.VarChar(36)

  stt_provider                voice_ai_provider? @relation("global_stt", fields: [default_stt_provider_id], references: [id])
  llm_provider                voice_ai_provider? @relation("global_llm", fields: [default_llm_provider_id], references: [id])
  tts_provider                voice_ai_provider? @relation("global_tts", fields: [default_tts_provider_id], references: [id])

  @@map("voice_ai_global_config")
}
```

### tenant_voice_ai_settings

Per-tenant Voice AI configuration.

```prisma
model tenant_voice_ai_settings {
  id                        String   @id @default(uuid()) @db.VarChar(36)
  tenant_id                 String   @unique @db.VarChar(36)
  is_enabled                Boolean  @default(false)
  enabled_languages         String?  @db.Text           // JSON: ["en", "es", "pt"]
  custom_greeting           String?  @db.Text
  custom_instructions       String?  @db.LongText
  booking_enabled           Boolean  @default(true)
  lead_creation_enabled     Boolean  @default(true)
  transfer_enabled          Boolean  @default(true)
  default_transfer_number_id String? @db.VarChar(36)
  max_call_duration_seconds Int?
  monthly_minutes_override  Int?                        // Admin can override plan limit
  created_at                DateTime @default(now())
  updated_at                DateTime @updatedAt

  tenant                    tenant   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  default_transfer_number   tenant_voice_transfer_number? @relation(fields: [default_transfer_number_id], references: [id])

  @@map("tenant_voice_ai_settings")
}
```

### tenant_voice_transfer_number

Phone numbers for call transfers.

```prisma
model tenant_voice_transfer_number {
  id            String   @id @default(uuid()) @db.VarChar(36)
  tenant_id     String   @db.VarChar(36)
  label         String   @db.VarChar(100)              // "Sales", "Support", "Owner"
  phone_number  String   @db.VarChar(20)               // E.164 format
  is_default    Boolean  @default(false)
  is_active     Boolean  @default(true)
  display_order Int      @default(0)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  tenant        tenant   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  settings      tenant_voice_ai_settings[]

  @@index([tenant_id, is_active])
  @@map("tenant_voice_transfer_number")
}
```

### voice_call_log

Records every Voice AI call.

```prisma
model voice_call_log {
  id                String    @id @default(uuid()) @db.VarChar(36)
  tenant_id         String    @db.VarChar(36)
  call_sid          String    @unique @db.VarChar(100)  // Twilio CallSid
  room_name         String?   @db.VarChar(100)          // LiveKit room
  from_number       String    @db.VarChar(20)
  to_number         String    @db.VarChar(20)
  language_used     String?   @db.VarChar(10)
  intent            String?   @db.VarChar(50)           // From IVR: 'quote', 'appointment'
  status            String    @db.VarChar(20)           // 'in_progress', 'completed', 'failed', 'transferred'
  outcome           String?   @db.VarChar(50)           // 'lead_created', 'transferred', 'abandoned'
  duration_seconds  Int?
  transcript_summary String?  @db.Text
  full_transcript   String?   @db.LongText
  actions_taken     String?   @db.Text                  // JSON: ["lead_created", "service_area_checked"]
  lead_id           String?   @db.VarChar(36)
  transferred_to    String?   @db.VarChar(20)
  error_message     String?   @db.Text
  started_at        DateTime  @default(now())
  ended_at          DateTime?
  created_at        DateTime  @default(now())

  tenant            tenant    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  lead              lead?     @relation(fields: [lead_id], references: [id])

  @@index([tenant_id, started_at])
  @@index([tenant_id, status])
  @@map("voice_call_log")
}
```

### voice_monthly_usage

Tracks monthly usage per tenant.

```prisma
model voice_monthly_usage {
  id                     String   @id @default(uuid()) @db.VarChar(36)
  tenant_id              String   @db.VarChar(36)
  year                   Int
  month                  Int                            // 1-12
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

## Existing Table to EXTEND

### subscription_plan

Add these columns to the existing model:

```prisma
// ADD to existing subscription_plan model:
voice_ai_enabled          Boolean  @default(false)
voice_ai_minutes_included Int      @default(0)
voice_ai_overage_rate     Decimal? @db.Decimal(10, 4)  // NULL = block when over limit
```

### IVR_ACTION_TYPES

Add `voice_ai` to the existing constant in `create-ivr-config.dto.ts`:

```typescript
export const IVR_ACTION_TYPES = [
  'route_to_number',
  'route_to_default',
  'trigger_webhook',
  'voicemail',
  'voice_ai',  // ADD THIS
] as const;
```

---

# API ENDPOINTS

## Admin Endpoints

**Base**: `/api/v1/system/voice-ai`  
**Auth**: JWT + `is_platform_admin: true`

### Provider Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/providers` | List all providers |
| POST | `/providers` | Create provider |
| GET | `/providers/:id` | Get provider |
| PATCH | `/providers/:id` | Update provider |
| DELETE | `/providers/:id` | Soft delete |

### Credential Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/credentials` | List all (masked keys) |
| PUT | `/credentials/:providerId` | Upsert credential |
| DELETE | `/credentials/:providerId` | Delete credential |
| POST | `/credentials/:providerId/test` | Test API key |

### Global Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config` | Get global config |
| PATCH | `/config` | Update global config |

### Plan Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plans` | List plans with voice AI settings |
| PATCH | `/plans/:planId/voice` | Update plan voice settings |

### Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/agent/status` | Agent health check |
| GET | `/agent/logs` | Stream logs (SSE) |
| GET | `/rooms` | List active calls |
| POST | `/rooms/:roomName/end` | Force end call |
| GET | `/tenants` | List tenants with voice AI status |
| PATCH | `/tenants/:tenantId/override` | Admin override settings |
| GET | `/call-logs` | Cross-tenant call logs |
| GET | `/usage-report` | Aggregate usage report |

## Tenant Endpoints

**Base**: `/api/v1/voice-ai`  
**Auth**: JWT (any authenticated tenant user)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/settings` | Get tenant settings |
| PUT | `/settings` | Upsert settings |
| GET | `/transfer-numbers` | List transfer numbers |
| POST | `/transfer-numbers` | Create transfer number |
| PATCH | `/transfer-numbers/:id` | Update |
| DELETE | `/transfer-numbers/:id` | Delete |
| GET | `/call-logs` | Tenant's call history |
| GET | `/call-logs/:id` | Single call detail |
| GET | `/usage` | Usage summary |

---

# BACKEND SPRINT PLAN (BAS)

The planner agent should create these sprint files:

| Sprint | Title | Key Deliverables |
|--------|-------|------------------|
| BAS01 | Database Schema | Prisma models, migration |
| BAS02 | Module Scaffold | voice-ai.module.ts, folder structure |
| BAS03 | Provider Service | CRUD for voice_ai_provider |
| BAS04 | Provider Controller | Admin endpoints for providers |
| BAS05 | Credentials Service | Encrypted key storage |
| BAS06 | Credentials Controller | Admin endpoints for credentials |
| BAS07 | Global Config Service | Singleton config management |
| BAS08 | Global Config Controller | Admin endpoints |
| BAS09 | Tenant Settings Service | Per-tenant settings |
| BAS10 | Tenant Settings Controller | Tenant endpoints |
| BAS11 | Transfer Numbers Service | CRUD |
| BAS12 | Transfer Numbers Controller | Endpoints |
| BAS13 | Context Builder Service | Merge global + tenant config |
| BAS14 | Usage Tracking Service | Minutes tracking |
| BAS15 | Call Log Service | Call history |
| BAS16 | Call Log Controller | Endpoints |
| BAS17 | IVR Extension | Add voice_ai action type |
| BAS18 | Plan Config | Extend subscription_plan, endpoints |
| BAS19 | Agent Worker Setup | LiveKit connection, OnModuleInit |
| BAS20 | STT Provider | Deepgram integration |
| BAS21 | LLM Provider | OpenAI integration |
| BAS22 | TTS Provider | Cartesia integration |
| BAS23 | Agent Tools | find_lead, create_lead, check_service_area |
| BAS24 | Agent Pipeline | Assemble STT→LLM→TTS flow |
| BAS25 | Admin Monitoring | Status, logs, rooms endpoints |
| BAS26 | Tests | Unit tests for services |
| BAS27 | REST API Documentation | Complete API docs |

---

# FRONTEND SPRINT PLAN (FAS)

The planner agent should create these sprint files:

| Sprint | Title | Key Deliverables |
|--------|-------|------------------|
| FAS01 | Provider Management UI | List, create, edit providers |
| FAS02 | Credentials Management UI | Manage API keys |
| FAS03 | Global Config UI | Platform settings form |
| FAS04 | Plan Config UI | Voice AI settings per plan |
| FAS05 | Tenant List + Override UI | Admin tenant management |
| FAS06 | Active Calls Dashboard | Real-time call monitoring |
| FAS07 | Log Streaming UI | SSE log viewer |
| FAS08 | Admin Call Logs | Cross-tenant call history |
| FAS09 | Admin Usage Report | Aggregate usage charts |
| FAS10 | Tenant Settings Page | Enable/disable, customize |
| FAS11 | Transfer Numbers UI | Manage transfer destinations |
| FAS12 | Tenant Call History | View past calls |
| FAS13 | Usage Meter Component | Minutes used visualization |

---

# TEST CREDENTIALS

```
Admin Account (Platform Admin):
- Email: ludsonaiello@gmail.com
- Password: 978@F32c

Tenant Account (Owner):
- Email: contato@honeydo4you.com
- Password: 978@F32c

Database:
- Read credentials from /var/www/lead360.app/api/.env
- NEVER hardcode credentials
```

---

# ACCEPTANCE CRITERIA

## Backend Complete When:

- [ ] All 7 new tables created and migrated
- [ ] subscription_plan extended with voice AI columns
- [ ] All admin endpoints working and tested
- [ ] All tenant endpoints working and tested
- [ ] IVR `voice_ai` action generates correct TwiML
- [ ] Agent connects to LiveKit on API startup
- [ ] Agent handles calls with STT→LLM→TTS pipeline
- [ ] Tools work: find_lead, create_lead, check_service_area, transfer
- [ ] Usage tracking increments correctly
- [ ] Quota enforcement blocks calls when over limit
- [ ] All unit tests passing
- [ ] REST API documentation complete

## Frontend Complete When:

- [ ] Admin can manage providers and credentials
- [ ] Admin can configure global settings
- [ ] Admin can configure plans
- [ ] Admin can view/override tenant settings
- [ ] Admin can monitor active calls
- [ ] Admin can stream logs
- [ ] Admin can view usage reports
- [ ] Tenant can enable/disable voice AI
- [ ] Tenant can customize greeting and instructions
- [ ] Tenant can manage transfer numbers
- [ ] Tenant can view call history
- [ ] Tenant can see usage meter

---

**END OF MASTER CONTRACT v4.3**

Planner Agent: Now create the individual BAS and FAS sprint files based on this specification.