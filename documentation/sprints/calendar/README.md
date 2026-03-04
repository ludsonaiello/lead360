# Calendar & Scheduling Module - Sprint Directory

**Total Sprints**: 42 (Backend: 26, Frontend: 16)
**Sprint Plan**: `/root/.claude/plans/curried-petting-bachman.md`
**Contract**: `/var/www/lead360.app/documentation/contracts/calendar-contract.md`

---

## Sprint Organization

### Backend Sprints (1-26)

**Phase 1: Data Model & Core (Sprints 1-10)**
- 01A: Database Schema - Core Tables
- 01B: Database Schema - Integration Tables
- 02: Seed Data & Tenant Lifecycle Hooks
- 03: Appointment Type Module - CRUD Operations
- 04: Appointment Type Schedule Module
- 05A: Appointment Module - Structure & CRUD
- 05B: Appointment Module - UTC Conversion & Timezone
- 06: Appointment Lifecycle & Status Transitions
- 07A: Slot Calculation Engine - Core Algorithm
- 07B: Slot Calculation Engine - API Endpoint
- 08: Slot Calculation - Advanced Features
- 09: Encryption Service Integration
- 10: Dashboard & Helper Endpoints

**Phase 2: Google Calendar Integration (Sprints 11-17)**
- 11: Google OAuth Flow - Complete
- 12: Outbound Sync - Appointment to Google Calendar Event
- 13A: Inbound Sync - Webhook Handler
- 13B: Inbound Sync - External Block Management
- 14: Token Refresh & Webhook Renewal
- 15: Periodic Full Sync & Conflict Detection
- 16: Calendar Sync Logging & Health Monitoring
- 17: Service Integration Layer

**Phase 3: Voice AI Tools (Sprints 18-19)**
- 18: Voice AI - Upgrade book_appointment Tool
- 19: Voice AI - Reschedule & Cancel Tools

**Phase 4: Reminders & Notifications (Sprints 20-22)**
- 20: Reminder Scheduling Integration
- 21: Template Variable Registration
- 22: Notification Integration

**Phase 5: Documentation & Testing (Sprints 23-26)**
- 23: Complete API Documentation
- 24: Multi-Tenant Isolation Testing
- 25: Backend Integration Testing
- 26: Backend Complete - Verification & Report

### Frontend Sprints (27-42)

**Phase 1: Calendar UI (Sprints 27-31)**
- 27: Calendar Page Setup & API Integration
- 28: Calendar Week View
- 29: Calendar Day View
- 30: Appointment Display Blocks
- 31: External Blocks & Non-Available Hours

**Phase 2: Appointment Management (Sprints 32-36)**
- 32: Lead Autocomplete Component
- 33: Create Appointment Modal - Part 1
- 34: Create Appointment Modal - Part 2 (Date & Slot Selection)
- 35: Appointment Detail & Cancel Modals
- 36: Reschedule Appointment Flow

**Phase 3: Settings Pages (Sprints 37-39)**
- 37: Appointment Type Settings Page
- 38: Weekly Schedule Grid Component
- 39: Calendar Integration Settings Page

**Phase 4: Dashboard & Testing (Sprints 40-42)**
- 40: Dashboard Banner Widget
- 41: Frontend Testing & Quality Assurance
- 42: Frontend Complete - Verification & Report

---

## Sprint Execution Order

**CRITICAL**: Backend MUST complete first (Sprints 1-26) before Frontend starts (Sprints 27-42).

### Backend First (Sequential)
1. Complete all backend sprints (1-26)
2. Verify all tests passing
3. Verify 100% API documentation
4. Create Backend Completion Report (Sprint 26)

### Frontend Second (Sequential)
1. Start only after backend complete
2. Test all API endpoints before starting each sprint
3. Complete all frontend sprints (27-42)
4. Create Frontend Completion Report (Sprint 42)

---

## Sprint File Naming Convention

`sprint_{number}_{sprint_title}.md`

Examples:
- `sprint_01a_database_schema_core.md`
- `sprint_03_appointment_type_crud.md`
- `sprint_27_calendar_page_setup.md`

---

## Development Environment

**Backend Server**: `npm run start:dev` (NOT PM2)
- Runs on: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/api/docs`

**Frontend Server**: `npm run dev`
- Runs on: `http://localhost:3000`

**Database**:
```env
DATABASE_URL="mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360"
```

**Test Users**:
- System Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant User: `contact@honeydo4you.com` / `978@F32c`

---

## Quality Standards

Every sprint must meet:
- ✅ Multi-tenant isolation verified
- ✅ RBAC enforced
- ✅ Unit tests >80% coverage
- ✅ Integration tests for all endpoints
- ✅ No console errors or warnings
- ✅ Code follows existing patterns
- ✅ Documentation inline and complete

---

## Progress Tracking

Created: 3 / 42 sprints (7%)
- [x] Sprint 01A
- [x] Sprint 01B
- [x] Sprint 02
- [ ] Sprint 03
- [ ] ...remaining sprints

Last updated: 2026-03-02
