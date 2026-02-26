# Sprint AI_WIZARD_1: Add business_description to Tenant Settings

> **FOR MASTERCLASS AI AGENT CODERS**
>
> You are an elite frontend developer. You understand context deeply, review every line of code, and never break working functionality. You test APIs before writing UI code. You write production-quality code that makes FAANG engineers jealous.

---

## Sprint Metadata

**Module**: Voice AI - Context Enhancement
**Sprint**: AI_WIZARD_1
**Depends on**: None (all backend APIs ready)
**Estimated time**: 2-3 hours
**Complexity**: LOW
**Risk**: LOW (single field addition to existing wizard)

---

## Objective

Add a "Business Description" field to the tenant settings Business Info Wizard (Step 1). This field allows tenants to describe their company story, which the Voice AI agent uses to introduce the business to callers.

**What Success Looks Like**:
- Field appears in BusinessInfoWizard Step 1
- Character counter shows "0 / 5000" and updates in real-time
- Field saves correctly to backend (PATCH /api/v1/tenants/current)
- Field loads correctly on page refresh
- Mobile responsive and dark mode work
- No TypeScript or console errors

---

## Test Credentials (Login Before You Code)

**Tenant User**:
- Email: `contact@honeydo4you.com`
- Password: `978@F32c`
- Tenant ID: `14a34ab2-6f6f-4e41-9bea-c444a304557e`

**Admin User** (if needed):
- Email: `ludsonaiello@gmail.com`
- Password: `978@F32c`

---

## STEP 0: Test the API BEFORE Writing Any Code

**CRITICAL**: You MUST verify the API works before writing UI code.

### Get JWT Token

```bash
# Login and get token
curl -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@honeydo4you.com",
    "password": "978@F32c"
  }' | jq -r '.access_token'
```

Save the token:
```bash
export TOKEN="<paste_token_here>"
```

### Test GET Current Tenant

```bash
curl https://api.lead360.app/api/v1/tenants/current \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

**Expected**: You should see tenant profile JSON. Look for `business_description` field (may be null).

### Test PATCH Update Tenant

```bash
curl -X PATCH https://api.lead360.app/api/v1/tenants/current \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "business_description": "Test description from curl"
  }' | jq '.'
```

**Expected**: 200 OK with updated tenant profile showing your test description.

### Verify It Saved

```bash
curl https://api.lead360.app/api/v1/tenants/current \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.business_description'
```

**Expected**: Should return `"Test description from curl"`

✅ **Only proceed if all 3 API tests pass. If any fail, call a human immediately.**

---

## Documentation to Read First

**MANDATORY READING** - Read these files completely before writing any code:

1. **Existing Implementation Pattern**:
   - `/var/www/lead360.app/app/src/components/tenant/BusinessInfoWizard.tsx` (lines 1-600)
   - Understand: How the 4-step wizard works, how form state is managed, how validation works

2. **Textarea Component**:
   - `/var/www/lead360.app/app/src/components/ui/Textarea.tsx` (entire file)
   - Understand: How `showCharacterCount` works, how `maxLength` is enforced

3. **Validation Pattern**:
   - `/var/www/lead360.app/app/src/lib/utils/validation.ts` (lines 327-392)
   - Understand: How Zod schemas are structured for business info

4. **Type Definitions**:
   - `/var/www/lead360.app/app/src/lib/types/tenant.ts` (lines 1-100)
   - Understand: Existing TenantProfile and BusinessInfoFormData interfaces

5. **API Client**:
   - `/var/www/lead360.app/app/src/lib/api/tenant.ts` (look for `updateTenantProfile` function)
   - Understand: How tenant updates are sent to backend

**Time Investment**: 20-30 minutes to read and understand context

---

## Implementation Steps

### Step 1: Add business_description to Type Definitions

**File**: `/var/www/lead360.app/app/src/lib/types/tenant.ts`

**Action**: Add `business_description` to two interfaces

#### 1.1: Add to TenantProfile interface

Find the `TenantProfile` interface (around line 28). Add after `services_offered`:

```typescript
export interface TenantProfile {
  id: string;
  company_name: string;
  legal_business_name: string | null;
  dba_name: string | null;
  // ... other fields ...
  services_offered: string[] | null;
  business_description: string | null; // ← ADD THIS LINE
  // ... rest of fields ...
}
```

#### 1.2: Add to BusinessInfoFormData interface

Find the `BusinessInfoFormData` interface (around line 597). Add after `sales_tax_permit`:

```typescript
export interface BusinessInfoFormData {
  // Legal & Tax
  legal_business_name?: string;
  dba_name?: string;
  // ... other fields ...
  sales_tax_permit?: string;
  business_description?: string; // ← ADD THIS LINE
  // ... rest of fields ...
}
```

**Verification**:
- Run `npm run type-check` (if available) or check TypeScript errors in IDE
- No TypeScript errors should appear

---

### Step 2: Add Validation Schema

**File**: `/var/www/lead360.app/app/src/lib/utils/validation.ts`

**Action**: Add validation rule for `business_description`

Find the `businessLegalSchema` (around line 327). Add after `sales_tax_permit`:

```typescript
export const businessLegalSchema = z.object({
  legal_business_name: z.string().optional().or(z.literal('')),
  dba_name: z.string().optional().or(z.literal('')),
  business_entity_type: z.string().optional().or(z.literal('')),
  state_of_registration: z.string().optional().or(z.literal('')),
  date_of_incorporation: z.string().optional().or(z.literal('')),
  ein: z.string().optional().or(z.literal('')),
  state_tax_id: z.string().optional().or(z.literal('')),
  sales_tax_permit: z.string().optional().or(z.literal('')),
  business_description: z.string()
    .max(5000, 'Business description must be less than 5000 characters')
    .optional()
    .or(z.literal('')), // ← ADD THESE 3 LINES
  default_language: z.string().optional().or(z.literal('')),
  services_offered: z.array(z.string()).optional(),
});
```

**Why This Pattern**:
- `.max(5000)` - Backend enforces 5000 char limit
- `.optional()` - Field is not required
- `.or(z.literal(''))` - Allows empty string (form pattern)

**Verification**:
- No TypeScript errors
- Validation schema compiles correctly

---

### Step 3: Add Field to BusinessInfoWizard

**File**: `/var/www/lead360.app/app/src/components/tenant/BusinessInfoWizard.tsx`

#### 3.1: Add to Default Values

Find the `step1Form` initialization (around line 194). Add after `sales_tax_permit`:

```typescript
const step1Form = useForm<BusinessLegalFormData>({
  resolver: zodResolver(businessLegalSchema),
  defaultValues: {
    legal_business_name: tenant?.legal_business_name || '',
    dba_name: tenant?.dba_name || '',
    business_entity_type: tenant?.business_entity_type || '',
    state_of_registration: tenant?.state_of_registration || '',
    date_of_incorporation: tenant?.date_of_incorporation || '',
    ein: tenant?.ein || '',
    state_tax_id: tenant?.state_tax_id || '',
    sales_tax_permit: tenant?.sales_tax_permit || '',
    business_description: tenant?.business_description || '', // ← ADD THIS LINE
    default_language: tenant?.default_language || 'en',
    services_offered: tenant?.services_offered || [],
  },
});
```

#### 3.2: Add Field to Step 1 Form UI

Find Step 1 content (around line 473, after `sales_tax_permit` field). Add:

```tsx
{/* Business Description */}
<div className="col-span-1 md:col-span-2">
  <Controller
    name="business_description"
    control={step1Form.control}
    render={({ field }) => (
      <Textarea
        {...field}
        value={field.value || ''}
        label="Business Description (Optional)"
        placeholder="Tell us about your business - your story, specialties, service area, years in business, etc. This helps our Voice AI agent introduce your company to callers."
        error={step1Form.formState.errors.business_description?.message}
        helperText="Used by Voice AI agent to introduce your business to callers. Maximum 5000 characters."
        rows={6}
        maxLength={5000}
        showCharacterCount={true}
        resize="vertical"
      />
    )}
  />
</div>
```

**Why This Code**:
- `col-span-1 md:col-span-2` - Full width on mobile, 2 columns on desktop
- `Controller` - react-hook-form pattern for controlled components
- `value={field.value || ''}` - Prevents null/undefined errors
- `showCharacterCount={true}` - Shows "X / 5000 characters"
- `maxLength={5000}` - Enforces max length client-side
- `resize="vertical"` - Users can resize vertically only

**Location Guide**:
- Place AFTER the `sales_tax_permit` field
- Place BEFORE the `default_language` field
- Should be in the "Legal & Tax Information" section of Step 1

#### 3.3: Verify Field Position

The field should appear in Step 1, in this order:
1. Legal Business Name
2. DBA Name
3. Business Entity Type
4. State of Registration
5. Date of Incorporation
6. EIN
7. State Tax ID
8. Sales Tax Permit
9. **Business Description** ← NEW FIELD HERE
10. Default Language
11. Services Offered

---

### Step 4: Verify API Integration (No Changes Needed)

The `updateTenantProfile` function in `/var/www/lead360.app/app/src/lib/api/tenant.ts` already accepts all fields from `BusinessInfoFormData`, including `business_description`. No code changes needed here.

**Why**: The API client already sends all form fields to the backend. Adding the field to the type is sufficient.

---

## Testing Checklist

Test in this order. Mark each item as you complete it:

### Basic Functionality
- [ ] Start the app: `cd /var/www/lead360.app/app && npm run dev`
- [ ] Login as `contact@honeydo4you.com` / `978@F32c`
- [ ] Navigate to Settings → Business Settings
- [ ] Field appears in Step 1 (Legal & Tax) after Sales Tax Permit
- [ ] Field label is "Business Description (Optional)"
- [ ] Placeholder text is visible and descriptive
- [ ] Helper text appears below field

### Character Counter
- [ ] Character counter shows "0 / 5000" when empty
- [ ] Counter updates in real-time as you type
- [ ] Counter shows correct count (e.g., "245 / 5000")
- [ ] Counter turns red when approaching limit (if implemented in Textarea component)

### Validation
- [ ] Can type freely up to 5000 characters
- [ ] Cannot type more than 5000 characters (enforced by maxLength)
- [ ] If you paste >5000 chars, it truncates to 5000
- [ ] Error message appears if >5000 chars submitted (Zod validation)

### Save Functionality
- [ ] Fill in business description (e.g., "Family-owned company serving Miami for 20+ years")
- [ ] Click "Next" to go to Step 2
- [ ] Complete wizard or click "Save" button
- [ ] Success toast appears: "Business profile updated successfully"
- [ ] No console errors during save

### Data Persistence
- [ ] Refresh the page (F5)
- [ ] Navigate back to Business Settings → Step 1
- [ ] Business description field shows the saved text
- [ ] Character counter shows correct count for loaded text

### Empty Field Handling
- [ ] Clear the business description field (delete all text)
- [ ] Save the form
- [ ] Refresh page
- [ ] Field is empty (not showing "null" or error)

### Mobile Responsive
- [ ] Open browser DevTools (F12)
- [ ] Set viewport to "iPhone SE" (375px width)
- [ ] Field spans full width on mobile
- [ ] Textarea is usable (not cut off)
- [ ] Character counter is visible
- [ ] Can scroll within textarea
- [ ] Save button is accessible

### Dark Mode
- [ ] Switch to dark mode (if theme toggle exists)
- [ ] Field background is dark
- [ ] Text is light colored and readable
- [ ] Border color is appropriate for dark mode
- [ ] Character counter is visible in dark mode
- [ ] Placeholder text is visible (lighter gray)

### Error Handling
- [ ] Open browser console (F12 → Console tab)
- [ ] Fill in field and save
- [ ] No red errors in console
- [ ] No TypeScript errors
- [ ] No React warnings

### API Verification (Final Check)
- [ ] Open browser DevTools → Network tab
- [ ] Fill in business description
- [ ] Save form
- [ ] Find the PATCH request to `/api/v1/tenants/current`
- [ ] Click on request → Payload tab
- [ ] Verify `business_description` is in the payload
- [ ] Response status is 200 OK
- [ ] Response body includes `business_description` field

---

## Success Criteria

**This sprint is complete when**:

1. ✅ Field appears in BusinessInfoWizard Step 1
2. ✅ Character counter shows "0 / 5000" and updates in real-time
3. ✅ Validation prevents >5000 characters (error message)
4. ✅ Field saves correctly to backend (verified in Network tab)
5. ✅ Field loads correctly on page refresh (persistence works)
6. ✅ Empty field saves as null (not breaking)
7. ✅ Mobile responsive (375px width tested)
8. ✅ Dark mode works (if enabled)
9. ✅ No TypeScript errors
10. ✅ No console errors
11. ✅ All 30+ checklist items pass

**Definition of Done**:
- Code follows existing patterns exactly
- Field placement is correct (after Sales Tax Permit)
- All tests pass
- Ready for production deployment

---

## Troubleshooting Guide

### Issue: "business_description is not a property of TenantProfile"

**Solution**:
- Check `/app/src/lib/types/tenant.ts`
- Ensure `business_description: string | null;` is added to `TenantProfile` interface
- Restart TypeScript server: VSCode → Cmd+Shift+P → "TypeScript: Restart TS Server"

### Issue: Character counter not showing

**Solution**:
- Verify `showCharacterCount={true}` is set on Textarea
- Check Textarea component has this prop implemented
- Read `/app/src/components/ui/Textarea.tsx` to understand implementation

### Issue: Field not saving

**Solution**:
1. Check Network tab → PATCH request payload
2. Verify `business_description` is in the request body
3. Check backend logs for errors
4. Verify tenant API client includes the field
5. Test API with curl (see Step 0) to isolate frontend vs backend issue

### Issue: TypeScript errors after adding field

**Solution**:
- Ensure field is added to BOTH `TenantProfile` and `BusinessInfoFormData` interfaces
- Restart TypeScript server
- Run `npm run type-check` if available

### Issue: Validation not working

**Solution**:
- Check `businessLegalSchema` in validation.ts
- Ensure `.max(5000)` is present
- Verify schema is imported correctly in BusinessInfoWizard
- Check console for validation errors

---

## Files Modified Summary

1. ✅ `/app/src/lib/types/tenant.ts` - Added `business_description` to 2 interfaces
2. ✅ `/app/src/lib/utils/validation.ts` - Added validation rule
3. ✅ `/app/src/components/tenant/BusinessInfoWizard.tsx` - Added field to Step 1

**Total Changes**: 3 files, ~15 lines of code

---

## Persona Reminder

You are a **masterclass developer**. Before marking this sprint complete:

- ✅ Review every line you wrote
- ✅ Test all 30+ checklist items
- ✅ Verify no existing code was broken
- ✅ Ensure mobile and dark mode work
- ✅ Check for console errors
- ✅ Verify API integration works end-to-end
- ✅ Test edge cases (empty field, max length, special characters)

**If you find ANY issue, stop and call a human.**

Your code is production-ready. Make Google engineers jealous. 🚀

---

## Next Sprint

After this sprint is complete and all tests pass, proceed to:
- **AI_WIZARD_2**: Create BusinessHoursSummary Component
