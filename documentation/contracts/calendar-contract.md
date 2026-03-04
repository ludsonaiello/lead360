# Feature Contract: Calendar & Scheduling Module

**Feature Name**: Calendar & Scheduling Module  
**Module**: Calendar / Scheduling / Google Calendar Integration  
**Sprint**: 11 (11a, 11b, 11c)  
**Status**: Draft — Pending Approval  
**Version**: 1.0  
**Created**: 2026-03-02  
**Author**: Ludson (Product / PM) + AI PM Assistant  
**Depends On**: Leads Module, Service Requests, Communication Module, Voice AI Agent, Notification System, Tenant Business Hours  

---

## Purpose

**What problem does this solve?**

U.S. service businesses (painting, gutter, cleaning, etc.) need to schedule quote visits with leads and manage their appointment availability without double-booking or manually checking calendars. Currently, the Voice AI agent uses a placeholder for appointment booking (creates a `lead_note` instead of a structured appointment). There is no real scheduling engine, no availability management, and no external calendar sync. This module provides a complete built-in scheduling system with Google Calendar integration, availability management, slot calculation, and Voice AI booking/rescheduling/cancellation capabilities.

**Who is this for?**

- **Primary Users**: Business Owners, Admins, Estimators (manage availability, view calendar, create/reschedule/cancel appointments)
- **Secondary Users**: Leads/Customers (via Voice AI agent — book, reschedule, or cancel their own appointments by phone)

**Use Cases**:

1. Tenant configures their quote visit availability (e.g., Monday mornings and Thursday all day, 1.5-hour slots)
2. Lead calls, Voice AI checks availability, books a slot, syncs to Google Calendar, sends confirmation SMS/email
3. Lead calls back to reschedule — Voice AI verifies identity, offers next available slots, moves the appointment
4. Tenant adds a personal event on Google Calendar — system detects it and blocks that slot automatically
5. Owner opens dashboard, sees upcoming appointments and new bookings at a glance

---

## Scope

### **In Scope**

- ✅ Appointment entity with full lifecycle (Scheduled → Confirmed → Completed → Cancelled → No Show → Rescheduled)
- ✅ Appointment type entity (MVP ships with "Quote Visit" only; data model supports multiple types)
- ✅ Per-appointment-type weekly availability schedule (which days, which time windows)
- ✅ Configurable slot duration per appointment type (15-minute increments from 15min to 6h, plus All Day)
- ✅ Slot calculation engine (generates available slots minus existing bookings, holidays, external calendar blocks)
- ✅ Maximum lookahead of 8 weeks (configurable per appointment type)
- ✅ Google Calendar OAuth 2.0 integration (one connection per tenant)
- ✅ Outbound sync: Lead360 → Google Calendar (rich event data: title, address, phone, service details)
- ✅ Inbound sync: Google Calendar → Lead360 (external events block slots as "Busy — Blocked External", no personal details stored)
- ✅ Google Calendar push notifications (webhooks) for real-time external event detection
- ✅ Periodic full sync fallback (every 6 hours)
- ✅ OAuth token refresh handling
- ✅ Voice AI tool: `book_appointment` (upgraded from placeholder to real booking)
- ✅ Voice AI tool: `reschedule_appointment` (new — identity verification, offer next slots, move booking)
- ✅ Voice AI tool: `cancel_appointment` (new — identity verification, cancel, free slot)
- ✅ Voice AI presents next 14 days of availability to callers; searches up to 8 weeks if needed
- ✅ Lead identity verification for Voice AI reschedule/cancel (phone number match against lead record)
- ✅ Appointment cancellation reason tracking (Customer Cancelled, Business Cancelled, No Show, Rescheduled, Other)
- ✅ Fixed appointment reminders: 24h before (email + SMS if consent) and 1h before (SMS if consent)
- ✅ Reminder auto-skip logic (skip 24h reminder if booked <24h out; skip both if booked <1h out)
- ✅ Notification system integration (appointment booked/rescheduled/cancelled → notification bell for Owner/Admin/Estimator)
- ✅ External conflict notification (when delayed webhook reveals overlap)
- ✅ Dashboard banner widget: "New Appointments" + "Upcoming Appointments"
- ✅ Built-in calendar page (week/day view) with full appointment details and "Busy — Blocked External" indicators
- ✅ Create/edit/cancel appointments from calendar UI
- ✅ Tenant timezone field added to tenant table
- ✅ RBAC: Owner, Admin, Estimator (UI management) + Lead (Voice AI — own appointments only)
- ✅ Audit logging for all appointment lifecycle events
- ✅ Lead activity timeline entries for all appointment actions

### **Out of Scope**

- ❌ Apple Calendar / iCloud CalDAV integration (deferred — Google Calendar events appear on iPhones natively when the Google account is added to the device)
- ❌ Per-user calendar connections (deferred — MVP is one connection per tenant)
- ❌ Per-user/estimator availability schedules (deferred — MVP is company-level availability)
- ❌ Public self-service booking page / widget (not needed — booking is via Voice AI or staff only)
- ❌ Multiple appointment types shipped in MVP (architecture supports it, but only "Quote Visit" is created by default)
- ❌ Configurable reminder schedules (architecture supports it, but MVP uses fixed 24h + 1h)
- ❌ Recurring appointments
- ❌ Multi-estimator availability routing / load balancing
- ❌ Calendar-based project scheduling (post-MVP)
- ❌ Customer self-service reschedule/cancel via web portal

---

## Dependencies

### **Requires (must be complete first)**

- [x] Tenant module with business hours and custom hours (BUILT)
- [x] Leads module with CRUD, lead_address, and service_request (BUILT)
- [x] Communication module — SMS and email sending via providers (BUILT)
- [x] Template variable registry with appointment variables (BUILT)
- [x] Notification system — notification creation and delivery (BUILT)
- [x] BullMQ scheduler queue infrastructure (BUILT)
- [x] EncryptionService for secure token storage (BUILT)
- [x] Voice AI internal tool dispatch — Sprint B06c `executeTool` pattern (BUILT — placeholder)
- [x] Lead activity logging service (BUILT)
- [x] Audit logging service (BUILT)
- [ ] Google Cloud project with Calendar API enabled + OAuth client credentials (PLATFORM SETUP REQUIRED — System Admin must configure Google Cloud Console and provide client_id/client_secret at platform level, similar to Twilio system provider setup)

### **Blocks (must complete before)**

- Voice AI live scheduling (currently uses mock/placeholder — depends on this module for real availability data)
- Voice AI reschedule/cancel tools (new tools depend on appointment entity existing)
- Customer portal appointment display (future)
- Project scheduling features (future)
- Appointment conversion metrics in reporting module (future)
- Per-user availability expansion (future — requires this module's entities as foundation)

---

## Data Model

### **Schema Change: Existing Table**

#### **Table: tenant (MODIFIED)**

**Change**: Add `timezone` column.

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| timezone | varchar(50) | Yes | IANA timezone identifier | Must be valid IANA timezone (e.g., "America/New_York") | "America/New_York" |

**Migration note**: All existing tenants receive the default value. Owner/Admin can change via tenant settings.

---

### **New Tables**

#### **Table: appointment_type**

**Purpose**: Defines a category of appointment a tenant offers. MVP ships with one default type ("Quote Visit"). Architecture supports multiple types per tenant.

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | varchar(36) | Yes | Primary key (UUID) | — | uuid() |
| tenant_id | varchar(36) | Yes | Tenant identifier (FK → tenant.id) | — | — |
| name | varchar(100) | Yes | Display name | Min 2 chars, max 100 | — |
| description | varchar(500) | No | Description of this appointment type | Max 500 | null |
| slot_duration_minutes | int | Yes | Duration of each slot in minutes | Must be one of: 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360, or 0 (All Day) | 60 |
| max_lookahead_weeks | int | Yes | How many weeks forward the system searches for availability | Min 1, max 52 | 8 |
| reminder_24h_enabled | boolean | Yes | Send 24h reminder | — | true |
| reminder_1h_enabled | boolean | Yes | Send 1h reminder | — | true |
| is_active | boolean | Yes | Whether this type is currently bookable | — | true |
| is_default | boolean | Yes | Whether this is the tenant's default appointment type | Only one per tenant can be true | false |
| created_at | datetime | Yes | Creation timestamp | — | now() |
| updated_at | datetime | Yes | Last update timestamp | — | now() |
| created_by_user_id | varchar(36) | No | User who created this type (FK → user.id) | — | null |

**Indexes**:
- Primary: `id`
- Composite: `(tenant_id, is_active)`
- Composite: `(tenant_id, is_default)`

**Relationships**:
- Belongs to: `tenant`
- Belongs to: `user` (created_by)
- Has many: `appointment_type_schedule`
- Has many: `appointment`

**Business Rules**:
- Only one `is_default = true` per tenant. Setting a new default must unset the previous one.
- On tenant creation, one default appointment type ("Quote Visit") is auto-created with `slot_duration_minutes = 60`, `max_lookahead_weeks = 8`.
- `slot_duration_minutes = 0` means "All Day" — one appointment consumes the entire availability window for that day.
- Deactivating an appointment type (`is_active = false`) does NOT cancel existing appointments of that type. It prevents new bookings only.

---

#### **Table: appointment_type_schedule**

**Purpose**: Defines the weekly recurring availability windows for an appointment type. Each row represents one day of the week with up to two time windows (same dual-shift pattern as `tenant_business_hours`).

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | varchar(36) | Yes | Primary key (UUID) | — | uuid() |
| appointment_type_id | varchar(36) | Yes | FK → appointment_type.id | — | — |
| day_of_week | int | Yes | Day number (0 = Sunday, 1 = Monday, ... 6 = Saturday) | 0–6 | — |
| is_available | boolean | Yes | Whether this day is available for booking | — | false |
| window1_start | varchar(5) | No | First window start time (HH:MM, 24h format) | Valid time format, required if is_available = true | null |
| window1_end | varchar(5) | No | First window end time (HH:MM, 24h format) | Must be after window1_start, required if is_available = true | null |
| window2_start | varchar(5) | No | Second window start time (HH:MM, 24h format) | Must be after window1_end | null |
| window2_end | varchar(5) | No | Second window end time (HH:MM, 24h format) | Must be after window2_start | null |
| created_at | datetime | Yes | Creation timestamp | — | now() |
| updated_at | datetime | Yes | Last update timestamp | — | now() |

**Indexes**:
- Primary: `id`
- Unique: `(appointment_type_id, day_of_week)` — one row per day per type
- Index: `(appointment_type_id)`

**Relationships**:
- Belongs to: `appointment_type`

**Business Rules**:
- Exactly 7 rows per appointment type (one for each day of the week), created when the appointment type is created.
- Time validation: `window1_start < window1_end`. If window2 is set: `window1_end < window2_start < window2_end`.
- Times are stored in tenant local time (the tenant's timezone applies when calculating UTC equivalents).
- If `is_available = false`, time windows are ignored for that day.

---

#### **Table: appointment**

**Purpose**: The core scheduling entity. Represents a booked appointment linking a lead to a time slot. This is the system of record — Google Calendar events are synced copies.

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | varchar(36) | Yes | Primary key (UUID) | — | uuid() |
| tenant_id | varchar(36) | Yes | Tenant identifier (FK → tenant.id) | — | — |
| appointment_type_id | varchar(36) | Yes | FK → appointment_type.id | — | — |
| lead_id | varchar(36) | Yes | FK → lead.id (every appointment MUST be tied to a lead) | — | — |
| service_request_id | varchar(36) | No | FK → service_request.id (optional link) | — | null |
| scheduled_date | date | Yes | Date of the appointment | Must be today or future (at creation time) | — |
| start_time | varchar(5) | Yes | Start time (HH:MM, 24h format, tenant local time) | Valid time format | — |
| end_time | varchar(5) | Yes | End time (HH:MM, 24h format, tenant local time) | Must be after start_time | — |
| start_datetime_utc | datetime | Yes | Start in UTC (calculated from date + time + tenant timezone) | — | — |
| end_datetime_utc | datetime | Yes | End in UTC (calculated from date + time + tenant timezone) | — | — |
| status | enum | Yes | Appointment status | One of: scheduled, confirmed, completed, cancelled, no_show, rescheduled | "scheduled" |
| cancellation_reason | enum | No | Reason for cancellation (required when status = cancelled or no_show) | One of: customer_cancelled, business_cancelled, no_show, rescheduled, other | null |
| cancellation_notes | text | No | Free-text notes for cancellation (especially when reason = other) | Max 1000 chars | null |
| notes | text | No | General appointment notes | Max 2000 chars | null |
| source | varchar(20) | Yes | How the appointment was created | One of: voice_ai, manual, system | "manual" |
| external_calendar_event_id | varchar(255) | No | Google Calendar event ID for sync reference | — | null |
| rescheduled_from_id | varchar(36) | No | FK → appointment.id (self-reference — original appointment when this is a rescheduled booking) | — | null |
| assigned_user_id | varchar(36) | No | FK → user.id (estimator/staff assigned — future use, nullable for MVP) | — | null |
| created_at | datetime | Yes | Creation timestamp | — | now() |
| updated_at | datetime | Yes | Last update timestamp | — | now() |
| created_by_user_id | varchar(36) | No | FK → user.id (who booked it — null if booked by Voice AI) | — | null |
| cancelled_at | datetime | No | When the appointment was cancelled | — | null |
| cancelled_by_user_id | varchar(36) | No | FK → user.id (who cancelled — null if cancelled by Voice AI on behalf of lead) | — | null |
| completed_at | datetime | No | When marked as completed | — | null |

**Indexes**:
- Primary: `id`
- Composite: `(tenant_id, scheduled_date, status)` — primary query for slot calculation
- Composite: `(tenant_id, status, start_datetime_utc)` — upcoming appointments query
- Composite: `(tenant_id, lead_id, status)` — find appointments for a specific lead (Voice AI identity verification)
- Composite: `(tenant_id, appointment_type_id, scheduled_date)` — availability by type
- Index: `(tenant_id, created_at DESC)` — recent appointments
- Index: `(external_calendar_event_id)` — Google Calendar sync lookup
- Index: `(rescheduled_from_id)` — reschedule chain tracking

**Relationships**:
- Belongs to: `tenant`
- Belongs to: `appointment_type`
- Belongs to: `lead`
- Belongs to (optional): `service_request`
- Belongs to (optional): `user` (assigned_user)
- Belongs to (optional): `user` (created_by_user)
- Belongs to (optional): `user` (cancelled_by_user)
- Self-reference (optional): `appointment` (rescheduled_from)

**Business Rules**:
- `lead_id` is REQUIRED. Every appointment must be tied to a lead for identity verification during Voice AI interactions.
- `start_datetime_utc` and `end_datetime_utc` are calculated server-side from `scheduled_date` + `start_time` + `end_time` + `tenant.timezone`. These UTC fields are used for all cross-timezone operations (calendar sync, reminder scheduling, conflict detection).
- When status changes to `cancelled` or `no_show`, `cancellation_reason` becomes required.
- When status changes to `rescheduled`, the system auto-sets `cancellation_reason = rescheduled` and creates a new appointment with `rescheduled_from_id` pointing to this one.
- Slot validation: before confirming a booking, the system must verify the slot is still available (no existing appointment, no external calendar block, no holiday). If the slot was taken between selection and confirmation (race condition), return an error and offer next available.
- An appointment can only be rescheduled or cancelled if its current status is `scheduled` or `confirmed`. Appointments in `completed`, `cancelled`, `no_show`, or `rescheduled` status cannot be modified.

---

#### **Table: calendar_provider_connection**

**Purpose**: Stores the tenant's connection to an external calendar provider. MVP supports Google Calendar only. Follows the Provider Registry pattern used by the Communication module. One connection per tenant for MVP.

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | varchar(36) | Yes | Primary key (UUID) | — | uuid() |
| tenant_id | varchar(36) | Yes | Tenant identifier (FK → tenant.id) | Unique per tenant (MVP) | — |
| provider_type | varchar(30) | Yes | Calendar provider identifier | One of: google_calendar (extensible for apple_calendar, outlook, etc.) | — |
| access_token | text | Yes | Encrypted OAuth access token | Encrypted via EncryptionService | — |
| refresh_token | text | Yes | Encrypted OAuth refresh token | Encrypted via EncryptionService | — |
| token_expires_at | datetime | Yes | When the access token expires | — | — |
| connected_calendar_id | varchar(255) | Yes | The specific calendar ID selected by the tenant (e.g., "primary" or a specific Google Calendar ID) | — | — |
| connected_calendar_name | varchar(255) | No | Display name of the connected calendar | — | null |
| webhook_channel_id | varchar(255) | No | Google push notification channel ID | — | null |
| webhook_resource_id | varchar(255) | No | Google push notification resource ID | — | null |
| webhook_expiration | datetime | No | When the webhook channel expires (Google requires renewal) | — | null |
| sync_status | varchar(20) | Yes | Current sync health status | One of: active, disconnected, error, syncing | "active" |
| last_sync_at | datetime | No | Last successful sync timestamp | — | null |
| last_sync_token | text | No | Google sync token for incremental sync (avoids re-fetching all events) | — | null |
| error_message | text | No | Last error message if sync_status = error | — | null |
| is_active | boolean | Yes | Whether this connection is active | — | true |
| created_at | datetime | Yes | Creation timestamp | — | now() |
| updated_at | datetime | Yes | Last update timestamp | — | now() |
| connected_by_user_id | varchar(36) | No | FK → user.id (who set up the connection) | — | null |

**Indexes**:
- Primary: `id`
- Unique: `(tenant_id, provider_type)` — one connection per provider per tenant
- Index: `(tenant_id, is_active)`
- Index: `(sync_status)`
- Index: `(webhook_expiration)` — for webhook renewal cron job

**Relationships**:
- Belongs to: `tenant`
- Belongs to (optional): `user` (connected_by)

**Business Rules**:
- OAuth tokens (access_token, refresh_token) MUST be encrypted at rest using EncryptionService before storage. They are NEVER returned in API responses.
- Token refresh: when `token_expires_at` is approaching (e.g., within 5 minutes), the system proactively refreshes using the refresh_token. On refresh failure (user revoked access), set `sync_status = disconnected` and notify Owner/Admin.
- Webhook renewal: Google push notification channels expire (typically 7 days). A scheduled job must renew channels before expiration. The `webhook_expiration` field is used to track this.
- If the tenant disconnects the calendar (deletes the connection), all `calendar_external_block` records for that tenant are purged. Existing appointments are NOT affected — they remain in Lead360 but are no longer synced to Google Calendar.
- Disconnecting does NOT delete Google Calendar events that were previously synced.

---

#### **Table: calendar_sync_log**

**Purpose**: Audit trail for every sync operation between Lead360 and Google Calendar. Used for debugging sync issues and monitoring health.

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | varchar(36) | Yes | Primary key (UUID) | — | uuid() |
| tenant_id | varchar(36) | Yes | Tenant identifier (FK → tenant.id) | — | — |
| connection_id | varchar(36) | Yes | FK → calendar_provider_connection.id | — | — |
| direction | varchar(10) | Yes | Sync direction | One of: outbound (Lead360 → Google), inbound (Google → Lead360) | — |
| action | varchar(20) | Yes | What action was taken | One of: event_created, event_updated, event_deleted, block_created, block_updated, block_deleted, full_sync, token_refreshed, webhook_renewed | — |
| appointment_id | varchar(36) | No | FK → appointment.id (for outbound syncs) | — | null |
| external_event_id | varchar(255) | No | Google Calendar event ID involved | — | null |
| status | varchar(10) | Yes | Outcome of the sync operation | One of: success, failed, skipped | — |
| error_message | text | No | Error details if status = failed | — | null |
| metadata | json | No | Additional context (e.g., response codes, retry count) | — | null |
| created_at | datetime | Yes | Timestamp of the sync operation | — | now() |

**Indexes**:
- Primary: `id`
- Composite: `(tenant_id, created_at DESC)` — recent sync activity
- Composite: `(tenant_id, status)` — failed sync lookup
- Index: `(connection_id)`
- Index: `(appointment_id)`

**Relationships**:
- Belongs to: `tenant`
- Belongs to: `calendar_provider_connection`
- Belongs to (optional): `appointment`

**Business Rules**:
- Log entries are immutable (insert-only, no updates or deletes).
- Retention: logs older than 90 days may be purged by a scheduled cleanup job (configurable).
- Every outbound sync (create/update/delete Google Calendar event) must create a log entry regardless of success or failure.
- Every inbound sync (webhook received, full sync executed) must create a log entry.

---

#### **Table: calendar_external_block**

**Purpose**: Stores blocked time periods detected from the connected Google Calendar. These represent events the tenant has on their personal/external calendar that should prevent appointment booking in Lead360. NO personal event details are stored — only the time block and sync reference.

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | varchar(36) | Yes | Primary key (UUID) | — | uuid() |
| tenant_id | varchar(36) | Yes | Tenant identifier (FK → tenant.id) | — | — |
| connection_id | varchar(36) | Yes | FK → calendar_provider_connection.id | — | — |
| external_event_id | varchar(255) | Yes | Google Calendar event ID (for sync tracking — detect updates/deletes) | — | — |
| start_datetime_utc | datetime | Yes | Block start time in UTC | — | — |
| end_datetime_utc | datetime | Yes | Block end time in UTC | — | — |
| is_all_day | boolean | Yes | Whether this is an all-day event | — | false |
| source | varchar(30) | Yes | Where this block came from | One of: google_calendar (extensible for future providers) | — |
| created_at | datetime | Yes | When this block was first detected | — | now() |
| updated_at | datetime | Yes | When this block was last synced/updated | — | now() |

**Indexes**:
- Primary: `id`
- Composite: `(tenant_id, start_datetime_utc, end_datetime_utc)` — slot calculation overlap check
- Unique: `(tenant_id, external_event_id)` — prevent duplicate blocks for same event
- Index: `(connection_id)`

**Relationships**:
- Belongs to: `tenant`
- Belongs to: `calendar_provider_connection`

**Business Rules**:
- This table stores ONLY time blocks. No event title, description, attendees, or any personal information.
- When an external event is deleted from Google Calendar, the corresponding block is deleted from this table (slot becomes available again).
- When an external event is modified (time changed), the block is updated to reflect the new times.
- Events created BY Lead360 (identified by the `external_calendar_event_id` matching an appointment's `external_calendar_event_id`) are EXCLUDED from this table — they are not "external blocks."
- All-day events: `is_all_day = true` blocks the entire day from availability.
- On calendar disconnection, all blocks for that tenant + connection are purged.

---

### **Enums**

#### **appointment_status**

| Value | Description |
|-------|-------------|
| `scheduled` | Appointment booked, awaiting the visit date |
| `confirmed` | Tenant/staff explicitly confirmed the appointment |
| `completed` | Appointment took place successfully |
| `cancelled` | Appointment was cancelled (see cancellation_reason) |
| `no_show` | Lead did not show up for the appointment |
| `rescheduled` | Appointment was moved — this is the OLD record. The new appointment links back via `rescheduled_from_id` |

**State Transitions**:
```
scheduled → confirmed → completed
scheduled → cancelled
scheduled → no_show
scheduled → rescheduled
confirmed → completed
confirmed → cancelled
confirmed → no_show
confirmed → rescheduled
```

**Who Can Transition**:
- `scheduled → confirmed`: Owner, Admin, Estimator (manual confirmation)
- `scheduled/confirmed → completed`: Owner, Admin, Estimator
- `scheduled/confirmed → cancelled`: Owner, Admin, Estimator (UI) or Lead (via Voice AI, own appointment only)
- `scheduled/confirmed → no_show`: Owner, Admin, Estimator
- `scheduled/confirmed → rescheduled`: Owner, Admin, Estimator (UI) or Lead (via Voice AI, own appointment only) — system auto-sets this status on the old appointment

**Terminal States**: `completed`, `cancelled`, `no_show`, `rescheduled` — no further transitions allowed.

#### **appointment_cancellation_reason**

| Value | Description |
|-------|-------------|
| `customer_cancelled` | The lead/customer requested cancellation |
| `business_cancelled` | The business cancelled (schedule conflict, staffing, etc.) |
| `no_show` | Lead did not arrive at the scheduled time |
| `rescheduled` | System-set when appointment is rescheduled to a new time |
| `other` | Any other reason — `cancellation_notes` should contain details |

#### **calendar_sync_status**

| Value | Description |
|-------|-------------|
| `active` | Connection is healthy, sync is working |
| `disconnected` | OAuth token was revoked or refresh failed |
| `error` | Sync encountered an error (see error_message) |
| `syncing` | A sync operation is currently in progress |

#### **appointment_source**

| Value | Description |
|-------|-------------|
| `voice_ai` | Booked by the Voice AI agent during a call |
| `manual` | Booked by staff through the calendar UI |
| `system` | Created by system process (e.g., auto-generated during testing or migration) |

---

## API Specification

### **Endpoints Overview**

#### **Appointment Type Management**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /api/v1/calendar/appointment-types | List all appointment types for tenant | Yes | Owner, Admin, Estimator |
| POST | /api/v1/calendar/appointment-types | Create new appointment type | Yes | Owner, Admin, Estimator |
| GET | /api/v1/calendar/appointment-types/:id | Get single appointment type with schedule | Yes | Owner, Admin, Estimator |
| PATCH | /api/v1/calendar/appointment-types/:id | Update appointment type | Yes | Owner, Admin, Estimator |
| DELETE | /api/v1/calendar/appointment-types/:id | Soft-delete (deactivate) appointment type | Yes | Owner, Admin |

#### **Appointment Type Schedule Management**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /api/v1/calendar/appointment-types/:typeId/schedule | Get full weekly schedule | Yes | Owner, Admin, Estimator |
| PUT | /api/v1/calendar/appointment-types/:typeId/schedule | Replace full weekly schedule (bulk update all 7 days) | Yes | Owner, Admin, Estimator |
| PATCH | /api/v1/calendar/appointment-types/:typeId/schedule/:dayOfWeek | Update a single day's schedule | Yes | Owner, Admin, Estimator |

#### **Availability & Slot Calculation**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /api/v1/calendar/availability | Get available slots for a date range and appointment type | Yes | Owner, Admin, Estimator |
| GET | /api/v1/calendar/availability/next | Get next N available slots (for Voice AI / quick booking) | Yes | Owner, Admin, Estimator |

#### **Appointment CRUD & Lifecycle**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /api/v1/calendar/appointments | List appointments (filterable by date range, status, lead) | Yes | Owner, Admin, Estimator |
| POST | /api/v1/calendar/appointments | Create (book) a new appointment | Yes | Owner, Admin, Estimator |
| GET | /api/v1/calendar/appointments/:id | Get single appointment with full details | Yes | Owner, Admin, Estimator |
| PATCH | /api/v1/calendar/appointments/:id | Update appointment details (notes, status) | Yes | Owner, Admin, Estimator |
| POST | /api/v1/calendar/appointments/:id/reschedule | Reschedule to a new slot (creates new appointment, marks old as rescheduled) | Yes | Owner, Admin, Estimator |
| POST | /api/v1/calendar/appointments/:id/cancel | Cancel appointment with reason | Yes | Owner, Admin, Estimator |
| POST | /api/v1/calendar/appointments/:id/complete | Mark appointment as completed | Yes | Owner, Admin, Estimator |
| POST | /api/v1/calendar/appointments/:id/no-show | Mark appointment as no-show | Yes | Owner, Admin, Estimator |

#### **Google Calendar Integration**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /api/v1/calendar/integration/status | Get current calendar connection status | Yes | Owner, Admin |
| GET | /api/v1/calendar/integration/google/auth-url | Generate Google OAuth authorization URL | Yes | Owner, Admin |
| GET | /api/v1/calendar/integration/google/callback | OAuth callback handler (receives authorization code) | Yes (session) | Owner, Admin |
| GET | /api/v1/calendar/integration/google/calendars | List available Google Calendars after OAuth (for user to pick which one) | Yes | Owner, Admin |
| POST | /api/v1/calendar/integration/google/connect | Finalize connection with selected calendar ID | Yes | Owner, Admin |
| DELETE | /api/v1/calendar/integration/google/disconnect | Disconnect Google Calendar | Yes | Owner, Admin |
| POST | /api/v1/calendar/integration/google/sync | Trigger manual full sync | Yes | Owner, Admin |
| POST | /api/v1/calendar/integration/google/test | Test connection health | Yes | Owner, Admin |

#### **Google Calendar Webhook (Internal / Public)**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | /api/webhooks/google-calendar | Receive Google push notifications (public endpoint, verified by channel token) | No (webhook signature) | — |

#### **Voice AI Internal Tools (Internal API)**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | /api/v1/internal/voice-ai/tenant/:tenantId/tools/book_appointment | Book appointment from Voice AI call | Voice Agent Key | Internal |
| POST | /api/v1/internal/voice-ai/tenant/:tenantId/tools/reschedule_appointment | Reschedule appointment from Voice AI call | Voice Agent Key | Internal |
| POST | /api/v1/internal/voice-ai/tenant/:tenantId/tools/cancel_appointment | Cancel appointment from Voice AI call | Voice Agent Key | Internal |

#### **Dashboard Widgets**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /api/v1/calendar/dashboard/upcoming | Get upcoming appointments for dashboard banner | Yes | Owner, Admin, Estimator |
| GET | /api/v1/calendar/dashboard/new | Get newly booked appointments (not yet acknowledged) | Yes | Owner, Admin, Estimator |
| PATCH | /api/v1/calendar/dashboard/new/:id/acknowledge | Mark a new appointment as acknowledged | Yes | Owner, Admin, Estimator |

---

### **Key Endpoint Details**

#### **GET /api/v1/calendar/availability**

**Purpose**: Returns available time slots for booking. This is the core scheduling endpoint used by both the UI and Voice AI tools.

**Query Parameters**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| appointment_type_id | uuid | Yes | Which appointment type to check availability for |
| date_from | date (YYYY-MM-DD) | Yes | Start of date range |
| date_to | date (YYYY-MM-DD) | Yes | End of date range (max span = max_lookahead_weeks from appointment type) |

**Response**: Ordered list of available slots grouped by date.

**Response Shape**:
```
{
  "appointment_type": { "id": "...", "name": "Quote Visit", "slot_duration_minutes": 90 },
  "timezone": "America/New_York",
  "date_range": { "from": "2026-03-02", "to": "2026-03-16" },
  "available_dates": [
    {
      "date": "2026-03-02",
      "day_name": "Monday",
      "slots": [
        { "start_time": "08:00", "end_time": "09:30" },
        { "start_time": "09:30", "end_time": "11:00" },
        { "start_time": "10:30", "end_time": "12:00" }
      ]
    },
    {
      "date": "2026-03-05",
      "day_name": "Thursday",
      "slots": [
        { "start_time": "08:00", "end_time": "09:30" },
        { "start_time": "09:30", "end_time": "11:00" }
      ]
    }
  ],
  "total_available_slots": 5
}
```

**Slot Calculation Logic** (executed server-side):
1. Load the appointment type's weekly schedule → determine which days in the date range are available and their time windows
2. For each available day, generate all possible slot start times based on `slot_duration_minutes`. A slot must fit entirely within the availability window (start_time + duration ≤ window end)
3. Query existing appointments for this tenant within the date range where status IN (scheduled, confirmed) → subtract overlapping times
4. Query `tenant_custom_hours` for holidays/closures in the date range → skip closed days, adjust for modified hours
5. Query `calendar_external_block` for this tenant within the date range → subtract overlapping times
6. Return remaining slots ordered by date, then by start_time

**Edge Cases**:
- All Day slot (duration = 0): if the day is available and has no existing bookings or blocks that consume the full window, return one slot for that day
- DST transitions: use IANA timezone rules to correctly convert between tenant local time and UTC, especially for slots that fall on DST change days
- Custom hours override: if a day that is normally available in the schedule has a custom_hours record marked as closed, skip that day entirely. If custom_hours has modified hours, use those instead of the schedule.

---

#### **POST /api/v1/calendar/appointments**

**Purpose**: Book a new appointment.

**Request Body**:
```
{
  "appointment_type_id": "uuid",
  "lead_id": "uuid",
  "service_request_id": "uuid (optional)",
  "scheduled_date": "2026-03-05",
  "start_time": "09:30",
  "notes": "Customer mentioned the job is exterior painting, 2-story house"
}
```

**Behavior**:
1. Validate the slot is still available (re-run availability check for that specific slot — prevents race conditions)
2. Create appointment record with status = `scheduled`, calculate `end_time` from `start_time + slot_duration_minutes`, calculate UTC datetimes using tenant timezone
3. Link to lead and optionally to service_request
4. If Google Calendar is connected: queue a BullMQ job to create a Google Calendar event with rich data (title, location, description with lead details)
5. Schedule reminder jobs: 24h email+SMS (if consent) and 1h SMS (if consent). Skip reminders that would be in the past.
6. Log activity on the lead's timeline: "Appointment scheduled: Quote Visit on March 5 at 9:30 AM"
7. Create notification for Owner/Admin/Estimator: "New appointment booked"
8. Update service_request status to "scheduled_visit" if a service_request_id was provided
9. Return the created appointment

**Validation Rules**:
- `appointment_type_id` must belong to tenant and be active
- `lead_id` must belong to tenant
- `service_request_id` (if provided) must belong to tenant and to the same lead
- `scheduled_date` must be today or future
- `start_time` must produce a valid slot within the appointment type's availability schedule
- The slot must not overlap with any existing appointment (status = scheduled or confirmed) or external calendar block

---

#### **POST /api/v1/calendar/appointments/:id/reschedule**

**Purpose**: Move an appointment to a new time slot.

**Request Body**:
```
{
  "new_scheduled_date": "2026-03-12",
  "new_start_time": "10:30",
  "reason": "customer_cancelled (optional override — defaults to 'rescheduled')"
}
```

**Behavior**:
1. Validate the appointment exists, belongs to tenant, and is in a modifiable status (`scheduled` or `confirmed`)
2. Validate the new slot is available
3. Update the OLD appointment: set status = `rescheduled`, cancellation_reason = `rescheduled`, cancelled_at = now()
4. Create a NEW appointment with all the same details (lead, type, service_request, notes) but with the new date/time. Set `rescheduled_from_id` = old appointment ID, source = same as original
5. Cancel old reminders, schedule new reminders for the new appointment
6. If Google Calendar is connected: update the existing Google Calendar event (don't delete and recreate — preserves the event ID and any manual edits the tenant made on the Google side). The new appointment inherits the `external_calendar_event_id`.
7. Send reschedule confirmation SMS/email to the lead with new date/time
8. Log activity on lead timeline, create notification for staff
9. Return the new appointment

---

#### **POST /api/v1/calendar/appointments/:id/cancel**

**Purpose**: Cancel an appointment and free the slot.

**Request Body**:
```
{
  "cancellation_reason": "customer_cancelled",
  "cancellation_notes": "Customer said they found another contractor (optional)"
}
```

**Behavior**:
1. Validate the appointment exists, belongs to tenant, and is in a modifiable status
2. Update appointment: status = `cancelled`, cancellation_reason = provided value, cancellation_notes, cancelled_at = now(), cancelled_by_user_id
3. Cancel all pending reminder jobs for this appointment
4. If Google Calendar is connected: queue a job to delete the Google Calendar event
5. Send cancellation confirmation SMS/email to the lead
6. Log activity on lead timeline with the reason
7. Create notification for staff with the reason
8. If linked to a service_request, update its status back to "new"
9. Return the updated appointment

---

#### **Voice AI Internal Tools**

**POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/book_appointment**

**Request Body**:
```
{
  "call_log_id": "uuid",
  "lead_id": "uuid",
  "preferred_date": "2026-03-05 (optional — if not provided, use next available)",
  "service_type": "Exterior Painting",
  "notes": "2-story house, needs full exterior"
}
```

**Behavior**:
1. If `preferred_date` provided: check availability for that date. If no slots, search forward up to 8 weeks.
2. If `preferred_date` not provided: get next available slots across the next 14 days (expand to 8 weeks if none found).
3. Return available slots to the Voice AI (the AI presents them conversationally to the caller).
4. Once the caller selects a slot, the AI calls this endpoint again with the specific date/time to confirm the booking.
5. On confirmation: create the appointment with source = `voice_ai`, trigger all sync/notification/reminder cascading effects.
6. If no slots found within 8 weeks: return `{ "status": "no_availability", "message": "..." }` — Voice AI creates a callback task for staff.

**POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/reschedule_appointment**

**Request Body**:
```
{
  "call_log_id": "uuid",
  "lead_id": "uuid"
}
```

**Behavior**:
1. Verify caller phone number (from call_log) matches the lead record's phone number. If no match, return `{ "status": "verification_failed" }` — Voice AI asks for name + appointment date for manual verification.
2. Find the lead's active appointment (status = `scheduled` or `confirmed`). If multiple exist, return them all and let the Voice AI ask which one.
3. If no active appointment found: return `{ "status": "no_appointment_found" }` — Voice AI informs the caller and offers to book a new one.
4. Return available slots for the next 14 days (same logic as booking).
5. Once caller selects new slot, execute the reschedule flow (same as UI reschedule endpoint above).

**POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/cancel_appointment**

**Request Body**:
```
{
  "call_log_id": "uuid",
  "lead_id": "uuid",
  "reason": "customer_cancelled (optional — Voice AI can ask)"
}
```

**Behavior**:
1. Same identity verification as reschedule.
2. Find the lead's active appointment.
3. Cancel it with the provided reason (default: `customer_cancelled`).
4. Execute full cancellation flow (same as UI cancel endpoint).
5. Return confirmation.

---

## Business Rules

### **Validation Rules**

1. **Slot Must Fit Within Window**: A slot's start_time + duration must not exceed the availability window's end time. If the remaining time in a window is less than the slot duration, that partial time is not offered as a slot.

2. **No Overlapping Appointments**: Two appointments for the same tenant cannot overlap in time (regardless of appointment type). The system checks `start_datetime_utc` and `end_datetime_utc` for overlap before confirming any booking.

3. **External Blocks Prevent Booking**: If a `calendar_external_block` overlaps with a potential slot, that slot is removed from availability. Partial overlaps also remove the slot (a slot must be fully clear).

4. **Holiday/Custom Hours Override Schedule**: If `tenant_custom_hours` has a record for a date that would normally be available, the custom hours take precedence. Closed = day is blocked. Modified hours = use modified times instead of the appointment type schedule.

5. **Lead Required for Booking**: Every appointment must have a `lead_id`. Appointments cannot exist without a lead. This enables Voice AI identity verification and timeline tracking.

6. **Cancellation Reason Required**: When status transitions to `cancelled` or `no_show`, `cancellation_reason` must be provided. The system rejects the transition without it.

7. **Terminal State Lock**: Appointments in `completed`, `cancelled`, `no_show`, or `rescheduled` status cannot be modified (no reschedule, no cancel, no status change).

8. **All Day Slots**: When `slot_duration_minutes = 0` (All Day), only one appointment can be booked per available day. The slot consumes the entire availability window.

9. **Timezone Consistency**: All user-facing times (API responses, calendar events, reminders) are in the tenant's timezone. All internal storage and cross-system communication (Google Calendar sync, reminder job scheduling) use UTC.

10. **Voice AI Identity Verification**: For reschedule and cancel via Voice AI, the caller's phone number (from the active call log) must match the lead record's phone number. Mismatch triggers a secondary verification flow (name + appointment date).

### **Google Calendar Event Format**

**Outbound events (Lead360 → Google Calendar):**

- **Title**: `{appointment_type.name} — {lead.first_name} {lead.last_name}`
  - Example: "Quote Visit — John Smith"
- **Location**: `{lead_address.address_line1}, {lead_address.city}, {lead_address.state} {lead_address.zip_code}`
  - Only included if the lead has an address linked to the appointment's service_request or the lead's primary address
  - If no address available: omit the location field
- **Description** (multi-line):
  - Line 1: `Phone: {lead.phone}` (if available)
  - Line 2: `Email: {lead.email}` (if available)
  - Line 3: `Service: {service_request.service_name}` (if service_request linked)
  - Line 4: `Description: {service_request.description}` (if available)
  - Line 5: `Notes: {appointment.notes}` (if available)
  - Line 6: `Booked via: {appointment.source}`
  - If a field is not available, that line is omitted entirely (no empty labels or placeholders)
- **Start/End**: Calculated from appointment date + time + tenant timezone
- **Attendee**: Not included for MVP (future: estimator email when per-user is implemented)
- **Color/Category**: Not set for MVP (future: color-code by appointment type)

**Inbound events (Google Calendar → Lead360):**
- ONLY the time block (start/end) is stored in `calendar_external_block`
- NO title, description, location, or attendee data is stored or displayed
- Displayed in the built-in calendar as "Busy — Blocked (External)"

---

## UI Requirements

### **Pages Required**

#### **1. Calendar Page (Main Scheduling View)**

**Route**: `/calendar`

**Purpose**: Full calendar view showing all appointments, external blocks, and availability.

**Layout**:
```
[Header: "Calendar"]
[View Toggle: Day | Week] [Date Navigation: < Today >] [+ New Appointment Button]

[Calendar Grid]
  - Time column (left): 6AM to 9PM in 30-min rows
  - Day column(s): showing events as colored blocks
    - Appointments: full detail (lead name, time, type, status badge)
    - External blocks: "Busy — Blocked (External)" in gray
    - Non-available hours: grayed out / hatched

[Click on empty slot → opens Create Appointment modal]
[Click on appointment → opens Appointment Detail panel/modal]
```

**Functionality**:
- Week view (default): 7-day grid with current week
- Day view: single day expanded
- Navigate forward/backward by week or day
- Appointments displayed as blocks with: lead name, time range, appointment type, status color coding
- External blocks displayed as gray "Busy" blocks (no details)
- Non-available time (outside appointment type schedule) shown as unavailable
- Holidays/custom hours reflected (closed days grayed out)
- Click empty slot to book
- Click appointment to view detail / take actions (reschedule, cancel, complete, no-show)
- Mobile: single day view with swipe navigation

**Modern UI Requirements**:
- ✅ Color-coded status indicators (scheduled = blue, confirmed = green, completed = gray, cancelled = red)
- ✅ Loading skeleton on initial load
- ✅ Smooth navigation transitions
- ✅ Responsive (mobile = day view only, desktop = week default)
- ✅ Touch-friendly on mobile (tap to view, long-press for actions)

---

#### **2. Appointment Detail Modal/Panel**

**Trigger**: Click on an appointment in the calendar

**Content**:
- Appointment type + status badge
- Lead name (linked to lead detail page)
- Date + time range
- Address (if available)
- Phone (if available)
- Service type + description (from service_request)
- Notes
- Source (Voice AI / Manual)
- Created by + created at
- Reschedule history (if rescheduled_from_id exists, show chain)

**Actions** (based on status and RBAC):
- "Confirm" button (scheduled → confirmed)
- "Reschedule" button → opens reschedule flow
- "Cancel" button → opens cancel modal with reason selection
- "Complete" button (on/after appointment date)
- "No Show" button (on/after appointment date)

---

#### **3. Create Appointment Modal**

**Trigger**: "New Appointment" button or click on empty calendar slot

**Fields**:
- Appointment Type: dropdown (MVP: only "Quote Visit" available)
- Lead: searchable autocomplete (search by name, phone, email)
- Service Request: dropdown (filtered by selected lead, optional)
- Date: pre-filled if clicked from calendar slot, otherwise date picker
- Time Slot: dropdown of available slots for the selected date (auto-populated after date selection)
- Notes: textarea (optional)

**Behavior**:
- On lead selection, auto-populate address from lead's primary address
- On date selection, call availability endpoint and populate time slot dropdown
- On submit, validate and create appointment
- Show success modal with appointment summary
- Calendar refreshes to show the new appointment

**Modern UI Requirements**:
- ✅ Searchable autocomplete for lead selection
- ✅ Dynamic slot dropdown (loads available slots on date change)
- ✅ Date picker restricting to available days only
- ✅ Loading spinner during availability check
- ✅ Inline validation
- ✅ Success confirmation modal

---

#### **4. Cancel Appointment Modal**

**Trigger**: "Cancel" action on appointment detail

**Fields**:
- Cancellation Reason: required select (Customer Cancelled, Business Cancelled, No Show, Other)
- Notes: textarea (required if reason = Other, optional otherwise)
- Confirmation checkbox: "I understand this will notify the lead and free this time slot"

**Behavior**:
- On confirm: call cancel endpoint, show success feedback
- On success: calendar refreshes, slot becomes available

---

#### **5. Reschedule Appointment Flow**

**Trigger**: "Reschedule" action on appointment detail

**Fields**:
- Current appointment summary (read-only: date, time, lead name)
- New Date: date picker (restricted to available days)
- New Time Slot: dropdown of available slots for selected date
- Reason: optional text

**Behavior**:
- Shows current appointment details prominently
- On date selection, loads available slots (excluding the slot being rescheduled)
- On confirm: calls reschedule endpoint, shows success with new date/time
- Calendar refreshes to show the updated appointment

---

#### **6. Appointment Type Settings Page**

**Route**: `/settings/calendar/appointment-types`

**Purpose**: Configure appointment types and their availability schedules.

**Layout**:
```
[Header: "Appointment Types"]
[+ Add Appointment Type Button (hidden for MVP — only default type exists)]

[Card: Quote Visit]
  - Name: Quote Visit
  - Duration: 1 hour (dropdown to change)
  - Max Lookahead: 8 weeks (dropdown to change)
  - Status: Active (toggle)
  
  [Weekly Schedule Grid]
  Mon  [✓] 09:00 → 17:00  [+ Add Window]
  Tue  [ ] (not available)
  Wed  [ ] (not available)
  Thu  [✓] 08:00 → 12:00 | 13:00 → 17:00
  Fri  [ ] (not available)
  Sat  [ ] (not available)
  Sun  [ ] (not available)
  
  [Save Changes Button]
```

**Functionality**:
- Each day has a checkbox (available / not available) + time window inputs
- "Add Window" adds a second time range per day (split shift / lunch break)
- Duration dropdown: fixed set every 15 minutes from 15min to 6h + All Day
- Max Lookahead dropdown: 1–52 weeks
- Save validates all time logic (start < end, window1_end < window2_start)
- Mobile: stacked layout, each day as an expandable section

---

#### **7. Calendar Integration Settings Page**

**Route**: `/settings/calendar/integration`

**Purpose**: Connect/disconnect Google Calendar.

**Layout**:
```
[Header: "Calendar Integration"]

[Status Card]
  Connected to: Google Calendar — "My Calendar" ✅
  Last Synced: 5 minutes ago
  Sync Status: Active
  
  [Disconnect Button] [Sync Now Button] [Test Connection Button]

— OR if not connected —

[Setup Card]
  Connect your Google Calendar to automatically sync appointments.
  
  [Connect Google Calendar Button → starts OAuth flow]
  
  Benefits:
  - See appointments on your phone
  - Personal events automatically block appointment slots
  - Two-way sync keeps everything up to date
```

**Functionality**:
- "Connect" starts Google OAuth flow (redirect to Google consent screen)
- After OAuth, show list of available calendars for user to select or create a new one
- "Disconnect" shows confirmation modal (warns that sync will stop but existing events stay)
- "Sync Now" triggers manual full sync
- "Test Connection" verifies OAuth token is valid and API is reachable
- Show connection health status (last sync time, any errors)

---

#### **8. Dashboard Banner Widget**

**Location**: Main dashboard page (homepage after login), top section

**Layout**:
```
[Section: New Appointments (collapsible)]
  ⚡ 2 new appointments booked
  | Quote Visit — John Smith — Mon, Mar 2 at 9:30 AM    [View] [Acknowledge]
  | Quote Visit — Jane Doe — Thu, Mar 5 at 2:00 PM      [View] [Acknowledge]

[Section: Upcoming Appointments]
  📅 Next 5 appointments
  | Quote Visit — John Smith — Mon, Mar 2 at 9:30 AM — 123 Main St
  | Quote Visit — Jane Doe — Thu, Mar 5 at 2:00 PM — 456 Oak Ave
  | Quote Visit — Bob Wilson — Mon, Mar 9 at 8:00 AM — 789 Elm Dr
```

**Functionality**:
- "New Appointments" shows appointments booked since last acknowledgment
- "Acknowledge" marks the appointment as seen (removes from "new" section)
- "View" navigates to the calendar page with that date selected
- "Upcoming" shows the next 5 appointments chronologically
- Each entry shows: type, lead name, date/time, address (truncated)
- Auto-refreshes on page load
- Visible to: Owner, Admin, Estimator

---

## Acceptance Criteria

**Feature is complete when**:

### **Backend (Sprint 11a — Data Model + Availability Engine)**
- [ ] All 6 new database tables created with migrations
- [ ] Tenant table migration adds timezone column
- [ ] Default "Quote Visit" appointment type auto-created on new tenant creation
- [ ] Appointment CRUD endpoints implemented and tested
- [ ] Appointment type + schedule CRUD endpoints implemented and tested
- [ ] Slot calculation engine correctly generates available slots
- [ ] Slot calculation subtracts existing appointments, holidays, and external blocks
- [ ] All Day slot logic works correctly
- [ ] Appointment status transitions enforced with proper validation
- [ ] Cancellation reason required on cancel/no-show transitions
- [ ] Reschedule creates new appointment with rescheduled_from_id link
- [ ] Lead activity logged for all appointment lifecycle events
- [ ] Notifications created for booking/reschedule/cancel
- [ ] Reminder jobs scheduled on booking, cancelled on cancel/reschedule
- [ ] Reminder skip logic works (booked <24h, booked <1h)
- [ ] Multi-tenant isolation verified — tenant A cannot see/modify tenant B's appointments
- [ ] RBAC tests passing for all roles
- [ ] Unit tests >80% coverage on services
- [ ] Integration tests for all endpoints
- [ ] Swagger documentation complete

### **Backend (Sprint 11b — Google Calendar Integration)**
- [ ] Google OAuth flow implemented (auth URL generation, callback, token exchange)
- [ ] Calendar list endpoint returns available calendars after OAuth
- [ ] Calendar connection stored with encrypted tokens
- [ ] Outbound sync: appointment create → Google Calendar event created with rich data
- [ ] Outbound sync: appointment reschedule → Google Calendar event updated
- [ ] Outbound sync: appointment cancel → Google Calendar event deleted
- [ ] Inbound sync: Google push notification received → external blocks created/updated/deleted
- [ ] External blocks store ONLY time data, no personal event details
- [ ] Google Calendar events created by Lead360 are excluded from external blocks
- [ ] Periodic full sync job implemented (every 6 hours)
- [ ] Token refresh logic works (auto-refresh before expiration)
- [ ] Disconnect flow purges external blocks, marks connection inactive
- [ ] Webhook renewal job implemented (renews before Google channel expiration)
- [ ] Calendar sync log records all operations
- [ ] Conflict notification created when delayed webhook reveals overlap with existing appointment
- [ ] Connection health check endpoint working
- [ ] All sync operations run as BullMQ background jobs (non-blocking)

### **Backend (Sprint 11b — Voice AI Tools)**
- [ ] `book_appointment` tool upgraded from placeholder to real booking
- [ ] `reschedule_appointment` tool implemented with identity verification
- [ ] `cancel_appointment` tool implemented with identity verification
- [ ] Phone number verification matches caller to lead record
- [ ] Multiple active appointments handled (Voice AI can ask which one)
- [ ] No-availability fallback creates callback task
- [ ] All three tools return structured responses for Voice AI conversational handling

### **Frontend (Sprint 11c)**
- [ ] Calendar page implemented with week/day views
- [ ] Appointments displayed with status color coding
- [ ] External blocks displayed as "Busy — Blocked (External)"
- [ ] Create Appointment modal with lead autocomplete and dynamic slot dropdown
- [ ] Cancel Appointment modal with reason selection
- [ ] Reschedule flow with new date/slot selection
- [ ] Appointment detail modal with all actions
- [ ] Appointment Type Settings page with weekly schedule grid
- [ ] Calendar Integration Settings page with Google OAuth flow
- [ ] Dashboard banner widget with "New" and "Upcoming" sections
- [ ] Mobile responsive (day view on mobile)
- [ ] Loading/error states handled on all pages
- [ ] Component tests >70% coverage
- [ ] E2E tests for: book appointment, reschedule, cancel, connect Google Calendar

### **Integration**
- [ ] Frontend successfully calls all backend endpoints
- [ ] Google OAuth redirect flow works end-to-end in browser
- [ ] Appointment created in UI appears on Google Calendar within 30 seconds
- [ ] Personal event added in Google Calendar blocks slot in Lead360 within 5 minutes (webhook) or 6 hours (full sync)
- [ ] Voice AI `book_appointment` creates real appointment (not lead_note placeholder)
- [ ] SMS/email reminders delivered at correct times
- [ ] Notifications appear in notification bell
- [ ] Dashboard banner shows correct data

### **Documentation**
- [ ] Backend REST API documentation (100% endpoints) at `api/documentation/calendar_REST_API.md`
- [ ] Google Calendar integration setup guide (for system admin)
- [ ] Voice AI tool documentation updated for new reschedule/cancel tools

---

## Open Questions

All previously open questions have been resolved during the brainstorming phase. No outstanding blockers.

**Resolved decisions log**:

1. ✅ Apple Calendar → deferred (Google Calendar works on iPhones natively)
2. ✅ Per-tenant calendar only for MVP
3. ✅ No public booking page — Voice AI + staff only
4. ✅ External events block slots — stored as time-only blocks ("Busy — Blocked External")
5. ✅ Single appointment type shipped (Quote Visit), architecture supports multiple
6. ✅ Per-tenant timezone field added
7. ✅ Owner/Admin/Estimator RBAC for scheduling management
8. ✅ Google Calendar only for MVP
9. ✅ Fixed slot set: every 15 minutes from 15min–6h + All Day
10. ✅ No buffer between appointments — slot duration includes travel time
11. ✅ Voice AI shows next 14 days of availability, searches up to 8 weeks
12. ✅ Reschedule/cancel via Voice AI with identity verification
13. ✅ Fixed reminders (24h + 1h) with architecture for future configurability
14. ✅ 8 weeks default max lookahead
15. ✅ Cancellation reason required with notification integration and dashboard banner
16. ✅ Race condition policy: book first, human resolves conflicts

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Google Calendar API rate limits during high-volume sync | Slot calculation delays, sync failures | Medium | Batch sync operations, respect quota limits, exponential backoff on retries |
| OAuth token revocation by tenant without notifying system | Silent sync failure, stale external blocks | Medium | Periodic health check (every 6h during full sync), disconnect notification to Owner/Admin, graceful degradation (scheduling works without sync) |
| Timezone edge cases during DST transitions | Appointment at wrong time, missed/duplicate slots on transition days | Low | Use IANA timezone database (not manual offset), explicit DST transition unit tests, store UTC alongside local time |
| Voice AI race condition with real-time availability | Rare double-booking with personal event | Low | Accepted risk per PM decision. System creates conflict notification when overlap detected post-booking. Human resolves. |
| Google webhook delivery delays or failures | External blocks not detected in time, stale availability | Medium | Periodic full sync every 6 hours as fallback, webhook health monitoring, manual sync trigger available |
| Google Cloud project quota or billing issues | OAuth stops working for all tenants | Low | Monitor Google API dashboard, alert system admin on auth failures, document quota requirements in setup guide |
| Slot calculation performance on large date ranges | Slow response on availability endpoint, Voice AI timeout | Low | Index optimization on appointment + external_block tables, limit max query range to max_lookahead_weeks, consider caching for frequently queried date ranges |
| Concurrent booking of same slot (two staff members or Voice AI + staff) | Double-booking | Medium | Final slot validation check inside a database transaction before confirming booking. If slot taken, return error with next available alternatives. |

---

## Timeline Estimate

**Sprint 11a — Data Model + Availability Engine + Voice AI Tools**: 5 backend developers, estimated 8–10 days
- Database migrations + seed data: 2 days
- Appointment type + schedule CRUD: 2 days
- Appointment CRUD + lifecycle transitions: 2 days
- Slot calculation engine: 2 days
- Voice AI tool upgrades (book, reschedule, cancel): 2 days
- Reminder scheduling integration: 1 day
- Notification integration: 1 day
- Testing + documentation: 2 days

**Sprint 11b — Google Calendar Integration**: 5 backend developers, estimated 8–10 days
- Google OAuth flow (auth URL, callback, token exchange): 2 days
- Calendar list + connect/disconnect: 1 day
- Outbound sync (create/update/delete events): 2 days
- Inbound sync (webhook handler + external block management): 2 days
- Periodic full sync job + token refresh: 1 day
- Webhook renewal cron job: 1 day
- Sync logging + health check: 1 day
- Testing + documentation: 2 days

**Sprint 11c — Frontend (Calendar UI + Dashboard + Settings)**: 5 frontend developers, estimated 10–12 days
- Calendar page (week/day view): 3 days
- Appointment modals (create, detail, cancel, reschedule): 3 days
- Appointment Type Settings page: 2 days
- Calendar Integration Settings page (OAuth flow): 2 days
- Dashboard banner widget: 1 day
- Mobile responsiveness: 1 day
- Testing (component + E2E): 2 days

**Total Estimated**: 26–32 development days across three sub-sprints

**Dependencies may affect timeline.** Google Cloud project setup (OAuth credentials) must be completed by system admin before Sprint 11b can begin.

---

## Notes

### Platform-Level Setup Required

Before Sprint 11b (Google Calendar Integration) can proceed, a system administrator must:
1. Create a Google Cloud project (or use existing)
2. Enable the Google Calendar API
3. Configure OAuth consent screen (application name, scopes: `calendar.readonly`, `calendar.events`)
4. Create OAuth 2.0 client credentials (web application type)
5. Configure authorized redirect URI: `https://api.lead360.app/api/v1/calendar/integration/google/callback`
6. Store the client_id and client_secret as platform-level configuration (similar to Twilio system provider setup) — these are shared across all tenants, as every tenant's OAuth flow uses the same Google Cloud project

### Relationship to Existing Voice AI Placeholder

Sprint B06c implemented `createAppointmentFromCall` as a placeholder that creates a `lead_note`. This contract replaces that placeholder with a real appointment entity. The migration path is:
- The `lead_note` placeholder logic in `VoiceAiInternalService.createAppointmentFromCall` must be replaced entirely
- The `executeTool` switch statement in `VoiceAiInternalService` must be updated to route `book_appointment` to the new CalendarService
- Two new tool names must be registered: `reschedule_appointment` and `cancel_appointment`
- The Python Voice AI agent (Sprint A08) `book_appointment.py` action does not need changes — the API contract is the same, but the backend response will now contain real appointment data instead of a note reference

### Provider Registry Extensibility

The `calendar_provider_connection` table uses `provider_type` as a discriminator. For MVP, only `google_calendar` is implemented. When Apple Calendar (CalDAV) or Outlook (Microsoft Graph) support is needed in the future:
1. Add the new provider_type value
2. Implement a provider-specific service behind a common CalendarProviderInterface
3. The token fields and sync patterns may differ per provider — the `calendar_sync_log` and `calendar_external_block` tables are provider-agnostic and require no changes
4. No database migration needed for adding new providers — only new service implementations

### Reminder Architecture

MVP uses fixed reminder schedules (24h + 1h), but the data model is ready for configurability:
- `appointment_type.reminder_24h_enabled` and `reminder_1h_enabled` are boolean flags
- Future: these can be replaced with a `appointment_type_reminder` child table allowing N configurable reminders per type with custom intervals and channels
- The BullMQ job scheduling logic already supports arbitrary future timestamps, so the change is purely in configuration storage and UI, not in the job execution pipeline

---

**End of Feature Contract**

This contract must be approved before development begins.