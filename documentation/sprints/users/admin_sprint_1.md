# Admin Sprint 1 — Foundation: Types, API Client, Sidebar Navigation
**Module:** Users (Frontend)
**File:** ./documentation/sprints/users/admin_sprint_1.md
**Type:** Frontend
**Depends On:** Backend Sprints 1–13 (all complete)
**Gate:** STOP — All API functions must return correct types before Sprint 2 starts
**Estimated Complexity:** Medium

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`. The backend is complete and running.
2. **Backend runs on `http://localhost:8000`** (NestJS `--watch` mode via `npm run start:dev`). Do NOT restart it, do NOT run any backend commands.
3. **Frontend runs on `http://localhost:7000`** (Next.js dev server). All your work is in `/var/www/lead360.app/app/`.
4. **You MUST hit every endpoint you are implementing** to verify the ACTUAL response shape. Do NOT trust documentation blindly — build your types from the real API response.
5. **Use existing components, patterns, and modules.** Do NOT create new UI primitives. Use what exists.
6. **Deliver masterclass production-quality code.** Use autocomplete inputs, masked inputs, search selects, modals — no browser alerts, no `window.confirm`, no `window.prompt`.
7. **Respect patterns from other modules.** Read existing API clients and types before writing yours.

---

## Test Accounts

| Account | Email | Password | Purpose |
|---|---|---|---|
| Platform Admin | `ludsonaiello@gmail.com` | `978@F32c` | Platform admin — can access `/admin/*` endpoints |
| Tenant User | `contact@honeydo4you.com` | `978@F32c` | Tenant Owner — can access `/users/*` endpoints |

---

## Objective

Create the foundation files that ALL subsequent Users sprints depend on:
1. TypeScript interfaces for every Users API request/response shape
2. API client functions for every Users endpoint
3. Sidebar navigation update to show "Users" link for Owner/Admin roles

---

## Pre-Sprint Checklist

- [ ] Read `app/src/lib/api/axios.ts` — understand the configured axios client
- [ ] Read `app/src/lib/api/auth.ts` — understand the API client pattern used in this project
- [ ] Read `app/src/lib/api/admin.ts` — understand the admin API client pattern
- [ ] Read `app/src/lib/types/auth.ts` — understand existing type patterns
- [ ] Read `app/src/components/dashboard/DashboardSidebar.tsx` — understand sidebar navigation structure
- [ ] Confirm backend is running: `curl -s http://localhost:8000/health`

---

## Task 1 — Hit Every Endpoint and Capture Real Response Shapes

**What:** Before writing ANY code, authenticate and hit EVERY endpoint below to capture the ACTUAL response JSON. Save these responses mentally — your types and API client MUST match reality.

**How to authenticate:**

Step A — Login as Tenant User (Owner role):
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | head -c 2000
```
Save the `access_token` from the response. Use it as `TENANT_TOKEN` below.

Step B — Login as Platform Admin:
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | head -c 2000
```
Save the `access_token` from the response. Use it as `ADMIN_TOKEN` below.

**Endpoints to hit (Tenant-Scoped — use TENANT_TOKEN):**

```bash
# 1. GET /users — List users in tenant
curl -s "http://localhost:8000/api/v1/users?page=1&limit=5" \
  -H "Authorization: Bearer $TENANT_TOKEN" | head -c 3000

# 2. GET /users/me — Own profile
curl -s http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer $TENANT_TOKEN" | head -c 2000

# 3. GET /rbac/roles — List available roles (for invite dropdown)
curl -s http://localhost:8000/api/v1/rbac/roles \
  -H "Authorization: Bearer $TENANT_TOKEN" | head -c 2000
```

**Endpoints to hit (Platform Admin — use ADMIN_TOKEN):**

```bash
# 4. GET /admin/users — List all users cross-tenant
curl -s "http://localhost:8000/api/v1/admin/users?page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 3000

# 5. GET /admin/users/:id — Get user details (use a user ID from response above)
curl -s http://localhost:8000/api/v1/admin/users/{USER_ID_FROM_ABOVE} \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 3000
```

**IMPORTANT:** Compare the actual response with the documented shapes below. If there are mismatches, **trust the actual API response** and adjust your types accordingly.

**Acceptance:** You have captured all 5 response shapes and noted any differences from documentation.
**Do NOT:** Skip this step. Do NOT guess response shapes.

---

## Task 2 — Create TypeScript Types

**What:** Create `app/src/lib/types/users.ts` with all interfaces for the Users module.

**File to create:** `/var/www/lead360.app/app/src/lib/types/users.ts`

**Pattern to follow:** Read `app/src/lib/types/auth.ts` for the project's type definition style.

**Types to define (adjust field names/types if the real API response differs):**

```typescript
/**
 * Users Module Type Definitions
 * Types for user management, invitations, and membership lifecycle
 * Matches backend API at /api/v1/users/*
 */

// ============================================================================
// Enums
// ============================================================================

export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'INACTIVE';

// ============================================================================
// Core Entities
// ============================================================================

export interface RoleInfo {
  id: string;
  name: string;
  description?: string | null;
}

export interface InvitedByInfo {
  id: string;
  first_name: string;
  last_name: string;
}

export interface MembershipItem {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: RoleInfo;
  status: MembershipStatus;
  joined_at: string | null;
  left_at: string | null;
  invited_by: InvitedByInfo | null;
  created_at: string;
}

export interface UserMeResponse {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  membership: {
    id: string;
    tenant_id: string;
    role: RoleInfo;
    status: MembershipStatus;
    joined_at: string | null;
  };
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PaginatedMemberships {
  data: MembershipItem[];
  meta: PaginationMeta;
}

// ============================================================================
// Request DTOs
// ============================================================================

export interface InviteUserDto {
  email: string;
  role_id: string;
  first_name: string;
  last_name: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  status?: MembershipStatus;
  role_id?: string;
}

export interface UpdateUserRoleDto {
  role_id: string;
}

export interface DeactivateUserDto {
  reason?: string;
}

export interface UpdateMeDto {
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface ChangePasswordDto {
  current_password: string;
  new_password: string;
}

export interface AcceptInviteDto {
  password: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface InviteUserResponse {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleInfo;
  status: 'INVITED';
  created_at: string;
}

export interface DeactivateResponse {
  id: string;
  status: 'INACTIVE';
  left_at: string;
}

export interface ReactivateResponse {
  id: string;
  status: 'ACTIVE';
  joined_at: string;
}

export interface InviteTokenInfo {
  tenant_name: string;
  role_name: string;
  invited_by_name: string;
  email: string;
  expires_at: string;
}

export interface AcceptInviteResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  tenant: {
    id: string;
    company_name: string;
  };
  role: string;
}

// ============================================================================
// Platform Admin Types
// ============================================================================

export interface AdminUserListItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_platform_admin: boolean;
  tenant_id?: string;
  tenant_subdomain?: string;
  tenant_company_name?: string;
  roles: string[];
  last_login_at: string | null;
  created_at: string;
}

export interface AdminUserListResponse {
  data: AdminUserListItem[];
  pagination: PaginationMeta;
}

export interface AdminUserListParams {
  page?: number;
  limit?: number;
  tenant_id?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'deleted';
  search?: string;
  last_login_from?: string;
  last_login_to?: string;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  is_platform_admin: boolean;
  email_verified: boolean;
  tenant_id?: string;
  tenant?: {
    id: string;
    subdomain: string;
    company_name: string;
  } | null;
  roles: {
    id: string;
    name: string;
    description: string | null;
    assigned_at: string;
  }[];
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserAdminDto {
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  password: string;
  phone?: string;
}
```

**IMPORTANT:** After writing this file, compare each interface field-by-field with the actual response you captured in Task 1. Fix any mismatches.

**Acceptance:** File exists, compiles without TypeScript errors, all fields match real API responses.
**Do NOT:** Add fields that don't exist in the actual API response. Do NOT remove fields that do exist.

---

## Task 3 — Create API Client

**What:** Create `app/src/lib/api/users.ts` with all API functions for the Users module.

**File to create:** `/var/www/lead360.app/app/src/lib/api/users.ts`

**Pattern to follow:** Read `app/src/lib/api/auth.ts` and `app/src/lib/api/admin.ts` for the exact pattern:
- Import `apiClient` from `./axios`
- Import types from `../types/users`
- Each function is `export async function` that returns typed data
- Export both named functions and an object for convenience

**API functions to implement:**

```typescript
import apiClient from './axios';
import type {
  PaginatedMemberships,
  ListUsersParams,
  MembershipItem,
  InviteUserDto,
  InviteUserResponse,
  UpdateUserRoleDto,
  DeactivateUserDto,
  DeactivateResponse,
  ReactivateResponse,
  UserMeResponse,
  UpdateMeDto,
  ChangePasswordDto,
  InviteTokenInfo,
  AcceptInviteDto,
  AcceptInviteResponse,
  RoleInfo,
  AdminUserListResponse,
  AdminUserListParams,
  AdminUserDetail,
  CreateUserAdminDto,
} from '../types/users';

// ============================================================================
// Tenant-Scoped User Management (Owner/Admin)
// ============================================================================

/** List all memberships in tenant (paginated) */
export async function listUsers(params?: ListUsersParams): Promise<PaginatedMemberships> {
  // Build query params — only include defined values
  const response = await apiClient.get('/users', { params });
  return response.data;
}

/** Get single membership by ID */
export async function getUserById(membershipId: string): Promise<MembershipItem> {
  const response = await apiClient.get(`/users/${membershipId}`);
  return response.data;
}

/** Invite a new user to the tenant */
export async function inviteUser(dto: InviteUserDto): Promise<InviteUserResponse> {
  const response = await apiClient.post('/users/invite', dto);
  return response.data;
}

/** Change a user's role */
export async function changeUserRole(membershipId: string, dto: UpdateUserRoleDto): Promise<MembershipItem> {
  const response = await apiClient.patch(`/users/${membershipId}/role`, dto);
  return response.data;
}

/** Deactivate a user (immediate JWT revocation) */
export async function deactivateUser(membershipId: string, dto?: DeactivateUserDto): Promise<DeactivateResponse> {
  const response = await apiClient.patch(`/users/${membershipId}/deactivate`, dto || {});
  return response.data;
}

/** Reactivate an inactive user */
export async function reactivateUser(membershipId: string): Promise<ReactivateResponse> {
  const response = await apiClient.patch(`/users/${membershipId}/reactivate`);
  return response.data;
}

/** Delete a user (soft or hard based on history) — Owner only */
export async function deleteUser(membershipId: string): Promise<void> {
  await apiClient.delete(`/users/${membershipId}`);
}

// ============================================================================
// Self-Service (Any Authenticated User)
// ============================================================================

/** Get own profile + active membership */
export async function getMe(): Promise<UserMeResponse> {
  const response = await apiClient.get('/users/me');
  return response.data;
}

/** Update own profile */
export async function updateMe(dto: UpdateMeDto): Promise<{ message: string }> {
  const response = await apiClient.patch('/users/me', dto);
  return response.data;
}

/** Change own password */
export async function changeMyPassword(dto: ChangePasswordDto): Promise<{ message: string }> {
  const response = await apiClient.patch('/users/me/password', dto);
  return response.data;
}

// ============================================================================
// Invite Flow (Public — No Auth Required)
// ============================================================================

/** Validate invite token (public) */
export async function validateInviteToken(token: string): Promise<InviteTokenInfo> {
  const response = await apiClient.get(`/users/invite/${token}`);
  return response.data;
}

/** Accept invite and set password (public) */
export async function acceptInvite(token: string, dto: AcceptInviteDto): Promise<AcceptInviteResponse> {
  const response = await apiClient.post(`/users/invite/${token}/accept`, dto);
  return response.data;
}

// ============================================================================
// Role Listing (for dropdowns)
// ============================================================================

/** List active roles (Owner/Admin only — used in invite and role-change dropdowns) */
export async function listRoles(): Promise<RoleInfo[]> {
  const response = await apiClient.get('/rbac/roles');
  return response.data;
}

// ============================================================================
// Platform Admin User Management
// ============================================================================

/** List all users cross-tenant (Platform Admin only) */
export async function adminListUsers(params?: AdminUserListParams): Promise<AdminUserListResponse> {
  const response = await apiClient.get('/admin/users', { params });
  return response.data;
}

/** Get user details (Platform Admin only) */
export async function adminGetUser(userId: string): Promise<AdminUserDetail> {
  const response = await apiClient.get(`/admin/users/${userId}`);
  return response.data;
}

/** Force password reset (Platform Admin only) */
export async function adminResetPassword(userId: string): Promise<{ message: string; email: string }> {
  const response = await apiClient.post(`/admin/users/${userId}/reset-password`);
  return response.data;
}

/** Deactivate user — Platform Admin */
export async function adminDeactivateUser(userId: string): Promise<{ message: string; user: { id: string; email: string; is_active: boolean } }> {
  const response = await apiClient.patch(`/admin/users/${userId}/deactivate`);
  return response.data;
}

/** Activate user — Platform Admin */
export async function adminActivateUser(userId: string): Promise<{ message: string; user: { id: string; email: string; is_active: boolean } }> {
  const response = await apiClient.post(`/admin/users/${userId}/activate`);
  return response.data;
}

/** Delete user (soft) — Platform Admin */
export async function adminDeleteUser(userId: string): Promise<{ message: string; user: { id: string; email: string; deleted_at: string } }> {
  const response = await apiClient.delete(`/admin/users/${userId}`);
  return response.data;
}

/** List users in a specific tenant — Platform Admin */
export async function adminListTenantUsers(tenantId: string, params?: ListUsersParams): Promise<PaginatedMemberships> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/users`, { params });
  return response.data;
}

/** Create user in a specific tenant (bypass invite) — Platform Admin */
export async function adminCreateUserInTenant(tenantId: string, dto: CreateUserAdminDto): Promise<InviteUserResponse> {
  const response = await apiClient.post(`/admin/tenants/${tenantId}/users`, dto);
  return response.data;
}

// ============================================================================
// Export as object (alternative import style)
// ============================================================================

export const usersApi = {
  listUsers,
  getUserById,
  inviteUser,
  changeUserRole,
  deactivateUser,
  reactivateUser,
  deleteUser,
  getMe,
  updateMe,
  changeMyPassword,
  validateInviteToken,
  acceptInvite,
  listRoles,
  adminListUsers,
  adminGetUser,
  adminResetPassword,
  adminDeactivateUser,
  adminActivateUser,
  adminDeleteUser,
  adminListTenantUsers,
  adminCreateUserInTenant,
};

export default usersApi;
```

**Acceptance:** File compiles. You can import and call `listUsers()` from a test page and see correct typed data.
**Do NOT:** Change the axios client or any other API client file.

---

## Task 4 — Update Sidebar Navigation

**What:** Add a "Users" link to the sidebar, visible only for Owner and Admin roles. It should appear near the other settings items.

**File to modify:** `/var/www/lead360.app/app/src/components/dashboard/DashboardSidebar.tsx`

**Where to add:** In the `navigation` array (the tenant navigation, NOT adminNavigationGroups), add the new item BEFORE `{ name: 'Profile Settings', ... }` (around line 147):

```typescript
{ name: 'Users', href: '/settings/users', icon: Users, permission: 'settings:edit' },
```

The `Users` icon is already imported at line 13. The `permission: 'settings:edit'` ensures it shows only for roles that can edit settings (Owner, Admin). The page itself will have its own RBAC guard.

**What NOT to change:** Do not modify the `adminNavigationGroups` array. Do not change any existing nav items. Do not add new icon imports (Users is already imported).

**Acceptance:** When logged in as `contact@honeydo4you.com` (Owner), the sidebar shows a "Users" link near other settings items. Clicking it navigates to `/settings/users`. The link does NOT appear for roles without `settings:edit` permission.

**Do NOT:** Restructure the sidebar. Do NOT create a new Settings group. Just add one nav item.

---

## Task 5 — Verify Everything Works

**What:** Run the frontend dev server and verify:

1. No TypeScript compilation errors
2. Login as tenant user → sidebar shows "Users" link
3. The API client can successfully call `listUsers()` (you can test this via browser console or a simple test component)

**Acceptance:**
- [ ] `app/src/lib/types/users.ts` exists and compiles
- [ ] `app/src/lib/api/users.ts` exists and compiles
- [ ] Sidebar shows "Users" link for Owner role
- [ ] Sidebar does NOT show "Users" link for non-Owner/Admin roles (if testable)
- [ ] No TypeScript errors in the terminal
- [ ] Frontend dev server is still running on port 7000

---

## Acceptance Criteria

- [ ] All TypeScript types match ACTUAL API responses (verified by hitting endpoints)
- [ ] API client covers ALL 21 Users endpoint functions listed above
- [ ] Sidebar navigation shows "Users" for Owner/Admin roles
- [ ] No modifications to any file under `/var/www/lead360.app/api/`
- [ ] No TypeScript compilation errors
- [ ] Code follows existing patterns from `auth.ts` and `admin.ts` API clients

---

## Gate Marker

**STOP** — The types file and API client file must exist and compile without errors before Sprint 2 can begin.

---

## Handoff Notes

**Files created:**
- `app/src/lib/types/users.ts` — All TypeScript interfaces
- `app/src/lib/api/users.ts` — All API client functions

**Files modified:**
- `app/src/components/dashboard/DashboardSidebar.tsx` — Added "Users" nav item

**Key decisions for downstream sprints:**
- `MembershipItem` is the shape returned in list/detail views (membership ID is the primary key, not user ID)
- `listRoles()` fetches roles for invite/role-change dropdowns
- Pagination uses `{ data: [], meta: { total, page, limit, total_pages } }` envelope for tenant endpoints
- Platform admin uses `{ data: [], pagination: { ... } }` envelope (different key name)
- The invite token endpoints are public (no auth header needed)
