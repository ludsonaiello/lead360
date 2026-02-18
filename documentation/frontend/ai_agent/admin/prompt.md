AI FSA01

# Voice AI Module — Frontend Admin Agent Prompt

YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

You are implementing a production-ready admin UI for Lead360's Voice AI module (Next.js App Router + React + Tailwind CSS).

**Sprint documentation**: Read the assigned sprint file at `documentation/frontend/ai_agent/admin/sprint_FSA01.md` COMPLETELY before writing any code.

---

## Mandatory Pre-Coding Steps

1. **Read the sprint file** completely
2. **Read the REST API docs**: `/api/documentation/voice_ai_REST_API.md`
3. **HIT THE ACTUAL ENDPOINTS** at `http://localhost:8000/api/v1` to verify real response shapes BEFORE writing TypeScript types or API client functions. The docs may have minor discrepancies — real API wins.
4. **Check the API client** to start from: `/app/src/lib/api/voice-ai-admin.ts`
5. **Review reference pages** listed in your sprint doc — replicate their patterns exactly

---

## Validation Rule (CRITICAL)

Before writing any TypeScript interface or API call, run:
```bash
# Login as admin first to get token, then:
curl -s http://localhost:8000/api/v1/system/voice-ai/[endpoint] \
  -H "Authorization: Bearer YOUR_TOKEN" | jq .
```
Match EVERY field name and type exactly. Never guess property names.

---

## Architecture Rules

- Admin pages only accessible to `user.is_platform_admin === true` (AuthContext handles this)
- Pages go in: `/app/src/app/(dashboard)/admin/voice-ai/`
- NEVER hardcode API URLs — use `apiClient` from `/app/src/lib/api/axios.ts`
- ALWAYS use shared components — NEVER recreate: `Modal`, `ToggleSwitch`, `Badge`, `ConfirmModal`, `ErrorModal`, `LoadingSpinner`, `PaginationControls`
- API key fields: ALWAYS `<input type="password">`, NEVER display decrypted values
- ALL async operations: show `LoadingSpinner` while loading
- ALL API errors: show `ErrorModal` (not `console.error`, not `toast.error` for destructive flows)

---

## UI Quality Standards

- Mobile-first responsive (test at 375px viewport)
- All tables: responsive card view on mobile
- All forms: validated with React Hook Form + Zod
- Empty states: meaningful message + CTA
- Confirmation modals: for ALL destructive actions (delete, regenerate key)
- Success feedback: success modal or toast after mutations
- Progress bars: for quota/usage display

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
- Admin login: `ludsonaiello@gmail.com` / `978@F32c`
- DB credentials: in `/var/www/lead360.app/api/.env`

---

## Reference Files

| What | Where |
|------|-------|
| Admin page pattern | `/app/src/app/(dashboard)/admin/communications/twilio/monitoring/page.tsx` |
| API client pattern | `/app/src/lib/api/twilio-admin.ts` |
| Types pattern | `/app/src/lib/types/twilio-admin.ts` |
| Sidebar (add nav items here) | `/app/src/components/dashboard/DashboardSidebar.tsx` |
| Shared Modal | `/app/src/components/ui/Modal.tsx` |
| ToggleSwitch | `/app/src/components/ui/ToggleSwitch.tsx` |
| ConfirmModal | `/app/src/components/ui/ConfirmModal.tsx` |
| ErrorModal | `/app/src/components/ui/ErrorModal.tsx` |
| Badge | `/app/src/components/ui/Badge.tsx` |
| DateRangePicker | `/app/src/components/ui/DateRangePicker.tsx` |

---

## Definition of Done

Your sprint is COMPLETE when:
- [ ] All pages from sprint doc implemented and render without errors
- [ ] All CRUD operations work (verified manually in browser)
- [ ] ErrorModal shown on API failures
- [ ] LoadingSpinner shown during async operations
- [ ] Mobile layout tested at 375px
- [ ] No TypeScript errors (`npm run build`)
- [ ] All acceptance criteria from sprint checked off




Review your job, line by line and make sure you're not making mistakes,not missing anything even small things, that there's no todos or mock code, not hardcoded urls that shouldn't be there the code quality is the best possible, make sure that if you say that is all done and I find a single error I'll fire you.