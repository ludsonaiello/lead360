# Quote Module - Global Frontend Agent Instructions

**Role**: Frontend Developer Agent  
**Module**: Lead360 Quotes Module  
**Restriction**: FRONTEND ONLY - Do NOT touch backend code

---

## MANDATORY READING BEFORE ANY CODE

**API Documentation**: `api/documentation/quotes_REST_API.md`

Read this file COMPLETELY before writing any code. This is your ONLY source of truth for:
- Endpoint URLs
- Request/Response field names
- Validation rules
- Business logic
- RBAC permissions

---

## ABSOLUTE RULES

### YOU MUST
1. Use EXACT field names from API documentation
2. Test every endpoint at `http://localhost:8000/api/v1`
3. Follow existing UI patterns from Jobs/Auth/Files modules
4. Use shadcn/ui components exclusively
5. Apply input masks (money, percentage, phone)
6. Make all dropdowns searchable
7. Integrate Google Maps for all address fields

### YOU MUST NOT
1. Modify backend code
2. Create new API endpoints
3. Change database schemas
4. Invent field names not in documentation
5. Use browser alerts/confirms (use modals)
6. Put long forms in modals (use full page)

---

## AUTHENTICATION

**Backend URL**: `http://localhost:8000`

**Test Accounts** (use BOTH):
- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## UI STANDARDS

### Forms
- Long forms (5+ fields) → Full page
- Simple forms (1-4 fields) → Modal
- Multi-step → Full page with progress indicator

### Required Features
- All selects → Searchable (combobox)
- Multi-select → Show selected as pills, remove from dropdown
- Address fields → Google Maps autocomplete + geocoding
- Action buttons → Include icons (Lucide React)
- Loading states → Skeleton loaders or spinners
- Empty states → Icon + message + CTA

### Input Masks (MANDATORY)
- Money: `$1,234.56`
- Percentage: `25.5%`
- Phone: `(555) 123-4567`
- Zip: `12345` or `12345-6789`

### Quote Form Lead Selection
- Searchable dropdown to select existing lead
- OR "Create New Lead" button that expands inline form
- Auto-populate customer info when lead selected

---

## TECH STACK

- Next.js 14+ (App Router)
- TypeScript (strict)
- shadcn/ui components
- Tailwind CSS
- Lucide React icons
- TanStack Query (API calls)
- React Hook Form + Zod (forms)
- Google Maps API

---

## TESTING REQUIREMENTS

Before completing any feature:
1. Test endpoint with both accounts
2. Test error scenarios (400, 404, 500)
3. Test loading states
4. Test responsive design
5. Test with real data

---

## DELIVERABLES

Your sprint is complete when:
1. All assigned endpoints have working UI
2. All endpoints tested and working
3. Forms follow UI standards
4. No console errors
5. Code matches existing patterns

---

**REMEMBER**: Read `api/documentation/quotes_REST_API.md` first. Use exact field names. Test everything.