# Sprint 6: API Documentation (Documentation Agent)

**Duration**: Week 7
**Goal**: Produce 100% complete API documentation for frontend integration
**Sprint Type**: Documentation
**Estimated Effort**: 3-4 days
**Dependencies**: Sprint 5 (All implementation complete)

---

## Overview

This sprint is dedicated to creating comprehensive, production-ready API documentation that covers 100% of Twilio-related endpoints. The documentation must be complete enough that the frontend team can implement the entire UI without asking questions.

**CRITICAL**: NO "minor" endpoints can be skipped. Every endpoint, every field, every error code must be documented.

---

## Prerequisites

- [ ] Sprint 5 completed (all endpoints implemented)
- [ ] All DTOs finalized with @ApiProperty decorators
- [ ] All controllers have Swagger decorators
- [ ] Understanding of frontend integration requirements

---

## Documentation Structure

### Primary Documentation File

**File**: `/var/www/lead360.app/api/documentation/twilio_REST_API.md`

**Sections Required**:
1. Overview & Authentication
2. SMS Configuration Endpoints (5 endpoints)
3. WhatsApp Configuration Endpoints (5 endpoints)
4. Call Management Endpoints (5 endpoints)
5. IVR Configuration Endpoints (3 endpoints)
6. Office Bypass Endpoints (3 endpoints)
7. Transcription Endpoints (2 endpoints)
8. Admin Endpoints (2 endpoints)
9. Webhook Endpoints Reference (5 endpoints)
10. Common Error Responses
11. Testing Guide

**Total**: 30+ endpoints fully documented

---

## Documentation Template (Per Endpoint)

For EACH endpoint, include:

```markdown
### [Endpoint Name]

**[METHOD]** `/api/v1/[path]`

**Description**: [Clear description of what this endpoint does]

**Authentication**: Required (Bearer token) / Not Required

**RBAC**: [Allowed roles: Owner, Admin, Manager, etc.]

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Configuration ID | `abc-123-def` |

#### Query Parameters

| Parameter | Type | Required | Default | Validation | Description | Example |
|-----------|------|----------|---------|------------|-------------|---------|
| page | integer | No | 1 | Min: 1 | Page number for pagination | `?page=2` |
| limit | integer | No | 20 | Min: 1, Max: 100 | Items per page | `?limit=50` |

#### Request Body

```json
{
  "field_name": "value",
  "required_field": "required_value",
  "optional_field": "optional_value"
}
```

#### Request Body Fields

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| account_sid | string | Yes | Pattern: `^AC[a-z0-9]{32}$` | Twilio Account SID | "ACxxxx..." |
| auth_token | string | Yes | Min: 32 chars | Twilio Auth Token | "your_token" |
| from_phone | string | Yes | E.164 format | Phone number | "+19781234567" |

#### Success Response

**Status Code**: 200 OK / 201 Created / 204 No Content

```json
{
  "id": "config-uuid-123",
  "tenant_id": "tenant-uuid-456",
  "from_phone": "+19781234567",
  "is_active": true,
  "created_at": "2026-02-05T10:30:00.000Z"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Configuration identifier |
| tenant_id | string (uuid) | Tenant identifier |
| from_phone | string | Phone number in E.164 format |
| is_active | boolean | Whether configuration is active |
| created_at | string (ISO 8601) | Creation timestamp |

#### Error Responses

**400 Bad Request** - Validation error
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "account_sid",
      "message": "Invalid Twilio Account SID format"
    }
  ]
}
```

**401 Unauthorized** - Missing or invalid token
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Your role does not allow this action"
}
```

**404 Not Found** - Resource not found
```json
{
  "statusCode": 404,
  "message": "Configuration not found"
}
```

**409 Conflict** - Business rule violation
```json
{
  "statusCode": 409,
  "message": "Active SMS configuration already exists"
}
```

**500 Internal Server Error** - Unexpected error
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/sms-config" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "provider-uuid-123",
    "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "auth_token": "your_auth_token_here",
    "from_phone": "+19781234567"
  }'
```

#### Example Success Response

```json
{
  "id": "config-uuid-abc-123",
  "tenant_id": "tenant-uuid-def-456",
  "provider_id": "provider-uuid-123",
  "from_phone": "+19781234567",
  "is_active": true,
  "is_verified": true,
  "created_at": "2026-02-05T15:45:30.000Z",
  "updated_at": "2026-02-05T15:45:30.000Z"
}
```

#### Notes

- Credentials (account_sid, auth_token) are encrypted before storage
- Credentials are NEVER returned in API responses
- Only one active configuration allowed per tenant per provider
- Phone numbers must be in E.164 format (starting with +)

---
```

---

## Task Breakdown

### Task 6.1: Document SMS Configuration Endpoints

**Endpoints to Document**:
1. `POST /api/v1/communication/sms-config` - Create SMS configuration
2. `GET /api/v1/communication/sms-config` - Get active SMS configuration
3. `PATCH /api/v1/communication/sms-config/:id` - Update SMS configuration
4. `DELETE /api/v1/communication/sms-config/:id` - Deactivate SMS configuration
5. `POST /api/v1/communication/sms-config/:id/test` - Test SMS configuration

**For EACH endpoint**: Use full template above with ALL sections filled.

---

### Task 6.2: Document WhatsApp Configuration Endpoints

**Endpoints**: Same structure as SMS (5 endpoints)

**Path**: `/api/v1/communication/whatsapp-config`

**Special Notes**:
- Phone number format: `whatsapp:+19781234567`
- Provider ID must be `twilio_whatsapp`

---

### Task 6.3: Document Call Management Endpoints

**Endpoints**:
1. `POST /api/v1/communication/call/initiate` - Initiate outbound call
2. `GET /api/v1/communication/call` - Get paginated call history
3. `GET /api/v1/communication/call/:id` - Get call details
4. `GET /api/v1/communication/call/:id/recording` - Get signed recording URL
5. `GET /api/v1/communication/call/:id/recording/download` - Download recording

**Special Notes**:
- Recording URLs expire after 1 hour (signed URLs)
- Call history supports pagination and filtering

---

### Task 6.4: Document IVR Configuration Endpoints

**Endpoints**:
1. `POST /api/v1/communication/ivr` - Create/update IVR configuration
2. `GET /api/v1/communication/ivr` - Get IVR configuration
3. `DELETE /api/v1/communication/ivr` - Disable IVR

**Special Notes**:
- Menu options: max 10, digits 0-9, unique
- Action types: `route_to_number`, `route_to_default`, `trigger_webhook`, `voicemail`
- Timeout: 5-60 seconds
- Max retries: 1-5

---

### Task 6.5: Document Office Bypass Endpoints

**Endpoints**:
1. `POST /api/v1/communication/office-whitelist` - Add number to whitelist
2. `GET /api/v1/communication/office-whitelist` - List whitelisted numbers
3. `DELETE /api/v1/communication/office-whitelist/:id` - Remove from whitelist

---

### Task 6.6: Document Transcription Endpoints

**Endpoints**:
1. `GET /api/v1/communication/call/:id/transcription` - Get call transcription
2. `GET /api/v1/communication/transcriptions/search` - Full-text search transcriptions

**Special Notes**:
- Full-text search using MySQL MATCH AGAINST
- Search supports pagination
- Transcription status: `queued`, `processing`, `completed`, `failed`

---

### Task 6.7: Document Admin Endpoints

**Endpoints**:
1. `GET /api/admin/communication/twilio/usage` - Get usage across all tenants
2. `GET /api/admin/communication/transcriptions/failed` - Get failed transcriptions

**RBAC**: SystemAdmin only

---

### Task 6.8: Document Webhook Endpoints (Reference)

**Endpoints** (NOT called by frontend, but documented for reference):
1. `POST /api/twilio/sms/inbound` - Receive inbound SMS
2. `POST /api/twilio/call/inbound` - Receive inbound call
3. `POST /api/twilio/call/status` - Receive call status updates
4. `POST /api/twilio/recording/ready` - Receive recording ready notification
5. `POST /api/twilio/ivr/input` - Receive IVR digit input

**Authentication**: Twilio signature validation (not Bearer token)

**Special Notes**:
- All webhooks must validate Twilio signature
- Tenant resolved from subdomain
- Webhooks must respond within 2 seconds

---

### Task 6.9: Write Integration Guide

**File**: `/var/www/lead360.app/api/documentation/twilio_integration_guide.md`

**Contents**:

```markdown
# Twilio Integration Guide

## Overview

Lead360's Twilio integration enables SMS, WhatsApp, and voice call capabilities...

## Architecture

[Diagram or description of how Twilio integrates]

## Multi-Tenant Configuration

### Model A: Tenant-Owned Account
- Tenant provides their own Twilio credentials...

### Model B: System-Managed Account
- System manages Twilio account for tenant...

## Webhook Setup

1. Configure Twilio webhook URLs...
2. Webhook format: `https://{subdomain}.lead360.app/api/twilio/...`
3. Webhook signature verification...

## Testing Guide

### Test SMS Configuration
```bash
curl -X POST "..." ...
```

### Test Outbound Call
```bash
curl -X POST "..." ...
```

### Test IVR Menu
1. Call Twilio number
2. Press digits...

## Troubleshooting

### Common Issues

**Issue**: "Invalid Twilio credentials"
- **Solution**: Verify Account SID format (AC + 32 chars)...

**Issue**: "Recording not available"
- **Solution**: Wait for recording ready webhook...

## Security Best Practices

- Always use HTTPS for webhooks
- Validate Twilio signatures
- Encrypt credentials at rest
- Use signed URLs for recording playback (1-hour expiration)
```

---

### Task 6.10: Validate Swagger Documentation

**Tasks**:
1. Start development server
2. Navigate to `https://api.lead360.app/api/docs`
3. Verify ALL endpoints visible
4. Verify ALL DTOs have `@ApiProperty` decorators
5. Verify request/response examples work
6. Test "Try it out" feature for key endpoints

**Swagger Checklist**:
- [ ] All endpoints visible in Swagger UI
- [ ] @ApiTags applied to all controllers
- [ ] @ApiOperation on all endpoints
- [ ] @ApiResponse for all status codes
- [ ] @ApiBearerAuth on authenticated endpoints
- [ ] DTO fields have @ApiProperty with examples
- [ ] Enum values documented
- [ ] Request/response schemas accurate

---

## Acceptance Criteria

- [ ] Primary documentation file created (`twilio_REST_API.md`)
- [ ] 100% endpoint coverage (30+ endpoints documented)
- [ ] Every field documented (request body, response body, query params, path params)
- [ ] All error responses documented (400, 401, 403, 404, 409, 500)
- [ ] Complete examples for all endpoints (request + response)
- [ ] Authentication and RBAC requirements clear per endpoint
- [ ] Integration guide created with testing instructions
- [ ] Swagger fully functional and validated
- [ ] All DTOs have @ApiProperty decorators
- [ ] No "TODO" or placeholder content
- [ ] Pagination format documented
- [ ] Multi-tenant model differences explained
- [ ] Webhook signature verification explained
- [ ] Frontend team can implement without questions

---

## Documentation Quality Checklist

- [ ] No typos or grammar errors
- [ ] Consistent formatting throughout
- [ ] Code examples syntactically correct
- [ ] All JSON examples valid (no trailing commas)
- [ ] All cURL examples work when tested
- [ ] Field types accurate (string, integer, boolean, etc.)
- [ ] Validation rules complete (min, max, pattern)
- [ ] Examples realistic (not placeholder values)
- [ ] Descriptions clear and concise
- [ ] No assumptions about prior knowledge

---

## Verification Steps

### 1. Frontend Review
- Share documentation with frontend team
- Get feedback on completeness
- Address any gaps or questions

### 2. Test All Examples
```bash
# Copy every cURL example from documentation
# Execute each one
# Verify response matches documented response
```

### 3. Swagger Validation
```bash
# Navigate to /api/docs
# Click "Try it out" on 10 random endpoints
# Verify request/response matches documentation
```

### 4. Completeness Audit
```bash
# Count endpoints in code
# Count endpoints in documentation
# Verify numbers match
```

---

## Files Created

- `/api/documentation/twilio_REST_API.md` (primary documentation)
- `/api/documentation/twilio_integration_guide.md` (integration guide)

---

## Files Modified

- All controller files (add/update Swagger decorators if needed)
- All DTO files (add/update @ApiProperty decorators if needed)

---

## Next Steps

After Sprint 6 completion:
- ✅ API documentation 100% complete
- ✅ Frontend can begin implementation
- ➡️ Proceed to **Sprint 7: Q&A Review & Quality Assurance**

---

**Sprint 6 Complete**: Production-ready documentation for frontend team
