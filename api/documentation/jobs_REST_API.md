# Background Jobs Module - REST API Documentation

**Module**: Background Jobs & Email Services
**Version**: 1.0.0
**Last Updated**: January 7, 2026
**Base Path**: `/api/v1/admin/jobs`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [API Endpoints](#api-endpoints)
   - [Jobs Administration](#jobs-administration)
   - [Scheduled Jobs](#scheduled-jobs)
   - [Email Settings](#email-settings)
   - [Email Templates](#email-templates)
4. [Error Handling](#error-handling)
5. [Common Response Formats](#common-response-formats)

---

## Overview

The Background Jobs module provides APIs for:
- **Job Queue Management**: Monitor, retry, and manage background jobs
- **Scheduled Jobs**: Create and manage recurring cron-based jobs
- **Email Configuration**: Configure platform-wide SMTP settings
- **Email Templates**: Manage Handlebars email templates

**Total Endpoints**: 24

---

## Authentication & Authorization

### Required Headers

All endpoints require:

```http
Authorization: Bearer {jwt_token}
```

### Role Requirements

**All endpoints require**:
- Authentication: Valid JWT token
- Authorization: `Platform Admin` role

**Non-admin users will receive**:
```json
{
  "statusCode": 403,
  "errorCode": "AUTH_INSUFFICIENT_PERMISSIONS",
  "message": "Access denied. Required roles: Platform Admin",
  "error": "Forbidden",
  "timestamp": "2026-01-07T23:00:00.000Z",
  "path": "/api/v1/admin/jobs",
  "requestId": "req_abc123"
}
```

---

## API Endpoints

### Jobs Administration

**Base Path**: `/api/v1/admin/jobs`

#### 1. List All Jobs

```http
GET /api/v1/admin/jobs
```

**Description**: Retrieve all background jobs with filtering and pagination.

**Query Parameters**:

| Parameter  | Type     | Required | Default | Description                                    |
|------------|----------|----------|---------|------------------------------------------------|
| page       | number   | No       | 1       | Page number (1-indexed)                        |
| limit      | number   | No       | 50      | Items per page (max: 100)                      |
| status     | string   | No       | -       | Filter by status: `pending`, `processing`, `completed`, `failed` |
| job_type   | string   | No       | -       | Filter by job type: `send-email`, `expiry-check`, etc. |
| tenant_id  | string   | No       | -       | Filter by tenant ID (UUID)                     |
| date_from  | string   | No       | -       | Filter from date (ISO 8601)                    |
| date_to    | string   | No       | -       | Filter to date (ISO 8601)                      |

**Success Response (200)**:

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
      "job_type": "send-email",
      "status": "completed",
      "priority": 1,
      "attempts": 1,
      "max_attempts": 3,
      "scheduled_for": "2026-01-07T10:00:00.000Z",
      "started_at": "2026-01-07T10:00:05.000Z",
      "completed_at": "2026-01-07T10:00:10.000Z",
      "failed_at": null,
      "error_message": null,
      "created_at": "2026-01-07T09:59:55.000Z",
      "updated_at": "2026-01-07T10:00:10.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 10,
    "total_count": 487,
    "limit": 50
  }
}
```

---

#### 2. Get Job Details

```http
GET /api/v1/admin/jobs/:id
```

**Description**: Retrieve detailed information about a specific job including logs.

**Path Parameters**:

| Parameter | Type   | Required | Description  |
|-----------|--------|----------|--------------|
| id        | string | Yes      | Job ID (UUID)|

**Success Response (200)**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
  "job_type": "send-email",
  "status": "completed",
  "priority": 1,
  "attempts": 1,
  "max_attempts": 3,
  "scheduled_for": "2026-01-07T10:00:00.000Z",
  "started_at": "2026-01-07T10:00:05.000Z",
  "completed_at": "2026-01-07T10:00:10.000Z",
  "failed_at": null,
  "error_message": null,
  "created_at": "2026-01-07T09:59:55.000Z",
  "updated_at": "2026-01-07T10:00:10.000Z",
  "job_log": [
    {
      "id": "log-001",
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "log_level": "info",
      "message": "Email sent successfully",
      "metadata_json": "{\"messageId\":\"<abc@example.com>\"}",
      "timestamp": "2026-01-07T10:00:10.000Z"
    }
  ],
  "email_queue": {
    "id": "email-001",
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "to_email": "customer@example.com",
    "from_email": "noreply@lead360.app",
    "from_name": "Lead360 Platform",
    "subject": "Welcome to Lead360",
    "template_key": "welcome-email",
    "variables_json": "{\"name\":\"John Doe\"}",
    "sent_at": "2026-01-07T10:00:10.000Z",
    "failed_at": null,
    "error_message": null,
    "message_id": "<abc@example.com>"
  }
}
```

**Error Response (404)**:

```json
{
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Job not found",
  "error": "Not Found",
  "timestamp": "2026-01-07T23:00:00.000Z",
  "path": "/api/v1/admin/jobs/invalid-id",
  "requestId": "req_abc123"
}
```

---

#### 3. Retry Failed Job

```http
POST /api/v1/admin/jobs/:id/retry
```

**Description**: Retry a failed job by re-queuing it.

**Path Parameters**:

| Parameter | Type   | Required | Description  |
|-----------|--------|----------|--------------|
| id        | string | Yes      | Job ID (UUID)|

**Success Response (200)**:

```json
{
  "message": "Job re-queued successfully",
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Response (404)**:

```json
{
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Job not found",
  "error": "Not Found"
}
```

---

#### 4. Delete Job

```http
DELETE /api/v1/admin/jobs/:id
```

**Description**: Delete a job from the database.

**Path Parameters**:

| Parameter | Type   | Required | Description  |
|-----------|--------|----------|--------------|
| id        | string | Yes      | Job ID (UUID)|

**Success Response (200)**:

```json
{
  "message": "Job deleted successfully"
}
```

---

#### 5. Get Failed Jobs

```http
GET /api/v1/admin/jobs/failed
```

**Description**: Retrieve all failed jobs across all queues.

**Query Parameters**: Same as [List All Jobs](#1-list-all-jobs) (pagination only)

**Success Response (200)**:

```json
{
  "data": [
    {
      "id": "failed-job-001",
      "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
      "job_type": "send-email",
      "status": "failed",
      "attempts": 3,
      "max_attempts": 3,
      "error_message": "SMTP connection timeout",
      "failed_at": "2026-01-07T10:00:00.000Z",
      "created_at": "2026-01-07T09:30:00.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 2,
    "total_count": 15,
    "limit": 50
  }
}
```

---

#### 6. Retry All Failed Jobs

```http
POST /api/v1/admin/jobs/retry-all-failed
```

**Description**: Retry all failed jobs in the system.

**Success Response (200)**:

```json
{
  "message": "Re-queued 15 failed jobs successfully",
  "count": 15
}
```

---

#### 7. Clear All Jobs

```http
DELETE /api/v1/admin/jobs/clear-all
```

**Description**: Clear all jobs from all queues (completed and failed).

**⚠️ DANGER**: This operation is irreversible.

**Success Response (200)**:

```json
{
  "message": "All jobs cleared successfully"
}
```

---

#### 8. Health Check

```http
GET /api/v1/admin/jobs/health
```

**Description**: Check the health status of all job queues.

**Success Response (200)**:

```json
{
  "status": "healthy",
  "queues": {
    "email": {
      "waiting": 5,
      "active": 2,
      "completed": 1247,
      "failed": 3,
      "delayed": 0
    },
    "scheduled": {
      "waiting": 0,
      "active": 0,
      "completed": 89,
      "failed": 0,
      "delayed": 0
    }
  },
  "timestamp": "2026-01-07T23:00:00.000Z"
}
```

---

### Scheduled Jobs

**Base Path**: `/api/v1/admin/jobs/schedules`

#### 9. List Scheduled Jobs

```http
GET /api/v1/admin/jobs/schedules
```

**Description**: Retrieve all scheduled jobs (recurring cron-based jobs).

**Query Parameters**:

| Parameter  | Type    | Required | Default | Description                     |
|------------|---------|----------|---------|---------------------------------|
| page       | number  | No       | 1       | Page number                     |
| limit      | number  | No       | 50      | Items per page                  |
| is_enabled | boolean | No       | -       | Filter by enabled status        |

**Success Response (200)**:

```json
{
  "data": [
    {
      "id": "schedule-001",
      "job_type": "expiry-check",
      "name": "Daily Expiry Check",
      "description": "Check for expiring quotes, invoices, and documents",
      "schedule": "0 0 * * *",
      "timezone": "America/New_York",
      "is_enabled": true,
      "last_run_at": "2026-01-07T00:00:00.000Z",
      "next_run_at": "2026-01-08T00:00:00.000Z",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-07T00:00:05.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_count": 5,
    "limit": 50
  }
}
```

---

#### 10. Get Scheduled Job

```http
GET /api/v1/admin/jobs/schedules/:id
```

**Description**: Retrieve a specific scheduled job.

**Path Parameters**:

| Parameter | Type   | Required | Description         |
|-----------|--------|----------|---------------------|
| id        | string | Yes      | Scheduled Job ID    |

**Success Response (200)**:

```json
{
  "id": "schedule-001",
  "job_type": "expiry-check",
  "name": "Daily Expiry Check",
  "description": "Check for expiring quotes, invoices, and documents",
  "schedule": "0 0 * * *",
  "timezone": "America/New_York",
  "is_enabled": true,
  "last_run_at": "2026-01-07T00:00:00.000Z",
  "next_run_at": "2026-01-08T00:00:00.000Z",
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-07T00:00:05.000Z"
}
```

---

#### 11. Create Scheduled Job

```http
POST /api/v1/admin/jobs/schedules
```

**Description**: Create a new scheduled job.

**Request Body**:

```json
{
  "job_type": "data-cleanup",
  "name": "Weekly Data Cleanup",
  "description": "Remove old audit logs and temporary data",
  "schedule": "0 2 * * 0",
  "timezone": "UTC",
  "is_enabled": true
}
```

**Validation Rules**:

| Field       | Type    | Required | Min Length | Max Length | Notes                          |
|-------------|---------|----------|------------|------------|--------------------------------|
| job_type    | string  | Yes      | 3          | 100        | Must be unique, kebab-case     |
| name        | string  | Yes      | 3          | 200        | Descriptive name               |
| description | string  | No       | -          | -          | Detailed description           |
| schedule    | string  | Yes      | 9          | 100        | Valid cron expression          |
| timezone    | string  | No       | -          | 100        | IANA timezone (default: UTC)   |
| is_enabled  | boolean | No       | -          | -          | Default: true                  |

**Success Response (201)**:

```json
{
  "id": "schedule-002",
  "job_type": "data-cleanup",
  "name": "Weekly Data Cleanup",
  "description": "Remove old audit logs and temporary data",
  "schedule": "0 2 * * 0",
  "timezone": "UTC",
  "is_enabled": true,
  "last_run_at": null,
  "next_run_at": "2026-01-12T02:00:00.000Z",
  "created_at": "2026-01-07T23:00:00.000Z",
  "updated_at": "2026-01-07T23:00:00.000Z"
}
```

**Error Response (400)**:

```json
{
  "statusCode": 400,
  "errorCode": "VALIDATION_FAILED",
  "message": "Invalid cron expression: '0 2 * *'. Expected 5 fields.",
  "error": "Bad Request"
}
```

---

#### 12. Update Scheduled Job

```http
PATCH /api/v1/admin/jobs/schedules/:id
```

**Description**: Update an existing scheduled job.

**Path Parameters**:

| Parameter | Type   | Required | Description         |
|-----------|--------|----------|---------------------|
| id        | string | Yes      | Scheduled Job ID    |

**Request Body** (all fields optional):

```json
{
  "name": "Daily Data Cleanup",
  "description": "Updated description",
  "schedule": "0 3 * * *",
  "timezone": "America/Los_Angeles",
  "is_enabled": false
}
```

**Success Response (200)**:

```json
{
  "id": "schedule-002",
  "job_type": "data-cleanup",
  "name": "Daily Data Cleanup",
  "description": "Updated description",
  "schedule": "0 3 * * *",
  "timezone": "America/Los_Angeles",
  "is_enabled": false,
  "last_run_at": null,
  "next_run_at": "2026-01-08T03:00:00.000Z",
  "created_at": "2026-01-07T23:00:00.000Z",
  "updated_at": "2026-01-07T23:05:00.000Z"
}
```

---

#### 13. Delete Scheduled Job

```http
DELETE /api/v1/admin/jobs/schedules/:id
```

**Description**: Delete a scheduled job.

**Path Parameters**:

| Parameter | Type   | Required | Description         |
|-----------|--------|----------|---------------------|
| id        | string | Yes      | Scheduled Job ID    |

**Success Response (200)**:

```json
{
  "message": "Scheduled job deleted successfully"
}
```

---

#### 14. Trigger Scheduled Job Manually

```http
POST /api/v1/admin/jobs/schedules/:id/trigger
```

**Description**: Manually trigger a scheduled job to run immediately.

**Path Parameters**:

| Parameter | Type   | Required | Description         |
|-----------|--------|----------|---------------------|
| id        | string | Yes      | Scheduled Job ID    |

**Success Response (200)**:

```json
{
  "message": "Scheduled job triggered successfully",
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### 15. Get Scheduled Job Execution History

```http
GET /api/v1/admin/jobs/schedules/:id/history
```

**Description**: Retrieve execution history for a scheduled job.

**Path Parameters**:

| Parameter | Type   | Required | Description         |
|-----------|--------|----------|---------------------|
| id        | string | Yes      | Scheduled Job ID    |

**Query Parameters**:

| Parameter | Type   | Required | Default | Description    |
|-----------|--------|----------|---------|----------------|
| page      | number | No       | 1       | Page number    |
| limit     | number | No       | 50      | Items per page |

**Success Response (200)**:

```json
{
  "data": [
    {
      "id": "job-001",
      "job_type": "expiry-check",
      "status": "completed",
      "started_at": "2026-01-07T00:00:00.000Z",
      "completed_at": "2026-01-07T00:00:15.000Z",
      "error_message": null
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_count": 247,
    "limit": 50
  }
}
```

---

### Email Settings

**Base Path**: `/api/v1/admin/jobs/email-settings`

#### 16. Get Email Configuration

```http
GET /api/v1/admin/jobs/email-settings
```

**Description**: Retrieve current platform-wide SMTP configuration (password masked).

**Success Response (200)**:

```json
{
  "id": "email-config-001",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_encryption": "tls",
  "smtp_username": "noreply@lead360.app",
  "smtp_password": "********",
  "from_email": "noreply@lead360.app",
  "from_name": "Lead360 Platform",
  "is_verified": true,
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-07T12:00:00.000Z"
}
```

**When no configuration exists**:

```json
null
```

---

#### 17. Update Email Configuration

```http
PATCH /api/v1/admin/jobs/email-settings
```

**Description**: Update platform-wide SMTP configuration. Password is encrypted with AES-256-GCM.

**Request Body**:

```json
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_encryption": "tls",
  "smtp_username": "noreply@lead360.app",
  "smtp_password": "your-app-password-here",
  "from_email": "noreply@lead360.app",
  "from_name": "Lead360 Platform"
}
```

**Validation Rules**:

| Field           | Type    | Required | Min | Max | Notes                                    |
|-----------------|---------|----------|-----|-----|------------------------------------------|
| smtp_host       | string  | Yes      | 3   | 255 | SMTP server hostname                     |
| smtp_port       | number  | Yes      | 1   | 65535 | Valid port number                     |
| smtp_encryption | string  | Yes      | -   | -   | Must be: `tls`, `ssl`, or `none`         |
| smtp_username   | string  | Yes      | 3   | 255 | SMTP username (usually email)            |
| smtp_password   | string  | Yes      | 8   | 255 | SMTP password (encrypted before storage) |
| from_email      | string  | Yes      | -   | 255 | Valid email address                      |
| from_name       | string  | Yes      | 2   | 255 | Display name for outgoing emails         |

**Success Response (200)**:

```json
{
  "id": "email-config-001",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_encryption": "tls",
  "smtp_username": "noreply@lead360.app",
  "smtp_password": "********",
  "from_email": "noreply@lead360.app",
  "from_name": "Lead360 Platform",
  "is_verified": false,
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-07T23:00:00.000Z"
}
```

**Notes**:
- `is_verified` is automatically set to `false` when config is updated
- Use the [Send Test Email](#18-send-test-email) endpoint to verify configuration

---

#### 18. Send Test Email

```http
POST /api/v1/admin/jobs/email-settings/test
```

**Description**: Send a test email to verify SMTP configuration. If successful, marks config as verified.

**Request Body**:

```json
{
  "to_email": "admin@company.com"
}
```

**Validation Rules**:

| Field    | Type   | Required | Notes               |
|----------|--------|----------|---------------------|
| to_email | string | Yes      | Valid email address |

**Success Response (200)**:

```json
{
  "message": "Test email sent successfully",
  "messageId": "<550e8400-e29b-41d4-a716-446655440000@lead360.app>"
}
```

**Error Response (400)**:

```json
{
  "statusCode": 400,
  "errorCode": "VALIDATION_FAILED",
  "message": "SMTP test failed: Connection timeout",
  "error": "Bad Request"
}
```

---

### Email Templates

**Base Path**: `/api/v1/admin/jobs/email-templates`

#### 19. List Email Templates

```http
GET /api/v1/admin/jobs/email-templates
```

**Description**: Retrieve all email templates.

**Query Parameters**:

| Parameter | Type   | Required | Default | Description        |
|-----------|--------|----------|---------|--------------------|
| page      | number | No       | 1       | Page number        |
| limit     | number | No       | 50      | Items per page     |

**Success Response (200)**:

```json
{
  "data": [
    {
      "id": "template-001",
      "template_key": "welcome-email",
      "name": "Welcome Email",
      "subject": "Welcome to {{company_name}}!",
      "body_html": "<h1>Welcome {{user_name}}!</h1><p>Thank you for joining {{company_name}}.</p>",
      "body_text": "Welcome {{user_name}}! Thank you for joining {{company_name}}.",
      "variables_schema": {
        "user_name": "string",
        "company_name": "string"
      },
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-07T12:00:00.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 2,
    "total_count": 12,
    "limit": 50
  }
}
```

---

#### 20. Get Email Template

```http
GET /api/v1/admin/jobs/email-templates/:templateKey
```

**Description**: Retrieve a specific email template by template key.

**Path Parameters**:

| Parameter   | Type   | Required | Description                      |
|-------------|--------|----------|----------------------------------|
| templateKey | string | Yes      | Template Key (e.g., "welcome-email") |

**Success Response (200)**:

```json
{
  "id": "template-001",
  "template_key": "welcome-email",
  "name": "Welcome Email",
  "subject": "Welcome to {{company_name}}!",
  "body_html": "<h1>Welcome {{user_name}}!</h1><p>Thank you for joining {{company_name}}.</p>",
  "body_text": "Welcome {{user_name}}! Thank you for joining {{company_name}}.",
  "variables_schema": {
    "user_name": "string",
    "company_name": "string"
  },
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-07T12:00:00.000Z"
}
```

---

#### 21. Create Email Template

```http
POST /api/v1/admin/jobs/email-templates
```

**Description**: Create a new email template with Handlebars syntax validation.

**Request Body**:

```json
{
  "template_key": "password-reset",
  "name": "Password Reset Email",
  "subject": "Reset your password for {{company_name}}",
  "body_html": "<h1>Password Reset Request</h1><p>Click <a href=\"{{reset_link}}\">here</a> to reset your password.</p>",
  "body_text": "Password Reset Request\n\nClick here to reset your password: {{reset_link}}",
  "variables_schema": {
    "company_name": "string",
    "reset_link": "string"
  }
}
```

**Validation Rules**:

| Field            | Type   | Required | Min Length | Max Length | Notes                                    |
|------------------|--------|----------|------------|------------|------------------------------------------|
| template_key     | string | Yes      | 3          | 100        | Unique, lowercase, kebab-case            |
| name             | string | Yes      | 3          | 200        | Human-readable name                      |
| subject          | string | Yes      | 3          | 500        | Email subject line (supports Handlebars) |
| body_html        | string | Yes      | 10         | -          | HTML email body (Handlebars validated)   |
| body_text        | string | No       | -          | -          | Plain text fallback                      |
| variables_schema | object | No       | -          | -          | JSON schema defining template variables  |

**Success Response (201)**:

```json
{
  "id": "template-002",
  "template_key": "password-reset",
  "name": "Password Reset Email",
  "subject": "Reset your password for {{company_name}}",
  "body_html": "<h1>Password Reset Request</h1><p>Click <a href=\"{{reset_link}}\">here</a> to reset your password.</p>",
  "body_text": "Password Reset Request\n\nClick here to reset your password: {{reset_link}}",
  "variables_schema": {
    "company_name": "string",
    "reset_link": "string"
  },
  "created_at": "2026-01-07T23:00:00.000Z",
  "updated_at": "2026-01-07T23:00:00.000Z"
}
```

**Error Response (400)**:

```json
{
  "statusCode": 400,
  "errorCode": "VALIDATION_FAILED",
  "message": "Invalid Handlebars syntax in body_html: Expected '}}' but found EOF",
  "error": "Bad Request"
}
```

---

#### 22. Update Email Template

```http
PATCH /api/v1/admin/jobs/email-templates/:templateKey
```

**Description**: Update an existing email template.

**Path Parameters**:

| Parameter   | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| templateKey | string | Yes      | Template Key (e.g., "password-reset")    |

**Request Body** (all fields optional):

```json
{
  "name": "Updated Template Name",
  "subject": "New subject: {{company_name}}",
  "body_html": "<h1>Updated HTML</h1>",
  "body_text": "Updated plain text",
  "variables_schema": {
    "company_name": "string"
  }
}
```

**Success Response (200)**:

```json
{
  "id": "template-002",
  "template_key": "password-reset",
  "name": "Updated Template Name",
  "subject": "New subject: {{company_name}}",
  "body_html": "<h1>Updated HTML</h1>",
  "body_text": "Updated plain text",
  "variables_schema": {
    "company_name": "string"
  },
  "created_at": "2026-01-07T23:00:00.000Z",
  "updated_at": "2026-01-07T23:10:00.000Z"
}
```

---

#### 23. Delete Email Template

```http
DELETE /api/v1/admin/jobs/email-templates/:templateKey
```

**Description**: Delete an email template.

**Path Parameters**:

| Parameter   | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| templateKey | string | Yes      | Template Key (e.g., "welcome-email")     |

**Success Response (200)**:

```json
{
  "message": "Email template deleted successfully"
}
```

---

#### 24. Preview Email Template

```http
POST /api/v1/admin/jobs/email-templates/:templateKey/preview
```

**Description**: Render an email template with provided variables (for testing).

**Path Parameters**:

| Parameter   | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| templateKey | string | Yes      | Template Key (e.g., "test-email")        |

**Request Body**:

```json
{
  "variables": {
    "user_name": "John Doe",
    "company_name": "ACME Corp",
    "reset_link": "https://app.lead360.app/reset-password?token=abc123"
  }
}
```

**Success Response (200)**:

```json
{
  "subject": "Reset your password for ACME Corp",
  "html_body": "<h1>Password Reset Request</h1><p>Click <a href=\"https://app.lead360.app/reset-password?token=abc123\">here</a> to reset your password.</p>",
  "text_body": "Password Reset Request\n\nClick here to reset your password: https://app.lead360.app/reset-password?token=abc123"
}
```

---

## Error Handling

### Standard Error Response Format

All errors follow this format:

```json
{
  "statusCode": 400,
  "errorCode": "VALIDATION_FAILED",
  "message": "Detailed error message",
  "error": "Bad Request",
  "timestamp": "2026-01-07T23:00:00.000Z",
  "path": "/api/v1/admin/jobs/schedules",
  "requestId": "req_abc123def456"
}
```

### Common Error Codes

| HTTP Status | Error Code                    | Description                          |
|-------------|-------------------------------|--------------------------------------|
| 400         | VALIDATION_FAILED             | Request body validation failed       |
| 400         | VALIDATION_INVALID_INPUT      | Invalid input format                 |
| 401         | AUTH_NOT_AUTHENTICATED        | Missing or invalid JWT token         |
| 401         | AUTH_TOKEN_INVALID            | JWT token expired or malformed       |
| 403         | AUTH_INSUFFICIENT_PERMISSIONS | User lacks Platform Admin role       |
| 404         | RESOURCE_NOT_FOUND            | Resource not found (generic)         |
| 409         | CONFLICT_*                    | Resource conflict (e.g., duplicate)  |
| 500         | SERVER_INTERNAL_ERROR         | Unexpected server error              |

---

## Common Response Formats

### Pagination Response

```json
{
  "data": [ /* Array of resources */ ],
  "pagination": {
    "current_page": 1,
    "total_pages": 10,
    "total_count": 487,
    "limit": 50
  }
}
```

### Success Message Response

```json
{
  "message": "Operation completed successfully"
}
```

---

## Changelog

| Date       | Version | Changes                                    |
|------------|---------|--------------------------------------------|
| 2026-01-07 | 1.0.0   | Initial API documentation created          |
| 2026-01-07 | 1.0.1   | Fixed routing conflicts (email-settings)   |
| 2026-01-07 | 1.0.2   | Fixed email template preview endpoint docs |

---

## Support & Issues

For API support or to report issues:
- GitHub Issues: [Lead360 Issues](https://github.com/lead360/issues)
- Documentation: `/var/www/lead360.app/documentation/`

---

**End of Background Jobs REST API Documentation**
