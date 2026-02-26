# Sprint AI_WIZARD_4: Integrate Context Displays into Voice AI Settings

> **FOR MASTERCLASS AI AGENT CODERS**
>
> You are an integration specialist. You know how to add components to existing pages without breaking layouts. You test thoroughly after integration. You understand responsive grid systems and visual hierarchy.

---

## Sprint Metadata

**Module**: Voice AI - Context Enhancement
**Sprint**: AI_WIZARD_4
**Depends on**: AI_WIZARD_2 (BusinessHoursSummary) + AI_WIZARD_3 (IndustriesSummary)
**Estimated time**: 1 hour
**Complexity**: LOW
**Risk**: LOW (adding components to existing page)

---

## Objective

Integrate BusinessHoursSummary and IndustriesSummary components into the Voice AI settings page. Create a new "Agent Context Information" section above the existing Voice AI behavior settings.

**What Success Looks Like**:
- Two components display in 2-column grid on desktop
- Components stack to 1 column on mobile
- Clear visual separation between context and settings sections
- Page layout remains intact
- No existing functionality broken
- Mobile responsive and dark mode work

---

## Test Credentials

**Tenant User**:
- Email: `contact@honeydo4you.com`
- Password: `978@F32c`

---

## STEP 0: Review the Target Page

**CRITICAL**: Understand the existing page structure before modifying.

### Read the Existing Voice AI Settings Page

**File**: `/var/www/lead360.app/app/src/app/(dashboard)/voice-ai/settings/page.tsx`

**What to Look For**:
1. Where does the page content start? (after breadcrumb?)
2. What components already exist? (VoiceAISettingsForm?)
3. What's the layout structure? (containers, grids?)
4. Are there any existing sections or headers?
5. What imports are at the top?

**Time Investment**: 10 minutes to read and understand

---

## Documentation to Read First

**MANDATORY READING**:

1. **Voice AI Settings Page**:
   - `/var/www/lead360.app/app/src/app/(dashboard)/voice-ai/settings/page.tsx` (entire file)
   - Understand: Page structure, existing components, layout

2. **Breadcrumb Component** (if used):
   - Check how breadcrumbs are implemented

3. **VoiceAISettingsForm**:
   - `/var/www/lead360.app/app/src/components/voice-ai/tenant/settings/VoiceAISettingsForm.tsx` (first 50 lines)
   - Understand: How it's imported and used

4. **Responsive Grid Patterns**:
   - Review Tailwind grid classes: `grid`, `grid-cols-1`, `lg:grid-cols-2`, `gap-6`

**Time Investment**: 10-15 minutes

---

## Implementation Steps

### Step 1: Add Imports

**File**: `/var/www/lead360.app/app/src/app/(dashboard)/voice-ai/settings/page.tsx`

At the top of the file, add these imports (after existing imports):

```typescript
import { BusinessHoursSummary } from '@/components/voice-ai/tenant/settings/BusinessHoursSummary';
import { IndustriesSummary } from '@/components/voice-ai/tenant/settings/IndustriesSummary';
```

**Placement**: Add after other component imports, before the page component definition.

**Verification**: No TypeScript import errors.

---

### Step 2: Add Context Section to Page

**File**: `/var/www/lead360.app/app/src/app/(dashboard)/voice-ai/settings/page.tsx`

Find where the main content starts. This is typically after:
- Breadcrumb component
- Page title/header

**Insert this section BEFORE the existing VoiceAISettingsForm**:

```tsx
{/* Agent Context Information Section */}
<div className="mb-8">
  {/* Section Header */}
  <div className="mb-6">
    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
      Agent Context Information
    </h2>
    <p className="text-sm text-gray-600 dark:text-gray-400">
      The Voice AI agent uses this information to provide accurate, helpful responses to callers.
      Keep this information up-to-date to ensure the best caller experience.
    </p>
  </div>

  {/* 2-Column Grid for Context Components */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <BusinessHoursSummary />
    <IndustriesSummary />
  </div>
</div>

{/* Divider */}
<div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>

{/* Voice AI Behavior Settings Section Header */}
<div className="mb-6">
  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
    Voice AI Behavior Settings
  </h2>
  <p className="text-sm text-gray-600 dark:text-gray-400">
    Configure how your Voice AI agent behaves during calls
  </p>
</div>
```

**Then the existing VoiceAISettingsForm continues as normal**:
```tsx
{/* Existing form */}
<VoiceAISettingsForm />
```

**Code Explanation**:

1. **Section Header**:
   - `text-xl font-bold` - Prominent section title
   - Description explains purpose to users
   - `mb-6` spacing before grid

2. **Responsive Grid**:
   - `grid grid-cols-1` - Single column on mobile
   - `lg:grid-cols-2` - Two columns on large screens (1024px+)
   - `gap-6` - 1.5rem spacing between cards

3. **Divider**:
   - `border-t` - Top border only
   - `my-8` - Vertical margin (2rem) for visual separation
   - Dark mode border color

4. **Settings Section Header**:
   - Clarifies what the existing form controls
   - Matches style of context section header

**Visual Hierarchy**:
```
┌─────────────────────────────────┐
│ [Breadcrumb]                    │
├─────────────────────────────────┤
│ Agent Context Information       │
│ [Description text]              │
│                                 │
│ ┌──────────┐  ┌──────────┐    │
│ │ Business │  │Industries│    │ ← New Section
│ │  Hours   │  │          │    │
│ └──────────┘  └──────────┘    │
├─────────────────────────────────┤
│ Voice AI Behavior Settings      │
│ [Description text]              │
│                                 │
│ [VoiceAISettingsForm]           │ ← Existing
└─────────────────────────────────┘
```

---

### Step 3: Verify Page Structure

After integration, the page structure should be:

```tsx
export default function VoiceAISettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb (if exists) */}
      <Breadcrumb ... />

      {/* NEW: Context Section */}
      <div className="mb-8">
        <div className="mb-6">
          <h2>Agent Context Information</h2>
          <p>Description...</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BusinessHoursSummary />
          <IndustriesSummary />
        </div>
      </div>

      {/* NEW: Divider */}
      <div className="border-t my-8"></div>

      {/* NEW: Settings Header */}
      <div className="mb-6">
        <h2>Voice AI Behavior Settings</h2>
        <p>Description...</p>
      </div>

      {/* EXISTING: Settings Form */}
      <VoiceAISettingsForm />
    </div>
  );
}
```

---

## Testing Checklist

### Setup
- [ ] Start app: `cd /var/www/lead360.app/app && npm run dev`
- [ ] Login as `contact@honeydo4you.com` / `978@F32c`
- [ ] Navigate to Voice AI → Settings
- [ ] No TypeScript errors
- [ ] No console errors

### Layout - Desktop (1024px+)
- [ ] DevTools → Responsive mode → 1440px width
- [ ] "Agent Context Information" header appears
- [ ] Description text is readable
- [ ] BusinessHoursSummary and IndustriesSummary display side-by-side
- [ ] Both cards have equal width
- [ ] Gap between cards is consistent (1.5rem / 24px)
- [ ] Cards align at top (not stretched)

### Layout - Tablet (768px)
- [ ] DevTools → Set to 768px width
- [ ] Components still side-by-side OR stacked (depends on `lg:` breakpoint at 1024px)
- [ ] If stacked, each card full width
- [ ] No horizontal overflow

### Layout - Mobile (375px)
- [ ] DevTools → iPhone SE (375px)
- [ ] Components stack vertically (1 column)
- [ ] Each card full width
- [ ] Gap between stacked cards is consistent
- [ ] No horizontal scroll
- [ ] Text wraps correctly
- [ ] Headers readable

### Visual Separation
- [ ] Divider line appears between sections
- [ ] Divider spans full width
- [ ] Divider color is subtle (gray-200)
- [ ] Vertical spacing around divider is balanced (2rem above/below)

### Section Headers
- [ ] "Agent Context Information" header is bold and prominent
- [ ] "Voice AI Behavior Settings" header matches style
- [ ] Both headers have description text
- [ ] Description text is smaller and gray
- [ ] Headers have proper spacing (mb-2, mb-6)

### Component Integration
- [ ] BusinessHoursSummary loads and displays
- [ ] IndustriesSummary loads and displays
- [ ] Both components fetch data independently
- [ ] Loading spinners work
- [ ] Error states work if API fails

### Existing Functionality
- [ ] VoiceAISettingsForm still works
- [ ] Can toggle Voice AI on/off
- [ ] Can save settings
- [ ] Form validation works
- [ ] Success/error toasts work
- [ ] No regression in existing features

### Dark Mode
- [ ] Switch to dark mode
- [ ] Section headers are light colored
- [ ] Description text is readable (gray-400)
- [ ] Divider is visible but subtle (gray-700)
- [ ] Both cards have dark backgrounds
- [ ] Overall page looks cohesive

### Responsive Breakpoints
- [ ] At 1023px width - components stack
- [ ] At 1024px width - components side-by-side
- [ ] Transition is smooth (no layout jump)

### Performance
- [ ] No console errors
- [ ] No console warnings
- [ ] No TypeScript errors
- [ ] Page loads in <2 seconds
- [ ] No layout shift (CLS)

### Accessibility
- [ ] Headers use semantic HTML (h2)
- [ ] Color contrast is sufficient (WCAG AA)
- [ ] Keyboard navigation works
- [ ] Screen reader can read content

---

## Success Criteria

**This sprint is complete when**:

1. ✅ Both components imported correctly
2. ✅ Context section appears above settings form
3. ✅ 2-column grid on desktop (≥1024px)
4. ✅ 1-column stack on mobile (<1024px)
5. ✅ Divider separates sections clearly
6. ✅ Section headers are styled consistently
7. ✅ Existing VoiceAISettingsForm works unchanged
8. ✅ Mobile responsive (375px, 768px, 1024px tested)
9. ✅ Dark mode works throughout
10. ✅ No console errors
11. ✅ All 40+ checklist items pass

**Definition of Done**:
- Integration complete without breaking existing features
- Layout is professional and balanced
- Responsive at all breakpoints
- Ready for production

---

## Troubleshooting Guide

### Issue: Components don't appear

**Solution**:
- Check imports are correct (paths match file locations)
- Verify components are exported correctly
- Check JSX placement (inside return statement)
- Look for TypeScript errors in IDE

### Issue: Grid not responsive

**Solution**:
- Verify `grid grid-cols-1 lg:grid-cols-2` classes
- Check no conflicting CSS
- Test at exact breakpoint (1024px)
- Ensure Tailwind is compiled correctly

### Issue: Components overlapping

**Solution**:
- Check `gap-6` is present on grid
- Verify each component has proper Card wrapper
- Check no negative margins

### Issue: Divider not visible

**Solution**:
- Verify `border-t border-gray-200 dark:border-gray-700`
- Check not hidden by other elements (z-index)
- Ensure `my-8` spacing is present
- Test in both light and dark mode

### Issue: Existing form broken

**Solution**:
- Check no closing tags removed
- Verify form is still rendered after new section
- Check no props accidentally modified
- Restore from git if needed: `git diff page.tsx`

### Issue: Mobile layout broken

**Solution**:
- Check parent container has proper width classes
- Verify no `min-w-` classes forcing width
- Test at 375px (iPhone SE)
- Check for horizontal overflow

---

## Files Modified Summary

1. ✅ `/app/src/app/(dashboard)/voice-ai/settings/page.tsx` - Added imports and context section

**Total Changes**: 1 file modified (~30 lines added)

---

## Code Diff Preview

**Before**:
```tsx
export default function VoiceAISettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb ... />
      <VoiceAISettingsForm />
    </div>
  );
}
```

**After**:
```tsx
import { BusinessHoursSummary } from '@/components/voice-ai/tenant/settings/BusinessHoursSummary';
import { IndustriesSummary } from '@/components/voice-ai/tenant/settings/IndustriesSummary';

export default function VoiceAISettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb ... />

      {/* NEW: Context Section */}
      <div className="mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Agent Context Information
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The Voice AI agent uses this information to provide accurate, helpful responses.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BusinessHoursSummary />
          <IndustriesSummary />
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Voice AI Behavior Settings
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure how your Voice AI agent behaves during calls
        </p>
      </div>

      <VoiceAISettingsForm />
    </div>
  );
}
```

---

## Persona Reminder

You are a **masterclass developer**. Before marking complete:

- ✅ Test at all breakpoints (375px, 768px, 1024px, 1440px)
- ✅ Verify existing form still works
- ✅ Check dark mode
- ✅ No console errors
- ✅ Layout is professional and balanced
- ✅ Mobile UX is excellent

**If you find ANY issue, stop and call a human.**

Your integration is seamless and production-ready. 🚀

---

## Next Sprint

After this sprint is complete and all tests pass, proceed to:
- **AI_WIZARD_5**: Create Setup Wizard & Completion Tracking
