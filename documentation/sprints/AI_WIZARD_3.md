# Sprint AI_WIZARD_3: Create IndustriesSummary Component

> **FOR MASTERCLASS AI AGENT CODERS**
>
> You are an elite frontend developer who writes clean, maintainable components. You understand data fetching patterns, error handling, and responsive design. You never break working code. You test thoroughly before declaring victory.

---

## Sprint Metadata

**Module**: Voice AI - Context Enhancement
**Sprint**: AI_WIZARD_3
**Depends on**: AI_WIZARD_2 (BusinessHoursSummary complete)
**Estimated time**: 1-1.5 hours
**Complexity**: LOW
**Risk**: LOW (new component, similar pattern to Sprint 2)

---

## Objective

Create a **read-only** IndustriesSummary component that displays business industries in Voice AI settings. This component fetches industries from the tenant profile and displays them as badges.

**What Success Looks Like**:
- Component displays industries as badges
- Shows warning if no industries configured
- Multiple industries wrap correctly on small screens
- Loading and error states work
- Mobile responsive and dark mode work
- Handles admin-only note gracefully

---

## Test Credentials

**Tenant User**:
- Email: `contact@honeydo4you.com`
- Password: `978@F32c`
- Tenant ID: `14a34ab2-6f6f-4e41-9bea-c444a304557e`

---

## STEP 0: Test the API BEFORE Writing Component

**CRITICAL**: Verify the tenant profile API returns industries.

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

### Test GET Current Tenant (Check for Industries)

```bash
curl https://api.lead360.app/api/v1/tenants/current \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.industries'
```

**Expected Response Options**:

**Option 1** (Industries Configured):
```json
[
  {
    "id": "uuid",
    "name": "Plumbing",
    "description": "Plumbing services and repairs"
  },
  {
    "id": "uuid",
    "name": "HVAC",
    "description": "Heating, ventilation, and air conditioning services"
  }
]
```

**Option 2** (No Industries):
```json
null
```
or
```json
[]
```

**Key Observations**:
- Industries may be `null`, `[]`, or array of objects
- Each industry has: `id`, `name`, `description` (nullable)
- Industries are admin-managed (tenant can't edit directly)

✅ **Only proceed if API returns valid response. If error, call a human.**

---

## Documentation to Read First

**MANDATORY READING**:

1. **BusinessHoursSummary Component** (just created):
   - `/var/www/lead360.app/app/src/components/voice-ai/tenant/settings/BusinessHoursSummary.tsx`
   - Understand: Similar pattern - loading, error, empty state

2. **Badge Component**:
   - `/var/www/lead360.app/app/src/components/ui/Badge.tsx` (entire file)
   - Understand: How Badge variants work, how to use them

3. **Tenant Types**:
   - `/var/www/lead360.app/app/src/lib/types/tenant.ts` (check if Industry interface exists)

4. **Tenant API Client**:
   - `/var/www/lead360.app/app/src/lib/api/tenant.ts` (find `getCurrentTenant`)

**Time Investment**: 10-15 minutes

---

## Implementation Steps

### Step 1: Check/Add Industry Type Definition

**File**: `/var/www/lead360.app/app/src/lib/types/tenant.ts`

Search for `Industry` interface. If it doesn't exist, add it:

```typescript
export interface Industry {
  id: string;
  name: string;
  description: string | null;
}
```

If `TenantProfile` doesn't have `industries` field, add it:

```typescript
export interface TenantProfile {
  id: string;
  company_name: string;
  // ... other fields ...
  industries?: Industry[] | null; // ← ADD THIS IF MISSING
  // ... rest of fields ...
}
```

**Verification**: TypeScript compiles with no errors.

---

### Step 2: Create IndustriesSummary Component

**File**: `/var/www/lead360.app/app/src/components/voice-ai/tenant/settings/IndustriesSummary.tsx` (NEW)

Create this new file:

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { Briefcase, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import * as tenantApi from '@/lib/api/tenant';

interface Industry {
  id: string;
  name: string;
  description: string | null;
}

export function IndustriesSummary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [industries, setIndustries] = useState<Industry[]>([]);

  useEffect(() => {
    loadIndustries();
  }, []);

  const loadIndustries = async () => {
    try {
      setLoading(true);
      setError(null);
      const tenant = await tenantApi.getCurrentTenant();

      // Industries may be null, undefined, or array
      setIndustries(tenant.industries || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load industries');
    } finally {
      setLoading(false);
    }
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
          <h3 className="font-semibold">Error Loading Industries</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={loadIndustries}
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
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Briefcase className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Business Industries
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Helps the Voice AI agent understand your business type and services
      </p>

      {/* Content: Empty state or industries badges */}
      {industries.length === 0 ? (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No industries selected</AlertTitle>
          <AlertDescription>
            Industries help the AI agent understand your business context.
            Contact your administrator to configure industries for your account.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          {industries.map((industry) => (
            <Badge
              key={industry.id}
              variant="secondary"
              className="text-sm px-3 py-1"
            >
              {industry.name}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
```

**Code Explanation**:

1. **State Management**:
   - Same pattern as BusinessHoursSummary
   - `loading`, `error`, `industries`

2. **Data Handling**:
   - `tenant.industries || []` - Handles null/undefined gracefully
   - No direct tenant editing (admin-managed)

3. **Badge Display**:
   - `flex flex-wrap gap-2` - Badges wrap on small screens
   - `variant="secondary"` - Gray badges (not primary blue)
   - `px-3 py-1` - Comfortable padding

4. **Empty State**:
   - Yellow warning (not red error)
   - Notes that admin configures industries
   - No "Configure now" link (tenant can't self-configure)

5. **No Edit Button**:
   - Unlike BusinessHoursSummary, no edit button
   - Industries are platform-wide reference data (admin-only)

---

### Step 3: Import Badge Component (if needed)

Ensure Badge is available. Check if it exists:

**File**: `/var/www/lead360.app/app/src/components/ui/Badge.tsx`

If Badge component doesn't exist, here's a minimal implementation:

```typescript
import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger';
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', className = '', children }: BadgeProps) {
  const baseClasses = 'inline-flex items-center rounded-full text-xs font-medium';

  const variantClasses = {
    default: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
```

**Note**: Only add this if Badge doesn't exist. Most likely it already exists from exploration.

---

## Testing Checklist

Test in this order:

### Setup
- [ ] Start app: `cd /var/www/lead360.app/app && npm run dev`
- [ ] Login as `contact@honeydo4you.com` / `978@F32c`
- [ ] Component file created at correct path
- [ ] No TypeScript errors

### Loading State
- [ ] DevTools → Network → Throttle to "Slow 3G"
- [ ] Navigate to where component is placed
- [ ] Loading spinner shows briefly
- [ ] Spinner is centered in card

### Success State (With Industries)
- [ ] Component displays industries as badges
- [ ] Each industry shows as a gray badge
- [ ] Industry names are readable
- [ ] Briefcase icon is visible
- [ ] Description text is visible

### Multiple Industries
- [ ] If multiple industries exist, they display in a row
- [ ] Badges wrap to next line on small screens
- [ ] Gap between badges is consistent
- [ ] All badges same height

### Empty State (No Industries)
- [ ] Yellow warning alert shows
- [ ] Warning says "No industries selected"
- [ ] Description mentions contacting administrator
- [ ] Alert has AlertCircle icon

### Error State
- [ ] Temporarily break API (invalid URL)
- [ ] Component shows error message in red
- [ ] "Try Again" button appears
- [ ] Click button - component retries
- [ ] Restore correct API

### Mobile Responsive
- [ ] DevTools → iPhone SE (375px)
- [ ] Card spans full width
- [ ] Badges wrap to multiple lines
- [ ] No horizontal overflow
- [ ] Text is readable

### Dark Mode
- [ ] Switch to dark mode
- [ ] Card background is dark
- [ ] Badges have dark background
- [ ] Badge text is light colored
- [ ] Icon is visible
- [ ] Warning alert has dark background

### Badge Styling
- [ ] Badges have rounded corners
- [ ] Badges have consistent padding
- [ ] Badge text size is readable (not too small)
- [ ] Hover state exists (if applicable)

### Performance
- [ ] No console errors
- [ ] No console warnings
- [ ] No TypeScript errors
- [ ] Component renders quickly (<500ms)

### API Integration
- [ ] DevTools → Network tab
- [ ] Component makes GET to `/api/v1/tenants/current`
- [ ] Request has Authorization header
- [ ] Response is 200 OK
- [ ] Response includes `industries` field
- [ ] No duplicate requests

---

## Success Criteria

**This sprint is complete when**:

1. ✅ Component file created and compiles
2. ✅ Loading state shows spinner
3. ✅ Industries display as gray badges
4. ✅ Multiple industries wrap correctly
5. ✅ Empty state shows yellow warning
6. ✅ Warning mentions admin configuration
7. ✅ Error state shows with retry button
8. ✅ Mobile responsive (badges wrap at 375px)
9. ✅ Dark mode works (badges readable)
10. ✅ No console errors
11. ✅ All 30+ checklist items pass

**Definition of Done**:
- Component is self-contained
- Handles null/undefined/empty array
- Follows existing patterns
- Ready to integrate into Voice AI settings

---

## Troubleshooting Guide

### Issue: "industries is not a property of TenantProfile"

**Solution**:
- Add `industries?: Industry[] | null;` to TenantProfile interface
- Restart TypeScript server

### Issue: Badges not wrapping

**Solution**:
- Ensure parent div has `flex flex-wrap gap-2`
- Check no `flex-nowrap` is applied
- Test at narrow viewport (375px)

### Issue: Badge component not found

**Solution**:
- Check `/app/src/components/ui/Badge.tsx` exists
- If not, create minimal Badge component (see Step 3)
- Ensure correct import path

### Issue: Industries always null

**Solution**:
- Check API response with curl (Step 0)
- Industries may not be configured for this tenant
- Test with different tenant or admin account

### Issue: Component not rendering

**Solution**:
- Check import path
- Ensure exported correctly
- Verify placed in parent component JSX

---

## Files Created/Modified Summary

1. ✅ `/app/src/components/voice-ai/tenant/settings/IndustriesSummary.tsx` (NEW - ~150 lines)
2. ⚠️ `/app/src/lib/types/tenant.ts` (IF Industry interface missing)
3. ⚠️ `/app/src/components/ui/Badge.tsx` (IF Badge doesn't exist)

**Total Changes**: 1 new file, possibly 2 modifications

---

## Persona Reminder

You are a **masterclass developer**. Before marking complete:

- ✅ Test with industries present
- ✅ Test with no industries (empty state)
- ✅ Test badge wrapping on small screens
- ✅ Test dark mode (badges readable)
- ✅ Verify API integration
- ✅ No console errors

**If you find ANY issue, stop and call a human.**

Your component is production-ready. 🚀

---

## Next Sprint

After this sprint is complete and all tests pass, proceed to:
- **AI_WIZARD_4**: Integrate Context Displays into Voice AI Settings Page
