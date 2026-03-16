# Admin Sprint 6 — Invite Accept Public Page
**Module:** Users (Frontend)
**File:** ./documentation/sprints/users/admin_sprint_6.md
**Type:** Frontend
**Depends On:** Admin Sprint 1 (Types + API Client)
**Gate:** STOP — Invite accept page must display invite metadata and accept flow must work before Sprint 7
**Estimated Complexity:** Medium

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`.
2. **Backend runs on `http://localhost:8000`**. Frontend runs on `http://localhost:7000`**.
3. **You MUST hit both invite endpoints** (`GET /users/invite/:token` and `POST /users/invite/:token/accept`) to verify actual responses.
4. **Use existing components** — Button, Input, LoadingSpinner. Follow the auth page styling from `app/src/app/(auth)/reset-password/page.tsx`.
5. **This is a PUBLIC page** — no auth token required. It lives in the `(auth)` route group.
6. **After successful invite accept, store tokens and redirect to `/dashboard`.**

---

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Tenant Owner | `contact@honeydo4you.com` | `978@F32c` | Owner — to create a test invite |

---

## Objective

Build the **Invite Accept** public page at `/invite/[token]`. This page:
1. Reads the token from the URL path
2. Calls `GET /api/v1/users/invite/:token` to validate the token and show invite metadata
3. Shows a password form for the invited user
4. Calls `POST /api/v1/users/invite/:token/accept` with the password
5. On success: stores JWT tokens (access + refresh), redirects to `/dashboard`
6. Handles error states: expired (410), already used (409), invalid (404)

---

## Pre-Sprint Checklist

- [ ] Confirm `app/src/lib/api/users.ts` has `validateInviteToken()` and `acceptInvite()` functions
- [ ] Confirm `app/src/lib/types/users.ts` has `InviteTokenInfo` and `AcceptInviteResponse` types
- [ ] Read `app/src/app/(auth)/reset-password/page.tsx` — EXACT styling pattern to follow
- [ ] Read `app/src/app/(auth)/layout.tsx` — auth layout redirects authenticated users to dashboard
- [ ] Read `app/src/lib/utils/token.ts` — `setTokens()` function for storing JWT
- [ ] Read `app/src/contexts/AuthContext.tsx` — understand `isPublicRoute` check (line 75-79)

---

## Task 1 — Create a Test Invite Token

To test this page, you need an actual invite token. Create one:

```bash
# Login as tenant owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Get a role ID
ROLES=$(curl -s http://localhost:8000/api/v1/rbac/roles -H "Authorization: Bearer $TOKEN")
echo "$ROLES"
# Pick a role_id from the response

# Create an invite
curl -s -X POST http://localhost:8000/api/v1/users/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"sprint6test@example.com","first_name":"Sprint6","last_name":"Test","role_id":"ROLE_ID_FROM_ABOVE"}'
```

**IMPORTANT:** The invite response does NOT return the raw token (it's sent via email). To test, you'll need to check the database or the email queue. If you cannot get the raw token, you can still:
1. Build the page with all states
2. Test the error states (invalid token = 404)
3. Test with a made-up 64-char hex token to see 404 response

To find the token in the database (READ ONLY — do not modify):
```bash
# Check the last invite in the DB — this is READ ONLY
mysql -u lead360_user -p'978@F32c' lead360 -e "SELECT invite_token_hash FROM user_tenant_membership WHERE status='INVITED' ORDER BY created_at DESC LIMIT 1;"
```
**NOTE:** The DB stores the HASH, not the raw token. The raw token is only in the invite email. If email isn't configured, build the page and test error states. The happy path can be verified once email delivery works.

**Alternatively:** Hit the validate endpoint with various tokens to test error states:
```bash
# 404 — Invalid token
curl -s http://localhost:8000/api/v1/users/invite/aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222

# Expected: {"statusCode":404,"message":"Invalid invite token.","error":"Not Found"}
```

---

## Task 2 — Update AuthContext Public Routes

**File to modify:** `/var/www/lead360.app/app/src/contexts/AuthContext.tsx`

**What:** Add `/invite` to the `isPublicRoute` check so the AuthContext doesn't attempt to fetch user profile on this page.

**Find this block (around line 75-79):**
```typescript
const isPublicRoute = pathname?.startsWith('/public') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password');
```

**Change to:**
```typescript
const isPublicRoute = pathname?.startsWith('/public') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/invite');
```

**Why:** Without this, the AuthContext will try to fetch the user profile on the invite page, which has no token and would cause unnecessary API calls and potential issues.

---

## Task 3 — Create the Invite Accept Page

**File to create:** `/var/www/lead360.app/app/src/app/(auth)/invite/[token]/page.tsx`

**IMPORTANT:** Create the directory `app/src/app/(auth)/invite/[token]/` first.

**Page structure (follows reset-password page pattern):**

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { validateInviteToken, acceptInvite } from '@/lib/api/users';
import { setTokens } from '@/lib/utils/token';
import type { InviteTokenInfo } from '@/lib/types/users';
```

**Page states:**

| State | When | What to Show |
|---|---|---|
| `loading` | Token being validated | Centered loading spinner with "Validating invite..." |
| `valid` | Token valid, showing form | Invite metadata + password form |
| `expired` | 410 response | "This invite link has expired" + Back to login |
| `used` | 409 response | "This invite link has already been used" + Back to login |
| `invalid` | 404 response | "Invalid invite link" + Back to login |
| `error` | Other error | Generic error message + Back to login |
| `accepting` | Form submitted, waiting | Password form with loading button |
| `success` | Accept succeeded | Brief success message, then redirect |

**On mount:**
1. Extract `token` from URL params: `const { token } = useParams<{ token: string }>();`
2. Call `validateInviteToken(token)` to validate
3. On 200: set state to `valid`, store `InviteTokenInfo` data
4. On 404: set state to `invalid`
5. On 409: set state to `used`
6. On 410: set state to `expired`

**Invite metadata display (when valid):**
```html
<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
  <p className="text-sm text-blue-800 dark:text-blue-300">
    <strong>{inviteInfo.invited_by_name}</strong> has invited you to join
    <strong> {inviteInfo.tenant_name}</strong> as <strong>{inviteInfo.role_name}</strong>.
  </p>
  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
    Invite expires {formatDate(inviteInfo.expires_at)}
  </p>
</div>
<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
  Set a password for <strong>{inviteInfo.email}</strong> to accept the invitation.
</p>
```

**Password form:**
- Password input (type="password", min 8 chars, required)
- Confirm Password input (type="password", must match)
- Password requirements text below:
  ```
  Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character
  ```
- Submit button: "Accept Invitation"

**Password validation (client-side, before submit):**
```typescript
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

// Validate:
// 1. Password matches regex
// 2. Password equals confirmPassword
```

**On submit:**
1. Validate password client-side
2. Call `acceptInvite(token, { password })`
3. On success:
   - Store tokens: `setTokens(response.access_token, response.refresh_token)`
   - Show brief success state (optional)
   - Redirect to `/dashboard`: `router.push('/dashboard')`
4. On 400: Show inline "Password does not meet complexity requirements"
5. On 409 "already used": Show "This invite has already been accepted"
6. On 409 "active in another org": Show "User is currently active in another organization"
7. On 410: Show "This invite has expired"

**Error state pages (expired, used, invalid) — follow reset-password pattern:**
```html
<div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
  <div className="w-full max-w-md">
    <div className="text-center mb-8">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Lead360</h1>
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">
        {errorTitle}
      </h2>
    </div>
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
      <div className="text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 font-medium mb-6">
          {errorMessage}
        </p>
      </div>
      <div className="text-center">
        <Link href="/login" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Go to Login
        </Link>
      </div>
    </div>
  </div>
</div>
```

**Valid state (form) — same layout:**
```html
<div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
  <div className="w-full max-w-md">
    <div className="text-center mb-8">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Lead360</h1>
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Accept Invitation</h2>
    </div>
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
      {inviteMetadataBanner}
      {form}
    </div>
    <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
      © {new Date().getFullYear()} Lead360. All rights reserved.
    </p>
  </div>
</div>
```

---

## Task 4 — Test All States

1. **Invalid token (404):** Navigate to `http://localhost:7000/invite/invalidtoken123456789012345678901234567890123456789012345678901234` — shows "Invalid invite link"
2. **Valid token:** If you have a real token, navigate to `http://localhost:7000/invite/{token}` — shows invite metadata + password form
3. **Password validation:** Try submitting with a weak password → shows client-side error
4. **Accept flow:** Fill valid password → submit → tokens stored → redirect to dashboard
5. **Already used (409):** Try accepting the same invite again → shows "already been used"
6. **Dark mode:** Toggle theme → verify all states render correctly
7. **Mobile:** Verify responsive on small screens

---

## Acceptance Criteria

- [ ] Page exists at `app/src/app/(auth)/invite/[token]/page.tsx`
- [ ] AuthContext updated to include `/invite` in `isPublicRoute`
- [ ] Loading state shows while validating token
- [ ] Valid token: shows tenant name, role, inviter name, email, expiry
- [ ] Password form with: password input, confirm password, complexity requirements text
- [ ] Client-side validation: password complexity regex + passwords match
- [ ] On accept success: tokens stored via `setTokens()`, redirect to `/dashboard`
- [ ] 404 error: "Invalid invite link" with link to login
- [ ] 409 error: "This invite link has already been used" with link to login
- [ ] 410 error: "This invite link has expired" with link to login
- [ ] Dark mode works for all states
- [ ] Responsive on mobile
- [ ] No modifications to any file under `/var/www/lead360.app/api/`

---

## Gate Marker

**STOP** — The invite accept page must handle all error states and display the form correctly before Sprint 7.

---

## Handoff Notes

**Files created:**
- `app/src/app/(auth)/invite/[token]/page.tsx` — Public invite accept page

**Files modified:**
- `app/src/contexts/AuthContext.tsx` — Added `/invite` to `isPublicRoute`

**The tenant-scoped Users frontend is now COMPLETE:**
- Settings > Users page (list, invite, role change, deactivate, reactivate, delete)
- Public invite accept page

**Sprints 7–9** build platform admin user management.
