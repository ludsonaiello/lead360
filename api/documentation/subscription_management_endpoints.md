# Subscription Management Endpoints Documentation

**Created**: January 16, 2026
**Module**: Admin - Tenant Management
**Base URL**: `https://api.lead360.app/api/v1`

---

## Overview

These endpoints allow Platform Admins to manage tenant subscriptions, including:
- Changing subscription plans
- Updating billing details (cycle, dates, status)
- Viewing subscription change history

**Authentication**: All endpoints require:
- JWT Bearer token
- Platform Admin role (`is_platform_admin = true`)

---

## Endpoints

### 1. Change Subscription Plan

**Endpoint**: `PATCH /admin/tenants/:id/subscription`

**Description**: Change a tenant's subscription plan

**Use Cases**:
- Upgrade tenant from Basic to Professional
- Downgrade tenant from Enterprise to Standard
- Move tenant between plans as needed

**Parameters**:
- `id` (path) - Tenant ID (hex string)

**Request Body**:
```json
{
  "subscription_plan_id": "4a9f36ba-ab93-4f3a-975a-be009f5aa5c6"
}
```

**Request Example**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/admin/tenants/13c2dea464e00499f6e45df14d5a6ce2/subscription \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_plan_id": "4a9f36ba-ab93-4f3a-975a-be009f5aa5c6"
  }'
```

**Success Response (200)**:
```json
{
  "message": "Subscription plan changed successfully",
  "tenant": {
    "id": "13c2dea464e00499f6e45df14d5a6ce2",
    "subdomain": "mrpatchasphalt",
    "company_name": "Mr Patch Asphalt",
    "subscription_plan_id": "4a9f36ba-ab93-4f3a-975a-be009f5aa5c6",
    "subscription_status": "active",
    "subscription_plan": {
      "id": "4a9f36ba-ab93-4f3a-975a-be009f5aa5c6",
      "name": "Enterprise Plan",
      "monthly_price": "999.00",
      "annual_price": "9990.00",
      "max_users": 10000,
      "max_storage_gb": null,
      "feature_flags": "{...}",
      "is_active": true
    },
    // ... other tenant fields
  }
}
```

**Error Responses**:
- `404` - Tenant not found or subscription plan not found
- `400` - Cannot assign an inactive subscription plan
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (not a Platform Admin)

**Audit Log**: Creates audit log entry with:
- Description: `Subscription plan changed from "Old Plan" to "New Plan"`
- Before/After JSON with plan details

---

### 2. Update Subscription Details

**Endpoint**: `PATCH /admin/tenants/:id/subscription-details`

**Description**: Update subscription status, billing cycle, trial dates, and next billing date

**Use Cases**:
- Manually extend trial period
- Change billing from monthly to annual (or vice versa)
- Update next billing date
- Cancel subscription
- Activate trial account

**Parameters**:
- `id` (path) - Tenant ID (hex string)

**Request Body** (all fields optional):
```json
{
  "subscription_status": "active",
  "trial_end_date": "2026-02-15T00:00:00Z",
  "billing_cycle": "monthly",
  "next_billing_date": "2026-02-01T00:00:00Z"
}
```

**Field Descriptions**:
- `subscription_status` - Enum: `"trial"`, `"active"`, `"canceled"`
- `trial_end_date` - ISO date string or `null`
- `billing_cycle` - Enum: `"monthly"`, `"annual"`
- `next_billing_date` - ISO date string or `null`

**Request Example 1: Extend Trial**
```bash
curl -X PATCH https://api.lead360.app/api/v1/admin/tenants/13c2dea464e00499f6e45df14d5a6ce2/subscription-details \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trial_end_date": "2026-03-01T00:00:00Z"
  }'
```

**Request Example 2: Change to Annual Billing**
```bash
curl -X PATCH https://api.lead360.app/api/v1/admin/tenants/13c2dea464e00499f6e45df14d5a6ce2/subscription-details \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "billing_cycle": "annual",
    "next_billing_date": "2027-01-16T00:00:00Z"
  }'
```

**Request Example 3: Activate Trial**
```bash
curl -X PATCH https://api.lead360.app/api/v1/admin/tenants/13c2dea464e00499f6e45df14d5a6ce2/subscription-details \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_status": "active"
  }'
```

**Success Response (200)**:
```json
{
  "message": "Subscription details updated successfully",
  "tenant": {
    "id": "13c2dea464e00499f6e45df14d5a6ce2",
    "subdomain": "mrpatchasphalt",
    "company_name": "Mr Patch Asphalt",
    "subscription_status": "active",
    "trial_end_date": null,
    "billing_cycle": "monthly",
    "next_billing_date": "2026-02-16T00:00:00.000Z",
    // ... other tenant fields
  }
}
```

**Error Responses**:
- `404` - Tenant not found
- `400` - Invalid subscription_status (must be: trial, active, or canceled)
- `400` - Invalid billing_cycle (must be: monthly or annual)
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (not a Platform Admin)

**Audit Log**: Creates audit log entry with:
- Description: `Subscription details updated by Platform Admin`
- Before/After JSON with changed fields

---

### 3. Get Subscription History

**Endpoint**: `GET /admin/tenants/:id/subscription-history`

**Description**: View subscription change history for a tenant (last 50 changes)

**Use Cases**:
- Audit subscription plan changes
- Track billing modifications
- Review admin actions on tenant subscription

**Parameters**:
- `id` (path) - Tenant ID (hex string)

**Request Example**:
```bash
curl -X GET https://api.lead360.app/api/v1/admin/tenants/13c2dea464e00499f6e45df14d5a6ce2/subscription-history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response (200)**:
```json
{
  "tenant": {
    "id": "13c2dea464e00499f6e45df14d5a6ce2",
    "company_name": "Mr Patch Asphalt"
  },
  "history": [
    {
      "id": "audit-log-uuid-1",
      "action": "updated",
      "description": "Subscription plan changed from \"Basic Plan\" to \"Professional Plan\"",
      "changes": {
        "before": {
          "subscription_plan_id": "old-plan-uuid",
          "plan_name": "Basic Plan"
        },
        "after": {
          "subscription_plan_id": "new-plan-uuid",
          "plan_name": "Professional Plan"
        }
      },
      "changed_by": {
        "id": "admin-user-uuid",
        "email": "admin@lead360.app",
        "name": "Admin User"
      },
      "changed_at": "2026-01-16T12:00:00.000Z"
    },
    {
      "id": "audit-log-uuid-2",
      "action": "updated",
      "description": "Subscription details updated by Platform Admin",
      "changes": {
        "before": {
          "subscription_status": "trial",
          "trial_end_date": "2026-01-30T00:00:00.000Z",
          "billing_cycle": "monthly",
          "next_billing_date": null
        },
        "after": {
          "subscription_status": "active",
          "trial_end_date": null,
          "billing_cycle": "monthly",
          "next_billing_date": "2026-02-16T00:00:00.000Z"
        }
      },
      "changed_by": {
        "id": "admin-user-uuid",
        "email": "admin@lead360.app",
        "name": "Admin User"
      },
      "changed_at": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```

**Error Responses**:
- `404` - Tenant not found
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (not a Platform Admin)

**Notes**:
- Returns last 50 subscription-related changes
- Sorted by most recent first
- Filters audit logs for subscription/billing/plan changes
- Shows who made the change and when

---

## Common Workflows

### Workflow 1: Upgrade Tenant to Paid Plan

**Step 1**: Change subscription plan
```bash
PATCH /admin/tenants/:id/subscription
{
  "subscription_plan_id": "professional-plan-uuid"
}
```

**Step 2**: Update subscription details
```bash
PATCH /admin/tenants/:id/subscription-details
{
  "subscription_status": "active",
  "trial_end_date": null,
  "billing_cycle": "monthly",
  "next_billing_date": "2026-02-16T00:00:00Z"
}
```

---

### Workflow 2: Extend Trial Period

**Step 1**: Update trial end date
```bash
PATCH /admin/tenants/:id/subscription-details
{
  "trial_end_date": "2026-03-01T00:00:00Z"
}
```

---

### Workflow 3: Switch from Monthly to Annual Billing

**Step 1**: Update billing cycle and next billing date
```bash
PATCH /admin/tenants/:id/subscription-details
{
  "billing_cycle": "annual",
  "next_billing_date": "2027-01-16T00:00:00Z"
}
```

---

## Frontend Integration Examples

### React Hook for Changing Plan

```typescript
import { apiClient } from '@/lib/api/axios';

export async function changeTenantPlan(
  tenantId: string,
  newPlanId: string
): Promise<void> {
  const response = await apiClient.patch(
    `/admin/tenants/${tenantId}/subscription`,
    { subscription_plan_id: newPlanId }
  );
  return response.data;
}

// Usage in component:
const handlePlanChange = async (newPlanId: string) => {
  try {
    await changeTenantPlan(tenant.id, newPlanId);
    toast.success('Subscription plan changed successfully');
    refetchTenant();
  } catch (error) {
    toast.error('Failed to change subscription plan');
  }
};
```

### React Hook for Updating Billing Details

```typescript
export async function updateSubscriptionDetails(
  tenantId: string,
  details: {
    subscription_status?: 'trial' | 'active' | 'canceled';
    trial_end_date?: string | null;
    billing_cycle?: 'monthly' | 'annual';
    next_billing_date?: string | null;
  }
): Promise<void> {
  const response = await apiClient.patch(
    `/admin/tenants/${tenantId}/subscription-details`,
    details
  );
  return response.data;
}

// Usage in component:
const handleExtendTrial = async () => {
  try {
    await updateSubscriptionDetails(tenant.id, {
      trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    toast.success('Trial extended by 30 days');
    refetchTenant();
  } catch (error) {
    toast.error('Failed to extend trial');
  }
};
```

### React Hook for Subscription History

```typescript
export async function getTenantSubscriptionHistory(
  tenantId: string
): Promise<SubscriptionHistory> {
  const response = await apiClient.get(
    `/admin/tenants/${tenantId}/subscription-history`
  );
  return response.data;
}

// Usage with React Query:
const { data: history, isLoading } = useQuery({
  queryKey: ['tenant-subscription-history', tenantId],
  queryFn: () => getTenantSubscriptionHistory(tenantId),
});
```

---

## Testing Checklist

### Test 1: Change Subscription Plan
- [ ] Change plan to another active plan → Success (200)
- [ ] Try to change to inactive plan → Error (400)
- [ ] Try to change to non-existent plan → Error (404)
- [ ] Try to change non-existent tenant → Error (404)
- [ ] Verify audit log created
- [ ] Verify tenant's plan updated

### Test 2: Update Subscription Details
- [ ] Update subscription_status → Success (200)
- [ ] Update trial_end_date → Success (200)
- [ ] Update billing_cycle → Success (200)
- [ ] Update next_billing_date → Success (200)
- [ ] Update multiple fields at once → Success (200)
- [ ] Set null values → Success (200)
- [ ] Invalid subscription_status → Error (400)
- [ ] Invalid billing_cycle → Error (400)
- [ ] Verify audit log created

### Test 3: Get Subscription History
- [ ] Get history for existing tenant → Success (200)
- [ ] Get history for non-existent tenant → Error (404)
- [ ] Verify history sorted by most recent first
- [ ] Verify only subscription-related changes shown
- [ ] Verify limited to 50 entries

### Test 4: Authorization
- [ ] Call endpoints without token → Error (401)
- [ ] Call endpoints as non-admin user → Error (403)
- [ ] Call endpoints as Platform Admin → Success (200)

---

## Swagger Documentation

All endpoints are documented in Swagger at:
https://api.lead360.app/api/docs

Search for:
- **Tag**: "Admin - Tenant Management"
- **Endpoints**:
  - `PATCH /admin/tenants/{id}/subscription`
  - `PATCH /admin/tenants/{id}/subscription-details`
  - `GET /admin/tenants/{id}/subscription-history`

---

## Notes

1. **Audit Logging**: All subscription changes are logged in the `audit_log` table with:
   - Actor (Platform Admin who made the change)
   - Before/After JSON (showing what changed)
   - Timestamp
   - Description

2. **Trial Management**:
   - Setting `trial_end_date` to a future date allows trial access
   - TrialGuard blocks access when `trial_end_date < now()` and status is `"trial"`
   - Setting status to `"active"` bypasses trial checks

3. **Billing Cycle Changes**:
   - Changing `billing_cycle` doesn't automatically recalculate `next_billing_date`
   - Admin must manually set `next_billing_date` when changing billing cycle

4. **Plan Changes**:
   - Changing plan doesn't modify subscription_status, billing_cycle, or dates
   - Admin should update billing details separately if needed

5. **History Limit**:
   - Subscription history returns last 50 changes only
   - For full audit log access, query `audit_log` table directly

---

**End of Documentation**
