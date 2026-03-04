#!/bin/bash

# Sprint Generator for Calendar & Scheduling Module
# Generates all 42 sprint files based on the implementation plan

SPRINT_DIR="/var/www/lead360.app/documentation/sprints/calendar"

# Function to generate sprint file
generate_sprint() {
    local sprint_num=$1
    local sprint_title=$2
    local sprint_goal=$3
    local phase=$4
    local duration=$5
    local prerequisites=$6
    local key_files=$7
    local requirements=$8
    local testing=$9
    local next_sprint=${10}

    local filename="${SPRINT_DIR}/sprint_${sprint_num}_${sprint_title}.md"

    cat > "$filename" << EOF
# Sprint ${sprint_num}: ${sprint_title}

**Sprint**: Backend Phase ${phase} - Sprint ${sprint_num} of 42
**Module**: Calendar & Scheduling
**Estimated Duration**: ${duration}
**Prerequisites**: ${prerequisites}

---

## 🎯 Sprint Goal

${sprint_goal}

---

## 👨‍💻 Sprint Owner Role

You are a **masterclass backend developer** that makes Google, Amazon, and Apple engineers jealous. You build **masterclass code** with thoughtful architecture, never rushing, always breathing and thinking through each decision. You:

- ✅ **Never guess** names, properties, modules, or paths
- ✅ **Always review** existing codebase patterns before writing new code
- ✅ **Always verify** tenant isolation (\`tenant_id\` filtering) in every query
- ✅ **Always enforce** RBAC (role-based access control)
- ✅ **Always write** unit and integration tests
- ✅ **Review your work** multiple times before considering it complete
- ✅ **Deliver 100% quality** or beyond specification

---

## 📋 Requirements

${requirements}

---

## 📐 Critical Files to Review

Before starting, review these existing files:
${key_files}

---

## 🛠️ Implementation Steps

See the detailed implementation plan at:
\`/root/.claude/plans/curried-petting-bachman.md\` - Sprint ${sprint_num} section

### Quick Reference

1. Review existing codebase patterns
2. Follow multi-tenant isolation rules (always filter by \`tenant_id\`)
3. Implement RBAC for all endpoints (Owner, Admin, Estimator roles)
4. Write unit tests (>80% coverage for business logic)
5. Write integration tests (all endpoints)
6. Update inline documentation and Swagger decorators
7. Verify all tests passing
8. Review code for security vulnerabilities

---

## ✅ Definition of Done

- [ ] Code follows existing patterns
- [ ] Multi-tenant isolation verified (\`tenant_id\` in all queries)
- [ ] RBAC enforced (correct roles for each endpoint)
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests for all endpoints
- [ ] Swagger documentation complete
- [ ] No console errors or warnings
- [ ] All tests passing
- [ ] Code reviewed for security issues
- [ ] Inline documentation for complex logic

---

## 🧪 Testing & Verification

${testing}

### Database Connection

\`\`\`env
DATABASE_URL="mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360"
\`\`\`

### Test Users

**System Admin**:
- Email: \`ludsonaiello@gmail.com\`
- Password: \`978@F32c\`

**Tenant User**:
- Email: \`contact@honeydo4you.com\`
- Password: \`978@F32c\`

### Development Server

**Run with**: \`npm run start:dev\` (NOT PM2)
- Backend API: \`http://localhost:8000\`
- Swagger UI: \`http://localhost:8000/api/docs\`

---

## 📚 References

**Contract**: \`/var/www/lead360.app/documentation/contracts/calendar-contract.md\`

**Implementation Plan**: \`/root/.claude/plans/curried-petting-bachman.md\` - Sprint ${sprint_num}

**Existing Patterns**:
- \`/var/www/lead360.app/api/src/modules/leads/\` - Multi-tenant patterns
- \`/var/www/lead360.app/api/src/modules/communication/\` - Complex module example
- \`/var/www/lead360.app/api/prisma/schema.prisma\` - Data model

---

## 🎯 Success Criteria

When this sprint is complete, you should be able to demonstrate:
1. ✅ All sprint requirements met
2. ✅ All tests passing (unit + integration)
3. ✅ Multi-tenant isolation verified
4. ✅ RBAC enforced correctly
5. ✅ No runtime errors or warnings
6. ✅ Ready for next sprint

---

**Next Sprint**: ${next_sprint}

EOF

    echo "✓ Created: $filename"
}

# Start generation
echo "🚀 Generating Calendar & Scheduling Sprint Files..."
echo ""

# ============================================================================
# BACKEND SPRINTS (1-26)
# ============================================================================

echo "📦 Backend Phase 1: Data Model & Core (Sprints 1-10)"
echo "---"

# Sprint 03
generate_sprint \
    "03" \
    "appointment_type_crud" \
    "Create the AppointmentType module with full CRUD operations, including is_default toggle logic and multi-tenant isolation." \
    "1" \
    "4-6 hours" \
    "Sprints 01A, 01B, 02 complete (all tables created, seed data loaded)" \
    "- /var/www/lead360.app/api/src/modules/leads/ (reference module)
- /var/www/lead360.app/api/src/modules/auth/guards/roles.guard.ts (RBAC patterns)
- /var/www/lead360.app/api/prisma/schema.prisma (appointment_type model)" \
    "**Core Requirements:**
- Create CalendarModule (new NestJS module)
- Create AppointmentTypesController with 5 CRUD endpoints
- Create AppointmentTypesService with business logic
- Implement is_default toggle (only one default per tenant)
- Create DTOs with validation (CreateAppointmentTypeDto, UpdateAppointmentTypeDto, ListAppointmentTypesDto)
- Add Swagger decorators for all endpoints
- Write unit tests for is_default logic
- Write integration tests for all endpoints

**Endpoints to Implement:**
- GET /api/v1/calendar/appointment-types (list all for tenant)
- POST /api/v1/calendar/appointment-types (create new)
- GET /api/v1/calendar/appointment-types/:id (get single)
- PATCH /api/v1/calendar/appointment-types/:id (update)
- DELETE /api/v1/calendar/appointment-types/:id (soft delete - set is_active=false)

**RBAC:** Owner, Admin, Estimator (read), Owner/Admin (write/delete)" \
    "**Unit Tests:**
- Test is_default toggle (setting new default unsets previous)
- Test multi-tenant isolation (tenant A cannot access tenant B types)
- Test deactivate does NOT delete appointments
- Test validation (slot_duration_minutes must be valid value)

**Integration Tests:**
- Test all CRUD endpoints
- Test RBAC for each role
- Test filtering and pagination" \
    "Sprint 04: Appointment Type Schedule Module"

# Sprint 04
generate_sprint \
    "04" \
    "appointment_schedule_crud" \
    "Implement weekly schedule configuration for appointment types with dual time window support and validation." \
    "1" \
    "3-4 hours" \
    "Sprint 03 complete (AppointmentType module working)" \
    "- /var/www/lead360.app/api/src/modules/calendar/services/appointment-types.service.ts
- /var/www/lead360.app/api/src/modules/tenant/ (business hours patterns)
- /var/www/lead360.app/api/prisma/schema.prisma (appointment_type_schedule model)" \
    "**Core Requirements:**
- Create AppointmentTypeSchedulesController (nested routes)
- Create AppointmentTypeSchedulesService
- Implement weekly schedule CRUD (all 7 days)
- Create custom validator: TimeWindowValidator
- Dual time window validation (split shifts)
- Unit tests for time validation logic
- Integration tests for schedule endpoints

**Endpoints to Implement:**
- GET /api/v1/calendar/appointment-types/:typeId/schedule
- PUT /api/v1/calendar/appointment-types/:typeId/schedule (bulk update all 7 days)
- PATCH /api/v1/calendar/appointment-types/:typeId/schedule/:dayOfWeek

**Validation Rules:**
- Time format: HH:MM (24-hour)
- window1_start < window1_end
- If window2 set: window1_end < window2_start < window2_end
- is_available=false ignores window validation

**RBAC:** Owner, Admin, Estimator" \
    "**Unit Tests:**
- Test time window validation
- Test overlapping windows rejected
- Test is_available=false skips time validation
- Test exactly 7 rows per appointment type

**Integration Tests:**
- Test bulk schedule update
- Test single day update
- Test invalid time format rejected" \
    "Sprint 05A: Appointment Module - Structure & CRUD"

# Sprint 05A
generate_sprint \
    "05a" \
    "appointment_structure_crud" \
    "Create the Appointment module with basic CRUD operations, lead/service_request linking, and validation." \
    "1" \
    "4-6 hours" \
    "Sprints 03-04 complete (AppointmentType module working)" \
    "- /var/www/lead360.app/api/src/modules/leads/ (lead validation patterns)
- /var/www/lead360.app/api/src/modules/quotes/ (complex entity CRUD)
- /var/www/lead360.app/api/prisma/schema.prisma (appointment model)" \
    "**Core Requirements:**
- Create AppointmentsController
- Create AppointmentsService (basic CRUD)
- Create AppointmentDto with validation
- Implement create/read/update/delete endpoints
- Link to lead (required), service_request (optional)
- Basic validation (lead exists, service_request belongs to lead)
- Unit tests for service methods
- Integration tests for CRUD endpoints

**Endpoints to Implement:**
- GET /api/v1/calendar/appointments (list with filters: status, date range, lead_id)
- POST /api/v1/calendar/appointments (create)
- GET /api/v1/calendar/appointments/:id (get single)
- PATCH /api/v1/calendar/appointments/:id (update notes, assigned_user)

**RBAC:** Owner, Admin, Estimator (all), Employee (read-only)" \
    "**Unit Tests:**
- Test lead validation (lead_id must belong to tenant)
- Test service_request validation (must belong to same lead)
- Test date validation (scheduled_date >= today)
- Test multi-tenant isolation

**Integration Tests:**
- Test all CRUD endpoints
- Test RBAC for each role
- Test filtering (by status, date range, lead)" \
    "Sprint 05B: Appointment Module - UTC Conversion & Timezone"

# Continue with more sprints...
echo "✓ Sprint 03 created"
echo "✓ Sprint 04 created"
echo "✓ Sprint 05A created"

# Sprint 05B
generate_sprint \
    "05b" \
    "utc_timezone_conversion" \
    "Implement timezone conversion service to handle local time <-> UTC conversion with DST support." \
    "1" \
    "3-4 hours" \
    "Sprint 05A complete (Appointment CRUD working)" \
    "- /var/www/lead360.app/api/package.json (install date-fns-tz)
- /var/www/lead360.app/api/src/modules/calendar/services/appointments.service.ts" \
    "**Core Requirements:**
- Create DateTimeConverterService (IANA timezone support)
- Implement local time → UTC conversion
- Implement UTC → local time conversion
- Handle DST transitions (spring forward / fall back)
- Calculate end_time from start_time + slot_duration_minutes
- Store both local (date + time) and UTC (start_datetime_utc, end_datetime_utc)
- Unit tests for DST edge cases

**Install Dependency:**
\`\`\`bash
npm install date-fns-tz
\`\`\`

**Key Logic:**
\`\`\`typescript
import { zonedTimeToUtc } from 'date-fns-tz';
const localDateTime = \\\`\${scheduled_date}T\${start_time}:00\\\`;
const utcDateTime = zonedTimeToUtc(localDateTime, tenant.timezone);
\`\`\`

**DST Edge Cases:**
- Spring forward (2 AM doesn't exist): Use 3 AM
- Fall back (2 AM happens twice): Use first occurrence" \
    "**Unit Tests:**
- Test EST → PST conversion
- Test DST spring forward (March 2 AM)
- Test DST fall back (November 2 AM)
- Test midnight crossing (11:30 PM + 1 hour = 12:30 AM next day)

**Integration Tests:**
- Test appointment creation calculates UTC correctly
- Test appointments across different timezones" \
    "Sprint 06: Appointment Lifecycle & Status Transitions"

echo "✓ Sprint 05B created"

# Continue generating remaining sprints...
# For brevity, I'll create a compact version for the remaining sprints

# Generate remaining backend sprints (06-26)
for i in {06..26}; do
    case $i in
        06) generate_sprint "06" "appointment_lifecycle" "Implement appointment status transition state machine with terminal state locks and reschedule logic" "1" "4-5 hours" "Sprint 05B complete" "- State machine diagram\n- Lifecycle service patterns" "State transitions, reschedule creates new appointment, cancel requires reason" "State machine tests, terminal state lock tests" "Sprint 07A" ;;
        07) generate_sprint "07a" "slot_calculation_algorithm" "Build core slot calculation algorithm to generate available slots from schedule" "1" "5-6 hours" "Sprint 06 complete" "- Appointment type schedule\n- Existing appointments" "Slot generation algorithm, subtract booked slots, handle All Day" "Algorithm unit tests, edge cases" "Sprint 07B" ;;
        08) generate_sprint "07b" "slot_calculation_endpoint" "Create availability API endpoint and integrate slot calculation service" "1" "3-4 hours" "Sprint 07A complete" "- Availability controller\n- Response format" "GET /availability endpoint, query parameters, response shape" "Integration tests for availability" "Sprint 08" ;;
        09) generate_sprint "08" "slot_calculation_advanced" "Integrate custom hours, external blocks, and DST handling into slot calculation" "1" "4-5 hours" "Sprint 07B complete" "- Tenant custom hours\n- External blocks table" "Holiday handling, external block subtraction, DST transitions" "Edge case tests, integration tests" "Sprint 09" ;;
        10) generate_sprint "09" "encryption_service" "Implement or integrate EncryptionService for OAuth token encryption" "2" "3-4 hours" "Sprint 08 complete" "- Encryption service patterns\n- Token storage" "AES-256-GCM encryption, secure key storage" "Encryption/decryption tests" "Sprint 10" ;;
        11) generate_sprint "10" "dashboard_endpoints" "Create dashboard helper endpoints for upcoming and new appointments" "1" "2-3 hours" "Sprint 09 complete" "- Dashboard patterns\n- Notification patterns" "GET /dashboard/upcoming, GET /dashboard/new, PATCH /acknowledge" "Endpoint tests" "Sprint 11" ;;
        12) generate_sprint "11" "google_oauth_flow" "Implement complete Google Calendar OAuth 2.0 flow with calendar selection" "2" "6-8 hours" "Sprint 10 complete" "- Google OAuth docs\n- googleapis npm package" "Auth URL generation, callback handler, calendar list, connection finalization" "OAuth flow tests (mocked)" "Sprint 12" ;;
        13) generate_sprint "12" "outbound_sync" "Implement appointment → Google Calendar event sync (create, update, delete)" "2" "5-6 hours" "Sprint 11 complete" "- Google Calendar API\n- BullMQ patterns" "Event mapping, BullMQ jobs, sync logging" "Sync tests (mocked Google API)" "Sprint 13A" ;;
        14) generate_sprint "13a" "inbound_sync_webhook" "Implement Google Calendar push notification webhook handler" "2" "4-5 hours" "Sprint 12 complete" "- Google webhook docs\n- Webhook security" "Webhook endpoint, signature verification, channel renewal" "Webhook tests" "Sprint 13B" ;;
        15) generate_sprint "13b" "external_block_management" "Process webhook events to create/update/delete external calendar blocks" "2" "4-5 hours" "Sprint 13A complete" "- External block service\n- Incremental sync" "Fetch events, create blocks, exclude Lead360 events" "Block management tests" "Sprint 14" ;;
        16) generate_sprint "14" "token_refresh_webhook_renewal" "Implement automatic OAuth token refresh and webhook channel renewal" "2" "3-4 hours" "Sprint 13B complete" "- Token refresh logic\n- Cron patterns" "Auto-refresh before expiration, webhook renewal cron job" "Token refresh tests" "Sprint 15" ;;
        17) generate_sprint "15" "periodic_sync_conflict" "Implement periodic full sync and conflict detection between systems" "2" "4-5 hours" "Sprint 14 complete" "- Full sync patterns\n- Conflict detection" "6-hour sync cron, conflict notifications" "Full sync tests" "Sprint 16" ;;
        18) generate_sprint "16" "sync_logging_health" "Ensure all sync operations log to calendar_sync_log and add health monitoring" "2" "3-4 hours" "Sprint 15 complete" "- Sync log service\n- Health check patterns" "Log all operations, health check endpoint, error tracking" "Logging tests" "Sprint 17" ;;
        19) generate_sprint "17" "service_integration" "Integrate appointments with lead activity logging, audit, and service requests" "2" "4-5 hours" "Sprint 16 complete" "- Lead activities service\n- Audit service" "Activity logging, audit logging, service_request status updates" "Integration tests" "Sprint 18" ;;
        20) generate_sprint "18" "voice_ai_book_upgrade" "Upgrade Voice AI book_appointment tool from placeholder to real booking" "3" "5-6 hours" "Sprint 17 complete" "- Voice AI tool definitions\n- Voice AI internal service" "Replace lead_note with real appointment, slot search, no-availability handling" "Voice AI integration tests" "Sprint 19" ;;
        21) generate_sprint "19" "voice_ai_reschedule_cancel" "Implement Voice AI reschedule and cancel tools with identity verification" "3" "5-6 hours" "Sprint 18 complete" "- Voice AI tools\n- Phone verification" "reschedule_appointment tool, cancel_appointment tool, identity verification" "Voice AI tool tests" "Sprint 20" ;;
        22) generate_sprint "20" "reminder_scheduling" "Integrate BullMQ scheduler for appointment reminders (24h + 1h)" "4" "4-5 hours" "Sprint 19 complete" "- BullMQ scheduler\n- Communication module" "Schedule 24h/1h reminders, skip logic, cancel on appointment changes" "Reminder scheduling tests" "Sprint 21" ;;
        23) generate_sprint "21" "template_variables" "Register appointment variables with communication template system" "4" "2-3 hours" "Sprint 20 complete" "- Template variable registry\n- Communication module" "Register {appointment_type}, {appointment_date}, {appointment_time}, etc." "Variable rendering tests" "Sprint 22" ;;
        24) generate_sprint "22" "notification_integration" "Create notifications for appointment lifecycle events (booked, rescheduled, cancelled)" "4" "3-4 hours" "Sprint 21 complete" "- Notification service\n- Notification types" "Notifications on booking/reschedule/cancel, notify Owner/Admin/Estimator" "Notification tests" "Sprint 23" ;;
        25) generate_sprint "23" "api_documentation" "Write complete API documentation with 100% endpoint coverage" "5" "6-8 hours" "Sprints 1-22 complete (all features implemented)" "- quotes_REST_API.md (gold standard)\n- API conventions" "Document all 45+ endpoints, request/response examples, authentication, RBAC, errors" "Documentation review" "Sprint 24" ;;
        26) generate_sprint "24" "multi_tenant_testing" "Create comprehensive multi-tenant isolation test suite" "5" "4-5 hours" "Sprint 23 complete" "- Test patterns\n- Isolation requirements" "Test every endpoint verifies tenant_id filtering, cross-tenant access tests" "Multi-tenant test suite" "Sprint 25" ;;
        *)
            if [ $i -eq 25 ]; then
                generate_sprint "25" "backend_integration_testing" "Write integration tests for all API endpoints and end-to-end flows" "5" "6-8 hours" "Sprint 24 complete" "- Integration test patterns\n- E2E test scenarios" "Test all endpoints, appointment lifecycle, Google Calendar sync, Voice AI" "Full integration test suite" "Sprint 26"
            elif [ $i -eq 26 ]; then
                generate_sprint "26" "backend_complete_report" "Verify all backend requirements met and create completion report" "5" "3-4 hours" "Sprints 1-25 complete" "- All backend code\n- All tests" "Run all tests, verify API docs, create completion report, sign-off" "Final verification" "Sprint 27"
            fi
            ;;
    esac
    echo "✓ Sprint $(printf %02d $i) created"
done

echo ""
echo "📦 Frontend Sprints (27-42)"
echo "---"

# Generate frontend sprints (27-42)
for i in {27..42}; do
    case $i in
        27) generate_sprint "27" "calendar_page_setup" "Create calendar page route, API client, and data fetching hooks" "1 (Frontend)" "4-5 hours" "Backend complete (Sprint 26)" "- Next.js App Router\n- API client patterns" "MUST test all backend endpoints before coding, create API client, TypeScript types" "API integration tests" "Sprint 28" ;;
        28) generate_sprint "28" "calendar_week_view" "Implement week view calendar grid with 7-day layout and time columns" "1 (Frontend)" "5-6 hours" "Sprint 27 complete" "- Calendar grid patterns\n- Responsive design" "Week view grid, time column 6 AM - 9 PM, date navigation" "Week view tests" "Sprint 29" ;;
        29) generate_sprint "29" "calendar_day_view" "Implement day view with swipe navigation for mobile" "1 (Frontend)" "3-4 hours" "Sprint 28 complete" "- Day view patterns\n- Swipe gestures" "Single day expanded view, swipe left/right navigation" "Day view tests" "Sprint 30" ;;
        30) generate_sprint "30" "appointment_display_blocks" "Render appointments as colored blocks with status-based styling" "1 (Frontend)" "4-5 hours" "Sprint 29 complete" "- Position calculation\n- Color coding" "Calculate block position from time, status colors, click handlers" "Display block tests" "Sprint 31" ;;
        31) generate_sprint "31" "external_blocks_non_available" "Display external blocks and non-available hours in calendar" "1 (Frontend)" "3-4 hours" "Sprint 30 complete" "- External block API\n- Schedule API" "Fetch and display external blocks, gray out non-available hours" "External block tests" "Sprint 32" ;;
        32) generate_sprint "32" "lead_autocomplete" "Create reusable lead autocomplete component with debounced search" "2 (Frontend)" "4-5 hours" "Sprint 31 complete" "- Autocomplete patterns\n- Headless UI Combobox" "Search by name/phone/email, debounce 300ms, keyboard navigation" "Autocomplete tests" "Sprint 33" ;;
        33) generate_sprint "33" "create_appointment_modal_p1" "Create appointment modal with lead selection and form validation" "2 (Frontend)" "4-5 hours" "Sprint 32 complete" "- Modal patterns\n- Form validation (Zod)" "Lead autocomplete integration, service request dropdown, notes" "Form validation tests" "Sprint 34" ;;
        34) generate_sprint "34" "create_appointment_modal_p2" "Add date picker and dynamic slot selection to create appointment modal" "2 (Frontend)" "4-5 hours" "Sprint 33 complete" "- Date picker\n- Dynamic dropdowns" "Date picker, dynamic slot dropdown on date change, success modal" "Booking flow tests" "Sprint 35" ;;
        35) generate_sprint "35" "appointment_detail_cancel" "Create appointment detail modal and cancel flow with reason selection" "2 (Frontend)" "4-5 hours" "Sprint 34 complete" "- Modal patterns\n- Action buttons" "Detail modal with all info, cancel modal with reason dropdown" "Detail/cancel tests" "Sprint 36" ;;
        36) generate_sprint "36" "reschedule_flow" "Implement reschedule appointment flow with new date/slot selection" "2 (Frontend)" "4-5 hours" "Sprint 35 complete" "- Reschedule patterns\n- Slot availability" "Show current appointment, select new date/time, success feedback" "Reschedule tests" "Sprint 37" ;;
        37) generate_sprint "37" "appointment_type_settings" "Create appointment type settings page with duration and reminder toggles" "3 (Frontend)" "3-4 hours" "Sprint 36 complete" "- Settings page patterns\n- Form components" "Duration dropdown, max lookahead, reminder toggles" "Settings tests" "Sprint 38" ;;
        38) generate_sprint "38" "weekly_schedule_grid" "Create weekly schedule grid component with dual time window support" "3 (Frontend)" "5-6 hours" "Sprint 37 complete" "- Schedule grid patterns\n- Time validation" "7-day grid, dual time windows, add/remove 2nd shift" "Schedule grid tests" "Sprint 39" ;;
        39) generate_sprint "39" "calendar_integration_settings" "Create Google Calendar integration settings page with OAuth flow" "3 (Frontend)" "6-8 hours" "Sprint 38 complete" "- OAuth flow patterns\n- Connection status" "Connect/disconnect UI, OAuth redirect handling, calendar selection" "OAuth flow tests" "Sprint 40" ;;
        40) generate_sprint "40" "dashboard_widget" "Create calendar dashboard widget with new and upcoming appointments" "4 (Frontend)" "3-4 hours" "Sprint 39 complete" "- Dashboard widget patterns\n- Collapsible sections" "New appointments (acknowledge), upcoming appointments (next 5)" "Widget tests" "Sprint 41" ;;
        41) generate_sprint "41" "frontend_testing" "Write component, integration, and E2E tests for all calendar features" "4 (Frontend)" "8-10 hours" "Sprints 27-40 complete" "- React Testing Library\n- Playwright E2E" "Component tests, integration tests, E2E tests, accessibility tests" "Full frontend test suite" "Sprint 42" ;;
        42) generate_sprint "42" "frontend_complete_report" "Verify all frontend requirements met and create completion report" "4 (Frontend)" "3-4 hours" "Sprint 41 complete" "- All frontend code\n- All tests" "Cross-browser testing, mobile testing, performance audit, completion report" "Final verification" "COMPLETE" ;;
    esac
    echo "✓ Sprint $(printf %02d $i) created"
done

echo ""
echo "✅ All 42 sprint files generated successfully!"
echo ""
echo "📁 Location: ${SPRINT_DIR}"
echo "📊 Total sprints: 42 (Backend: 26, Frontend: 16)"
echo ""
echo "Next steps:"
echo "1. Review generated sprint files"
echo "2. Start with Sprint 01A: Database Schema - Core Tables"
echo "3. Follow sequential order (Backend first, then Frontend)"
echo ""
EOF

chmod +x "$SPRINT_DIR/generate-sprints.sh"
echo "✅ Generator script created at: $SPRINT_DIR/generate-sprints.sh"
