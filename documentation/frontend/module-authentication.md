# Frontend Module: Authentication System

**Module Name**: Authentication  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/authentication-contract.md`  
**Backend Module**: `/documentation/backend/module-authentication.md`  
**Agent**: Frontend Specialist  
**Status**: Ready for Development (AFTER backend complete)

---

## Overview

This module implements the user-facing authentication and account management interface. You will build:
- Login page
- Registration page (multi-step)
- Forgot/reset password pages
- Account activation page
- Profile settings page
- Session management UI

**CRITICAL**: Do NOT start until backend authentication module is 100% complete and API documentation is available.

**Read First**:
- `/documentation/contracts/authentication-contract.md` (UI requirements)
- `/documentation/backend/module-authentication.md` (API endpoints available)
- Backend API documentation (Swagger) at `https://api.lead360.com/docs`

---

## Technology Stack

### **Required Libraries**

Install these before starting:

```bash
cd /var/www/lead360.app/app
npm install react-hook-form zod @hookform/resolvers
npm install react-input-mask
npm install @headlessui/react
npm install lucide-react
npm install axios
npm install js-cookie @types/js-cookie
```

**Why Each Library**:
- `react-hook-form` + `zod`: Form handling and validation
- `react-input-mask`: Phone number masking
- `@headlessui/react`: Accessible UI components (modals, toggles)
- `lucide-react`: Modern icon set
- `axios`: HTTP client (with interceptors)
- `js-cookie`: Secure cookie handling

---

## Project Structure

Create the following structure in `/var/www/lead360.app/app/`:

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   ├── forgot-password/
│   │   └── page.tsx
│   ├── reset-password/
│   │   └── page.tsx
│   ├── activate/
│   │   └── page.tsx
│   └── layout.tsx (auth-specific layout)
├── (dashboard)/
│   ├── settings/
│   │   └── profile/
│   │       └── page.tsx
│   └── layout.tsx (requires auth)
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── ForgotPasswordForm.tsx
│   │   ├── ResetPasswordForm.tsx
│   │   ├── ChangePasswordModal.tsx
│   │   ├── SessionCard.tsx
│   │   └── PasswordStrengthMeter.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── ToggleSwitch.tsx
│   │   └── LoadingSpinner.tsx
│   └── layout/
│       └── ProtectedRoute.tsx
├── contexts/
│   └── AuthContext.tsx
├── lib/
│   ├── api/
│   │   ├── auth.ts (API client for auth endpoints)
│   │   └── axios.ts (configured axios instance)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useForm.ts
│   ├── utils/
│   │   ├── validation.ts (Zod schemas)
│   │   └── token.ts (token storage/retrieval)
│   └── types/
│       └── auth.ts (TypeScript interfaces)
└── middleware.ts (Next.js middleware for auth)
```

---

## Implementation Steps

### **Step 1: Setup API Client**

**Location**: `lib/api/axios.ts`

**Purpose**: Configured axios instance with interceptors

**Configuration**:
- Base URL: `https://api.lead360.com`
- Default headers: `Content-Type: application/json`
- Request interceptor: Add Authorization header from storage
- Response interceptor: Handle 401 (token refresh), 403, 500 errors

**Token Refresh Logic**:
1. On 401 response → attempt token refresh
2. If refresh succeeds → retry original request
3. If refresh fails → redirect to login

**Error Handling**:
- Network errors → Show "Check your connection" modal
- 5xx errors → Show "Server error" modal with retry
- 4xx errors → Show specific error message

---

### **Step 2: Token Storage**

**Location**: `lib/utils/token.ts`

**Purpose**: Securely store and retrieve tokens

**Storage Strategy** (use httpOnly cookies for production):

**Methods to Implement**:

1. **setTokens(accessToken, refreshToken)**
   - Store in httpOnly cookies (secure, sameSite: strict)
   - Set expiry based on token lifetime

2. **getAccessToken()**
   - Retrieve from cookie
   - Return null if expired/missing

3. **getRefreshToken()**
   - Retrieve from cookie
   - Return null if missing

4. **clearTokens()**
   - Remove all auth cookies
   - Clear any local storage

**Cookie Configuration**:
- `httpOnly: true` (prevent XSS)
- `secure: true` (HTTPS only in production)
- `sameSite: 'strict'` (CSRF protection)
- `path: '/'`

---

### **Step 3: TypeScript Interfaces**

**Location**: `lib/types/auth.ts`

**Define Interfaces**:

```typescript
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  tenant_id: string | null;
  roles: string[];
  is_platform_admin: boolean;
  email_verified: boolean;
  last_login_at?: string;
  created_at: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

interface Session {
  id: string;
  device_name: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  tenant_subdomain: string;
  company_name: string;
}

interface LoginData {
  email: string;
  password: string;
  remember_me?: boolean;
}
```

---

### **Step 4: Validation Schemas (Zod)**

**Location**: `lib/utils/validation.ts`

**Purpose**: Client-side validation schemas

**Schemas to Create**:

1. **registerSchema**
   - email: Valid email format
   - password: Min 8 chars, uppercase, lowercase, special char
   - first_name: 1-100 chars
   - last_name: 1-100 chars
   - phone: Optional, E.164 format
   - tenant_subdomain: 3-63 chars, alphanumeric + hyphens
   - company_name: 2-200 chars

2. **loginSchema**
   - email: Valid email
   - password: Required

3. **forgotPasswordSchema**
   - email: Valid email

4. **resetPasswordSchema**
   - password: Same as register
   - confirm_password: Must match password

5. **changePasswordSchema**
   - current_password: Required
   - new_password: Same as register
   - confirm_password: Must match new_password

6. **updateProfileSchema**
   - first_name: Optional, 1-100 chars
   - last_name: Optional, 1-100 chars
   - phone: Optional, E.164 format

---

### **Step 5: Auth Context**

**Location**: `contexts/AuthContext.tsx`

**Purpose**: Global auth state management

**State to Manage**:
- `user: User | null` (current user)
- `isAuthenticated: boolean`
- `isLoading: boolean` (initial auth check)

**Methods to Provide**:
- `login(email, password, rememberMe)` → AuthResponse
- `logout()` → void
- `logoutAll()` → void
- `register(data)` → void
- `refreshToken()` → void
- `updateUser(data)` → User

**Implementation**:
- Use React Context API
- Persist user state
- Auto-refresh token before expiry
- Auto-redirect to login on 401

**Auto Token Refresh**:
- Set interval to refresh 5 minutes before expiry
- On refresh failure → logout and redirect to login

---

### **Step 6: useAuth Hook**

**Location**: `lib/hooks/useAuth.ts`

**Purpose**: Easy access to auth context

**Usage**:
```typescript
const { user, isAuthenticated, login, logout } = useAuth();
```

**Should throw error if used outside AuthProvider**

---

### **Step 7: Auth API Client**

**Location**: `lib/api/auth.ts`

**Purpose**: Wrapper around auth endpoints

**Methods to Implement**:

1. **register(data: RegisterData)**
   - POST /auth/register
   - Return success message

2. **login(data: LoginData)**
   - POST /auth/login
   - Store tokens
   - Return AuthResponse

3. **refresh()**
   - POST /auth/refresh
   - Update access token
   - Return new access token

4. **logout()**
   - POST /auth/logout
   - Clear tokens
   - Return void

5. **logoutAll()**
   - POST /auth/logout-all
   - Clear tokens
   - Return void

6. **forgotPassword(email: string)**
   - POST /auth/forgot-password
   - Return success message

7. **resetPassword(token: string, password: string)**
   - POST /auth/reset-password
   - Return success message

8. **activateAccount(token: string)**
   - POST /auth/activate
   - Return success message

9. **resendActivation(email: string)**
   - POST /auth/resend-activation
   - Return success message

10. **getProfile()**
    - GET /auth/me
    - Return User

11. **updateProfile(data)**
    - PATCH /auth/me
    - Return User

12. **changePassword(currentPassword, newPassword)**
    - PATCH /auth/change-password
    - Return void

13. **listSessions()**
    - GET /auth/sessions
    - Return Session[]

14. **revokeSession(sessionId)**
    - DELETE /auth/sessions/:id
    - Return void

---

### **Step 8: Build UI Components**

#### **Base UI Components** (Create First)

**Location**: `components/ui/`

These are reusable across the entire app.

1. **Button.tsx**
   - Variants: primary, secondary, danger
   - Sizes: sm, md, lg
   - States: default, loading, disabled
   - Include loading spinner slot

2. **Input.tsx**
   - Props: label, error, type, placeholder
   - Show error message below input
   - Red border on error
   - Support icons (left/right)

3. **Modal.tsx**
   - Props: isOpen, onClose, title, children
   - Overlay with backdrop
   - Close on ESC key
   - Focus trap
   - Use @headlessui/react Dialog

4. **LoadingSpinner.tsx**
   - Centered spinner
   - Variants: sm, md, lg

5. **ToggleSwitch.tsx**
   - Accessible toggle (use @headlessui/react Switch)
   - Label support
   - Disabled state

---

#### **Auth-Specific Components**

**Location**: `components/auth/`

1. **PasswordStrengthMeter.tsx**

**Purpose**: Visual password strength indicator

**Implementation**:
- Props: password (string)
- Calculate strength: weak (red), medium (yellow), strong (green)
- Rules:
  - Weak: <8 chars or missing requirements
  - Medium: 8+ chars, 2/3 requirements
  - Strong: 8+ chars, all requirements met
- Display: Progress bar with color + text label
- Use visual indicator (3 segments: red → yellow → green)

2. **LoginForm.tsx**

**Purpose**: Login form component

**Fields**:
- Email (text input)
- Password (password input with show/hide toggle)
- Remember me (toggle switch)
- Submit button

**Behavior**:
- Use react-hook-form + zod validation
- Real-time validation errors
- Loading state on submit
- Success → store tokens, redirect to dashboard
- Error → show error modal

**Layout**:
```
[Logo]
[Title: "Welcome Back"]

[Email Input]
[Password Input (with show/hide icon)]
[Remember Me Toggle]

[Login Button (full width, loading spinner on submit)]

[Link: "Forgot Password?"]
[Link: "Don't have an account? Sign Up"]
```

3. **RegisterForm.tsx**

**Purpose**: Multi-step registration form

**Steps**:
- Step 1: Company Information
- Step 2: Your Information
- Step 3: Review & Submit

**Step 1 Fields**:
- Company name
- Subdomain (with real-time availability check)
  - Show ".lead360.com" suffix
  - Debounce check (500ms)
  - Show ✓ if available, ✗ if taken

**Step 2 Fields**:
- First name
- Last name
- Email
- Phone (masked input: (555) 123-4567)
- Password (with strength meter)
- Confirm password

**Step 3**:
- Review all entered data
- Terms of service checkbox
- Submit button

**Behavior**:
- Progress indicator (1/3, 2/3, 3/3)
- "Next" button advances step (after validation)
- "Back" button goes to previous step
- Final step submits to API
- Success → show modal, redirect to "Check your email" page
- Error → show error modal with retry

4. **ForgotPasswordForm.tsx**

**Purpose**: Request password reset

**Fields**:
- Email

**Behavior**:
- Submit → POST /auth/forgot-password
- Always show success (don't reveal if email exists)
- Success modal: "Check your email for reset link"

5. **ResetPasswordForm.tsx**

**Purpose**: Reset password with token

**Fields**:
- New password (with strength meter)
- Confirm password

**Behavior**:
- Extract token from URL query param
- Submit → POST /auth/reset-password
- Success → modal + redirect to login
- Error (invalid token) → show error with "Request new link" button

6. **ChangePasswordModal.tsx**

**Purpose**: Change password while logged in

**Fields**:
- Current password
- New password (with strength meter)
- Confirm password

**Behavior**:
- Modal component (use Modal.tsx)
- Submit → PATCH /auth/change-password
- Success → close modal, show success toast
- Error → show error inline

7. **SessionCard.tsx**

**Purpose**: Display active session

**Display**:
- Device name (e.g., "Chrome on MacOS")
- IP address
- Created date
- Expiry date
- "Current session" badge (if is_current)
- "Logout" button

**Behavior**:
- Props: session (Session), onRevoke (callback)
- "Logout" button → calls onRevoke(session.id)
- Confirmation modal before revoking

---

### **Step 9: Build Pages**

#### **1. Login Page**

**Route**: `app/(auth)/login/page.tsx`

**Layout**:
- Clean, centered card
- Logo at top
- LoginForm component
- Links to forgot password and register

**Behavior**:
- If already authenticated → redirect to /dashboard
- On successful login → redirect to /dashboard

**Mobile Responsive**:
- Full-width card on mobile
- Proper padding and spacing

---

#### **2. Register Page**

**Route**: `app/(auth)/register/page.tsx`

**Layout**:
- Clean, centered card
- Logo at top
- RegisterForm component (multi-step)

**Behavior**:
- If already authenticated → redirect to /dashboard
- On successful registration → show success modal, redirect to "check email" page

---

#### **3. Forgot Password Page**

**Route**: `app/(auth)/forgot-password/page.tsx`

**Layout**:
- Clean, centered card
- Logo at top
- ForgotPasswordForm component
- Link back to login

**Behavior**:
- Always show success after submit
- Success modal: "Check your email for reset instructions"

---

#### **4. Reset Password Page**

**Route**: `app/(auth)/reset-password/page.tsx`

**Layout**:
- Clean, centered card
- Logo at top
- ResetPasswordForm component

**Behavior**:
- Extract token from URL: `/reset-password?token=abc123`
- If no token → show error, redirect to forgot password
- On success → modal + redirect to login

---

#### **5. Activate Account Page**

**Route**: `app/(auth)/activate/page.tsx`

**Layout**:
- Clean, centered card
- Logo at top
- Loading spinner (while activating)
- Success/error state

**Behavior**:
- Extract token from URL: `/activate?token=xyz789`
- Auto-submit on page load (useEffect)
- Success state:
  - Show success icon + message
  - "Login" button → redirect to /login
- Error state:
  - Show error icon + message
  - "Resend activation email" button

**States**:
1. Loading: Show spinner + "Activating your account..."
2. Success: Show checkmark + "Account activated!" + Login button
3. Error: Show X + error message + Resend button

---

#### **6. Profile Settings Page**

**Route**: `app/(dashboard)/settings/profile/page.tsx`

**Layout**:
```
[Header: "Profile Settings"]

[Section: Personal Information]
[Form with fields: first_name, last_name, phone]
[Save Changes Button]

[Section: Password]
[Change Password Button] → Opens ChangePasswordModal

[Section: Active Sessions]
[List of SessionCard components]
[Logout All Devices Button]
```

**Behavior**:
- Load user profile on mount
- Profile form: Submit → PATCH /auth/me
- Change password: Opens modal
- Sessions: Load → GET /auth/sessions
- Logout session: Confirmation modal → DELETE /auth/sessions/:id
- Logout all: Confirmation modal → POST /auth/logout-all

---

### **Step 10: Protected Routes**

**Location**: `middleware.ts` (Next.js middleware)

**Purpose**: Redirect unauthenticated users to login

**Implementation**:
- Check for access token in cookies
- If no token and route requires auth → redirect to /login
- If token exists and route is /login → redirect to /dashboard

**Protected Routes**:
- `/dashboard/*`
- `/settings/*`
- All routes except: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/activate`

---

### **Step 11: Subdomain Availability Check**

**Location**: `components/auth/RegisterForm.tsx`

**Implementation**:
- Real-time check as user types subdomain
- Debounce input (500ms delay)
- API call: GET `/auth/check-subdomain?subdomain={value}`
- Show visual feedback:
  - Loading: spinner
  - Available: green checkmark + "Available"
  - Taken: red X + "Not available"

**Visual Indicator**:
- Input suffix: `.lead360.com`
- Icon to the right of input (spinner | checkmark | X)

---

### **Step 12: Error Handling**

**Global Error Modal**:

**Create**: `components/ui/ErrorModal.tsx`

**Props**:
- `isOpen: boolean`
- `onClose: () => void`
- `title: string`
- `message: string`
- `retry?: () => void` (optional retry callback)

**Usage**: Throughout the app for API errors

**Error Types**:
- Network error: "Unable to connect. Please check your internet."
- Server error (500): "Something went wrong. Please try again."
- Validation error (400): Show specific error message
- Unauthorized (401): Auto-redirect to login (handled by axios interceptor)

---

### **Step 13: Loading States**

**Requirements**:

1. **Page Loading**: Show skeleton or spinner while fetching data
2. **Button Loading**: Show spinner in button during submit
3. **Form Loading**: Disable all inputs during submit

**Implementation**:
- Use `isLoading` state
- Button: `disabled={isLoading}` + show spinner
- Form: `disabled={isLoading}` on all inputs

---

### **Step 14: Success Feedback**

**Requirements**:

1. **Success Modals**: For important actions (registration, password reset)
2. **Toast Notifications**: For minor actions (profile update, logout)

**Create**: `components/ui/SuccessModal.tsx` and `components/ui/Toast.tsx`

**Usage**:
- Registration success → Modal: "Check your email to activate"
- Password changed → Toast: "Password updated successfully"
- Profile updated → Toast: "Profile saved"

---

### **Step 15: Responsive Design**

**Requirements**:

1. **Mobile-first approach**
2. **Breakpoints**:
   - sm: 640px
   - md: 768px
   - lg: 1024px
   - xl: 1280px

3. **Mobile Adaptations**:
   - Full-width cards
   - Larger touch targets (buttons min 44x44px)
   - Proper spacing
   - Readable font sizes (min 16px to prevent zoom)

---

## Testing Requirements

### **Component Tests**

**Use React Testing Library**

**Test Coverage >70%**

1. **LoginForm**
   - ✅ Renders all fields
   - ✅ Validates email format
   - ✅ Shows error for invalid credentials
   - ✅ Calls onSubmit with correct data
   - ✅ Shows loading spinner during submit
   - ✅ Toggles password visibility

2. **RegisterForm**
   - ✅ Renders step 1 initially
   - ✅ Navigates to step 2 on "Next"
   - ✅ Validates all fields
   - ✅ Checks subdomain availability
   - ✅ Shows password strength meter
   - ✅ Confirms password match

3. **PasswordStrengthMeter**
   - ✅ Shows "weak" for short password
   - ✅ Shows "medium" for partial requirements
   - ✅ Shows "strong" for all requirements met

4. **SessionCard**
   - ✅ Renders session info
   - ✅ Shows "Current session" badge
   - ✅ Calls onRevoke when clicked

5. **Modal**
   - ✅ Opens when isOpen=true
   - ✅ Closes on ESC key
   - ✅ Closes on overlay click
   - ✅ Traps focus

---

### **Integration Tests (E2E)**

**Use Playwright or Cypress**

**Test Coverage >50%**

1. **Login Flow**
   - ✅ Navigate to /login
   - ✅ Enter credentials
   - ✅ Submit form
   - ✅ Redirect to /dashboard

2. **Registration Flow**
   - ✅ Navigate to /register
   - ✅ Complete all steps
   - ✅ Submit form
   - ✅ See success modal

3. **Forgot Password Flow**
   - ✅ Navigate to /forgot-password
   - ✅ Enter email
   - ✅ See success message

4. **Reset Password Flow**
   - ✅ Navigate to /reset-password?token=...
   - ✅ Enter new password
   - ✅ Submit
   - ✅ Redirect to /login

5. **Activate Account Flow**
   - ✅ Navigate to /activate?token=...
   - ✅ See loading → success
   - ✅ Click login button

6. **Profile Update Flow**
   - ✅ Navigate to /settings/profile
   - ✅ Update fields
   - ✅ Save changes
   - ✅ See success toast

7. **Change Password Flow**
   - ✅ Open change password modal
   - ✅ Enter passwords
   - ✅ Submit
   - ✅ See success

8. **Logout Flow**
   - ✅ Click logout
   - ✅ Redirect to /login
   - ✅ Cannot access /dashboard

---

## Completion Checklist

**Module is complete when**:

- [ ] All dependencies installed
- [ ] API client configured (axios + interceptors)
- [ ] Token storage implemented (httpOnly cookies)
- [ ] TypeScript interfaces defined
- [ ] Zod validation schemas created
- [ ] Auth context implemented
- [ ] useAuth hook created
- [ ] Auth API client created (all methods)
- [ ] Base UI components created (Button, Input, Modal, etc.)
- [ ] Auth components created (all 7 components)
- [ ] All pages created (login, register, forgot, reset, activate, profile)
- [ ] Protected routes middleware implemented
- [ ] Subdomain availability check working
- [ ] Error handling implemented (modals)
- [ ] Loading states implemented (all forms)
- [ ] Success feedback implemented (modals, toasts)
- [ ] Responsive design (mobile-first, all breakpoints)
- [ ] Component tests written (>70% coverage)
- [ ] E2E tests written (>50% coverage)
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Lighthouse score >90 (performance, accessibility)

---

## Modern UI/UX Checklist

Verify these requirements:

- [ ] Password strength meter on all password inputs
- [ ] Phone input masked: (555) 123-4567 format
- [ ] Subdomain availability check (real-time, debounced)
- [ ] Multi-step registration with progress indicator
- [ ] Toggle switches for boolean fields (Remember me)
- [ ] Modals for all success/error messages (NO alerts)
- [ ] Loading spinners on all async actions
- [ ] Disabled state on inputs during loading
- [ ] Error messages inline (below inputs)
- [ ] Success toasts for minor actions
- [ ] Responsive on mobile (tested on 375px width)
- [ ] Touch-friendly (buttons min 44x44px)
- [ ] Accessible (keyboard navigation, screen readers)
- [ ] Focus states visible on all inputs
- [ ] Auto-focus on first input (login, forms)

---

## Common Pitfalls to Avoid

1. **Don't use browser prompts**
   - ❌ alert(), confirm(), prompt()
   - ✅ Modal components

2. **Don't store tokens in localStorage**
   - ❌ localStorage.setItem('token', ...)
   - ✅ httpOnly cookies

3. **Don't forget loading states**
   - ❌ Button clickable during API call
   - ✅ Disable button, show spinner

4. **Don't skip mobile testing**
   - ❌ Desktop-only design
   - ✅ Test on 375px, 768px, 1024px

5. **Don't hard-code API URL**
   - ❌ fetch('https://api.lead360.com/...')
   - ✅ Use environment variable

6. **Don't ignore accessibility**
   - ❌ No labels on inputs
   - ✅ Proper labels, aria-labels, focus management

---

## Questions or Blockers?

If you encounter:
- **Unclear UI requirements**: Re-read feature contract UI section
- **API response different than expected**: Check Swagger docs
- **Design questions**: Follow modern UI standards (shadcn/ui, Tailwind UI)
- **Component library missing**: Install or build custom
- **Technical blockers**: Document and escalate to Architect agent

**Never make assumptions. Always ask.**

---

**End of Frontend Module Documentation**

This module must follow all specifications in the authentication contract and deliver production-quality UI.