# Trial System - Frontend Implementation Guide

**Version**: 1.0
**Last Updated**: January 15, 2026
**Target**: Frontend Developers
**Backend Status**: ✅ Complete and Deployed

---

## Overview

The Lead360 platform now has a complete per-plan trial system. This guide explains how to:
1. Display trial information to users
2. Handle trial expiration errors
3. Implement upgrade flows
4. Show trial status in the UI

---

## Table of Contents

1. [API Endpoints Available](#1-api-endpoints-available)
2. [Trial Status Detection](#2-trial-status-detection)
3. [Error Handling](#3-error-handling)
4. [UI Components Needed](#4-ui-components-needed)
5. [User Flows](#5-user-flows)
6. [Code Examples](#6-code-examples)

---

## 1. API Endpoints Available

### Get Storage Usage (Includes Trial Info)
```
GET /api/v1/files/storage/usage
Authorization: Bearer {token}
```

**Response**:
```json
{
  "current_usage_bytes": 157286400,
  "current_usage_gb": 0.15,
  "max_storage_gb": 50,
  "percentage_used": 0.3,
  "is_unlimited": false,
  "file_count": 42
}
```

### Get Current Tenant Info
```
GET /api/v1/tenants/current
Authorization: Bearer {token}
```

**Response** (includes trial fields):
```json
{
  "id": "tenant-uuid",
  "subdomain": "acme-roofing",
  "company_name": "Acme Roofing LLC",
  "subscription_plan_id": "plan-uuid",
  "subscription_status": "trial",
  "trial_end_date": "2026-02-15T00:00:00.000Z",
  "billing_cycle": null,
  "next_billing_date": null,
  "subscription_plan": {
    "id": "plan-uuid",
    "name": "Professional",
    "monthly_price": 99.99,
    "annual_price": 999.99,
    "max_users": 15,
    "max_storage_gb": 50,
    "offers_trial": true,
    "trial_days": 14,
    "feature_flags": {
      "leads_module": true,
      "quotes_module": true,
      "invoices_module": true
    }
  }
}
```

### Get Subscription Plans (For Upgrade Page)
```
GET /api/v1/admin/subscription-plans?include_inactive=false
Authorization: Bearer {platform_admin_token}
```

**Response**:
```json
[
  {
    "id": "plan-1",
    "name": "Basic",
    "monthly_price": 29.99,
    "annual_price": 299.99,
    "max_users": 5,
    "max_storage_gb": 10,
    "offers_trial": true,
    "trial_days": 7,
    "feature_flags": {...}
  },
  {
    "id": "plan-2",
    "name": "Professional",
    "monthly_price": 99.99,
    "annual_price": 999.99,
    "max_users": 15,
    "max_storage_gb": 50,
    "offers_trial": false,
    "trial_days": null,
    "feature_flags": {...}
  }
]
```

---

## 2. Trial Status Detection

### Calculate Days Remaining

```typescript
interface TenantInfo {
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled';
  trial_end_date: string | null;
  subscription_plan: {
    offers_trial: boolean;
    trial_days: number | null;
  };
}

function getTrialStatus(tenant: TenantInfo) {
  if (tenant.subscription_status !== 'trial' || !tenant.trial_end_date) {
    return null;
  }

  const now = new Date();
  const trialEnd = new Date(tenant.trial_end_date);
  const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    isActive: daysRemaining > 0,
    daysRemaining: Math.max(0, daysRemaining),
    expiresAt: trialEnd,
    isExpiringSoon: daysRemaining > 0 && daysRemaining <= 3,
  };
}
```

**Usage**:
```typescript
const trialStatus = getTrialStatus(tenant);

if (trialStatus?.isActive) {
  console.log(`Trial expires in ${trialStatus.daysRemaining} days`);
  if (trialStatus.isExpiringSoon) {
    // Show urgent upgrade banner
  }
}
```

---

## 3. Error Handling

### Trial Expired Error

When the backend blocks a request due to expired trial, you'll receive:

**HTTP 403 Forbidden**:
```json
{
  "statusCode": 403,
  "message": "Your trial period has expired. Please upgrade to a paid plan to continue using Acme Roofing LLC.",
  "error": "Forbidden"
}
```

### Handling in Axios Interceptor

```typescript
// src/lib/api/axios.ts

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      const message = error.response.data?.message || '';

      // Check if it's a trial expiration error
      if (message.includes('trial period has expired')) {
        // Redirect to upgrade page
        window.location.href = '/billing/upgrade';
        return Promise.reject(new Error('TRIAL_EXPIRED'));
      }
    }

    return Promise.reject(error);
  }
);
```

### Handling in React Components

```typescript
// src/lib/hooks/useApiCall.ts

export function useApiCall() {
  const router = useRouter();

  const handleError = (error: any) => {
    if (error.message === 'TRIAL_EXPIRED') {
      // Show modal instead of redirect (optional)
      showTrialExpiredModal();
      return;
    }

    // Handle other errors
    toast.error(error.message);
  };

  return { handleError };
}
```

---

## 4. UI Components Needed

### A. Trial Banner (Header/Dashboard)

**When to Show**:
- Trial is active
- Days remaining <= 7

**Design**:
```tsx
// src/components/billing/TrialBanner.tsx

export function TrialBanner({ tenant }: { tenant: TenantInfo }) {
  const trialStatus = getTrialStatus(tenant);

  if (!trialStatus?.isActive) return null;

  const urgencyClass = trialStatus.isExpiringSoon
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-blue-50 border-blue-200 text-blue-800';

  return (
    <div className={`border-b px-4 py-3 ${urgencyClass}`}>
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5" />
          <span className="font-medium">
            Your trial expires in {trialStatus.daysRemaining} day{trialStatus.daysRemaining !== 1 ? 's' : ''}
          </span>
        </div>
        <Link
          href="/billing/upgrade"
          className="px-4 py-2 bg-white rounded-lg font-medium hover:bg-gray-50"
        >
          Upgrade Now
        </Link>
      </div>
    </div>
  );
}
```

---

### B. Trial Expired Modal

**When to Show**:
- User gets 403 error with trial expired message
- OR user tries to access app after expiration

**Design**:
```tsx
// src/components/billing/TrialExpiredModal.tsx

export function TrialExpiredModal({ isOpen, onClose }: ModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={() => {}} closeable={false}>
      <div className="text-center p-6">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ExclamationIcon className="w-8 h-8 text-red-600" />
        </div>

        <h2 className="text-2xl font-bold mb-2">Trial Period Ended</h2>

        <p className="text-gray-600 mb-6">
          Your free trial has expired. Upgrade to a paid plan to continue using all features.
        </p>

        <div className="flex gap-3 justify-center">
          <Link
            href="/billing/upgrade"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            View Plans & Upgrade
          </Link>

          <button
            onClick={() => router.push('/settings')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
          >
            Contact Support
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

---

### C. Subscription Status Badge

**Where to Show**:
- Dashboard header
- Settings page
- Billing page

**Design**:
```tsx
// src/components/billing/SubscriptionStatusBadge.tsx

export function SubscriptionStatusBadge({ status, trialEndDate }: Props) {
  const configs = {
    trial: {
      label: 'Trial',
      className: 'bg-blue-100 text-blue-800',
      icon: ClockIcon,
    },
    active: {
      label: 'Active',
      className: 'bg-green-100 text-green-800',
      icon: CheckCircleIcon,
    },
    past_due: {
      label: 'Past Due',
      className: 'bg-yellow-100 text-yellow-800',
      icon: ExclamationIcon,
    },
    canceled: {
      label: 'Canceled',
      className: 'bg-red-100 text-red-800',
      icon: XCircleIcon,
    },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
      <Icon className="w-4 h-4" />
      {config.label}
      {status === 'trial' && trialEndDate && (
        <span className="ml-1">
          • {getTrialStatus({ subscription_status: 'trial', trial_end_date: trialEndDate })?.daysRemaining} days left
        </span>
      )}
    </span>
  );
}
```

---

### D. Upgrade Page / Pricing Table

**Route**: `/billing/upgrade` or `/settings/subscription`

**Features**:
- Show all available plans
- Highlight current plan
- Show trial badge on plans that offer trials
- "Upgrade" button for higher plans
- "Contact Sales" for Enterprise

**Design**:
```tsx
// src/app/(dashboard)/billing/upgrade/page.tsx

export default function UpgradePage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get('/admin/subscription-plans'),
  });

  const { data: currentTenant } = useQuery({
    queryKey: ['current-tenant'],
    queryFn: () => api.get('/tenants/current'),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-4">
        Choose Your Plan
      </h1>

      <p className="text-center text-gray-600 mb-12">
        Select the perfect plan for your business needs
      </p>

      <div className="grid md:grid-cols-3 gap-8">
        {plans?.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={plan.id === currentTenant?.subscription_plan_id}
            onUpgrade={() => handleUpgrade(plan.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan, isCurrentPlan, onUpgrade }: PlanCardProps) {
  return (
    <div className={`border rounded-xl p-6 ${isCurrentPlan ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold">{plan.name}</h3>
        {plan.offers_trial && (
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
            {plan.trial_days}-day trial
          </span>
        )}
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold">${plan.monthly_price}</span>
        <span className="text-gray-600">/month</span>
        <p className="text-sm text-gray-500 mt-1">
          or ${plan.annual_price}/year (save ${(plan.monthly_price * 12 - plan.annual_price).toFixed(2)})
        </p>
      </div>

      <ul className="space-y-3 mb-6">
        <li className="flex items-center gap-2">
          <CheckIcon className="w-5 h-5 text-green-500" />
          {plan.max_users} users
        </li>
        <li className="flex items-center gap-2">
          <CheckIcon className="w-5 h-5 text-green-500" />
          {plan.max_storage_gb ? `${plan.max_storage_gb} GB storage` : 'Unlimited storage'}
        </li>
        {Object.entries(plan.feature_flags)
          .filter(([_, enabled]) => enabled)
          .map(([feature, _]) => (
            <li key={feature} className="flex items-center gap-2">
              <CheckIcon className="w-5 h-5 text-green-500" />
              {formatFeatureName(feature)}
            </li>
          ))}
      </ul>

      {isCurrentPlan ? (
        <button disabled className="w-full py-3 bg-gray-300 text-gray-600 rounded-lg font-medium">
          Current Plan
        </button>
      ) : (
        <button
          onClick={onUpgrade}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          {plan.offers_trial ? `Start ${plan.trial_days}-Day Trial` : 'Upgrade Now'}
        </button>
      )}
    </div>
  );
}
```

---

## 5. User Flows

### Flow 1: New Tenant Signup with Trial

1. **Admin creates tenant** with plan that has `offers_trial: true, trial_days: 14`
2. **Backend auto-sets**: `subscription_status = 'trial'`, `trial_end_date = now + 14 days`
3. **User logs in** for the first time
4. **Frontend shows**:
   - Welcome message
   - Trial banner: "Your trial expires in 14 days"
   - Full access to features

### Flow 2: Trial Active (Days Remaining: 7+)

1. **User logs in** daily
2. **Frontend shows**:
   - Small trial banner at top: "Trial expires in X days"
   - No blocking modals
   - All features accessible

### Flow 3: Trial Expiring Soon (Days Remaining: 1-3)

1. **User logs in**
2. **Frontend shows**:
   - **Prominent red banner**: "Trial expires in X days! Upgrade now"
   - **Modal on dashboard** (once per day): "Your trial is ending soon"
   - Link to upgrade page
   - All features still accessible

### Flow 4: Trial Expired

1. **User tries to access app**
2. **Backend returns**: 403 Forbidden
3. **Frontend shows**:
   - Full-screen modal: "Trial Period Ended"
   - Cannot access any features (except billing/settings)
   - "View Plans & Upgrade" button
4. **User clicks upgrade**
5. **Redirected to**: `/billing/upgrade`
6. **After upgrade**:
   - Admin changes status to 'active'
   - User regains full access

---

## 6. Code Examples

### Complete React Hook: `useSubscription`

```typescript
// src/lib/hooks/useSubscription.ts

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/axios';

interface SubscriptionStatus {
  isOnTrial: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  trialDaysRemaining: number | null;
  trialExpiresAt: Date | null;
  isTrialExpiringSoon: boolean;
  planName: string;
  planFeatures: Record<string, boolean>;
  storageQuota: {
    used: number;
    max: number | null;
    percentage: number | null;
    isUnlimited: boolean;
  };
}

export function useSubscription() {
  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['current-tenant'],
    queryFn: async () => {
      const response = await api.get('/tenants/current');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: storage } = useQuery({
    queryKey: ['storage-usage'],
    queryFn: async () => {
      const response = await api.get('/files/storage/usage');
      return response.data;
    },
    enabled: !!tenant,
    staleTime: 60 * 1000, // 1 minute
  });

  const status: SubscriptionStatus = useMemo(() => {
    if (!tenant) {
      return null;
    }

    const isOnTrial = tenant.subscription_status === 'trial';
    const trialStatus = isOnTrial ? getTrialStatus(tenant) : null;

    return {
      isOnTrial,
      isActive: tenant.subscription_status === 'active',
      isPastDue: tenant.subscription_status === 'past_due',
      isCanceled: tenant.subscription_status === 'canceled',
      trialDaysRemaining: trialStatus?.daysRemaining ?? null,
      trialExpiresAt: trialStatus?.expiresAt ?? null,
      isTrialExpiringSoon: trialStatus?.isExpiringSoon ?? false,
      planName: tenant.subscription_plan?.name ?? 'Unknown',
      planFeatures: tenant.subscription_plan?.feature_flags ?? {},
      storageQuota: {
        used: storage?.current_usage_gb ?? 0,
        max: storage?.max_storage_gb ?? null,
        percentage: storage?.percentage_used ?? null,
        isUnlimited: storage?.is_unlimited ?? false,
      },
    };
  }, [tenant, storage]);

  return {
    status,
    isLoading,
    error,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['current-tenant'] }),
  };
}
```

**Usage in Components**:
```typescript
function Dashboard() {
  const { status } = useSubscription();

  return (
    <div>
      {status?.isTrialExpiringSoon && <TrialBanner />}

      <div className="flex items-center gap-2">
        <h1>Dashboard</h1>
        <SubscriptionStatusBadge
          status={status?.isOnTrial ? 'trial' : status?.isActive ? 'active' : 'canceled'}
          trialEndDate={status?.trialExpiresAt}
        />
      </div>

      {/* Dashboard content */}
    </div>
  );
}
```

---

### API Client Functions

```typescript
// src/lib/api/subscription.ts

export const subscriptionApi = {
  /**
   * Get current tenant subscription info
   */
  async getCurrent() {
    const response = await api.get('/tenants/current');
    return response.data;
  },

  /**
   * Get available subscription plans
   */
  async getPlans() {
    const response = await api.get('/admin/subscription-plans', {
      params: { include_inactive: false },
    });
    return response.data;
  },

  /**
   * Get storage usage (includes trial info)
   */
  async getStorageUsage() {
    const response = await api.get('/files/storage/usage');
    return response.data;
  },

  /**
   * Upgrade subscription (platform admin only)
   */
  async upgradePlan(tenantId: string, planId: string) {
    const response = await api.post(`/admin/tenants/${tenantId}/subscription`, {
      subscription_plan_id: planId,
      subscription_status: 'active',
      billing_cycle: 'monthly',
    });
    return response.data;
  },
};
```

---

## 7. TypeScript Types

```typescript
// src/lib/types/subscription.ts

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_users: number;
  max_storage_gb: number | null;
  offers_trial: boolean;
  trial_days: number | null;
  feature_flags: Record<string, boolean>;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  subdomain: string;
  company_name: string;
  subscription_plan_id: string;
  subscription_status: SubscriptionStatus;
  trial_end_date: string | null;
  billing_cycle: 'monthly' | 'annual' | null;
  next_billing_date: string | null;
  subscription_plan: SubscriptionPlan;
}

export interface StorageUsage {
  current_usage_bytes: number;
  current_usage_gb: number;
  max_storage_gb: number | null;
  percentage_used: number | null;
  is_unlimited: boolean;
  file_count: number;
}
```

---

## 8. Testing Checklist

### Manual Testing

- [ ] Trial banner shows correct days remaining
- [ ] Banner turns red when 3 days or less remaining
- [ ] Expired trial shows modal on login
- [ ] Modal blocks access to all pages except /billing/upgrade
- [ ] Upgrade page displays all plans correctly
- [ ] Plans with trials show trial badge
- [ ] "Current Plan" button is disabled
- [ ] "Upgrade" button redirects correctly
- [ ] After upgrade, access is restored
- [ ] Storage quota is displayed correctly

### Edge Cases

- [ ] Trial with 0 days remaining (expires today)
- [ ] Trial with negative days (backend should block, but test anyway)
- [ ] Tenant with no trial_end_date (shouldn't happen, but handle gracefully)
- [ ] Tenant with subscription_status = 'canceled' (show different message)
- [ ] Tenant with subscription_status = 'past_due' (allow access, show warning)

---

## 9. Environment Variables

Add to `.env.local`:

```bash
# API URLs
NEXT_PUBLIC_API_URL=https://api.lead360.app
NEXT_PUBLIC_APP_URL=https://app.lead360.app

# Feature Flags (if using)
NEXT_PUBLIC_ENABLE_TRIAL_SYSTEM=true
NEXT_PUBLIC_TRIAL_WARNING_DAYS=3
```

---

## 10. Support & Troubleshooting

### Common Issues

**Issue**: Trial banner not showing
- **Check**: Verify API returns `subscription_status = 'trial'` and `trial_end_date` is in the future
- **Debug**: Console log `getTrialStatus()` output

**Issue**: 403 errors not caught
- **Check**: Axios interceptor is properly configured
- **Debug**: Check network tab for 403 responses

**Issue**: Storage quota not displaying
- **Check**: `/api/v1/files/storage/usage` endpoint returns data
- **Debug**: Verify subscription plan has `max_storage_gb` set

---

## 11. Next Steps

After implementing basic trial UI:

1. **Add email notifications** (backend work):
   - "Trial starting" email
   - "Trial expiring in 3 days" email
   - "Trial expired" email

2. **Add analytics tracking**:
   - Track trial starts
   - Track trial expirations
   - Track upgrades from trial

3. **Add upgrade flow**:
   - Payment integration (Stripe/Paddle)
   - Checkout page
   - Success/failure handling

4. **Add self-service downgrade**:
   - Allow users to switch plans
   - Handle data migration
   - Prorate billing

---

## Questions?

Contact the backend team or check:
- API Documentation: `/api/documentation/subscription_plans_REST_API.md`
- Swagger UI: `https://api.lead360.app/api/docs`

---

**Happy Coding! 🚀**
