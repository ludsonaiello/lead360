# Background Jobs REST API Documentation

**Module**: Background Jobs & Email Queue System
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer token required (all endpoints)
**Authorization**: Platform Admin role required (all endpoints)
**Version**: v1.0
**Last Updated**: January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints Overview](#endpoints-overview)
4. [Job Management Endpoints](#job-management-endpoints)
5. [Scheduled Jobs Endpoints](#scheduled-jobs-endpoints)
6. [Email Settings Endpoints](#email-settings-endpoints)
7. [Email Templates Endpoints](#email-templates-endpoints)
8. [Common Error Responses](#common-error-responses)
9. [Pagination](#pagination)
10. [Cron Expression Guide](#cron-expression-guide)
11. [BullMQ Integration Notes](#bullmq-integration-notes)

---

## Overview

The Background Jobs API provides comprehensive management of asynchronous job processing, scheduled tasks, and email infrastructure. This system handles:

- **Job Queue Management**: Monitor, retry, and manage background jobs
- **Scheduled Jobs**: Configure and manage cron-like scheduled tasks
- **Email Configuration**: Platform SMTP settings for system emails
- **Email Templates**: Manage Handlebars-based email templates

**Key Features**:
- BullMQ-based job queue with Redis backend
- Database-backed job tracking and logging
- Cron scheduling with timezone support
- SMTP email sending with password encryption
- Handlebars template rendering
- Job retry logic with exponential backoff
- Queue health monitoring

---

## Authentication

All endpoints require authentication via JWT Bearer token.

### Header Format
```
Authorization: Bearer {jwt_token}
```

### Token Payload
```json
{
  "userId": "user-uuid",
  "tenantId": "tenant-uuid",
  "roles": ["Owner"],
  "is_platform_admin": true,
  "email": "admin@example.com",
  "iat": 1642329600,
  "exp": 1642416000
}
```

### Authorization Requirements

**ALL endpoints require**:
- Valid JWT token (not expired)
- `is_platform_admin: true` in token payload

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Valid token but not a Platform Admin

---

## Endpoints Overview

### Job Management (8 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/jobs` | List all jobs with filters |
| GET | `/admin/jobs/:id` | Get job details with logs |
| POST | `/admin/jobs/:id/retry` | Retry a failed job |
| DELETE | `/admin/jobs/:id` | Delete a specific job |
| GET | `/admin/jobs/failed/list` | List all failed jobs |
| POST | `/admin/jobs/failed/retry-all` | Retry all failed jobs |
| DELETE | `/admin/jobs/failed/clear` | Clear all failed jobs |
| GET | `/admin/jobs/health/status` | Get queue health metrics |

### Scheduled Jobs Management (7 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/jobs/schedules` | List all scheduled jobs |
| GET | `/admin/jobs/schedules/:id` | Get scheduled job details |
| POST | `/admin/jobs/schedules` | Create new scheduled job |
| PATCH | `/admin/jobs/schedules/:id` | Update scheduled job |
| DELETE | `/admin/jobs/schedules/:id` | Delete scheduled job |
| POST | `/admin/jobs/schedules/:id/trigger` | Manually trigger job |
| GET | `/admin/jobs/schedules/:id/history` | Get execution history |

### Email Settings (3 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/jobs/email-settings` | Get SMTP configuration |
| PATCH | `/admin/jobs/email-settings` | Update SMTP configuration |
| POST | `/admin/jobs/email-settings/test` | Send test email |

### Email Templates (9 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/jobs/email-templates` | List all templates |
| GET | `/admin/jobs/email-templates/:templateKey` | Get template details |
| POST | `/admin/jobs/email-templates` | Create new template |
| PATCH | `/admin/jobs/email-templates/:templateKey` | Update template (including system templates) |
| DELETE | `/admin/jobs/email-templates/:templateKey` | Delete template |
| GET | `/admin/jobs/email-templates/variables/registry` | Get all available variables |
| GET | `/admin/jobs/email-templates/variables/sample` | Get sample data for variables |
| POST | `/admin/jobs/email-templates/validate` | Validate template variables |
| POST | `/admin/jobs/email-templates/:templateKey/preview` | Preview template |

**Total**: 27 endpoints

---

## Job Management Endpoints

### 1. List All Jobs

**GET** `/admin/jobs`

Lists all background jobs with filtering and pagination support.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Query Parameters

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| page | integer | No | 1 | Page number for pagination | `?page=2` |
| limit | integer | No | 50 | Items per page (max 100) | `?limit=25` |
| status | enum | No | - | Filter by job status | `?status=failed` |
| job_type | string | No | - | Filter by job type | `?job_type=send-email` |
| tenant_id | uuid | No | - | Filter by tenant ID | `?tenant_id=abc123...` |
| date_from | string | No | - | Filter jobs created after (ISO 8601) | `?date_from=2026-01-01T00:00:00Z` |
| date_to | string | No | - | Filter jobs created before (ISO 8601) | `?date_to=2026-01-31T23:59:59Z` |

**Status Enum Values**: `pending`, `processing`, `completed`, `failed`

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs?page=1&limit=50&status=failed" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "job_type": "send-email",
      "status": "completed",
      "tenant_id": "tenant-uuid-123",
      "payload": {
        "to": "user@example.com",
        "templateKey": "password-reset",
        "variables": {
          "user_name": "John Doe",
          "reset_link": "https://..."
        }
      },
      "result": {
        "messageId": "<smtp-message-id@example.com>"
      },
      "priority": 5,
      "attempts": 1,
      "max_retries": 3,
      "error_message": null,
      "created_at": "2026-01-15T10:30:00.000Z",
      "started_at": "2026-01-15T10:30:01.000Z",
      "completed_at": "2026-01-15T10:30:03.000Z",
      "failed_at": null,
      "duration_ms": 2000
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 20,
    "total_count": 987,
    "limit": 50
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| data | array | Array of job objects |
| data[].id | string (uuid) | Unique job identifier |
| data[].job_type | string | Job type identifier (e.g., "send-email", "expiry-check") |
| data[].status | string | Current job status |
| data[].tenant_id | string (uuid) | Associated tenant ID (null for platform jobs) |
| data[].payload | object | Job input data (varies by job type) |
| data[].result | object | Job output data (null if not completed) |
| data[].priority | integer | Job priority (1=highest, 10=lowest) |
| data[].attempts | integer | Number of execution attempts |
| data[].max_retries | integer | Maximum retry attempts allowed |
| data[].error_message | string | Error message (null if successful) |
| data[].created_at | string (ISO 8601) | Job creation timestamp |
| data[].started_at | string (ISO 8601) | Job start timestamp (null if pending) |
| data[].completed_at | string (ISO 8601) | Job completion timestamp (null if not completed) |
| data[].failed_at | string (ISO 8601) | Job failure timestamp (null if not failed) |
| data[].duration_ms | integer | Execution duration in milliseconds |
| pagination | object | Pagination metadata |
| pagination.current_page | integer | Current page number |
| pagination.total_pages | integer | Total pages available |
| pagination.total_count | integer | Total number of jobs matching filters |
| pagination.limit | integer | Items per page |

#### Error Responses

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

**400 Bad Request** (invalid parameters)
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "limit",
      "message": "limit must not be greater than 100"
    }
  ]
}
```

---

### 2. Get Job Details

**GET** `/admin/jobs/:id`

Retrieves detailed information about a specific job, including execution logs and email queue details.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Job ID | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "job_type": "send-email",
  "status": "completed",
  "tenant_id": "tenant-uuid-123",
  "payload": {
    "to": "user@example.com",
    "templateKey": "password-reset",
    "variables": {
      "user_name": "John Doe",
      "reset_link": "https://app.lead360.app/reset?token=xyz"
    }
  },
  "result": {
    "messageId": "<smtp-message-id@example.com>"
  },
  "priority": 5,
  "attempts": 1,
  "max_retries": 3,
  "error_message": null,
  "created_at": "2026-01-15T10:30:00.000Z",
  "started_at": "2026-01-15T10:30:01.000Z",
  "completed_at": "2026-01-15T10:30:03.000Z",
  "failed_at": null,
  "duration_ms": 2000,
  "job_log": [
    {
      "id": "log-uuid-1",
      "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "timestamp": "2026-01-15T10:30:01.000Z",
      "level": "info",
      "message": "Job started processing",
      "metadata": {}
    },
    {
      "id": "log-uuid-2",
      "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "timestamp": "2026-01-15T10:30:02.000Z",
      "level": "info",
      "message": "Email sent successfully to user@example.com",
      "metadata": {
        "messageId": "<smtp-message-id@example.com>"
      }
    }
  ],
  "email_queue": [
    {
      "id": "email-queue-uuid-1",
      "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "template_key": "password-reset",
      "to_email": "user@example.com",
      "cc_emails": null,
      "bcc_emails": null,
      "subject": "Reset Your Password",
      "html_body": "<html>...</html>",
      "text_body": "Reset your password...",
      "status": "sent",
      "smtp_message_id": "<smtp-message-id@example.com>",
      "error_message": null,
      "sent_at": "2026-01-15T10:30:02.000Z",
      "created_at": "2026-01-15T10:30:01.000Z"
    }
  ]
}
```

#### Response Fields

Includes all fields from the list endpoint plus:

| Field | Type | Description |
|-------|------|-------------|
| job_log | array | Array of log entries for this job |
| job_log[].id | string (uuid) | Log entry ID |
| job_log[].job_id | string (uuid) | Parent job ID |
| job_log[].timestamp | string (ISO 8601) | Log timestamp |
| job_log[].level | string | Log level (debug, info, warn, error) |
| job_log[].message | string | Log message |
| job_log[].metadata | object | Additional log data |
| email_queue | array | Email tracking records (if job is send-email) |
| email_queue[].id | string (uuid) | Email queue entry ID |
| email_queue[].job_id | string (uuid) | Parent job ID |
| email_queue[].template_key | string | Email template used |
| email_queue[].to_email | string | Recipient email address |
| email_queue[].cc_emails | array | CC recipients (optional) |
| email_queue[].bcc_emails | array | BCC recipients (optional) |
| email_queue[].subject | string | Email subject line |
| email_queue[].html_body | string | HTML email content |
| email_queue[].text_body | string | Plain text email content |
| email_queue[].status | string | Email status (pending, sent, failed) |
| email_queue[].smtp_message_id | string | SMTP server message ID |
| email_queue[].error_message | string | Error message (if failed) |
| email_queue[].sent_at | string (ISO 8601) | Email sent timestamp |
| email_queue[].created_at | string (ISO 8601) | Email queue entry creation timestamp |

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Job not found"
}
```

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 3. Retry Failed Job

**POST** `/admin/jobs/:id/retry`

Retries a failed job by resetting its status and re-queuing it to the appropriate BullMQ queue.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Job ID | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |

#### Request Example

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/retry" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "message": "Job requeued successfully",
  "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| message | string | Success message |
| job_id | string (uuid) | ID of the job that was retried |

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Job not found"
}
```

**400 Bad Request** (job not failed)
```json
{
  "statusCode": 400,
  "message": "Only failed jobs can be retried"
}
```

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 4. Delete Job

**DELETE** `/admin/jobs/:id`

Permanently deletes a job and all associated logs and email queue entries (cascade delete).

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Job ID | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |

#### Request Example

```bash
curl -X DELETE "https://api.lead360.app/api/v1/admin/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (204 No Content)

No response body. Status code `204` indicates successful deletion.

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Job not found"
}
```

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 5. List Failed Jobs

**GET** `/admin/jobs/failed/list`

Convenience endpoint that returns all failed jobs. Equivalent to calling `GET /admin/jobs?status=failed`.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Query Parameters

Same as "List All Jobs" endpoint (page, limit, job_type, tenant_id, date_from, date_to).

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/failed/list?page=1&limit=50" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

Same response format as "List All Jobs", but all jobs will have `status: "failed"`.

---

### 6. Retry All Failed Jobs

**POST** `/admin/jobs/failed/retry-all`

Retries all failed jobs in the database by re-queuing them to BullMQ.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Request Example

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/jobs/failed/retry-all" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "message": "5 failed jobs requeued successfully",
  "count": 5
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| message | string | Success message with count |
| count | integer | Number of jobs requeued |

#### Error Responses

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 7. Clear All Failed Jobs

**DELETE** `/admin/jobs/failed/clear`

Permanently deletes all failed jobs from the database.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Request Example

```bash
curl -X DELETE "https://api.lead360.app/api/v1/admin/jobs/failed/clear" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "message": "12 failed jobs deleted",
  "count": 12
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| message | string | Success message with count |
| count | integer | Number of jobs deleted |

#### Error Responses

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 8. Get Queue Health Status

**GET** `/admin/jobs/health/status`

Retrieves health metrics for both BullMQ queues (email, scheduled) and database job statistics.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/health/status" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "queues": {
    "email": {
      "waiting": 5,
      "active": 2,
      "completed": 1250,
      "failed": 3,
      "delayed": 0,
      "paused": 0
    },
    "scheduled": {
      "waiting": 0,
      "active": 1,
      "completed": 487,
      "failed": 1,
      "delayed": 0,
      "paused": 0
    }
  },
  "database": {
    "pending": 5,
    "processing": 3,
    "completed": 1737,
    "failed": 4
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| queues | object | BullMQ queue metrics |
| queues.email | object | Email queue metrics |
| queues.email.waiting | integer | Jobs waiting in queue |
| queues.email.active | integer | Jobs currently processing |
| queues.email.completed | integer | Completed jobs (in Redis) |
| queues.email.failed | integer | Failed jobs (in Redis) |
| queues.email.delayed | integer | Delayed jobs |
| queues.email.paused | integer | Jobs in paused state |
| queues.scheduled | object | Scheduled queue metrics |
| queues.scheduled.* | integer | Same metrics as email queue |
| database | object | Database job counts by status |
| database.pending | integer | Jobs with status "pending" |
| database.processing | integer | Jobs with status "processing" |
| database.completed | integer | Jobs with status "completed" |
| database.failed | integer | Jobs with status "failed" |

#### Error Responses

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## Scheduled Jobs Endpoints

### 9. List Scheduled Jobs

**GET** `/admin/jobs/schedules`

Lists all configured scheduled jobs (cron-like tasks).

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Query Parameters

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| page | integer | No | 1 | Page number | `?page=1` |
| limit | integer | No | 50 | Items per page (max 100) | `?limit=25` |

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/schedules?page=1&limit=50" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "schedule-uuid-1",
      "job_type": "expiry-check",
      "name": "License and Insurance Expiry Check",
      "description": "Check for expiring licenses and insurance, send warning emails",
      "schedule": "0 6 * * *",
      "timezone": "America/New_York",
      "is_enabled": true,
      "max_retries": 1,
      "timeout_seconds": 600,
      "last_run_at": "2026-01-15T06:00:00.000Z",
      "next_run_at": "2026-01-16T06:00:00.000Z",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-15T06:00:05.000Z"
    },
    {
      "id": "schedule-uuid-2",
      "job_type": "data-cleanup",
      "name": "Expired Token Cleanup",
      "description": "Delete expired password reset and activation tokens",
      "schedule": "0 2 * * *",
      "timezone": "America/New_York",
      "is_enabled": true,
      "max_retries": 2,
      "timeout_seconds": 300,
      "last_run_at": "2026-01-15T02:00:00.000Z",
      "next_run_at": "2026-01-16T02:00:00.000Z",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-15T02:00:03.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_count": 4,
    "limit": 50
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| data | array | Array of scheduled job objects |
| data[].id | string (uuid) | Scheduled job ID |
| data[].job_type | string | Unique job type identifier |
| data[].name | string | Human-readable job name |
| data[].description | string | Job description |
| data[].schedule | string | Cron expression (e.g., "0 6 * * *") |
| data[].timezone | string | Timezone for schedule execution |
| data[].is_enabled | boolean | Whether job is active |
| data[].max_retries | integer | Maximum retry attempts |
| data[].timeout_seconds | integer | Job timeout in seconds |
| data[].last_run_at | string (ISO 8601) | Last execution timestamp |
| data[].next_run_at | string (ISO 8601) | Next scheduled execution |
| data[].created_at | string (ISO 8601) | Creation timestamp |
| data[].updated_at | string (ISO 8601) | Last update timestamp |
| pagination | object | Pagination metadata |

#### Error Responses

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 10. Get Scheduled Job Details

**GET** `/admin/jobs/schedules/:id`

Retrieves details of a specific scheduled job.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Scheduled Job ID | `schedule-uuid-1` |

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/schedules/schedule-uuid-1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "id": "schedule-uuid-1",
  "job_type": "expiry-check",
  "name": "License and Insurance Expiry Check",
  "description": "Check for expiring licenses and insurance, send warning emails",
  "schedule": "0 6 * * *",
  "timezone": "America/New_York",
  "is_enabled": true,
  "max_retries": 1,
  "timeout_seconds": 600,
  "last_run_at": "2026-01-15T06:00:00.000Z",
  "next_run_at": "2026-01-16T06:00:00.000Z",
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-15T06:00:05.000Z"
}
```

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Scheduled job not found"
}
```

---

### 11. Create Scheduled Job

**POST** `/admin/jobs/schedules`

Creates a new scheduled job with cron-based scheduling.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Request Body

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| job_type | string | Yes | - | Unique job type identifier | "my-custom-job" |
| name | string | Yes | - | Human-readable name | "Daily Report Generation" |
| description | string | No | - | Job description | "Generate daily sales reports" |
| schedule | string | Yes | Valid cron | Cron expression | "0 8 * * *" |
| timezone | string | No | - | Timezone | "America/New_York" |
| max_retries | integer | No | Min: 1 | Max retry attempts | 3 |
| timeout_seconds | integer | No | Min: 60 | Timeout in seconds | 300 |

#### Request Example

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/jobs/schedules" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "daily-report",
    "name": "Daily Sales Report",
    "description": "Generate and email daily sales report",
    "schedule": "0 8 * * *",
    "timezone": "America/Los_Angeles",
    "max_retries": 2,
    "timeout_seconds": 600
  }'
```

#### Success Response (201 Created)

```json
{
  "id": "schedule-uuid-new",
  "job_type": "daily-report",
  "name": "Daily Sales Report",
  "description": "Generate and email daily sales report",
  "schedule": "0 8 * * *",
  "timezone": "America/Los_Angeles",
  "is_enabled": true,
  "max_retries": 2,
  "timeout_seconds": 600,
  "last_run_at": null,
  "next_run_at": "2026-01-16T08:00:00.000Z",
  "created_at": "2026-01-15T14:30:00.000Z",
  "updated_at": "2026-01-15T14:30:00.000Z"
}
```

#### Error Responses

**400 Bad Request** (invalid cron)
```json
{
  "statusCode": 400,
  "message": "Invalid cron expression: Expected 5 fields, got 4"
}
```

**400 Bad Request** (validation error)
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "timeout_seconds",
      "message": "timeout_seconds must not be less than 60"
    }
  ]
}
```

---

### 12. Update Scheduled Job

**PATCH** `/admin/jobs/schedules/:id`

Updates a scheduled job's configuration.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Scheduled Job ID | `schedule-uuid-1` |

#### Request Body

All fields are optional. Only include fields you want to update.

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| job_type | string | No | - | Job type identifier | "updated-job" |
| name | string | No | - | Job name | "Updated Name" |
| description | string | No | - | Job description | "Updated description" |
| schedule | string | No | Valid cron | Cron expression | "0 9 * * *" |
| timezone | string | No | - | Timezone | "America/Chicago" |
| is_enabled | boolean | No | - | Enable/disable job | true |
| max_retries | integer | No | Min: 1 | Max retry attempts | 3 |
| timeout_seconds | integer | No | Min: 60 | Timeout in seconds | 450 |

#### Request Example

```bash
curl -X PATCH "https://api.lead360.app/api/v1/admin/jobs/schedules/schedule-uuid-1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 9 * * *",
    "is_enabled": true
  }'
```

#### Success Response (200 OK)

```json
{
  "id": "schedule-uuid-1",
  "job_type": "expiry-check",
  "name": "License and Insurance Expiry Check",
  "description": "Check for expiring licenses and insurance, send warning emails",
  "schedule": "0 9 * * *",
  "timezone": "America/New_York",
  "is_enabled": true,
  "max_retries": 1,
  "timeout_seconds": 600,
  "last_run_at": "2026-01-15T06:00:00.000Z",
  "next_run_at": "2026-01-16T09:00:00.000Z",
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-15T15:00:00.000Z"
}
```

**Note**: If `schedule` or `timezone` is updated, `next_run_at` is automatically recalculated.

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Scheduled job not found"
}
```

**400 Bad Request** (invalid cron)
```json
{
  "statusCode": 400,
  "message": "Invalid cron expression"
}
```

---

### 13. Delete Scheduled Job

**DELETE** `/admin/jobs/schedules/:id`

Permanently deletes a scheduled job. This does not delete historical job executions.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Scheduled Job ID | `schedule-uuid-1` |

#### Request Example

```bash
curl -X DELETE "https://api.lead360.app/api/v1/admin/jobs/schedules/schedule-uuid-1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (204 No Content)

No response body. Status code `204` indicates successful deletion.

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Scheduled job not found"
}
```

---

### 14. Trigger Scheduled Job Manually

**POST** `/admin/jobs/schedules/:id/trigger`

Manually triggers a scheduled job to run immediately, without affecting the next scheduled run time.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Scheduled Job ID | `schedule-uuid-1` |

#### Request Example

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/jobs/schedules/schedule-uuid-1/trigger" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "message": "Job triggered successfully",
  "job_id": "job-uuid-new-123"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| message | string | Success message |
| job_id | string (uuid) | ID of the newly created job instance |

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Scheduled job not found"
}
```

---

### 15. Get Scheduled Job Execution History

**GET** `/admin/jobs/schedules/:id/history`

Retrieves the last N execution runs for a specific scheduled job.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Scheduled Job ID | `schedule-uuid-1` |

#### Query Parameters

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| limit | integer | No | 100 | Number of executions to return | `?limit=50` |

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/schedules/schedule-uuid-1/history?limit=100" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
[
  {
    "id": "job-uuid-1",
    "job_type": "expiry-check",
    "status": "completed",
    "payload": {
      "scheduleId": "schedule-uuid-1",
      "scheduleName": "License and Insurance Expiry Check"
    },
    "result": {
      "tenantsProcessed": 25,
      "totalWarnings": 3
    },
    "created_at": "2026-01-15T06:00:00.000Z",
    "completed_at": "2026-01-15T06:02:30.000Z",
    "duration_ms": 150000
  },
  {
    "id": "job-uuid-2",
    "job_type": "expiry-check",
    "status": "completed",
    "payload": {
      "scheduleId": "schedule-uuid-1",
      "scheduleName": "License and Insurance Expiry Check"
    },
    "result": {
      "tenantsProcessed": 25,
      "totalWarnings": 5
    },
    "created_at": "2026-01-14T06:00:00.000Z",
    "completed_at": "2026-01-14T06:02:15.000Z",
    "duration_ms": 135000
  }
]
```

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Scheduled job not found"
}
```

---

## Email Settings Endpoints

### 16. Get SMTP Configuration

**GET** `/admin/jobs/email-settings`

Retrieves the platform SMTP configuration. Password is masked for security.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/email-settings" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "id": "config-uuid-1",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_encryption": "tls",
  "smtp_username": "noreply@lead360.app",
  "smtp_password": "********",
  "from_email": "noreply@lead360.app",
  "from_name": "Lead360 Platform",
  "is_verified": true,
  "updated_at": "2026-01-10T12:00:00.000Z"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Config ID |
| smtp_host | string | SMTP server hostname |
| smtp_port | integer | SMTP server port |
| smtp_encryption | string | Encryption type (none, tls, ssl) |
| smtp_username | string | SMTP username |
| smtp_password | string | Masked password (always "********") |
| from_email | string | Default "From" email address |
| from_name | string | Default "From" name |
| is_verified | boolean | Whether SMTP config has been tested |
| updated_at | string (ISO 8601) | Last update timestamp |

**Note**: Returns `null` if no SMTP configuration exists.

#### Error Responses

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 17. Update SMTP Configuration

**PATCH** `/admin/jobs/email-settings`

Updates the platform SMTP configuration. Creates a new config if none exists.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Request Body

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| smtp_host | string | Yes | - | SMTP hostname | "smtp.gmail.com" |
| smtp_port | integer | Yes | 1-65535 | SMTP port | 587 |
| smtp_encryption | string | Yes | Enum | Encryption type | "tls" |
| smtp_username | string | Yes | - | SMTP username | "noreply@lead360.app" |
| smtp_password | string | Yes | Min: 8 | SMTP password | "app-password-123" |
| from_email | string | Yes | Email | From email | "noreply@lead360.app" |
| from_name | string | Yes | - | From name | "Lead360" |

**smtp_encryption Enum Values**: `none`, `tls`, `ssl`

#### Request Example

```bash
curl -X PATCH "https://api.lead360.app/api/v1/admin/jobs/email-settings" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "smtp_encryption": "tls",
    "smtp_username": "noreply@lead360.app",
    "smtp_password": "your-app-password-here",
    "from_email": "noreply@lead360.app",
    "from_name": "Lead360 Platform"
  }'
```

#### Success Response (200 OK)

```json
{
  "id": "config-uuid-1",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_encryption": "tls",
  "smtp_username": "noreply@lead360.app",
  "smtp_password": "********",
  "from_email": "noreply@lead360.app",
  "from_name": "Lead360 Platform",
  "is_verified": false,
  "updated_at": "2026-01-15T16:00:00.000Z"
}
```

**Note**:
- Password is encrypted before storing in database
- `is_verified` is reset to `false` when config is updated
- SMTP transporter is reinitialized with new settings

#### Error Responses

**400 Bad Request** (validation error)
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "smtp_password",
      "message": "smtp_password must be longer than or equal to 8 characters"
    },
    {
      "field": "smtp_port",
      "message": "smtp_port must not be greater than 65535"
    }
  ]
}
```

---

### 18. Send Test Email

**POST** `/admin/jobs/email-settings/test`

Sends a test email to verify SMTP configuration is working correctly.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Request Body

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| to_email | string | Yes | Email | Recipient email | "admin@example.com" |

#### Request Example

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/jobs/email-settings/test" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "admin@example.com"
  }'
```

#### Success Response (200 OK)

```json
{
  "message": "Test email sent successfully",
  "messageId": "<smtp-message-id-abc123@example.com>"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| message | string | Success message |
| messageId | string | SMTP message ID from email server |

**Note**: On success, the SMTP config is marked as `is_verified: true` in the database.

#### Error Responses

**400 Bad Request** (SMTP error)
```json
{
  "statusCode": 400,
  "message": "SMTP test failed: Invalid login credentials"
}
```

**400 Bad Request** (validation error)
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "to_email",
      "message": "to_email must be an email"
    }
  ]
}
```

---

## Email Templates Endpoints

### 19. List Email Templates

**GET** `/admin/jobs/email-templates`

Lists all email templates with optional filtering.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Query Parameters

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| page | integer | No | 1 | Page number | `?page=1` |
| limit | integer | No | 50 | Items per page (max 100) | `?limit=25` |
| search | string | No | - | Search in template_key, subject, description | `?search=password` |
| is_system | boolean | No | - | Filter by system templates only | `?is_system=true` |

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/email-templates?search=password" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "template-uuid-1",
      "template_key": "password-reset",
      "subject": "Reset Your Password",
      "html_body": "<h1>Hello {{user_name}}</h1><p>Click here to reset: <a href=\"{{reset_link}}\">Reset Password</a></p>",
      "text_body": "Hello {{user_name}}, Click here to reset your password: {{reset_link}}",
      "variables": ["user_name", "reset_link", "expires_in"],
      "description": "Password reset email template",
      "is_system": true,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "template-uuid-2",
      "template_key": "password-changed",
      "subject": "Password Changed Successfully",
      "html_body": "<h1>Hello {{user_name}}</h1><p>Your password was changed on {{timestamp}}.</p>",
      "text_body": "Hello {{user_name}}, Your password was changed on {{timestamp}}.",
      "variables": ["user_name", "timestamp", "ip_address"],
      "description": "Password change confirmation",
      "is_system": true,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| data | array | Array of template objects |
| data[].id | string (uuid) | Template ID |
| data[].template_key | string | Unique template identifier |
| data[].subject | string | Email subject (with Handlebars) |
| data[].html_body | string | HTML email body (with Handlebars) |
| data[].text_body | string | Plain text body (with Handlebars) |
| data[].variables | array | Available variable names |
| data[].description | string | Template description |
| data[].is_system | boolean | Whether template is system template |
| data[].created_at | string (ISO 8601) | Creation timestamp |
| data[].updated_at | string (ISO 8601) | Last update timestamp |

#### Error Responses

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 20. Get Email Template Details

**GET** `/admin/jobs/email-templates/:templateKey`

Retrieves details of a specific email template.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| templateKey | string | Yes | Template key | `password-reset` |

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/email-templates/password-reset" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "id": "template-uuid-1",
  "template_key": "password-reset",
  "subject": "Reset Your Password",
  "html_body": "<h1>Hello {{user_name}}</h1><p>Click here to reset: <a href=\"{{reset_link}}\">Reset Password</a></p>",
  "text_body": "Hello {{user_name}}, Click here to reset your password: {{reset_link}}",
  "variables": ["user_name", "reset_link", "expires_in"],
  "description": "Password reset email template",
  "is_system": true,
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-01T00:00:00.000Z"
}
```

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Email template not found"
}
```

---

### 21. Create Email Template

**POST** `/admin/jobs/email-templates`

Creates a new email template with Handlebars variable support.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Request Body

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| template_key | string | Yes | Min: 3 | Unique template identifier | "welcome-email" |
| subject | string | Yes | Min: 3 | Email subject (Handlebars) | "Welcome to {{company_name}}!" |
| html_body | string | Yes | Min: 10 | HTML email body (Handlebars) | "&lt;h1&gt;Welcome {{user_name}}!&lt;/h1&gt;" |
| text_body | string | No | - | Plain text body (Handlebars) | "Welcome {{user_name}}!" |
| variables | array | Yes | - | Variable names array | ["user_name", "company_name"] |
| description | string | No | - | Template description | "Welcome email" |

#### Request Example

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/jobs/email-templates" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "template_key": "welcome-email",
    "subject": "Welcome to {{company_name}}!",
    "html_body": "<h1>Welcome {{user_name}}!</h1><p>Thanks for joining {{company_name}}.</p>",
    "text_body": "Welcome {{user_name}}! Thanks for joining {{company_name}}.",
    "variables": ["user_name", "company_name"],
    "description": "Welcome email sent to new users"
  }'
```

#### Success Response (201 Created)

```json
{
  "id": "template-uuid-new",
  "template_key": "welcome-email",
  "subject": "Welcome to {{company_name}}!",
  "html_body": "<h1>Welcome {{user_name}}!</h1><p>Thanks for joining {{company_name}}.</p>",
  "text_body": "Welcome {{user_name}}! Thanks for joining {{company_name}}.",
  "variables": ["user_name", "company_name"],
  "description": "Welcome email sent to new users",
  "is_system": false,
  "created_at": "2026-01-15T17:00:00.000Z",
  "updated_at": "2026-01-15T17:00:00.000Z"
}
```

#### Error Responses

**400 Bad Request** (validation error)
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "template_key",
      "message": "template_key must be longer than or equal to 3 characters"
    }
  ]
}
```

**400 Bad Request** (duplicate key)
```json
{
  "statusCode": 400,
  "message": "Template with key 'welcome-email' already exists"
}
```

**400 Bad Request** (invalid Handlebars)
```json
{
  "statusCode": 400,
  "message": "Invalid Handlebars syntax in html_body"
}
```

---

### 22. Update Email Template

**PATCH** `/admin/jobs/email-templates/:templateKey`

Updates an existing email template. System templates cannot be modified.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| templateKey | string | Yes | Template key | `welcome-email` |

#### Request Body

All fields are optional. Only include fields you want to update.

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| subject | string | No | Min: 3 | Email subject | "Welcome aboard!" |
| html_body | string | No | Min: 10 | HTML email body | "&lt;h1&gt;Updated&lt;/h1&gt;" |
| text_body | string | No | - | Plain text body | "Updated text" |
| variables | array | No | - | Variable names | ["user_name"] |
| description | string | No | - | Template description | "Updated description" |

**Note**: Cannot update `template_key` field.

#### Request Example

```bash
curl -X PATCH "https://api.lead360.app/api/v1/admin/jobs/email-templates/welcome-email" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Welcome aboard, {{user_name}}!",
    "description": "Updated welcome email template"
  }'
```

#### Success Response (200 OK)

```json
{
  "id": "template-uuid-new",
  "template_key": "welcome-email",
  "subject": "Welcome aboard, {{user_name}}!",
  "html_body": "<h1>Welcome {{user_name}}!</h1><p>Thanks for joining {{company_name}}.</p>",
  "text_body": "Welcome {{user_name}}! Thanks for joining {{company_name}}.",
  "variables": ["user_name", "company_name"],
  "description": "Updated welcome email template",
  "is_system": false,
  "created_at": "2026-01-15T17:00:00.000Z",
  "updated_at": "2026-01-15T18:00:00.000Z"
}
```

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Email template not found"
}
```

**400 Bad Request** (system template)
```json
{
  "statusCode": 400,
  "message": "Cannot modify system template"
}
```

**400 Bad Request** (invalid Handlebars)
```json
{
  "statusCode": 400,
  "message": "Invalid Handlebars syntax in subject"
}
```

---

### 23. Delete Email Template

**DELETE** `/admin/jobs/email-templates/:templateKey`

Deletes an email template. System templates cannot be deleted.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| templateKey | string | Yes | Template key | `welcome-email` |

#### Request Example

```bash
curl -X DELETE "https://api.lead360.app/api/v1/admin/jobs/email-templates/welcome-email" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (204 No Content)

No response body. Status code `204` indicates successful deletion.

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Email template not found"
}
```

**400 Bad Request** (system template)
```json
{
  "statusCode": 400,
  "message": "Cannot delete system template"
}
```

---

### 24. Preview Email Template

**POST** `/admin/jobs/email-templates/:templateKey/preview`

Renders an email template with sample variables to preview the output.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| templateKey | string | Yes | Template key | `welcome-email` |

#### Request Body

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| variables | object | Yes | Variable values for rendering | `{"user_name": "John Doe", "company_name": "Acme"}` |

#### Request Example

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/jobs/email-templates/welcome-email/preview" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "user_name": "John Doe",
      "company_name": "Acme Corp"
    }
  }'
```

#### Success Response (200 OK)

```json
{
  "subject": "Welcome to Acme Corp!",
  "html_body": "<h1>Welcome John Doe!</h1><p>Thanks for joining Acme Corp.</p>",
  "text_body": "Welcome John Doe! Thanks for joining Acme Corp."
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| subject | string | Rendered email subject |
| html_body | string | Rendered HTML body |
| text_body | string | Rendered text body (null if template has no text_body) |

#### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Email template not found"
}
```

**400 Bad Request** (rendering error)
```json
{
  "statusCode": 400,
  "message": "Template rendering error: Missing variable 'company_name'"
}
```

---

### 25. Get Variable Registry

**GET** `/admin/jobs/email-templates/variables/registry`

Retrieves all available template variables from the comprehensive variable registry. Returns detailed metadata about each variable including type, category, description, and example values.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Query Parameters

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| category | enum | No | - | Filter by variable category | `?category=user` |

**Valid Categories**:
- `user` - User profile and authentication variables
- `tenant` - Company/business information variables
- `subscription` - Subscription plan and status variables
- `billing` - Billing and payment variables
- `system` - Platform and system-generated variables
- `custom` - Custom variables

#### Request Example

```bash
# Get all variables
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/email-templates/variables/registry" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"

# Get only user variables
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/email-templates/variables/registry?category=user" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "user_name": {
    "name": "user_name",
    "type": "string",
    "category": "user",
    "description": "User's first name (commonly used in greetings)",
    "example": "John",
    "required": false
  },
  "user_email": {
    "name": "user_email",
    "type": "email",
    "category": "user",
    "description": "User's email address",
    "example": "john.doe@example.com",
    "required": false
  },
  "company_name": {
    "name": "company_name",
    "type": "string",
    "category": "tenant",
    "description": "Company/business name",
    "example": "Acme Roofing Co.",
    "required": false
  },
  "monthly_price": {
    "name": "monthly_price",
    "type": "currency",
    "category": "billing",
    "description": "Monthly subscription price",
    "example": 99.99,
    "required": false,
    "format": "$0.00"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| {variable_name}.name | string | Variable name (used in templates as `{{name}}`) |
| {variable_name}.type | enum | Data type (string, number, boolean, date, url, email, phone, currency, array, object) |
| {variable_name}.category | enum | Variable category (user, tenant, subscription, billing, system, custom) |
| {variable_name}.description | string | Human-readable description of what this variable contains |
| {variable_name}.example | any | Example value in the expected format |
| {variable_name}.required | boolean | Whether this variable is required when used |
| {variable_name}.format | string | Optional format specification (e.g., "YYYY-MM-DD" for dates, "$0.00" for currency) |
| {variable_name}.default_value | any | Optional default value if not provided |

#### Usage Notes

- **65+ variables available** across all categories
- Use this endpoint to discover what variables can be used in templates
- Variable names can be used in templates with Handlebars syntax: `{{variable_name}}`
- See the [Email Template Variables Guide](./email_template_variables_GUIDE.md) for complete variable reference

---

### 26. Get Variable Sample Data

**GET** `/admin/jobs/email-templates/variables/sample`

Generates sample/example data for specific variables. Useful for testing templates and preview functionality.

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| variables | string | Yes | Comma-separated list of variable names | `?variables=user_name,company_name,plan_name` |

#### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/jobs/email-templates/variables/sample?variables=user_name,company_name,monthly_price" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Success Response (200 OK)

```json
{
  "user_name": "John",
  "company_name": "Acme Roofing Co.",
  "monthly_price": 99.99
}
```

#### Usage Notes

- Returns example values from the variable registry
- Perfect for pre-filling preview forms with realistic data
- Unknown variable names are silently ignored (no error thrown)
- Use this with the preview endpoint to test templates

---

### 27. Validate Template Variables

**POST** `/admin/jobs/email-templates/validate`

Validates template body against declared variables. Detects unused variables (declared but not used) and undefined variables (used but not declared).

#### Authentication
- **Required**: Yes (Bearer token)
- **Authorization**: Platform Admin

#### Request Body

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| html_body | string | Yes | HTML template body with Handlebars variables | `<p>Hello {{user_name}}</p>` |
| text_body | string | No | Plain text template body (optional) | `Hello {{user_name}}` |
| variables | array | Yes | Array of declared variable names | `["user_name", "company_name"]` |

#### Request Example

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/jobs/email-templates/validate" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "html_body": "<p>Hello {{user_name}}, your trial ends {{trial_end_date}}.</p>",
    "text_body": "Hello {{user_name}}, your trial ends {{trial_end_date}}.",
    "variables": ["user_name", "trial_end_date", "company_name"]
  }'
```

#### Success Response (200 OK)

**Valid template**:
```json
{
  "valid": true,
  "htmlValidation": {
    "valid": true,
    "unusedVariables": [],
    "undefinedVariables": []
  },
  "textValidation": {
    "valid": true,
    "unusedVariables": [],
    "undefinedVariables": []
  }
}
```

**Invalid template** (has warnings):
```json
{
  "valid": false,
  "htmlValidation": {
    "valid": false,
    "unusedVariables": ["company_name"],
    "undefinedVariables": []
  },
  "textValidation": {
    "valid": false,
    "unusedVariables": ["company_name"],
    "undefinedVariables": []
  }
}
```

**Invalid template** (has errors):
```json
{
  "valid": false,
  "htmlValidation": {
    "valid": false,
    "unusedVariables": ["company_name"],
    "undefinedVariables": ["unknown_var"]
  },
  "textValidation": null
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| valid | boolean | Overall validation status (false if any undefined variables) |
| htmlValidation | object | Validation results for HTML body |
| htmlValidation.valid | boolean | Whether HTML template has no undefined variables |
| htmlValidation.unusedVariables | array | Variables declared but not used in template (warning) |
| htmlValidation.undefinedVariables | array | Variables used in template but not declared (error) |
| textValidation | object\|null | Validation results for text body (null if no text_body provided) |

#### Validation Rules

**Critical Issues (valid=false)**:
- ❌ **Undefined Variables**: Variables used in template (e.g., `{{user_nme}}`) but not in `variables` array
  - Usually indicates a typo or missing variable declaration
  - Will cause runtime errors when rendering

**Warnings (valid=true but has unusedVariables)**:
- ⚠️ **Unused Variables**: Variables declared in `variables` array but never used in template
  - Not an error, but indicates template might be incomplete
  - Harmless but suggests cleanup needed

#### Usage Notes

- Use before saving templates to catch errors early
- Parses Handlebars Abstract Syntax Tree (AST) to extract variable usage
- Helps prevent typos like `{{user_nme}}` instead of `{{user_name}}`
- Frontend can use this to show real-time validation warnings

---

## Common Error Responses

### Standard Error Format

All API errors follow this consistent structure:

```json
{
  "statusCode": 400,
  "message": "Human-readable error message",
  "error": "Error type (optional)",
  "errors": [
    {
      "field": "fieldName",
      "message": "Specific validation error"
    }
  ]
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET or POST request |
| 201 | Created | Successful POST request creating a resource |
| 204 | No Content | Successful DELETE request |
| 400 | Bad Request | Validation error, malformed request |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Business rule violation (duplicate, etc.) |
| 500 | Internal Server Error | Unexpected server error |

### Common Error Examples

**Validation Error (400)**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "email must be an email"
    },
    {
      "field": "port",
      "message": "port must not be greater than 65535"
    }
  ]
}
```

**Authentication Error (401)**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Authorization Error (403)**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

**Not Found Error (404)**
```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

**Conflict Error (409)**
```json
{
  "statusCode": 409,
  "message": "Template with key 'welcome-email' already exists"
}
```

---

## Pagination

### Query Parameters

All list endpoints support pagination with these parameters:

| Parameter | Type | Default | Min | Max | Description |
|-----------|------|---------|-----|-----|-------------|
| page | integer | 1 | 1 | - | Page number to retrieve |
| limit | integer | 50 | 1 | 100 | Number of items per page |

### Response Structure

Paginated endpoints return this structure:

```json
{
  "data": [...],
  "pagination": {
    "current_page": 1,
    "total_pages": 10,
    "total_count": 487,
    "limit": 50
  }
}
```

### Pagination Fields

| Field | Type | Description |
|-------|------|-------------|
| data | array | Array of resource objects |
| pagination.current_page | integer | Current page number |
| pagination.total_pages | integer | Total pages available |
| pagination.total_count | integer | Total number of items |
| pagination.limit | integer | Items per page |

### Example: Navigating Pages

```bash
# First page (default)
GET /admin/jobs?page=1&limit=50

# Second page
GET /admin/jobs?page=2&limit=50

# Custom page size
GET /admin/jobs?page=1&limit=25
```

---

## Cron Expression Guide

Cron expressions are used to schedule recurring jobs. They consist of 5 fields:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, 0=Sunday, 7=Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Examples

| Expression | Description | Next Run Example |
|------------|-------------|------------------|
| `0 6 * * *` | Daily at 6:00 AM | Today/Tomorrow at 6:00 AM |
| `0 */2 * * *` | Every 2 hours | Next even hour (0:00, 2:00, 4:00, etc.) |
| `30 8 * * 1-5` | 8:30 AM on weekdays | Next weekday at 8:30 AM |
| `0 0 1 * *` | Monthly on 1st at midnight | 1st of next month at 00:00 |
| `0 9 * * 1` | Every Monday at 9:00 AM | Next Monday at 9:00 AM |
| `*/15 * * * *` | Every 15 minutes | Next 15-minute mark |
| `0 0 * * 0` | Every Sunday at midnight | Next Sunday at 00:00 |
| `0 12 15 * *` | 15th of month at noon | 15th of this/next month at 12:00 |

### Special Characters

- `*` - Any value (every minute, every hour, etc.)
- `/` - Step values (e.g., `*/5` = every 5)
- `,` - List values (e.g., `1,3,5` = 1st, 3rd, 5th)
- `-` - Range values (e.g., `1-5` = 1 through 5)

### Timezone Handling

All cron schedules respect the `timezone` field. Default timezone is `America/New_York`.

**Example with different timezones**:
- Schedule: `0 8 * * *` (8:00 AM)
- Timezone: `America/Los_Angeles`
- Runs at: 8:00 AM Pacific Time (11:00 AM Eastern Time)

### Validation

Invalid cron expressions will return a 400 error:

```json
{
  "statusCode": 400,
  "message": "Invalid cron expression: Expected 5 fields, got 4"
}
```

---

## BullMQ Integration Notes

### Queue Architecture

The system uses two BullMQ queues backed by Redis:

| Queue Name | Purpose | Job Types |
|------------|---------|-----------|
| `email` | Email sending jobs | send-email |
| `scheduled` | Scheduled task execution | expiry-check, data-cleanup, job-retention, partition-maintenance, etc. |

### Job Lifecycle

```
pending → processing → completed
                     ↓
                   failed → retry (up to max_retries)
                          ↓
                   dead letter queue
```

### Retry Logic

**Email Queue** (send-email jobs):
- Max retries: 3
- Retry strategy: Exponential backoff
- Delays: 2s, 10s, 50s
- Failed jobs retained for manual intervention

**Scheduled Queue** (all scheduled jobs):
- Max retries: Configurable per job (default 1)
- Retry strategy: Fixed delay
- Failed jobs retained for debugging

### Job Status Tracking

Jobs are tracked in two places:

1. **BullMQ (Redis)**: Active queue management
   - Waiting jobs
   - Active (processing) jobs
   - Completed jobs (temporary)
   - Failed jobs (temporary)

2. **Database (MySQL)**: Permanent record
   - Complete job history
   - Execution logs
   - Email queue tracking
   - Retention: 30 days (configurable via job-retention scheduled job)

### Queue Health Monitoring

Use `GET /admin/jobs/health/status` to monitor:
- Queue sizes (waiting, active)
- Completed job counts
- Failed job counts
- Database vs Redis consistency

### Performance Considerations

- **Concurrency**: Max 10 concurrent workers (configurable)
- **Rate Limiting**: 50 emails/second (configurable)
- **Job Timeout**: Configurable per scheduled job (default 300 seconds)
- **Cleanup**: Old jobs auto-deleted after 30 days

---

## Testing Guide

### Using cURL

All examples in this documentation use cURL. Replace `{token}` with your actual JWT token.

### Using Postman

1. Import the API endpoints into Postman
2. Set Authorization → Type → Bearer Token
3. Paste your JWT token
4. Make requests

### Obtaining a JWT Token

To use these endpoints, you must first authenticate:

```bash
# Login to get JWT token
curl -X POST "https://api.lead360.app/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "admin@example.com",
    "is_platform_admin": true
  }
}
```

Use the `access_token` in the Authorization header for all requests.

### Swagger UI

Interactive API documentation is available at:
```
https://api.lead360.app/api/docs
```

Features:
- Try out endpoints directly
- See request/response schemas
- Automatic authentication
- Real-time validation

---

## Support

For questions, issues, or feature requests related to the Background Jobs API:

- **Documentation**: This file
- **API Reference**: https://api.lead360.app/api/docs
- **GitHub Issues**: [Report issues](https://github.com/lead360/api/issues)
- **Support Email**: support@lead360.app

---

**End of Background Jobs REST API Documentation**

**Version**: 1.0
**Last Updated**: January 2026
**Maintained by**: Lead360 Platform Team
