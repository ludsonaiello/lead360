# API Conventions & Standards

**Platform**: Lead360 Multi-Tenant SaaS CRM/ERP  
**Applies To**: Backend Agent, Frontend Agent  
**Purpose**: Consistent, predictable REST API design

---

## Base URL & Versioning

### **Base URL**
```
https://api.lead360.app/api/v1
```

### **Versioning Strategy**
- Use URL path versioning: `/api/v1/`, `/api/v2/`
- Current version: `v1`
- Breaking changes require new version
- Non-breaking changes can be added to existing version

---

## REST Endpoint Patterns

### **Standard CRUD Operations**

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/v1/{resource}` | List all (paginated) | 200 + list |
| GET | `/api/v1/{resource}/:id` | Get single | 200 + object |
| POST | `/api/v1/{resource}` | Create new | 201 + object |
| PATCH | `/api/v1/{resource}/:id` | Partial update | 200 + object |
| PUT | `/api/v1/{resource}/:id` | Full replace (rare) | 200 + object |
| DELETE | `/api/v1/{resource}/:id` | Delete | 204 (no content) |

**Use PATCH for updates** (not PUT) - allows partial updates.

---

### **Nested Resources**

For related resources:
```
GET    /api/v1/leads/:id/addresses          List addresses for lead
POST   /api/v1/leads/:id/addresses          Add address to lead
GET    /api/v1/leads/:id/addresses/:addr_id Get specific address
PATCH  /api/v1/leads/:id/addresses/:addr_id Update address
DELETE /api/v1/leads/:id/addresses/:addr_id Remove address

GET    /api/v1/leads/:id/timeline           Get communication timeline
POST   /api/v1/leads/:id/sms                Send SMS to lead
POST   /api/v1/leads/:id/call               Log call with lead
```

**Guideline**: Nest up to 2 levels deep. Beyond that, use separate endpoints.

---

### **Actions on Resources**

For operations that aren't CRUD:
```
POST /api/v1/quotes/:id/send        Send quote to customer
POST /api/v1/quotes/:id/accept      Accept quote (convert to project)
POST /api/v1/invoices/:id/void      Void invoice
POST /api/v1/projects/:id/complete  Mark project complete
```

**Pattern**: `POST /api/v1/{resource}/:id/{action}`

---

## Request Formats

### **Request Headers (Required)**

```
Content-Type: application/json
Authorization: Bearer {jwt_token}
```

**Optional Headers**:
```
X-Request-ID: {uuid}  // For request tracing (optional)
```

---

### **Request Body (POST/PATCH)**

**Always use JSON**:
```json
{
  "name": "John Smith",
  "phone": "5551234567",
  "email": "john@example.com"
}
```

**Never**:
- Form-encoded data
- XML
- Query parameters for complex data

---

### **Query Parameters**

**Pagination**:
```
?page=1          // Page number (1-indexed)
&limit=20        // Items per page (default: 20, max: 100)
```

**Filtering**:
```
?status=QUALIFIED           // Single value filter
&status=NEW,QUALIFIED       // Multiple values (comma-separated)
&created_after=2026-01-01   // Date range start
&created_before=2026-12-31  // Date range end
&search=john                // Text search (name, email, phone)
```

**Sorting**:
```
?sort=created_at:desc    // Sort by field, direction (asc/desc)
&sort=name:asc           // Can sort by any field
```

**Include Related Data**:
```
?include=addresses,service_requests   // Comma-separated relations
```

**Example Full Query**:
```
GET /api/v1/leads?page=1&limit=20&status=QUALIFIED&sort=created_at:desc&include=addresses
```

---

## Response Formats

### **Success Responses**

#### **Single Resource (GET/POST/PATCH)**

**Status**: 200 OK or 201 Created

```json
{
  "id": "lead-uuid-123",
  "tenant_id": "tenant-uuid-456",
  "name": "John Smith",
  "phone": "5551234567",
  "email": "john@example.com",
  "status": "QUALIFIED",
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T14:22:00.000Z"
}
```

**Always include**:
- `id`: Resource identifier
- `created_at`: ISO 8601 timestamp
- `updated_at`: ISO 8601 timestamp

---

#### **List of Resources (GET)**

**Status**: 200 OK

```json
{
  "data": [
    {
      "id": "lead-1",
      "name": "John Smith",
      ...
    },
    {
      "id": "lead-2",
      "name": "Jane Doe",
      ...
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Structure**:
- `data`: Array of resources
- `meta`: Pagination metadata

---

#### **Delete Success**

**Status**: 204 No Content

**Body**: Empty (no response body)

---

### **Error Responses**

#### **Standard Error Format**

All errors use this format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errors": [
    {
      "field": "phone",
      "message": "Phone number must be 10-15 digits"
    },
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

**Fields**:
- `statusCode`: HTTP status code (400, 401, 404, etc.)
- `message`: Human-readable error message
- `error`: Error type (optional)
- `errors`: Array of field-specific errors (for validation)

---

#### **Common Error Responses**

**400 Bad Request** - Validation Error
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Name is required"
    }
  ]
}
```

**401 Unauthorized** - Missing/Invalid Token
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "No valid token provided"
}
```

**403 Forbidden** - Insufficient Permissions
```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Your role does not allow this action"
}
```

**404 Not Found** - Resource Doesn't Exist
```json
{
  "statusCode": 404,
  "message": "Lead not found"
}
```

**409 Conflict** - Business Rule Violation
```json
{
  "statusCode": 409,
  "message": "Lead with this phone number already exists"
}
```

**500 Internal Server Error** - Unexpected Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "An unexpected error occurred"
}
```

---

## HTTP Status Codes

### **Success Codes**

| Code | Name | Usage |
|------|------|-------|
| 200 | OK | Successful GET, PATCH, PUT |
| 201 | Created | Successful POST (resource created) |
| 204 | No Content | Successful DELETE |

### **Client Error Codes**

| Code | Name | Usage |
|------|------|-------|
| 400 | Bad Request | Validation error, malformed request |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Authenticated but insufficient permissions |
| 404 | Not Found | Resource doesn't exist (or tenant mismatch) |
| 409 | Conflict | Business rule violation (duplicate, etc.) |
| 422 | Unprocessable Entity | Semantic error (valid format, invalid logic) |
| 429 | Too Many Requests | Rate limit exceeded |

### **Server Error Codes**

| Code | Name | Usage |
|------|------|-------|
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Server overloaded or maintenance |

---

## Pagination

### **Request Parameters**

```
?page=1          // Page number (1-indexed, default: 1)
&limit=20        // Items per page (default: 20, max: 100)
```

### **Response Format**

```json
{
  "data": [...],
  "meta": {
    "total": 150,        // Total number of items
    "page": 1,           // Current page
    "limit": 20,         // Items per page
    "totalPages": 8      // Total number of pages
  }
}
```

### **Implementation Pattern (Backend)**

```typescript
async findAll(tenantId: string, page = 1, limit = 20) {
  // Validate limits
  if (limit > 100) limit = 100;
  if (page < 1) page = 1;
  
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    this.prisma.lead.findMany({
      where: { tenant_id: tenantId },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    this.prisma.lead.count({
      where: { tenant_id: tenantId },
    }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

---

## Filtering

### **Single Value Filter**

```
?status=QUALIFIED
```

Backend:
```typescript
const where: any = { tenant_id: tenantId };
if (status) {
  where.status = status;
}
```

### **Multiple Values Filter (OR)**

```
?status=NEW,QUALIFIED,UNQUALIFIED
```

Backend:
```typescript
if (status) {
  const statuses = status.split(',');
  where.status = { in: statuses };
}
```

### **Date Range Filter**

```
?created_after=2026-01-01&created_before=2026-01-31
```

Backend:
```typescript
if (created_after || created_before) {
  where.created_at = {};
  if (created_after) where.created_at.gte = new Date(created_after);
  if (created_before) where.created_at.lte = new Date(created_before);
}
```

### **Text Search Filter**

```
?search=john
```

Backend (search across multiple fields):
```typescript
if (search) {
  where.OR = [
    { name: { contains: search, mode: 'insensitive' } },
    { phone: { contains: search } },
    { email: { contains: search, mode: 'insensitive' } },
  ];
}
```

---

## Sorting

### **Request Format**

```
?sort=created_at:desc    // Sort by created_at descending
?sort=name:asc           // Sort by name ascending
```

### **Backend Implementation**

```typescript
const orderBy: any = {};

if (sort) {
  const [field, direction] = sort.split(':');
  orderBy[field] = direction || 'asc';
} else {
  // Default sort
  orderBy.created_at = 'desc';
}
```

### **Multiple Sort Fields** (if needed)

```
?sort=status:asc,created_at:desc
```

Backend:
```typescript
if (sort) {
  const sorts = sort.split(',');
  orderBy = sorts.map(s => {
    const [field, direction] = s.split(':');
    return { [field]: direction || 'asc' };
  });
}
```

---

## Including Related Data

### **Request Format**

```
?include=addresses,service_requests
```

### **Backend Implementation**

```typescript
const include: any = {};

if (includeParam) {
  const relations = includeParam.split(',');
  
  relations.forEach(relation => {
    if (relation === 'addresses') {
      include.addresses = true;
    }
    if (relation === 'service_requests') {
      include.service_requests = true;
    }
  });
}

const lead = await prisma.lead.findUnique({
  where: { id, tenant_id: tenantId },
  include,
});
```

**Alternative**: Always include critical relations, ignore this parameter.

---

## Authentication

### **Authentication Method**

**JWT (JSON Web Token)** via Bearer token in Authorization header.

### **Request Header**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Token Payload** (for reference)

```json
{
  "userId": "user-uuid",
  "tenantId": "tenant-uuid",
  "roles": ["Owner"],
  "email": "user@example.com",
  "iat": 1642329600,
  "exp": 1642416000
}
```

### **Endpoints That Don't Require Auth**

- `GET /health` - Health check
- `POST /auth/login` - Login
- `POST /auth/register` - Registration
- `GET /public/quotes/:token` - Public quote view (token-based)

**All other endpoints require authentication.**

---

## RBAC (Role-Based Access Control)

### **Role Enforcement**

Certain endpoints restrict access by role:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Owner', 'Admin', 'Estimator')
@Post('quotes')
async createQuote(...) {
  // Only Owner, Admin, or Estimator can create quotes
}
```

### **Standard Roles**

| Role | Permissions |
|------|-------------|
| Owner | Full access |
| Admin | Almost full (no billing/subscription) |
| Estimator | Leads, quotes, projects (limited financial) |
| Project Manager | Projects, tasks, change orders |
| Bookkeeper | Financial, invoices, payments |
| Employee | Time clock, assigned tasks |
| Read-only | Reports only |

**See security-rules.md for detailed permission matrix.**

---

## Idempotency

### **When Required**

Idempotency is **required** for:
- Webhook endpoints (Twilio, payment providers)
- Invoice creation
- Payment recording
- Any operation that shouldn't be duplicated

### **Idempotency Key**

**Request Header**:
```
Idempotency-Key: {uuid}
```

**Backend Pattern**:
```typescript
@Post('webhooks/twilio')
async handleTwilioWebhook(
  @Body() body: any,
  @Headers('idempotency-key') idempotencyKey: string,
) {
  // Check if already processed
  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotency_key: idempotencyKey },
  });
  
  if (existing) {
    return { status: 'already_processed' };
  }
  
  // Process webhook
  const result = await this.processWebhook(body);
  
  // Store idempotency key
  await prisma.webhookEvent.create({
    data: {
      idempotency_key: idempotencyKey,
      provider: 'twilio',
      processed_at: new Date(),
      result_status: 'success',
    },
  });
  
  return result;
}
```

**For Twilio**: Use `MessageSid` or `CallSid` as idempotency key.

---

## Rate Limiting

### **Default Limits** (to be implemented)

- Authenticated requests: 1000/hour per user
- Unauthenticated requests: 100/hour per IP
- Webhook endpoints: No limit (handle duplicates via idempotency)

### **Rate Limit Headers** (when implemented)

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 942
X-RateLimit-Reset: 1642416000
```

---

## CORS

### **Allowed Origins**

- `https://app.lead360.app` (admin app)
- `https://*.lead360.app` (tenant portals, wildcard)

### **Allowed Methods**

- GET, POST, PATCH, DELETE, OPTIONS

### **Allowed Headers**

- Content-Type, Authorization, X-Request-ID, Idempotency-Key

### **Credentials**

- Allowed (for cookies if used)

---

## Request/Response Examples

### **Example 1: Create Lead**

**Request**:
```http
POST /api/v1/leads HTTP/1.1
Host: api.lead360.app
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "name": "John Smith",
  "phone": "5551234567",
  "email": "john@example.com",
  "source": "PHONE"
}
```

**Response**:
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "lead-uuid-123",
  "tenant_id": "tenant-uuid-456",
  "name": "John Smith",
  "phone": "5551234567",
  "email": "john@example.com",
  "status": "NEW",
  "source": "PHONE",
  "created_at": "2026-01-15T14:22:00.000Z",
  "updated_at": "2026-01-15T14:22:00.000Z"
}
```

---

### **Example 2: List Leads with Filters**

**Request**:
```http
GET /api/v1/leads?page=1&limit=20&status=QUALIFIED&sort=created_at:desc HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    {
      "id": "lead-1",
      "name": "John Smith",
      "status": "QUALIFIED",
      "created_at": "2026-01-15T10:30:00.000Z"
    },
    {
      "id": "lead-2",
      "name": "Jane Doe",
      "status": "QUALIFIED",
      "created_at": "2026-01-14T16:20:00.000Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### **Example 3: Validation Error**

**Request**:
```http
POST /api/v1/leads HTTP/1.1
Host: api.lead360.app
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "name": "J",
  "phone": "123"
}
```

**Response**:
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Name must be at least 2 characters"
    },
    {
      "field": "phone",
      "message": "Phone number must be 10-15 digits"
    }
  ]
}
```

---

## Frontend Integration Guidelines

### **API Client Setup**

```typescript
// lib/api/client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.lead360.app/api/v1';

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const token = getAuthToken();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(error.statusCode, error.message, error.errors);
  }

  if (response.status === 204) {
    return null as T; // No content
  }

  return response.json();
}
```

### **Error Handling**

```typescript
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public errors?: Array<{ field: string; message: string }>,
  ) {
    super(message);
  }
}

// In component
try {
  const lead = await leadsApi.create(data);
} catch (error) {
  if (error instanceof ApiError) {
    if (error.statusCode === 400) {
      // Show validation errors
      setValidationErrors(error.errors);
    } else if (error.statusCode === 409) {
      // Show conflict message
      showModal('Lead already exists');
    }
  }
}
```

---

## Versioning & Breaking Changes

### **What is a Breaking Change?**

- Removing or renaming a field
- Changing field data type
- Changing error response format
- Removing an endpoint
- Changing authentication method

### **What is NOT a Breaking Change?**

- Adding new endpoints
- Adding new optional fields
- Adding new query parameters
- Adding new response fields
- Improving error messages

### **When to Version**

- Breaking changes require `/api/v2/`
- Non-breaking changes can be added to `/api/v1/`

---

## Summary

**Follow these conventions for**:
- Consistent API design
- Predictable behavior
- Easy frontend integration
- Clear error handling
- Efficient data transfer

**Key Takeaways**:
- REST patterns: GET, POST, PATCH, DELETE
- JSON request/response
- Pagination with meta
- Standard error format
- JWT authentication
- RBAC enforcement
- Idempotency for critical operations
- Multi-tenant filtering (always)

---

**End of API Conventions**

All agents must follow these standards when building or consuming APIs.