YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FTA04 — Tenant Usage Meter + Minutes Display

**Module**: Voice AI - Frontend Tenant  
**Sprint**: FTA04  
**Depends on**: FTA01, FTA05

---

## Objective

Build the `VoiceAiUsageMeter` component that shows the tenant's current minute usage, and a full usage history page.

---

## Mandatory Pre-Coding Steps

1. Read API docs: `GET /voice-ai/usage` endpoint
2. **HIT ENDPOINT**: verify `minutes_included`, `minutes_used`, `quota_exceeded`, `overage_rate` fields
3. Read reference: look for any existing progress bar or stats widget component

**DO NOT USE PM2** — `npm run dev` on both services

---

## Credentials

- Tenant: `contato@honeydo4you.com` / `978@F32c`

---

## Routes

- Usage widget: embedded in `/settings/voice-ai` page (FTA01)
- Usage history: `/settings/voice-ai/usage` → `/app/src/app/(dashboard)/settings/voice-ai/usage/page.tsx`

---

## Task 1: VoiceAiUsageMeter Component

**Note**: FTA01 was built with a placeholder `<div>` where this component goes. After completing this task, replace that placeholder in FTA01's settings page with `<VoiceAiUsageMeter usage={usage} />`.

Create `/app/src/components/voice-ai/VoiceAiUsageMeter.tsx`:

```tsx
interface Props {
  usage: TenantUsageSummary | null;  // null while loading — component renders skeleton
}

export function VoiceAiUsageMeter({ usage }: Props) {
  if (!usage) return <div className="animate-pulse h-20 bg-gray-100 rounded" />;  // loading skeleton

  const percentage = usage.minutes_included > 0
    ? Math.min(100, (usage.minutes_used / usage.minutes_included) * 100)
    : 0;  // guard against division by zero when minutes_included = 0
  const isWarning = percentage >= 80;
  const isExceeded = usage.quota_exceeded;
  
  return (
    <div className="rounded-lg border p-4">
      <h3>Voice AI Usage — {monthName} {usage.year}</h3>
      
      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded">
        <div 
          className={`h-2 rounded ${isExceeded ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-brand-500'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      {/* Labels */}
      <div className="flex justify-between text-sm">
        <span>{usage.minutes_used} min used</span>
        <span>{usage.minutes_included} min included</span>
      </div>
      
      {/* Calls count */}
      <p className="text-sm text-gray-500">{usage.total_calls} calls this month</p>
      
      {/* Overage warning */}
      {isExceeded && usage.overage_rate && (
        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
          ⚠️ You've exceeded your included minutes. Overage rate: ${usage.overage_rate}/min
        </div>
      )}
      
      {/* Hard block */}
      {isExceeded && !usage.overage_rate && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          🚫 You've used all included minutes. Voice AI is paused until next month.
        </div>
      )}
    </div>
  );
}
```

---

## Task 2: Embed in Settings Page

In FTA01 (`/settings/voice-ai/page.tsx`), embed the `VoiceAiUsageMeter` at the top of the form (only when Voice AI is included in plan).

If the usage data hasn't loaded yet, show a skeleton/loading state.

---

## Task 3: Usage History Page

`/app/src/app/(dashboard)/settings/voice-ai/usage/page.tsx`:

**Month navigation**: Previous/Next month arrows, current month display

**Summary section** (from `getTenantUsage(year, month)`):
- Minutes Used / Minutes Included (as fraction and % bar)
- Total Calls
- Overage Minutes (if any)
- Estimated Overage Cost (if any)

The page is simple — just the month summary. No daily breakdown needed in this sprint.

---

## Acceptance Criteria

- [ ] `VoiceAiUsageMeter` renders with correct values
- [ ] Progress bar turns yellow at 80%, red when exceeded
- [ ] Overage warning banner shows when over limit with overage rate
- [ ] Hard block banner shows when over limit with no overage rate
- [ ] Meter embedded in settings page
- [ ] Usage history page shows month navigation
- [ ] Month navigation loads correct data
- [ ] `npm run build` passes
