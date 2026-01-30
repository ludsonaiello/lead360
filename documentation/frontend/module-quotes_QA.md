# QA Agent: Quote Module Review & Integration Testing

**Agent**: QA Lead Agent  
**Duration**: Parallel to all sprints + 5 days final review  
**Role**: Review, test, fix issues across all sprints

---

## YOUR DOCUMENTATION

**MUST READ COMPLETELY**:
1. `QUOTE_FRONTEND_GLOBAL_INSTRUCTIONS.md`
2. `api/documentation/quotes_REST_API.md` (entire file)
3. All 6 sprint instruction files (SPRINT_1 through SPRINT_6)
4. Existing patterns from Jobs/Auth/Files modules

---

## YOUR MISSION

You are responsible for:
- Reviewing code from all 6 developers
- Testing integration between features
- Fixing bugs across the entire module
- Ensuring consistency and quality
- Creating comprehensive test coverage
- Final sign-off for production readiness

---

## PHASE 1: CONTINUOUS REVIEW (DURING SPRINTS)

### After Each Sprint Completion

**Code Review Checklist**:
- [ ] Property names match API documentation exactly
- [ ] All endpoints tested with both user accounts
- [ ] TypeScript types match API response structures
- [ ] Form validation uses Zod schemas
- [ ] Error handling present for all API calls
- [ ] Loading states implemented
- [ ] Empty states implemented
- [ ] No console errors or warnings
- [ ] Follows existing UI patterns
- [ ] Code is readable and maintainable

**UI/UX Review Checklist**:
- [ ] Long forms (5+ fields) use full page layout
- [ ] Simple forms (1-4 fields) use modals
- [ ] No browser alerts/confirms (uses modals)
- [ ] All dropdowns are searchable
- [ ] Multi-select shows pills and removes selected from list
- [ ] Action buttons include icons
- [ ] Input masks applied (money, percentage, phone)
- [ ] Google Maps integrated for addresses
- [ ] Status badges color-coded correctly
- [ ] Responsive design works (mobile, tablet, desktop)

**Functional Testing Checklist**:
- [ ] Test with admin account
- [ ] Test with tenant account
- [ ] Test error scenarios (400, 404, 422, 500)
- [ ] Test loading states (slow network)
- [ ] Test empty states (no data)
- [ ] Test validation (required fields, formats)
- [ ] Test success/error notifications

**Document Issues**:
For each issue found:
1. Sprint number
2. Feature/component affected
3. Issue description
4. Steps to reproduce
5. Expected vs actual behavior
6. Severity (critical, high, medium, low)

---

## PHASE 2: INTEGRATION TESTING (AFTER ALL SPRINTS)

### End-to-End Workflows

Test these complete user journeys:

**Workflow 1: Complete Quote Creation to Acceptance**
1. Create quote from existing lead
2. Add multiple items (some from library)
3. Organize items into groups
4. Add discount rules
5. Upload attachments (cover photo + URL with QR)
6. Submit for approval
7. Approve at each level
8. Send via email
9. Generate public URL with password
10. View as public user (incognito)
11. Accept quote

**Workflow 2: Quote with Change Order**
1. Create and approve quote
2. Create change order (add items)
3. Approve change order
4. Verify version history shows change
5. Compare versions
6. Restore previous version

**Workflow 3: Library and Bundle Usage**
1. Bulk import library items (CSV)
2. Create bundle from library items
3. Add bundle to quote
4. Save quote item back to library
5. Reuse saved item in new quote

**Workflow 4: Dashboard and Analytics**
1. Create multiple quotes with different statuses
2. View dashboard (verify counts)
3. Filter by date range
4. Export dashboard data
5. Use advanced search
6. Save search
7. View quote analytics (public URL views)

### Cross-Feature Testing

**Data Consistency**:
- [ ] Quote totals update after item changes
- [ ] Discount calculations correct (compound)
- [ ] Profitability margins accurate
- [ ] Draw schedule percentages validate (100%)
- [ ] Library usage counts increment
- [ ] Tag assignments persist
- [ ] Version history captures all changes

**Permission Testing**:
- [ ] Admin can access all features
- [ ] Tenant user has appropriate restrictions
- [ ] Approval workflow respects roles
- [ ] Owner bypass works correctly

**Navigation Testing**:
- [ ] All internal links work
- [ ] Breadcrumbs accurate
- [ ] Back button behavior correct
- [ ] Deep linking works (direct URLs)

---

## PHASE 3: BUG FIXING

### Your Fixing Responsibilities

You MUST be able to fix issues across ALL sprints:
- Sprint 1: Core quotes, vendors, settings
- Sprint 2: Items, groups, library, units, bundles
- Sprint 3: Discounts, profitability, draw schedules
- Sprint 4: Approvals, versions, change orders
- Sprint 5: Attachments, email, PDF, public access
- Sprint 6: Dashboard, search, tags, warranty tiers

**Bug Priority Levels**:
1. **Critical**: Blocks core functionality, data loss, security issues
2. **High**: Major feature broken, poor UX, incorrect calculations
3. **Medium**: Minor feature issues, cosmetic problems
4. **Low**: Nice-to-have improvements, polish

**Fix Critical and High Priority First**

---

## PHASE 4: PERFORMANCE TESTING

Test with realistic data volumes:
- [ ] 100+ quotes in system
- [ ] 50+ items per quote
- [ ] 200+ library items
- [ ] 50+ tags
- [ ] Dashboard with 6 months of data

Verify:
- [ ] List pages load in < 2 seconds
- [ ] Search returns results in < 1 second
- [ ] Dashboard charts render in < 3 seconds
- [ ] PDF generation completes in < 10 seconds
- [ ] No memory leaks (check browser dev tools)
- [ ] No unnecessary re-renders

---

## PHASE 5: CONSISTENCY REVIEW

### Design Consistency
- [ ] Colors match design system
- [ ] Typography consistent
- [ ] Spacing consistent
- [ ] Button styles consistent
- [ ] Form layouts consistent
- [ ] Card designs consistent

### Interaction Consistency
- [ ] Error messages follow same pattern
- [ ] Success notifications follow same pattern
- [ ] Loading indicators consistent
- [ ] Confirmation dialogs consistent
- [ ] Empty states consistent

### Code Consistency
- [ ] File structure matches project conventions
- [ ] Naming conventions followed
- [ ] Component patterns reused
- [ ] API calls follow same pattern
- [ ] Error handling uniform

---

## DELIVERABLES

### 1. Bug Report (`QUOTE_MODULE_BUG_REPORT.md`)
List all bugs found with:
- Issue ID
- Sprint/feature
- Severity
- Description
- Status (open/fixed/wont-fix)

### 2. Test Coverage Report (`QUOTE_MODULE_TEST_COVERAGE.md`)
Document:
- Features tested
- Test scenarios covered
- Pass/fail status
- Known limitations

### 3. Regression Test Checklist (`QUOTE_MODULE_REGRESSION_TESTS.md`)
Comprehensive checklist for future testing:
- All user workflows
- All edge cases
- All error scenarios

### 4. Performance Report (`QUOTE_MODULE_PERFORMANCE.md`)
Document:
- Load times for key features
- Performance bottlenecks found
- Recommendations for optimization

### 5. Final Sign-Off Document (`QUOTE_MODULE_QA_SIGNOFF.md`)
Final approval stating:
- All critical bugs fixed
- All high priority bugs fixed
- Module meets requirements
- Production ready: YES/NO

---

## COMPLETION CRITERIA

QA phase complete when:
- ✅ All 6 sprints reviewed
- ✅ All integration workflows tested
- ✅ All critical bugs fixed
- ✅ All high priority bugs fixed
- ✅ Performance acceptable
- ✅ Design consistency verified
- ✅ Cross-browser testing complete (Chrome, Firefox, Safari)
- ✅ Mobile responsive verified
- ✅ All deliverables submitted
- ✅ Final sign-off given

---

## TESTING CREDENTIALS

Use BOTH accounts for all testing:
- **Admin**: `ludsonaiello@gmail.com` / `978@F32c`
- **Tenant**: `contact@honeydo4you.com` / `978@F32c`

Backend API: `http://localhost:8000/api/v1`

---

**REMEMBER**: You must understand the ENTIRE module to fix issues anywhere. Read all documentation thoroughly.