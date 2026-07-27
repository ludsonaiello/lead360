# Time Clock & Workforce Module — Frontend Implementation Guide

**Module**: time-clock
**Version**: 1.0
**Working Directory**: `/var/www/lead360.app/app/`
**Backend API**: `http://127.0.0.1:8000/api/v1` (dev) / `https://api.lead360.app/api/v1` (prod)
**API Documentation**: `api/documentation/time-clock_REST_API.md`

---

## 1. Mandatory Rules — Read Before Every Sprint

### RULE 1 — Test Live API First (NON-NEGOTIABLE)

Before implementing ANY page or component:

1. Read `api/documentation/time-clock_REST_API.md` for the endpoints you will consume.
2. Login to get a JWT token:
   ```bash
   curl -s -X POST http://localhost:8000/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq .access_token
   ```
3. Hit EVERY endpoint you will use. Verify response shapes match the REST_API doc.
4. **If the live API returns different field names or data shapes than the REST_API doc, USE THE LIVE API DATA. The live endpoint is always the source of truth.**
5. **If an endpoint is missing, returns errors, has wrong data, or is otherwise broken, STOP immediately. Tell the human: "Endpoint X is not working as expected. Issue: [describe]. Cannot proceed until backend is fixed."**
6. Never guess. Never hardcode. Never stub API calls. Always use real data.

### RULE 2 — Sidebar Navigation Links

Every page you build MUST have a corresponding sidebar navigation entry in `DashboardSidebar.tsx`. If the workforce section does not exist, create it. Users must be able to navigate to every page you build.

### RULE 3 — Mobile-First Design

- Design for 375px width FIRST, then enhance for tablet/desktop.
- All inputs MUST be 16px+ font size (prevents iOS auto-zoom).
- Touch targets: 48px minimum height, 64px for primary action buttons.
- No horizontal scrolling at any viewport.
- Use `flex-col` by default, `md:flex-row` for desktop enhancements.

### RULE 4 — Production-Quality UI

- Use existing Lead360 components (Button, Input, Select, Modal, Badge, etc.) from `/app/src/components/ui/`.
- Masked inputs for money (CurrencyInput), phone (PhoneInput), hours (HoursInput).
- Icons from lucide-react for every action and status.
- Loading spinners for all async operations.
- Error handling with toast notifications for user actions, ErrorModal for critical failures.
- Empty states with centered icon + helpful message.
- Proper form validation with inline error messages.

### RULE 5 — Full CRUD Implementation

Never implement endpoints halfway. If a resource has list/create/read/update/delete endpoints, implement ALL of them with full UI (list page, create modal/form, detail view, edit form, delete confirmation). 100% endpoint coverage required.

### RULE 6 — Respect Existing Patterns

- Forms: React Hook Form + Zod resolver.
- HTTP: Axios client from `/app/src/lib/api/axios.ts`.
- Toasts: react-hot-toast.
- Icons: lucide-react.
- Date formatting: date-fns.
- State: React hooks + context where needed.
- DO NOT install new libraries without explicit human approval.

### RULE 7 — Stop on Problems

If you encounter:
- A missing API endpoint
- An endpoint returning unexpected data
- A missing frontend component you expected to exist
- A conflicting pattern in the codebase
- Any ambiguity in requirements

**STOP and tell the human.** Do not guess or improvise.

---

## 2. Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin (full access) | `ludsonaiello@gmail.com` | `978@F32c` |
| Tenant User (employee) | `contact@honeydo4you.com` | `978@F32c` |

---

## 3. Server Rules

| Rule | Value |
|------|-------|
| Frontend port | 7000 |
| Frontend dev server | `cd /var/www/lead360.app/app && npm run dev` |
| Backend API base | `http://127.0.0.1:8000/api/v1` |
| Swagger docs | `http://127.0.0.1:8000/api/docs` |
| **This project does NOT use PM2** | Never reference or run PM2 commands |
| Database credentials | From `.env` file — never hardcode |
| API base URL | From environment variable — never hardcode |

---

## 4. UI Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React Hook Form | 7.69.0 | Form state management |
| Zod | 4.3.4 | Schema validation |
| Axios | 1.13.2 | HTTP client (configured in `/app/src/lib/api/axios.ts`) |
| react-hot-toast | 2.6.0 | Toast notifications |
| lucide-react | 0.562.0 | Icons |
| date-fns | 4.1.0 | Date formatting/manipulation |
| Tailwind CSS | 4 | Styling |

---

## 5. Reusable Components (MUST use — do NOT recreate)

Location: `/app/src/components/ui/`

| Component | File | Purpose |
|-----------|------|---------|
| Button | Button.tsx | Primary action button with loading state |
| Input | Input.tsx | Text input with label, error, required indicator |
| Select | Select.tsx | Dropdown select |
| Textarea | Textarea.tsx | Multi-line text input |
| Modal | Modal.tsx | Dialog wrapper |
| ConfirmModal | ConfirmModal.tsx | Yes/No confirmation dialog |
| DeleteConfirmationModal | DeleteConfirmationModal.tsx | Danger-styled delete confirm |
| ErrorModal | ErrorModal.tsx | Error display dialog |
| SuccessModal | SuccessModal.tsx | Success display dialog |
| Badge | Badge.tsx | Status badge (success/warning/error/info/neutral) |
| Tabs | Tabs.tsx | Tab navigation |
| Card | Card.tsx | Content card wrapper |
| DatePicker | DatePicker.tsx | Date selection |
| TimePicker | TimePicker.tsx | Time selection |
| CurrencyInput | CurrencyInput.tsx | Money masked input |
| MoneyInput | MoneyInput.tsx | Alternative money input |
| PhoneInput | PhoneInput.tsx | Phone masked input |
| HoursInput | HoursInput.tsx | Hours input |
| MaskedInput | MaskedInput.tsx | Generic masked input |
| MultiSelect | MultiSelect.tsx | Multi-option selector |
| LoadingSpinner | LoadingSpinner.tsx | Loading indicator |
| PaginationControls | PaginationControls.tsx | Page navigation |
| AddressAutocomplete | AddressAutocomplete.tsx | Google address autocomplete |
| DateRangePicker | DateRangePicker.tsx | Date range selection |
| ToggleSwitch | ToggleSwitch.tsx | Boolean toggle switch |
| Wizard | Wizard.tsx | Multi-step form wizard |
| Skeleton | Skeleton.tsx | Loading skeleton placeholder |
| Breadcrumb | Breadcrumb.tsx | Breadcrumb navigation |
| FileUpload | FileUpload.tsx | Single file upload |
| MultiFileUpload | MultiFileUpload.tsx | Multiple file upload |
| ColorPicker | ColorPicker.tsx | Color selection |
| SortableList | SortableList.tsx | Drag-and-drop sortable list |

---

## 6. Page Routes

| Route | Page | Roles | Description |
|-------|------|-------|-------------|
| `/workforce/clock` | Clock In/Out | Owner, Admin, PM, Employee | Mobile-first clock page |
| `/workforce/my-hours` | My Hours | Owner, Admin, PM, Employee | Employee's own session history |
| `/workforce/my-shifts` | My Shifts | Owner, Admin, PM, Employee | Employee's scheduled shifts |
| `/workforce/dashboard` | Who's In | Owner, Admin, PM | Live dashboard of clocked-in employees |
| `/workforce/timesheets` | Timesheets | Owner, Admin, PM, Bookkeeper | All sessions management |
| `/workforce/shifts` | Shift Scheduling | Owner, Admin, PM | Create/manage work shifts |
| `/workforce/disputes` | Disputes | Owner, Admin | Review dispute queue |
| `/workforce/reports` | Reports Hub | Owner, Admin, PM, Bookkeeper | All reports |
| `/settings/time-clock` | Settings | Owner, Admin | Module configuration |
| `/kiosk` | Kiosk Mode | Public (X-Kiosk-Token) | PIN-based clock in/out (no dashboard layout) |

### File Structure

All workforce pages live under the dashboard layout:

```
app/src/app/(dashboard)/workforce/
  clock/page.tsx
  my-hours/page.tsx
  my-shifts/page.tsx
  dashboard/page.tsx
  timesheets/page.tsx
  shifts/page.tsx
  disputes/page.tsx
  reports/page.tsx

app/src/app/(dashboard)/settings/time-clock/page.tsx

app/src/app/kiosk/
  layout.tsx       (minimal full-screen layout, no sidebar)
  page.tsx         (kiosk PIN entry and clock page)
```

---

## 7. Sidebar Navigation Structure

Add to `DashboardSidebar.tsx` under a new "Workforce" section:

```typescript
// Icon imports from lucide-react
import { Clock, Users, Calendar, LayoutDashboard, FileText, AlertCircle, BarChart, Settings } from 'lucide-react';

// Workforce navigation group
{
  name: 'Workforce',
  icon: Clock,
  children: [
    { name: 'Clock In/Out', href: '/workforce/clock', icon: Clock, permission: 'timeclock:clock_in' },
    { name: 'My Hours', href: '/workforce/my-hours', icon: FileText, permission: 'timeclock:view_own' },
    { name: 'My Shifts', href: '/workforce/my-shifts', icon: Calendar, permission: 'timeclock:view_own' },
    { name: 'Dashboard', href: '/workforce/dashboard', icon: LayoutDashboard, permission: 'timeclock:view_all' },
    { name: 'Timesheets', href: '/workforce/timesheets', icon: FileText, permission: 'timeclock:view_all' },
    { name: 'Shifts', href: '/workforce/shifts', icon: Calendar, permission: 'timeclock:manage_shifts' },
    { name: 'Disputes', href: '/workforce/disputes', icon: AlertCircle, permission: 'timeclock:review_disputes' },
    { name: 'Reports', href: '/workforce/reports', icon: BarChart, permission: 'timeclock:view_reports' },
  ],
}

// Settings section — add Time Clock entry:
{ name: 'Time Clock', href: '/settings/time-clock', icon: Clock, permission: 'timeclock:manage_settings' }
```

---

## 8. API Client Pattern

Create `/app/src/lib/api/time-clock.ts`:

```typescript
import api from './axios';

const BASE = '/time-clock';

// ─── Settings ───────────────────────────────────────────────
export const getSettings = () => api.get(`${BASE}/settings`);
export const updateSettings = (data: Partial<TimeClockSettingsPayload>) => api.patch(`${BASE}/settings`, data);

// ─── Employee Profiles ─────────────────────────────────────
export const listEmployeeProfiles = (params?: Record<string, any>) => api.get(`${BASE}/employees`, { params });
export const getEmployeeProfile = (id: string) => api.get(`${BASE}/employees/${id}`);
export const createEmployeeProfile = (data: CreateEmployeeProfilePayload) => api.post(`${BASE}/employees`, data);
export const updateEmployeeProfile = (id: string, data: Partial<UpdateEmployeeProfilePayload>) => api.patch(`${BASE}/employees/${id}`, data);
export const deleteEmployeeProfile = (id: string) => api.delete(`${BASE}/employees/${id}`);

// ─── Clock-in Addresses ────────────────────────────────────
export const listClockinAddresses = (params?: Record<string, any>) => api.get(`${BASE}/addresses`, { params });
export const getClockinAddress = (id: string) => api.get(`${BASE}/addresses/${id}`);
export const createClockinAddress = (data: CreateClockinAddressPayload) => api.post(`${BASE}/addresses`, data);
export const updateClockinAddress = (id: string, data: Partial<UpdateClockinAddressPayload>) => api.patch(`${BASE}/addresses/${id}`, data);
export const deleteClockinAddress = (id: string) => api.delete(`${BASE}/addresses/${id}`);

// ─── Project Assignments ───────────────────────────────────
export const listProjectAssignments = (params?: Record<string, any>) => api.get(`${BASE}/assignments`, { params });
export const createProjectAssignment = (data: CreateProjectAssignmentPayload) => api.post(`${BASE}/assignments`, data);
export const deleteProjectAssignment = (id: string) => api.delete(`${BASE}/assignments/${id}`);

// ─── Work Shifts ────────────────────────────────────────────
export const listWorkShifts = (params?: Record<string, any>) => api.get(`${BASE}/shifts`, { params });
export const getWorkShift = (id: string) => api.get(`${BASE}/shifts/${id}`);
export const createWorkShift = (data: CreateWorkShiftPayload) => api.post(`${BASE}/shifts`, data);
export const updateWorkShift = (id: string, data: Partial<UpdateWorkShiftPayload>) => api.patch(`${BASE}/shifts/${id}`, data);
export const deleteWorkShift = (id: string) => api.delete(`${BASE}/shifts/${id}`);

// ─── Clock Sessions ────────────────────────────────────────
export const listClockSessions = (params?: Record<string, any>) => api.get(`${BASE}/sessions`, { params });
export const getClockSession = (id: string) => api.get(`${BASE}/sessions/${id}`);
export const updateClockSession = (id: string, data: UpdateClockSessionPayload) => api.patch(`${BASE}/sessions/${id}`, data);
export const deleteClockSession = (id: string) => api.delete(`${BASE}/sessions/${id}`);

// ─── Clock Actions ──────────────────────────────────────────
export const clockIn = (data: ClockInPayload) => api.post(`${BASE}/clock/in`, data);
export const clockOut = (data: ClockOutPayload) => api.post(`${BASE}/clock/out`, data);
export const startBreak = (data: StartBreakPayload) => api.post(`${BASE}/clock/break/start`, data);
export const endBreak = (data: EndBreakPayload) => api.post(`${BASE}/clock/break/end`, data);
export const getMyStatus = () => api.get(`${BASE}/clock/status`);

// ─── Disputes ───────────────────────────────────────────────
export const listDisputes = (params?: Record<string, any>) => api.get(`${BASE}/disputes`, { params });
export const getDispute = (id: string) => api.get(`${BASE}/disputes/${id}`);
export const createDispute = (data: CreateDisputePayload) => api.post(`${BASE}/disputes`, data);
export const reviewDispute = (id: string, data: ReviewDisputePayload) => api.patch(`${BASE}/disputes/${id}/review`, data);

// ─── Reports ────────────────────────────────────────────────
export const getPayrollReport = (params: Record<string, any>) => api.get(`${BASE}/reports/payroll`, { params });
export const getOvertimeReport = (params: Record<string, any>) => api.get(`${BASE}/reports/overtime`, { params });
export const getAttendanceReport = (params: Record<string, any>) => api.get(`${BASE}/reports/attendance`, { params });
export const getProjectCostReport = (params: Record<string, any>) => api.get(`${BASE}/reports/project-cost`, { params });
export const exportPayrollCsv = (params: Record<string, any>) => api.get(`${BASE}/reports/payroll/export`, { params, responseType: 'blob' });

// ─── Dashboard ──────────────────────────────────────────────
export const getWhosIn = () => api.get(`${BASE}/dashboard/whos-in`);
export const getDashboardStats = () => api.get(`${BASE}/dashboard/stats`);

// ─── Kiosk ──────────────────────────────────────────────────
// NOTE: Kiosk endpoints use a SEPARATE axios instance with X-Kiosk-Token header (no JWT)
export const kioskListEmployees = (kioskApi: any) => kioskApi.get(`${BASE}/kiosk/employees`);
export const kioskClockIn = (kioskApi: any, data: KioskClockInPayload) => kioskApi.post(`${BASE}/kiosk/clock-in`, data);
export const kioskClockOut = (kioskApi: any, data: KioskClockOutPayload) => kioskApi.post(`${BASE}/kiosk/clock-out`, data);
export const kioskGetStatus = (kioskApi: any, employeeId: string) => kioskApi.get(`${BASE}/kiosk/status/${employeeId}`);
```

**IMPORTANT**: All functions use the configured axios instance which auto-injects the JWT Bearer token. Response shape for paginated lists is:

```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

All API functions must handle errors and let the calling component manage toast/error display.

---

## 9. TypeScript Types

Create `/app/src/lib/types/time-clock.ts` with all interfaces matching the API response shapes exactly. Use the live API response as the source of truth. Key types:

```typescript
// ─── Enums (as union types) ─────────────────────────────────
export type SessionStatus = 'active' | 'on_break' | 'completed';
export type BreakType = 'paid' | 'unpaid';
export type DisputeStatus = 'pending' | 'approved' | 'rejected';
export type DisputeType = 'missing_clockin' | 'wrong_hours' | 'missing_break' | 'wrong_project' | 'other';
export type ShiftStatus = 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'cancelled';
export type EditSource = 'admin' | 'dispute_resolution' | 'system';
export type OvertimeRule = 'none' | 'daily_8h' | 'weekly_40h' | 'both';
export type GpsEnforcement = 'none' | 'warn' | 'block';
export type ClockMethod = 'web' | 'kiosk' | 'mobile' | 'admin';

// ─── Pagination ─────────────────────────────────────────────
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── Settings ───────────────────────────────────────────────
export interface TimeClockSettings {
  id: string;
  tenant_id: string;
  require_gps: boolean;
  gps_enforcement: GpsEnforcement;
  geo_fence_radius_meters: number;
  allow_kiosk: boolean;
  kiosk_token: string | null;
  require_project_selection: boolean;
  allow_break_tracking: boolean;
  auto_break_after_minutes: number | null;
  default_break_duration_minutes: number;
  break_type_default: BreakType;
  overtime_rule: OvertimeRule;
  overtime_multiplier: number;
  double_time_after_hours: number | null;
  max_shift_hours: number;
  auto_clock_out_after_hours: number | null;
  rounding_increment_minutes: number;
  rounding_direction: 'nearest' | 'up' | 'down';
  allow_employee_disputes: boolean;
  dispute_window_days: number;
  require_notes_on_edit: boolean;
  pin_lockout_attempts: number;
  pin_lockout_duration_minutes: number;
  created_at: string;
  updated_at: string;
}

// ─── Employee Profile ───────────────────────────────────────
export interface EmployeeProfile {
  id: string;
  tenant_id: string;
  user_id: string;
  crew_member_id: string | null;
  employee_code: string;
  pin_hash: string | null;
  hourly_rate: number | null;
  overtime_eligible: boolean;
  max_hours_per_week: number | null;
  default_project_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Includes (when expanded)
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  crew_member?: {
    id: string;
    name: string;
  };
}

// ─── Clock-in Address ───────────────────────────────────────
export interface ClockinAddress {
  id: string;
  tenant_id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  radius_override_meters: number | null;
  project_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Includes
  project?: {
    id: string;
    name: string;
  };
}

// ─── Employee Project Assignment ────────────────────────────
export interface EmployeeProjectAssignment {
  id: string;
  tenant_id: string;
  employee_id: string;
  project_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  // Includes
  employee?: EmployeeProfile;
  project?: {
    id: string;
    name: string;
  };
}

// ─── Work Shift ─────────────────────────────────────────────
export interface WorkShift {
  id: string;
  tenant_id: string;
  employee_id: string;
  project_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Includes
  employee?: EmployeeProfile;
  project?: {
    id: string;
    name: string;
  };
}

// ─── Break Entry ────────────────────────────────────────────
export interface BreakEntry {
  id: string;
  session_id: string;
  break_type: BreakType;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
}

// ─── Clock Session Edit Log ─────────────────────────────────
export interface ClockSessionEditLog {
  id: string;
  session_id: string;
  edited_by_user_id: string;
  edit_source: EditSource;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  created_at: string;
  // Includes
  edited_by?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// ─── Clock Session ──────────────────────────────────────────
export interface ClockSession {
  id: string;
  tenant_id: string;
  employee_id: string;
  project_id: string | null;
  task_id: string | null;
  work_shift_id: string | null;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_method: ClockMethod;
  status: SessionStatus;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_address_id: string | null;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  break_minutes: number | null;
  is_flagged: boolean;
  flag_reason: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  // Includes (when expanded)
  employee?: EmployeeProfile;
  project?: {
    id: string;
    name: string;
  };
  task?: {
    id: string;
    name: string;
  };
  work_shift?: WorkShift;
  breaks?: BreakEntry[];
  edit_logs?: ClockSessionEditLog[];
  disputes?: TimeDispute[];
}

// ─── Time Dispute ───────────────────────────────────────────
export interface TimeDispute {
  id: string;
  tenant_id: string;
  session_id: string;
  employee_id: string;
  dispute_type: DisputeType;
  status: DisputeStatus;
  description: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  requested_break_minutes: number | null;
  resolution_notes: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Includes
  session?: ClockSession;
  employee?: EmployeeProfile;
  reviewed_by?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// ─── Dashboard Types ────────────────────────────────────────
export interface WhosInEntry {
  employee: EmployeeProfile;
  session: ClockSession;
  duration_so_far: string;
}

export interface DashboardStats {
  total_clocked_in: number;
  total_on_break: number;
  total_today_sessions: number;
  total_today_hours: number;
  pending_disputes: number;
}

// ─── Kiosk Types ────────────────────────────────────────────
export interface KioskEmployee {
  id: string;
  first_name: string;
  last_initial: string;
  employee_code: string;
  is_clocked_in: boolean;
}

// ─── Payload Types (for create/update requests) ─────────────
export interface ClockInPayload {
  project_id?: string;
  task_id?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface ClockOutPayload {
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface StartBreakPayload {
  break_type?: BreakType;
  notes?: string;
}

export interface EndBreakPayload {
  notes?: string;
}

export interface CreateDisputePayload {
  session_id: string;
  dispute_type: DisputeType;
  description: string;
  requested_clock_in?: string;
  requested_clock_out?: string;
  requested_break_minutes?: number;
}

export interface ReviewDisputePayload {
  status: 'approved' | 'rejected';
  resolution_notes: string;
}

export interface CreateEmployeeProfilePayload {
  user_id: string;
  crew_member_id?: string;
  pin?: string;
  hourly_rate?: number;
  overtime_eligible?: boolean;
  max_hours_per_week?: number;
  default_project_id?: string;
}

export interface UpdateEmployeeProfilePayload {
  crew_member_id?: string;
  pin?: string;
  hourly_rate?: number;
  overtime_eligible?: boolean;
  max_hours_per_week?: number;
  default_project_id?: string;
  is_active?: boolean;
}

export interface CreateClockinAddressPayload {
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  radius_override_meters?: number;
  project_id?: string;
}

export interface UpdateClockinAddressPayload {
  name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  radius_override_meters?: number;
  project_id?: string;
  is_active?: boolean;
}

export interface CreateProjectAssignmentPayload {
  employee_id: string;
  project_id: string;
  start_date: string;
  end_date?: string;
}

export interface CreateWorkShiftPayload {
  employee_id: string;
  project_id?: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface UpdateWorkShiftPayload {
  project_id?: string;
  shift_date?: string;
  start_time?: string;
  end_time?: string;
  status?: ShiftStatus;
  notes?: string;
}

export interface UpdateClockSessionPayload {
  clock_in_time?: string;
  clock_out_time?: string;
  project_id?: string;
  task_id?: string;
  notes?: string;
  admin_notes?: string;
  is_flagged?: boolean;
  flag_reason?: string;
  edit_reason: string; // Required — backend enforces this for audit trail
}

export interface TimeClockSettingsPayload {
  require_gps?: boolean;
  gps_enforcement?: GpsEnforcement;
  geo_fence_radius_meters?: number;
  allow_kiosk?: boolean;
  require_project_selection?: boolean;
  allow_break_tracking?: boolean;
  auto_break_after_minutes?: number | null;
  default_break_duration_minutes?: number;
  break_type_default?: BreakType;
  overtime_rule?: OvertimeRule;
  overtime_multiplier?: number;
  double_time_after_hours?: number | null;
  max_shift_hours?: number;
  auto_clock_out_after_hours?: number | null;
  rounding_increment_minutes?: number;
  rounding_direction?: 'nearest' | 'up' | 'down';
  allow_employee_disputes?: boolean;
  dispute_window_days?: number;
  require_notes_on_edit?: boolean;
  pin_lockout_attempts?: number;
  pin_lockout_duration_minutes?: number;
}

export interface KioskClockInPayload {
  employee_id: string;
  pin: string;
  project_id?: string;
}

export interface KioskClockOutPayload {
  employee_id: string;
  pin: string;
}
```

**CRITICAL**: These types are a starting reference. Before using them, verify each type against the LIVE API response. If the live API has different fields, update these types to match. The live API is the source of truth.

---

## 10. Authentication Pattern

- JWT stored in cookies via `js-cookie`.
- Axios interceptor auto-injects `Authorization: Bearer {token}` header.
- On 401: auto-refresh token, retry request.
- AuthContext provides: `user`, `isAuthenticated`, `login()`, `logout()`.
- RBAC: `useAuth()` hook provides user roles. Check permissions before rendering admin-only UI.

Example permission check:

```typescript
const { user } = useAuth();

// Check if user has a specific permission
const canManageSettings = user?.permissions?.includes('timeclock:manage_settings');
const canViewAll = user?.permissions?.includes('timeclock:view_all');

// Conditionally render UI
{canManageSettings && (
  <Button onClick={openSettings}>Settings</Button>
)}
```

---

## 11. Form Pattern

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  hourly_rate: z.number().min(0, 'Rate must be positive').optional(),
  // ... more fields
});

type FormData = z.infer<typeof schema>;

export function MyForm({ initialData, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ?? {},
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      await apiCall(data);
      toast.success('Saved successfully');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        label="Name"
        {...register('name')}
        error={errors.name?.message}
        required
      />
      {/* more fields */}
      <Button type="submit" loading={loading}>
        Save
      </Button>
    </form>
  );
}
```

---

## 12. GPS Handling (Clock Page)

```typescript
// Request GPS on component mount, NOT on button click.
// This ensures the permission prompt appears immediately, not when the user tries to clock in.

const [latitude, setLatitude] = useState<number | null>(null);
const [longitude, setLongitude] = useState<number | null>(null);
const [gpsStatus, setGpsStatus] = useState<'pending' | 'confirmed' | 'denied' | 'unavailable'>('pending');

useEffect(() => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setGpsStatus('confirmed');
      },
      (error) => {
        // error.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        setGpsStatus(error.code === 1 ? 'denied' : 'unavailable');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  } else {
    setGpsStatus('unavailable');
  }
}, []);
```

### GPS Status Display

```typescript
import { MapPin, MapPinOff } from 'lucide-react';

const gpsIndicator = {
  pending: { icon: <MapPin className="animate-pulse" />, text: 'Acquiring location...', color: 'text-amber-500' },
  confirmed: { icon: <MapPin />, text: 'Location confirmed', color: 'text-green-500' },
  denied: { icon: <MapPinOff />, text: 'Location denied — enable in browser settings', color: 'text-red-500' },
  unavailable: { icon: <MapPinOff />, text: 'Location unavailable', color: 'text-gray-400' },
};
```

### GPS Enforcement Logic

- If `settings.gps_enforcement === 'block'` and `gpsStatus !== 'confirmed'`, disable the Clock In button.
- If `settings.gps_enforcement === 'warn'` and `gpsStatus !== 'confirmed'`, show a warning but allow clock in.
- If `settings.gps_enforcement === 'none'`, do not require GPS at all.
- Always SEND GPS coordinates in the clock in/out payload if available, regardless of enforcement setting.

---

## 13. Status Badge Mapping

| Status | Badge Variant | Color |
|--------|--------------|-------|
| active | info | Blue |
| on_break | warning | Amber |
| completed | success | Green |
| is_flagged: true | error | Red |
| scheduled | neutral | Gray |
| in_progress | info | Blue |
| missed | error | Red |
| cancelled | neutral | Gray |
| pending (dispute) | warning | Amber |
| approved (dispute) | success | Green |
| rejected (dispute) | error | Red |

Usage:

```typescript
import Badge from '@/components/ui/Badge';

function SessionStatusBadge({ session }: { session: ClockSession }) {
  if (session.is_flagged) return <Badge variant="error">Flagged</Badge>;

  const variantMap: Record<SessionStatus, string> = {
    active: 'info',
    on_break: 'warning',
    completed: 'success',
  };

  return <Badge variant={variantMap[session.status]}>{session.status.replace('_', ' ')}</Badge>;
}

function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  const map: Record<ShiftStatus, { variant: string; label: string }> = {
    scheduled: { variant: 'neutral', label: 'Scheduled' },
    in_progress: { variant: 'info', label: 'In Progress' },
    completed: { variant: 'success', label: 'Completed' },
    missed: { variant: 'error', label: 'Missed' },
    cancelled: { variant: 'neutral', label: 'Cancelled' },
  };

  const { variant, label } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

function DisputeStatusBadge({ status }: { status: DisputeStatus }) {
  const map: Record<DisputeStatus, { variant: string; label: string }> = {
    pending: { variant: 'warning', label: 'Pending' },
    approved: { variant: 'success', label: 'Approved' },
    rejected: { variant: 'error', label: 'Rejected' },
  };

  const { variant, label } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
```

---

## 14. Kiosk Mode Architecture

### Overview

Kiosk mode provides a simplified, PIN-based clock in/out experience for shared devices (tablets, wall-mounted screens). It operates ENTIRELY outside the normal dashboard layout.

### Key Differences from Normal Mode

| Aspect | Normal Mode | Kiosk Mode |
|--------|-------------|------------|
| Layout | Dashboard with sidebar | Full-screen, no navigation |
| Auth | JWT from login | X-Kiosk-Token header |
| User identity | Logged-in user | Employee selected + PIN verified |
| Route | `/workforce/clock` | `/kiosk` |
| GPS | Optional (per settings) | Not used |

### Route and Layout

- Route: `/kiosk` — OUTSIDE the `(dashboard)` layout group.
- Layout file: `/app/src/app/kiosk/layout.tsx` — minimal full-screen layout:

```typescript
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-900 text-white">
        {children}
      </body>
    </html>
  );
}
```

### Authentication

- Token comes from URL query parameter: `/kiosk?token=xxx`.
- On load, store token in `sessionStorage.setItem('kiosk_token', token)`.
- Create a separate axios instance for kiosk requests:

```typescript
import axios from 'axios';

const kioskApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1',
});

kioskApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('kiosk_token');
  if (token) {
    config.headers['X-Kiosk-Token'] = token;
  }
  return config;
});

export default kioskApi;
```

### PIN Entry UI Requirements

- Large numpad grid: 3 columns x 4 rows (1-9, blank, 0, backspace).
- Button size: 72px minimum height and width.
- PIN display: 4-6 dots showing entered digits (masked).
- Clear button and backspace button.
- Auto-submit when PIN length reaches expected length (4-6 digits).
- Error shake animation on wrong PIN.

### Employee List

- Show first name + last initial only (privacy on shared devices).
- Show clock-in status indicator (green dot = clocked in, gray = not clocked in).
- Large touch-friendly list items (64px min height).
- Search/filter by name at the top.

### Error Handling

- HTTP 423 (Locked): "Account temporarily locked. Please contact your manager." Show lockout timer if available.
- HTTP 429 (Rate Limit): "Too many attempts. Please wait and try again."
- HTTP 401 (Unauthorized): "Invalid kiosk token. Please contact your administrator." Redirect to a kiosk error page.

### Kiosk Flow

1. Employee list loads on `/kiosk`.
2. Employee taps their name.
3. PIN entry numpad appears.
4. On correct PIN:
   - If not clocked in: show Clock In confirmation with optional project selection.
   - If clocked in: show status with Clock Out and Break buttons.
5. After action completes: show success message for 3 seconds, then return to employee list.
6. On wrong PIN: shake animation, show "Incorrect PIN" error, allow retry.

---

## 15. RBAC Permission Matrix

| Permission | Owner | Admin | PM | Bookkeeper | Employee |
|-----------|-------|-------|----|------------|----------|
| timeclock:manage_settings | Y | Y | | | |
| timeclock:manage_employees | Y | Y | | | |
| timeclock:manage_addresses | Y | Y | | | |
| timeclock:manage_shifts | Y | Y | Y | | |
| timeclock:clock_in | Y | Y | Y | | Y |
| timeclock:clock_out | Y | Y | Y | | Y |
| timeclock:view_own | Y | Y | Y | | Y |
| timeclock:view_all | Y | Y | Y | Y | |
| timeclock:edit_session | Y | Y | | | |
| timeclock:submit_dispute | Y | Y | Y | | Y |
| timeclock:review_disputes | Y | Y | | | |
| timeclock:view_reports | Y | Y | Y | Y | |
| timeclock:export_payroll | Y | Y | | Y | |
| timeclock:manage_kiosk | Y | Y | | | |

### Frontend RBAC Implementation

- Hide entire navigation items if user lacks the permission.
- On pages: show a "Not Authorized" message if user navigates directly to a URL they lack permission for.
- On actions: disable buttons/links for unauthorized actions (do not hide — disabled with tooltip is better UX).
- Never rely solely on frontend RBAC. The backend enforces permissions too. Frontend checks are for UX only.

---

## 16. Page-by-Page Implementation Guide

### 16.1 Clock In/Out Page (`/workforce/clock`)

**Purpose**: Mobile-first clock page for employees to clock in, clock out, and manage breaks.

**Key Features**:
- Large, prominent Clock In / Clock Out button (64px height, full-width on mobile).
- Real-time running clock showing duration since clock-in (update every second with `setInterval`).
- GPS status indicator.
- Project selection dropdown (if `require_project_selection` is enabled in settings).
- Break start/end buttons (if `allow_break_tracking` is enabled).
- Current status display: Not Clocked In / Clocked In / On Break.
- Today's total hours so far.

**API Calls on Mount**:
1. `GET /time-clock/clock/status` — get current session state.
2. `GET /time-clock/settings` — get module settings for conditional UI.

**State Machine**:
```
not_clocked_in → (Clock In) → active → (Start Break) → on_break → (End Break) → active → (Clock Out) → not_clocked_in
```

### 16.2 My Hours Page (`/workforce/my-hours`)

**Purpose**: Employee views their own session history with filtering and dispute submission.

**Key Features**:
- Date range filter (default: current pay period or last 7 days).
- Session list with: date, clock in/out times, total hours, project, status badge.
- Expandable row to see break details and edit history.
- "Dispute" button on each session (if `allow_employee_disputes` setting is enabled).
- Summary bar: total regular hours, overtime hours, total hours for filtered period.
- Pagination.

### 16.3 My Shifts Page (`/workforce/my-shifts`)

**Purpose**: Employee views their scheduled shifts.

**Key Features**:
- Calendar-style or list view of upcoming shifts.
- Shift details: date, start/end time, project, status.
- Color-coded by status.
- "Today" highlight.

### 16.4 Who's In Dashboard (`/workforce/dashboard`)

**Purpose**: Real-time view of currently clocked-in employees for managers.

**Key Features**:
- Stats cards at top: Total Clocked In, On Break, Today's Sessions, Pending Disputes.
- Employee list showing: name, status (active/on_break), clock-in time, duration so far, project.
- Auto-refresh every 30 seconds (use `setInterval` + API call).
- Quick actions: click employee to view their session.
- Sort by: name, clock-in time, duration.

### 16.5 Timesheets Page (`/workforce/timesheets`)

**Purpose**: Admin view of all clock sessions with editing capability.

**Key Features**:
- Full session list with filters: date range, employee, project, status, flagged only.
- Inline or modal editing of session times (with mandatory edit reason).
- Flag/unflag sessions.
- View break details and edit history.
- Bulk actions: export selected sessions.
- Pagination.

### 16.6 Shift Scheduling Page (`/workforce/shifts`)

**Purpose**: Create and manage work shifts for employees.

**Key Features**:
- Calendar view (week/month) or list view.
- Create shift: select employee, project (optional), date, start/end time.
- Edit/delete shifts.
- Bulk create: same shift for multiple employees or multiple days.
- Copy previous week.
- Filter by employee, project, status.

### 16.7 Disputes Page (`/workforce/disputes`)

**Purpose**: Admin queue for reviewing employee time disputes.

**Key Features**:
- Filter by status: all, pending, approved, rejected.
- Dispute card showing: employee name, session date, dispute type, description, requested changes.
- Review form: approve/reject with resolution notes (required).
- Side-by-side comparison: original session vs requested changes.
- Pending count badge in sidebar navigation.

### 16.8 Reports Hub (`/workforce/reports`)

**Purpose**: Comprehensive reporting with export capability.

**Key Features**:
- Tab navigation: Payroll, Overtime, Attendance, Project Cost.
- Date range picker for all reports.
- **Payroll Report**: Employee hours summary with regular/overtime/total, pay calculation.
- **Overtime Report**: Employees approaching or exceeding overtime thresholds.
- **Attendance Report**: Attendance patterns, missed shifts, late clock-ins.
- **Project Cost Report**: Hours per project with cost calculations.
- Export to CSV button on each report.
- Print-friendly layout.

### 16.9 Settings Page (`/settings/time-clock`)

**Purpose**: Module configuration for admins.

**Key Features**:
- Organized into sections with Card components:
  - **GPS & Geofencing**: require_gps, gps_enforcement, geo_fence_radius_meters.
  - **Kiosk**: allow_kiosk, kiosk_token (show/copy/regenerate).
  - **Projects**: require_project_selection.
  - **Breaks**: allow_break_tracking, auto_break_after_minutes, default_break_duration_minutes, break_type_default.
  - **Overtime**: overtime_rule, overtime_multiplier, double_time_after_hours.
  - **Shifts**: max_shift_hours, auto_clock_out_after_hours.
  - **Rounding**: rounding_increment_minutes, rounding_direction.
  - **Disputes**: allow_employee_disputes, dispute_window_days, require_notes_on_edit.
  - **Security**: pin_lockout_attempts, pin_lockout_duration_minutes.
- Save button per section or single save-all.
- ToggleSwitch for boolean settings.
- Input/Select for numeric/enum settings.
- Validation matching backend constraints.

### 16.10 Kiosk Page (`/kiosk`)

See Section 14 (Kiosk Mode Architecture) for full details.

---

## 17. Common Patterns and Utilities

### Time Formatting

```typescript
import { format, formatDistanceToNow, differenceInMinutes, differenceInHours } from 'date-fns';

// Format session time
const formatTime = (iso: string) => format(new Date(iso), 'h:mm a');
const formatDate = (iso: string) => format(new Date(iso), 'MMM d, yyyy');
const formatDateTime = (iso: string) => format(new Date(iso), 'MMM d, yyyy h:mm a');

// Running clock duration
const formatDuration = (startIso: string) => {
  const start = new Date(startIso);
  const now = new Date();
  const totalMinutes = differenceInMinutes(now, start);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

// Total hours display
const formatHours = (hours: number | null) => {
  if (hours === null || hours === undefined) return '—';
  return `${hours.toFixed(2)}h`;
};
```

### Empty State Component

```typescript
function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-12 h-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-sm">{description}</p>
      {action}
    </div>
  );
}

// Usage:
<EmptyState
  icon={Clock}
  title="No sessions found"
  description="No clock sessions match your current filters. Try adjusting the date range or clearing filters."
/>
```

### Auto-Refresh Hook

```typescript
function useAutoRefresh(fetchFn: () => Promise<void>, intervalMs: number = 30000) {
  useEffect(() => {
    const interval = setInterval(fetchFn, intervalMs);
    return () => clearInterval(interval);
  }, [fetchFn, intervalMs]);
}
```

### Running Clock Hook

```typescript
function useRunningClock(startTime: string | null) {
  const [elapsed, setElapsed] = useState('0h 00m');

  useEffect(() => {
    if (!startTime) return;

    const update = () => {
      const start = new Date(startTime);
      const now = new Date();
      const totalMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setElapsed(`${hours}h ${minutes.toString().padStart(2, '0')}m`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}
```

---

## 18. Error Handling Strategy

### API Error Response Format

The backend returns errors in this shape:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    { "field": "hourly_rate", "message": "Must be a positive number" }
  ]
}
```

### Handling Pattern

```typescript
try {
  const response = await apiCall(data);
  toast.success('Operation completed');
} catch (error: any) {
  const status = error.response?.status;
  const message = error.response?.data?.message || 'An unexpected error occurred';

  switch (status) {
    case 400:
      // Validation error — show field-specific errors if available
      const details = error.response?.data?.details;
      if (details?.length) {
        details.forEach((d: any) => toast.error(`${d.field}: ${d.message}`));
      } else {
        toast.error(message);
      }
      break;
    case 403:
      toast.error('You do not have permission to perform this action');
      break;
    case 404:
      toast.error('The requested resource was not found');
      break;
    case 409:
      // Conflict — e.g., already clocked in
      toast.error(message);
      break;
    case 423:
      // Locked — PIN lockout
      toast.error(message);
      break;
    case 429:
      toast.error('Too many attempts. Please wait and try again.');
      break;
    default:
      toast.error(message);
  }
}
```

---

## 19. Testing Checklist

Before marking any sprint as complete, verify:

- [ ] All pages render without errors at 375px, 768px, and 1280px widths.
- [ ] All API calls use real endpoints (no mocks, no stubs).
- [ ] All forms validate correctly (try submitting with empty required fields).
- [ ] All loading states display spinners/skeletons.
- [ ] All error states display meaningful messages.
- [ ] All empty states display helpful messages.
- [ ] Sidebar navigation has links to all new pages.
- [ ] RBAC: admin-only UI is hidden for non-admin users.
- [ ] GPS handling works (test with geolocation enabled and disabled).
- [ ] Clock in/out flow works end-to-end.
- [ ] Date/time formatting is consistent throughout.
- [ ] No console errors or warnings.
- [ ] No TypeScript errors (`npm run build` passes).
- [ ] Kiosk mode works independently of dashboard authentication.

---

## 20. Sprint File Reference

Sprint implementation files will be placed in:
`/var/www/lead360.app/documentation/sprints/clock/`

Each sprint file defines specific tasks, file outputs, and acceptance criteria. This guide provides the foundational knowledge that ALL sprint files assume you have read.

**Before starting any sprint, you MUST have read this entire document.**
