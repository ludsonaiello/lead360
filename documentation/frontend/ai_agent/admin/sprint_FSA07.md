YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FSA07 — Admin Sidebar + Layout Wiring

**Module**: Voice AI - Frontend Admin  
**Sprint**: FSA07  
**Depends on**: FSA01, FSA02, FSA03, FSA04, FSA05 (all admin pages must exist)

---

## Objective

Add the Voice AI section to the admin sidebar navigation and create the layout/index page that ties all admin Voice AI pages together.

---

## Mandatory Pre-Coding Steps

1. Read `/app/src/components/dashboard/DashboardSidebar.tsx` completely — understand `adminNavigationGroups` structure
2. Find an existing admin navigation group (e.g., Twilio or Quotes) and replicate its pattern exactly
3. Check what icon library is used (likely `lucide-react`) and pick appropriate icons

**DO NOT USE PM2** — `npm run dev` on frontend (port 7000)

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## Task 1: Add Navigation Group to Sidebar

In `/app/src/components/dashboard/DashboardSidebar.tsx`, add to `adminNavigationGroups`:

```typescript
{
  name: 'Voice AI',
  icon: Mic,  // from lucide-react
  items: [
    { name: 'Tenants & Plans', href: '/admin/voice-ai/tenants', icon: Users },
    { name: 'Call Logs', href: '/admin/voice-ai/logs', icon: PhoneCall },
    { name: 'Usage', href: '/admin/voice-ai/usage', icon: BarChart2 },
    { name: 'Providers', href: '/admin/voice-ai/providers', icon: Cpu },
    { name: 'Credentials', href: '/admin/voice-ai/credentials', icon: Key },
    { name: 'Configuration', href: '/admin/voice-ai/config', icon: Settings },
  ],
},
```

Use whatever icons exist and make sense. Do NOT introduce a new icon library.

---

## Task 2: Layout File

Create `/app/src/app/(dashboard)/admin/voice-ai/layout.tsx`:

```typescript
export default function VoiceAiAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* Breadcrumb: Admin > Voice AI > [current page] */}
      <Breadcrumb items={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Voice AI' },
      ]} />
      {children}
    </div>
  );
}
```

Use the existing `Breadcrumb` component.

---

## Task 3: Index Page (Redirect)

Create `/app/src/app/(dashboard)/admin/voice-ai/page.tsx`:

```typescript
import { redirect } from 'next/navigation';

export default function VoiceAiAdminPage() {
  redirect('/admin/voice-ai/tenants');
}
```

---

## Task 4: Verify All Routes Load

Manually test each route in the browser (logged in as admin):
- `/admin/voice-ai` → redirects to `/admin/voice-ai/tenants` ✓
- `/admin/voice-ai/tenants` → loads tenants table ✓
- `/admin/voice-ai/logs` → loads call logs ✓
- `/admin/voice-ai/usage` → loads usage dashboard ✓
- `/admin/voice-ai/providers` → loads providers table ✓
- `/admin/voice-ai/credentials` → loads credentials page ✓
- `/admin/voice-ai/config` → loads config form ✓

---

## Acceptance Criteria

- [ ] "Voice AI" group appears in admin sidebar
- [ ] All 6 sub-items navigate to correct pages
- [ ] Active route highlighted in sidebar
- [ ] `/admin/voice-ai` redirects to tenants page
- [ ] Layout breadcrumb shows correct path
- [ ] Non-admin users cannot see the Voice AI admin navigation items
- [ ] `npm run build` passes
