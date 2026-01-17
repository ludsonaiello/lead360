# Frontend Module Instructions: Leads/Customer Management

**Module**: Leads/Customer  
**Sprint**: 1  
**Estimated Effort**: 2 weeks  
**Priority**: High  
**Version**: 1.0

---

## Module Overview

You are implementing the frontend for the Leads/Customer management module. This is the core CRM interface where tenant users will capture, track, and convert leads through their lifecycle.

**Key UI Principles:**
- **NO MODALS** (except alerts, confirms, or forms with 2-3 fields max)
- All major actions use full pages
- Use existing components and styles
- Masked inputs for phone numbers
- Google Maps autocomplete for addresses
- Fast action buttons prominent (Call, Email, SMS)
- Mobile-responsive design

---

## Prerequisites

Before starting, ensure you have read:

1. ✅ Feature Contract: `/documentation/contracts/leads-contract.md`
2. ✅ Backend API Docs: `/api/documentation/leads_REST_API.md`
3. ✅ Multi-Tenant Rules: `/documentation/shared/multi-tenant-rules.md`
4. ✅ Naming Conventions: `/documentation/shared/naming-conventions.md`
5. ✅ Frontend Agent Guide: `/documentation/FRONTEND_AGENT.md`

---

## Pages to Build

### 1. Lead List Page

**Route**: `/leads`  
**Permission**: `leads:view`  
**Layout**: Dashboard layout with sidebar

**Components:**
- Page header with title and "Create Lead" button
- Filter section (status, source, date range)
- Search bar (searches name, email, phone)
- Data table (desktop) / card list (mobile)
- Pagination controls
- Stats widgets (total leads, conversion rate)

**Features:**
- Click row to navigate to lead details
- Status badge with color coding
- Fast action buttons inline (Call, Email, SMS icons)
- Sort by created_at, updated_at, status
- Empty state when no leads

**API Integration:**
- `GET /api/v1/leads` with query params
- Real-time search (debounced 300ms)
- Remember filters in URL params

**Desktop Table Columns:**
1. Name (first + last)
2. Status (badge)
3. Primary Contact (email or phone)
4. Source (badge)
5. Service Requests (count)
6. Created Date
7. Actions (Call, Email, SMS icons)

**Mobile Card:**
- Name (bold)
- Status badge
- Primary contact
- Fast action buttons
- Tap card to view details

---

### 2. Lead Details Page

**Route**: `/leads/:id`  
**Permission**: `leads:view`  
**Layout**: Full page (NO modal)

**Sections:**

#### A. Header Section
- Lead name (large, bold)
- Status dropdown (change status inline)
- Fast action buttons (large, prominent):
  - 📞 Call (primary phone)
  - 📧 Email (primary email)  
  - 💬 SMS (primary phone)
- Edit button → navigates to edit page
- Back button

#### B. Contact Information Section
- **Emails** (list with primary indicator)
  - Display all emails
  - Primary marked with star icon
  - Add email button (opens small inline form)
  - Edit/Delete icons per email
- **Phones** (list with primary indicator)
  - Display with masked format: `(978) 896-8047`
  - Phone type badge (Mobile, Home, Work)
  - Add phone button
  - Edit/Delete icons per phone
- **Addresses** (list with primary indicator)
  - Full formatted address
  - Address type badge (Service, Billing, Mailing)
  - Google Maps link icon
  - Add address button
  - Edit/Delete icons per address

#### C. Service Requests Section
- List of service requests with status
- Service name, type, time demand
- Status badge
- Created date
- "View Details" link (future: opens service request page)
- Add service request button

#### D. Notes Section (Internal Comments)
- List of notes (reverse chronological)
- Pinned notes at top with pin icon
- Add note form (inline, always visible)
- Edit/Delete icons per note
- User attribution and timestamp

#### E. Activity Timeline Section
- Chronological activity log
- Activity type icons
- User attribution
- Timestamp
- Expandable metadata for some activities
- Load more button (pagination)

**NO MODALS** - All sections expand inline:
- Add email: Small inline form appears below list
- Add phone: Small inline form appears below list
- Add address: Inline form with Google Maps autocomplete
- Edit items: Inline edit mode (not modal)

---

### 3. Create Lead Page

**Route**: `/leads/new`  
**Permission**: `leads:create`  
**Layout**: Full page with sections

**Form Structure:**
Single page with sections (NOT multi-step wizard):

#### Section 1: Basic Information
- First Name (required)
- Last Name (required)
- Language Spoken (dropdown: EN, ES, PT, etc.)
- Accept SMS? (toggle switch)
- Preferred Communication (radio buttons: Email, Phone, SMS)

#### Section 2: Contact Information
- **Emails**
  - Add multiple emails
  - First email auto-set as primary
  - Email input with validation
  - "Add Another Email" button
  - Remove icon per email
- **Phones**
  - Add multiple phones
  - First phone auto-set as primary
  - Masked input: `(978) 896-8047`
  - Phone type dropdown (Mobile, Home, Work)
  - "Add Another Phone" button
  - Remove icon per phone

**Validation**: At least ONE email OR phone required (show error if neither provided)

#### Section 3: Addresses
- **Add multiple addresses**
- Google Maps autocomplete input
- Address fields:
  - Address Line 1 (required)
  - Address Line 2 (optional)
  - City (auto-filled from Google)
  - State (auto-filled from Google)
  - ZIP Code (auto-filled from Google)
- Address type dropdown (Service, Billing, Mailing)
- First address auto-set as primary
- "Add Another Address" button
- Remove icon per address

#### Section 4: Service Request (Optional)
- Service Name (text input)
- Service Type (text input or dropdown if predefined)
- Time Demand (radio buttons: Now, Week, Month, Flexible)
- Description (textarea)
- Extra Data (JSON editor or key-value pairs - simple version)

#### Section 5: Initial Note (Optional)
- Note text (textarea)
- Placeholder: "Add any initial notes about this lead..."

**Buttons:**
- Save Lead (primary, large)
- Cancel (secondary) → back to list

**Validation:**
- Client-side: Required fields, email format, phone format
- Server-side: Phone uniqueness per tenant
- Show validation errors inline near fields
- API error handling: If phone exists, show error message

**API Integration:**
- `POST /api/v1/leads`
- On 409 conflict (phone exists): Show error alert with existing lead link
- On success: Navigate to lead details page

---

### 4. Edit Lead Page

**Route**: `/leads/:id/edit`  
**Permission**: `leads:edit`  
**Layout**: Same as Create Lead page, pre-populated

**Behavior:**
- Load lead data on mount
- Pre-fill all fields
- Display existing emails/phones/addresses
- Allow adding/removing contact methods
- Cannot change status (use status dropdown on details page)
- Save button updates lead
- Cancel returns to details page

**API Integration:**
- `GET /api/v1/leads/:id` (load data)
- `PATCH /api/v1/leads/:id` (save changes)
- `POST /api/v1/leads/:id/emails` (add email)
- `DELETE /api/v1/leads/:lead_id/emails/:email_id` (remove email)
- Similar for phones and addresses

---

## Components to Build

### 1. LeadStatusBadge

**File**: `src/components/leads/LeadStatusBadge.tsx`

**Props:**
```typescript
interface LeadStatusBadgeProps {
  status: 'lead' | 'prospect' | 'customer' | 'lost';
  size?: 'sm' | 'md' | 'lg';
}
```

**Behavior:**
- Color-coded badges:
  - `lead`: blue
  - `prospect`: yellow
  - `customer`: green
  - `lost`: gray
- Icon per status
- Responsive to size prop

---

### 2. LeadSourceBadge

Similar to status badge, for source (manual, webhook, ai_phone, ai_sms)

---

### 3. FastActionButtons

**File**: `src/components/leads/FastActionButtons.tsx`

**Props:**
```typescript
interface FastActionButtonsProps {
  primaryPhone?: string;
  primaryEmail?: string;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'horizontal' | 'vertical';
}
```

**Buttons:**
1. **Call** (if phone exists)
   - Icon: Phone
   - Click: `tel:${phone}` link
   - Opens phone dialer on mobile
   
2. **Email** (if email exists)
   - Icon: Mail
   - Click: `mailto:${email}` link
   - Opens email client
   
3. **SMS** (if phone exists)
   - Icon: MessageSquare
   - Click: `sms:${phone}` link
   - Opens SMS app on mobile

**Disabled State**: Gray out if contact method not available

---

### 4. ContactMethodsList

**File**: `src/components/leads/ContactMethodsList.tsx`

**Props:**
```typescript
interface ContactMethodsListProps {
  emails: LeadEmail[];
  phones: LeadPhone[];
  addresses: LeadAddress[];
  onAddEmail: () => void;
  onEditEmail: (id: string) => void;
  onDeleteEmail: (id: string) => void;
  // Similar for phones and addresses
  editable?: boolean;
}
```

**Features:**
- Three sections: Emails, Phones, Addresses
- Primary indicator (star icon)
- Add buttons per section
- Edit/Delete icons per item
- Inline forms for add/edit (NO modals)

---

### 5. PhoneInput (Masked)

**File**: `src/components/ui/PhoneInput.tsx`

**Props:**
```typescript
interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}
```

**Behavior:**
- Mask format: `(XXX) XXX-XXXX`
- Stores digits only (no formatting characters)
- Real-time formatting as user types
- Use existing input component as base
- Red border if error

---

### 6. AddressAutocomplete

**File**: `src/components/leads/AddressAutocomplete.tsx`

**Props:**
```typescript
interface AddressAutocompleteProps {
  onSelectAddress: (address: GoogleAddress) => void;
  error?: string;
}
```

**Behavior:**
- Uses Google Maps Places Autocomplete
- Shows dropdown suggestions as user types
- On selection: Auto-fill all address fields
- Returns structured address object
- Restrict to US addresses

**Google Maps Integration:**
```typescript
import { LoadScript, Autocomplete } from '@react-google-maps/api';

// Load script with API key
<LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
  <Autocomplete onPlaceSelected={handleSelect}>
    <input type="text" placeholder="Start typing address..." />
  </Autocomplete>
</LoadScript>
```

---

### 7. ServiceRequestCard

**File**: `src/components/leads/ServiceRequestCard.tsx`

**Props:**
```typescript
interface ServiceRequestCardProps {
  serviceRequest: ServiceRequest;
  onClick?: () => void;
}
```

**Display:**
- Service name (bold)
- Service type (small text)
- Time demand badge (Now, Week, Month)
- Status badge
- Description (truncated)
- Created date

---

### 8. ActivityTimeline

**File**: `src/components/leads/ActivityTimeline.tsx`

**Props:**
```typescript
interface ActivityTimelineProps {
  activities: LeadActivity[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}
```

**Features:**
- Vertical timeline with icons
- Activity type icon (left side)
- Description and metadata
- User attribution
- Timestamp (relative: "2 hours ago")
- Load more button at bottom
- Empty state if no activities

---

### 9. NotesList

**File**: `src/components/leads/NotesList.tsx`

**Props:**
```typescript
interface NotesListProps {
  notes: LeadNote[];
  onAddNote: (text: string) => void;
  onEditNote: (id: string, text: string) => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
  currentUserId: string;
}
```

**Features:**
- Pinned notes at top with pin icon
- Add note form (always visible at top)
- List of notes (reverse chronological)
- Edit/Delete icons (only for note author)
- User avatar and name
- Timestamp
- Pin/Unpin button

---

### 10. LeadFilters

**File**: `src/components/leads/LeadFilters.tsx`

**Props:**
```typescript
interface LeadFiltersProps {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  onReset: () => void;
}
```

**Filters:**
- Status (multi-select checkboxes)
- Source (multi-select checkboxes)
- Date range picker (created_at)
- Active filter indicators
- Reset filters button

---

### 11. LeadStatsWidget

**File**: `src/components/leads/LeadStatsWidget.tsx`

**Props:**
```typescript
interface LeadStatsWidgetProps {
  stats: LeadStats;
}
```

**Display:**
- Total leads count
- Breakdown by status (pie chart or bars)
- Conversion rate percentage
- This month's new leads
- This month's conversions

**API Integration:**
- `GET /api/v1/leads/stats`

---

## API Integration

### API Client Setup

**File**: `src/lib/api/leads.ts`

```typescript
import { apiClient } from './client';
import type { Lead, CreateLeadDto, UpdateLeadDto, ListLeadsResponse } from '@/lib/types/leads';

// List leads
export const getLeads = async (params: {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
  search?: string;
  created_after?: string;
  created_before?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}): Promise<ListLeadsResponse> => {
  const { data } = await apiClient.get('/leads', { params });
  return data;
};

// Get single lead
export const getLeadById = async (leadId: string): Promise<Lead> => {
  const { data } = await apiClient.get(`/leads/${leadId}`);
  return data;
};

// Create lead
export const createLead = async (dto: CreateLeadDto): Promise<Lead> => {
  const { data } = await apiClient.post('/leads', dto);
  return data;
};

// Update lead
export const updateLead = async (leadId: string, dto: UpdateLeadDto): Promise<Lead> => {
  const { data } = await apiClient.patch(`/leads/${leadId}`, dto);
  return data;
};

// Update lead status
export const updateLeadStatus = async (
  leadId: string,
  status: string,
  reason?: string
): Promise<Lead> => {
  const { data } = await apiClient.patch(`/leads/${leadId}/status`, { status, reason });
  return data;
};

// Add email
export const addEmail = async (
  leadId: string,
  email: string,
  isPrimary: boolean
): Promise<LeadEmail> => {
  const { data } = await apiClient.post(`/leads/${leadId}/emails`, {
    email,
    is_primary: isPrimary,
  });
  return data;
};

// Delete email
export const deleteEmail = async (leadId: string, emailId: string): Promise<void> => {
  await apiClient.delete(`/leads/${leadId}/emails/${emailId}`);
};

// Similar methods for phones, addresses, notes, activities
```

---

### Type Definitions

**File**: `src/lib/types/leads.ts`

```typescript
export interface Lead {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  language_spoken: string;
  accept_sms: boolean;
  preferred_communication: 'email' | 'phone' | 'sms';
  status: 'lead' | 'prospect' | 'customer' | 'lost';
  source: 'manual' | 'webhook' | 'ai_phone' | 'ai_sms';
  external_source_id?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  lost_reason?: string;
  lost_at?: string;
  emails: LeadEmail[];
  phones: LeadPhone[];
  addresses: LeadAddress[];
  service_requests: ServiceRequest[];
  notes: LeadNote[];
  activities: LeadActivity[];
}

export interface LeadEmail {
  id: string;
  email: string;
  is_primary: boolean;
  created_at: string;
}

export interface LeadPhone {
  id: string;
  phone: string;
  phone_type: 'mobile' | 'home' | 'work';
  is_primary: boolean;
  created_at: string;
}

export interface LeadAddress {
  id: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  latitude?: number;
  longitude?: number;
  google_place_id?: string;
  is_primary: boolean;
  address_type: 'service' | 'billing' | 'mailing';
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  service_name: string;
  service_type?: string;
  time_demand: 'now' | 'week' | 'month' | 'flexible';
  description?: string;
  extra_data?: any;
  status: 'new' | 'quoted' | 'approved' | 'declined' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface LeadNote {
  id: string;
  user_id: string;
  user_name: string;
  note_text: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  activity_type: string;
  description: string;
  user_name: string;
  metadata?: any;
  created_at: string;
}

export interface CreateLeadDto {
  first_name: string;
  last_name: string;
  language_spoken?: string;
  accept_sms?: boolean;
  preferred_communication?: 'email' | 'phone' | 'sms';
  emails?: Array<{ email: string; is_primary?: boolean }>;
  phones?: Array<{ phone: string; phone_type?: string; is_primary?: boolean }>;
  addresses?: Array<{
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    zip_code: string;
    address_type?: string;
    is_primary?: boolean;
  }>;
  service_request?: {
    service_name: string;
    service_type?: string;
    time_demand?: string;
    description?: string;
    extra_data?: any;
  };
  initial_note?: string;
}

export interface ListLeadsResponse {
  data: Array<{
    id: string;
    first_name: string;
    last_name: string;
    status: string;
    source: string;
    primary_email: string | null;
    primary_phone: string | null;
    primary_address: string | null;
    service_requests_count: number;
    quotes_count: number;
    created_at: string;
    updated_at: string;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
```

---

## Styling and UI Guidelines

### Color Coding

**Status Colors:**
- Lead: Blue (`bg-blue-100 text-blue-800`)
- Prospect: Yellow (`bg-yellow-100 text-yellow-800`)
- Customer: Green (`bg-green-100 text-green-800`)
- Lost: Gray (`bg-gray-100 text-gray-800`)

**Source Colors:**
- Manual: Blue
- Webhook: Purple
- AI Phone: Teal
- AI SMS: Indigo

### Icons

Use Lucide React icons:
- Phone: `Phone`
- Email: `Mail`
- SMS: `MessageSquare`
- Address: `MapPin`
- Note: `StickyNote`
- Activity: `Activity`
- Edit: `Pencil`
- Delete: `Trash2`
- Add: `Plus`
- Primary: `Star`

### Responsive Design

**Breakpoints:**
- Mobile: < 768px (single column, cards)
- Tablet: 768px - 1024px (2 columns where applicable)
- Desktop: > 1024px (table view, multiple columns)

**Fast Action Buttons:**
- Desktop: Horizontal row, medium size
- Mobile: Large, easily tappable (44px min)

### Loading States

- Skeleton loaders for list view
- Spinner for page loads
- Inline spinner for save actions
- Disabled state for buttons during API calls

### Error Handling

- Toast notifications for success/error
- Inline validation errors near fields
- Phone duplicate error: Alert with link to existing lead
- Network errors: Retry button

---

## Testing Requirements

### Component Tests

Test files: `src/components/leads/__tests__/`

**Test Cases:**
- LeadStatusBadge renders correct colors
- FastActionButtons enable/disable correctly
- PhoneInput masks correctly
- ContactMethodsList displays all items
- AddressAutocomplete integrates with Google Maps
- NotesList allows add/edit/delete

### Integration Tests

**Test Cases:**
- Load leads list and display correctly
- Filter leads by status/source
- Search leads by name/email/phone
- Navigate to lead details
- Create new lead with validation
- Phone uniqueness error handling
- Update lead status
- Add/remove contact methods
- Add notes and activities

### E2E Tests

**User Flows:**
1. User creates new lead → Success toast → Redirects to details
2. User searches for lead → Results update → Clicks row → Details page
3. User changes lead status → Confirmation modal → Status updated → Activity logged
4. User adds email → Inline form → Email added → List updates

---

## Completion Checklist

Before marking frontend complete:

- [ ] All 4 pages implemented
- [ ] All 11 components implemented
- [ ] API integration complete (all endpoints)
- [ ] Google Maps autocomplete working
- [ ] Phone masking working
- [ ] Fast action buttons functional
- [ ] Status change with confirmation
- [ ] Add/edit/delete contact methods
- [ ] Notes section functional
- [ ] Activity timeline displays correctly
- [ ] Filters and search working
- [ ] Pagination working
- [ ] Mobile responsive
- [ ] Dark mode support (if applicable)
- [ ] Loading states everywhere
- [ ] Error handling comprehensive
- [ ] NO MODALS (except allowed cases)
- [ ] Type definitions complete
- [ ] Component tests passing
- [ ] Integration tests passing
- [ ] Production ready

---

## Success Criteria

**Frontend is complete when:**

✅ Users can create leads manually  
✅ Phone input masks correctly: `(978) 896-8047`  
✅ Google Maps autocomplete works for addresses  
✅ Lead list loads with filters and search  
✅ Lead details shows all information  
✅ Fast action buttons work (Call, Email, SMS)  
✅ Status can be changed with validation  
✅ Contact methods can be added/edited/deleted  
✅ Notes can be added and pinned  
✅ Activity timeline displays chronologically  
✅ No modals used (except alerts/confirms)  
✅ Mobile responsive on all pages  
✅ All API errors handled gracefully  
✅ Phone duplicate error shows link to existing lead  
✅ Loading states on all async operations  
✅ Forms validate client-side and server-side  

---

## Notes

- Read backend API documentation thoroughly before starting
- Use existing components from component library when possible
- Follow naming conventions for files and components
- Test on mobile devices (real or simulator)
- Ensure accessibility (keyboard navigation, ARIA labels)
- Dark mode support (if enabled for platform)

---

**Good luck! Follow the established patterns from other modules.**