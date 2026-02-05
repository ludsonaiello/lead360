# Quote Template Builder System - REST API Documentation

**Version**: 1.0
**Last Updated**: February 4, 2026
**Base URL**: `https://api.lead360.app/api/v1`

---

## Overview

The Template Builder System provides a comprehensive API for creating, managing, and rendering quote templates. It supports two distinct template types:

1. **Visual Templates**: Component-based drag-and-drop templates with JSON structure
2. **Code Templates**: Handlebars-based HTML/CSS templates for power users

This system includes:
- Component library management (21 pre-built components)
- Pre-built template library (20 industry-specific templates)
- Template versioning and history
- Multi-tenant isolation (global + tenant-specific)
- Security validation (XSS, injection prevention)
- PDF generation via Puppeteer

---

## Authentication & Authorization

**Authentication**: All endpoints require JWT Bearer token authentication.

```
Authorization: Bearer <jwt_token>
```

**RBAC**: All endpoints require `Platform Admin` role with `platform_admin:manage_templates` permission.

**Tenant Isolation**: All queries automatically filter by `tenant_id` via middleware. Platform templates use `tenant_id = NULL`.

---

## Endpoints Overview

### Template Management (8 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/quotes/templates` | Create template |
| GET | `/admin/quotes/templates` | List all templates |
| GET | `/admin/quotes/templates/:id` | Get template details |
| PATCH | `/admin/quotes/templates/:id` | Update template |
| DELETE | `/admin/quotes/templates/:id` | Delete template |
| POST | `/admin/quotes/templates/:id/clone` | Clone template |
| PATCH | `/admin/quotes/templates/:id/set-default` | Set as platform default |
| GET | `/admin/quotes/templates/variables/schema` | Get template variables |

### Template Testing & Preview (6 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/quotes/templates/:id/preview` | Preview template |
| POST | `/admin/quotes/templates/:id/test-pdf` | Test PDF generation |
| POST | `/admin/quotes/templates/:id/validate` | Validate syntax |
| POST | `/admin/quotes/templates/:id/test-email` | Test email rendering |
| GET | `/admin/quotes/templates/:id/versions` | Get version history |
| POST | `/admin/quotes/templates/:id/restore-version` | Restore version |

### Visual Template Builder (7 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/quotes/templates/visual` | Create visual template |
| POST | `/admin/quotes/templates/:id/visual/components` | Add component to template |
| PATCH | `/admin/quotes/templates/:id/visual/components/:componentId` | Update component |
| DELETE | `/admin/quotes/templates/:id/visual/components/:componentId` | Remove component |
| POST | `/admin/quotes/templates/:id/visual/reorder` | Reorder components |
| POST | `/admin/quotes/templates/:id/visual/theme` | Apply theme |
| GET | `/admin/quotes/templates/:id/visual/export-code` | Export to HTML/CSS |

### Code Template Builder (4 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/quotes/templates/code` | Create code template |
| PATCH | `/admin/quotes/templates/:id/code` | Update code template |
| POST | `/admin/quotes/templates/code/validate` | Validate Handlebars |
| GET | `/admin/quotes/templates/code/variables` | Get variable schema |

### Component Library (6 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/quotes/templates/components` | List components |
| GET | `/admin/quotes/templates/components/:id` | Get component details |
| POST | `/admin/quotes/templates/components` | Create component |
| PATCH | `/admin/quotes/templates/components/:id` | Update component |
| DELETE | `/admin/quotes/templates/components/:id` | Delete component |
| POST | `/admin/quotes/templates/components/:id/preview` | Preview component |

### Pre-built Templates & Migration (4 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/quotes/templates/prebuilt` | List pre-built templates |
| POST | `/admin/quotes/templates/prebuilt/:id/clone` | Clone pre-built template |
| POST | `/admin/quotes/templates/migration/run` | Run template migration |
| GET | `/admin/quotes/templates/migration/stats` | Get migration statistics |

### Tenant Templates (3 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/quotes/templates` | Get available templates |
| GET | `/quotes/templates/:id` | Get template details |
| PATCH | `/quotes/templates/active` | Set active template |

---

## Template Management Endpoints

### 1. Create Template

Create a new template (auto-detects type based on content).

**Endpoint**: `POST /admin/quotes/templates`

**Authentication**: Required (JWT + Platform Admin)

**Request Body**:
```json
{
  "name": "Classic Business Quote",
  "description": "Traditional business template",
  "html_content": "<!DOCTYPE html><html>...</html>",
  "thumbnail_url": "https://cdn.example.com/thumb.png",
  "tenant_id": "550e8400-e29b-41d4-a716",
  "is_global": false,
  "is_default": false
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Template name (1-200 chars) |
| description | string | No | Template description |
| html_content | string | Yes | Handlebars HTML content (min 1 char) |
| thumbnail_url | string | No | Thumbnail image URL |
| tenant_id | string (UUID) | No | Tenant UUID (for tenant-specific templates) |
| is_global | boolean | No | Is global template? (default: false) |
| is_default | boolean | No | Set as default? (default: false) |

**Success Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-uuid-here",
  "name": "Classic Business Quote",
  "description": "Traditional business template",
  "template_type": "code",
  "visual_structure": null,
  "html_content": "<!DOCTYPE html><html>...</html>",
  "css_content": null,
  "category_id": null,
  "tags": null,
  "thumbnail_url": "https://cdn.example.com/thumb.png",
  "is_prebuilt": false,
  "source_template_id": null,
  "is_global": false,
  "is_active": true,
  "is_default": false,
  "created_by_user_id": "user-uuid-here",
  "created_at": "2026-02-04T12:00:00.000Z",
  "updated_at": "2026-02-04T12:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input (validation failed)
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Insufficient permissions
- `500 Internal Server Error`: Server error

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Classic Business Quote",
    "html_content": "<!DOCTYPE html><html>...</html>"
  }'
```

---

### 2. List All Templates

List all templates with usage statistics (admin only).

**Endpoint**: `GET /admin/quotes/templates`

**Authentication**: Required (JWT + Platform Admin)

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| is_active | boolean | No | Filter by active status |
| is_global | boolean | No | Filter by global/tenant |
| tenant_id | string (UUID) | No | Filter by tenant ID |
| page | number | No | Page number (default: 1, min: 1) |
| limit | number | No | Items per page (default: 50, min: 1, max: 100) |

**Success Response** (200 OK):
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "tenant-uuid-here",
      "name": "Modern Professional Quote",
      "description": "Clean, modern template",
      "template_type": "visual",
      "visual_structure": {...},
      "html_content": null,
      "css_content": null,
      "category_id": "cat-uuid",
      "tags": ["modern", "professional"],
      "thumbnail_url": null,
      "is_prebuilt": false,
      "source_template_id": null,
      "is_global": false,
      "is_active": true,
      "is_default": false,
      "created_by_user_id": "user-uuid",
      "created_at": "2026-02-04T12:00:00.000Z",
      "updated_at": "2026-02-04T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "pages": 1
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Insufficient permissions

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/templates?is_active=true&page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Template Details

Get detailed information about a specific template.

**Endpoint**: `GET /admin/quotes/templates/:id`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-uuid-here",
  "name": "Modern Professional Quote",
  "description": "Clean, modern template",
  "template_type": "visual",
  "visual_structure": {...},
  "html_content": null,
  "css_content": null,
  "category_id": "cat-uuid",
  "tags": ["modern", "professional"],
  "thumbnail_url": null,
  "is_prebuilt": false,
  "source_template_id": null,
  "is_global": false,
  "is_active": true,
  "is_default": false,
  "created_by_user_id": "user-uuid",
  "created_at": "2026-02-04T12:00:00.000Z",
  "updated_at": "2026-02-04T12:00:00.000Z",
  "category": {
    "id": "cat-uuid",
    "name": "Modern",
    "description": "Modern templates",
    "icon_name": "modern-icon",
    "sort_order": 1,
    "is_active": true,
    "created_at": "2026-02-04T10:00:00.000Z",
    "updated_at": "2026-02-04T10:00:00.000Z"
  },
  "created_by_user": {
    "id": "user-uuid",
    "email": "[email protected]",
    "name": "John Doe"
  },
  "source_template": null
}
```

**Error Responses**:
- `404 Not Found`: Template not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Insufficient permissions

**Example Request**:
```bash
curl -X GET https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

---

### 4. Update Template

Update template metadata (name, description, etc.).

**Endpoint**: `PATCH /admin/quotes/templates/:id`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Request Body** (all fields optional):
```json
{
  "name": "Updated Template Name",
  "description": "Updated description",
  "thumbnail_url": "https://cdn.example.com/new-thumb.png",
  "is_active": true
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | Template name (1-200 chars) |
| description | string | No | Template description |
| html_content | string | No | Handlebars HTML content |
| thumbnail_url | string | No | Thumbnail image URL |
| is_global | boolean | No | Is global template? |
| is_default | boolean | No | Set as default? |
| is_active | boolean | No | Is template active? |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Updated Template Name",
  "description": "Updated description",
  "updated_at": "2026-02-04T13:00:00.000Z",
  ...
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input
- `404 Not Found`: Template not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Insufficient permissions

**Example Request**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Template Name",
    "is_active": true
  }'
```

---

### 5. Delete Template

Delete a template (only if not in use or not default).

**Endpoint**: `DELETE /admin/quotes/templates/:id`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Success Response** (204 No Content):
```
(no response body)
```

**Error Responses**:
- `400 Bad Request`: Cannot delete template (in use or is default)
- `404 Not Found`: Template not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Insufficient permissions

**Example Request**:
```bash
curl -X DELETE https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

---

### 6. Clone Template

Create a copy of an existing template.

**Endpoint**: `POST /admin/quotes/templates/:id/clone`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID to clone |

**Request Body**:
```json
{
  "new_name": "Modern Professional Quote V2"
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| new_name | string | No | Custom name for cloned template (defaults to "Copy of [Original]") |

**Success Response** (201 Created):
```json
{
  "id": "new-template-uuid",
  "tenant_id": "tenant-uuid-here",
  "name": "Modern Professional Quote V2",
  "description": "Clean, modern template",
  "template_type": "visual",
  "source_template_id": "550e8400-e29b-41d4-a716-446655440000",
  "is_prebuilt": false,
  "is_active": true,
  "created_at": "2026-02-04T14:00:00.000Z",
  ...
}
```

**Error Responses**:
- `404 Not Found`: Template not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Insufficient permissions

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/clone \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_name": "Modern Professional Quote V2"
  }'
```

---

### 7. Set Template as Platform Default

Set a global template as the platform default for all tenants.

**Endpoint**: `PATCH /admin/quotes/templates/:id/set-default`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Modern Professional Quote",
  "is_global": true,
  "is_default": true,
  "updated_at": "2026-02-04T14:30:00.000Z",
  ...
}
```

**Error Responses**:
- `403 Forbidden`: Only global templates can be set as default
- `404 Not Found`: Template not found
- `401 Unauthorized`: Missing or invalid JWT token

**Example Request**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/set-default \
  -H "Authorization: Bearer <token>"
```

---

### 8. Get Template Variables Schema

Get the complete schema of available Handlebars variables and helpers.

**Endpoint**: `GET /admin/quotes/templates/variables/schema`

**Authentication**: Required (JWT + Platform Admin)

**Success Response** (200 OK):
```json
{
  "variables": {
    "quote": {
      "quote_number": "string",
      "created_at": "Date",
      "valid_until": "Date",
      "status": "string (draft | sent | approved | declined | expired)",
      "subtotal": "number",
      "discount_amount": "number",
      "discount_percent": "number",
      "tax_amount": "number",
      "tax_percent": "number",
      "total": "number",
      "notes": "string",
      "line_items": [
        {
          "name": "string",
          "description": "string",
          "quantity": "number",
          "unit_price": "number",
          "discount_percent": "number",
          "tax_percent": "number",
          "total": "number"
        }
      ]
    },
    "company": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "address": "string",
      "city": "string",
      "state": "string",
      "zip": "string",
      "website": "string",
      "logo_url": "string",
      "tagline": "string"
    },
    "customer": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "address": "string",
      "city": "string",
      "state": "string",
      "zip": "string"
    }
  },
  "helpers": [
    {
      "name": "currency",
      "usage": "{{currency value}}",
      "description": "Format number as currency ($1,234.56)"
    },
    {
      "name": "date",
      "usage": "{{date value}}",
      "description": "Format date (MM/DD/YYYY)"
    },
    {
      "name": "percent",
      "usage": "{{percent value}}",
      "description": "Format as percentage (12.5%)"
    },
    {
      "name": "multiply",
      "usage": "{{multiply a b}}",
      "description": "Multiply two numbers"
    },
    {
      "name": "eq",
      "usage": "{{#if (eq a b)}}...{{/if}}",
      "description": "Compare equality"
    }
  ]
}
```

**Example Request**:
```bash
curl -X GET https://api.lead360.app/api/v1/admin/quotes/templates/variables/schema \
  -H "Authorization: Bearer <token>"
```

---

## Template Testing & Preview Endpoints

### 9. Preview Template

Preview template with sample or real quote data.

**Endpoint**: `POST /admin/quotes/templates/:id/preview`

**Authentication**: Required (JWT + Platform Admin)

**Rate Limit**: 10 requests per minute

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Request Body**:
```json
{
  "preview_type": "standard",
  "use_real_quote": false,
  "quote_id": null
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| preview_type | enum | Yes | Sample data type: 'minimal' \| 'standard' \| 'complex' |
| use_real_quote | boolean | Yes | Use real quote data instead of sample? |
| quote_id | string (UUID) | No | Quote ID (required if use_real_quote=true) |

**Success Response** (200 OK):
```json
{
  "rendered_html": "<html>...</html>",
  "rendered_css": "body { ... }",
  "preview_url": "https://api.lead360.app/preview/temp-uuid",
  "expires_at": "2026-02-04T13:15:00.000Z"
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| rendered_html | string | Fully rendered HTML with data |
| rendered_css | string | Rendered CSS styles |
| preview_url | string | Temporary preview URL (expires after 15 minutes) |
| expires_at | string (ISO8601) | Preview expiration timestamp |

**Error Responses**:
- `404 Not Found`: Template or quote not found
- `429 Too Many Requests`: Rate limit exceeded
- `401 Unauthorized`: Missing or invalid JWT token

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/preview \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "preview_type": "standard",
    "use_real_quote": false
  }'
```

---

### 10. Test PDF Generation

Test PDF generation from template with performance metrics.

**Endpoint**: `POST /admin/quotes/templates/:id/test-pdf`

**Authentication**: Required (JWT + Platform Admin)

**Rate Limit**: 10 requests per minute

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Request Body**:
```json
{
  "preview_type": "standard",
  "quote_id": null
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| preview_type | enum | Yes | Sample data type: 'minimal' \| 'standard' \| 'complex' |
| quote_id | string (UUID) | No | Quote ID for real data (optional) |

**Success Response** (200 OK):
```json
{
  "pdf_url": "https://api.lead360.app/pdf/temp-uuid.pdf",
  "file_size_bytes": 245678,
  "generation_time_ms": 1234,
  "expires_at": "2026-02-04T13:15:00.000Z",
  "warnings": []
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| pdf_url | string | Temporary PDF download URL (expires after 15 minutes) |
| file_size_bytes | number | PDF file size in bytes |
| generation_time_ms | number | Time taken to generate PDF in milliseconds |
| expires_at | string (ISO8601) | PDF expiration timestamp |
| warnings | string[] | Array of warnings detected during PDF generation (optional) |

**Error Responses**:
- `404 Not Found`: Template not found
- `429 Too Many Requests`: Rate limit exceeded
- `401 Unauthorized`: Missing or invalid JWT token

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/test-pdf \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "preview_type": "standard"
  }'
```

---

### 11. Validate Template Syntax

Validate template for Handlebars syntax errors and missing variables.

**Endpoint**: `POST /admin/quotes/templates/:id/validate`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Success Response** (200 OK):
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "variables": [
    "quote.quote_number",
    "quote.created_at",
    "company.name",
    "customer.name"
  ],
  "security_scan": {
    "passed": true,
    "issues": []
  }
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| valid | boolean | Is syntax valid? |
| errors | string[] | Array of syntax error messages |
| warnings | string[] | Array of warning messages (non-blocking) |
| variables | string[] | Extracted Handlebars variables |
| security_scan | object | Security scan results |
| security_scan.passed | boolean | Did security scan pass? |
| security_scan.issues | string[] | Security issues found |

**Validation Error Response** (200 OK):
```json
{
  "valid": false,
  "errors": [
    "Line 5: Unclosed block helper '{{#if}}'"
  ],
  "warnings": [],
  "variables": [],
  "security_scan": {
    "passed": false,
    "issues": [
      "Forbidden tag detected: <script>",
      "Forbidden attribute detected: onclick"
    ]
  }
}
```

**Error Responses**:
- `404 Not Found`: Template not found
- `401 Unauthorized`: Missing or invalid JWT token

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/validate \
  -H "Authorization: Bearer <token>"
```

---

### 12. Test Email Rendering

Test email rendering and optionally send test email.

**Endpoint**: `POST /admin/quotes/templates/:id/test-email`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Request Body**:
```json
{
  "preview_type": "standard",
  "send_to_email": "[email protected]"
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| preview_type | enum | Yes | Sample data type: 'minimal' \| 'standard' \| 'complex' |
| send_to_email | string (email) | No | Email address to send test to (optional) |

**Success Response** (200 OK):
```json
{
  "html_preview": "<html>...</html>",
  "text_preview": "Plain text version...",
  "subject_line": "Quote #Q-12345",
  "test_email_sent": true,
  "email_job_id": "email-job-uuid"
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| html_preview | string | Rendered HTML email content |
| text_preview | string | Plain text version of email |
| subject_line | string | Email subject line |
| test_email_sent | boolean | Whether test email was sent |
| email_job_id | string | Email queue job ID (if test email was sent) |

**Error Responses**:
- `404 Not Found`: Template not found
- `401 Unauthorized`: Missing or invalid JWT token

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/test-email \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "preview_type": "standard",
    "send_to_email": "[email protected]"
  }'
```

---

### 13. Get Template Version History

Get complete version history for a template.

**Endpoint**: `GET /admin/quotes/templates/:id/versions`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Success Response** (200 OK):
```json
[
  {
    "id": "version-uuid-1",
    "template_id": "550e8400-e29b-41d4-a716-446655440000",
    "version_number": 3,
    "template_type": "visual",
    "visual_structure": {...},
    "html_content": null,
    "css_content": null,
    "changes_summary": "Updated theme colors and fonts",
    "render_time_ms": 45,
    "pdf_size_kb": 120,
    "created_by_user_id": "user-uuid",
    "created_at": "2026-02-04T15:00:00.000Z",
    "created_by_user": {
      "id": "user-uuid",
      "email": "[email protected]",
      "name": "John Doe"
    }
  },
  {
    "id": "version-uuid-2",
    "template_id": "550e8400-e29b-41d4-a716-446655440000",
    "version_number": 2,
    "template_type": "visual",
    "visual_structure": {...},
    "html_content": null,
    "css_content": null,
    "changes_summary": "Added payment schedule component",
    "render_time_ms": 42,
    "pdf_size_kb": 115,
    "created_by_user_id": "user-uuid",
    "created_at": "2026-02-04T14:00:00.000Z",
    "created_by_user": {
      "id": "user-uuid",
      "email": "[email protected]",
      "name": "John Doe"
    }
  }
]
```

**Response Fields** (each version):
| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Version UUID |
| template_id | string (UUID) | Parent template UUID |
| version_number | number | Sequential version number |
| template_type | string | Template type at this version ('visual' \| 'code') |
| visual_structure | object \| null | Visual structure (visual templates only) |
| html_content | string \| null | HTML content (code templates only) |
| css_content | string \| null | CSS styles |
| changes_summary | string \| null | Summary of changes made in this version (max 500 chars) |
| render_time_ms | number \| null | Render performance metric (milliseconds) |
| pdf_size_kb | number \| null | PDF size metric (kilobytes) |
| created_by_user_id | string \| null | Creator user UUID |
| created_at | string (ISO8601) | Version creation timestamp |
| created_by_user | object \| null | Creator user details |

**Error Responses**:
- `404 Not Found`: Template not found
- `401 Unauthorized`: Missing or invalid JWT token

**Example Request**:
```bash
curl -X GET https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/versions \
  -H "Authorization: Bearer <token>"
```

---

### 14. Restore Template Version

Restore template to a previous version.

**Endpoint**: `POST /admin/quotes/templates/:id/restore-version`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Request Body**:
```json
{
  "version": 2,
  "create_backup": true
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | number | Yes | Version number to restore to (min: 1) |
| create_backup | boolean | No | Create backup before restoring? (default: true) |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Modern Professional Quote",
  "template_type": "visual",
  "visual_structure": {...},
  "html_content": null,
  "css_content": null,
  "updated_at": "2026-02-04T16:00:00.000Z",
  ...
}
```

**Error Responses**:
- `404 Not Found`: Template or version not found
- `400 Bad Request`: Invalid version number
- `401 Unauthorized`: Missing or invalid JWT token

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/restore-version \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 2,
    "create_backup": true
  }'
```

---

## Visual Template Builder Endpoints

### 1. Create Visual Template

Create a new visual template with component-based structure.

**Endpoint**: `POST /admin/quotes/templates/visual`

**Authentication**: Required (JWT + Platform Admin)

**Request Body**:
```json
{
  "name": "Modern Professional Quote",
  "description": "Clean, modern template with horizontal header and card-style customer info",
  "category_id": "uuid-here",
  "tags": ["modern", "professional", "clean"],
  "layout_preset": "standard",
  "is_global": false,
  "theme": {
    "primaryColor": "#2563eb",
    "secondaryColor": "#64748b",
    "fontFamily": "Inter, Arial, sans-serif",
    "fontSize": 14,
    "lineHeight": 1.5
  }
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Template name (1-200 chars) |
| description | string | No | Template description |
| category_id | string (UUID) | No | Category ID |
| tags | string[] | No | Tags for categorization |
| layout_preset | string | No | Preset layout (blank, standard, modern, minimal) |
| is_global | boolean | No | Is global template? (default: false) |
| theme | object | No | Theme configuration |
| theme.primaryColor | string | No | Primary color (hex) |
| theme.secondaryColor | string | No | Secondary color (hex) |
| theme.fontFamily | string | No | Font family |
| theme.fontSize | number | No | Font size (8-72) |
| theme.lineHeight | number | No | Line height (0.5-3) |

**Success Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-uuid-here",
  "name": "Modern Professional Quote",
  "description": "Clean, modern template with horizontal header and card-style customer info",
  "template_type": "visual",
  "visual_structure": {
    "version": "1.0",
    "layout": {
      "pageSize": "letter",
      "orientation": "portrait",
      "margins": { "top": 50, "right": 50, "bottom": 50, "left": 50 },
      "header": { "enabled": true, "height": 120, "components": [] },
      "body": { "components": [] },
      "footer": { "enabled": false }
    },
    "theme": {
      "primaryColor": "#2563eb",
      "secondaryColor": "#64748b",
      "fontFamily": "Inter, Arial, sans-serif",
      "fontSize": 14,
      "lineHeight": 1.5
    }
  },
  "html_content": null,
  "css_content": null,
  "category_id": "uuid-here",
  "tags": ["modern", "professional", "clean"],
  "is_active": true,
  "is_prebuilt": false,
  "created_at": "2026-02-04T12:00:00.000Z",
  "updated_at": "2026-02-04T12:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input (validation failed)
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Insufficient permissions
- `500 Internal Server Error`: Server error

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/visual \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Modern Professional Quote",
    "description": "Clean, modern template",
    "layout_preset": "standard",
    "theme": {
      "primaryColor": "#2563eb",
      "fontSize": 14
    }
  }'
```

---

### 2. Add Component to Visual Template

Add a component instance to a visual template.

**Endpoint**: `POST /admin/quotes/templates/:id/visual/components`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Request Body**:
```json
{
  "component_id": "component-uuid-here",
  "component_type": "header",
  "section": "body",
  "position": {
    "x": 0,
    "y": 0,
    "width": "auto",
    "height": 120
  },
  "props": {
    "show_logo": true,
    "logo_width": 120,
    "background_color": "#ffffff"
  },
  "style": {
    "padding": "20px",
    "margin": "0"
  },
  "data_bindings": {
    "company_name": "{{company.name}}",
    "logo_url": "{{company.logo_url}}"
  },
  "conditions": {
    "show_if": "{{company.logo_url}}",
    "hide_if": null
  }
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| component_id | string (UUID) | No | Pre-built component UUID from library (optional if using component_type) |
| component_type | string | Yes | Component type: 'header' \| 'footer' \| 'customer_info' \| 'line_items' \| 'totals' \| 'terms' \| 'signature' \| 'payment_schedule' \| 'warranty' \| 'custom' |
| section | string | No | Section placement: 'header' \| 'body' \| 'footer' (default: 'body') |
| position | object | Yes | Component position and size |
| position.x | number | Yes | X position in pixels |
| position.y | number | Yes | Y position in pixels |
| position.width | number \| string | Yes | Width in pixels or "auto" |
| position.height | number \| string | Yes | Height in pixels or "auto" |
| props | object | No | Component properties (overrides defaults from component library) |
| style | object | No | Custom CSS styles for this component instance |
| data_bindings | object | No | Handlebars data bindings mapping component fields to data paths (e.g., {"field": "{{path.to.data}}"}) |
| conditions | object | No | Conditional rendering rules |
| conditions.show_if | string | No | Handlebars expression - show component if truthy |
| conditions.hide_if | string | No | Handlebars expression - hide component if truthy |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "visual_structure": {
    "version": "1.0",
    "layout": {
      "header": {
        "enabled": true,
        "height": 120,
        "components": [
          {
            "id": "comp-instance-1",
            "component_id": "component-uuid-here",
            "props": {
              "show_logo": true,
              "logo_width": 120,
              "background_color": "#ffffff"
            }
          }
        ]
      },
      "body": { "components": [] },
      "footer": { "enabled": false }
    }
  },
  "updated_at": "2026-02-04T12:05:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid component ID or section
- `404 Not Found`: Template not found
- `409 Conflict`: Max components exceeded (50 max)

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/visual/components \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "component_id": "component-uuid-here",
    "section": "header",
    "props": {
      "show_logo": true,
      "logo_width": 120
    }
  }'
```

---

### 3. Update Component in Visual Template

Update properties of an existing component instance.

**Endpoint**: `PATCH /admin/quotes/templates/:id/visual/components/:componentId`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |
| componentId | string | Component instance ID |

**Request Body** (all fields optional):
```json
{
  "position": {
    "x": 10,
    "y": 20,
    "width": 500,
    "height": 150
  },
  "props": {
    "show_logo": false,
    "background_color": "#f9fafb"
  },
  "style": {
    "padding": "30px",
    "border": "1px solid #ccc"
  },
  "data_bindings": {
    "company_name": "{{company.name}}",
    "tagline": "{{company.tagline}}"
  },
  "conditions": {
    "show_if": "{{company.logo_url}}",
    "hide_if": null
  }
}
```

**Request Fields** (all optional):
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| position | object | No | Updated component position and size (partial updates allowed) |
| position.x | number | No | Updated X position in pixels |
| position.y | number | No | Updated Y position in pixels |
| position.width | number \| string | No | Updated width in pixels or "auto" |
| position.height | number \| string | No | Updated height in pixels or "auto" |
| props | object | No | Updated component properties (merged with existing) |
| style | object | No | Updated custom CSS styles (merged with existing) |
| data_bindings | object | No | Updated Handlebars data bindings (merged with existing) |
| conditions | object | No | Updated conditional rendering rules |
| conditions.show_if | string | No | Updated show condition (Handlebars expression) |
| conditions.hide_if | string | No | Updated hide condition (Handlebars expression) |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "visual_structure": {
    "layout": {
      "header": {
        "components": [
          {
            "id": "comp-instance-1",
            "component_id": "component-uuid-here",
            "props": {
              "show_logo": false,
              "logo_width": 120,
              "background_color": "#f9fafb"
            }
          }
        ]
      }
    }
  },
  "updated_at": "2026-02-04T12:10:00.000Z"
}
```

**Error Responses**:
- `404 Not Found`: Template or component not found

**Example Request**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/visual/components/comp-instance-1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "props": {
      "show_logo": false
    }
  }'
```

---

### 4. Remove Component from Visual Template

Remove a component instance from a visual template.

**Endpoint**: `DELETE /admin/quotes/templates/:id/visual/components/:componentId`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |
| componentId | string | Component instance ID |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "visual_structure": {
    "layout": {
      "header": {
        "components": []
      }
    }
  },
  "updated_at": "2026-02-04T12:15:00.000Z"
}
```

**Error Responses**:
- `404 Not Found`: Template or component not found

**Example Request**:
```bash
curl -X DELETE https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/visual/components/comp-instance-1 \
  -H "Authorization: Bearer <token>"
```

---

### 5. Reorder Components in Visual Template

Reorder component instances within a section via drag-and-drop.

**Endpoint**: `POST /admin/quotes/templates/:id/visual/reorder`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Request Body**:
```json
{
  "section": "body",
  "component_ids": [
    "comp-instance-3",
    "comp-instance-1",
    "comp-instance-2"
  ]
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| section | string | Yes | Section (header, body, footer) |
| component_ids | string[] | Yes | Ordered array of component instance IDs |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "visual_structure": {
    "layout": {
      "body": {
        "components": [
          { "id": "comp-instance-3", "..." },
          { "id": "comp-instance-1", "..." },
          { "id": "comp-instance-2", "..." }
        ]
      }
    }
  },
  "updated_at": "2026-02-04T12:20:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid component IDs or section mismatch
- `404 Not Found`: Template not found

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/visual/reorder \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "section": "body",
    "component_ids": ["comp-3", "comp-1", "comp-2"]
  }'
```

---

### 6. Apply Theme to Visual Template

Apply or update theme colors and typography.

**Endpoint**: `POST /admin/quotes/templates/:id/visual/theme`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Request Body**:
```json
{
  "primaryColor": "#dc2626",
  "secondaryColor": "#991b1b",
  "fontFamily": "Arial, sans-serif",
  "fontSize": 13,
  "lineHeight": 1.6
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| primaryColor | string | No | Primary color (hex format: #RRGGBB) |
| secondaryColor | string | No | Secondary color (hex format) |
| fontFamily | string | No | Font family (max 100 chars) |
| fontSize | number | No | Font size (8-72) |
| lineHeight | number | No | Line height (0.5-3) |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "visual_structure": {
    "theme": {
      "primaryColor": "#dc2626",
      "secondaryColor": "#991b1b",
      "fontFamily": "Arial, sans-serif",
      "fontSize": 13,
      "lineHeight": 1.6
    }
  },
  "updated_at": "2026-02-04T12:25:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid color format or value out of range
- `404 Not Found`: Template not found

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/visual/theme \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryColor": "#dc2626",
    "fontSize": 13
  }'
```

---

### 7. Export Visual Template to Code

Export a visual template's compiled HTML/CSS for inspection or manual editing.

**Endpoint**: `GET /admin/quotes/templates/:id/visual/export-code`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Success Response** (200 OK):
```json
{
  "template_id": "550e8400-e29b-41d4-a716-446655440000",
  "template_name": "Modern Professional Quote",
  "html": "<!DOCTYPE html>\n<html>...",
  "css": "body { font-family: Inter, Arial, sans-serif; ... }",
  "compiled_at": "2026-02-04T12:30:00.000Z"
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| template_id | string (UUID) | Template ID |
| template_name | string | Template name |
| html | string | Compiled Handlebars HTML |
| css | string | Compiled CSS styles |
| compiled_at | string (ISO8601) | Compilation timestamp |

**Error Responses**:
- `404 Not Found`: Template not found
- `409 Conflict`: Template is not visual type

**Example Request**:
```bash
curl -X GET https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/visual/export-code \
  -H "Authorization: Bearer <token>"
```

---

## Code Template Builder Endpoints

### 8. Create Code Template

Create a new code template with Handlebars HTML/CSS.

**Endpoint**: `POST /admin/quotes/templates/code`

**Authentication**: Required (JWT + Platform Admin)

**Request Body**:
```json
{
  "name": "Classic Business Quote",
  "description": "Traditional business template with centered layout",
  "category_id": "uuid-here",
  "tags": ["classic", "traditional", "formal"],
  "html_content": "<!DOCTYPE html>\n<html>...",
  "css_content": "body { font-family: Georgia, serif; ... }",
  "is_global": false
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Template name (1-200 chars) |
| description | string | No | Template description |
| category_id | string (UUID) | No | Category ID |
| tags | string[] | No | Tags for categorization |
| html_content | string | Yes | Handlebars HTML (max 2MB) |
| css_content | string | No | CSS styles (max 2MB) |
| is_global | boolean | No | Is global template? (default: false) |

**Success Response** (201 Created):
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-uuid-here",
  "name": "Classic Business Quote",
  "description": "Traditional business template with centered layout",
  "template_type": "code",
  "visual_structure": null,
  "html_content": "<!DOCTYPE html>\n<html>...",
  "css_content": "body { font-family: Georgia, serif; ... }",
  "category_id": "uuid-here",
  "tags": ["classic", "traditional", "formal"],
  "is_active": true,
  "is_prebuilt": false,
  "created_at": "2026-02-04T13:00:00.000Z",
  "updated_at": "2026-02-04T13:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid HTML/CSS or validation failed
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Insufficient permissions
- `422 Unprocessable Entity`: Security scan failed (forbidden tags detected)
- `500 Internal Server Error`: Server error

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/code \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Classic Business Quote",
    "html_content": "<!DOCTYPE html><html>...",
    "css_content": "body { font-family: Georgia, serif; }"
  }'
```

---

### 9. Update Code Template

Update HTML/CSS content of an existing code template.

**Endpoint**: `PATCH /admin/quotes/templates/:id/code`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Request Body**:
```json
{
  "html_content": "<!DOCTYPE html>\n<html>...",
  "css_content": "body { font-family: Georgia, serif; ... }"
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| html_content | string | No | Updated Handlebars HTML (max 2MB) |
| css_content | string | No | Updated CSS styles (max 2MB) |

**Success Response** (200 OK):
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "html_content": "<!DOCTYPE html>\n<html>...",
  "css_content": "body { font-family: Georgia, serif; ... }",
  "updated_at": "2026-02-04T13:10:00.000Z"
}
```

**Error Responses**:
- `404 Not Found`: Template not found
- `409 Conflict`: Template is not code type
- `422 Unprocessable Entity`: Security scan failed

**Example Request**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/admin/quotes/templates/660e8400-e29b-41d4-a716-446655440000/code \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "html_content": "<!DOCTYPE html><html>...",
    "css_content": "body { font-size: 14px; }"
  }'
```

---

### 10. Validate Handlebars Code

Validate Handlebars syntax and security scan HTML/CSS before saving.

**Endpoint**: `POST /admin/quotes/templates/code/validate`

**Authentication**: Required (JWT + Platform Admin)

**Request Body**:
```json
{
  "html_content": "<!DOCTYPE html>\n<html>...",
  "css_content": "body { font-family: Georgia, serif; ... }"
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| html_content | string | Yes | Handlebars HTML to validate |
| css_content | string | No | CSS to validate |

**Success Response** (200 OK):
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "variables": [
    "quote.quote_number",
    "quote.created_at",
    "company.name",
    "customer.name"
  ],
  "security_scan": {
    "passed": true,
    "issues": []
  }
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| valid | boolean | Is syntax valid? |
| errors | string[] | Syntax errors (if any) |
| warnings | string[] | Warnings (non-blocking) |
| variables | string[] | Extracted Handlebars variables |
| security_scan | object | Security scan results |
| security_scan.passed | boolean | Did security scan pass? |
| security_scan.issues | string[] | Security issues found |

**Validation Error Response** (200 OK - still returns validation results):
```json
{
  "valid": false,
  "errors": [
    "Line 5: Unclosed block helper '{{#if}}'"
  ],
  "warnings": [],
  "variables": [],
  "security_scan": {
    "passed": false,
    "issues": [
      "Forbidden tag detected: <script>",
      "Forbidden attribute detected: onclick"
    ]
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing html_content

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/code/validate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "html_content": "<!DOCTYPE html><html><body>{{quote.quote_number}}</body></html>"
  }'
```

---

### 11. Get Handlebars Variable Schema

Get the complete schema of all available Handlebars variables for autocomplete.

**Endpoint**: `GET /admin/quotes/templates/code/variables`

**Authentication**: Required (JWT + Platform Admin)

**Success Response** (200 OK):
```json
{
  "variables": {
    "quote": {
      "quote_number": "string",
      "created_at": "Date",
      "valid_until": "Date",
      "status": "string (draft | sent | approved | declined | expired)",
      "subtotal": "number",
      "discount_amount": "number",
      "discount_percent": "number",
      "tax_amount": "number",
      "tax_percent": "number",
      "total": "number",
      "notes": "string",
      "line_items": [
        {
          "name": "string",
          "description": "string",
          "quantity": "number",
          "unit_price": "number",
          "discount_percent": "number",
          "tax_percent": "number",
          "total": "number"
        }
      ]
    },
    "company": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "address": "string",
      "city": "string",
      "state": "string",
      "zip": "string",
      "website": "string",
      "logo_url": "string",
      "tagline": "string"
    },
    "customer": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "address": "string",
      "city": "string",
      "state": "string",
      "zip": "string"
    }
  },
  "helpers": [
    {
      "name": "currency",
      "usage": "{{currency value}}",
      "description": "Format number as currency ($1,234.56)"
    },
    {
      "name": "date",
      "usage": "{{date value}}",
      "description": "Format date (MM/DD/YYYY)"
    },
    {
      "name": "percent",
      "usage": "{{percent value}}",
      "description": "Format as percentage (12.5%)"
    },
    {
      "name": "multiply",
      "usage": "{{multiply a b}}",
      "description": "Multiply two numbers"
    },
    {
      "name": "eq",
      "usage": "{{#if (eq a b)}}...{{/if}}",
      "description": "Compare equality"
    }
  ]
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| variables | object | Nested object schema of all available variables |
| helpers | array | List of available Handlebars helpers |

**Example Request**:
```bash
curl -X GET https://api.lead360.app/api/v1/admin/quotes/templates/code/variables \
  -H "Authorization: Bearer <token>"
```

---

## Component Library Endpoints

### 12. List Components

List all components from the component library with filtering.

**Endpoint**: `GET /admin/quotes/templates/components`

**Authentication**: Required (JWT + Platform Admin)

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| component_type | string | No | Filter by type (header, customer_info, line_items, totals, footer, signature, payment_schedule) |
| category | string | No | Filter by category (layout, content, custom) |
| tags | string[] | No | Filter by tags (comma-separated) |
| is_global | boolean | No | Filter by global/tenant-specific |
| tenant_id | string (UUID) | No | Filter by tenant ID |
| is_active | boolean | No | Filter by active status (default: true) |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 50, max: 100) |

**Success Response** (200 OK):
```json
{
  "data": [
    {
      "id": "comp-uuid-1",
      "tenant_id": null,
      "name": "Modern Header",
      "component_type": "header",
      "category": "layout",
      "description": "Clean, modern header with logo and company details in a horizontal layout",
      "structure": {
        "sections": ["logo", "company_info", "quote_info"],
        "layout": "horizontal"
      },
      "default_props": {
        "show_logo": true,
        "logo_width": 120,
        "show_company_name": true
      },
      "thumbnail_url": null,
      "usage_notes": "Perfect for modern, professional quotes. Displays logo, company info, and quote details in a clean horizontal layout.",
      "tags": ["modern", "professional", "horizontal"],
      "is_active": true,
      "is_global": true,
      "sort_order": 1,
      "created_at": "2026-02-04T10:00:00.000Z"
    },
    {
      "id": "comp-uuid-2",
      "name": "Classic Header",
      "component_type": "header",
      "category": "layout",
      "tags": ["classic", "traditional", "centered"],
      "is_active": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 21,
    "pages": 1
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid query parameters

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/templates/components?component_type=header&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

---

### 13. Get Component Details

Get detailed information about a specific component including HTML/CSS templates.

**Endpoint**: `GET /admin/quotes/templates/components/:id`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Component ID |

**Success Response** (200 OK):
```json
{
  "id": "comp-uuid-1",
  "tenant_id": null,
  "name": "Modern Header",
  "component_type": "header",
  "category": "layout",
  "description": "Clean, modern header with logo and company details in a horizontal layout",
  "structure": {
    "sections": ["logo", "company_info", "quote_info"],
    "layout": "horizontal"
  },
  "default_props": {
    "show_logo": true,
    "logo_width": 120,
    "show_company_name": true,
    "show_tagline": false,
    "background_color": "#ffffff",
    "text_color": "#1f2937"
  },
  "html_template": "<div class=\"header-modern\">...</div>",
  "css_template": ".header-modern { display: flex; ... }",
  "thumbnail_url": null,
  "usage_notes": "Perfect for modern, professional quotes. Displays logo, company info, and quote details in a clean horizontal layout.",
  "tags": ["modern", "professional", "horizontal"],
  "is_active": true,
  "is_global": true,
  "sort_order": 1,
  "created_at": "2026-02-04T10:00:00.000Z",
  "updated_at": "2026-02-04T10:00:00.000Z"
}
```

**Error Responses**:
- `404 Not Found`: Component not found

**Example Request**:
```bash
curl -X GET https://api.lead360.app/api/v1/admin/quotes/templates/components/comp-uuid-1 \
  -H "Authorization: Bearer <token>"
```

---

### 14. Create Component

Create a custom component for the tenant's component library.

**Endpoint**: `POST /admin/quotes/templates/components`

**Authentication**: Required (JWT + Platform Admin)

**Request Body**:
```json
{
  "name": "Custom Header",
  "component_type": "header",
  "category": "layout",
  "description": "Custom header for our company",
  "structure": {
    "sections": ["logo", "company_info"],
    "layout": "centered"
  },
  "default_props": {
    "show_logo": true,
    "background_color": "#ffffff"
  },
  "html_template": "<div class=\"custom-header\">...</div>",
  "css_template": ".custom-header { ... }",
  "usage_notes": "Custom header component",
  "tags": ["custom", "company"],
  "is_global": false
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Component name (1-200 chars) |
| component_type | string | Yes | Component type (header, customer_info, line_items, totals, footer, signature, payment_schedule, custom) |
| category | string | Yes | Category (layout, content, custom) |
| description | string | No | Component description |
| structure | object | Yes | Component structure definition |
| default_props | object | No | Default properties |
| html_template | string | Yes | Handlebars HTML template |
| css_template | string | No | CSS styles |
| thumbnail_url | string | No | Thumbnail URL |
| usage_notes | string | No | Usage documentation |
| tags | string[] | No | Tags |
| is_global | boolean | No | Is global? (default: false) |

**Success Response** (201 Created):
```json
{
  "id": "new-comp-uuid",
  "tenant_id": "tenant-uuid-here",
  "name": "Custom Header",
  "component_type": "header",
  "category": "layout",
  "is_active": true,
  "is_global": false,
  "created_at": "2026-02-04T14:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Validation failed
- `422 Unprocessable Entity`: Security scan failed (forbidden tags)

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/components \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Header",
    "component_type": "header",
    "category": "layout",
    "structure": {},
    "html_template": "<div>...</div>"
  }'
```

---

### 15. Update Component

Update an existing component in the library.

**Endpoint**: `PATCH /admin/quotes/templates/components/:id`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Component ID |

**Request Body** (all fields optional):
```json
{
  "name": "Updated Custom Header",
  "description": "Updated description",
  "default_props": {
    "background_color": "#f9fafb"
  },
  "html_template": "<div class=\"updated-header\">...</div>",
  "is_active": true
}
```

**Success Response** (200 OK):
```json
{
  "id": "comp-uuid",
  "name": "Updated Custom Header",
  "description": "Updated description",
  "updated_at": "2026-02-04T14:10:00.000Z"
}
```

**Error Responses**:
- `404 Not Found`: Component not found
- `403 Forbidden`: Cannot modify global components (platform-managed)

**Example Request**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/admin/quotes/templates/components/comp-uuid \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Custom Header",
    "is_active": true
  }'
```

---

### 16. Delete Component

Delete a component from the library.

**Endpoint**: `DELETE /admin/quotes/templates/components/:id`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Component ID |

**Success Response** (204 No Content):
```
(no response body)
```

**Error Responses**:
- `404 Not Found`: Component not found
- `403 Forbidden`: Cannot delete global components
- `409 Conflict`: Component is in use by templates

**Example Request**:
```bash
curl -X DELETE https://api.lead360.app/api/v1/admin/quotes/templates/components/comp-uuid \
  -H "Authorization: Bearer <token>"
```

---

### 17. Preview Component

Preview how a component renders with custom properties.

**Endpoint**: `POST /admin/quotes/templates/components/:id/preview`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Component ID |

**Request Body**:
```json
{
  "props": {
    "show_logo": true,
    "logo_width": 150,
    "background_color": "#f9fafb"
  },
  "sample_data": {
    "company": {
      "name": "Test Company",
      "logo_url": "https://example.com/logo.png"
    }
  }
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| props | object | Yes | Component properties to render with |
| sample_data | object | No | Sample data to override defaults |

**Success Response** (200 OK):
```json
{
  "component_id": "comp-uuid",
  "component_name": "Modern Header",
  "html": "<div class=\"header-modern\" style=\"background-color: #f9fafb\">...</div>",
  "css": ".header-modern { display: flex; ... }",
  "rendered_at": "2026-02-04T14:20:00.000Z"
}
```

**Error Responses**:
- `404 Not Found`: Component not found
- `422 Unprocessable Entity`: Rendering failed

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/components/comp-uuid/preview \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "props": {
      "show_logo": true,
      "background_color": "#f9fafb"
    }
  }'
```

---

## Pre-built Templates & Migration Endpoints

### 18. List Pre-built Templates

List all platform-provided pre-built templates available for cloning.

**Endpoint**: `GET /admin/quotes/templates/prebuilt`

**Authentication**: Required (JWT + Platform Admin)

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category_id | string (UUID) | No | Filter by category |
| tags | string[] | No | Filter by tags (comma-separated) |
| template_type | string | No | Filter by type (visual, code) |
| search | string | No | Search by name or description |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 50) |

**Success Response** (200 OK):
```json
{
  "data": [
    {
      "id": "prebuilt-uuid-1",
      "name": "Modern Professional",
      "description": "Clean, contemporary template with horizontal header and card-style customer info. Perfect for tech, consulting, and professional services.",
      "template_type": "visual",
      "category": {
        "id": "cat-uuid-1",
        "name": "Modern"
      },
      "tags": ["modern", "professional", "clean", "minimal"],
      "thumbnail_url": null,
      "is_prebuilt": true,
      "created_at": "2026-02-04T10:00:00.000Z"
    },
    {
      "id": "prebuilt-uuid-2",
      "name": "HVAC Service Quote",
      "description": "Specialized template for HVAC companies with service address and detailed payment terms.",
      "template_type": "visual",
      "category": {
        "id": "cat-uuid-4",
        "name": "Industry"
      },
      "tags": ["hvac", "service", "industry"],
      "is_prebuilt": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 20,
    "pages": 1
  }
}
```

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/templates/prebuilt?category_id=cat-uuid-4&tags=hvac" \
  -H "Authorization: Bearer <token>"
```

---

### 19. Clone Pre-built Template

Clone a pre-built template to create a tenant-specific copy that can be customized.

**Endpoint**: `POST /admin/quotes/templates/prebuilt/:id/clone`

**Authentication**: Required (JWT + Platform Admin)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Pre-built template ID |

**Request Body**:
```json
{
  "name": "Our Custom HVAC Quote",
  "description": "Customized HVAC template for our company"
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | Custom name (defaults to "Copy of [Original]") |
| description | string | No | Custom description |

**Success Response** (201 Created):
```json
{
  "id": "new-template-uuid",
  "tenant_id": "tenant-uuid-here",
  "name": "Our Custom HVAC Quote",
  "description": "Customized HVAC template for our company",
  "template_type": "visual",
  "visual_structure": { "..." },
  "source_template_id": "prebuilt-uuid-2",
  "is_prebuilt": false,
  "is_active": true,
  "created_at": "2026-02-04T15:00:00.000Z"
}
```

**Error Responses**:
- `404 Not Found`: Pre-built template not found
- `409 Conflict`: Template already cloned by this tenant

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/prebuilt/prebuilt-uuid-2/clone \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Our Custom HVAC Quote"
  }'
```

---

### 20. Run Template Migration

Run migration to convert existing legacy templates to the new template builder system.

**Endpoint**: `POST /admin/quotes/templates/migration/run`

**Authentication**: Required (JWT + Platform Admin)

**Request Body**:
```json
{
  "template_ids": ["legacy-uuid-1", "legacy-uuid-2"],
  "create_backup": true
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| template_ids | string[] (UUID) | No | Specific templates to migrate (if omitted, migrates all) |
| create_backup | boolean | No | Create backup before migration? (default: true) |

**Success Response** (200 OK):
```json
{
  "total": 5,
  "migrated": 5,
  "failed": 0,
  "skipped": 0,
  "results": [
    {
      "template_id": "legacy-uuid-1",
      "template_name": "Old Template 1",
      "status": "success",
      "message": "Migrated to code template with version 1"
    },
    {
      "template_id": "legacy-uuid-2",
      "template_name": "Old Template 2",
      "status": "success",
      "message": "Migrated to code template with version 1"
    }
  ],
  "started_at": "2026-02-04T15:10:00.000Z",
  "completed_at": "2026-02-04T15:10:05.000Z"
}
```

**Error Responses**:
- `404 Not Found`: One or more templates not found
- `409 Conflict`: Templates already migrated

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/admin/quotes/templates/migration/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "create_backup": true
  }'
```

---

### 21. Get Migration Statistics

Get statistics about template migration status.

**Endpoint**: `GET /admin/quotes/templates/migration/stats`

**Authentication**: Required (JWT + Platform Admin)

**Success Response** (200 OK):
```json
{
  "total_templates": 25,
  "migrated_templates": 20,
  "pending_migration": 5,
  "migration_percentage": 80,
  "templates_by_type": {
    "visual": 17,
    "code": 8
  },
  "migration_errors": 0,
  "last_migration_at": "2026-02-04T15:10:05.000Z"
}
```

**Example Request**:
```bash
curl -X GET https://api.lead360.app/api/v1/admin/quotes/templates/migration/stats \
  -H "Authorization: Bearer <token>"
```

---

## Tenant Templates Endpoints

### 22. Get Available Templates (Tenant)

Get templates available to the current tenant (global + tenant-specific).

**Endpoint**: `GET /quotes/templates`

**Authentication**: Required (JWT + Any Role)

**Authorization**: All authenticated users (Owner, Admin, Manager, Sales, Employee)

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| is_active | boolean | No | Filter by active status |
| page | number | No | Page number (default: 1, min: 1) |
| limit | number | No | Items per page (default: 50, min: 1, max: 100) |

**Success Response** (200 OK):
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": null,
      "name": "Modern Professional Quote",
      "description": "Clean, modern template",
      "template_type": "visual",
      "visual_structure": {...},
      "html_content": null,
      "css_content": null,
      "category_id": "cat-uuid",
      "tags": ["modern", "professional"],
      "thumbnail_url": null,
      "is_prebuilt": false,
      "source_template_id": null,
      "is_global": true,
      "is_active": true,
      "is_default": false,
      "created_by_user_id": null,
      "created_at": "2026-02-04T12:00:00.000Z",
      "updated_at": "2026-02-04T12:00:00.000Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "tenant_id": "tenant-uuid-here",
      "name": "Our Custom Template",
      "description": "Custom template for our business",
      "template_type": "code",
      "visual_structure": null,
      "html_content": "<!DOCTYPE html>...",
      "css_content": "body {...}",
      "category_id": null,
      "tags": ["custom"],
      "thumbnail_url": null,
      "is_prebuilt": false,
      "source_template_id": "550e8400-e29b-41d4-a716-446655440000",
      "is_global": false,
      "is_active": true,
      "is_default": true,
      "created_by_user_id": "user-uuid",
      "created_at": "2026-02-04T13:00:00.000Z",
      "updated_at": "2026-02-04T13:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "pages": 1
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid JWT token

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/quotes/templates?is_active=true&page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

---

### 23. Get Template Details (Tenant)

Get detailed information about a specific template (tenant-accessible).

**Endpoint**: `GET /quotes/templates/:id`

**Authentication**: Required (JWT + Any Role)

**Authorization**: All authenticated users (Owner, Admin, Manager, Sales, Employee)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Template ID |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": null,
  "name": "Modern Professional Quote",
  "description": "Clean, modern template",
  "template_type": "visual",
  "visual_structure": {...},
  "html_content": null,
  "css_content": null,
  "category_id": "cat-uuid",
  "tags": ["modern", "professional"],
  "thumbnail_url": null,
  "is_prebuilt": false,
  "source_template_id": null,
  "is_global": true,
  "is_active": true,
  "is_default": false,
  "created_by_user_id": null,
  "created_at": "2026-02-04T12:00:00.000Z",
  "updated_at": "2026-02-04T12:00:00.000Z",
  "category": {
    "id": "cat-uuid",
    "name": "Modern",
    "description": "Modern templates",
    "icon_name": "modern-icon",
    "sort_order": 1,
    "is_active": true,
    "created_at": "2026-02-04T10:00:00.000Z",
    "updated_at": "2026-02-04T10:00:00.000Z"
  },
  "created_by_user": null,
  "source_template": null
}
```

**Error Responses**:
- `404 Not Found`: Template not found or not accessible to this tenant
- `401 Unauthorized`: Missing or invalid JWT token

**Example Request**:
```bash
curl -X GET https://api.lead360.app/api/v1/quotes/templates/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

---

### 24. Set Active Template (Tenant)

Set the active template for the current tenant (used for new quotes).

**Endpoint**: `PATCH /quotes/templates/active`

**Authentication**: Required (JWT + Owner/Admin Role)

**Authorization**: Owner, Admin only

**Request Body**:
```json
{
  "template_id": "550e8400-e29b-41d4-a716"
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| template_id | string (UUID) | Yes | Template UUID to set as active |

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Active template updated successfully",
  "template_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-uuid-here",
  "updated_at": "2026-02-04T14:00:00.000Z"
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether operation succeeded |
| message | string | Success message |
| template_id | string (UUID) | Active template UUID |
| tenant_id | string (UUID) | Tenant UUID |
| updated_at | string (ISO8601) | Update timestamp |

**Error Responses**:
- `404 Not Found`: Template not found or not accessible to this tenant
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User does not have permission (requires Owner or Admin role)

**Example Request**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/quotes/templates/active \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

---

## Response DTOs Reference

This section documents all response Data Transfer Objects (DTOs) used across the API.

### TemplateResponseDto

Basic template information returned in list operations.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | Template unique identifier |
| tenant_id | string (UUID) | Yes | Tenant UUID (NULL for global templates) |
| name | string | No | Template name (max 200 chars) |
| description | string | Yes | Template description |
| template_type | string | No | Template type: 'visual' \| 'code' |
| visual_structure | object | Yes | Visual template JSON structure (NULL for code templates) |
| html_content | string | Yes | Handlebars HTML content (NULL for visual templates) |
| css_content | string | Yes | CSS styles (optional for both types) |
| category_id | string (UUID) | Yes | Category UUID (NULL if uncategorized) |
| tags | string[] | Yes | Template tags array (NULL if no tags) |
| thumbnail_url | string | Yes | Thumbnail image URL (NULL if no thumbnail, max 500 chars) |
| is_prebuilt | boolean | No | Is platform pre-built template? |
| source_template_id | string (UUID) | Yes | Source template UUID if cloned (NULL if original) |
| is_global | boolean | No | Is global template accessible to all tenants? |
| is_active | boolean | No | Is template available for use? |
| is_default | boolean | No | Is tenant's default template? |
| created_by_user_id | string (UUID) | Yes | Creator user UUID (NULL for system templates) |
| created_at | string (ISO8601) | No | Creation timestamp |
| updated_at | string (ISO8601) | No | Last update timestamp |

### TemplateDetailResponseDto

Extended template information with relationships (extends TemplateResponseDto).

Includes all fields from TemplateResponseDto plus:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| category | CategoryResponseDto | Yes | Full category details (NULL if uncategorized) |
| created_by_user | UserBasicInfoDto | Yes | Creator user details (NULL for system templates) |
| source_template | TemplateBasicInfoDto | Yes | Source template basic info if cloned (NULL if original) |

### TemplateBasicInfoDto

Minimal template information for references.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | Template UUID |
| name | string | No | Template name |
| template_type | string | No | Template type: 'visual' \| 'code' |

### TemplateVersionResponseDto

Template version history entry.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | Version UUID |
| template_id | string (UUID) | No | Parent template UUID |
| version_number | number | No | Sequential version number |
| template_type | string | No | Template type at this version: 'visual' \| 'code' |
| visual_structure | object | Yes | Visual structure at this version (NULL for code templates) |
| html_content | string | Yes | HTML content at this version (NULL for visual templates) |
| css_content | string | Yes | CSS styles at this version |
| changes_summary | string | Yes | Summary of changes (max 500 chars, NULL if no summary) |
| render_time_ms | number | Yes | Render performance metric in milliseconds (NULL if not measured) |
| pdf_size_kb | number | Yes | PDF size metric in kilobytes (NULL if not measured) |
| created_by_user_id | string (UUID) | Yes | Creator user UUID (NULL for system) |
| created_at | string (ISO8601) | No | Version creation timestamp |
| created_by_user | UserBasicInfoDto | Yes | Creator user details (NULL if not available) |

### ComponentResponseDto

Basic component information returned in list operations.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | Component UUID |
| name | string | No | Component name (max 200 chars) |
| description | string | Yes | Component description |
| component_type | string | No | Type: header \| footer \| customer_info \| line_items \| totals \| terms \| signature \| payment_schedule \| warranty \| custom |
| structure | object | No | Component structure definition (JSON) |
| default_props | object | Yes | Default component properties (JSON) |
| html_template | string | No | Handlebars HTML template |
| css_template | string | Yes | CSS template (optional) |
| thumbnail_url | string | Yes | Thumbnail image URL (NULL if no thumbnail) |
| preview_html | string | Yes | Pre-rendered preview HTML (NULL if not generated) |
| usage_notes | string | Yes | Component documentation/usage notes |
| category | string | No | Component category: layout \| content \| pricing \| branding \| custom |
| tags | string[] | Yes | Component tags array (NULL if no tags) |
| is_global | boolean | No | Is global component accessible to all tenants? |
| tenant_id | string (UUID) | Yes | Tenant UUID (NULL for global components) |
| is_active | boolean | No | Is component available for use? |
| sort_order | number | No | Display order |
| created_by_user_id | string (UUID) | Yes | Creator user UUID (NULL for system components) |
| created_at | string (ISO8601) | No | Creation timestamp |
| updated_at | string (ISO8601) | No | Last update timestamp |

### ComponentDetailResponseDto

Extended component information with relationships (extends ComponentResponseDto).

Includes all fields from ComponentResponseDto plus:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| created_by_user | UserBasicInfoDto | Yes | Creator user details (NULL for system components) |

### ComponentUsageResponseDto

Component usage statistics.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| usage_count | number | No | Number of templates using this component |
| templates | string[] | No | Array of template UUIDs using this component |

### ExportCodeResponseDto

Visual template export to code result.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| template_id | string (UUID) | No | Template UUID |
| template_name | string | No | Template name |
| html | string | No | Compiled Handlebars HTML |
| css | string | No | Compiled CSS styles |
| compiled_at | string (ISO8601) | No | Compilation timestamp |

### ValidateHandlebarsResponseDto

Handlebars validation result.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| valid | boolean | No | Is the syntax valid? |
| errors | string[] | No | Array of syntax error messages (empty if valid) |
| warnings | string[] | No | Array of warning messages (non-blocking) |
| variables | string[] | No | Extracted Handlebars variables (e.g., ['quote.quote_number', 'company.name']) |
| security_scan | object | No | Security scan results |
| security_scan.passed | boolean | No | Did security scan pass? |
| security_scan.issues | string[] | No | Security issues found (empty if passed) |

### CategoryResponseDto

Template category information.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | Category UUID |
| name | string | No | Category name (max 100 chars) |
| description | string | Yes | Category description |
| icon_name | string | Yes | Icon identifier (max 50 chars, NULL if no icon) |
| sort_order | number | No | Display order |
| is_active | boolean | No | Is category active? |
| created_at | string (ISO8601) | No | Creation timestamp |
| updated_at | string (ISO8601) | No | Last update timestamp |

### UserBasicInfoDto

User reference information.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | User UUID |
| email | string | No | User email address |
| name | string | Yes | User full name (NULL if not set) |

### PaginatedResponseDto<T>

Generic pagination wrapper for list responses.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| data | T[] | No | Array of items (type depends on endpoint) |
| pagination | object | No | Pagination metadata |
| pagination.page | number | No | Current page number |
| pagination.limit | number | No | Items per page |
| pagination.total | number | No | Total items count |
| pagination.pages | number | No | Total pages count |

---

## Database Schema

This section documents the database tables used by the Template Builder System.

### quote_template

Main templates table storing both visual and code templates.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | VARCHAR(36) PK | No | Template UUID |
| tenant_id | VARCHAR(36) FK | Yes | Tenant UUID (NULL for global templates) |
| name | VARCHAR(200) | No | Template name |
| description | TEXT | Yes | Template description |
| template_type | VARCHAR(20) | No | Template type: 'visual' or 'code' (default: 'code') |
| visual_structure | JSON | Yes | Visual template JSON structure (NULL for code templates) |
| html_content | LONGTEXT | Yes | Handlebars HTML content (NULL for visual templates) |
| css_content | LONGTEXT | Yes | CSS styles (optional) |
| category_id | VARCHAR(36) FK | Yes | FK to template_category |
| tags | JSON | Yes | Array of tag strings |
| thumbnail_url | VARCHAR(500) | Yes | Thumbnail preview image URL |
| is_prebuilt | BOOLEAN | No | Is platform pre-built template? (default: false) |
| source_template_id | VARCHAR(36) FK | Yes | FK to quote_template if cloned |
| is_global | BOOLEAN | No | Is global template? (default: false) |
| is_active | BOOLEAN | No | Is template active? (default: true) |
| is_default | BOOLEAN | No | Is default template? (default: false) |
| created_by_user_id | VARCHAR(36) FK | Yes | FK to users table |
| created_at | DATETIME | No | Creation timestamp |
| updated_at | DATETIME | No | Last update timestamp |

**Indexes:**
- PRIMARY KEY: id
- INDEX: tenant_id
- INDEX: category_id
- INDEX: is_active, is_global
- INDEX: created_at

**Foreign Keys:**
- tenant_id → tenants(id) ON DELETE CASCADE
- category_id → template_category(id) ON DELETE SET NULL
- source_template_id → quote_template(id) ON DELETE SET NULL
- created_by_user_id → users(id) ON DELETE SET NULL

### quote_template_version

Template version history for rollback and audit.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | VARCHAR(36) PK | No | Version UUID |
| template_id | VARCHAR(36) FK | No | Parent template UUID |
| version_number | INT | No | Sequential version number |
| template_type | VARCHAR(20) | No | Template type snapshot: 'visual' or 'code' |
| visual_structure | JSON | Yes | Visual structure at this version |
| html_content | LONGTEXT | Yes | HTML content at this version |
| css_content | LONGTEXT | Yes | CSS styles at this version |
| changes_summary | VARCHAR(500) | Yes | Summary of changes made |
| render_time_ms | INT | Yes | Render performance metric (milliseconds) |
| pdf_size_kb | INT | Yes | PDF size metric (kilobytes) |
| created_by_user_id | VARCHAR(36) FK | Yes | FK to users table |
| created_at | DATETIME | No | Version creation timestamp |

**Indexes:**
- PRIMARY KEY: id
- UNIQUE: template_id, version_number
- INDEX: template_id, version_number DESC

**Foreign Keys:**
- template_id → quote_template(id) ON DELETE CASCADE
- created_by_user_id → users(id) ON DELETE SET NULL

### template_category

Categories for organizing templates.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | VARCHAR(36) PK | No | Category UUID |
| name | VARCHAR(100) | No | Category name |
| description | TEXT | Yes | Category description |
| icon_name | VARCHAR(50) | Yes | Icon identifier |
| sort_order | INT | No | Display order (default: 0) |
| is_active | BOOLEAN | No | Is category active? (default: true) |
| created_at | DATETIME | No | Creation timestamp |
| updated_at | DATETIME | No | Last update timestamp |

**Indexes:**
- PRIMARY KEY: id
- UNIQUE: name
- INDEX: sort_order, is_active

### template_component

Component library for visual template builder.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | VARCHAR(36) PK | No | Component UUID |
| name | VARCHAR(200) | No | Component name |
| description | TEXT | Yes | Component description |
| component_type | VARCHAR(50) | No | Component type (header, footer, customer_info, line_items, totals, terms, signature, payment_schedule, warranty, custom) |
| structure | JSON | No | Component structure definition |
| default_props | JSON | Yes | Default component properties |
| html_template | LONGTEXT | No | Handlebars HTML template |
| css_template | LONGTEXT | Yes | CSS template (optional) |
| thumbnail_url | VARCHAR(500) | Yes | Preview image URL |
| preview_html | LONGTEXT | Yes | Pre-rendered preview HTML |
| usage_notes | TEXT | Yes | Component documentation |
| category | VARCHAR(50) | No | Component category (layout, content, pricing, branding, custom) |
| tags | JSON | Yes | Array of tag strings |
| is_global | BOOLEAN | No | Is global component? (default: true) |
| tenant_id | VARCHAR(36) FK | Yes | FK to tenants (NULL for global) |
| is_active | BOOLEAN | No | Is component active? (default: true) |
| sort_order | INT | No | Display order (default: 0) |
| created_by_user_id | VARCHAR(36) FK | Yes | FK to users table |
| created_at | DATETIME | No | Creation timestamp |
| updated_at | DATETIME | No | Last update timestamp |

**Indexes:**
- PRIMARY KEY: id
- INDEX: tenant_id
- INDEX: component_type, category
- INDEX: is_active, is_global
- INDEX: sort_order

**Foreign Keys:**
- tenant_id → tenants(id) ON DELETE CASCADE
- created_by_user_id → users(id) ON DELETE SET NULL

### template_usage_log

Analytics and performance tracking for template usage.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | VARCHAR(36) PK | No | Log entry UUID |
| template_id | VARCHAR(36) FK | No | Template UUID |
| tenant_id | VARCHAR(36) FK | No | Tenant UUID |
| quote_id | VARCHAR(36) FK | Yes | Associated quote UUID (NULL if preview/test) |
| event_type | VARCHAR(50) | No | Event type (render, pdf_generation, preview, test_pdf, test_email, etc.) |
| render_time_ms | INT | Yes | Render time in milliseconds |
| pdf_generation_time_ms | INT | Yes | PDF generation time in milliseconds |
| pdf_size_kb | INT | Yes | PDF file size in kilobytes |
| created_at | DATETIME | No | Event timestamp |

**Indexes:**
- PRIMARY KEY: id
- INDEX: template_id, created_at
- INDEX: tenant_id, created_at
- INDEX: event_type, created_at

**Foreign Keys:**
- template_id → quote_template(id) ON DELETE CASCADE
- tenant_id → tenants(id) ON DELETE CASCADE
- quote_id → quotes(id) ON DELETE SET NULL

---

## Data Schemas

### Visual Template Structure Schema

Complete JSON structure for visual templates:

```json
{
  "version": "1.0",
  "layout": {
    "pageSize": "letter | legal | a4",
    "orientation": "portrait | landscape",
    "margins": {
      "top": 50,
      "right": 50,
      "bottom": 50,
      "left": 50
    },
    "header": {
      "enabled": true,
      "height": 120,
      "components": [
        {
          "id": "unique-instance-id",
          "component_id": "component-library-uuid",
          "props": {
            "key": "value"
          }
        }
      ]
    },
    "body": {
      "components": []
    },
    "footer": {
      "enabled": true,
      "height": 80,
      "components": []
    }
  },
  "theme": {
    "primaryColor": "#2563eb",
    "secondaryColor": "#64748b",
    "fontFamily": "Inter, Arial, sans-serif",
    "fontSize": 14,
    "lineHeight": 1.5
  }
}
```

### Component Definition Schema

```json
{
  "id": "uuid",
  "name": "Component Name",
  "component_type": "header | customer_info | line_items | totals | footer | signature | payment_schedule | custom",
  "category": "layout | content | custom",
  "structure": {
    "sections": ["section1", "section2"],
    "layout": "horizontal | vertical | centered | split"
  },
  "default_props": {
    "prop1": "default_value",
    "prop2": true
  },
  "html_template": "Handlebars HTML string",
  "css_template": "CSS string",
  "tags": ["tag1", "tag2"]
}
```

### Available Handlebars Variables

All templates (both visual and code) have access to these variables:

```javascript
{
  quote: {
    id: "uuid",
    quote_number: "string",
    created_at: "Date",
    valid_until: "Date",
    status: "draft | sent | approved | declined | expired",
    subtotal: "number",
    discount_amount: "number",
    discount_percent: "number",
    tax_amount: "number",
    tax_percent: "number",
    total: "number",
    notes: "string",
    line_items: [
      {
        name: "string",
        description: "string",
        sku: "string",
        quantity: "number",
        unit_price: "number",
        discount_percent: "number",
        tax_percent: "number",
        total: "number",
        category: "string"
      }
    ]
  },
  company: {
    name: "string",
    email: "string",
    phone: "string",
    address: "string",
    city: "string",
    state: "string",
    zip: "string",
    website: "string",
    logo_url: "string",
    tagline: "string",
    license_number: "string"
  },
  customer: {
    name: "string",
    email: "string",
    phone: "string",
    address: "string",
    city: "string",
    state: "string",
    zip: "string"
  }
}
```

### Available Handlebars Helpers

| Helper | Usage | Description |
|--------|-------|-------------|
| currency | `{{currency value}}` | Format as currency ($1,234.56) |
| date | `{{date value}}` | Format date (MM/DD/YYYY) |
| percent | `{{percent value}}` | Format as percentage (12.5%) |
| multiply | `{{multiply a b}}` | Multiply two numbers |
| divide | `{{divide a b}}` | Divide two numbers |
| add | `{{add a b}}` | Add two numbers |
| subtract | `{{subtract a b}}` | Subtract two numbers |
| eq | `{{#if (eq a b)}}` | Compare equality |
| ne | `{{#if (ne a b)}}` | Compare inequality |
| gt | `{{#if (gt a b)}}` | Greater than |
| lt | `{{#if (lt a b)}}` | Less than |
| gte | `{{#if (gte a b)}}` | Greater than or equal |
| lte | `{{#if (lte a b)}}` | Less than or equal |

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Field-specific details (for validation errors)"
    },
    "timestamp": "2026-02-04T12:00:00.000Z",
    "path": "/api/v1/admin/quotes/templates/visual"
  }
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Request validation failed |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource conflict (duplicate, in-use, etc.) |
| 422 | UNPROCESSABLE_ENTITY | Security scan failed, invalid template |
| 500 | INTERNAL_ERROR | Server error |

---

## Rate Limiting

All endpoints are rate-limited to prevent abuse:

- **Rate Limit**: 100 requests per minute per IP
- **Headers**: Rate limit info included in response headers
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 99
  X-RateLimit-Reset: 1612345678
  ```

---

## Pagination Format

All list endpoints use consistent pagination:

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)

**Response Format**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 123,
    "pages": 3
  }
}
```

---

## Security Considerations

### XSS Prevention
- All HTML content scanned for forbidden tags: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<applet>`, `<meta>`, `<link>`, `<base>`, `<form>`
- Forbidden attributes blocked: `onload`, `onerror`, `onclick`, `onmouseover`, `onfocus`, `onblur`, `onchange`, `onsubmit`, etc.
- JavaScript protocol detection: `javascript:` in any attribute

### Template Injection Prevention
- Handlebars helpers whitelist (21 allowed helpers only)
- No `eval()` or dangerous operations allowed
- Syntax validation before execution

### Multi-Tenant Isolation
- All queries automatically filter by `tenant_id`
- Global templates use `tenant_id = NULL`
- Cross-tenant access blocked at middleware level

### Input Validation
- All inputs validated via DTOs (class-validator)
- Size limits enforced (HTML: 2MB, CSS: 2MB)
- Component limits (50 components max per template)

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-04 | 1.0 | Initial release - Template Builder System |

---

## Support

For API support, contact:
- **Email**: [email protected]
- **Documentation**: https://docs.lead360.app/api/template-builder
- **Status Page**: https://status.lead360.app

---

**End of Documentation**
