# Sprint AI_WIZARD_2: Create BusinessHoursSummary Component

> **FOR MASTERCLASS AI AGENT CODERS**
>
> You are an elite frontend developer who deeply understands React component patterns. You never break existing code. You test APIs before writing components. You write clean, maintainable, production-ready code that makes senior engineers applaud.

---

## Sprint Metadata

**Module**: Voice AI - Context Enhancement
**Sprint**: AI_WIZARD_2
**Depends on**: AI_WIZARD_1 (business_description field complete)
**Estimated time**: 1.5-2 hours
**Complexity**: LOW-MEDIUM
**Risk**: LOW (new component, no modifications to existing code)

---

## Objective

Create a **read-only** BusinessHoursSummary component that displays business operating hours in Voice AI settings. This component fetches hours from the existing tenant API and displays them in a clean, formatted card with a link to edit.

**What Success Looks Like**:
- Component displays business hours in Voice AI settings
- Hours shown in 12-hour format (e.g., "9:00 AM - 5:00 PM")
- Supports split shifts (e.g., "8:00 AM - 12:00 PM, 2:00 PM - 6:00 PM")
- Shows warning if no hours configured
- "Edit Hours" button navigates correctly
- Loading and error states work
- Mobile responsive and dark mode work

---

## Test Credentials

**Tenant User**:
- Email: `contact@honeydo4you.com`
- Password: `978@F32c`
- Tenant ID: `14a34ab2-6f6f-4e41-9bea-c444a304557e`

---

## STEP 0: Test the API BEFORE Writing Component

**CRITICAL**: Verify the business hours API works before writing React code.

### Get JWT Token

```bash
curl -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@honeydo4you.com",
    "password": "978@F32c"
  }' | jq -r '.access_token'
```

Save token:
```bash
export TOKEN="<paste_token_here>"
```

### Test GET Business Hours

```bash
curl https://api.lead360.app/api/v1/tenants/current/business-hours \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

**Expected Response Structure**:
```json
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "day_of_week": 1,
    "day_name": "Monday",
    "is_closed": false,
    "open_time_1": "09:00",
    "close_time_1": "17:00",
    "open_time_2": null,
    "close_time_2": null,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  },
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "day_of_week": 2,
    "day_name": "Tuesday",
    "is_closed": false,
    "open_time_1": "08:00",
    "close_time_1": "12:00",
    "open_time_2": "14:00",
    "close_time_2": "18:00",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  },
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "day_of_week": 0,
    "day_name": "Sunday",
    "is_closed": true,
    "open_time_1": null,
    "close_time_1": null,
    "open_time_2": null,
    "close_time_2": null,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
]
```

**Key Observations**:
- Returns array of 7 objects (one per day)
- `is_closed: true` means closed that day
- Times in 24-hour format: "09:00", "17:00"
- Can have 2 shifts: `open_time_1`/`close_time_1` and `open_time_2`/`close_time_2`
- May return empty array `[]` if no hours configured

✅ **Only proceed if API returns valid data or empty array. If error, call a human.**

---

## Documentation to Read First

**MANDATORY READING** - Understand these patterns before coding:

1. **Existing Voice AI Components**:
   - `/var/www/lead360.app/app/src/components/voice-ai/tenant/settings/VoiceAISettingsForm.tsx` (lines 1-150)
   - Understand: How Voice AI components are structured

2. **Card Component**:
   - `/var/www/lead360.app/app/src/components/ui/Card.tsx` (entire file)
   - Understand: How Card is used for containers

3. **Alert Component**:
   - `/var/www/lead360.app/app/src/components/ui/alert.tsx` (entire file)
   - Understand: Alert, AlertTitle, AlertDescription pattern

4. **Tenant API Client**:
   - `/var/www/lead360.app/app/src/lib/api/tenant.ts` (find `getBusinessHours` function)
   - Understand: How to call the API

5. **Loading Patterns**:
   - Search for "Loader2" in Voice AI components
   - Understand: How loading spinners are used

**Time Investment**: 15-20 minutes

---

## Implementation Steps

### Step 1: Check if getBusinessHours API Function Exists

**File**: `/var/www/lead360.app/app/src/lib/api/tenant.ts`

Search for `getBusinessHours`. If it exists, skip to Step 2. If NOT, add it:

```typescript
/**
 * Get business hours for authenticated tenant
 */
export async function getBusinessHours(): Promise<any[]> {
  const { data } = await apiClient.get('/api/v1/tenants/current/business-hours');
  return data;
}
```

**Verification**: TypeScript compiles with no errors.

---

### Step 2: Create BusinessHoursSummary Component

**File**: `/var/www/lead360.app/app/src/components/voice-ai/tenant/settings/BusinessHoursSummary.tsx` (NEW)

Create this new file with the following content:

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, Settings, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import * as tenantApi from '@/lib/api/tenant';

interface BusinessHour {
  id: string;
  tenant_id: string;
  day_of_week: number;
  day_name: string;
  is_closed: boolean;
  open_time_1: string | null;
  close_time_1: string | null;
  open_time_2: string | null;
  close_time_2: string | null;
  created_at: string;
  updated_at: string;
}

export function BusinessHoursSummary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);

  useEffect(() => {
    loadBusinessHours();
  }, []);

  const loadBusinessHours = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tenantApi.getBusinessHours();
      setBusinessHours(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load business hours');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string | null): string => {
    if (!time) return '';

    // Parse 24-hour time "09:00" or "17:00"
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);

    // Convert to 12-hour format
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatShifts = (hour: BusinessHour): string => {
    if (hour.is_closed) return 'Closed';

    const shifts: string[] = [];

    // First shift
    if (hour.open_time_1 && hour.close_time_1) {
      shifts.push(`${formatTime(hour.open_time_1)} - ${formatTime(hour.close_time_1)}`);
    }

    // Second shift (lunch break support)
    if (hour.open_time_2 && hour.close_time_2) {
      shifts.push(`${formatTime(hour.open_time_2)} - ${formatTime(hour.close_time_2)}`);
    }

    return shifts.length > 0 ? shifts.join(', ') : 'Closed';
  };

  // Loading state
  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
          <AlertCircle className="h-5 w-5" />
          <h3 className="font-semibold">Error Loading Business Hours</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={loadBusinessHours}
          className="mt-3"
        >
          Try Again
        </Button>
      </Card>
    );
  }

  // Main content
  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Business Hours
          </h3>
        </div>
        <Link href="/settings/business#hours">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Edit Hours
          </Button>
        </Link>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        The Voice AI agent uses these hours to inform callers when you're open
      </p>

      {/* Content: Empty state or hours list */}
      {businessHours.length === 0 ? (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Business hours not configured</AlertTitle>
          <AlertDescription>
            Set your operating hours so the AI agent can inform callers when you're available.
            <Link
              href="/settings/business#hours"
              className="underline ml-1 font-medium hover:text-yellow-800 dark:hover:text-yellow-200"
            >
              Configure now →
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          {businessHours.map((hour) => (
            <div
              key={hour.id}
              className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
            >
              <span className="font-medium text-gray-900 dark:text-gray-100 w-24">
                {hour.day_name}
              </span>
              <span
                className={
                  hour.is_closed
                    ? 'text-gray-500 dark:text-gray-400 italic'
                    : 'text-gray-700 dark:text-gray-300'
                }
              >
                {formatShifts(hour)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

**Code Explanation**:

1. **State Management**:
   - `loading` - Shows spinner during API call
   - `error` - Stores error message if API fails
   - `businessHours` - Stores fetched hours data

2. **formatTime Function**:
   - Converts 24-hour format ("17:00") to 12-hour ("5:00 PM")
   - Handles midnight (0 → 12 AM)
   - Handles noon (12 → 12 PM)

3. **formatShifts Function**:
   - Returns "Closed" for closed days
   - Formats single shift: "9:00 AM - 5:00 PM"
   - Formats split shift: "8:00 AM - 12:00 PM, 2:00 PM - 6:00 PM"

4. **Three States**:
   - Loading: Spinner
   - Error: Error message with retry button
   - Success: Hours list or empty state warning

5. **Dark Mode**:
   - All colors have `dark:` variants
   - Follows platform color scheme

---

### Step 3: Export Component (if needed)

If your project uses an index file for exports, add:

**File**: `/var/www/lead360.app/app/src/components/voice-ai/tenant/settings/index.ts`

```typescript
export { BusinessHoursSummary } from './BusinessHoursSummary';
// ... other exports
```

---

## Testing Checklist

Test in this order:

### Setup
- [ ] Start app: `cd /var/www/lead360.app/app && npm run dev`
- [ ] Login as `contact@honeydo4you.com` / `978@F32c`
- [ ] Component file created at correct path
- [ ] No TypeScript errors in IDE

### Loading State
- [ ] Open browser DevTools → Network tab → Throttle to "Slow 3G"
- [ ] Navigate to Voice AI settings (or wherever component is placed)
- [ ] Component shows loading spinner briefly
- [ ] Spinner is centered in card
- [ ] Card has proper padding

### Success State (With Hours Configured)
- [ ] Component displays business hours
- [ ] All 7 days shown (Monday - Sunday)
- [ ] Times in 12-hour format (e.g., "9:00 AM - 5:00 PM")
- [ ] Closed days show "Closed" in italic gray
- [ ] Split shifts show both shifts (e.g., "8:00 AM - 12:00 PM, 2:00 PM - 6:00 PM")
- [ ] "Edit Hours" button is visible
- [ ] Clock icon is visible
- [ ] Description text is readable

### Empty State (No Hours Configured)
- [ ] If tenant has no hours, yellow warning alert shows
- [ ] Warning says "Business hours not configured"
- [ ] "Configure now →" link is visible and clickable
- [ ] Alert has AlertCircle icon

### Error State
- [ ] Temporarily break API (change URL in tenant.ts to invalid endpoint)
- [ ] Component shows error message
- [ ] Error message is red
- [ ] "Try Again" button appears
- [ ] Click "Try Again" - component attempts reload
- [ ] Restore correct API URL

### Time Formatting
- [ ] Midnight (00:00) displays as "12:00 AM"
- [ ] Noon (12:00) displays as "12:00 PM"
- [ ] Morning (09:00) displays as "9:00 AM"
- [ ] Afternoon (14:00) displays as "2:00 PM"
- [ ] Evening (17:00) displays as "5:00 PM"
- [ ] Night (23:00) displays as "11:00 PM"

### Navigation
- [ ] Click "Edit Hours" button
- [ ] Browser navigates to `/settings/business#hours`
- [ ] Page scrolls to Hours section (if anchor works)
- [ ] Can navigate back and component reloads correctly

### Mobile Responsive
- [ ] DevTools → iPhone SE (375px)
- [ ] Card spans full width
- [ ] Header wraps gracefully (icon + title on one line, button below if needed)
- [ ] Day names and hours are readable
- [ ] No horizontal overflow
- [ ] Button is touch-friendly (44px tap target)

### Dark Mode
- [ ] Switch to dark mode
- [ ] Card background is dark
- [ ] Text is light and readable
- [ ] Icons are appropriate color
- [ ] Borders are visible but subtle
- [ ] "Closed" days are gray but still readable
- [ ] Warning alert has dark background

### Performance
- [ ] No console errors
- [ ] No console warnings
- [ ] No TypeScript errors
- [ ] Component renders in <500ms
- [ ] No unnecessary re-renders (check React DevTools)

### API Integration
- [ ] DevTools → Network tab
- [ ] Component makes GET request to `/api/v1/tenants/current/business-hours`
- [ ] Request includes Authorization header
- [ ] Response is 200 OK
- [ ] Response body is array of hours
- [ ] No duplicate requests

---

## Success Criteria

**This sprint is complete when**:

1. ✅ Component file created and compiles without errors
2. ✅ Loading state shows spinner
3. ✅ Business hours display correctly in 12-hour format
4. ✅ Split shifts format correctly (comma-separated)
5. ✅ Closed days show "Closed" in italic
6. ✅ Empty state shows warning with link
7. ✅ Error state shows error message with retry button
8. ✅ "Edit Hours" button navigates to `/settings/business#hours`
9. ✅ Mobile responsive (375px tested)
10. ✅ Dark mode works
11. ✅ No console errors
12. ✅ All 40+ checklist items pass

**Definition of Done**:
- Component is self-contained and reusable
- Follows existing code patterns
- Handles all edge cases (empty, error, loading)
- Ready to integrate into Voice AI settings page

---

## Troubleshooting Guide

### Issue: "getBusinessHours is not a function"

**Solution**:
- Check `/app/src/lib/api/tenant.ts`
- Add the function if it doesn't exist (see Step 1)
- Restart dev server: `Ctrl+C` then `npm run dev`

### Issue: Times showing as "NaN:00 AM"

**Solution**:
- Check `formatTime` function
- Ensure `parseInt(hours, 10)` has base 10 specified
- Test with console.log to see raw time values

### Issue: Component not rendering

**Solution**:
- Check import path in parent component
- Ensure component is exported correctly
- Check for TypeScript errors
- Verify component is placed in JSX

### Issue: API returns 401 Unauthorized

**Solution**:
- JWT token may be expired
- Re-login to get fresh token
- Check Authorization header is being sent

### Issue: Warning alert always shows even with hours

**Solution**:
- Check `businessHours.length === 0` condition
- Console.log `businessHours` to verify data
- Ensure API is returning array, not null

---

## Files Created/Modified Summary

1. ✅ `/app/src/components/voice-ai/tenant/settings/BusinessHoursSummary.tsx` (NEW - ~200 lines)
2. ⚠️ `/app/src/lib/api/tenant.ts` (IF getBusinessHours doesn't exist, add it)

**Total Changes**: 1 new file, possibly 1 modified file

---

## Persona Reminder

You are a **masterclass developer**. Before marking this sprint complete:

- ✅ Test all time formats (midnight, noon, AM, PM)
- ✅ Test split shift formatting
- ✅ Test empty state
- ✅ Test error state with retry
- ✅ Verify navigation works
- ✅ Test mobile responsive (375px, 768px)
- ✅ Test dark mode
- ✅ No console errors
- ✅ API integration verified in Network tab

**If you find ANY issue, stop and call a human.**

Your component is production-ready, reusable, and maintainable. 🚀

---

## Next Sprint

After this sprint is complete and all tests pass, proceed to:
- **AI_WIZARD_3**: Create IndustriesSummary Component
