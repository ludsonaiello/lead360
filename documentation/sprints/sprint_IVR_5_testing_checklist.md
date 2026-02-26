# Sprint IVR-5 — Final Testing Checklist

**Sprint**: IVR-5 (Documentation & Polish)
**Date Created**: February 25, 2026
**Status**: Ready for Testing
**Tester**: QA Team / Developer

---

## Test Environment

**Database**: MySQL Production Copy
**Test Credentials**:
- **Admin**: `ludsonaiello@gmail.com` / `978@F32c`
- **Tenant**: `contact@honeydo4you.com` / `978@F32c`

**Test Tenant ID**: Look up in database after login

---

## 1. Functional Tests — Multi-Level IVR

### 1.1 Basic IVR Creation

- [ ] **T-F-001**: Create simple IVR (single level, 3 options)
  - Navigate to Communications → Twilio → IVR Settings
  - Enable IVR, add greeting message
  - Add 3 menu options (Press 1, 2, 3)
  - Configure default action
  - Save successfully
  - **Expected**: Configuration saved, no errors

- [ ] **T-F-002**: Retrieve IVR configuration via API
  - GET `/api/v1/communication/twilio/ivr`
  - **Expected**: Returns saved configuration with all fields

- [ ] **T-F-003**: Update existing IVR configuration
  - Modify greeting message
  - Change one option action
  - Save
  - **Expected**: Changes persisted, updated_at timestamp changed

### 1.2 Multi-Level IVR Creation

- [ ] **T-F-004**: Create 2-level IVR (root + 1 submenu)
  - Add option with action "submenu"
  - Configure submenu greeting
  - Add 2 options to submenu
  - Save
  - **Expected**: Configuration saved with nested structure

- [ ] **T-F-005**: Create 3-level IVR (root + 2 nested submenus)
  - Create root menu with submenu option
  - Create first-level submenu with another submenu option
  - Create second-level submenu with terminal actions
  - Save
  - **Expected**: 3-level structure saved correctly

- [ ] **T-F-006**: Create maximum depth IVR (5 levels)
  - Create nested submenus up to 5 levels deep
  - Each level should have unique greeting
  - Save
  - **Expected**: 5-level structure saved successfully

- [ ] **T-F-007**: Test all action types at various levels
  - Root level: route_to_number, submenu, voicemail
  - Level 2: voice_ai, return_to_parent, submenu
  - Level 3: return_to_root, route_to_default
  - **Expected**: All action types work at all appropriate levels

### 1.3 Navigation Actions

- [ ] **T-F-008**: Test "return_to_parent" action
  - Create 2-level menu
  - Add "return_to_parent" option at level 2
  - Simulate call: Navigate to level 2, press return_to_parent digit
  - **Expected**: Call returns to level 1 menu

- [ ] **T-F-009**: Test "return_to_root" action
  - Create 3-level menu
  - Add "return_to_root" option at level 3
  - Simulate call: Navigate to level 3, press return_to_root digit
  - **Expected**: Call jumps directly to root menu

- [ ] **T-F-010**: Test "return_to_parent" at root level
  - Add "return_to_parent" at root menu
  - Press that digit
  - **Expected**: Stays at root menu (can't go higher)

### 1.4 TwiML Generation & Path Navigation

- [ ] **T-F-011**: Generate TwiML for root menu
  - GET `/api/v1/twilio/ivr/menu` (via webhook simulation)
  - **Expected**: TwiML with consent message + greeting + gather block

- [ ] **T-F-012**: Generate TwiML for level 2 menu (path "1")
  - GET `/api/v1/twilio/ivr/menu?path=1`
  - **Expected**: TwiML with submenu greeting (no consent message)

- [ ] **T-F-013**: Generate TwiML for level 3 menu (path "1.2")
  - GET `/api/v1/twilio/ivr/menu?path=1.2`
  - **Expected**: TwiML with level 3 greeting

- [ ] **T-F-014**: Execute IVR action for submenu navigation
  - POST `/api/v1/twilio/ivr/input` with Digits=1
  - **Expected**: TwiML redirects to `/ivr/menu?path=1`

- [ ] **T-F-015**: Execute IVR action for terminal action
  - POST `/api/v1/twilio/ivr/input?path=1` with Digits=2 (route_to_number)
  - **Expected**: TwiML contains <Dial> with phone number

---

## 2. Validation Tests

### 2.1 Depth Validation

- [ ] **T-V-001**: Reject IVR exceeding max_depth
  - Set max_depth=3
  - Try to create 4-level menu
  - **Expected**: 400 error "Menu depth exceeds maximum of 3 levels"

- [ ] **T-V-002**: Accept IVR at exact max_depth
  - Set max_depth=4
  - Create exactly 4-level menu
  - **Expected**: Saves successfully

- [ ] **T-V-003**: Validate max_depth range (1-5)
  - Try max_depth=0: **Expected**: 400 error "Minimum depth is 1 level"
  - Try max_depth=6: **Expected**: 400 error "Maximum depth is 5 levels"

### 2.2 Circular Reference Detection

- [ ] **T-V-004**: Reject circular reference (duplicate UUID)
  - Create menu with duplicate option IDs
  - **Expected**: 400 error "Circular reference detected"

- [ ] **T-V-005**: Accept valid menu with unique UUIDs
  - Create complex menu with all unique UUIDs
  - **Expected**: Saves successfully

### 2.3 Total Node Count Validation

- [ ] **T-V-006**: Reject menu with >100 total nodes
  - Create menu with 101 total options across all levels
  - **Expected**: 400 error "Total menu options (101) exceeds maximum of 100"

- [ ] **T-V-007**: Accept menu with exactly 100 nodes
  - Create menu with 100 total options
  - **Expected**: Saves successfully

### 2.4 Digit Uniqueness Validation

- [ ] **T-V-008**: Reject duplicate digits at root level
  - Add two options both with digit="1"
  - **Expected**: 400 error "Duplicate digits found: 1"

- [ ] **T-V-009**: Reject duplicate digits at submenu level
  - Create submenu with duplicate digits
  - **Expected**: 400 error "Digits must be unique within each submenu level"

- [ ] **T-V-010**: Accept same digit at different levels
  - Root: Press 1 for Sales
  - Submenu: Press 1 for New Customers
  - **Expected**: Saves successfully (digits only need to be unique per level)

### 2.5 Submenu Configuration Validation

- [ ] **T-V-011**: Reject submenu action without submenu config
  - Set action="submenu" but omit submenu object
  - **Expected**: 400 error "Option has submenu action but no submenu configuration"

- [ ] **T-V-012**: Reject non-submenu action with submenu config
  - Set action="route_to_number" but include submenu object
  - **Expected**: 400 error "Option has submenu configuration but action is not submenu"

- [ ] **T-V-013**: Reject empty submenu options array
  - Set action="submenu" with submenu.options = []
  - **Expected**: 400 error "Submenu must have at least 1 option"

- [ ] **T-V-014**: Reject submenu at max_depth level
  - Create menu at max_depth and try to add submenu
  - **Expected**: UI hides submenu action, API rejects if submitted

### 2.6 Field Validation

- [ ] **T-V-015**: Greeting message length validation
  - Try greeting_message with 4 chars: **Expected**: 400 error "Min 5 characters"
  - Try greeting_message with 501 chars: **Expected**: 400 error "Max 500 characters"

- [ ] **T-V-016**: Timeout validation
  - Try timeout_seconds=4: **Expected**: 400 error "Min 5 seconds"
  - Try timeout_seconds=61: **Expected**: 400 error "Max 60 seconds"

- [ ] **T-V-017**: Max retries validation
  - Try max_retries=0: **Expected**: 400 error "Min 1 retry"
  - Try max_retries=6: **Expected**: 400 error "Max 5 retries"

---

## 3. UI Tests — Frontend

### 3.1 IVR Configuration Page

- [ ] **T-UI-001**: Navigate to IVR Settings page
  - Go to Communications → Twilio → IVR Settings
  - **Expected**: Page loads, shows current config or "Create IVR" button

- [ ] **T-UI-002**: Enable IVR toggle
  - Toggle "IVR Enabled" switch
  - **Expected**: Toggle animates, state changes

- [ ] **T-UI-003**: Main greeting textarea
  - Type greeting message
  - **Expected**: Character count updates, no lag

### 3.2 Menu Tree Builder (Recursive Component)

- [ ] **T-UI-004**: Add root level option
  - Click "+ Add Option"
  - **Expected**: New option card appears with empty fields

- [ ] **T-UI-005**: Select action type
  - Change action dropdown to each type (route_to_number, submenu, voicemail, etc.)
  - **Expected**: Config fields update based on action type

- [ ] **T-UI-006**: Add submenu (Level 2)
  - Select action="submenu"
  - Click "Add Submenu Options"
  - **Expected**: Nested accordion opens showing Level 2 badge and submenu greeting field

- [ ] **T-UI-007**: Add nested submenu (Level 3)
  - In Level 2, add option with action="submenu"
  - **Expected**: Level 3 section appears, properly indented

- [ ] **T-UI-008**: Visual depth indicators
  - Create 3-level menu
  - **Expected**: Level badges show "Level 1", "Level 2", "Level 3"
  - **Expected**: Indentation increases at each level

- [ ] **T-UI-009**: Remove submenu
  - Click "Remove Submenu" button
  - **Expected**: Confirmation modal, submenu deleted on confirm

- [ ] **T-UI-010**: Remove menu option
  - Click trash icon on option
  - **Expected**: Option removed, digit becomes available again

### 3.3 Digit Management

- [ ] **T-UI-011**: Digit dropdown shows only available digits
  - Add options with digits 1, 2, 3
  - Open digit dropdown for new option
  - **Expected**: Only shows 0, 4, 5, 6, 7, 8, 9

- [ ] **T-UI-012**: Digits unique per level
  - At root: Use digit 1
  - At submenu: Can also use digit 1
  - **Expected**: No conflict, both allowed

### 3.4 Accordion Behavior

- [ ] **T-UI-013**: Expand/collapse option
  - Click option header
  - **Expected**: Accordion expands/collapses smoothly

- [ ] **T-UI-014**: Multiple options expanded simultaneously
  - Expand 3 different options
  - **Expected**: All stay open (not exclusive accordion)

### 3.5 Form Validation & Error Display

- [ ] **T-UI-015**: Required field validation
  - Try to save without greeting message
  - **Expected**: Red border on field, error message displayed

- [ ] **T-UI-016**: Async validation errors from API
  - Create invalid config (e.g., circular reference)
  - Submit
  - **Expected**: Error modal with clear message

- [ ] **T-UI-017**: Success feedback
  - Save valid config
  - **Expected**: Green success toast "IVR configuration saved successfully"

### 3.6 Max Depth UI Behavior

- [ ] **T-UI-018**: Hide submenu action at max depth
  - Set max_depth=4
  - Navigate to level 4
  - Open action dropdown
  - **Expected**: "Submenu" option is hidden/disabled

- [ ] **T-UI-019**: Show max depth warning
  - At max depth, if submenu is already selected
  - **Expected**: Warning badge "Maximum depth reached. Cannot add more submenus."

### 3.7 Mobile Responsiveness

- [ ] **T-UI-020**: Test on mobile viewport (375px width)
  - Open IVR Settings on mobile
  - **Expected**: Layout stacks vertically, no horizontal scroll
  - **Expected**: Touch targets are large enough (44px minimum)

- [ ] **T-UI-021**: Test accordion on mobile
  - Expand/collapse options on mobile
  - **Expected**: Smooth animation, no performance issues

---

## 4. Integration Tests

### 4.1 API → Database

- [ ] **T-INT-001**: Verify Prisma schema has max_depth field
  - Check `ivr_configuration` table schema
  - **Expected**: `max_depth` column exists (INTEGER)

- [ ] **T-INT-002**: Verify menu_options stored as JSON
  - Create multi-level IVR
  - Query database directly
  - **Expected**: `menu_options` column contains nested JSON structure

- [ ] **T-INT-003**: Verify submenu structure preserved
  - Create 3-level menu
  - Retrieve via API
  - **Expected**: Returned structure matches submitted structure exactly

### 4.2 Frontend → Backend → Twilio

- [ ] **T-INT-004**: End-to-end IVR creation flow
  - Create IVR in UI
  - Submit form
  - Verify API call succeeds
  - Verify database record created
  - Generate TwiML via webhook
  - **Expected**: Full flow works without errors

- [ ] **T-INT-005**: Test actual phone call (if Twilio test number available)
  - Configure test Twilio number with IVR
  - Call the number
  - Navigate through menu levels
  - **Expected**: Hear greetings, digit presses work, routing succeeds

### 4.3 Voice AI Integration

- [ ] **T-INT-006**: IVR option with voice_ai action
  - Create option with action="voice_ai"
  - Simulate call pressing that digit
  - **Expected**: TwiML routes to Voice AI SIP endpoint

- [ ] **T-INT-007**: Voice AI fallback on quota exceeded
  - Create voice_ai option with fallback number in config
  - Simulate quota exceeded scenario
  - **Expected**: TwiML plays quota message and transfers to fallback

---

## 5. Performance Tests

### 5.1 Validation Performance

- [ ] **T-PERF-001**: Validate large menu tree (100 nodes)
  - Create menu with 100 total options
  - Submit
  - Measure validation time
  - **Expected**: Completes in <2 seconds

- [ ] **T-PERF-002**: Validate deeply nested menu (5 levels)
  - Create 5-level menu
  - Submit
  - Measure validation time
  - **Expected**: Completes in <1 second

### 5.2 TwiML Generation Performance

- [ ] **T-PERF-003**: Generate TwiML for complex menu
  - Create 4-level menu with 10 options per level
  - Request TwiML generation
  - Measure response time
  - **Expected**: Responds in <200ms

- [ ] **T-PERF-004**: Navigate deep path
  - Request TwiML with path "1.2.3.4"
  - Measure response time
  - **Expected**: Responds in <200ms

### 5.3 UI Performance

- [ ] **T-PERF-005**: Load IVR page with large config
  - Create 50-option menu
  - Reload page
  - Measure time to interactive
  - **Expected**: Page interactive in <2 seconds

- [ ] **T-PERF-006**: Add/remove options responsiveness
  - Add 20 options rapidly
  - Remove 20 options rapidly
  - **Expected**: No lag, UI remains responsive

---

## 6. Documentation Verification

### 6.1 REST API Documentation

- [ ] **T-DOC-001**: Verify multi-level IVR section exists
  - Open `/api/documentation/communication_twillio_REST_API.md`
  - Search for "Multi-Level IVR Support"
  - **Expected**: Section exists after line 1275

- [ ] **T-DOC-002**: Verify action types table is complete
  - Check table includes all 8 action types
  - **Expected**: submenu, return_to_parent, return_to_root are documented

- [ ] **T-DOC-003**: Verify data model shows recursive structure
  - Check IVRMenuOption interface
  - **Expected**: Shows `submenu?` field with recursive type

- [ ] **T-DOC-004**: Verify constraints are documented
  - Check for max depth, max nodes, max options per level
  - **Expected**: All constraints listed (1-5 depth, 100 nodes, 10 per level)

- [ ] **T-DOC-005**: Verify example configuration is valid
  - Copy example JSON from docs
  - Submit to API (with valid UUIDs)
  - **Expected**: Should save successfully

- [ ] **T-DOC-006**: Verify TwiML navigation explanation
  - Check for path notation explanation
  - **Expected**: Shows examples like "path=1.2.1"

- [ ] **T-DOC-007**: Verify validation errors documented
  - Check for error messages
  - **Expected**: Lists all validation error types

### 6.2 Internal Voice AI Endpoints Documentation

- [ ] **T-DOC-008**: Verify access endpoint documented
  - Check GET `/api/v1/internal/voice-ai/tenant/:tenantId/access`
  - **Expected**: Full documentation with request/response examples

- [ ] **T-DOC-009**: Verify context endpoint documented
  - Check GET `/api/v1/internal/voice-ai/tenant/:tenantId/context`
  - **Expected**: Shows decrypted keys in response, includes security warning

- [ ] **T-DOC-010**: Verify start call endpoint documented
  - Check POST `/api/v1/internal/voice-ai/calls/start`
  - **Expected**: Request body fields documented, idempotency noted

- [ ] **T-DOC-011**: Verify complete call endpoint documented
  - Check POST `/api/v1/internal/voice-ai/calls/:callSid/complete`
  - **Expected**: Usage records array structure documented

### 6.3 User Guide Verification

- [ ] **T-DOC-012**: Verify user guide file exists
  - Check `/documentation/user_guides/multi_level_ivr_guide.md`
  - **Expected**: File exists and is not empty

- [ ] **T-DOC-013**: Verify user guide is plain language
  - Read introduction section
  - **Expected**: No technical jargon, written for business owners

- [ ] **T-DOC-014**: Verify setup steps are clear
  - Read "How to Set Up" section
  - **Expected**: Step-by-step instructions with screenshots references

- [ ] **T-DOC-015**: Verify best practices section exists
  - Check for design guidelines
  - **Expected**: "Max 7 options per level", "Max 3 levels deep", etc.

- [ ] **T-DOC-016**: Verify troubleshooting section complete
  - Check common problems listed
  - **Expected**: At least 5 common issues with solutions

- [ ] **T-DOC-017**: Verify FAQ section complete
  - Check FAQ section
  - **Expected**: At least 10 Q&A pairs

- [ ] **T-DOC-018**: Verify industry examples exist
  - Check examples section
  - **Expected**: 3+ industry-specific examples (Home Services, Medical, etc.)

---

## 7. Bug Fixes & Edge Cases

### 7.1 Known Edge Cases to Test

- [ ] **T-EDGE-001**: Empty submenu options after deletion
  - Create submenu with 3 options
  - Delete all 3 options
  - Try to save
  - **Expected**: Validation error "Submenu must have at least 1 option"

- [ ] **T-EDGE-002**: Change action from submenu to terminal
  - Create option with action="submenu" and submenu config
  - Change action to "route_to_number"
  - **Expected**: Submenu config is cleared automatically

- [ ] **T-EDGE-003**: UUID generation on frontend
  - Add new option in UI
  - Check that `id` field is auto-generated
  - **Expected**: Valid UUID v4 format

- [ ] **T-EDGE-004**: Backward compatibility with legacy configs
  - Create IVR without max_depth field (legacy)
  - Retrieve via API
  - **Expected**: Defaults to max_depth=4

- [ ] **T-EDGE-005**: Path validation with invalid path
  - Request TwiML with path="1.99" (option 99 doesn't exist)
  - **Expected**: 404 error "Invalid menu path: digit '99' not found"

- [ ] **T-EDGE-006**: Path validation with non-submenu path
  - Create route_to_number option at digit 1
  - Request TwiML with path="1.2" (can't navigate deeper into terminal action)
  - **Expected**: 400 error "option at digit '1' is not a submenu"

### 7.2 Regression Tests

- [ ] **T-REG-001**: Simple flat IVR still works
  - Create non-multilevel IVR (no submenus)
  - **Expected**: Works exactly as before Sprint IVR-4

- [ ] **T-REG-002**: Existing IVRs not affected
  - Query existing tenant IVR (if any)
  - **Expected**: Returns config, no errors, backward compatible

- [ ] **T-REG-003**: Twilio webhooks still work
  - Trigger existing Twilio webhook endpoints
  - **Expected**: No breaking changes

---

## Test Execution Summary

**Total Tests**: 120
**Sections**:
- Functional: 15 tests
- Validation: 17 tests
- UI: 21 tests
- Integration: 7 tests
- Performance: 6 tests
- Documentation: 18 tests
- Bug Fixes / Edge Cases: 12 tests

**Pass Criteria**:
- All functional tests must pass (15/15)
- All validation tests must pass (17/17)
- Critical UI tests must pass (18/21, minor UI bugs acceptable)
- Integration tests must pass (7/7)
- Performance tests within acceptable range (6/6)
- Documentation tests pass (18/18)
- No critical bugs in edge cases (10/12, minor edge cases acceptable)

**Overall Pass Threshold**: 95% (114/120 tests passing)

---

## Bug Reporting Template

If bugs are discovered during testing, use this template:

```markdown
**Bug ID**: BUG-IVR5-XXX
**Severity**: Critical / High / Medium / Low
**Test Case**: T-XXX-XXX
**Environment**: Production / Staging / Local

**Description**:
Clear description of the bug

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Result**:
What should happen

**Actual Result**:
What actually happens

**Screenshot/Error Message**:
Attach if applicable

**Suggested Fix** (if known):
Possible solution
```

---

## Acceptance Criteria

Sprint IVR-5 is considered COMPLETE when:

✅ **Documentation**:
- [ ] Multi-level IVR section added to Twilio REST API docs
- [ ] Internal Voice AI endpoints documented
- [ ] User guide created and reviewed

✅ **Testing**:
- [ ] All functional tests passing
- [ ] All validation tests passing
- [ ] Critical UI tests passing (95%+)
- [ ] Integration tests passing
- [ ] Performance benchmarks met

✅ **Bug Fixes**:
- [ ] Critical bugs fixed
- [ ] High-priority bugs fixed or documented as known issues
- [ ] Medium/low bugs documented for future sprints

✅ **Sign-off**:
- [ ] Developer approval
- [ ] QA approval
- [ ] Product owner approval

---

**Test Date**: _________________
**Tester Name**: _________________
**Pass/Fail**: _________________
**Notes**: _________________
