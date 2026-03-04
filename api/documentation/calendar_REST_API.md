# Calendar & Scheduling Module - Complete REST API Documentation

**Version**: 1.0
**Last Updated**: March 2026
**Base URL**: `https://api.lead360.app/api/v1`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Appointment Types](#appointment-types)
3. [Appointment Type Schedules](#appointment-type-schedules)
4. [Appointments](#appointments)
5. [Appointment Actions](#appointment-actions)
6. [Availability](#availability)
7. [External Blocks](#external-blocks)
8. [Calendar Dashboard](#calendar-dashboard)
9. [Google Calendar Integration](#google-calendar-integration)
10. [Calendar Integration Status](#calendar-integration-status)
11. [Google Calendar Webhooks](#google-calendar-webhooks)
12. [Sync Logs & Health](#sync-logs--health)

---

## Authentication

All endpoints (except Google Calendar Webhook) require JWT authentication.

**Header Required**:
```
Authorization: Bearer <JWT_TOKEN>
```

**RBAC Roles**:
- `Owner` - Full access to all calendar resources
- `Admin` - Administrative access to calendar resources
- `Estimator` - Can view, create, and manage appointments
- `Employee` - Read-only access to appointments
- `PlatformAdmin` - System-wide admin (not used in calendar module)

**Multi-Tenant Isolation**:
All endpoints automatically filter data by the authenticated user's `tenant_id`. Cross-tenant access is strictly prohibited.

---

## Appointment Types

Appointment types define the configuration for different types of appointments (e.g., "Quote Visit", "Follow-up Call"). Each type has its own schedule, duration, and reminder settings.

### Create Appointment Type

**Endpoint**: `POST /calendar/appointment-types`
**RBAC**: `Owner`, `Admin`

**Request Body**:
```json
{
  "name": "Quote Visit",
  "description": "Schedule a quote visit with the customer to assess the job",
  "slot_duration_minutes": 90,
  "max_lookahead_weeks": 8,
  "reminder_24h_enabled": true,
  "reminder_1h_enabled": true,
  "is_default": false,
  "is_active": true
}
```

**Field Validation**:
- `name`: string (1-100 chars), **required**
- `description`: string (0-500 chars), optional
- `slot_duration_minutes`: integer (15-480), optional, default: 60
- `max_lookahead_weeks`: integer (1-52), optional, default: 8
- `reminder_24h_enabled`: boolean, optional, default: true
- `reminder_1h_enabled`: boolean, optional, default: true
- `is_default`: boolean, optional, default: false (automatically unsets previous default)
- `is_active`: boolean, optional, default: true

**Response**: `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "name": "Quote Visit",
  "description": "Schedule a quote visit with the customer to assess the job",
  "slot_duration_minutes": 90,
  "max_lookahead_weeks": 8,
  "reminder_24h_enabled": true,
  "reminder_1h_enabled": true,
  "is_default": false,
  "is_active": true,
  "created_at": "2026-03-03T10:00:00Z",
  "updated_at": "2026-03-03T10:00:00Z",
  "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid data or validation error
- `403 Forbidden` - Requires Owner or Admin role

---

### List Appointment Types

**Endpoint**: `GET /calendar/appointment-types`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Query Parameters**:
- `page` (number, default: 1, min: 1) - Page number
- `limit` (number, default: 20, min: 1, max: 100) - Items per page
- `is_active` (boolean, optional) - Filter by active status
- `is_default` (boolean, optional) - Filter by default status
- `search` (string, optional) - Search by name (partial match)
- `sort_by` (string, default: "created_at") - Sort field: `name`, `created_at`, `updated_at`
- `sort_order` (enum, default: "desc") - Sort direction: `asc`, `desc`

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Quote Visit",
      "description": "Schedule a quote visit with the customer to assess the job",
      "slot_duration_minutes": 90,
      "max_lookahead_weeks": 8,
      "reminder_24h_enabled": true,
      "reminder_1h_enabled": true,
      "is_default": true,
      "is_active": true,
      "created_at": "2026-03-03T10:00:00Z",
      "updated_at": "2026-03-03T10:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 5,
    "total_pages": 1
  }
}
```

---

### Get Appointment Type

**Endpoint**: `GET /calendar/appointment-types/:id`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `id` (UUID, required) - Appointment Type UUID

**Response**: `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "name": "Quote Visit",
  "description": "Schedule a quote visit with the customer to assess the job",
  "slot_duration_minutes": 90,
  "max_lookahead_weeks": 8,
  "reminder_24h_enabled": true,
  "reminder_1h_enabled": true,
  "is_default": true,
  "is_active": true,
  "created_at": "2026-03-03T10:00:00Z",
  "updated_at": "2026-03-03T10:00:00Z",
  "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
  "schedules": [
    {
      "id": "850e8400-e29b-41d4-a716-446655440003",
      "day_of_week": 1,
      "is_available": true,
      "window1_start": "09:00",
      "window1_end": "12:00",
      "window2_start": "13:00",
      "window2_end": "17:00"
    }
  ]
}
```

**Error Responses**:
- `404 Not Found` - Appointment type not found

---

### Update Appointment Type

**Endpoint**: `PATCH /calendar/appointment-types/:id`
**RBAC**: `Owner`, `Admin`

**Path Parameters**:
- `id` (UUID, required) - Appointment Type UUID

**Request Body** (all fields optional):
```json
{
  "name": "Updated Quote Visit",
  "description": "Updated description",
  "slot_duration_minutes": 120,
  "max_lookahead_weeks": 12,
  "reminder_24h_enabled": false,
  "is_default": true
}
```

**Response**: `200 OK` (same structure as Get Appointment Type)

**Error Responses**:
- `404 Not Found` - Appointment type not found
- `403 Forbidden` - Requires Owner or Admin role

---

### Delete Appointment Type (Soft Delete)

**Endpoint**: `DELETE /calendar/appointment-types/:id`
**RBAC**: `Owner`, `Admin`

**Path Parameters**:
- `id` (UUID, required) - Appointment Type UUID

**Response**: `204 No Content`

**Error Responses**:
- `400 Bad Request` - Cannot deactivate - active appointments exist
- `404 Not Found` - Appointment type not found
- `403 Forbidden` - Requires Owner or Admin role

**Notes**:
- This is a soft delete (sets `is_active = false`)
- Prevents deletion if there are active appointments using this type
- Recommended for normal operations to preserve historical data

---

### Hard Delete Appointment Type (PERMANENT)

**Endpoint**: `DELETE /calendar/appointment-types/:id/permanent`
**RBAC**: `Owner` (only)

**Path Parameters**:
- `id` (UUID, required) - Appointment Type UUID

**Response**: `204 No Content`

**Error Responses**:
- `400 Bad Request` - Cannot delete - appointments exist in history (active or completed)
- `404 Not Found` - Appointment type not found
- `403 Forbidden` - Requires Owner role only

**Notes**:
- ⚠️ **DESTRUCTIVE OPERATION** - This permanently removes the record from the database
- Cannot be undone
- Prevents deletion if there are ANY appointments (active or historical) associated with this type
- More restrictive than soft delete (Owner role only)
- Audit logged before deletion
- Use soft delete (deactivate) for normal operations

---

## Appointment Type Schedules

Defines the weekly availability schedule for an appointment type. Each appointment type has 7 schedule entries (one for each day of the week).

### Get Weekly Schedule

**Endpoint**: `GET /calendar/appointment-types/:typeId/schedule`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `typeId` (UUID, required) - Appointment Type ID

**Response**: `200 OK`
```json
[
  {
    "id": "850e8400-e29b-41d4-a716-446655440003",
    "appointment_type_id": "550e8400-e29b-41d4-a716-446655440000",
    "day_of_week": 0,
    "is_available": false,
    "window1_start": null,
    "window1_end": null,
    "window2_start": null,
    "window2_end": null,
    "created_at": "2026-03-03T10:00:00Z",
    "updated_at": "2026-03-03T10:00:00Z"
  },
  {
    "id": "850e8400-e29b-41d4-a716-446655440004",
    "appointment_type_id": "550e8400-e29b-41d4-a716-446655440000",
    "day_of_week": 1,
    "is_available": true,
    "window1_start": "09:00",
    "window1_end": "12:00",
    "window2_start": "13:00",
    "window2_end": "17:00",
    "created_at": "2026-03-03T10:00:00Z",
    "updated_at": "2026-03-03T10:00:00Z"
  }
]
```

**Field Descriptions**:
- `day_of_week`: Integer (0=Sunday, 1=Monday, ..., 6=Saturday)
- `is_available`: Whether appointments can be booked on this day
- `window1_start`, `window1_end`: First availability window (HH:mm format)
- `window2_start`, `window2_end`: Second availability window (HH:mm format)

**Error Responses**:
- `404 Not Found` - Appointment type not found

---

### Bulk Update Weekly Schedule

**Endpoint**: `PUT /calendar/appointment-types/:typeId/schedule`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `typeId` (UUID, required) - Appointment Type ID

**Request Body**:
```json
{
  "schedules": [
    {
      "day_of_week": 0,
      "is_available": false,
      "window1_start": null,
      "window1_end": null,
      "window2_start": null,
      "window2_end": null
    },
    {
      "day_of_week": 1,
      "is_available": true,
      "window1_start": "09:00",
      "window1_end": "12:00",
      "window2_start": "13:00",
      "window2_end": "17:00"
    },
    {
      "day_of_week": 2,
      "is_available": true,
      "window1_start": "09:00",
      "window1_end": "17:00",
      "window2_start": null,
      "window2_end": null
    }
  ]
}
```

**Field Validation**:
- `schedules`: array of exactly 7 schedule objects, **required**
- Each schedule object:
  - `day_of_week`: integer (0-6), **required**
  - `is_available`: boolean, **required**
  - `window1_start`, `window1_end`: string (HH:mm format), required if `is_available = true`
  - `window2_start`, `window2_end`: string (HH:mm format), optional

**Response**: `200 OK` (returns updated schedules array)

**Error Responses**:
- `400 Bad Request` - Invalid data (must provide exactly 7 schedules)
- `404 Not Found` - Appointment type not found
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

---

### Update Single Day Schedule

**Endpoint**: `PATCH /calendar/appointment-types/:typeId/schedule/:dayOfWeek`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `typeId` (UUID, required) - Appointment Type ID
- `dayOfWeek` (integer, required) - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)

**Request Body**:
```json
{
  "is_available": true,
  "window1_start": "08:00",
  "window1_end": "12:00",
  "window2_start": "13:00",
  "window2_end": "18:00"
}
```

**Response**: `200 OK` (returns updated schedule object)

**Error Responses**:
- `400 Bad Request` - Invalid data or validation error
- `404 Not Found` - Appointment type not found
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

---

## Appointments

Core appointment management endpoints for creating, viewing, and updating appointments.

### Create Appointment

**Endpoint**: `POST /calendar/appointments`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Request Body**:
```json
{
  "appointment_type_id": "550e8400-e29b-41d4-a716-446655440000",
  "lead_id": "650e8400-e29b-41d4-a716-446655440001",
  "service_request_id": "750e8400-e29b-41d4-a716-446655440002",
  "scheduled_date": "2026-03-15",
  "start_time": "09:00",
  "end_time": "10:30",
  "notes": "Customer prefers morning appointments",
  "assigned_user_id": "850e8400-e29b-41d4-a716-446655440003",
  "source": "manual"
}
```

**Field Validation**:
- `appointment_type_id`: UUID, **required**
- `lead_id`: UUID, **required**
- `service_request_id`: UUID, optional
- `scheduled_date`: string (YYYY-MM-DD), **required**
- `start_time`: string (HH:mm, 24-hour format), **required**
- `end_time`: string (HH:mm, 24-hour format), **required**
- `notes`: string (0-2000 chars), optional
- `assigned_user_id`: UUID, optional
- `source`: enum (`voice_ai`, `manual`, `system`), optional, default: `manual`

**Response**: `201 Created`
```json
{
  "id": "950e8400-e29b-41d4-a716-446655440004",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "appointment_type_id": "550e8400-e29b-41d4-a716-446655440000",
  "lead_id": "650e8400-e29b-41d4-a716-446655440001",
  "service_request_id": "750e8400-e29b-41d4-a716-446655440002",
  "scheduled_date": "2026-03-15",
  "start_time": "09:00",
  "end_time": "10:30",
  "start_datetime_utc": "2026-03-15T14:00:00Z",
  "end_datetime_utc": "2026-03-15T15:30:00Z",
  "status": "scheduled",
  "notes": "Customer prefers morning appointments",
  "assigned_user_id": "850e8400-e29b-41d4-a716-446655440003",
  "source": "manual",
  "acknowledged_at": null,
  "created_at": "2026-03-03T10:00:00Z",
  "updated_at": "2026-03-03T10:00:00Z",
  "created_by_user_id": "850e8400-e29b-41d4-a716-446655440003"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid data or validation error
- `404 Not Found` - Lead, appointment type, or service request not found
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

---

### List Appointments

**Endpoint**: `GET /calendar/appointments`
**RBAC**: `Owner`, `Admin`, `Estimator`, `Employee`

**Query Parameters**:
- `page` (number, default: 1) - Page number
- `limit` (number, default: 50, max: 100) - Items per page
- `status` (enum, optional) - Filter by status: `scheduled`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`
- `lead_id` (UUID, optional) - Filter by lead ID
- `date_from` (string YYYY-MM-DD, optional) - Filter appointments from this date
- `date_to` (string YYYY-MM-DD, optional) - Filter appointments up to this date
- `sort_by` (string, default: "scheduled_date") - Sort field: `scheduled_date`, `created_at`, `updated_at`
- `sort_order` (enum, default: "asc") - Sort direction: `asc`, `desc`

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "950e8400-e29b-41d4-a716-446655440004",
      "appointment_type": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Quote Visit"
      },
      "lead": {
        "id": "650e8400-e29b-41d4-a716-446655440001",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "phone": "555-123-4567"
      },
      "scheduled_date": "2026-03-15",
      "start_time": "09:00",
      "end_time": "10:30",
      "status": "scheduled",
      "notes": "Customer prefers morning appointments",
      "assigned_user": {
        "id": "850e8400-e29b-41d4-a716-446655440003",
        "first_name": "Jane",
        "last_name": "Smith"
      },
      "created_at": "2026-03-03T10:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 50,
    "total": 125,
    "total_pages": 3
  }
}
```

---

### Get Appointment

**Endpoint**: `GET /calendar/appointments/:id`
**RBAC**: `Owner`, `Admin`, `Estimator`, `Employee`

**Path Parameters**:
- `id` (UUID, required) - Appointment UUID

**Response**: `200 OK`
```json
{
  "id": "950e8400-e29b-41d4-a716-446655440004",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "appointment_type": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Quote Visit",
    "slot_duration_minutes": 90
  },
  "lead": {
    "id": "650e8400-e29b-41d4-a716-446655440001",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "555-123-4567",
    "company_name": "Doe Enterprises"
  },
  "service_request": {
    "id": "750e8400-e29b-41d4-a716-446655440002",
    "service_type": "Quote Request",
    "status": "scheduled"
  },
  "scheduled_date": "2026-03-15",
  "start_time": "09:00",
  "end_time": "10:30",
  "start_datetime_utc": "2026-03-15T14:00:00Z",
  "end_datetime_utc": "2026-03-15T15:30:00Z",
  "status": "scheduled",
  "notes": "Customer prefers morning appointments",
  "assigned_user": {
    "id": "850e8400-e29b-41d4-a716-446655440003",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com"
  },
  "source": "manual",
  "acknowledged_at": null,
  "created_at": "2026-03-03T10:00:00Z",
  "updated_at": "2026-03-03T10:00:00Z",
  "created_by_user_id": "850e8400-e29b-41d4-a716-446655440003"
}
```

**Error Responses**:
- `404 Not Found` - Appointment not found

---

### Update Appointment

**Endpoint**: `PATCH /calendar/appointments/:id`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `id` (UUID, required) - Appointment UUID

**Request Body** (all fields optional):
```json
{
  "notes": "Updated appointment notes",
  "assigned_user_id": "850e8400-e29b-41d4-a716-446655440005"
}
```

**Field Validation**:
- `notes`: string (0-2000 chars), optional
- `assigned_user_id`: UUID, optional

**Response**: `200 OK` (same structure as Get Appointment)

**Error Responses**:
- `404 Not Found` - Appointment not found
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

**Notes**:
- Sprint 05a only supports updating `notes` and `assigned_user_id`
- For changing appointment date/time, use the Reschedule endpoint
- For changing status, use the Appointment Actions endpoints

---

## Appointment Actions

Dedicated endpoints for appointment lifecycle state transitions. All actions enforce state machine rules.

### Confirm Appointment

**Endpoint**: `POST /calendar/appointments/:id/confirm`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `id` (UUID, required) - Appointment UUID

**Request Body**:
```json
{
  "notes": "Confirmed with customer via phone"
}
```

**Field Validation**:
- `notes`: string (0-500 chars), optional

**Response**: `200 OK`
```json
{
  "id": "950e8400-e29b-41d4-a716-446655440004",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "appointment_type_id": "550e8400-e29b-41d4-a716-446655440000",
  "lead_id": "650e8400-e29b-41d4-a716-446655440001",
  "scheduled_date": "2026-03-15",
  "start_time": "09:00",
  "end_time": "10:30",
  "status": "confirmed",
  "notes": "Customer prefers morning appointments\n[Confirmation] Confirmed with customer via phone",
  "created_at": "2026-03-03T10:00:00Z",
  "updated_at": "2026-03-03T11:00:00Z"
}
```

**Notes**:
- `notes` from request is appended to existing `notes` field with `[Confirmation]` prefix
- Response includes full appointment object with all related data

**Error Responses**:
- `400 Bad Request` - Invalid transition (e.g., appointment already confirmed or in terminal state)
- `404 Not Found` - Appointment not found
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

**State Transition Rules**:
- Can only confirm appointments in `scheduled` status
- Terminal states (`completed`, `cancelled`, `no_show`) cannot be confirmed

---

### Cancel Appointment

**Endpoint**: `POST /calendar/appointments/:id/cancel`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `id` (UUID, required) - Appointment UUID

**Request Body**:
```json
{
  "cancellation_reason": "customer_cancelled",
  "cancellation_notes": "Customer needs to reschedule due to conflict"
}
```

**Field Validation**:
- `cancellation_reason`: enum (`customer_cancelled`, `business_cancelled`, `no_show`, `rescheduled`, `other`), **required**
- `cancellation_notes`: string (0-1000 chars), optional (required if `cancellation_reason = "other"`)

**Response**: `200 OK`
```json
{
  "id": "950e8400-e29b-41d4-a716-446655440004",
  "status": "cancelled",
  "cancellation_reason": "customer_cancelled",
  "cancellation_notes": "Customer needs to reschedule due to conflict",
  "cancelled_at": "2026-03-03T11:30:00Z",
  "cancelled_by_user_id": "850e8400-e29b-41d4-a716-446655440003",
  "updated_at": "2026-03-03T11:30:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid transition or missing required fields
- `404 Not Found` - Appointment not found
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

**State Transition Rules**:
- Can only cancel appointments in `scheduled` or `confirmed` status
- Terminal states (`completed`, `cancelled`, `no_show`) cannot be cancelled
- Linked service_request status updated to `new`

---

### Reschedule Appointment

**Endpoint**: `POST /calendar/appointments/:id/reschedule`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `id` (UUID, required) - Appointment UUID to reschedule

**Request Body**:
```json
{
  "new_scheduled_date": "2026-03-20",
  "new_start_time": "14:00",
  "reason": "Customer requested afternoon slot"
}
```

**Field Validation**:
- `new_scheduled_date`: string (YYYY-MM-DD), **required**
- `new_start_time`: string (HH:mm, 24-hour format), **required**
- `reason`: string (0-500 chars), optional

**Response**: `200 OK` (returns BOTH old and new appointments)
```json
{
  "oldAppointment": {
    "id": "950e8400-e29b-41d4-a716-446655440004",
    "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
    "appointment_type_id": "550e8400-e29b-41d4-a716-446655440000",
    "lead_id": "650e8400-e29b-41d4-a716-446655440001",
    "scheduled_date": "2026-03-15",
    "start_time": "09:00",
    "end_time": "10:30",
    "status": "rescheduled",
    "notes": "Rescheduled to 2026-03-20 14:00. Reason: Customer requested afternoon slot",
    "created_at": "2026-03-03T10:00:00Z",
    "updated_at": "2026-03-03T12:00:00Z"
  },
  "newAppointment": {
    "id": "a50e8400-e29b-41d4-a716-446655440006",
    "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
    "appointment_type_id": "550e8400-e29b-41d4-a716-446655440000",
    "lead_id": "650e8400-e29b-41d4-a716-446655440001",
    "scheduled_date": "2026-03-20",
    "start_time": "14:00",
    "end_time": "15:30",
    "status": "scheduled",
    "rescheduled_from_id": "950e8400-e29b-41d4-a716-446655440004",
    "notes": null,
    "created_at": "2026-03-03T12:00:00Z",
    "updated_at": "2026-03-03T12:00:00Z"
  }
}
```

**Notes**:
- Response contains BOTH `oldAppointment` (marked as rescheduled) and `newAppointment` (the new scheduled appointment)
- Old appointment notes are updated with reschedule information including reason
- New appointment links to old via `rescheduled_from_id`
- `reason` from request is stored in old appointment's `notes` field

**Error Responses**:
- `400 Bad Request` - Invalid transition or date in the past
- `404 Not Found` - Appointment not found
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

**State Transition Rules**:
- Can only reschedule appointments in `scheduled` or `confirmed` status
- Old appointment status set to `rescheduled` (terminal state)
- New appointment created with status `scheduled`
- New appointment links back via `rescheduled_from_id`

---

### Complete Appointment

**Endpoint**: `POST /calendar/appointments/:id/complete`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `id` (UUID, required) - Appointment UUID

**Request Body**:
```json
{
  "completion_notes": "Quote visit completed successfully. Customer ready for proposal."
}
```

**Field Validation**:
- `completion_notes`: string (0-2000 chars), optional

**Response**: `200 OK`
```json
{
  "id": "950e8400-e29b-41d4-a716-446655440004",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "appointment_type_id": "550e8400-e29b-41d4-a716-446655440000",
  "lead_id": "650e8400-e29b-41d4-a716-446655440001",
  "scheduled_date": "2026-03-15",
  "start_time": "09:00",
  "end_time": "10:30",
  "status": "completed",
  "notes": "Customer prefers morning appointments\n[Completed] Quote visit completed successfully. Customer ready for proposal.",
  "completed_at": "2026-03-15T10:30:00Z",
  "updated_at": "2026-03-15T10:30:00Z",
  "created_at": "2026-03-03T10:00:00Z"
}
```

**Notes**:
- `completion_notes` from request is appended to existing `notes` field with `[Completed]` prefix
- Response includes full appointment object with all related data

**Error Responses**:
- `400 Bad Request` - Invalid transition (e.g., appointment already in terminal state)
- `404 Not Found` - Appointment not found
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

**State Transition Rules**:
- Can only complete appointments in `scheduled` or `confirmed` status
- This is a terminal state - no further changes allowed

---

### Mark as No-Show

**Endpoint**: `POST /calendar/appointments/:id/no-show`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `id` (UUID, required) - Appointment UUID

**Request Body**:
```json
{
  "notes": "Customer did not arrive at scheduled time. Attempted contact via phone - no answer."
}
```

**Field Validation**:
- `notes`: string (0-1000 chars), optional

**Response**: `200 OK`
```json
{
  "id": "950e8400-e29b-41d4-a716-446655440004",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "appointment_type_id": "550e8400-e29b-41d4-a716-446655440000",
  "lead_id": "650e8400-e29b-41d4-a716-446655440001",
  "scheduled_date": "2026-03-15",
  "start_time": "09:00",
  "end_time": "10:30",
  "status": "no_show",
  "cancellation_reason": "no_show",
  "cancellation_notes": "Customer did not arrive at scheduled time. Attempted contact via phone - no answer.",
  "cancelled_at": "2026-03-15T09:30:00Z",
  "cancelled_by_user_id": "850e8400-e29b-41d4-a716-446655440003",
  "updated_at": "2026-03-15T09:30:00Z",
  "created_at": "2026-03-03T10:00:00Z"
}
```

**Notes**:
- `notes` from request is stored in `cancellation_notes` field
- `cancellation_reason` is automatically set to `no_show`
- Response includes full appointment object with all related data

**Error Responses**:
- `400 Bad Request` - Invalid transition (e.g., appointment already in terminal state)
- `404 Not Found` - Appointment not found
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

**State Transition Rules**:
- Can only mark as no-show appointments in `scheduled` or `confirmed` status
- Terminal state - no further changes allowed
- Linked service_request status updated to `new`

---

## Availability

Calculate and retrieve available appointment time slots based on appointment type schedules and existing bookings.

### Get Available Slots

**Endpoint**: `GET /calendar/availability`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Query Parameters**:
- `appointment_type_id` (UUID, **required**) - Appointment type ID to check availability for
- `date_from` (string YYYY-MM-DD, **required**) - Start of date range
- `date_to` (string YYYY-MM-DD, **required**) - End of date range (max span determined by `max_lookahead_weeks`)

**Response**: `200 OK`
```json
{
  "appointment_type": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Quote Visit",
    "slot_duration_minutes": 90
  },
  "timezone": "America/New_York",
  "date_range": {
    "from": "2026-03-02",
    "to": "2026-03-16"
  },
  "available_dates": [
    {
      "date": "2026-03-02",
      "day_name": "Monday",
      "slots": [
        {
          "start_time": "08:00",
          "end_time": "09:30"
        },
        {
          "start_time": "09:30",
          "end_time": "11:00"
        },
        {
          "start_time": "13:00",
          "end_time": "14:30"
        }
      ]
    },
    {
      "date": "2026-03-05",
      "day_name": "Thursday",
      "slots": [
        {
          "start_time": "08:00",
          "end_time": "09:30"
        },
        {
          "start_time": "09:30",
          "end_time": "11:00"
        }
      ]
    }
  ],
  "total_available_slots": 5
}
```

**Error Responses**:
- `400 Bad Request` - Invalid query parameters (invalid UUID, invalid date format, date range exceeds `max_lookahead_weeks`)
- `404 Not Found` - Appointment type not found or is not active
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

**Notes**:
- Generates slots based on appointment type schedule
- Subtracts existing appointments (`scheduled` or `confirmed` status)
- Returns ordered list of available slots grouped by date
- Used by both UI and Voice AI for appointment booking
- Timezone is tenant's timezone setting

---

## External Blocks

Retrieve external calendar blocks (from Google Calendar integration) for visual display on the calendar UI. These blocks represent busy times from external calendars and are displayed as "Busy — Blocked (External)" indicators.

**Note**: External blocks are already factored into availability calculation (see `/calendar/availability` endpoint). This endpoint is solely for visual display purposes.

### Get External Blocks

**Endpoint**: `GET /calendar/external-blocks`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Query Parameters**:
- `date_from` (string YYYY-MM-DD, **required**) - Start of date range
- `date_to` (string YYYY-MM-DD, **required**) - End of date range
- `appointment_type_id` (UUID, optional) - Reserved for future filtering (currently not used)

**Response**: `200 OK`
```json
{
  "date_range": {
    "from": "2026-03-02",
    "to": "2026-03-16"
  },
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "start_datetime_utc": "2026-03-15T14:00:00.000Z",
      "end_datetime_utc": "2026-03-15T15:30:00.000Z",
      "is_all_day": false,
      "source": "google_calendar"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "start_datetime_utc": "2026-03-10T00:00:00.000Z",
      "end_datetime_utc": "2026-03-11T00:00:00.000Z",
      "is_all_day": true,
      "source": "google_calendar"
    }
  ],
  "total_blocks": 2
}
```

**Field Descriptions**:
- `id`: Unique identifier for the external block
- `start_datetime_utc`: Block start time in UTC (ISO 8601 format)
- `end_datetime_utc`: Block end time in UTC (ISO 8601 format)
- `is_all_day`: Boolean indicating if this is an all-day event
- `source`: Source of the block (currently always `google_calendar`)

**Error Responses**:
- `400 Bad Request` - Invalid query parameters (invalid date format)
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

**Notes**:
- Returns all external calendar blocks that overlap with the specified date range
- Blocks are returned in ascending order by start time
- Times are in UTC - frontend must convert to local timezone for display
- Only returns blocks for the authenticated user's tenant (multi-tenant isolation enforced)
- External blocks from Lead360-created appointments are NOT included (filtered during sync)

**Use Cases**:
- Sprint 31: Display "Busy — Blocked (External)" indicators on calendar UI
- Show user when external calendar has conflicts with Lead360 availability
- Visual representation of Google Calendar integration status

---

## Calendar Dashboard

Dashboard helper endpoints for displaying upcoming and new appointments in the UI.

### Get Upcoming Appointments

**Endpoint**: `GET /calendar/dashboard/upcoming`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Query Parameters**:
- `limit` (number, default: 5, max: 50) - Number of upcoming appointments to return

**Response**: `200 OK`
```json
{
  "items": [
    {
      "id": "950e8400-e29b-41d4-a716-446655440004",
      "appointment_type_name": "Quote Visit",
      "lead_first_name": "John",
      "lead_last_name": "Doe",
      "scheduled_date": "2026-03-05",
      "start_time": "09:00",
      "end_time": "10:30",
      "address": "123 Main St",
      "status": "confirmed"
    }
  ],
  "count": 5
}
```

**Notes**:
- Returns next N appointments in chronological order
- Only includes `scheduled` or `confirmed` status appointments
- Used for dashboard banner/widget

---

### Get New Appointments

**Endpoint**: `GET /calendar/dashboard/new`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Query Parameters**:
- `limit` (number, default: 10, max: 50) - Number of new appointments to return

**Response**: `200 OK`
```json
{
  "items": [
    {
      "id": "a50e8400-e29b-41d4-a716-446655440006",
      "appointment_type_name": "Quote Visit",
      "lead_first_name": "John",
      "lead_last_name": "Doe",
      "scheduled_date": "2026-03-12",
      "start_time": "14:00",
      "end_time": "15:30",
      "source": "voice_ai",
      "created_at": "2026-03-03T12:30:00Z",
      "status": "scheduled"
    }
  ],
  "count": 3
}
```

**Notes**:
- Returns appointments that have not been acknowledged yet (`acknowledged_at IS NULL`)
- Ordered by creation date DESC (newest first)
- Used to notify users of new bookings (especially from Voice AI)

---

### Acknowledge New Appointment

**Endpoint**: `PATCH /calendar/dashboard/new/:id/acknowledge`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Path Parameters**:
- `id` (UUID, required) - Appointment ID

**Response**: `200 OK`
```json
{
  "message": "Appointment acknowledged successfully",
  "appointment_id": "a50e8400-e29b-41d4-a716-446655440006",
  "acknowledged_at": "2026-03-03T13:00:00Z"
}
```

**Error Responses**:
- `404 Not Found` - Appointment not found or access denied
- `403 Forbidden` - Requires Owner, Admin, or Estimator role

**Notes**:
- Sets `acknowledged_at` timestamp to mark that the appointment has been seen
- Removes appointment from "new" list

---

## Google Calendar Integration

OAuth flow and calendar connection management endpoints for Google Calendar integration.

### Generate OAuth Authorization URL

**Endpoint**: `GET /calendar/integration/google/auth-url`
**RBAC**: `Owner`, `Admin`

**Response**: `200 OK`
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=https://api.lead360.app/api/v1/calendar/integration/google/callback&response_type=code&scope=https://www.googleapis.com/auth/calendar.readonly%20https://www.googleapis.com/auth/calendar.events&state=550e8400-e29b-41d4-a716-446655440000&access_type=offline&prompt=consent",
  "state": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Field Descriptions**:
- `authUrl`: Google OAuth consent screen URL (user must visit this URL to authorize)
- `state`: CSRF protection token (stored in session for verification in callback)

**Error Responses**:
- `401 Unauthorized` - JWT missing or invalid
- `403 Forbidden` - Insufficient permissions

**Notes**:
- Step 1 of OAuth flow
- State parameter stored in session for CSRF validation
- User redirected to Google consent screen

---

### OAuth Callback Handler

**Endpoint**: `GET /calendar/integration/google/callback`
**RBAC**: Public (no JWT required)

**Query Parameters**:
- `code` (string, **required**) - Authorization code from Google
- `state` (string, **required**) - State parameter for CSRF validation
- `error` (string, optional) - Error code if OAuth failed (e.g., `access_denied`)

**Response**: Redirect to frontend
- Success: Redirects to `{APP_URL}/settings/calendar/select-calendar`
- Error: Redirects to `{APP_URL}/settings/calendar?error={error_code}`

**Error Codes**:
- `access_denied` - User denied access
- `session_expired` - OAuth state not found in session
- `invalid_state` - State parameter mismatch (possible CSRF attack)
- `token_exchange_failed` - Failed to exchange code for tokens

**Notes**:
- Step 2 of OAuth flow
- Validates state parameter against session (CSRF protection)
- Exchanges authorization code for access/refresh tokens
- Stores tokens temporarily in session for calendar selection
- Redirects to frontend calendar selection page

---

### List Available Google Calendars

**Endpoint**: `GET /calendar/integration/google/calendars`
**RBAC**: `Owner`, `Admin`

**Response**: `200 OK`
```json
{
  "calendars": [
    {
      "id": "primary",
      "summary": "My Calendar",
      "description": "Personal calendar",
      "primary": true,
      "timeZone": "America/New_York",
      "backgroundColor": "#9fe1e7"
    },
    {
      "id": "work@example.com",
      "summary": "Work Calendar",
      "description": null,
      "primary": false,
      "timeZone": "America/New_York",
      "backgroundColor": "#d06b64"
    }
  ],
  "total": 2
}
```

**Error Responses**:
- `401 Unauthorized` - Session tokens missing (user must complete OAuth flow first)
- `403 Forbidden` - Insufficient permissions

**Notes**:
- Step 3 of OAuth flow
- Requires valid OAuth tokens in session (from callback)
- User selects which calendar to connect

---

### Finalize Calendar Connection

**Endpoint**: `POST /calendar/integration/google/connect`
**RBAC**: `Owner`, `Admin`

**Request Body**:
```json
{
  "calendarId": "primary",
  "calendarName": "My Calendar"
}
```

**Field Validation**:
- `calendarId`: string, **required** - Google Calendar ID
- `calendarName`: string, optional (auto-fetched if not provided)

**Response**: `201 Created`
```json
{
  "id": "b50e8400-e29b-41d4-a716-446655440007",
  "status": "success",
  "message": "Google Calendar connected successfully.",
  "connectedCalendarId": "primary",
  "connectedCalendarName": "My Calendar",
  "providerType": "google_calendar"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid calendar ID or connection already exists
- `401 Unauthorized` - Session tokens missing
- `409 Conflict` - Connection already exists (disconnect first)

**Notes**:
- Step 4 of OAuth flow (final step)
- Creates webhook subscription for push notifications
- Saves connection to database with encrypted tokens
- Clears session tokens after successful connection

---

### Disconnect Google Calendar

**Endpoint**: `DELETE /calendar/integration/google/disconnect`
**RBAC**: `Owner`, `Admin`

**Response**: `200 OK`
```json
{
  "status": "success",
  "message": "Google Calendar disconnected successfully."
}
```

**Error Responses**:
- `401 Unauthorized` - JWT missing or invalid
- `404 Not Found` - Connection not found

**Notes**:
- Revokes OAuth tokens with Google
- Stops webhook channel
- Deactivates connection record
- Deletes all external calendar blocks

---

### Trigger Manual Sync

**Endpoint**: `POST /calendar/integration/google/sync`
**RBAC**: `Owner`, `Admin`

**Response**: `200 OK`
```json
{
  "status": "success",
  "message": "Manual sync has been queued. This may take a few moments. External calendar blocks will update shortly."
}
```

**Error Responses**:
- `401 Unauthorized` - JWT missing or invalid
- `404 Not Found` - Connection not found

**Notes**:
- Queues a background job to sync all events
- Sync happens asynchronously in BullMQ
- Used for manual refresh of external calendar blocks

---

### Test Calendar Connection

**Endpoint**: `POST /calendar/integration/google/test`
**RBAC**: `Owner`, `Admin`

**Response**: `200 OK`
```json
{
  "status": "success",
  "message": "Connection is healthy. Successfully retrieved calendar metadata.",
  "details": {
    "calendarId": "primary",
    "calendarName": "My Calendar",
    "timeZone": "America/New_York"
  }
}
```

**Error Responses**:
- `401 Unauthorized` - JWT missing or invalid
- `404 Not Found` - Connection not found
- `503 Service Unavailable` - Connection test failed (tokens revoked or calendar deleted)

**Notes**:
- Verifies OAuth tokens are valid
- Makes test API call to Google Calendar
- Refreshes access token if expired
- Updates sync status to `error` if test fails

---

## Calendar Integration Status

Generic calendar integration status endpoint (works for any provider).

### Get Connection Status

**Endpoint**: `GET /calendar/integration/status`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Response**: `200 OK` (when connected)
```json
{
  "connected": true,
  "providerType": "google_calendar",
  "connectedCalendarId": "primary",
  "connectedCalendarName": "My Calendar",
  "syncStatus": "active",
  "lastSyncAt": "2026-03-03T10:30:00Z",
  "errorMessage": null,
  "createdAt": "2026-03-01T15:30:00Z"
}
```

**Response**: `200 OK` (when not connected)
```json
{
  "connected": false
}
```

**Field Descriptions**:
- `connected`: boolean - Whether a calendar is connected
- `providerType`: string - Provider type (`google_calendar`, future: `microsoft_365`, `apple`)
- `connectedCalendarId`: string - Provider's calendar ID
- `connectedCalendarName`: string - Calendar display name
- `syncStatus`: enum (`active`, `syncing`, `error`, `disconnected`) - Current sync health
- `lastSyncAt`: string (ISO 8601) - Last successful sync timestamp
- `errorMessage`: string - Error message if sync status is `error`
- `createdAt`: string (ISO 8601) - Connection creation timestamp

**Error Responses**:
- `401 Unauthorized` - JWT missing or invalid

**Notes**:
- Used by frontend to display connection status
- Returns `connected: false` if no active connection exists

---

## Google Calendar Webhooks

Public webhook endpoint for receiving Google Calendar push notifications. This endpoint does NOT require JWT authentication but verifies webhook channel tokens.

### Receive Google Calendar Push Notifications

**Endpoint**: `POST /webhooks/google-calendar`
**RBAC**: Public (no JWT required)

**Required Headers**:
- `X-Goog-Channel-ID`: string - Google Channel ID
- `X-Goog-Channel-Token`: string - Verification token
- `X-Goog-Resource-ID`: string - Google Resource ID
- `X-Goog-Resource-State`: enum (`sync`, `exists`, `not_exists`) - Notification type
- `X-Goog-Resource-URI`: string (optional) - URI to fetch changes
- `X-Goog-Message-Number`: string (optional) - Message sequence number

**Response**: `200 OK` (empty body)

**Error Responses**:
- `400 Bad Request` - Missing required Google webhook headers
- `401 Unauthorized` - Invalid channel token or resource ID

**Resource States**:
- `sync`: Initial sync notification (sent when watch channel is first created)
- `exists`: Calendar changed - triggers incremental sync
- `not_exists`: Resource no longer exists (calendar was deleted)

**Notes**:
- Public endpoint (no JWT authentication)
- Security enforced via channel token verification
- Channel token and resource ID must match stored connection values
- `exists` state queues an incremental sync job in BullMQ
- `not_exists` state marks connection as error
- Logs all webhook events to `calendar_sync_log` table

---

## Sync Logs & Health

Endpoints for monitoring calendar integration health and viewing sync operation logs.

### Get Sync Logs

**Endpoint**: `GET /calendar/integration/sync-logs`
**RBAC**: `Owner`, `Admin`

**Query Parameters**:
- `page` (number, default: 1) - Page number
- `limit` (number, default: 50, max: 100) - Items per page
- `status` (enum, optional) - Filter by status: `success`, `failed`, `skipped`
- `direction` (enum, optional) - Filter by direction: `outbound`, `inbound`
- `action` (string, optional) - Filter by action type (e.g., `event_created`, `webhook_received`)

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "c50e8400-e29b-41d4-a716-446655440008",
      "connectionId": "b50e8400-e29b-41d4-a716-446655440007",
      "direction": "inbound",
      "action": "webhook_received",
      "appointmentId": null,
      "externalEventId": null,
      "status": "success",
      "errorMessage": null,
      "metadata": {
        "resourceState": "exists",
        "channelId": "550e8400-e29b-41d4-a716-446655440000",
        "messageNumber": "12345"
      },
      "createdAt": "2026-03-03T10:30:00Z"
    },
    {
      "id": "c50e8400-e29b-41d4-a716-446655440009",
      "connectionId": "b50e8400-e29b-41d4-a716-446655440007",
      "direction": "outbound",
      "action": "event_created",
      "appointmentId": "950e8400-e29b-41d4-a716-446655440004",
      "externalEventId": "abc123xyz",
      "status": "success",
      "errorMessage": null,
      "metadata": {
        "eventSummary": "Quote Visit - John Doe",
        "eventStart": "2026-03-15T09:00:00Z"
      },
      "createdAt": "2026-03-03T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 125,
    "totalPages": 3
  }
}
```

**Field Descriptions**:
- `direction`: `outbound` (Lead360 → Google) or `inbound` (Google → Lead360)
- `action`: Sync operation type
  - Outbound: `event_created`, `event_updated`, `event_deleted`
  - Inbound: `webhook_received`, `event_fetched`, `block_created`
- `status`: `success`, `failed`, `skipped`
- `metadata`: JSON object with operation-specific details

**Error Responses**:
- `401 Unauthorized` - JWT missing or invalid
- `403 Forbidden` - Estimator cannot access (Owner/Admin only)

**Notes**:
- Used for troubleshooting sync issues
- Logs retained for 90 days
- Estimator role cannot access sync logs (Owner/Admin only)

---

### Get Calendar Integration Health

**Endpoint**: `GET /calendar/integration/health`
**RBAC**: `Owner`, `Admin`, `Estimator`

**Response**: `200 OK` (when connected)
```json
{
  "connected": true,
  "syncStatus": "active",
  "lastSyncAt": "2026-03-03T10:30:00Z",
  "webhookExpiration": "2026-03-10T10:30:00Z",
  "recentErrors": 0,
  "recentSuccesses": 125
}
```

**Response**: `200 OK` (when not connected)
```json
{
  "connected": false,
  "syncStatus": "inactive",
  "recentErrors": 0,
  "recentSuccesses": 0
}
```

**Field Descriptions**:
- `connected`: boolean - Whether a calendar is connected
- `syncStatus`: enum (`active`, `inactive`, `error`) - Current sync health
- `lastSyncAt`: string (ISO 8601) - Last successful sync timestamp
- `webhookExpiration`: string (ISO 8601) - When webhook channel expires (7 days from creation)
- `recentErrors`: number - Failed sync operations in last 24 hours
- `recentSuccesses`: number - Successful sync operations in last 24 hours

**Error Responses**:
- `401 Unauthorized` - JWT missing or invalid

**Notes**:
- Used by frontend to display integration health dashboard
- All roles (Owner, Admin, Estimator) can check health
- Webhook expiration indicates when channel needs renewal (automatic)

---

## Complete Endpoint Summary

**Total Endpoints**: 34

### Appointment Types (6 endpoints)
- POST /calendar/appointment-types
- GET /calendar/appointment-types
- GET /calendar/appointment-types/:id
- PATCH /calendar/appointment-types/:id
- DELETE /calendar/appointment-types/:id (soft delete)
- DELETE /calendar/appointment-types/:id/permanent (hard delete)

### Appointment Type Schedules (3 endpoints)
- GET /calendar/appointment-types/:typeId/schedule
- PUT /calendar/appointment-types/:typeId/schedule
- PATCH /calendar/appointment-types/:typeId/schedule/:dayOfWeek

### Appointments (4 endpoints)
- POST /calendar/appointments
- GET /calendar/appointments
- GET /calendar/appointments/:id
- PATCH /calendar/appointments/:id

### Appointment Actions (5 endpoints)
- POST /calendar/appointments/:id/confirm
- POST /calendar/appointments/:id/cancel
- POST /calendar/appointments/:id/reschedule
- POST /calendar/appointments/:id/complete
- POST /calendar/appointments/:id/no-show

### Availability (1 endpoint)
- GET /calendar/availability

### External Blocks (1 endpoint)
- GET /calendar/external-blocks

### Calendar Dashboard (3 endpoints)
- GET /calendar/dashboard/upcoming
- GET /calendar/dashboard/new
- PATCH /calendar/dashboard/new/:id/acknowledge

### Google Calendar Integration (7 endpoints)
- GET /calendar/integration/google/auth-url
- GET /calendar/integration/google/callback
- GET /calendar/integration/google/calendars
- POST /calendar/integration/google/connect
- DELETE /calendar/integration/google/disconnect
- POST /calendar/integration/google/sync
- POST /calendar/integration/google/test

### Calendar Integration Status (1 endpoint)
- GET /calendar/integration/status

### Google Calendar Webhooks (1 endpoint)
- POST /webhooks/google-calendar

### Sync Logs & Health (2 endpoints)
- GET /calendar/integration/sync-logs
- GET /calendar/integration/health

---

## Common Error Response Format

All endpoints follow a consistent error response format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "scheduled_date",
      "message": "scheduled_date must be in YYYY-MM-DD format"
    }
  ]
}
```

**Standard HTTP Status Codes**:
- `200 OK` - Successful GET/PATCH/POST request
- `201 Created` - Resource created successfully
- `204 No Content` - Successful DELETE request
- `400 Bad Request` - Validation error or invalid data
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (RBAC)
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., connection already exists)
- `422 Unprocessable Entity` - Business logic validation failed
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - External service unavailable

---

## Security & Multi-Tenant Isolation

**All endpoints enforce strict multi-tenant isolation**:
- Every database query includes `tenant_id` filter derived from JWT
- Cross-tenant access is strictly prohibited
- Prisma middleware validates `tenant_id` presence on all queries

**RBAC Enforcement**:
- JWT contains user's role (`Owner`, `Admin`, `Estimator`, `Employee`)
- Each endpoint specifies allowed roles via `@Roles()` decorator
- Unauthorized roles receive `403 Forbidden`

**OAuth Security**:
- State parameter validates CSRF protection
- Channel token verifies webhook authenticity
- Tokens encrypted at rest in database (AES-256-GCM)
- Tokens auto-refreshed before expiration

---

## Timezone Handling

**All appointment times are stored in both local and UTC**:
- `scheduled_date`: Local date (YYYY-MM-DD)
- `start_time`, `end_time`: Local time (HH:mm)
- `start_datetime_utc`, `end_datetime_utc`: UTC timestamps for querying/sorting

**Tenant Timezone**:
- Each tenant has a `timezone` setting (default: `America/New_York`)
- All time calculations use tenant's timezone
- Availability endpoint returns tenant's timezone

---

## Rate Limiting

**Currently not implemented** - Future consideration:
- 1000 requests/hour per tenant for authenticated endpoints
- 100 requests/hour per IP for public webhook endpoint

---

## API Versioning

Current version: **v1**

All endpoints are prefixed with `/api/v1/`

Future versions will introduce new endpoints without breaking existing v1 endpoints.

---

## Swagger / OpenAPI Documentation

Interactive API documentation available at:
- Local: `http://localhost:8000/api/docs`
- Production: `https://api.lead360.app/api/docs`

All endpoints documented with Swagger decorators (`@ApiOperation`, `@ApiResponse`, etc.)

---

## Contact & Support

For API questions or issues:
- GitHub Issues: [Lead360 Repository]
- Email: support@lead360.app

---

**End of Calendar & Scheduling API Documentation**
