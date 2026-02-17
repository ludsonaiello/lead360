YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FSA04 — Admin Per-Tenant Overrides + Plan Flags

**Module**: Voice AI - Frontend Admin  
**Sprint**: FSA04  
**Depends on**: FSA03, FSA06

---

## Objective

Build the admin page showing all tenants' Voice AI status with the ability to override individual tenant settings, plus a tab to configure Voice AI per subscription plan tier.

---

## Mandatory Pre-Coding Steps

1. Read API docs: `GET /system/voice-ai/tenants`, `PATCH /system/voice-ai/tenants/:tenantId/override`, `GET /system/voice-ai/plans`, `PATCH /system/voice-ai/plans/:planId/voice`
2. **HIT ENDPOINTS**: verify real response shapes
3. Read reference: `/app/src/app/(dashboard)/admin/tenants/page.tsx` — tenant list pattern

**DO NOT USE PM2** — `npm run dev` on both services

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## Route

`/admin/voice-ai/tenants` → `/app/src/app/(dashboard)/admin/voice-ai/tenants/page.tsx`

---

## Page Structure

**Two tabs**: "Tenants" | "Plans"

### Tab 1: Tenants

Search bar + paginated table:

| Column | Notes |
|--------|-------|
| Tenant | company_name |
| Plan | plan_name |
| Voice AI on Plan | Badge: Included/Not Included |
| Status | Badge: Enabled/Disabled |
| Usage | Progress bar: {minutes_used}/{minutes_included} min |
| Override | "Override" badge if `has_admin_override=true` |
| Actions | "Configure" button → opens override slide-over/modal |

**Override Modal/SidePanel**:
- Title: "Voice AI Override — {company_name}"
- Force Enable: `<ToggleSwitch>` — null=plan default, true=force on, false=force off
- Monthly Minutes Override: `<Input>` number — null=use plan, value=custom limit
- STT Provider Override: `<Select>` — from active STT providers
- LLM Provider Override: `<Select>` — from active LLM providers
- TTS Provider Override: `<Select>` — from active TTS providers
- Save button

### Tab 2: Plans

Table of all subscription plans with voice AI configuration:

| Column |
|--------|
| Plan Name |
| Voice AI Enabled | ToggleSwitch — inline edit |
| Minutes Included | editable Input (click to edit) |
| Overage Rate | editable Input — $/min (null = block when over limit) |
| Actions | Save button per row |

---

## API Integration

Tab 1:
- On mount: `getTenantsVoiceAiOverview()` + `getVoiceAiProviders()`
- Override save: `overrideTenantVoiceSettings(tenantId, data)`
- Pagination: page/limit params

Tab 2:
- On mount: `getPlansWithVoiceConfig()`
- Inline edit save: `updatePlanVoiceConfig(planId, data)`

---

## Acceptance Criteria

- [ ] Tenants table loads with voice AI status per tenant
- [ ] Usage progress bars render correctly
- [ ] Override badge shown for tenants with admin overrides
- [ ] Override modal saves correctly and refreshes table
- [ ] Plans tab shows all plans with voice AI config
- [ ] ToggleSwitch on plans updates inline
- [ ] Overage rate can be set to null (blocked) or a number (overage allowed)
- [ ] `npm run build` passes
