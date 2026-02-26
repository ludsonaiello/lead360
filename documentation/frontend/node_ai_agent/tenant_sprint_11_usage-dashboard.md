# Voice AI Frontend - Sprint 11: Tenant Usage Dashboard (TENANT)

**Sprint Type**: Tenant Interface
**Route**: `/(dashboard)/voice-ai/usage`
**Permission**: Owner, Admin, Manager
**API Documentation**: `api/documentation/voice_ai_REST_API.md` (Lines 1586-1659)

---

## 🎯 MASTERPIECE DEVELOPER

### ⚠️ CRITICAL RULES

1-7: NO GUESSING | VERIFY ENDPOINTS | localhost:8000 | ASK HUMAN | NO BACKEND EDITS | ALL FIELDS | ERROR HANDLING

---

## 📋 Test Credentials

Tenant Owner: `contact@honeydo4you.com` / `978@F32c`

---

## 🔍 Endpoint Verification

```bash
# GET usage summary
curl -X GET "http://localhost:8000/api/v1/voice-ai/usage?year=2026&month=2" \
  -H "Authorization: Bearer <tenant_token>"
```

---

## 📦 Data Model

```typescript
interface UsageSummary {
  year: number;
  month: number;
  total_calls: number;
  total_stt_seconds: number;                    // For quota calculation
  total_llm_tokens: number;
  total_tts_characters: number;
  estimated_cost: number;
  by_provider: Array<{
    provider_id: string;
    provider_key: string;
    provider_type: 'STT' | 'LLM' | 'TTS';
    total_seconds?: number;                     // STT
    total_tokens?: number;                      // LLM
    total_characters?: number;                  // TTS
    estimated_cost: number;
  }>;
}
```

---

## 🏗️ Implementation

### Files

```
(dashboard)/voice-ai/
├── usage/
│   └── page.tsx                    # Usage dashboard
```

### Components

```
voice-ai/tenant/
├── usage/
│   ├── UsageKPICards.tsx           # KPI summary cards
│   ├── QuotaProgressBar.tsx        # Visual quota indicator
│   ├── MonthYearSelector.tsx       # Month/year filter
│   ├── ProviderBreakdown.tsx       # Usage by provider table
│   ├── UsageChart.tsx              # Trends chart (optional)
│   └── UpgradePlanCTA.tsx          # Show if quota exceeded
```

---

## 📋 Implementation Tasks

### 1. Usage Dashboard

**Month/Year Selector**:
- [ ] Year dropdown (current year ± 2 years)
- [ ] Month dropdown (1-12)
- [ ] Auto-fetch on change
- [ ] Default: Current month/year

**KPI Cards** (top row):

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Total Calls      │ │ Minutes Used     │ │ Minutes Remaining│
│     120          │ │     240          │ │      260         │
└──────────────────┘ └──────────────────┘ └──────────────────┘

┌──────────────────────────────────────────────────┐
│ Estimated Cost                                   │
│                 $48.50                           │
└──────────────────────────────────────────────────┘
```

**Quota Progress Bar**:
```
Voice AI Usage - February 2026
───────────────────────────────────────────────────────

Plan: Professional (500 minutes/month)
[████████░░░░░░░░░░░░░░░░░░░░░░░░] 240 / 500 minutes (48%)

⚠️ You are approaching your quota limit.
```

**Overage Warning** (if quota exceeded):
```
⚠️ QUOTA EXCEEDED

You have used 520 minutes of your 500 minute monthly quota.
Overage: 20 minutes

Your plan blocks calls when quota is exceeded.
Upgrade your plan to increase your monthly minutes.

[Upgrade Plan]
```

---

### 2. Provider Breakdown Table

**Table Columns**:
| Provider | Type | Usage | Estimated Cost |
|----------|------|-------|----------------|
| Deepgram | STT | 240 minutes | $10.32 |
| OpenAI | LLM | 15,420 tokens | $23.13 |
| Cartesia | TTS | 8,930 characters | $15.05 |

**Features**:
- [ ] Display usage by provider type (STT/LLM/TTS)
- [ ] Show provider-specific metrics:
  - STT: total_seconds (converted to minutes)
  - LLM: total_tokens
  - TTS: total_characters
- [ ] Estimated cost per provider
- [ ] Total estimated cost at bottom

---

### 3. Usage Chart (Optional)

**Chart Options**:
- Line chart showing daily usage trends for the month
- Bar chart showing usage by day
- Pie chart showing usage breakdown by provider type

**Implementation** (using recharts or chart.js):

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

<LineChart width={600} height={300} data={dailyUsageData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="day" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="calls" stroke="#8884d8" name="Calls" />
  <Line type="monotone" dataKey="minutes" stroke="#82ca9d" name="Minutes" />
</LineChart>
```

---

## 🔄 API Integration

```typescript
// Fetch usage summary
const fetchUsage = async (year: number, month: number) => {
  const response = await fetch(
    `/api/v1/voice-ai/usage?year=${year}&month=${month}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) throw new Error('Failed to fetch usage');
  return response.json();
};

// Calculate minutes from seconds
const minutesUsed = Math.ceil(usageSummary.total_stt_seconds / 60);

// Calculate percentage
const percentageUsed = (minutesUsed / planMinutesIncluded) * 100;

// Check if over quota
const isOverQuota = minutesUsed > planMinutesIncluded;
const overageMinutes = isOverQuota ? minutesUsed - planMinutesIncluded : 0;
```

---

## 🎨 Quota Progress Bar

```typescript
const QuotaProgressBar = ({ used, total, overageRate }) => {
  const percentage = Math.min((used / total) * 100, 100);
  const isOverQuota = used > total;
  const overage = used - total;

  const barColor = isOverQuota
    ? 'bg-red-500'
    : percentage > 80
    ? 'bg-yellow-500'
    : 'bg-green-500';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Used: {used} minutes</span>
        <span>Limit: {total} minutes</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className={`h-4 rounded-full ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-sm text-gray-600">
        <span>{percentage.toFixed(1)}% used</span>
        {isOverQuota && (
          <span className="text-red-600 font-semibold">
            Overage: {overage} minutes
          </span>
        )}
      </div>

      {isOverQuota && !overageRate && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-800">
            ⚠️ Quota exceeded. Your plan blocks calls when quota is exceeded.
            <a href="/billing/upgrade" className="underline ml-2">Upgrade Plan</a>
          </p>
        </div>
      )}
    </div>
  );
};
```

---

## 🎨 Design Guidelines

### Usage Dashboard Layout

```
Voice AI Usage Dashboard
────────────────────────────────────────────────

[Month: February ▼] [Year: 2026 ▼]

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Total Calls      │ │ Minutes Used     │ │ Minutes Remaining│
│     120          │ │     240 / 500    │ │      260         │
└──────────────────┘ └──────────────────┘ └──────────────────┘

Quota Status
────────────────────────────────────────────────
Plan: Professional (500 minutes/month)
[████████████░░░░░░░░░░░░░░░░░░] 48% used

Usage Breakdown by Provider
────────────────────────────────────────────────
┌──────────────────────────────────────────────┐
│ Provider  │ Type │ Usage          │ Cost     │
├──────────────────────────────────────────────┤
│ Deepgram  │ STT  │ 240 min        │ $10.32   │
│ OpenAI    │ LLM  │ 15,420 tokens  │ $23.13   │
│ Cartesia  │ TTS  │ 8,930 chars    │ $15.05   │
├──────────────────────────────────────────────┤
│ TOTAL                            │ $48.50   │
└──────────────────────────────────────────────┘

Usage Trends (Optional)
────────────────────────────────────────────────
[Line chart showing daily usage]
```

---

## ⚠️ Error Handling

- No data for selected period (show empty state)
- Invalid year/month

---

## 🔐 RBAC Implementation

```typescript
<ProtectedRoute requiredRole={['Owner', 'Admin', 'Manager']}>
  <UsageDashboard />
</ProtectedRoute>
```

---

## ✅ Acceptance Criteria

- ✅ Endpoints verified
- ✅ Usage summary displays for selected month/year
- ✅ KPI cards show correct totals
- ✅ Quota progress bar displays correctly
- ✅ Minutes calculated from seconds (STT usage)
- ✅ Percentage used calculated correctly
- ✅ Overage warning shows if quota exceeded
- ✅ Provider breakdown table works
- ✅ Provider-specific metrics display (minutes/tokens/chars)
- ✅ Estimated cost displays
- ✅ Month/year selector works
- ✅ Upgrade CTA shows if over quota
- ✅ Empty state shows if no usage data
- ✅ Usage chart works (if implemented)
- ✅ RBAC works (Owner/Admin/Manager can view)
- ✅ Mobile responsive
- ✅ Dark mode

---

**If backend issues: STOP + ASK HUMAN.**

---

**End of Sprint 11** (FINAL SPRINT - 100% Coverage Complete!)
