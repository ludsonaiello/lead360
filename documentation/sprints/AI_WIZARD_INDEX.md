# Voice AI Context Enhancement - Sprint Index

> **FOR MASTERCLASS AI AGENT CODERS**
>
> This document provides an overview of all 5 sprints required to implement the Voice AI Context Enhancement & Setup Wizard feature. Read this first to understand the big picture, then execute each sprint sequentially.

---

## Overview

**Feature**: Voice AI Context Enhancement & Setup Wizard
**Total Sprints**: 5
**Estimated Time**: 10-13 hours
**Backend Status**: ✅ COMPLETE (all APIs ready)
**Risk Level**: LOW (incremental, well-planned sprints)

---

## What We're Building

### The Problem
Voice AI agents need comprehensive business context to provide helpful, accurate responses to callers. Currently, essential information is scattered across different settings, and tenants may not know what to configure.

### The Solution
1. **Add business_description field** - Let tenants describe their company story
2. **Display context information** - Show what the AI agent knows (business hours, industries)
3. **Create setup wizard** - Guide tenants through complete Voice AI configuration
4. **Track completion** - Remind tenants if setup is incomplete

---

## Sprint Breakdown

### 🎯 Sprint 1: Add business_description to Tenant Settings
**File**: `AI_WIZARD_1.md`
**Time**: 2-3 hours
**Complexity**: LOW
**Dependencies**: None

**What You'll Build**:
- Add `business_description` field to tenant profile types
- Add validation (max 5000 characters)
- Add field to BusinessInfoWizard Step 1
- Field saves to backend via existing API

**Files Modified**:
- `/app/src/lib/types/tenant.ts`
- `/app/src/lib/utils/validation.ts`
- `/app/src/components/tenant/BusinessInfoWizard.tsx`

**Success**: Field appears, character counter works, saves/loads correctly

---

### 🎯 Sprint 2: Create BusinessHoursSummary Component
**File**: `AI_WIZARD_2.md`
**Time**: 1.5-2 hours
**Complexity**: LOW-MEDIUM
**Dependencies**: Sprint 1 complete

**What You'll Build**:
- Read-only component displaying business hours
- Fetches from existing tenant API
- Shows hours in 12-hour format (9:00 AM - 5:00 PM)
- Supports split shifts (lunch breaks)
- Warning if no hours configured
- "Edit Hours" button navigates to settings

**Files Created**:
- `/app/src/components/voice-ai/tenant/settings/BusinessHoursSummary.tsx`

**Success**: Hours display correctly, time formatting works, navigation works

---

### 🎯 Sprint 3: Create IndustriesSummary Component
**File**: `AI_WIZARD_3.md`
**Time**: 1-1.5 hours
**Complexity**: LOW
**Dependencies**: Sprint 2 complete

**What You'll Build**:
- Read-only component displaying industries
- Fetches from tenant profile
- Shows industries as gray badges
- Warning if no industries configured
- Note that industries are admin-managed

**Files Created**:
- `/app/src/components/voice-ai/tenant/settings/IndustriesSummary.tsx`

**Success**: Industries display as badges, wrap on mobile, handles empty state

---

### 🎯 Sprint 4: Integrate Context Displays
**File**: `AI_WIZARD_4.md`
**Time**: 1 hour
**Complexity**: LOW
**Dependencies**: Sprints 2 & 3 complete

**What You'll Build**:
- Add "Agent Context Information" section to Voice AI settings page
- 2-column grid on desktop (BusinessHoursSummary + IndustriesSummary)
- 1-column stack on mobile
- Visual divider separating context from settings
- Section headers and descriptions

**Files Modified**:
- `/app/src/app/(dashboard)/voice-ai/settings/page.tsx`

**Success**: Both components display, responsive grid works, layout professional

---

### 🎯 Sprint 5: Create Setup Wizard & Tracking
**File**: `AI_WIZARD_5.md`
**Time**: 5-6 hours
**Complexity**: HIGH
**Dependencies**: All previous sprints complete

**What You'll Build**:
- 7-step modal wizard:
  1. Welcome
  2. Business Hours (check/configure)
  3. Services (check/configure)
  4. Service Areas (check/configure)
  5. Business Description (inline editing)
  6. Transfer Numbers (optional)
  7. Complete (checklist)
- Progress bar with percentage
- Clickable step indicator
- Setup status checks (API calls)
- Business description inline editing
- External navigation to settings pages
- Completion tracking via localStorage
- Setup banner with "Start Wizard" button
- Dismissible banner

**Files Created**:
- `/app/src/components/voice-ai/tenant/settings/VoiceAiSetupWizard.tsx` (~650 lines)

**Files Modified**:
- `/app/src/app/(dashboard)/voice-ai/settings/page.tsx` (add banner + wizard trigger)

**Success**: Wizard guides through setup, tracks completion, banner behavior correct

---

## Sequential Execution Order

**CRITICAL**: Execute sprints in order. Do NOT skip ahead.

```
Sprint 1 → Sprint 2 → Sprint 3 → Sprint 4 → Sprint 5
  ✓         ✓           ✓          ✓          ✓
```

**Why Sequential**:
1. Sprint 1 adds data that Sprint 5 uses (business_description)
2. Sprints 2 & 3 create components that Sprint 4 integrates
3. Sprint 5 depends on all previous sprints being complete
4. Risk increases in each sprint - building foundation first

---

## Test Credentials (All Sprints)

**Tenant User (Owner/Admin)**:
- Email: `contact@honeydo4you.com`
- Password: `978@F32c`
- Tenant ID: `14a34ab2-6f6f-4e41-9bea-c444a304557e`

**Admin User** (if needed):
- Email: `ludsonaiello@gmail.com`
- Password: `978@F32c`

**ALWAYS test APIs with curl BEFORE writing UI code.**

---

## API Endpoints Used

All endpoints are tested and working:

| Endpoint | Method | Purpose | Used In |
|----------|--------|---------|---------|
| `/api/v1/auth/login` | POST | Get JWT token | All sprints |
| `/api/v1/tenants/current` | GET | Get tenant profile | Sprints 1, 3, 5 |
| `/api/v1/tenants/current` | PATCH | Update tenant profile | Sprints 1, 5 |
| `/api/v1/tenants/current/business-hours` | GET | Get business hours | Sprints 2, 5 |
| `/api/v1/voice-ai/transfer-numbers` | GET | Get transfer numbers | Sprint 5 |
| `/api/v1/voice-ai/settings` | GET | Get Voice AI settings | Sprint 5 |

---

## Files Summary

### New Files (4)
1. `/app/src/components/voice-ai/tenant/settings/BusinessHoursSummary.tsx` (~200 lines)
2. `/app/src/components/voice-ai/tenant/settings/IndustriesSummary.tsx` (~150 lines)
3. `/app/src/components/voice-ai/tenant/settings/VoiceAiSetupWizard.tsx` (~650 lines)

### Modified Files (4)
1. `/app/src/lib/types/tenant.ts` (add business_description)
2. `/app/src/lib/utils/validation.ts` (add validation)
3. `/app/src/components/tenant/BusinessInfoWizard.tsx` (add field)
4. `/app/src/app/(dashboard)/voice-ai/settings/page.tsx` (integrate all)

**Total Impact**: 4 new files, 4 modified files, ~1100 lines of code

---

## Testing Requirements

### Per-Sprint Testing
- Each sprint has 30-100+ checklist items
- Test immediately after completing sprint
- Don't proceed to next sprint until all tests pass

### Cross-Browser Testing (After All Sprints)
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### Responsive Testing (All Sprints)
- Mobile: 375px (iPhone SE)
- Tablet: 768px (iPad)
- Desktop: 1024px (laptop)
- Large: 1440px (desktop)

### Dark Mode (All Sprints)
- Test every component in both light and dark mode
- Verify text readable, borders visible, colors appropriate

---

## Success Criteria (Overall)

**All 5 sprints complete when**:

1. ✅ business_description field works in tenant settings
2. ✅ Character counter shows "0 / 5000" and updates
3. ✅ Field saves/loads correctly (API integration)
4. ✅ BusinessHoursSummary displays hours (12-hour format)
5. ✅ Split shifts format correctly
6. ✅ IndustriesSummary displays industries as badges
7. ✅ Both components show warnings if empty
8. ✅ Context section integrated into Voice AI settings
9. ✅ 2-column grid on desktop, 1-column on mobile
10. ✅ Setup wizard opens from banner
11. ✅ All 7 wizard steps work
12. ✅ Progress bar updates correctly
13. ✅ Business description editable inline in wizard
14. ✅ External navigation works (closes wizard, navigates)
15. ✅ Completion tracked in localStorage
16. ✅ Banner shows/dismisses correctly
17. ✅ All 300+ test items pass across all sprints
18. ✅ Mobile responsive (all breakpoints)
19. ✅ Dark mode works (all components)
20. ✅ No console errors anywhere
21. ✅ No TypeScript errors
22. ✅ No existing functionality broken
23. ✅ RBAC respected (Owner/Admin only for wizard)

---

## Common Pitfalls to Avoid

### ❌ Don't Skip API Testing
**Problem**: Writing UI before testing APIs
**Solution**: Always curl test endpoints first (Step 0 in each sprint)

### ❌ Don't Break Existing Code
**Problem**: Modifying working components incorrectly
**Solution**: Only ADD new code, don't refactor existing

### ❌ Don't Skip Mobile Testing
**Problem**: Only testing on desktop
**Solution**: Test at 375px on every sprint

### ❌ Don't Ignore Dark Mode
**Problem**: Only testing light mode
**Solution**: Toggle to dark mode and verify readability

### ❌ Don't Rush Validation
**Problem**: Skipping checklist items
**Solution**: Complete every test item before proceeding

### ❌ Don't Assume localStorage Works
**Problem**: Not testing localStorage edge cases
**Solution**: Test set, get, clear, browser restart

### ❌ Don't Skip Character Counter Testing
**Problem**: Assuming it works without testing
**Solution**: Type exactly 5000 chars, test real-time updates

### ❌ Don't Forget Error Handling
**Problem**: Only testing happy path
**Solution**: Test API failures, network errors, empty states

---

## Development Environment Setup

### Prerequisites
- Node.js 18+ installed
- npm or yarn available
- Git for version control
- Access to test tenant account

### Start Development Server
```bash
cd /var/www/lead360.app/app
npm run dev
```

### Check TypeScript Errors
```bash
npm run type-check
# OR
npx tsc --noEmit
```

### Browser DevTools
- Network tab - verify API calls
- Console - check for errors
- React DevTools - check component state
- Responsive mode - test breakpoints

---

## Estimated Timeline

### Day 1 (3-4 hours)
- Read all documentation (1 hour)
- Sprint 1: business_description field (2-3 hours)

### Day 2 (3-4 hours)
- Sprint 2: BusinessHoursSummary (1.5-2 hours)
- Sprint 3: IndustriesSummary (1-1.5 hours)
- Sprint 4: Integration (1 hour)

### Day 3 (5-6 hours)
- Sprint 5: Setup Wizard (5-6 hours)

**Total**: 10-13 hours across 3 days

---

## Quality Standards

### Code Quality
- No TypeScript errors (`any` types avoided)
- No console warnings or errors
- Follows existing code patterns exactly
- Component names match conventions
- Proper error handling (try/catch)
- Loading states for all async operations

### UX Quality
- Mobile-first responsive design
- Dark mode support everywhere
- Loading spinners for data fetching
- Error messages user-friendly
- Success toasts for confirmations
- Consistent spacing and alignment
- Professional visual hierarchy

### Testing Quality
- All checklist items completed
- Edge cases tested (null, empty, max length)
- Cross-browser tested
- Multiple viewport sizes tested
- Dark mode tested
- RBAC tested

---

## Getting Help

### If You Encounter Issues

1. **API Errors**:
   - Re-test with curl
   - Check JWT token not expired
   - Verify request payload matches backend expectations

2. **TypeScript Errors**:
   - Check interface definitions match
   - Restart TypeScript server
   - Run `npm run type-check`

3. **Component Not Rendering**:
   - Verify import paths correct
   - Check component exported correctly
   - Look for console errors

4. **Styling Issues**:
   - Check Tailwind classes correct
   - Verify dark mode classes present
   - Test at different breakpoints

5. **State Management Issues**:
   - Console.log state values
   - Check useState/useEffect dependencies
   - Verify state updates trigger re-renders

### When to Call a Human
- API endpoint doesn't exist or returns wrong data
- Cannot resolve TypeScript errors after 30 minutes
- Breaking existing functionality despite careful changes
- Fundamental architecture questions
- Security concerns

---

## Success Checklist (Use This)

Mark each sprint as complete:

- [ ] **Sprint 1 Complete**: business_description field works (all tests pass)
- [ ] **Sprint 2 Complete**: BusinessHoursSummary displays (all tests pass)
- [ ] **Sprint 3 Complete**: IndustriesSummary displays (all tests pass)
- [ ] **Sprint 4 Complete**: Context section integrated (all tests pass)
- [ ] **Sprint 5 Complete**: Setup wizard works (all tests pass)

Final verification:
- [ ] All 5 sprints complete
- [ ] 300+ test items passed
- [ ] Cross-browser tested
- [ ] Mobile responsive (375px, 768px, 1024px)
- [ ] Dark mode works everywhere
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No existing features broken
- [ ] Ready for production deployment

---

## Persona: You Are a Masterclass Developer

**Remember**:
- ✅ You review EVERY line of code
- ✅ You understand context deeply
- ✅ You NEVER break working code
- ✅ You test APIs before writing UI
- ✅ You complete all checklist items
- ✅ You write production-quality code
- ✅ You make FAANG engineers jealous
- ✅ You call humans when you find mistakes

**Your code is your signature. Make it perfect.** 🚀

---

## Next Steps

1. **Read this entire document** (10 minutes)
2. **Review the comprehensive plan** at `/root/.claude/plans/soft-enchanting-scroll.md`
3. **Start with Sprint 1**: Open `AI_WIZARD_1.md`
4. **Execute sequentially**: 1 → 2 → 3 → 4 → 5
5. **Celebrate**: You've built an enterprise-grade feature 🎉

---

**Good luck, masterclass developer. The platform depends on you.** 💪
