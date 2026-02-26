# Services & Industries Management Sprint

**Sprint Goal**: Implement full CRUD for Services (admin) and enable Tenant self-management of Industries

**Status**: Phase 1 Complete ✅ | Phase 2 Pending | Phase 3 Pending

**Priority**: HIGH - Critical gap identified in platform admin functionality

---

## Table of Contents

1. [Overview](#overview)
2. [Test Credentials](#test-credentials)
3. [Phase 1: Services Admin CRUD (COMPLETED)](#phase-1-services-admin-crud-completed)
4. [Phase 2: Tenant Industry Assignment (TODO)](#phase-2-tenant-industry-assignment-todo)
5. [Phase 3: Comprehensive Documentation (TODO)](#phase-3-comprehensive-documentation-todo)
6. [Testing Protocol](#testing-protocol)
7. [Success Criteria](#success-criteria)

---

## Overview

### Background

The Lead360 platform had an **asymmetrical implementation**:
- **Industries**: ✅ Full admin CRUD + tenant assignment (admin-only)
- **Services**: ⚠️ Backend exists, but NO admin UI to manage services

### User Requirements

1. ✅ **APPROVED**: Create Services Admin CRUD UI (Priority 1 - COMPLETED)
2. ✅ **APPROVED**: Enable tenant self-management of industries (Priority 2 - TODO)
3. ✅ **APPROVED**: Comprehensive API documentation (Priority 3 - TODO)
4. ❌ **REJECTED**: IVR enhancement ("tenant can type greeting manually")

### Architecture

Both services and industries use **platform-wide master lists** with **many-to-many tenant assignments**:

```
┌──────────────┐         ┌────────────────────┐         ┌──────────────┐
│   tenant     │         │  tenant_service    │         │   service    │
├──────────────┤         ├────────────────────┤         ├──────────────┤
│ id (PK)      │◄────────│ tenant_id (FK)     │         │ id (PK)      │
│ name         │         │ service_id (FK)    │────────►│ name (UQ)    │
└──────────────┘         └────────────────────┘         │ slug (UQ)    │
                                                         │ description  │
                                                         │ is_active    │
                                                         └──────────────┘

┌──────────────┐         ┌────────────────────┐         ┌──────────────┐
│   tenant     │         │  tenant_industry   │         │   industry   │
├──────────────┤         ├────────────────────┤         ├──────────────┤
│ id (PK)      │◄────────│ tenant_id (FK)     │         │ id (PK)      │
│ name         │         │ industry_id (FK)   │────────►│ name (UQ)    │
└──────────────┘         └────────────────────┘         │ description  │
                                                         │ is_active    │
                                                         └──────────────┘
```

**Key Concepts**:
- **Services**: What businesses offer (Roofing, Plumbing, HVAC, Pool Cleaning)
- **Industries**: Business categories (Construction, Home Services, Property Management)
- **Voice AI Integration**: Both are included in agent context for contextual conversations

---

## Test Credentials

**CRITICAL**: Use these credentials for ALL testing

### Testing Environment

- **Backend API**: `http://localhost:8000`
- **Frontend**: Your local frontend URL (usually `http://localhost:7000`)

### Test Users

| Role | Email | Password | Use Case |
|------|-------|----------|----------|
| **Platform Admin** | `ludsonaiello@gmail.com` | `978@F32c` | Admin services/industries CRUD, tenant management |
| **Tenant User** | `contact@honeydo4you.com` | `978@F32c` | Tenant services/industries assignment, business settings |

**IMPORTANT**: Test EVERY feature with BOTH users to ensure proper authorization!

---

## Phase 1: Services Admin CRUD (COMPLETED)

### ✅ What Was Completed

#### Backend Implementation

1. **Updated Service Service** ([service.service.ts](../../api/src/modules/tenant/services/service.service.ts))
   - ✅ Added `is_active` field support in `create()` method
   - ✅ Fixed `findAll()` to use `activeOnly` parameter (matches industries pattern)
   - ✅ Made `adminUserId` optional for tenant controller compatibility
   - ✅ Added audit logging with correct method: `auditLogger.log()`
   - ✅ Audit logging structure:
     ```typescript
     {
       actor_user_id: adminUserId,
       actor_type: 'platform_admin',
       entity_type: 'service',
       entity_id: service.id,
       action_type: 'created'|'updated'|'deleted',
       description: 'Created service: ...',
       before_json: oldService, // for update/delete
       after_json: service,     // for create/update
     }
     ```

2. **Created Admin Service Controller** ([service.controller.ts](../../api/src/modules/admin/controllers/service.controller.ts))
   - ✅ GET `/admin/services` - List all services (with `active_only` filter)
   - ✅ GET `/admin/services/:id` - Get single service
   - ✅ POST `/admin/services` - Create service
   - ✅ PATCH `/admin/services/:id` - Update service
   - ✅ DELETE `/admin/services/:id` - Delete service (409 if in use)
   - ✅ Full Swagger documentation
   - ✅ Platform admin guard protection

3. **Updated CreateServiceDto** ([create-service.dto.ts](../../api/src/modules/tenant/dto/create-service.dto.ts))
   - ✅ Added `is_active` field with validation:
     ```typescript
     @ApiPropertyOptional({
       description: 'Whether the service is active',
       example: true,
       default: true,
     })
     @IsBoolean()
     @IsOptional()
     is_active?: boolean;
     ```

4. **Registered Controller** ([admin.module.ts](../../api/src/modules/admin/admin.module.ts))
   - ✅ Added `ServiceController` to controllers array

#### Frontend Implementation

1. **Created Admin Services Page** ([/admin/services/page.tsx](../../app/src/app/(dashboard)/admin/services/page.tsx))
   - ✅ Full CRUD UI (Create, Edit, Delete modals)
   - ✅ Stats cards (Total, Active, Inactive counts)
   - ✅ Search by name, slug, or description
   - ✅ Filter by active/inactive status
   - ✅ Active/inactive toggle (inline)
   - ✅ Conflict detection on delete (shows tenant count)
   - ✅ Slug field with validation (lowercase, hyphens only, auto-generated if empty)
   - ✅ Client-side filtering using `useMemo`

2. **Created API Client** ([admin-services.ts](../../app/src/lib/api/admin-services.ts))
   - ✅ `listServices(activeOnly: boolean)` - Loads all services
   - ✅ `getService(id: string)` - Get single service
   - ✅ `createService(data)` - Create service
   - ✅ `updateService(id, data)` - Update service
   - ✅ `deleteService(id)` - Delete service

3. **Added Service Type** ([admin.ts](../../app/src/lib/types/admin.ts))
   - ✅ Service interface with all fields:
     ```typescript
     export interface Service {
       id: string;
       name: string;
       slug: string;
       description?: string | null;
       is_active: boolean;
       created_at: string;
       updated_at: string;
     }
     ```

4. **Updated Navigation** ([DashboardSidebar.tsx](../../app/src/components/dashboard/DashboardSidebar.tsx))
   - ✅ Added "Services" menu item in Admin → Tenants section
   - ✅ Uses `Wrench` icon from lucide-react

### Critical Fixes Applied

#### Issue 1: Validation Error "property is_active should not exist"
- **Root Cause**: `CreateServiceDto` was missing `is_active` field
- **Fix**: Added `is_active` field with proper validation decorators
- **Status**: ✅ FIXED

#### Issue 2: Deactivated services not showing in dashboard
- **Root Cause**: Parameter naming inconsistency (`includeInactive` vs `activeOnly`)
- **Fix**: Changed to `activeOnly` pattern (matches industries)
- **Logic**:
  - `activeOnly = false` → Returns ALL services (active + inactive)
  - `activeOnly = true` → Returns only active services
- **Status**: ✅ FIXED

#### Issue 3: Compilation errors (audit logger, tenant controller)
- **Root Cause**:
  - Wrong audit logger method name (`logChange()` → should be `log()`)
  - Tenant controller also uses service methods (without `adminUserId`)
- **Fix**:
  - Changed to correct audit method: `auditLogger.log()`
  - Made `adminUserId` optional in service methods
  - Only log audit trail if `adminUserId` is provided
- **Status**: ✅ FIXED

### Phase 1 Testing Checklist

**Backend API Testing** (via curl or Postman):

```bash
# Setup
export API_BASE="http://localhost:8000"
export ADMIN_TOKEN="<get from login>"

# Login as admin
curl -X POST $API_BASE/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}'

# Test 1: List all services
curl $API_BASE/admin/services \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test 2: Create service with is_active=true
curl -X POST $API_BASE/admin/services \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pool Cleaning",
    "slug": "pool-cleaning",
    "description": "Pool maintenance and cleaning",
    "is_active": true
  }'

# Test 3: Create inactive service
curl -X POST $API_BASE/admin/services \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Inactive",
    "slug": "test-inactive",
    "is_active": false
  }'

# Test 4: Verify inactive services show up
curl $API_BASE/admin/services \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test 5: Update service
curl -X PATCH $API_BASE/admin/services/<SERVICE_ID> \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'

# Test 6: Delete service (not assigned to tenants)
curl -X DELETE $API_BASE/admin/services/<SERVICE_ID> \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test 7: Try to delete service assigned to tenants (should fail with 409)
# First assign service to tenant, then try delete
```

**Frontend UI Testing**:

- [ ] Login as `ludsonaiello@gmail.com` / `978@F32c`
- [ ] Navigate to Admin → Tenants → Services
- [ ] Verify page loads with stats cards
- [ ] Create new service "Pool Cleaning" with `is_active=true`
- [ ] Verify service appears in table
- [ ] Toggle service to inactive
- [ ] Verify service still visible in "All Status" filter
- [ ] Verify service shows in "Inactive Only" filter
- [ ] Verify service hidden in "Active Only" filter
- [ ] Toggle back to active
- [ ] Edit service (change description)
- [ ] Search for service by name
- [ ] Search for service by slug
- [ ] Delete service (should succeed if not assigned to tenants)
- [ ] Verify audit log entries exist in database

---

## Phase 2: Tenant Industry Assignment (TODO)

### 🎯 Goal

Enable tenants to self-manage their industries (currently admin-only).

### 📋 Requirements

**User Decision**: ✅ "tenant should self-manage"

**Current State**:
- Tenants can VIEW assigned industries (read-only)
- Only platform admins can assign industries
- IndustriesSummary shows "Contact your administrator" warning

**Target State**:
- Tenants can self-select industries from platform-wide list
- Matches services pattern (tenant self-assignment)
- Admin can still view/manage tenant industries
- No "Contact administrator" warning

### Backend Tasks

#### Task 2.1: Add Tenant Industry Endpoints

**File**: `api/src/modules/tenant/tenant.controller.ts`

Add three new endpoints (mirror the services pattern):

```typescript
/**
 * GET /api/v1/tenants/current/industries
 * Get all available industries (platform-wide list)
 */
@Get('current/industries')
@ApiOperation({ summary: 'Get all available industries' })
@ApiQuery({
  name: 'active_only',
  required: false,
  type: Boolean,
  description: 'Only return active industries',
})
async getAvailableIndustries(
  @Query('active_only') activeOnly?: string
) {
  // Call industry service to get all industries
  // activeOnly === 'true' ? only active : all
  return this.industryService.findAll(activeOnly === 'true');
}

/**
 * GET /api/v1/tenants/current/assigned-industries
 * Get industries assigned to current tenant
 */
@Get('current/assigned-industries')
@ApiOperation({ summary: 'Get tenant assigned industries' })
async getAssignedIndustries(@Request() req) {
  const tenantId = req.user.tenant_id;
  return this.industryService.getTenantIndustries(tenantId);
}

/**
 * POST /api/v1/tenants/current/assign-industries
 * Assign industries to current tenant (replaces all)
 */
@Post('current/assign-industries')
@ApiOperation({ summary: 'Assign industries to tenant' })
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      industry_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of industry UUIDs',
      },
    },
  },
})
async assignIndustries(
  @Request() req,
  @Body() assignDto: { industry_ids: string[] }
) {
  const tenantId = req.user.tenant_id;
  const userId = req.user.id;

  // CRITICAL: This REPLACES all assignments (not additive)
  return this.industryService.assignIndustriesToTenant(
    tenantId,
    assignDto.industry_ids,
    userId
  );
}
```

#### Task 2.2: Add Industry Service Methods

**File**: `api/src/modules/admin/services/industry.service.ts`

Add these methods if they don't exist:

```typescript
/**
 * Get tenant's assigned industries
 */
async getTenantIndustries(tenantId: string) {
  const tenantIndustries = await this.prisma.tenant_industry.findMany({
    where: { tenant_id: tenantId },
    include: { industry: true },
  });

  return tenantIndustries.map((ti) => ti.industry);
}

/**
 * Assign industries to tenant (replaces all existing assignments)
 */
async assignIndustriesToTenant(
  tenantId: string,
  industryIds: string[],
  userId: string
) {
  // Validate all industry IDs exist and are active
  const industries = await this.prisma.industry.findMany({
    where: {
      id: { in: industryIds },
      is_active: true,
    },
  });

  if (industries.length !== industryIds.length) {
    const foundIds = industries.map((i) => i.id);
    const missingIds = industryIds.filter((id) => !foundIds.includes(id));
    throw new BadRequestException(
      `Some industry IDs are invalid or inactive: ${missingIds.join(', ')}`
    );
  }

  // Use transaction to replace all assignments
  await this.prisma.$transaction(async (tx) => {
    // Delete existing assignments
    await tx.tenant_industry.deleteMany({
      where: { tenant_id: tenantId },
    });

    // Create new assignments
    if (industryIds.length > 0) {
      await tx.tenant_industry.createMany({
        data: industryIds.map((industry_id) => ({
          id: randomUUID(),
          tenant_id: tenantId,
          industry_id,
        })),
      });
    }
  });

  // Audit log
  await this.auditLogger.log({
    actor_user_id: userId,
    actor_type: 'tenant_user',
    entity_type: 'tenant_industry',
    entity_id: tenantId,
    action_type: 'updated',
    description: `Updated tenant industries (assigned ${industryIds.length} industries)`,
    after_json: { industry_ids: industryIds },
  });

  // Return updated industries
  return this.getTenantIndustries(tenantId);
}
```

**CRITICAL Notes**:
- Assignment is **REPLACE ALL**, not additive
- Must use transaction for atomicity
- Must validate all IDs before replacing
- Must audit log the change

#### Task 2.3: Update Tenant Module

**File**: `api/src/modules/tenant/tenant.module.ts`

Ensure `IndustryService` is imported:

```typescript
import { IndustryService } from '../admin/services/industry.service';

@Module({
  imports: [
    // ... other imports
    AdminModule, // If IndustryService is in AdminModule
  ],
  providers: [
    // ... other providers
    IndustryService, // Add if not already present
  ],
})
```

### Frontend Tasks

#### Task 2.4: Create IndustrySelector Component

**File**: `app/src/components/tenant/IndustrySelector.tsx`

**Pattern**: Copy `ServicesSelector.tsx` and adapt for industries

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { getAvailableIndustries, getAssignedIndustries } from '@/lib/api/tenant-industries';
import type { Industry } from '@/lib/types/tenant';
import CheckboxDropdown from '@/components/ui/CheckboxDropdown';

interface IndustrySelectorProps {
  value: string[]; // Array of industry IDs
  onChange: (industryIds: string[]) => void;
  error?: string;
}

export default function IndustrySelector({ value, onChange, error }: IndustrySelectorProps) {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIndustries();
  }, []);

  const loadIndustries = async () => {
    try {
      setLoading(true);
      const data = await getAvailableIndustries(true); // Only active
      setIndustries(data);
    } catch (error) {
      console.error('Failed to load industries:', error);
    } finally {
      setLoading(false);
    }
  };

  const options = industries.map((industry) => ({
    value: industry.id,
    label: industry.name,
    disabled: !industry.is_active,
  }));

  return (
    <div>
      <CheckboxDropdown
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Select industries..."
        loading={loading}
      />
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
```

#### Task 2.5: Add IndustrySelector to Business Info Wizard

**File**: `app/src/components/tenant/BusinessInfoWizard.tsx`

1. Import the component:
```tsx
import IndustrySelector from './IndustrySelector';
```

2. Add state for industries:
```tsx
const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
```

3. Load assigned industries on mount:
```tsx
useEffect(() => {
  loadAssignedIndustries();
}, []);

const loadAssignedIndustries = async () => {
  try {
    const assigned = await getAssignedIndustries();
    setSelectedIndustries(assigned.map((i) => i.id));
  } catch (error) {
    console.error('Failed to load assigned industries:', error);
  }
};
```

4. Add the field in Step 1 (near Services Offered):
```tsx
{/* Industries */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Industries
  </label>
  <IndustrySelector
    value={selectedIndustries}
    onChange={setSelectedIndustries}
  />
  <p className="text-xs text-gray-500 mt-1">
    Select the industries your business operates in
  </p>
</div>
```

5. Update save/submit handler:
```tsx
const handleSave = async () => {
  // ... existing save logic for services

  // Save industries
  if (selectedIndustries.length > 0) {
    await assignIndustries({ industry_ids: selectedIndustries });
  }
};
```

#### Task 2.6: Update IndustriesSummary Component

**File**: `app/src/components/voice-ai/tenant/settings/IndustriesSummary.tsx`

**Changes**:
1. Remove "Contact your administrator" warning
2. Add "Edit Industries" button that links to Business Settings

```tsx
// Remove this warning:
{industries.length === 0 && (
  <p className="text-sm text-gray-500">
    Contact your administrator to configure industries for your account
  </p>
)}

// Replace with:
{industries.length === 0 && (
  <p className="text-sm text-gray-500">
    No industries assigned. You can manage industries in Business Settings.
  </p>
)}

// Add edit button:
<Link
  href="/settings/business"
  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
>
  Edit Industries →
</Link>
```

#### Task 2.7: Create Tenant Industries API Client

**File**: `app/src/lib/api/tenant-industries.ts`

```typescript
import apiClient from './axios';
import type { Industry } from '../types/tenant';

/**
 * Get all available industries (platform-wide list)
 */
export async function getAvailableIndustries(activeOnly: boolean = true): Promise<Industry[]> {
  const response = await apiClient.get<Industry[]>('/tenants/current/industries', {
    params: { active_only: activeOnly },
  });
  return response.data;
}

/**
 * Get industries assigned to current tenant
 */
export async function getAssignedIndustries(): Promise<Industry[]> {
  const response = await apiClient.get<Industry[]>('/tenants/current/assigned-industries');
  return response.data;
}

/**
 * Assign industries to current tenant (replaces all)
 */
export async function assignIndustries(data: {
  industry_ids: string[];
}): Promise<{ message: string; industries: Industry[] }> {
  const response = await apiClient.post('/tenants/current/assign-industries', data);
  return response.data;
}
```

### Phase 2 Testing Checklist

**Backend API Testing**:

```bash
# Setup
export API_BASE="http://localhost:8000"
export TENANT_TOKEN="<token for contact@honeydo4you.com>"

# Login as tenant
curl -X POST $API_BASE/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}'

# Test 1: Get available industries
curl $API_BASE/api/v1/tenants/current/industries \
  -H "Authorization: Bearer $TENANT_TOKEN"

# Test 2: Get assigned industries (before assignment)
curl $API_BASE/api/v1/tenants/current/assigned-industries \
  -H "Authorization: Bearer $TENANT_TOKEN"

# Test 3: Assign industries
curl -X POST $API_BASE/api/v1/tenants/current/assign-industries \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "industry_ids": ["<home-services-uuid>", "<construction-uuid>"]
  }'

# Test 4: Verify assignment
curl $API_BASE/api/v1/tenants/current/assigned-industries \
  -H "Authorization: Bearer $TENANT_TOKEN"

# Test 5: Replace assignment (assign different industries)
curl -X POST $API_BASE/api/v1/tenants/current/assign-industries \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "industry_ids": ["<property-management-uuid>"]
  }'

# Test 6: Verify old assignments removed
curl $API_BASE/api/v1/tenants/current/assigned-industries \
  -H "Authorization: Bearer $TENANT_TOKEN"

# Test 7: Unassign all (empty array)
curl -X POST $API_BASE/api/v1/tenants/current/assign-industries \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"industry_ids": []}'
```

**Frontend UI Testing**:

- [ ] Login as `contact@honeydo4you.com` / `978@F32c`
- [ ] Navigate to Settings → Business → Business Info
- [ ] Verify IndustrySelector is visible
- [ ] Verify it loads available industries
- [ ] Verify currently assigned industries are pre-selected
- [ ] Select "Home Services" and "Construction"
- [ ] Click Save/Next
- [ ] Verify success notification
- [ ] Navigate to Voice AI settings
- [ ] Verify IndustriesSummary shows selected industries
- [ ] Verify NO "Contact administrator" warning
- [ ] Click "Edit Industries" button
- [ ] Verify it navigates to Business Settings

**Integration Testing**:

- [ ] Assign industries as tenant
- [ ] Login as admin (`ludsonaiello@gmail.com`)
- [ ] Navigate to Admin → Tenants → View "Honey Do 4 You"
- [ ] Verify tenant's assigned industries appear
- [ ] Admin manually changes industries
- [ ] Login as tenant again
- [ ] Verify admin changes are reflected

---

## Phase 3: Comprehensive Documentation (TODO)

### 🎯 Goal

Create production-ready API documentation for all Services and Industries endpoints.

### 📋 Requirements

**User Decision**: ✅ "Improve the documentation properly in details"

**Scope**: Document all 18 endpoints (10 admin + 8 tenant)

### Documentation Tasks

#### Task 3.1: Document Admin Industries Endpoints

**File**: `api/documentation/admin_panel_REST_API.md`

Add section: **"Industries Management (Platform Admin)"**

**Required Details**:

1. **Overview Section**:
   ```markdown
   ## Industries Management (Platform Admin)

   Industries are platform-wide master lists that categorize business types (Construction, Home Services, Property Management, etc.).

   Platform administrators manage the master list of available industries. Tenants can then self-assign industries from this list to categorize their business.

   **Many-to-Many Relationship**: One industry can be assigned to multiple tenants. One tenant can have multiple industries.
   ```

2. **Document Each Endpoint**:
   - GET `/admin/industries` (list all)
   - GET `/admin/industries/:id` (get single)
   - POST `/admin/industries` (create)
   - PATCH `/admin/industries/:id` (update)
   - DELETE `/admin/industries/:id` (delete)

3. **For Each Endpoint Include**:
   - HTTP method and full path
   - Purpose/description
   - Authentication requirement (Bearer token, platform admin only)
   - Request schema (TypeScript interface)
   - Response schema (TypeScript interface)
   - Query parameters (with types, defaults, examples)
   - Example request (curl command)
   - Example response (JSON)
   - Error codes (400, 401, 403, 404, 409)
   - Example error response for 409 (conflict)

**Example Format**:

```markdown
### GET /admin/industries

**Purpose**: List all industries with optional filtering

**Authentication**: Bearer token (Platform Admin only)

**Query Parameters**:
- `active_only` (boolean, optional, default: false) - Only return active industries
- `search` (string, optional) - Search by name or description
- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 20) - Items per page

**Response Schema**:
```typescript
{
  industries: Array<{
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
  page: number;
  limit: number;
}
```

**Example Request**:
```bash
curl http://localhost:8000/admin/industries?active_only=true \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "industries": [
    {
      "id": "uuid-here",
      "name": "Construction",
      "description": "Building and construction services",
      "is_active": true,
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

**Error Codes**:
- `401 Unauthorized` - No valid token provided
- `403 Forbidden` - Not a platform admin
```

**Repeat this format for all 5 industry admin endpoints.**

#### Task 3.2: Document Admin Services Endpoints

**File**: `api/documentation/admin_panel_REST_API.md`

Add section: **"Services Management (Platform Admin)"**

**Same structure as industries, but include slug field**:

1. Overview explaining services vs industries
2. Document all 5 endpoints (GET list, GET single, POST, PATCH, DELETE)
3. Highlight slug field:
   - Format: lowercase, hyphens only (e.g., "roof-repair")
   - Auto-generated from name if not provided
   - Must be unique across all services

**Slug Validation Example**:
```markdown
**Slug Validation**:
- Must match pattern: `/^[a-z0-9-]+$/`
- Examples:
  - ✅ Valid: "roof-repair", "hvac-installation", "pool-cleaning-service"
  - ❌ Invalid: "Roof Repair" (uppercase), "hvac_install" (underscore), "pool service!" (special chars)
- If not provided, auto-generated from name:
  - "Roof Repair" → "roof-repair"
  - "HVAC Installation & Maintenance" → "hvac-installation-maintenance"
```

#### Task 3.3: Document Tenant Industries Endpoints

**File**: `api/documentation/tenant_REST_API.md`

Add new section: **"Industries Assignment (Tenant Self-Service)"**

**Required Details**:

1. **Conceptual Overview**:
```markdown
## Industries Assignment (Tenant Self-Service)

Tenants can self-assign industries to categorize their business. This helps the Voice AI agent understand the business context and provide industry-specific responses.

**Key Concepts**:
- Industries are platform-wide (managed by admins)
- Tenants select which industries apply to their business
- Assignment is **REPLACE ALL** (not additive)
- Used by Voice AI for contextual conversations
```

2. Document these endpoints:
   - GET `/tenants/current/industries` (get available)
   - GET `/tenants/current/assigned-industries` (get assigned)
   - POST `/tenants/current/assign-industries` (assign - REPLACES ALL)

3. **CRITICAL Note for POST**:
```markdown
### POST /tenants/current/assign-industries

**⚠️ CRITICAL**: This endpoint **REPLACES ALL** existing assignments. It is not additive.

**Example**:
- Current assignment: ["Construction", "Home Services"]
- You POST: `{"industry_ids": ["Property Management"]}`
- Result: Only "Property Management" is assigned (old assignments removed)
```

#### Task 3.4: Enhance Tenant Services Documentation

**File**: `api/documentation/tenant_REST_API.md`

**Update existing Services section** (around line 2159):

1. Add conceptual overview at beginning:
```markdown
## Services vs Industries

**Services**: What your business offers to customers
- Examples: Roofing, Plumbing, HVAC Repair, Electrical Work
- Tenants self-assign from platform-wide list
- Used by Voice AI to understand capabilities

**Industries**: Your business category
- Examples: Construction, Home Services, Property Management
- Tenants self-assign from platform-wide list
- Used by Voice AI for industry context

**Both** are platform-wide master lists managed by admins, but tenants can self-assign which apply to their business.
```

2. Add **CRITICAL notes** to POST assignment endpoint:
   - Explain REPLACE ALL behavior
   - Provide before/after examples
   - Document atomic transaction behavior

#### Task 3.5: Document Voice AI Context Usage

**File**: `api/documentation/voice_ai_REST_API.md`

Add section: **"Business Context in Voice AI Agent"**

```markdown
## How Services & Industries Are Used in Voice AI

When a call starts, the Voice AI Context Builder loads tenant-specific business information and provides it to the Python voice agent.

### Context Structure

```typescript
interface VoiceAIContext {
  tenant: {
    name: string;
    businessDescription: string | null;
  };
  services: Array<{
    name: string;
    description: string | null;
  }>;
  industries: Array<{
    name: string;
    description: string | null;
  }>;
  businessHours: { /* ... */ };
  serviceAreas: [ /* ... */ ];
  transferNumbers: [ /* ... */ ];
}
```

### Example Context Payload

```json
{
  "tenant": {
    "name": "ABC Roofing",
    "businessDescription": "Full-service roofing contractor"
  },
  "services": [
    { "name": "Roofing", "description": "Roof installation and repair" },
    { "name": "Gutter Installation", "description": "Seamless gutter systems" }
  ],
  "industries": [
    { "name": "Construction", "description": "Building services" },
    { "name": "Home Services", "description": "Residential services" }
  ]
}
```

### How Agent Uses This Context

**Scenario 1**: Caller asks "Do you do roof repairs?"
- Agent checks: `services` array includes "Roofing"
- Agent responds: "Yes, we offer roofing services including repair and installation. Would you like to schedule an appointment?"

**Scenario 2**: Caller asks "What kind of business is this?"
- Agent checks: `industries` array includes "Home Services"
- Agent responds: "We're a home services company specializing in roofing and gutters."

**Scenario 3**: Caller asks "Do you do plumbing?"
- Agent checks: `services` array does NOT include "Plumbing"
- Agent responds: "We don't offer plumbing services, but we specialize in roofing and gutter installation. Can I help you with either of those?"
```

#### Task 3.6: Create Database Schema Documentation

**File**: `api/documentation/database_schema.md`

Add section: **"Services & Industries Tables"**

Include:
1. ERD diagram (ASCII art or Mermaid)
2. Table descriptions (all 6 tables: service, industry, tenant_service, tenant_industry, tenant, and their relationships)
3. Indexes listing
4. Constraints (unique, cascade delete)

**Example ERD**:
```
┌──────────────┐         ┌────────────────────┐         ┌──────────────┐
│   service    │         │  tenant_service    │         │   tenant     │
├──────────────┤         ├────────────────────┤         ├──────────────┤
│ id (PK)      │◄────────│ service_id (FK)    │         │ id (PK)      │
│ name (UQ)    │         │ tenant_id (FK)     │────────►│ name         │
│ slug (UQ)    │         │ created_at         │         │ ...          │
│ description  │         └────────────────────┘         └──────────────┘
│ is_active    │                   |
│ created_at   │                   | Many-to-Many
│ updated_at   │                   | UNIQUE(tenant_id, service_id)
└──────────────┘

[Same structure for industry tables]
```

### Documentation Testing Checklist

- [ ] All 18 endpoints documented (5 admin industries + 5 admin services + 3 tenant industries + 3 tenant services + 2 Voice AI context)
- [ ] Every endpoint has HTTP method, full path, purpose
- [ ] Every endpoint has authentication requirements
- [ ] Every endpoint has request schema
- [ ] Every endpoint has response schema
- [ ] Every endpoint has example request (curl)
- [ ] Every endpoint has example response (JSON)
- [ ] Every endpoint has error codes
- [ ] Critical behaviors documented (REPLACE ALL, slug validation)
- [ ] Services vs Industries distinction explained
- [ ] Voice AI usage documented with examples
- [ ] Database schema with ERD diagram
- [ ] Test all example curl commands for accuracy
- [ ] Verify all response schemas match actual API responses

---

## Testing Protocol

### Environment Setup

```bash
# Backend
cd /var/www/lead360.app/api
npm run start:dev

# Frontend (separate terminal)
cd /var/www/lead360.app/app
npm run dev
```

### Testing Order

1. **Backend Unit Tests** (if available)
   ```bash
   cd api
   npm test
   ```

2. **Backend API Tests** (manual via curl)
   - Test all endpoints with valid inputs
   - Test error cases (401, 403, 404, 409)
   - Verify audit logging

3. **Frontend Component Tests**
   - Test loading states
   - Test error states
   - Test validation
   - Test user interactions

4. **Integration Tests**
   - Admin creates service → Tenant assigns → Voice AI context
   - Admin creates industry → Tenant assigns → Voice AI context
   - Conflict scenarios (delete in-use service/industry)

5. **Cross-Browser Testing**
   - Chrome
   - Firefox
   - Safari

6. **Mobile Testing**
   - Responsive design
   - Touch interactions

---

## Success Criteria

### Phase 1 Success (COMPLETED ✅)

- [x] Admin can create/edit/delete services via UI
- [x] Services include slug field with validation
- [x] Conflict detection works (409 if service assigned to tenants)
- [x] Active/inactive toggle works
- [x] Search and filtering work
- [x] Audit logging captures all changes
- [x] Tenant can see new services in ServicesSelector

### Phase 2 Success (TODO)

- [ ] Tenant can self-assign industries via Business Settings
- [ ] Industries selector loads available industries
- [ ] Currently assigned industries are pre-selected
- [ ] Assignment replaces all previous assignments (atomic)
- [ ] Industries appear in Voice AI settings (no warning)
- [ ] Admin can still view/manage tenant industries
- [ ] Voice AI context includes tenant-selected industries
- [ ] Audit logging captures industry assignments

### Phase 3 Success (TODO)

- [ ] All 18 endpoints documented
- [ ] All examples tested and accurate
- [ ] All schemas match implementation
- [ ] Services vs Industries distinction clear
- [ ] Voice AI usage documented with examples
- [ ] Database schema with ERD
- [ ] Critical behaviors explained (REPLACE ALL, slug validation)
- [ ] Documentation completeness checklist 100%

---

## File Reference

### Backend Files

**Services**:
- Service: `api/src/modules/tenant/services/service.service.ts`
- Admin Controller: `api/src/modules/admin/controllers/service.controller.ts`
- DTOs: `api/src/modules/tenant/dto/create-service.dto.ts`, `update-service.dto.ts`
- Module: `api/src/modules/admin/admin.module.ts`

**Industries**:
- Service: `api/src/modules/admin/services/industry.service.ts`
- Admin Controller: `api/src/modules/admin/controllers/industry.controller.ts`
- DTOs: `api/src/modules/admin/dto/create-industry.dto.ts`, `update-industry.dto.ts`

**Tenant**:
- Controller: `api/src/modules/tenant/tenant.controller.ts`
- Module: `api/src/modules/tenant/tenant.module.ts`

**Voice AI**:
- Context Builder: `api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`
- Interface: `api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts`

**Database**:
- Schema: `api/prisma/schema.prisma`

### Frontend Files

**Admin Services UI**:
- Page: `app/src/app/(dashboard)/admin/services/page.tsx`
- API Client: `app/src/lib/api/admin-services.ts`

**Admin Industries UI**:
- Page: `app/src/app/(dashboard)/admin/industries/page.tsx`
- API Client: `app/src/lib/api/admin-industries.ts`

**Tenant Services UI**:
- Selector: `app/src/components/tenant/ServicesSelector.tsx`
- Wizard: `app/src/components/tenant/BusinessInfoWizard.tsx`

**Tenant Industries UI** (TO BE CREATED):
- Selector: `app/src/components/tenant/IndustrySelector.tsx` (TODO)
- Summary: `app/src/components/voice-ai/tenant/settings/IndustriesSummary.tsx` (UPDATE)

**Types**:
- Admin Types: `app/src/lib/types/admin.ts`
- Tenant Types: `app/src/lib/types/tenant.ts`

**Navigation**:
- Sidebar: `app/src/components/dashboard/DashboardSidebar.tsx`

### Documentation Files (TO BE UPDATED)

- Admin API: `api/documentation/admin_panel_REST_API.md`
- Tenant API: `api/documentation/tenant_REST_API.md`
- Voice AI API: `api/documentation/voice_ai_REST_API.md`
- Database Schema: `api/documentation/database_schema.md`

---

## Common Issues & Solutions

### Issue: "property is_active should not exist"

**Cause**: DTO missing field, server not restarted
**Solution**: Verify CreateServiceDto has `is_active` field, restart backend

### Issue: Inactive services not showing

**Cause**: Wrong parameter logic (`includeInactive` vs `activeOnly`)
**Solution**: Use `activeOnly` pattern (false = all, true = active only)

### Issue: Compilation errors "logChange does not exist"

**Cause**: Wrong audit logger method name
**Solution**: Use `auditLogger.log()` with correct structure

### Issue: Tenant controller compilation errors

**Cause**: Service methods require `adminUserId` but tenant controller doesn't provide it
**Solution**: Make `adminUserId` optional, only log if provided

### Issue: Frontend not loading inactive items

**Cause**: API call using wrong parameter value
**Solution**: Call `listServices(false)` or `listIndustries(false)` to load all

---

## Notes for Next Developer

1. **DO NOT skip testing** - Test EVERY feature with BOTH users (admin AND tenant)
2. **Follow the pattern** - Industries implementation is the reference (fully working)
3. **REPLACE ALL behavior** - Assignment endpoints replace ALL existing assignments (not additive)
4. **Audit logging** - Use `auditLogger.log()` with correct structure (see examples)
5. **Multi-tenant safety** - All queries must filter by `tenant_id`
6. **Use localhost:8000** - Backend API runs on port 8000, not 3000
7. **Server restart required** - DTO changes need full server restart (not hot-reload)
8. **Test credentials** - Use exact credentials provided (passwords are case-sensitive)
9. **Documentation accuracy** - Test ALL curl examples before finalizing docs
10. **Mobile-first** - Test all UI on mobile viewport (375px width minimum)

---

## Sprint Completion Checklist

### Phase 1: Services Admin CRUD ✅

- [x] Backend: Service controller created
- [x] Backend: All 5 endpoints implemented
- [x] Backend: Audit logging added
- [x] Backend: DTO includes `is_active`
- [x] Backend: Compilation errors fixed
- [x] Frontend: Admin services page created
- [x] Frontend: API client created
- [x] Frontend: Service type added
- [x] Frontend: Navigation updated
- [x] Testing: Backend API tested
- [x] Testing: Frontend UI tested
- [x] Testing: Integration tested

### Phase 2: Tenant Industry Assignment (TODO)

- [ ] Backend: Tenant industry endpoints added
- [ ] Backend: Industry service methods added
- [ ] Backend: Module dependencies configured
- [ ] Backend: Audit logging implemented
- [ ] Backend: Compilation successful
- [ ] Frontend: IndustrySelector component created
- [ ] Frontend: Added to Business Info Wizard
- [ ] Frontend: IndustriesSummary updated
- [ ] Frontend: API client created
- [ ] Testing: Backend API tested
- [ ] Testing: Frontend UI tested
- [ ] Testing: Integration tested

### Phase 3: Documentation (TODO)

- [ ] Admin industries endpoints documented (5 endpoints)
- [ ] Admin services endpoints documented (5 endpoints)
- [ ] Tenant industries endpoints documented (3 endpoints)
- [ ] Tenant services docs enhanced (critical notes)
- [ ] Voice AI context documented (with examples)
- [ ] Database schema documented (with ERD)
- [ ] All curl examples tested
- [ ] All response schemas verified
- [ ] Documentation completeness checklist 100%

---

**END OF SPRINT DOCUMENTATION**

Next developer: Start with Phase 2, Task 2.1. Good luck! 🚀
