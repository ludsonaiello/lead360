# Frontend Module: Tenant Management

**Module Name**: Tenant Management  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/tenant-contract.md`  
**Backend Module**: `/documentation/backend/module-tenant.md`  
**Agent**: Frontend Specialist  
**Status**: Ready for Development (AFTER backend complete)

---

## Overview

This module implements the complete business profile management interface for tenants. You will build comprehensive forms for legal, financial, operational, and branding setup.

**CRITICAL**: Do NOT start until backend tenant module is 100% complete and API documentation is available.

**Read First**:
- `/documentation/contracts/tenant-contract.md` (UI requirements)
- `/documentation/backend/module-tenant.md` (API endpoints)
- Backend API documentation (Swagger) `/api/documentation/tenant_REST_API.md`  

---

## Technology Stack

**Required Libraries**:
```bash
npm install react-hook-form zod @hookform/resolvers
npm install react-input-mask
npm install @headlessui/react
npm install lucide-react
npm install react-color (color picker)
npm install date-fns (date handling)
npm install react-datepicker
```

---

## Project Structure

```
app/
├── (dashboard)/
│   ├── settings/
│   │   ├── business/
│   │   │   └── page.tsx (main tenant profile page)
│   │   └── layout.tsx
│   └── layout.tsx
├── (admin)/
│   ├── tenants/
│   │   ├── page.tsx (list all tenants)
│   │   └── [id]/page.tsx (tenant detail)
│   ├── license-types/
│   │   └── page.tsx
│   ├── subscription-plans/
│   │   └── page.tsx
│   └── layout.tsx
├── components/
│   ├── tenant/
│   │   ├── BusinessInfoForm.tsx
│   │   ├── AddressForm.tsx
│   │   ├── AddressList.tsx
│   │   ├── LicenseForm.tsx
│   │   ├── LicenseList.tsx
│   │   ├── InsuranceForm.tsx
│   │   ├── PaymentTermsForm.tsx
│   │   ├── BrandingForm.tsx
│   │   ├── BusinessHoursForm.tsx
│   │   ├── CustomHoursForm.tsx
│   │   ├── ServiceAreaForm.tsx
│   │   ├── ServiceAreaList.tsx
│   │   └── FeatureAccessBadge.tsx
│   ├── admin/
│   │   ├── TenantCard.tsx
│   │   ├── SubscriptionPlanForm.tsx
│   │   └── LicenseTypeForm.tsx
│   └── ui/ (base components)
├── lib/
│   ├── api/
│   │   ├── tenant.ts
│   │   └── admin.ts
│   ├── utils/
│   │   ├── validation.ts (Zod schemas)
│   │   ├── formatters.ts (phone, EIN, etc.)
│   │   └── geocoding.ts (future - address to lat/lng)
│   └── types/
│       └── tenant.ts
└── hooks/
    ├── useTenant.ts
    └── useFeatureAccess.ts
```

---

## TypeScript Interfaces

**Location**: `lib/types/tenant.ts`

Define interfaces for:
- Tenant (complete profile)
- TenantAddress
- TenantLicense
- LicenseType
- TenantInsurance
- TenantPaymentTerms
- TenantBusinessHours
- TenantCustomHours
- TenantServiceArea
- SubscriptionPlan

(Developer will create these based on API documentation)

---

## Validation Schemas (Zod)

**Location**: `lib/utils/validation.ts`

**Schemas to Create**:

1. **businessInfoSchema**
   - legal_business_name: 2-200 chars, required
   - dba_name: optional
   - business_entity_type: enum, required
   - state_of_registration: 2-letter code, required
   - ein: 9 digits, format XX-XXXXXXX, required
   - state_tax_id: optional
   - sales_tax_permit: optional
   - primary_contact_phone: 10 digits, required
   - secondary_phone: 10 digits, optional
   - primary_contact_email: valid email, required
   - support_email: valid email, optional
   - billing_email: valid email, optional
   - website_url: valid URL, optional
   - social URLs: valid URLs, optional

2. **addressSchema**
   - address_type: enum (legal, billing, service, mailing, office)
   - line1: required
   - line2: optional
   - city: required
   - state: 2-letter code, required
   - zip_code: 5 or 9 digits, required
   - is_po_box: boolean

3. **licenseSchema**
   - license_type_id: optional (null if "Other")
   - custom_license_type: required if license_type_id is null
   - license_number: required
   - issuing_state: 2-letter code, required
   - issue_date: date
   - expiry_date: date, required, must be future

4. **insuranceSchema**
   - All fields optional
   - Expiry dates must be future (if provided)
   - Coverage amounts: positive numbers

5. **paymentTermsSchema**
   - Array validation
   - Each term: sequence, type (percentage/fixed), amount, description
   - Sequences must be unique

6. **businessHoursSchema**
   - For each day: closed (boolean), open1, close1, open2 (optional), close2 (optional)
   - Time validation: open < close

7. **customHoursSchema**
   - date: required, future dates allowed
   - reason: required
   - closed: boolean
   - open_time, close_time: required if not closed

8. **serviceAreaSchema**
   - type: enum (city, zipcode, radius)
   - value: required
   - latitude: required
   - longitude: required
   - radius_miles: required if type=radius

9. **brandingSchema**
   - primary_brand_color: hex format, required
   - secondary_brand_color: hex format, required
   - accent_color: hex format, required

---

## Formatters

**Location**: `lib/utils/formatters.ts`

**Functions to Create**:

1. **formatPhone(digits)** - (555) 123-4567
2. **formatEIN(digits)** - XX-XXXXXXX
3. **formatZIP(digits)** - XXXXX or XXXXX-XXXX
4. **parsePhone(formatted)** - Extract digits only
5. **parseEIN(formatted)** - Extract digits only
6. **parseZIP(formatted)** - Extract digits only

---

## API Client

**Location**: `lib/api/tenant.ts`

**Methods to Implement**:

1. **getTenant()** - GET /tenants/:id (current tenant from context)
2. **updateTenant(data)** - PATCH /tenants/:id
3. **checkSubdomainAvailability(subdomain)** - GET /tenants/check-subdomain
4. **getAddresses()** - GET /tenants/:id/addresses
5. **createAddress(data)** - POST /tenants/:id/addresses
6. **updateAddress(addressId, data)** - PATCH /tenants/:id/addresses/:addressId
7. **deleteAddress(addressId)** - DELETE /tenants/:id/addresses/:addressId
8. **getLicenses()** - GET /tenants/:id/licenses
9. **createLicense(data)** - POST /tenants/:id/licenses
10. **updateLicense(licenseId, data)** - PATCH /tenants/:id/licenses/:licenseId
11. **deleteLicense(licenseId)** - DELETE /tenants/:id/licenses/:licenseId
12. **getInsurance()** - GET /tenants/:id/insurance
13. **updateInsurance(data)** - PATCH /tenants/:id/insurance
14. **getPaymentTerms()** - GET /tenants/:id/payment-terms
15. **updatePaymentTerms(data)** - PATCH /tenants/:id/payment-terms
16. **getBusinessHours()** - GET /tenants/:id/business-hours
17. **updateBusinessHours(data)** - PATCH /tenants/:id/business-hours
18. **getCustomHours()** - GET /tenants/:id/custom-hours
19. **createCustomHours(data)** - POST /tenants/:id/custom-hours
20. **deleteCustomHours(id)** - DELETE /tenants/:id/custom-hours/:id
21. **getServiceAreas()** - GET /tenants/:id/service-areas
22. **createServiceArea(data)** - POST /tenants/:id/service-areas
23. **deleteServiceArea(id)** - DELETE /tenants/:id/service-areas/:id
24. **updateBranding(data)** - PATCH /tenants/:id/branding
25. **uploadLogo(file)** - POST /tenants/:id/logo

---

## Main Page: Business Settings

**Route**: `/settings/business`

**Layout**: Tabbed interface with 8 tabs

**Tabs**:
1. Business Info
2. Addresses
3. Licenses
4. Insurance
5. Financial
6. Branding
7. Hours
8. Service Areas

**Implementation**:
- Use @headlessui/react Tabs component
- Each tab loads its own data
- Auto-save on field blur or explicit "Save" button
- Loading states for each tab
- Success toasts on save
- Error modals on failure

---

## Tab 1: Business Info

**Component**: `BusinessInfoForm.tsx`

**Sections**:

### **Legal Information**
- Legal Business Name (text input, required)
- DBA Name (text input, optional)
- Business Entity Type (dropdown, required)
  - Options: Sole Proprietorship, LLC, Corporation, Partnership, DBA
- State of Registration (dropdown, 2-letter codes, required)
- Date of Incorporation (date picker, optional)

### **Tax Information**
- EIN (masked input: XX-XXXXXXX, required)
- State Tax ID (text input, optional)
- Sales Tax Permit (text input, optional)

### **Contact Information**
- Primary Contact Phone (masked input: (555) 123-4567, required)
- Secondary Phone (masked input, optional)
- Primary Contact Email (email input, required)
- Support Email (email input, optional)
- Billing Email (email input, optional)

### **Web & Social**
- Website URL (text input with "https://" prefix helper)
- Instagram URL (text input, optional)
- Facebook URL (text input, optional)
- TikTok URL (text input, optional)
- YouTube URL (text input, optional)

**Behavior**:
- EIN input: Auto-format as user types
- Phone inputs: Auto-format as user types
- URL inputs: Add "https://" prefix if missing
- Protected fields (legal_name, EIN) show warning: "Changing this requires admin approval"
- Auto-save on blur or "Save Changes" button
- Validation errors inline
- Success toast on save

---

## Tab 2: Addresses

**Component**: `AddressList.tsx` + `AddressForm.tsx`

**Layout**:
- List of existing addresses (cards)
- "Add Address" button
- Modal for add/edit address

**Address Card Display**:
- Address type badge (Legal, Billing, Service, etc.)
- Full address
- "Default" badge (if is_default)
- Edit button
- Delete button (with confirmation)

**Address Form (Modal)**:
- Address Type (dropdown: legal, billing, service, mailing, office)
- Address Line 1 (text input, required)
- Address Line 2 (text input, optional)
- City (text input, required)
- State (dropdown, 2-letter codes, required)
- ZIP Code (masked input: XXXXX or XXXXX-XXXX, required)
- Is PO Box (toggle switch)
- Set as Default (toggle switch)
- Autofill using google maps api, check .env.local for API KEYS. Manual override if user want to. 

**Business Rules to Enforce**:
- Legal address cannot be PO Box only (show error if is_po_box=true and type=legal)
- Cannot delete last legal address (disable delete button)
- Setting "Set as Default" unchecks other defaults of same type

**Behavior**:
- Click "Add Address" → Open modal
- Fill form → Click "Save"
- Validation → API call → Success toast → Close modal → Refresh list
- Edit: Click address card → Open modal pre-filled → Save → Refresh
- Delete: Click delete → Confirmation modal → API call → Success toast → Refresh

---

## Tab 3: Licenses

**Component**: `LicenseList.tsx` + `LicenseForm.tsx`

**Layout**:
- List of licenses (table or cards)
- "Add License" button
- Modal for add/edit license

**License Display** (Table Columns):
- License Type
- License Number
- Issuing State
- Expiry Date
- Status (Active / Expiring Soon / Expired)
- Actions (Edit, Delete)

**License Form (Modal)**:
- License Type (dropdown from admin-managed list + "Other" option)
- Custom License Type (text input, appears if "Other" selected)
- License Number (text input, required)
- Issuing State (dropdown, 2-letter codes)
- Issue Date (date picker)
- Expiry Date (date picker, required)
- Document Upload (file upload, optional)

**Status Indicators**:
- Active (expiry > 30 days): Green badge
- Expiring Soon (expiry < 30 days): Yellow badge
- Expired (expiry < today): Red badge

**Behavior**:
- Dropdown fetches license types from API
- If "Other" selected, show "Custom License Type" field
- Expiry date must be future (validation)
- Success toast on save
- Confirmation modal on delete

---

## Tab 4: Insurance

**Component**: `InsuranceForm.tsx`

**Layout**: Two sections (General Liability + Workers Comp)

### **General Liability Insurance**
- Insurance Provider (text input, optional)
- Policy Number (text input, optional)
- Coverage Amount (currency input: $X,XXX,XXX, optional)
- Effective Date (date picker, optional)
- Expiry Date (date picker, optional)
- Policy Document Upload (file upload, optional)

### **Workers' Compensation Insurance**
- Same fields as above

**Expiry Warning**:
- If expiry date < 30 days: Show yellow warning banner
- If expiry date < today: Show red warning banner
- Banner text: "Your insurance expires in X days. Please renew soon."

**Behavior**:
- All fields optional
- Coverage amount: Format as currency
- Save button updates both sections
- Success toast on save

---

## Tab 5: Financial

**Component**: `PaymentTermsForm.tsx`

**Layout**: 

### **Bank Account Information**
- Bank Name (text input, optional)
- Routing Number (text input, 9 digits, optional)
- Account Number (text input, optional)
- Account Type (dropdown: Checking, Savings, optional)

### **Venmo Account**
- Venmo Username (text input, optional)
- Venmo QR Code (image upload, optional)

### **Default Payment Terms**
- Dynamic list of payment milestones
- Each milestone has:
  - Sequence (auto-numbered)
  - Type (dropdown: Percentage, Fixed Amount)
  - Amount (number input)
  - Description (text input)
- "Add Term" button
- Remove button for each term (except first)

**Payment Terms Example Display**:
```
Term 1: 50% - Upfront deposit
Term 2: 25% - Upon permit approval
Term 3: 25% - Upon completion
```

**Behavior**:
- Click "Add Term" → Add new row
- Type = Percentage → Show "%" suffix
- Type = Fixed Amount → Show "$" prefix, format as currency
- Reorder terms (drag and drop or up/down buttons)
- Save all sections → API call → Success toast

**Validation**:
- If type=percentage, total should equal 100 (show warning, not error)
- Sequences must be unique

---

## Tab 6: Branding

**Component**: `BrandingForm.tsx`

**Layout**:

### **Logo**
- Current logo display (image preview)
- "Upload New Logo" button
- File upload: PNG, JPG, WEBP, max 5MB
- Recommended size: 500x200px

### **Brand Colors**
- Primary Brand Color (color picker)
- Secondary Brand Color (color picker)
- Accent Color (color picker)

**Color Picker**:
- Use react-color library
- Show hex code input
- Live preview of selected color

### **Invoice/Quote Settings**
- Invoice Prefix (text input, default "INV")
- Next Invoice Number (number input, editable by admin only)
- Quote Prefix (text input, default "Q-")
- Next Quote Number (number input, editable by admin only)
- Default Quote Validity (number input, days, default 30)

### **Default Text**
- Quote Terms & Conditions (textarea)
- Quote Footer Text (textarea)
- Invoice Footer Text (textarea)
- Payment Instructions (textarea)

**Behavior**:
- Logo upload: Click "Upload" → File input → Preview → Save
- Color picker: Click color → Picker opens → Select → Auto-update preview
- Text fields: Large textarea with character count
- Save button updates all sections
- Success toast on save

**Preview**:
- Show live preview of logo + colors on sample quote/invoice mockup

---

## Tab 7: Hours

**Component**: `BusinessHoursForm.tsx` + `CustomHoursForm.tsx`

**Layout**: Two sections

### **Standard Weekly Hours**
- Table with days of week (Monday-Sunday)
- Each row:
  - Day name
  - Closed toggle
  - First time slot: Open (time picker), Close (time picker)
  - "Add Break" button
  - Second time slot (appears after "Add Break"): Open, Close
  - Remove break button

**Default**:
- Monday-Friday: 8:00 AM - 5:00 PM, not closed
- Saturday-Sunday: Closed

**Behavior**:
- Toggle "Closed" → Disable time inputs
- Click "Add Break" → Show second time slot
- Time pickers: 12-hour format with AM/PM
- Validate: open < close, close1 < open2
- Save button updates all days
- Success toast

### **Custom Hours (Holidays/Special Dates)**
- List of custom dates (table)
- Columns: Date, Reason, Status (Open/Closed), Hours
- "Add Custom Hours" button

**Custom Hours Form (Modal)**:
- Date (date picker, future dates allowed)
- Reason (text input, e.g., "Christmas")
- Closed (toggle)
- Open Time (time picker, disabled if closed)
- Close Time (time picker, disabled if closed)

**Behavior**:
- List sorted by date (upcoming first)
- Click "Add" → Modal opens
- Toggle "Closed" → Disable time inputs
- Save → API call → Success toast → Refresh list
- Delete → Confirmation modal → API call → Refresh

---

## Tab 8: Service Areas

**Component**: `ServiceAreaList.tsx` + `ServiceAreaForm.tsx`

**Layout**:
- List of service areas (grouped by type)
- "Add Service Area" button
- Modal for add service area

**Service Area Display** (Grouped):
- **Cities**: List of cities with state
- **ZIP Codes**: List of ZIP codes
- **Radius**: Center point + radius (e.g., "25 miles from Boston office")

**Service Area Form (Modal)**:
- Type (dropdown: City, ZIP Code, Radius)
- Value (text input - city name, ZIP, or description)
- State (dropdown, appears if type=City)
- Latitude (number input, required)
- Longitude (number input, required)
- Radius (number input, appears if type=Radius, in miles)
- use google maps to show pin and radius
- Google Maps integration for visual selection
- Address autocomplete
- Automatic geocoding

**Behavior**:
- Select type → Show/hide relevant fields
- For City/ZIP: Geocoding API converts to lat/lng 
- For Radius: Lat/lng is center point
- Save → API call → Success toast → Refresh list
- Delete → Confirmation modal → API call → Refresh
- Google Maps integration for visual selection
- Address autocomplete
- Automatic geocoding

---

## Admin Pages

### **Admin: Tenant List**

**Route**: `/admin/tenants`

**Layout**:
- Search bar (by business name, subdomain, email)
- Filter dropdown (subscription status, plan)
- Table of tenants

**Table Columns**:
- Business Name
- Subdomain
- Subscription Plan
- Status (Trial, Active, Suspended, Cancelled)
- Trial End Date (if in trial)
- Users (count / max)
- Actions (View, Edit Subscription, Suspend/Activate)

**Behavior**:
- Search filters table real-time
- Click row → Navigate to tenant detail
- Click "Edit Subscription" → Modal with plan selector, trial date, status
- Click "Suspend" → Confirmation → API call → Update status
- Pagination (20 per page)

---

### **Admin: Tenant Detail**

**Route**: `/admin/tenants/[id]`

**Layout**: Same as tenant settings but read-only for admin

**Additional Actions**:
- Edit Subscription (modal)
- Change Status (activate, suspend, cancel)
- View Audit Log
- View Users

---

### **Admin: License Types**

**Route**: `/admin/license-types`

**Layout**:
- List of license types (table)
- "Add License Type" button

**Table Columns**:
- Name
- Description
- Status (Active/Inactive)
- Actions (Edit, Deactivate)

**License Type Form (Modal)**:
- Name (text input, required)
- Description (textarea, optional)
- Is Active (toggle)

**Behavior**:
- Add → Modal → Save → API call → Refresh list
- Edit → Modal pre-filled → Save → Refresh
- Deactivate → Sets is_active=false (doesn't delete)

---

### **Admin: Subscription Plans**

**Route**: `/admin/subscription-plans`

**Layout**:
- List of plans (cards)
- "Add Plan" button

**Plan Card Display**:
- Plan name
- Monthly / Annual price
- Max users
- Feature flags (checkmarks)
- Default badge (if is_default)
- Edit button

**Plan Form (Modal)**:
- Plan Name (text input, required)
- Description (textarea, optional)
- Monthly Price (currency input)
- Annual Price (currency input)
- Max Users (number input)
- Feature Flags (checkbox list):
  - Leads Module
  - Quotes Module
  - Projects Module
  - Invoices Module
  - Finance Module
  - AI Quote Agent
  - AI Voice Agent
  - Customer Portal
  - Reporting Module
  - API Access
- Set as Default (toggle)

**Behavior**:
- Add → Modal → Save → API call → Refresh
- Edit → Modal pre-filled → Save → Refresh
- Cannot delete plan if tenants are using it (show error)

---

## Feature Access Control

**Component**: `FeatureAccessBadge.tsx`

**Purpose**: Show locked features with upgrade CTA

**Usage**:
- If feature disabled on current plan → Show "Upgrade" badge
- Click badge → Modal with upgrade options

**Hook**: `useFeatureAccess(featureName)`

**Returns**: `{ allowed: boolean, plan: SubscriptionPlan }`

**Usage in Components**:
```
const { allowed } = useFeatureAccess('ai_quote_agent');

if (!allowed) {
  return <FeatureAccessBadge feature="AI Quote Agent" />;
}
```

---

## Testing Requirements

**Component Tests** (>70% coverage):
- BusinessInfoForm validates EIN format
- AddressForm validates ZIP code
- LicenseForm validates expiry date
- InsuranceForm shows expiry warning
- PaymentTermsForm allows add/remove terms
- BrandingForm allows logo upload
- BusinessHoursForm allows break setup
- ServiceAreaForm validates lat/lng

**E2E Tests** (>50% coverage):
- Complete business profile setup (all tabs)
- Add multiple addresses
- Add license with expiry
- Configure business hours with break
- Add service area (all types)
- Upload logo and set brand colors
- Admin: Create subscription plan
- Admin: Update tenant subscription

---

## Completion Checklist

- [ ] All TypeScript interfaces defined
- [ ] All Zod validation schemas created
- [ ] All formatters implemented (phone, EIN, ZIP)
- [ ] Tenant API client implemented (all methods)
- [ ] Business Settings page with 8 tabs
- [ ] BusinessInfoForm component
- [ ] AddressList + AddressForm components
- [ ] LicenseList + LicenseForm components
- [ ] InsuranceForm component
- [ ] PaymentTermsForm component
- [ ] BrandingForm component (with color picker)
- [ ] BusinessHoursForm component (with breaks)
- [ ] CustomHoursForm component
- [ ] ServiceAreaList + ServiceAreaForm components
- [ ] Admin: Tenant list page
- [ ] Admin: Tenant detail page
- [ ] Admin: License types page
- [ ] Admin: Subscription plans page
- [ ] FeatureAccessBadge component
- [ ] useFeatureAccess hook
- [ ] All forms have loading states
- [ ] All forms have error handling (modals)
- [ ] All forms have success feedback (toasts)
- [ ] Mobile responsive (all pages and forms)
- [ ] Component tests >70% coverage
- [ ] E2E tests >50% coverage
- [ ] No TypeScript errors
- [ ] No console errors

---

## Modern UI/UX Checklist

- [ ] EIN input auto-formats as XX-XXXXXXX
- [ ] Phone inputs auto-format as (555) 123-4567
- [ ] ZIP code input auto-formats as XXXXX or XXXXX-XXXX
- [ ] Color picker for brand colors
- [ ] File upload with preview (logo)
- [ ] Date pickers for all date fields
- [ ] Time pickers for business hours
- [ ] Toggle switches for boolean fields (is_po_box, closed, etc.)
- [ ] Masked currency inputs (coverage amount)
- [ ] Dropdown autocomplete for state selection
- [ ] Modals for all forms (add/edit)
- [ ] Confirmation modals for delete actions
- [ ] Success toasts for all saves
- [ ] Error modals for API failures
- [ ] Loading spinners during API calls
- [ ] Disabled state on inputs during loading
- [ ] Expiry warnings (yellow/red badges)
- [ ] Feature access badges with upgrade CTAs
- [ ] Responsive design (mobile-first)
- [ ] Touch-friendly (buttons min 44x44px)

---

## Common Pitfalls to Avoid

1. **Don't store formatted values** - Store digits only, format on display
2. **Don't skip validation on optional fields** - Validate format if provided
3. **Don't allow deletion of last legal address** - Disable button
4. **Don't forget expiry warnings** - Check dates on render
5. **Don't submit without loading state** - Disable form during API call
6. **Don't use browser prompts** - Use modal components
7. **Don't hardcode license types** - Fetch from API
8. **Don't forget mobile responsiveness** - Test on 375px width

---

**End of Frontend Module Documentation**

This module provides complete tenant profile management with production-quality UI.