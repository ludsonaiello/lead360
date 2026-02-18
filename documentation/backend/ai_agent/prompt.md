AI SPB10

# Voice AI Module — Backend Agent Prompt
YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

You are implementing a production-ready backend feature for Lead360's Voice AI module (NestJS + Prisma + MySQL).

**Sprint documentation**: Read the assigned sprint file COMPLETELY before touching any code.

## Mandatory Pre-Coding Steps

1. **Read the sprint file** at @documentation/backend/ai_agent/sprint_B10.md   
2. **Review the contract** at @documentation/contracts/ai_agent/voice_ai_contract.md  
3. **Check existing voice-ai module**: `/api/src/modules/voice-ai/` (if it exists from prior sprints)
4. **Check Prisma schema**: `/api/prisma/schema.prisma` — NEVER guess field names
5. **Reference patterns** (listed in your sprint doc) — copy patterns exactly, don't invent

## Architecture Rules

- New module lives at: `/api/src/modules/voice-ai/`
- **Admin endpoints**: guard with `@Roles()` and verify `req.user.is_platform_admin === true` (mirrors admin module pattern)
- **Tenant endpoints**: extract `req.user.tenant_id` from JWT — NEVER trust body for tenant_id
- **Internal endpoints** (Python agent): use `VoiceAgentKeyGuard` — reads `X-Voice-Agent-Key` header, NO JWT
- **`voice_ai_credentials`**: has NO tenant_id — admin only, skip tenant middleware
- **Context builder**: decrypt credentials at call time via `EncryptionService.decrypt()`, NEVER cache decrypted keys
- All tenant-scoped queries MUST include `where: { tenant_id: tenantId }` — no exceptions

## Code Quality Rules

- TypeScript strict mode: no `any`, no implicit `any`
- Full DTO validation with `class-validator` decorators
- All errors: 400, 401, 403, 404, 409, 422, 500 handled explicitly
- No `TODO` comments, no placeholder implementations
- Follow existing naming: snake_case DB fields, camelCase TypeScript, kebab-case endpoints
- Every new service method has corresponding unit test (sprint B13)

## Development Environment

**DO NOT USE PM2** — run with dev servers:
```bash
# Backend
cd /var/www/lead360.app/api && npm run dev
# Runs on http://localhost:8000
```

**Credentials** (DO NOT hardcode — read from .env):
- DB: check `/var/www/lead360.app/api/.env` for `DATABASE_URL`
- Admin login: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant login: `contato@honeydo4you.com` / `978@F32c`

**Test endpoints**: `http://localhost:8000/api/v1`

## Reference Files

| What | Where |
|------|-------|
| Module pattern | `/api/src/modules/communication/communication.module.ts` |
| Admin guard pattern | `/api/src/modules/admin/` |
| Encryption usage | `/api/src/modules/communication/services/tenant-sms-config.service.ts` |
| BullMQ processor | `/api/src/modules/communication/processors/send-sms.processor.ts` |
| IVR service | `/api/src/modules/communication/services/ivr-configuration.service.ts` |
| DTO validation | `/api/src/modules/leads/dto/lead.dto.ts` |
| Audit logging | `/api/src/modules/audit/audit-logger.service.ts` |
| Prisma schema | `/api/prisma/schema.prisma` |

## Definition of Done

Your sprint is COMPLETE when:
- [ ] All endpoints from sprint doc implemented and tested manually
- [ ] All DTOs validated with class-validator
- [ ] All services have tenant isolation
- [ ] Prisma migration ran successfully (if schema changes)
- [ ] Module registered in `app.module.ts`
- [ ] No TypeScript compilation errors (`npm run build`)
- [ ] All acceptance criteria from sprint checked off


Review your job, line by line and make sure you're not making mistakes,not missing anything even small things, that there's no todos or mock code, not hardcoded urls that shouldn't be there the code quality is the best possible, make sure that if you say that is all done and I find a single error I'll fire you.