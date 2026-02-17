# Voice AI Module — Frontend Tenant Agent Prompt

YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

You are implementing a production-ready tenant UI for Lead360's Voice AI module (Next.js App Router + React + Tailwind CSS).

**Sprint documentation**: Read the assigned sprint file at `documentation/frontend/ai_agent/tenant/sprint_FTA{N}.md` COMPLETELY before writing any code.

---

## Mandatory Pre-Coding Steps

1. **Read the sprint file** completely
2. **Read the REST API docs**: `/api/documentation/voice_ai_REST_API.md`
3. **HIT THE ACTUAL ENDPOINTS** at `http://localhost:8000/api/v1` to verify real response shapes BEFORE writing TypeScript types or API client functions.
4. **Check the tenant API client**: `/app/src/lib/api/voice-ai-tenant.ts`
5. **Review reference pages** listed in your sprint doc — replicate their patterns exactly

---

## Validation Rule (CRITICAL)

Before writing any TypeScript interface, run:
```bash
# Login as tenant first, then:
curl -s http://localhost:8000/api/v1/voice-ai/settings \
  -H "Authorization: Bearer YOUR_TOKEN" | jq .
```
Match EVERY field name exactly. Never guess.

---

## Architecture Rules

- Tenant pages live in: `/app/src/app/(dashboard)/settings/voice-ai/` and `/app/src/app/(dashboard)/communications/voice-ai/`
- Use `req.user.tenant_id` — NEVER pass tenant_id from the frontend
- NEVER hardcode API URLs — use `apiClient` from `/app/src/lib/api/axios.ts`
- ALWAYS use shared components: `MaskedInput` for phones, `ToggleSwitch` for booleans, `Modal` for dialogs, `ErrorModal` for errors
- Links not buttons for navigation (support right-click, ctrl-click, middle-click)
- ALL phone inputs: E.164 format via `MaskedInput` with international phone mask

---

## Plan Awareness Logic

- If tenant's plan does NOT include Voice AI (`subscription_plan.voice_ai_enabled === false`): show upgrade CTA, NOT the settings form
- If plan includes Voice AI but `is_enabled === false`: show the settings form with a prominent enable toggle at the top
- If quota exceeded with no overage rate: show hard-blocked warning banner on all Voice AI pages

---

## UI Quality Standards

- Mobile-first responsive (test at 375px viewport)
- Character counters on greeting and instructions textareas
- Progress bar for usage meter (red at 80%+)
- Quota warning banners (overage rate available vs. fully blocked)
- Empty states: meaningful message + add CTA
- Confirmation modals for all destructive actions
- Success modals or toasts after mutations

---

## Development Environment

**DO NOT USE PM2** — run with dev servers:
```bash
# Frontend
cd /var/www/lead360.app/app && npm run dev
# Runs on http://localhost:7000

# Backend (must be running)
cd /var/www/lead360.app/api && npm run dev
# Runs on http://localhost:8000
```

**Credentials**:
- Tenant login: `contato@honeydo4you.com` / `978@F32c`
- Admin login: `ludsonaiello@gmail.com` / `978@F32c`
- DB credentials: in `/var/www/lead360.app/api/.env`

---

## Reference Files

| What | Where |
|------|-------|
| Settings page pattern | `/app/src/app/(dashboard)/settings/business/page.tsx` |
| Communications page pattern | `/app/src/app/(dashboard)/communications/twilio/calls/page.tsx` |
| Tenant API client pattern | `/app/src/lib/api/twilio-tenant.ts` |
| Sidebar (add nav items) | `/app/src/components/dashboard/DashboardSidebar.tsx` |
| MaskedInput | `/app/src/components/ui/MaskedInput.tsx` |
| ToggleSwitch | `/app/src/components/ui/ToggleSwitch.tsx` |
| Modal | `/app/src/components/ui/Modal.tsx` |
| ConfirmModal | `/app/src/components/ui/ConfirmModal.tsx` |
| ErrorModal | `/app/src/components/ui/ErrorModal.tsx` |
| DateRangePicker | `/app/src/components/ui/DateRangePicker.tsx` |

---

## Definition of Done

Your sprint is COMPLETE when:
- [ ] All pages from sprint doc implemented and render without errors
- [ ] Plan-aware: upgrade CTA shown when voice AI not in plan
- [ ] All CRUD operations work (verified manually in browser)
- [ ] Phone inputs use MaskedInput with proper validation
- [ ] Usage meter renders with correct values
- [ ] Mobile layout tested at 375px
- [ ] No TypeScript errors (`npm run build`)
- [ ] All acceptance criteria from sprint checked off
