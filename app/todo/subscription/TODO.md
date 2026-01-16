# Subscription Module - Implementation Status & TODO

**Last Updated**: January 15, 2026
**Module**: Subscription Plans Management
**Status**: ✅ Core Features Complete | 🚧 Advanced Features Pending

---

## Table of Contents

1. [Overview](#overview)
2. [Completed Features](#completed-features)
3. [Pending Features](#pending-features)
4. [Technical Implementation](#technical-implementation)
5. [Testing Checklist](#testing-checklist)
6. [Future Enhancements](#future-enhancements)

---

## Overview

The Subscription Plans Management module allows platform admins to create, manage, and configure subscription plans for tenants. This includes pricing, feature flags, user/storage limits, and trial configurations.

### Key Components

- **Subscription Plans CRUD** (`/admin/subscriptions`)
- **Trial System Integration** (offers_trial, trial_days)
- **Feature Flags Management** (checkbox-based UI)
- **Tenant Creation Integration** (Step 3: Subscription Configuration)
- **Plan Assignment** (during tenant creation)

---

## Completed Features

### ✅ 0. API Response Handling Fix (CRITICAL)

**Issue Discovered**: Dashboard was showing "create first plan" message despite API returning data.

**Root Cause**: API returns array directly `[{...}]` but frontend expected object `{ plans: [...] }`

**Files Updated**:
- ✅ `/var/www/lead360.app/app/src/lib/api/admin.ts` - `getSubscriptionPlans()` function

**Fixes Applied**:
1. ✅ Handle array response format (API returns array, not wrapped object)
2. ✅ Parse `feature_flags` from JSON string to object
3. ✅ Convert `monthly_price` from string to number (parseFloat)
4. ✅ Convert `annual_price` from string to number (parseFloat)
5. ✅ Convert `max_storage_gb` from string to number (parseFloat)
6. ✅ Return properly formatted `SubscriptionPlanListResponse` object

**Code Changes**:
```typescript
// Before (broken):
export async function getSubscriptionPlans(): Promise<SubscriptionPlanListResponse> {
  const response = await apiClient.get<SubscriptionPlanListResponse>('/admin/subscription-plans');
  return response.data; // ❌ response.data is array, not { plans: [] }
}

// After (fixed):
export async function getSubscriptionPlans(): Promise<SubscriptionPlanListResponse> {
  const response = await apiClient.get('/admin/subscription-plans');

  // Handle array response
  const plansData = Array.isArray(response.data) ? response.data : response.data.plans || [];

  // Transform each plan
  const transformedPlans = plansData.map((plan: any) => ({
    ...plan,
    monthly_price: typeof plan.monthly_price === 'string' ? parseFloat(plan.monthly_price) : plan.monthly_price,
    annual_price: typeof plan.annual_price === 'string' ? parseFloat(plan.annual_price) : plan.annual_price,
    max_storage_gb: typeof plan.max_storage_gb === 'string' ? parseFloat(plan.max_storage_gb) : plan.max_storage_gb,
    feature_flags: typeof plan.feature_flags === 'string' ? JSON.parse(plan.feature_flags) : plan.feature_flags,
  }));

  return { plans: transformedPlans, pagination: undefined };
}
```

**Impact**: Dashboard now correctly displays subscription plans with proper data types.

### ✅ 0.1. Plan Tenants Modal Fix (CRITICAL)

**Issue Discovered**: Modal showing tenants using a plan was empty despite API returning data.

**Root Cause**: API returns `{ plan: {...}, tenant_count: number, tenants: [...] }` but frontend expected `{ data: [...], pagination: {...} }` format

**Files Updated**:
- ✅ `/var/www/lead360.app/app/src/lib/api/admin.ts` - `getSubscriptionPlanTenants()` function

**Fixes Applied**:
1. ✅ Handle API response structure with nested `tenants` array
2. ✅ Transform to `TenantListResponse` format with `data` property
3. ✅ Create pagination object from `tenant_count`
4. ✅ Use correct field names (`total_pages` not `totalPages` for local type)

**Code Changes**:
```typescript
// Before (broken):
export async function getSubscriptionPlanTenants(planId: string): Promise<TenantListResponse> {
  const response = await apiClient.get<TenantListResponse>(`/admin/subscription-plans/${planId}/tenants`);
  return response.data; // ❌ Wrong format
}

// After (fixed):
export async function getSubscriptionPlanTenants(planId: string): Promise<TenantListResponse> {
  const response = await apiClient.get(`/admin/subscription-plans/${planId}/tenants`);
  const responseData = response.data;

  return {
    data: responseData.tenants || [],
    pagination: {
      total: responseData.tenant_count || 0,
      page: 1,
      limit: responseData.tenant_count || 0,
      total_pages: 1,
    },
  };
}
```

**Impact**: Modal now displays tenants using the selected plan correctly.

### ✅ 0.2. Plan Detail Page with Tenants Tab (UX IMPROVEMENT)

**Issue**: Modal for viewing tenants was not ideal UX - limited space, no deep linking, no proper navigation.

**Solution**: Created dedicated plan detail page with tabs.

**Files Created**:
- ✅ `/var/www/lead360.app/app/src/app/(dashboard)/admin/subscriptions/[id]/page.tsx` - Full plan detail page

**Files Updated**:
- ✅ `/var/www/lead360.app/app/src/app/(dashboard)/admin/subscriptions/page.tsx` - Replaced "View Tenants" modal with "View Details" link

### ✅ 0.3. Authentication Fix for Plan Detail Page (CRITICAL)

**Issue**: Plan detail page (`/admin/subscriptions/[id]`) was getting 401 Unauthorized errors, but same API call worked in Postman.

**Root Cause**: Detail page used raw `fetch()` with `localStorage.getItem('token')` instead of proper `apiClient` which handles token refresh and proper auth headers.

**Files Updated**:
- ✅ `/var/www/lead360.app/app/src/app/(dashboard)/admin/subscriptions/[id]/page.tsx` - Fixed authentication

**Fixes Applied**:
1. ✅ Replaced raw fetch with dynamic import of `apiClient`
2. ✅ Used `apiClient.get()` which properly handles authentication
3. ✅ Removed manual Authorization header construction

**Code Changes**:
```typescript
// Before (broken):
const rawResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/subscription-plans/${planId}/tenants`, {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
  },
});

// After (fixed):
const { apiClient } = await import('@/lib/api/axios');
const response = await apiClient.get(`/admin/subscription-plans/${planId}/tenants`);
```

**Impact**: Plan detail page now loads correctly with proper authentication.

### ✅ 0.4. Edit Plan Button Navigation Fix

**Issue**: "Edit Plan" button on detail page linked to `/admin/subscriptions` without opening the edit modal for the specific plan.

**Solution**: Implemented query parameter navigation to auto-open edit modal.

**Files Updated**:
- ✅ `/var/www/lead360.app/app/src/app/(dashboard)/admin/subscriptions/[id]/page.tsx` - Edit button now links with `?edit={planId}` query param
- ✅ `/var/www/lead360.app/app/src/app/(dashboard)/admin/subscriptions/page.tsx` - Added query param detection and auto-open edit modal logic

**Implementation**:
1. ✅ Edit button now navigates to `/admin/subscriptions?edit={planId}`
2. ✅ Main subscriptions page detects `edit` query parameter via `useSearchParams()`
3. ✅ Auto-opens edit modal for the specified plan
4. ✅ Removes query parameter from URL after modal opens (clean URL)
5. ✅ Enhanced button styling (blue primary button with edit icon)

**Code Changes**:
```typescript
// Detail page - Edit button:
<Link
  href={`/admin/subscriptions?edit=${planId}`}
  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
>
  <EditIcon />
  Edit Plan
</Link>

// Main page - Auto-open edit modal:
useEffect(() => {
  const editPlanId = searchParams.get('edit');
  if (editPlanId && plans.length > 0) {
    const planToEdit = plans.find(p => p.id === editPlanId);
    if (planToEdit) {
      openEditModal(planToEdit);
      window.history.replaceState({}, '', '/admin/subscriptions');
    }
  }
}, [searchParams, plans]);
```

**Impact**: Users can now edit plans directly from the detail page, and the edit modal opens automatically when navigating from detail view.

**Features Implemented**:
1. ✅ **Overview Tab** - Complete plan information
   - Pricing card (monthly/annual with savings calculation)
   - Limits card (max users, storage)
   - Feature flags grid with enabled/disabled visual indicators
   - Plan metadata (name, description, badges)

2. ✅ **Tenants Tab** - Full tenant list with search
   - Search by company name or subdomain
   - Comprehensive table with all fields:
     - Company name (clickable link to tenant detail)
     - Subdomain
     - Subscription status badge (active, trial, cancelled, past_due, expired)
     - Billing cycle (monthly/annual)
     - Next billing date OR trial end date (conditional)
     - Created date
   - Real-time search filtering
   - Empty states (no tenants, no search results)
   - Results count display

3. ✅ **Navigation**
   - Back button to plans list
   - Direct link to tenant details from table
   - Breadcrumb navigation

4. ✅ **API Integration**
   - Fetches raw API response to get full plan and tenants data
   - Transforms API response format properly
   - Parses JSON strings (feature_flags)
   - Converts string numbers to numeric types

**Impact**:
- Much better UX with dedicated page and tabs
- Search functionality for large tenant lists
- Deep linking support (shareable URLs)
- More space for information display
- Professional dashboard feel

### ✅ 0.3. Authentication Fix for Plan Detail Page (CRITICAL)

**Issue**: Plan detail page was getting 401 Unauthorized errors despite user being logged in. Postman worked fine with same endpoint.

**Root Cause**: Detail page was using raw `fetch()` with `localStorage.getItem('token')` for authentication, but the app uses a different token storage mechanism via `getAccessToken()` utility in the apiClient.

**Files Updated**:
- ✅ `/var/www/lead360.app/app/src/app/(dashboard)/admin/subscriptions/[id]/page.tsx`

**Fix Applied**:
```typescript
// Before (broken - 401 errors):
const rawResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/subscription-plans/${planId}/tenants`, {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,  // ❌ Wrong token source
  },
});

// After (fixed):
const { apiClient } = await import('@/lib/api/axios');
const response = await apiClient.get(`/admin/subscription-plans/${planId}/tenants`);
// ✅ apiClient automatically handles auth with correct token storage
```

**Impact**: Plan detail page now works correctly with proper authentication.

---

### ✅ 1. Subscription Plans Management Page

**Location**: `/var/www/lead360.app/app/src/app/(dashboard)/admin/subscriptions/page.tsx`

**Features Implemented**:
- ✅ View all subscription plans in a table
- ✅ Create new subscription plans (modal form)
- ✅ Edit existing subscription plans (modal form)
- ✅ Delete subscription plans (with confirmation)
- ✅ View tenants using a specific plan
- ✅ Real-time stats cards (Total Plans, Active Plans, Default Plan, Avg Price)
- ✅ Plan status badges (Active/Inactive)
- ✅ Default plan badge (purple)
- ✅ Trial badge (green, shows "{X}-day trial")
- ✅ Mobile-responsive layout

**Form Fields**:
- ✅ Plan Name (required)
- ✅ Description (optional)
- ✅ Monthly Price (required, currency input with dollar sign)
- ✅ Annual Price (required, currency input with dollar sign)
- ✅ Max Users (optional, null = unlimited)
- ✅ Max Storage GB (optional, null = unlimited)
- ✅ Trial Configuration (checkbox toggle + days input)
- ✅ Feature Flags (checkbox groups organized by category)
- ✅ Active Status (checkbox)
- ✅ Default Plan (checkbox)

**Trial Configuration UI**:
- ✅ "Offer Free Trial Period" checkbox toggle
- ✅ Trial Days input (conditional, only shows when trial is enabled)
- ✅ Auto-sets trial_days to 14 when enabled
- ✅ Clears trial_days to null when disabled
- ✅ Validation: trial_days must be > 0 when trial is offered
- ✅ Helper text: "Number of days new tenants can use this plan for free"

**Feature Flags UI**:
- ✅ Grouped by category (Core, CRM, Financial, Project, Advanced, Enterprise)
- ✅ 19 feature flags available:
  - Core: dashboard, settings, users, subscription, files
  - CRM: leads, tasks, calendar, timeclock
  - Financial: quotes_module, invoices_module, payments, expenses
  - Project: projects
  - Advanced: reports, advanced_reporting, inventory_module
  - Enterprise: api_access, custom_integrations
- ✅ Checkbox-based selection (multi-select)
- ✅ Visual card layout with category headers
- ✅ Hover effects for better UX

---

### ✅ 2. TypeScript Types

**Location**: `/var/www/lead360.app/app/src/lib/types/admin.ts`

**Updates Made**:

#### SubscriptionPlan Interface (lines 482-497)
```typescript
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_users: number | null; // null = unlimited
  max_storage_gb: number | null; // null = unlimited
  feature_flags: FeatureFlags; // JSON object with feature availability
  is_active: boolean;
  is_default: boolean; // Default plan for new signups
  offers_trial: boolean; // ✅ NEW: Whether this plan offers a free trial period
  trial_days: number | null; // ✅ UPDATED: Trial duration (only if offers_trial is true)
  created_at: string;
  updated_at: string;
}
```

#### CreateSubscriptionPlanDto (lines 509-521)
```typescript
export interface CreateSubscriptionPlanDto {
  name: string;
  description?: string;
  monthly_price: number;
  annual_price: number;
  max_users?: number | null;
  max_storage_gb?: number | null;
  feature_flags?: FeatureFlags;
  is_active?: boolean;
  is_default?: boolean;
  offers_trial?: boolean; // ✅ NEW
  trial_days?: number | null; // ✅ UPDATED
}
```

#### UpdateSubscriptionPlanDto (lines 523-535)
```typescript
export interface UpdateSubscriptionPlanDto {
  name?: string;
  description?: string;
  monthly_price?: number;
  annual_price?: number;
  max_users?: number | null;
  max_storage_gb?: number | null;
  feature_flags?: FeatureFlags;
  is_active?: boolean;
  is_default?: boolean;
  offers_trial?: boolean; // ✅ NEW
  trial_days?: number | null; // ✅ UPDATED
}
```

#### FeatureFlags Interface (lines 446-480)
```typescript
export interface FeatureFlags {
  [key: string]: boolean | undefined; // ✅ FIXED: Added undefined for optional properties
  // Core modules
  dashboard?: boolean;
  settings?: boolean;
  users?: boolean;
  subscription?: boolean;
  files?: boolean;
  // ... 14 more feature flags
}
```

---

### ✅ 3. API Integration

**Location**: `/var/www/lead360.app/app/src/lib/api/admin.ts`

**Functions Available**:
- ✅ `getSubscriptionPlans()` - Fetch all plans
- ✅ `getSubscriptionPlan(planId)` - Fetch single plan
- ✅ `createSubscriptionPlan(dto)` - Create new plan
- ✅ `updateSubscriptionPlan(planId, dto)` - Update existing plan
- ✅ `deleteSubscriptionPlan(planId)` - Delete plan
- ✅ `getSubscriptionPlanTenants(planId)` - Get tenants using a plan

**Backend API Endpoints**:
- ✅ `GET /api/v1/admin/subscription-plans`
- ✅ `GET /api/v1/admin/subscription-plans/:id`
- ✅ `POST /api/v1/admin/subscription-plans`
- ✅ `PATCH /api/v1/admin/subscription-plans/:id`
- ✅ `DELETE /api/v1/admin/subscription-plans/:id`
- ✅ `GET /api/v1/admin/subscription-plans/:id/tenants`

---

### ✅ 4. Tenant Creation Integration

**Location**: `/var/www/lead360.app/app/src/app/(dashboard)/admin/tenants/create/page.tsx`

**Step 3: Subscription Configuration**:
- ✅ Loads active subscription plans
- ✅ Displays plan selector with pricing (monthly/annual)
- ✅ Shows plan details (max users, storage, description)
- ✅ Subscription status selection (Trial or Active)
- ✅ Trial configuration (trial_end_date picker)
- ✅ Active configuration (billing cycle + next billing date)
- ✅ Review step shows all subscription details
- ✅ Proper validation for all fields
- ✅ Auto-sets trial_end_date to 30 days from today

**Trial Flow**:
1. Admin selects plan that has `offers_trial: true`
2. Admin chooses "Trial" status
3. Backend auto-calculates trial_end_date based on plan's trial_days
4. Tenant gets trial access with expiration date

---

### ✅ 5. Build & Compilation

**Status**: ✅ All builds successful

- ✅ TypeScript compilation passes
- ✅ No type errors
- ✅ All 36 pages generated
- ✅ Production-ready code

---

## Pending Features

### 🚧 1. Trial System - Frontend Components

**Priority**: Medium
**Estimated Effort**: 3-4 hours
**Reference**: `/var/www/lead360.app/api/documentation/trial_system_frontend_guide.md`

**Components Needed**:

#### A. Trial Banner Component
- **Location**: `app/src/components/billing/TrialBanner.tsx`
- **When to Show**: Trial is active AND days remaining <= 7
- **Design**:
  - Blue banner for 7+ days remaining
  - Red banner for 1-3 days remaining (urgent)
  - Shows: "Your trial expires in X days"
  - "Upgrade Now" button
- **Auto-refresh**: Every 30 seconds

#### B. Trial Expired Modal
- **Location**: `app/src/components/billing/TrialExpiredModal.tsx`
- **When to Show**: User gets 403 error OR tries to access app after expiration
- **Design**:
  - Full-screen blocking modal
  - Cannot close (closeable: false)
  - "View Plans & Upgrade" button
  - "Contact Support" button
- **Behavior**: Blocks all features except billing/settings

#### C. Subscription Status Badge
- **Location**: `app/src/components/billing/SubscriptionStatusBadge.tsx`
- **Where to Show**: Dashboard header, Settings page, Billing page
- **Statuses**:
  - Trial (blue) - shows days remaining
  - Active (green)
  - Past Due (yellow)
  - Canceled (red)

#### D. useSubscription Hook
- **Location**: `app/src/lib/hooks/useSubscription.ts`
- **Purpose**: Centralized subscription state management
- **Returns**:
  ```typescript
  {
    isOnTrial: boolean;
    isActive: boolean;
    isPastDue: boolean;
    isCanceled: boolean;
    trialDaysRemaining: number | null;
    trialExpiresAt: Date | null;
    isTrialExpiringSoon: boolean;
    planName: string;
    planFeatures: Record<string, boolean>;
    storageQuota: { used, max, percentage, isUnlimited };
  }
  ```

---

### 🚧 2. Trial System - Error Handling

**Priority**: High
**Estimated Effort**: 1-2 hours

**Required Updates**:

#### Axios Interceptor Enhancement
- **Location**: `app/src/lib/api/axios.ts`
- **Task**: Add trial expiration detection
- **Implementation**:
  ```typescript
  if (error.response?.status === 403) {
    const message = error.response.data?.message || '';
    if (message.includes('trial period has expired')) {
      // Redirect to upgrade page OR show modal
      window.location.href = '/billing/upgrade';
      return Promise.reject(new Error('TRIAL_EXPIRED'));
    }
  }
  ```

---

### 🚧 3. Upgrade/Billing Page

**Priority**: Low (can be done later)
**Estimated Effort**: 4-6 hours

**New Page Required**:
- **Location**: `app/src/app/(dashboard)/billing/upgrade/page.tsx`
- **Purpose**: Allow tenants to view and upgrade plans

**Features**:
- Display all active subscription plans
- Highlight current plan
- Show trial badge on plans offering trials
- Pricing comparison (monthly vs annual)
- Feature comparison table
- "Upgrade Now" or "Start X-day Trial" buttons
- Contact Sales option for Enterprise

**Design**:
- 3-column pricing table (mobile: vertical stack)
- Feature checklist with icons
- Prominent CTA buttons
- Annual savings calculation
- FAQ section

---

### 🚧 4. Self-Service Plan Management

**Priority**: Low
**Estimated Effort**: 6-8 hours

**Features**:
- Allow tenants to upgrade their own plan
- Allow tenants to downgrade (with confirmation)
- Handle proration for billing cycle changes
- Payment integration (Stripe/Paddle)
- Invoice generation
- Subscription history

**Pages Needed**:
- `/billing/current` - Current subscription details
- `/billing/history` - Payment history
- `/billing/upgrade` - Plan selection
- `/billing/checkout` - Payment processing

---

### 🚧 5. Analytics & Tracking

**Priority**: Low
**Estimated Effort**: 2-3 hours

**Metrics to Track**:
- Trial starts (by plan)
- Trial conversions (trial → paid)
- Trial expirations (not converted)
- Plan upgrades/downgrades
- MRR (Monthly Recurring Revenue)
- Churn rate
- Average plan price

**Tools**:
- Mixpanel/Amplitude for events
- Dashboard widget for key metrics
- Email notifications for trial events

---

### 🚧 6. Email Notifications

**Priority**: Medium
**Estimated Effort**: 3-4 hours (backend work required)

**Email Templates Needed**:
1. **Trial Started**
   - Welcome to your trial
   - How to get started
   - What happens at end of trial

2. **Trial Expiring Soon** (3 days before)
   - Urgent: Trial expires in 3 days
   - Upgrade now to keep access
   - Link to billing page

3. **Trial Expired**
   - Your trial has ended
   - Upgrade to continue using features
   - Contact support if needed

4. **Subscription Activated**
   - Welcome to paid plan
   - Billing details
   - Thank you message

5. **Payment Failed**
   - Payment could not be processed
   - Update payment method
   - Grace period notice

**Backend Work**:
- Create email templates in `/api/src/modules/email/`
- Schedule jobs for trial expiration reminders
- Integrate with email service (SendGrid/AWS SES)

---

### 🚧 7. Feature Flag Enforcement

**Priority**: High (Security)
**Estimated Effort**: 4-6 hours (backend work)

**Current Issue**: Feature flags are stored but not enforced

**Required Implementation**:

#### Backend Middleware
- **Location**: `api/src/common/guards/feature-flag.guard.ts`
- **Purpose**: Block access to disabled features
- **Implementation**:
  ```typescript
  @Injectable()
  export class FeatureFlagGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      const tenant = request.tenant;
      const requiredFeature = this.reflector.get<string>(
        'feature',
        context.getHandler()
      );

      if (!tenant.subscription_plan.feature_flags[requiredFeature]) {
        throw new ForbiddenException(
          `This feature is not available on your current plan`
        );
      }

      return true;
    }
  }
  ```

#### Decorator Usage
- **Example**:
  ```typescript
  @Get('/leads')
  @RequireFeature('leads_module')
  async getLeads() { ... }
  ```

#### Frontend Route Protection
- **Location**: `app/src/components/ProtectedRoute.tsx`
- **Enhancement**: Check feature flags before rendering
- **Implementation**:
  ```typescript
  if (requiredFeature && !tenant.subscription_plan.feature_flags[requiredFeature]) {
    return <FeatureNotAvailable feature={requiredFeature} />;
  }
  ```

---

### 🚧 8. Storage Quota Enforcement

**Priority**: High (Security)
**Estimated Effort**: 2-3 hours (backend work)

**Current Issue**: max_storage_gb is stored but not enforced

**Required Implementation**:

#### File Upload Middleware
- **Location**: `api/src/modules/files/guards/storage-quota.guard.ts`
- **Purpose**: Block uploads if over quota
- **Check**: `current_usage + file_size <= max_storage_gb`

#### Dashboard Widget
- **Location**: `app/src/app/(dashboard)/dashboard/page.tsx`
- **Display**: Storage usage progress bar
- **Colors**:
  - Green: < 70%
  - Yellow: 70-90%
  - Red: > 90%
- **Action**: Link to upgrade page when near limit

---

### 🚧 9. User Limit Enforcement

**Priority**: High (Security)
**Estimated Effort**: 2-3 hours (backend work)

**Current Issue**: max_users is stored but not enforced

**Required Implementation**:

#### User Creation Check
- **Location**: `api/src/modules/users/users.service.ts`
- **Method**: `createUser()`
- **Check**:
  ```typescript
  const currentUserCount = await this.countActiveUsers(tenantId);
  if (plan.max_users && currentUserCount >= plan.max_users) {
    throw new ForbiddenException(
      `User limit reached. Current plan allows ${plan.max_users} users.`
    );
  }
  ```

#### User Invitation Check
- Block invitations if at user limit
- Show upgrade message in UI

---

## Technical Implementation

### File Structure

```
app/src/
├── app/(dashboard)/
│   ├── admin/
│   │   └── subscriptions/
│   │       └── page.tsx ✅ (Complete)
│   └── billing/ 🚧 (Pending)
│       ├── upgrade/
│       │   └── page.tsx
│       ├── current/
│       │   └── page.tsx
│       └── checkout/
│           └── page.tsx
├── components/
│   ├── admin/
│   │   └── subscriptions/ ✅ (No separate components needed - all in page)
│   └── billing/ 🚧 (Pending)
│       ├── TrialBanner.tsx
│       ├── TrialExpiredModal.tsx
│       ├── SubscriptionStatusBadge.tsx
│       └── PlanCard.tsx
├── lib/
│   ├── api/
│   │   └── admin.ts ✅ (Subscription CRUD complete)
│   ├── hooks/
│   │   └── useSubscription.ts 🚧 (Pending)
│   └── types/
│       └── admin.ts ✅ (Complete)
└── todo/
    └── subscription/
        └── TODO.md ✅ (This file)
```

---

## Testing Checklist

### ✅ Completed Tests

#### Subscription Plans CRUD
- [x] Create new subscription plan with all fields
- [x] Create plan with trial (offers_trial: true, trial_days: 14)
- [x] Create plan without trial (offers_trial: false, trial_days: null)
- [x] Edit existing plan (change pricing, limits, features)
- [x] Toggle trial on/off in edit modal
- [x] Delete plan with confirmation
- [x] View tenants using a plan
- [x] Validation: name required
- [x] Validation: prices must be > 0
- [x] Validation: trial_days required when offers_trial is true
- [x] Feature flags selection (multiple checkboxes)
- [x] Currency input displays correctly ($X.XX)
- [x] Plans table shows trial badges
- [x] Plans table shows default badges

#### Integration Tests
- [x] Tenant creation with subscription plan
- [x] Tenant creation with trial status
- [x] Tenant creation with active status + billing cycle

### 🚧 Pending Tests

#### Trial System Tests
- [ ] Trial banner shows when trial is active
- [ ] Trial banner changes to red when 3 days remaining
- [ ] Trial expired modal blocks access
- [ ] 403 error redirects to upgrade page
- [ ] useSubscription hook returns correct data
- [ ] Storage quota widget updates in real-time

#### Feature Flag Tests
- [ ] Backend blocks access to disabled features (API 403)
- [ ] Frontend hides disabled features in navigation
- [ ] Upgrade prompt shows when feature is disabled

#### Enforcement Tests
- [ ] File upload blocked when over storage quota
- [ ] User creation blocked when at user limit
- [ ] Trial expiration prevents access

---

## Future Enhancements

### Phase 1: Self-Service (3-6 months)
- [ ] Stripe/Paddle payment integration
- [ ] Automated billing (recurring charges)
- [ ] Invoice generation and download
- [ ] Payment method management
- [ ] Plan upgrade/downgrade with proration

### Phase 2: Advanced Features (6-12 months)
- [ ] Custom enterprise plans (negotiated pricing)
- [ ] Add-ons (extra users, extra storage)
- [ ] Discounts and coupons
- [ ] Partner/referral program
- [ ] White-label options

### Phase 3: Analytics (ongoing)
- [ ] Revenue dashboard
- [ ] Churn analysis
- [ ] Cohort analysis (trial conversions by cohort)
- [ ] LTV (Lifetime Value) calculations
- [ ] Usage-based billing experiments

---

## Key Decisions Made

### 1. Feature Flags Architecture
**Decision**: Use object with boolean flags instead of string array
**Rationale**:
- More explicit (clear what's enabled/disabled)
- Better TypeScript autocomplete
- Easier to add new flags without breaking changes
- Backend can easily check `plan.feature_flags.leads_module`

### 2. Trial Configuration
**Decision**: Two-field approach (offers_trial + trial_days)
**Rationale**:
- Some plans may not offer trials at all
- Allows flexibility (7-day, 14-day, 30-day, custom)
- Backend can auto-calculate trial_end_date on tenant creation
- Clear separation of "does this plan have trials?" vs "how long?"

### 3. Currency Input
**Decision**: Use CurrencyInput component (not MaskedInput)
**Rationale**:
- Better UX (shows dollar sign, formats on blur)
- Handles decimal places correctly
- Validates input (prevents negative numbers)
- Returns number | null (type-safe)

### 4. Feature Flags UI
**Decision**: Checkbox groups organized by category
**Rationale**:
- More intuitive than searchable multi-select
- Visual grouping helps admins understand feature categories
- Less cognitive load (see all options at once)
- Better for ~20 flags (if 100+, would need search)

---

## Resources

### Documentation
- **Backend API**: `/api/documentation/subscription_plans_REST_API.md`
- **Trial System Guide**: `/api/documentation/trial_system_frontend_guide.md`
- **Swagger Docs**: `https://api.lead360.app/api/docs`

### Related Files
- **Types**: `app/src/lib/types/admin.ts`
- **API Client**: `app/src/lib/api/admin.ts`
- **Subscription Page**: `app/src/app/(dashboard)/admin/subscriptions/page.tsx`
- **Tenant Creation**: `app/src/app/(dashboard)/admin/tenants/create/page.tsx`

### External Resources
- Trial System Design Patterns: https://www.priceintelligently.com/blog/saas-trial-best-practices
- Subscription Billing: https://stripe.com/docs/billing/subscriptions/overview

---

## Questions & Answers

**Q: Why doesn't the trial expire automatically?**
A: Backend handles expiration. When a trial expires, API returns 403 Forbidden. Frontend needs to catch this and show upgrade modal.

**Q: Can a tenant have multiple plans?**
A: No, each tenant has exactly one subscription_plan_id. Plan changes are handled by updating this field (with billing proration if needed).

**Q: What happens to feature flags when a plan is deleted?**
A: Backend prevents deletion if tenants are using the plan. Must migrate tenants to another plan first.

**Q: Can we change a plan's features after tenants are using it?**
A: Yes, but carefully. Changes apply immediately to all tenants on that plan. Best practice: create a new plan version instead.

**Q: How do we handle grandfathered plans?**
A: Mark old plan as `is_active: false`. Existing tenants keep it, but new signups can't select it.

---

## Contact

For questions about this module:
- **Backend Issues**: Check `api/documentation/subscription_plans_REST_API.md`
- **Frontend Issues**: Reference this TODO
- **Feature Requests**: Create ticket in project management system

---

**Last Review**: January 15, 2026
**Next Review**: TBD (when implementing pending features)

---

## Changelog

| Date | Changes | Author |
|------|---------|--------|
| Jan 15, 2026 | Initial TODO created with complete status | Claude |
| Jan 15, 2026 | Added trial system implementation details | Claude |
| Jan 15, 2026 | Added pending features and priorities | Claude |

---

**End of TODO Document**
