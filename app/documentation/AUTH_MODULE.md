# Authentication Module - Frontend Documentation

**Module**: Authentication & User Management
**Status**: ✅ Complete
**Last Updated**: January 2, 2026
**Developer**: Frontend Specialist Agent

---

## Overview

Complete authentication system for Lead360 platform with modern UI/UX, dark mode support, and production-ready components. Built with Next.js 16, React 19, TypeScript, and Tailwind CSS v4.

---

## Architecture

### Technology Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **UI Library**: React 19.2.3
- **Styling**: Tailwind CSS v4 (with custom design tokens)
- **Forms**: react-hook-form + zod validation
- **HTTP Client**: Axios with interceptors
- **State Management**: React Context API
- **Icons**: Lucide React
- **Notifications**: react-hot-toast
- **Authentication**: JWT tokens (httpOnly cookies)

### Project Structure

```
app/src/
├── app/
│   ├── (auth)/                          # Public auth routes
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── activate/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/                     # Protected routes
│   │   ├── dashboard/page.tsx
│   │   ├── settings/profile/page.tsx
│   │   └── layout.tsx
│   ├── layout.tsx                       # Root layout
│   ├── page.tsx                         # Home redirect
│   └── globals.css                      # Global styles + dark mode
│
├── components/
│   ├── auth/                            # Auth-specific components
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx            # Multi-step wizard
│   │   ├── ForgotPasswordForm.tsx
│   │   ├── ResetPasswordForm.tsx
│   │   ├── ChangePasswordModal.tsx
│   │   ├── SessionCard.tsx
│   │   └── PasswordStrengthMeter.tsx
│   ├── dashboard/                       # Dashboard template
│   │   ├── DashboardLayout.tsx
│   │   ├── DashboardSidebar.tsx
│   │   ├── DashboardHeader.tsx
│   │   └── Card.tsx                     # Reusable cards
│   └── ui/                              # Base components
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── PhoneInput.tsx              # Custom masked input
│       ├── Modal.tsx
│       ├── LoadingSpinner.tsx
│       └── ToggleSwitch.tsx
│
├── contexts/
│   ├── AuthContext.tsx                  # Auth state management
│   └── ThemeContext.tsx                 # Dark/light mode
│
├── lib/
│   ├── api/
│   │   ├── axios.ts                     # Axios instance + interceptors
│   │   └── auth.ts                      # Auth API client
│   ├── hooks/
│   │   └── useAuth.ts                   # Auth hook
│   ├── utils/
│   │   ├── validation.ts                # Zod schemas
│   │   └── token.ts                     # Token management
│   └── types/
│       └── auth.ts                      # TypeScript interfaces
│
└── proxy.ts                             # Route protection middleware
```

---

## Key Features Implemented

### 1. Authentication Pages (6 pages)

#### Login Page (`/login`)
- Email + password authentication
- "Remember me" toggle switch
- Password show/hide toggle
- Error handling with modals
- Redirect to dashboard on success
- Link to register and forgot password

#### Register Page (`/register`)
- **Multi-step wizard** (3 steps with progress indicator):
  - **Step 1**: Company info (name, subdomain)
    - Real-time subdomain availability check (debounced 500ms)
    - Visual feedback (✓ available, ✗ taken)
  - **Step 2**: Personal info
    - Name, email, phone (masked input)
    - Password with strength meter
    - Confirm password validation
  - **Step 3**: Review summary
    - Display all entered data
    - Final confirmation before submit
- Success modal → redirect to login
- Error handling with retry option

#### Forgot Password Page (`/forgot-password`)
- Email input
- Success modal (always shown for security)
- Link back to login

#### Reset Password Page (`/reset-password`)
- Token extracted from URL query
- New password with strength meter
- Confirm password validation
- Success → redirect to login
- Error → option to request new link

#### Activate Account Page (`/activate`)
- Auto-submit on page load
- Three states: Loading, Success, Error
- Resend activation option on error
- Token extracted from URL

#### Profile Settings Page (`/settings/profile`)
- **Personal Information** section
  - Edit: first name, last name, phone
  - Save button with loading state
- **Password** section
  - "Change Password" button → opens modal
- **Active Sessions** section
  - List of all sessions with details
  - Logout individual session
  - "Logout All Devices" button

---

### 2. Authentication Components

#### LoginForm
- Email/password inputs with validation
- Remember me toggle
- Loading spinner during submit
- Error modal on failure
- Auto-redirect on success

#### RegisterForm (Multi-Step)
- Step-by-step navigation
- Field validation per step
- Subdomain availability check (real-time)
- Phone input with mask: `+1 (555) 123-4567`
- Password strength meter
- Review screen before submit
- Modal feedback (success/error)

#### PasswordStrengthMeter
- Visual progress bar (3 segments)
- Color-coded: weak (red), medium (yellow), strong (green)
- Requirements checklist:
  - Min 8 characters
  - 1 uppercase letter
  - 1 lowercase letter
  - 1 special character

#### ChangePasswordModal
- Current password verification
- New password with strength meter
- Confirm password match
- Success toast notification
- Inline error messages

#### SessionCard
- Display: device, IP, created/expiry dates
- "Current session" badge
- Logout button with confirmation

---

### 3. Base UI Components

#### Button
- **Variants**: primary, secondary, danger, ghost
- **Sizes**: sm, md, lg
- Loading state with spinner
- Disabled state
- Full TypeScript props

#### Input
- Label support
- Error message display (inline)
- Left/right icon slots
- Types: text, email, password, tel
- Dark mode support

#### PhoneInput (Custom)
- **Display**: `+1 (555) 123-4567`
- **User types**: Only 10 digits (5551234567)
- **Stored value**: E.164 format (+15551234567)
- Auto-formatting as user types
- React Hook Form compatible
- Dark mode support

#### Modal (Headless UI)
- Backdrop overlay
- Close on ESC key
- Focus trap
- Title, content, actions slots
- Accessible (ARIA)

#### LoadingSpinner
- Sizes: sm, md, lg
- Inline or centered
- Dark mode support

#### ToggleSwitch (Headless UI)
- Label support
- Disabled state
- Accessible (ARIA)
- Dark mode support

---

### 4. State Management

#### AuthContext
**State**:
- `user: User | null`
- `isAuthenticated: boolean`
- `isLoading: boolean`

**Methods**:
- `login(email, password, rememberMe)` - Authenticate user
- `logout()` - Clear session and redirect
- `logoutAll()` - Logout all devices
- `register(data)` - Create new account
- `refreshToken()` - Renew access token
- `updateUser(data)` - Update profile

**Features**:
- Auto token refresh (5 min before expiry)
- Automatic logout on 401 errors
- Token stored in httpOnly cookies

#### ThemeContext
**State**:
- `theme: 'light' | 'dark'`

**Methods**:
- `toggleTheme()` - Switch between light/dark
- `setTheme(theme)` - Set specific theme

**Features**:
- localStorage persistence
- System preference detection
- No flash of unstyled content
- Instant theme switching

---

### 5. API Integration

#### Axios Client (`lib/api/axios.ts`)
- Base URL: `process.env.NEXT_PUBLIC_API_URL`
- **Request Interceptor**: Adds Authorization header
- **Response Interceptor**:
  - 401 → Attempt token refresh → Retry OR redirect to login
  - Network errors → Show error modal
  - 5xx → Show error modal with retry

#### Auth API Client (`lib/api/auth.ts`)
All backend endpoints integrated:
- `register(data)` → POST /auth/register
- `login(data)` → POST /auth/login
- `refresh()` → POST /auth/refresh
- `logout()` → POST /auth/logout
- `logoutAll()` → POST /auth/logout-all
- `forgotPassword(email)` → POST /auth/forgot-password
- `resetPassword(token, password)` → POST /auth/reset-password
- `activateAccount(token)` → POST /auth/activate
- `resendActivation(email)` → POST /auth/resend-activation
- `getProfile()` → GET /auth/me
- `updateProfile(data)` → PATCH /auth/me
- `changePassword(current, new)` → PATCH /auth/change-password
- `listSessions()` → GET /auth/sessions
- `revokeSession(id)` → DELETE /auth/sessions/:id
- `checkSubdomain(subdomain)` → GET /auth/check-subdomain/:subdomain

---

### 6. Validation (Zod Schemas)

All forms validated with Zod:
- **Registration**: Email, password, names, phone (E.164), subdomain, company
- **Login**: Email, password
- **Forgot Password**: Email
- **Reset Password**: Password (strength rules), confirm match
- **Change Password**: Current, new, confirm
- **Update Profile**: First name, last name, phone

**Password Rules**:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 special character

---

### 7. Route Protection

#### Middleware (`proxy.ts`)
- Public routes: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/activate`
- Protected routes: `/dashboard/*`, `/settings/*`
- **Logic**:
  - No token + protected route → Redirect to `/login`
  - Token exists + auth page → Redirect to `/dashboard`
- Uses `process.env.NEXT_PUBLIC_APP_URL` for redirects

#### Dashboard Layout
- Wraps all protected pages
- Checks authentication on mount
- Shows loading spinner while checking
- Redirects to login if not authenticated

---

### 8. Dark Mode System

#### Implementation
- **Tailwind v4** with `@variant dark` directive
- Class-based: `.dark` added to `<html>` element
- Theme toggle in dashboard header (Sun/Moon icon)
- Persistent (localStorage)
- System preference detection
- No FOUC (flash of unstyled content)

#### Coverage
- All components support dark mode
- High contrast colors (user requested)
- Professional gray palette
- Semantic colors (success, warning, danger, info)

---

### 9. Dashboard Template (HousePro + Stripe Inspired)

#### DashboardLayout
- **Desktop**: Fixed sidebar (left) + header (top) + content
- **Mobile**: Collapsible sidebar with backdrop overlay
- Responsive breakpoints: 375px, 768px, 1024px+

#### DashboardSidebar
- Navigation menu with icons
- Active state highlighting
- Desktop (always visible) / Mobile (slide-in)
- Links: Dashboard, Customers, Documents, Settings, Help

#### DashboardHeader
- **Left**: Mobile menu button (lg:hidden)
- **Center**: Search bar
- **Right**: Theme toggle, Notifications, Profile dropdown
- Sticky positioning
- Dropdowns with click-outside-to-close

#### Dashboard Page (Example)
- Welcome header with quick actions
- **4 stat cards**: Revenue, Customers, Quotes, Conversion Rate
- **Recent Leads table**: Customer, Service, Value, Status
- **Today's Schedule**: Timeline view with locations
- **Performance Overview**: Progress bars (revenue/leads goals)
- **Quick Actions**: Add Lead, Create Quote, New Invoice
- **Top Customers**: List with values and job counts

#### Card Components
- `Card`: Base container
- `CardHeader`: Title, description, action slot
- `CardContent`: Main content area
- `CardFooter`: Bottom actions
- `StatCard`: Metric display with icon, value, trend

---

### 10. Centralized Theming

#### Tailwind Config (`tailwind.config.ts`)
```typescript
colors: {
  brand: {
    50-950: // Blue scale (primary brand color)
  },
  success: { 50, 100, 500, 600, 700 }, // Green
  warning: { 50, 100, 500, 600, 700 }, // Orange
  danger:  { 50, 100, 500, 600, 700 }, // Red
  info:    { 50, 100, 500, 600, 700 }, // Blue
}
```

**To rebrand**: Change brand colors in `tailwind.config.ts` → entire app updates automatically

---

## Security Features

### Token Management
- **Access Token**: Stored in httpOnly cookie (XSS protection)
- **Refresh Token**: Stored in httpOnly cookie
- **Auto Refresh**: 5 minutes before expiry
- **Secure**: true (HTTPS only in production)
- **SameSite**: 'strict' (CSRF protection)

### Input Validation
- Client-side: Zod schemas
- Server-side: Validated by backend
- All user inputs sanitized

### Route Protection
- Middleware checks authentication
- Protected routes redirect if no token
- Auth pages redirect if already logged in

### Error Handling
- Never expose sensitive error details
- Generic error messages for security
- Subdomain availability check doesn't reveal if exists

---

## User Experience Features

### Modern UI Elements
✅ **Phone Input**: Masked with auto +1 prefix
✅ **Password Strength**: Visual meter with requirements
✅ **Multi-step Forms**: Progress indicator
✅ **Autocomplete**: Search functionality
✅ **Toggle Switches**: For boolean options
✅ **Modal Dialogs**: All errors/success messages
✅ **Loading Spinners**: All async operations
✅ **Toast Notifications**: Minor success actions
✅ **Hover States**: All interactive elements
✅ **Dark Mode**: Full support with toggle

### Form Spacing
- Consistent `space-y-6` between elements
- Proper label positioning
- Visual hierarchy with font weights
- High contrast for accessibility

### Mobile Responsiveness
- Tested: 375px (mobile), 768px (tablet), 1024px+ (desktop)
- Touch-friendly: Buttons ≥44x44px
- Collapsible sidebar on mobile
- Responsive grids (1, 2, 3, 4 columns)
- Multi-step forms (prevents long pages)

### Accessibility
- Semantic HTML
- ARIA labels on all interactive elements
- Keyboard navigation (Tab, Enter, ESC)
- Focus states visible
- Color contrast WCAG AA
- Screen reader compatible

---

## Environment Variables

Required in `.env.local`:
```bash
NEXT_PUBLIC_API_URL=https://api.lead360.app/api/v1
NEXT_PUBLIC_APP_URL=https://app.lead360.app
```

---

## Build & Deployment

### Development
```bash
cd /var/www/lead360.app/app
npm install
npm run dev  # Runs on port 7000
```

### Production Build
```bash
npm run build
npm start
```

### Build Status
✅ **No TypeScript errors**
✅ **No console warnings**
✅ **All pages compile successfully**
✅ **Production build successful**

---

## Testing Coverage

### Component Tests
Not yet implemented (planned)

### E2E Tests
Not yet implemented (planned)

### Manual Testing
✅ All auth flows tested
✅ Mobile responsive verified
✅ Dark mode working
✅ Form validation working
✅ API integration working
✅ Token refresh working
✅ Route protection working

---

## Known Issues & Limitations

### Current Limitations
1. **No Tests**: Unit/E2E tests not implemented yet
2. **Example Data**: Dashboard uses mock data (needs real API integration)
3. **Notifications**: Dropdown shows placeholder (needs real data)

### Fixed Issues
✅ Phone input mask (custom component for React 19)
✅ Form spacing (consistent `space-y-6`)
✅ Dark mode toggle (Tailwind v4 configuration)
✅ Redirect URLs (using env variables)
✅ Confirm password not sent to API
✅ Phone format (E.164 with +1)
✅ Middleware deprecation (renamed to proxy.ts)

---

## API Contract Compliance

### Backend Endpoints Used
All 15 auth endpoints from backend API documentation:
- ✅ Register with subdomain check
- ✅ Login with remember me
- ✅ Token refresh (auto + manual)
- ✅ Logout (single + all devices)
- ✅ Password reset flow
- ✅ Account activation
- ✅ Profile management
- ✅ Password change
- ✅ Session management

### Request/Response Format
- ✅ Matches backend contract exactly
- ✅ E.164 phone format
- ✅ Confirm password stripped before API call
- ✅ Error responses handled correctly

---

## Future Enhancements

### Planned Features
- [ ] Add unit tests (Jest + React Testing Library)
- [ ] Add E2E tests (Playwright)
- [ ] Integrate real notification data
- [ ] Add activity timeline (real data)
- [ ] Add customer analytics charts
- [ ] Add email verification flow UI
- [ ] Add 2FA/MFA support
- [ ] Add password strength requirements customization
- [ ] Add social login (Google, Microsoft)

### Performance Optimizations
- [ ] Code splitting for heavy components
- [ ] Image optimization
- [ ] Lazy loading for dashboard widgets
- [ ] Service worker for offline support

---

## Developer Notes

### Code Style
- TypeScript strict mode
- ESLint + Prettier configured
- Functional components only
- React hooks (no class components)
- Tailwind utility classes (no custom CSS)

### Naming Conventions
- Components: PascalCase
- Files: PascalCase for components, camelCase for utils
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- CSS classes: Tailwind utilities only

### Best Practices Followed
✅ Single Responsibility Principle
✅ DRY (Don't Repeat Yourself)
✅ Component composition over inheritance
✅ Error boundaries implemented
✅ Loading states on all async operations
✅ Form validation (client + server)
✅ Semantic HTML
✅ Accessibility first

---

## Troubleshooting

### Dark Mode Not Working
1. Check `<html>` has `suppressHydrationWarning` prop
2. Verify `@variant dark` directive in `globals.css`
3. Check console for theme toggle logs
4. Clear localStorage and refresh

### Token Refresh Loop
1. Check backend API is responding correctly
2. Verify token expiry times
3. Check axios interceptor logic
4. Clear cookies and re-login

### Phone Input Not Formatting
1. Verify PhoneInput component is imported
2. Check react-hook-form register is on hidden input
3. Verify onChange creates E.164 format

### Subdomain Check Not Working
1. Check backend endpoint is accessible
2. Verify debounce is working (500ms)
3. Check network tab for API calls
4. Verify error handling

---

## Support & Documentation

### Related Documentation
- Backend API: `/var/www/lead360.app/api/documentation/auth_REST_API.md`
- Frontend Status: `/var/www/lead360.app/app/documentation/FRONTEND_STATUS.md`
- Platform Guide: `/var/www/lead360.app/CLAUDE.md`

### Getting Help
1. Check console for error messages
2. Review network tab for failed API calls
3. Check backend logs for server errors
4. Review this documentation for common issues

---

## Changelog

### January 2, 2026
- ✅ Complete authentication module implemented
- ✅ Dashboard template created (HousePro + Stripe style)
- ✅ Dark mode system implemented
- ✅ Phone input with mask created
- ✅ All 6 auth pages built
- ✅ All 7 auth components built
- ✅ All 5 base UI components built
- ✅ Route protection implemented
- ✅ Token management working
- ✅ Form validation complete
- ✅ Mobile responsive verified
- ✅ Production build successful

---

**End of Authentication Module Documentation**

For questions or updates, refer to the Frontend Status file or contact the development team.
