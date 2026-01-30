# Lead360 Platform - Development TODO

> **Last Updated**: January 2026
> **Current Phase**: Planning & Documentation
> **Current Sprint**: 0 (Foundation)

---

## Documentation Status

### Core Framework

- [x] CLAUDE.md (Master coordinator)
- [x] BACKEND_AGENT.md (Backend specialist role)
- [x] FRONTEND_AGENT.md (Frontend specialist role)
- [x] Lead360_Infrastructure_Documentation.md
- [x] Product Requirements & Functional Specification
- [x] Development Blueprint
- [x] Service Business SaaS Specification

### Shared Conventions

- [x] documentation/shared/multi-tenant-rules.md
- [x] documentation/shared/api-conventions.md
- [x] documentation/shared/naming-conventions.md
- [x] documentation/shared/security-rules.md
- [x] documentation/shared/testing-requirements.md

### Templates

- [x] documentation/templates/feature-contract-template.md

---

## Sprint 0: Platform Foundation

> **Goal**: Build the core infrastructure that all features depend on.

### 0.1 Project Structure Setup

**Status**: `Completed`

#### Documentation

- [X] contracts/project-structure-contract.md
- [X] backend/setup-guide.md
- [X] frontend/setup-guide.md

#### Backend Development

- [X] Initialize NestJS monorepo (Turborepo/Nx)
- [X] Configure Prisma ORM
- [X] Setup MySQL connection
- [X] Configure TypeScript
- [X] Setup ESLint + Prettier
- [X] Configure environment variables (.env structure)
- [X] Setup testing framework (Jest)
- [X] Create initial folder structure (src/modules, src/core)

#### Frontend Development

- [X] Initialize Next.js app (App Router)
- [X] Configure TypeScript
- [X] Setup Tailwind CSS
- [X] Setup ESLint + Prettier
- [X] Configure environment variables (.env.local)
- [X] Setup testing framework (Jest + React Testing Library)
- [X] Create initial folder structure (app, components, lib)

#### Shared Packages

- [X] Create packages/shared for types
- [X] Create packages/ui for shared components
- [X] Create packages/config for shared configs

---

### 0.2 Database Foundation

**Status**: `Completed`

#### Documentation

- [X] contracts/database-foundation-contract.md
- [X] backend/module-database-foundation.md

#### Backend Development

- [X] Create Prisma schema (initial)
- [X] Create tenant table
- [X] Create user table
- [X] Create role table
- [X] Create permission table
- [X] Create audit_log table
- [X] Create initial migration
- [X] Create seed data script (dev tenant + admin user)
- [X] Test migration on local database

#### Tests

- [X] Migration runs successfully
- [X] Seed data creates test tenant
- [ ] Seed data creates admin user

---

### 0.3 Authentication System

**Status**: `MVP Ready`

#### Documentation

- [x] contracts/authentication-contract.md
- [x] backend/module-authentication.md
- [x] frontend/module-authentication.md

#### Backend Development

- [X] Create Auth module (NestJS)
- [X] Implement JWT service (generate/validate tokens)
- [X] Implement password hashing (bcrypt)
- [X] Create POST /auth/login endpoint
- [X] Create POST /auth/register endpoint (tenant admin only)
- [X] Create POST /auth/logout endpoint
- [X] Create POST /auth/refresh endpoint
- [X] Create JWT auth guard
- [X] Write unit tests (auth service)
- [X] Write integration tests (auth endpoints)
- [X] Generate API documentation
- [ ] Implement 2Factor
- [ ] Implement Social Login

#### Frontend Development

- [X] Create auth context (useAuth hook)
- [X] Create login page (/login)
- [X] Create register page (/register)
- [X] Create ProtectedRoute component
- [X] Implement token storage (httpOnly cookie recommended)
- [X] Implement auto-redirect (unauthenticated → login)
- [X] Create logout functionality
- [X] Write component tests
- [X] Write E2E tests (login flow)
- [ ] Implement 2Factor
- [ ] Implement Social Login

---

### 0.4 Multi-Tenant Resolution

**Status**: `Complete`

#### Documentation

- [X] contracts/multi-tenant-contract.md
- [X] backend/module-multi-tenant.md
- [X] frontend/module-multi-tenant.md

#### Backend Development

- [X] Create Tenant module
- [X] Create tenant resolution middleware (extract from JWT)
- [X] Create Prisma middleware (enforce tenant_id on all queries)
- [X] Create @TenantId() decorator
- [X] Create TenantGuard
- [X] Add tenant_id validation to all tenant-scoped tables
- [X] Write tenant isolation tests (MANDATORY)
- [X] Write unit tests
- [X] Generate API documentation

#### Frontend Development

- [X] Create subdomain detection middleware (Next.js)
- [X] Handle tenant subdomain routing
- [X] Create tenant context (if needed)
- [X] Test subdomain resolution (local dev setup)

---

### 0.5 RBAC System

**Status**: `Completed`

#### Documentation

- [X] contracts/rbac-contract.md
- [X] backend/module-rbac.md
- [X] frontend/module-rbac.md

#### Backend Development

- [X] Define role enum (Owner, Admin, Estimator, PM, Bookkeeper, Employee, ReadOnly)
- [X] Create RolesGuard
- [X] Create @Roles() decorator
- [X] Seed default roles in database
- [X] Implement role assignment (user has many roles)
- [X] Write RBAC tests (MANDATORY - test role enforcement)
- [X] Write unit tests
- [X] Generate API documentation

#### Frontend Development

- [X] Create useRole() hook
- [X] Implement role-based UI hiding (buttons, menus)
- [X] Create role-based routing guards
- [X] Write component tests (role visibility)

---

### 0.6 Admin Panel (Platform Admin)

**Status**: `Not Started`

#### Documentation

- [ ] contracts/admin-panel-contract.md
- [ ] backend/module-admin-panel.md
- [ ] frontend/module-admin-panel.md

#### Backend Development

- [ ] Create Admin module
- [ ] Create GET /admin/tenants endpoint (list tenants)
- [ ] Create POST /admin/tenants endpoint (create tenant)
- [ ] Create PATCH /admin/tenants/:id endpoint (update tenant)
- [ ] Create DELETE /admin/tenants/:id endpoint (soft delete)
- [ ] Create GET /admin/users endpoint (list users across tenants)
- [ ] Create POST /admin/users endpoint (create user)
- [ ] Create PATCH /admin/users/:id endpoint (update user)
- [ ] Create GET /admin/audit-logs endpoint (view audit logs)
- [ ] Create GET /admin/health endpoint (system health)
- [ ] Restrict all endpoints to platform admin role
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create admin layout (/admin)
- [ ] Create tenant list page (/admin/tenants)
- [ ] Create tenant form (create/edit)
- [ ] Create user list page (/admin/users)
- [ ] Create user form (create/edit)
- [ ] Create audit log viewer (/admin/audit-logs)
- [ ] Create system health dashboard (/admin/health)
- [ ] Implement search/filter on lists
- [ ] Write component tests
- [ ] Write E2E tests (create tenant flow)

---

### 0.7 Audit Logging

**Status**: `Completed`

#### Documentation

- [X] contracts/audit-logging-contract.md
- [X] backend/module-audit-logging.md

#### Backend Development

- [X] Create AuditLog module
- [X] Create audit_log table (if not in 0.2)
- [X] Create audit service (log changes)
- [X] Implement before/after JSON capture
- [X] Implement IP address + user agent tracking
- [X] Create GET /audit-logs endpoint (per tenant)
- [X] Integrate audit logging into critical endpoints (quotes, invoices, etc.)
- [X] Write unit tests
- [X] Write integration tests
- [X] Generate API documentation

---

### 0.8 File Storage Service

**Status**: `Completed`

#### Documentation

- [X] contracts/file-storage-contract.md
- [X] backend/module-file-storage.md
- [X] frontend/module-file-storage.md

#### Backend Development

- [X] Create FileStorage module
- [X] Implement S3-compatible storage abstraction
- [X] Create file metadata table
- [X] Create POST /files/upload endpoint
- [X] Create GET /files/:id endpoint (download)
- [X] Create DELETE /files/:id endpoint
- [X] Implement access control (tenant-scoped)
- [X] Implement virus scanning (optional - ClamAV)
- [X] Write unit tests
- [X] Write integration tests
- [X] Generate API documentation

#### Frontend Development

- [X] Create file upload component
- [X] Create file preview component
- [X] Implement drag-and-drop upload
- [X] Implement progress indicators
- [X] Write component tests

---

### 0.9 Background Jobs (BullMQ + Redis)

**Status**: `Not Started`

#### Documentation

- [X] contracts/background-jobs-contract.md
- [X] backend/module-background-jobs.md

#### Backend Development

- [X] Setup Redis connection
- [X] Configure BullMQ
- [X] Create queue definitions (notifications, pdf, ai, webhooks)
- [X] Create base processor pattern
- [ ] Create email queue + processor
- [ ] Create SMS queue + processor
- [X] Implement retry logic
- [X] Implement job monitoring
- [X] Write unit tests
- [X] Write integration tests

---

### Sprint 0 Completion Checklist

Before moving to Sprint 1, verify:

- [ ] All Sprint 0 modules complete
- [ ] All tests passing (unit + integration + E2E)
- [ ] Multi-tenant isolation verified (cannot access other tenant data)
- [ ] RBAC enforcement verified (roles work correctly)
- [ ] Admin can create tenants
- [ ] Admin can create users
- [ ] Business users can log in
- [ ] Subdomain routing works
- [ ] Audit logs capture changes
- [ ] File uploads work
- [ ] Background jobs process
- [ ] All API documentation complete
- [ ] All frontend pages render correctly

**Sprint 0 Status**: `Not Started`

---

## Sprint 1: Leads & Addresses & Service Requests

> **Goal**: Implement lead management with addresses and service requests.

### 1.1 Leads Module

**Status**: `Not Started`

#### Documentation

- [X] contracts/leads-contract.md
- [X] backend/module-leads.md
- [X] frontend/module-leads.md

#### Backend Development

- [ ] Create lead table (Prisma schema)
- [ ] Create address table (related to lead)
- [ ] Create service_request table (related to lead)
- [ ] Create Leads module (NestJS)
- [ ] Create POST /leads endpoint
- [ ] Create GET /leads endpoint (paginated, filtered, sorted)
- [ ] Create GET /leads/:id endpoint
- [ ] Create PATCH /leads/:id endpoint
- [ ] Create DELETE /leads/:id endpoint (soft delete)
- [ ] Create POST /leads/:id/addresses endpoint
- [ ] Create GET /leads/:id/addresses endpoint
- [ ] Create POST /leads/:id/service-requests endpoint
- [ ] Create GET /leads/:id/service-requests endpoint
- [ ] Implement lead status pipeline (NEW → QUALIFIED → CONVERTED → LOST)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write tenant isolation tests
- [ ] Write RBAC tests
- [ ] Generate API documentation (100% coverage)

#### Frontend Development

- [ ] Create leads list page (/leads)
- [ ] Create lead detail page (/leads/:id)
- [ ] Create lead form (multi-step: Basic Info → Address → Service Request)
- [ ] Create LeadCard component
- [ ] Create LeadForm component
- [ ] Create AddressForm component
- [ ] Create ServiceRequestForm component
- [ ] Implement search (name, phone, email)
- [ ] Implement filter (status, source)
- [ ] Implement sort (created_at, name)
- [ ] Implement pagination
- [ ] Write component tests
- [ ] Write E2E tests (create lead flow)

---

## Sprint 2: Communications Timeline + Twilio SMS

> **Goal**: Log all communications (calls, SMS, emails) in unified timeline.

### 2.1 Communications Module

**Status**: `Not Started`

#### Documentation

- [ ] contracts/communications-contract.md
- [ ] backend/module-communications.md
- [ ] frontend/module-communications.md

#### Backend Development

- [ ] Create communication_event table
- [ ] Create Communications module
- [ ] Integrate Twilio SMS
- [ ] Create POST /leads/:id/sms endpoint (send SMS)
- [ ] Create POST /webhooks/twilio/sms endpoint (inbound SMS)
- [ ] Create GET /leads/:id/timeline endpoint (all communications)
- [ ] Implement idempotency (webhook deduplication)
- [ ] Store SMS consent tracking
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create timeline component (communications history)
- [ ] Create SMS send modal
- [ ] Integrate timeline into lead detail page
- [ ] Display call/SMS/email events chronologically
- [ ] Write component tests

---

## Sprint 3: Email Sending + Notification Framework

> **Goal**: Send emails and build notification system.

### 3.1 Email & Notifications Module

**Status**: `Not Started`

#### Documentation

- [ ] contracts/email-notifications-contract.md
- [ ] backend/module-email-notifications.md
- [ ] frontend/module-email-notifications.md

#### Backend Development

- [ ] Integrate email provider (SendGrid/Mailgun)
- [ ] Create email templates
- [ ] Create POST /leads/:id/email endpoint
- [ ] Create notification service (abstraction)
- [ ] Log emails in communication_event table
- [ ] Create email queue processor
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create email send modal
- [ ] Display email events in timeline
- [ ] Write component tests

---

## Sprint 4: Quotes v1 (Manual)

> **Goal**: Create quotes with line items, units, totals.

### 4.1 Quotes Module (Manual)

**Status**: `Not Started`

#### Documentation

- [ ] contracts/quotes-contract.md
- [ ] backend/module-quotes.md
- [ ] frontend/module-quotes.md

#### Backend Development

- [ ] Create quote table
- [ ] Create quote_item table
- [ ] Create Quotes module
- [ ] Create POST /quotes endpoint
- [ ] Create GET /quotes endpoint (paginated, filtered)
- [ ] Create GET /quotes/:id endpoint
- [ ] Create PATCH /quotes/:id endpoint
- [ ] Create DELETE /quotes/:id endpoint
- [ ] Create POST /quotes/:id/items endpoint
- [ ] Implement quote status (DRAFT → SENT → OPENED → ACCEPTED → REJECTED → EXPIRED)
- [ ] Implement validity period (expiration logic)
- [ ] Calculate subtotal/tax/total
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create quotes list page (/quotes)
- [ ] Create quote detail page (/quotes/:id)
- [ ] Create quote builder (multi-step)
- [ ] Create line item editor (add/edit/delete rows)
- [ ] Create unit selector dropdown
- [ ] Display totals (subtotal, tax, total)
- [ ] Write component tests
- [ ] Write E2E tests

---

## Sprint 5: PDF Templates + Branding

> **Goal**: Generate branded PDF quotes.

### 5.1 PDF Rendering

**Status**: `Not Started`

#### Documentation

- [ ] contracts/pdf-rendering-contract.md
- [ ] backend/module-pdf-rendering.md
- [ ] frontend/module-pdf-rendering.md

#### Backend Development

- [ ] Create tenant_branding table
- [ ] Create quote_template table
- [ ] Implement PDF rendering (Playwright/Puppeteer)
- [ ] Create POST /quotes/:id/generate-pdf endpoint
- [ ] Create pdf queue processor
- [ ] Store rendered PDF in object storage
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create branding upload page (/settings/branding)
- [ ] Create template selector
- [ ] Display PDF preview
- [ ] Create download PDF button
- [ ] Write component tests

---

## Sprint 6: Customer Portal on Subdomain + Tracking

> **Goal**: Public quote view on tenant subdomain.

### 6.1 Customer Portal

**Status**: `Not Started`

#### Documentation

- [ ] contracts/customer-portal-contract.md
- [ ] backend/module-customer-portal.md
- [ ] frontend/module-customer-portal.md

#### Backend Development

- [ ] Create quote_view_event table (tracking)
- [ ] Create GET /public/quotes/:token endpoint
- [ ] Create GET /public/quotes/:token/pdf endpoint
- [ ] Create POST /public/quotes/:token/events endpoint (tracking)
- [ ] Implement quote token generation
- [ ] Implement open/download tracking
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create public quote view page (/portal/quotes/:token)
- [ ] Display quote details (customer-facing)
- [ ] Create download PDF button
- [ ] Track open event (pixel/API call)
- [ ] Track download event
- [ ] Write E2E tests

---

## Sprint 7: Project Conversion + Tasks + Progress

> **Goal**: Convert accepted quotes to projects with tasks.

### 7.1 Projects Module

**Status**: `Not Started`

#### Documentation

- [ ] contracts/projects-contract.md
- [ ] backend/module-projects.md
- [ ] frontend/module-projects.md

#### Backend Development

- [ ] Create project table
- [ ] Create task table
- [ ] Create POST /quotes/:id/accept endpoint (convert to project)
- [ ] Create GET /projects endpoint
- [ ] Create GET /projects/:id endpoint
- [ ] Create POST /projects/:id/tasks endpoint
- [ ] Create PATCH /projects/:id/tasks/:taskId endpoint
- [ ] Implement progress calculation (% tasks complete)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create projects list page (/projects)
- [ ] Create project detail page (/projects/:id)
- [ ] Create task list component
- [ ] Create progress bar component
- [ ] Write component tests

---

## Sprint 8: Change Orders v1

> **Goal**: Add change orders to projects.

### 8.1 Change Orders Module

**Status**: `Not Started`

#### Documentation

- [ ] contracts/change-orders-contract.md
- [ ] backend/module-change-orders.md
- [ ] frontend/module-change-orders.md

#### Backend Development

- [ ] Create change_order table
- [ ] Create POST /projects/:id/change-orders endpoint
- [ ] Create GET /projects/:id/change-orders endpoint
- [ ] Create PATCH /change-orders/:id endpoint
- [ ] Implement change order approval workflow
- [ ] Update project totals on acceptance
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create change order form
- [ ] Display change orders on project page
- [ ] Implement approval UI
- [ ] Write component tests

---

## Sprint 9: Invoices + Payments + Credits + Invoice Cap

> **Goal**: Invoice customers with cap enforcement.

### 9.1 Invoicing Module

**Status**: `Not Started`

#### Documentation

- [ ] contracts/invoicing-contract.md
- [ ] backend/module-invoicing.md
- [ ] frontend/module-invoicing.md

#### Backend Development

- [ ] Create invoice table
- [ ] Create payment table
- [ ] Create credit table
- [ ] Create POST /invoices endpoint
- [ ] Create GET /invoices endpoint
- [ ] Create POST /payments endpoint
- [ ] Create POST /credits endpoint
- [ ] Implement invoice cap rule (quote total + change orders - credits)
- [ ] Block invoicing if cap exceeded
- [ ] Write unit tests (MUST test invoice cap)
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create invoices list page
- [ ] Create invoice form
- [ ] Create payment recording form
- [ ] Display invoice cap warning
- [ ] Write component tests

---

## Sprint 10: AI Quote Agent v1 (1 Industry)

> **Goal**: AI-assisted quote generation.

### 10.1 AI Quote Agent

**Status**: `Not Started`

#### Documentation

- [ ] contracts/ai-quote-agent-contract.md
- [ ] backend/module-ai-quote-agent.md
- [ ] frontend/module-ai-quote-agent.md

#### Backend Development

- [ ] Create ai_agent_profile table
- [ ] Create industry task libraries
- [ ] Integrate AI provider (OpenAI/Anthropic)
- [ ] Create POST /quotes/generate endpoint
- [ ] Implement prompt engineering (industry-specific)
- [ ] Mark AI-generated quotes as "Draft"
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create AI quote generation UI
- [ ] Display draft quote with approval workflow
- [ ] Write component tests

---

## Sprint 11: Scheduling + Reminders

> **Goal**: Google Calendar integration + automated reminders.

### 11.1 Scheduling Module

**Status**: `Not Started`

#### Documentation

- [ ] contracts/scheduling-contract.md
- [ ] backend/module-scheduling.md
- [ ] frontend/module-scheduling.md

#### Backend Development

- [ ] Integrate Google Calendar OAuth
- [ ] Create appointment table
- [ ] Create POST /appointments endpoint
- [ ] Create calendar event creation
- [ ] Create reminder queue processor
- [ ] Send SMS/email reminders
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create appointment form
- [ ] Display calendar integration
- [ ] Write component tests

---

## Sprint 12: Reporting + Exports v1

> **Goal**: Basic reports and CSV exports.

### 12.1 Reporting Module

**Status**: `Not Started`

#### Documentation

- [ ] contracts/reporting-contract.md
- [ ] backend/module-reporting.md
- [ ] frontend/module-reporting.md

#### Backend Development

- [ ] Create GET /reports/leads endpoint
- [ ] Create GET /reports/quotes endpoint
- [ ] Create GET /reports/projects endpoint
- [ ] Create CSV export endpoints
- [ ] Implement date range filters
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Generate API documentation

#### Frontend Development

- [ ] Create reports dashboard (/reports)
- [ ] Create date range picker
- [ ] Create export buttons
- [ ] Display charts/graphs
- [ ] Write component tests

---

## Post-MVP (Future Sprints)

### Finance Module + Receipt OCR

- [ ] Create financial_entry table
- [ ] Create expense categories
- [ ] Implement receipt OCR
- [ ] Create recurring expense automation
- [ ] Create P&L reports

### Time Clock + Geo Rules

- [ ] Create time_clock_event table
- [ ] Implement geofencing
- [ ] Create clock-in/out endpoints
- [ ] Create manual edit workflow (with audit)
- [ ] Create payroll export

### AI Voice Live Agent

- [ ] Integrate voice AI provider
- [ ] Implement call routing
- [ ] Create qualification flow
- [ ] Create scheduling automation
- [ ] Create escalation rules

---

## Success Metrics

Track these throughout development:

- [ ] Code coverage >80% (backend services)
- [ ] Code coverage >70% (frontend components)
- [ ] Zero tenant isolation bugs
- [ ] Zero RBAC bypass bugs
- [ ] All APIs documented (100%)
- [ ] All critical user flows have E2E tests
- [ ] Mobile responsive (all pages)
- [ ] Page load time <2s (p95)
- [ ] API response time <200ms (p95)

---

## Notes

- Update this file after completing each module
- Use checkboxes to track progress
- Add blockers/risks in notes section
- Keep this file in git for version control




[ ] ADD SMS TO QUOTES
[ ] BUndle items, quando altera o preço do item na biblioteca de items precisa emitir alerta para atualizar o preço nos bundles se usado lá. Frontend alerta pendente.
[ ] Permitir envio de mensagens entre quote view e backend/quote/lead para evitar uso de SMS e ligações. 
[ ] Pensar na possibilidade de incluir assinatura digital e exigir senha obrigatória para abrir visualização do orçamento. 
[ ] Bundle Customization in UI Before adding bundle to quote, let user: Adjust quantities, Remove specific items, Override prices, Currently: Add first, edit after
[ ] Add viewed status to quote, when they open the web view.
[ ] add downloaded status when they download the pdf. 
[ ] add quotes and projects and financial on each lead/customer. 
[ ] add tracking system to SMTP - future.
[ ] Check lead status, make auto email to follow up if lead refuse turns lost but can turn to a lead back again later with a new request or manually or when creating a quote. 