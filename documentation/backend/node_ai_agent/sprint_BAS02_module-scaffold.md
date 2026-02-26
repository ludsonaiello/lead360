# Sprint BAS02 — Module Scaffold

**Module**: Voice AI
**Sprint**: BAS02
**Depends on**: BAS01 (database schema complete)
**Estimated size**: 1–3 files modified, ~100 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read the existing `voice-ai.module.ts` completely
- Read `app.module.ts` to understand registration order
- Check every import path is correct — NEVER assume a path
- Compare the module against other modules (e.g., `communication.module.ts`) to follow patterns
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) the `voice-ai.module.ts` scaffold. Ensure all services, controllers, guards, processors, and BullMQ queues are properly declared and the module is registered in `app.module.ts`. This sprint creates no business logic — only wires the module together.

---

## Pre-Coding Checklist

- [ ] BAS01 complete (all 6 tables in DB)
- [ ] Read `api/src/modules/voice-ai/voice-ai.module.ts` completely
- [ ] Read `api/src/app.module.ts` — confirm `VoiceAiModule` is imported
- [ ] Read `api/src/modules/communication/communication.module.ts` — use as reference for BullMQ queue registration pattern
- [ ] List all files in `api/src/modules/voice-ai/` — `ls -R api/src/modules/voice-ai/`
- [ ] Verify `api/src/modules/voice-ai/` folder structure matches the contract

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Tenant login | `contato@honeydo4you.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/voice-ai.module.ts` | Current state — what's registered |
| `api/src/app.module.ts` | Confirm VoiceAiModule imported, check registration order |
| `api/src/modules/communication/communication.module.ts` | Pattern reference for BullMQ queue registration |
| `api/src/modules/leads/leads.module.ts` | Check if LeadsModule exports LeadsService for injection |
| `api/src/core/encryption/encryption.module.ts` | Check if EncryptionModule is exported globally |

---

## Task 1: Verify Folder Structure

The voice-ai module must have this folder structure. If anything is missing, create the empty folder:

```
api/src/modules/voice-ai/
├── voice-ai.module.ts
├── controllers/
│   ├── admin/
│   │   ├── voice-ai-providers.controller.ts
│   │   ├── voice-ai-credentials.controller.ts
│   │   ├── voice-ai-global-config.controller.ts
│   │   ├── voice-ai-plan-config.controller.ts
│   │   ├── voice-ai-admin-call-logs.controller.ts
│   │   └── voice-ai-monitoring.controller.ts
│   └── tenant/
│       ├── voice-ai-settings.controller.ts
│       ├── voice-transfer-numbers.controller.ts
│       └── voice-ai-call-logs.controller.ts
├── services/
│   ├── voice-ai-providers.service.ts
│   ├── voice-ai-credentials.service.ts
│   ├── voice-ai-global-config.service.ts
│   ├── voice-ai-plan-config.service.ts
│   ├── voice-ai-settings.service.ts
│   ├── voice-ai-context-builder.service.ts
│   ├── voice-transfer-numbers.service.ts
│   ├── voice-call-log.service.ts
│   ├── voice-usage.service.ts
│   ├── voice-ai-sip.service.ts
│   └── voice-ai-monitoring.service.ts
├── agent/                              ← NEW (for BAS19–BAS24)
│   ├── voice-agent.service.ts          ← Created in BAS19
│   └── providers/                      ← Created in BAS20–22
├── dto/
├── guards/
│   ├── voice-agent-key.guard.ts
│   └── livekit-webhook.guard.ts        ← (if needed)
└── processors/
    ├── voice-ai-quota-reset.processor.ts
    └── voice-ai-usage-sync.processor.ts
```

---

## Task 2: Verify Module Registration

`voice-ai.module.ts` must declare:
1. All controllers (admin + tenant)
2. All services as providers
3. Any BullMQ queues via `BullModule.registerQueue()`
4. Imports: `PrismaModule`, `EncryptionModule` (or SharedModule), `LeadsModule` (for service injection)
5. Exports: Services needed by other modules (e.g., `VoiceAiSipService` needed by `IvrConfigurationService`)

Check how other modules import PrismaModule — look at `leads.module.ts` as reference.

**Verify exports**: Does `LeadsModule` export `LeadsService`? Does `EncryptionModule` export `EncryptionService`? If not, check if they're in `SharedModule`. Read the files before assuming.

---

## Task 3: Verify app.module.ts Registration

Open `api/src/app.module.ts` and confirm:
```typescript
// VoiceAiModule should be imported
import { VoiceAiModule } from './modules/voice-ai/voice-ai.module';

// And added to imports array (after AdminModule, CommunicationModule)
imports: [
  ...
  VoiceAiModule,
  ...
]
```

If missing, add it. Follow the same order pattern already in place.

---

## Task 4: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

Fix all errors. Common issues:
- Circular dependency: Check import order, consider `forwardRef()`
- Missing export: Read the module that owns the service, add to exports array
- Wrong path: Use `ls` to verify the actual file path before fixing the import

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/voice-ai.module.ts` | MODIFY (if needed) | Register all providers, controllers, queues |
| `api/src/app.module.ts` | MODIFY (if needed) | Import VoiceAiModule |
| `api/src/modules/voice-ai/agent/` | CREATE folder | Prepare folder for BAS19 agent worker |

---

## Acceptance Criteria

- [ ] `voice-ai.module.ts` declares all controllers and services
- [ ] `app.module.ts` imports `VoiceAiModule`
- [ ] `api/src/modules/voice-ai/agent/` folder exists (empty is fine)
- [ ] `npm run build` passes with 0 errors
- [ ] `npm run start:dev` starts without errors

---

## Testing

```bash
cd /var/www/lead360.app/api && npm run start:dev

# Verify module loads — should see NestJS boot without errors
# Check Swagger for voice-ai endpoints:
curl http://localhost:3000/api/docs -s | grep -i "voice"
```
