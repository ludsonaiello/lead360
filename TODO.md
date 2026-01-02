Lead360 Platform - Development TODO
Last Updated: January 2026
Current Phase: Planning & Documentation
Current Sprint: 0 (Foundation)

📚 Documentation Status
Core Framework ✅ COMPLETE

 CLAUDE.md (Master coordinator)
 BACKEND_AGENT.md (Backend specialist role)
 FRONTEND_AGENT.md (Frontend specialist role)
 Lead360_Infrastructure_Documentation.md
 Product Requirements & Functional Specification
 Development Blueprint
 Service Business SaaS Specification

Shared Conventions ✅ COMPLETE

 documentation/shared/multi-tenant-rules.md
 documentation/shared/api-conventions.md
 documentation/shared/naming-conventions.md
 documentation/shared/security-rules.md
 documentation/shared/testing-requirements.md

Templates ✅ COMPLETE

 documentation/templates/feature-contract-template.md


🏗️ SPRINT 0: PLATFORM FOUNDATION
Goal: Build the core infrastructure that all features depend on.
0.1 Project Structure Setup
Documentation:

 contracts/project-structure-contract.md
 backend/setup-guide.md
 frontend/setup-guide.md

Backend Development:

 Initialize NestJS monorepo (Turborepo/Nx)
 Configure Prisma ORM
 Setup MySQL connection
 Configure TypeScript
 Setup ESLint + Prettier
 Configure environment variables (.env structure)
 Setup testing framework (Jest)
 Create initial folder structure (src/modules, src/core)

Frontend Development:

 Initialize Next.js app (App Router)
 Configure TypeScript
 Setup Tailwind CSS
 Setup ESLint + Prettier
 Configure environment variables (.env.local)
 Setup testing framework (Jest + React Testing Library)
 Create initial folder structure (app, components, lib)

Shared Packages:

 Create packages/shared for types
 Create packages/ui for shared components
 Create packages/config for shared configs

Status: ⬜ Not Started

0.2 Database Foundation
Documentation:

 contracts/database-foundation-contract.md
 backend/module-database-foundation.md

Backend Development:

 Create Prisma schema (initial)
 Create tenant table
 Create user table
 Create role table
 Create permission table
 Create audit_log table
 Create initial migration
 Create seed data script (dev tenant + admin user)
 Test migration on local database

Tests:

 Migration runs successfully
 Seed data creates test tenant
 Seed data creates admin user

Status: ⬜ Not Started

0.3 Authentication System
Documentation:

 contracts/authentication-contract.md
 backend/module-authentication.md
 frontend/module-authentication.md

Backend Development:

 Create Auth module (NestJS)
 Implement JWT service (generate/validate tokens)
 Implement password hashing (bcrypt)
 Create POST /auth/login endpoint
 Create POST /auth/register endpoint (tenant admin only)
 Create POST /auth/logout endpoint
 Create POST /auth/refresh endpoint
 Create JWT auth guard
 Write unit tests (auth service)
 Write integration tests (auth endpoints)
 Generate API documentation

Frontend Development:

 Create auth context (useAuth hook)
 Create login page (/login)
 Create register page (/register)
 Create ProtectedRoute component
 Implement token storage (httpOnly cookie recommended)
 Implement auto-redirect (unauthenticated → login)
 Create logout functionality
 Write component tests
 Write E2E tests (login flow)

Status: ⬜ Not Started

0.4 Multi-Tenant Resolution
Documentation:

 contracts/multi-tenant-contract.md
 backend/module-multi-tenant.md
 frontend/module-multi-tenant.md

Backend Development:

 Create Tenant module
 Create tenant resolution middleware (extract from JWT)
 Create Prisma middleware (enforce tenant_id on all queries)
 Create @TenantId() decorator
 Create TenantGuard
 Add tenant_id validation to all tenant-scoped tables
 Write tenant isolation tests (MANDATORY)
 Write unit tests
 Generate API documentation

Frontend Development:

 Create subdomain detection middleware (Next.js)
 Handle tenant subdomain routing
 Create tenant context (if needed)
 Test subdomain resolution (local dev setup)

Status: ⬜ Not Started

0.5 RBAC System
Documentation:

 contracts/rbac-contract.md
 backend/module-rbac.md
 frontend/module-rbac.md

Backend Development:

 Define role enum (Owner, Admin, Estimator, PM, Bookkeeper, Employee, ReadOnly)
 Create RolesGuard
 Create @Roles() decorator
 Seed default roles in database
 Implement role assignment (user has many roles)
 Write RBAC tests (MANDATORY - test role enforcement)
 Write unit tests
 Generate API documentation

Frontend Development:

 Create useRole() hook
 Implement role-based UI hiding (buttons, menus)
 Create role-based routing guards
 Write component tests (role visibility)

Status: ⬜ Not Started

0.6 Admin Panel (Platform Admin)
Documentation:

 contracts/admin-panel-contract.md
 backend/module-admin-panel.md
 frontend/module-admin-panel.md

Backend Development:

 Create Admin module
 Create GET /admin/tenants endpoint (list tenants)
 Create POST /admin/tenants endpoint (create tenant)
 Create PATCH /admin/tenants/:id endpoint (update tenant)
 Create DELETE /admin/tenants/:id endpoint (soft delete)
 Create GET /admin/users endpoint (list users across tenants)
 Create POST /admin/users endpoint (create user)
 Create PATCH /admin/users/:id endpoint (update user)
 Create GET /admin/audit-logs endpoint (view audit logs)
 Create GET /admin/health endpoint (system health)
 Restrict all endpoints to platform admin role
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create admin layout (/admin)
 Create tenant list page (/admin/tenants)
 Create tenant form (create/edit)
 Create user list page (/admin/users)
 Create user form (create/edit)
 Create audit log viewer (/admin/audit-logs)
 Create system health dashboard (/admin/health)
 Implement search/filter on lists
 Write component tests
 Write E2E tests (create tenant flow)

Status: ⬜ Not Started

0.7 Audit Logging
Documentation:

 contracts/audit-logging-contract.md
 backend/module-audit-logging.md

Backend Development:

 Create AuditLog module
 Create audit_log table (if not in 0.2)
 Create audit service (log changes)
 Implement before/after JSON capture
 Implement IP address + user agent tracking
 Create GET /audit-logs endpoint (per tenant)
 Integrate audit logging into critical endpoints (quotes, invoices, etc.)
 Write unit tests
 Write integration tests
 Generate API documentation

Status: ⬜ Not Started

0.8 File Storage Service
Documentation:

 contracts/file-storage-contract.md
 backend/module-file-storage.md
 frontend/module-file-storage.md

Backend Development:

 Create FileStorage module
 Implement S3-compatible storage abstraction
 Create file metadata table
 Create POST /files/upload endpoint
 Create GET /files/:id endpoint (download)
 Create DELETE /files/:id endpoint
 Implement access control (tenant-scoped)
 Implement virus scanning (optional - ClamAV)
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create file upload component
 Create file preview component
 Implement drag-and-drop upload
 Implement progress indicators
 Write component tests

Status: ⬜ Not Started

0.9 Background Jobs (BullMQ + Redis)
Documentation:

 contracts/background-jobs-contract.md
 backend/module-background-jobs.md

Backend Development:

 Setup Redis connection
 Configure BullMQ
 Create queue definitions (notifications, pdf, ai, webhooks)
 Create base processor pattern
 Create email queue + processor
 Create SMS queue + processor
 Implement retry logic
 Implement job monitoring
 Write unit tests
 Write integration tests

Status: ⬜ Not Started

✅ Sprint 0 Completion Checklist
Before moving to Sprint 1, verify:

 All Sprint 0 modules complete
 All tests passing (unit + integration + E2E)
 Multi-tenant isolation verified (cannot access other tenant data)
 RBAC enforcement verified (roles work correctly)
 Admin can create tenants
 Admin can create users
 Business users can log in
 Subdomain routing works
 Audit logs capture changes
 File uploads work
 Background jobs process
 All API documentation complete
 All frontend pages render correctly

Sprint 0 Status: ⬜ Not Started

🚀 SPRINT 1: LEADS & ADDRESSES & SERVICE REQUESTS
Goal: Implement lead management with addresses and service requests.
1.1 Leads Module
Documentation:

 contracts/leads-contract.md
 backend/module-leads.md
 frontend/module-leads.md

Backend Development:

 Create lead table (Prisma schema)
 Create address table (related to lead)
 Create service_request table (related to lead)
 Create Leads module (NestJS)
 Create POST /leads endpoint
 Create GET /leads endpoint (paginated, filtered, sorted)
 Create GET /leads/:id endpoint
 Create PATCH /leads/:id endpoint
 Create DELETE /leads/:id endpoint (soft delete)
 Create POST /leads/:id/addresses endpoint
 Create GET /leads/:id/addresses endpoint
 Create POST /leads/:id/service-requests endpoint
 Create GET /leads/:id/service-requests endpoint
 Implement lead status pipeline (NEW → QUALIFIED → CONVERTED → LOST)
 Write unit tests
 Write integration tests
 Write tenant isolation tests
 Write RBAC tests
 Generate API documentation (100% coverage)

Frontend Development:

 Create leads list page (/leads)
 Create lead detail page (/leads/:id)
 Create lead form (multi-step: Basic Info → Address → Service Request)
 Create LeadCard component
 Create LeadForm component
 Create AddressForm component
 Create ServiceRequestForm component
 Implement search (name, phone, email)
 Implement filter (status, source)
 Implement sort (created_at, name)
 Implement pagination
 Write component tests
 Write E2E tests (create lead flow)

Status: ⬜ Not Started

📞 SPRINT 2: COMMUNICATIONS TIMELINE + TWILIO SMS
Goal: Log all communications (calls, SMS, emails) in unified timeline.
2.1 Communications Module
Documentation:

 contracts/communications-contract.md
 backend/module-communications.md
 frontend/module-communications.md

Backend Development:

 Create communication_event table
 Create Communications module
 Integrate Twilio SMS
 Create POST /leads/:id/sms endpoint (send SMS)
 Create POST /webhooks/twilio/sms endpoint (inbound SMS)
 Create GET /leads/:id/timeline endpoint (all communications)
 Implement idempotency (webhook deduplication)
 Store SMS consent tracking
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create timeline component (communications history)
 Create SMS send modal
 Integrate timeline into lead detail page
 Display call/SMS/email events chronologically
 Write component tests

Status: ⬜ Not Started

📧 SPRINT 3: EMAIL SENDING + NOTIFICATION FRAMEWORK
Goal: Send emails and build notification system.
3.1 Email & Notifications Module
Documentation:

 contracts/email-notifications-contract.md
 backend/module-email-notifications.md
 frontend/module-email-notifications.md

Backend Development:

 Integrate email provider (SendGrid/Mailgun)
 Create email templates
 Create POST /leads/:id/email endpoint
 Create notification service (abstraction)
 Log emails in communication_event table
 Create email queue processor
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create email send modal
 Display email events in timeline
 Write component tests

Status: ⬜ Not Started

💰 SPRINT 4: QUOTES v1 (MANUAL)
Goal: Create quotes with line items, units, totals.
4.1 Quotes Module (Manual)
Documentation:

 contracts/quotes-contract.md
 backend/module-quotes.md
 frontend/module-quotes.md

Backend Development:

 Create quote table
 Create quote_item table
 Create Quotes module
 Create POST /quotes endpoint
 Create GET /quotes endpoint (paginated, filtered)
 Create GET /quotes/:id endpoint
 Create PATCH /quotes/:id endpoint
 Create DELETE /quotes/:id endpoint
 Create POST /quotes/:id/items endpoint
 Implement quote status (DRAFT → SENT → OPENED → ACCEPTED → REJECTED → EXPIRED)
 Implement validity period (expiration logic)
 Calculate subtotal/tax/total
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create quotes list page (/quotes)
 Create quote detail page (/quotes/:id)
 Create quote builder (multi-step)
 Create line item editor (add/edit/delete rows)
 Create unit selector dropdown
 Display totals (subtotal, tax, total)
 Write component tests
 Write E2E tests

Status: ⬜ Not Started

📄 SPRINT 5: PDF TEMPLATES + BRANDING
Goal: Generate branded PDF quotes.
5.1 PDF Rendering
Documentation:

 contracts/pdf-rendering-contract.md
 backend/module-pdf-rendering.md
 frontend/module-pdf-rendering.md

Backend Development:

 Create tenant_branding table
 Create quote_template table
 Implement PDF rendering (Playwright/Puppeteer)
 Create POST /quotes/:id/generate-pdf endpoint
 Create pdf queue processor
 Store rendered PDF in object storage
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create branding upload page (/settings/branding)
 Create template selector
 Display PDF preview
 Create download PDF button
 Write component tests

Status: ⬜ Not Started

🌐 SPRINT 6: CUSTOMER PORTAL ON SUBDOMAIN + TRACKING
Goal: Public quote view on tenant subdomain.
6.1 Customer Portal
Documentation:

 contracts/customer-portal-contract.md
 backend/module-customer-portal.md
 frontend/module-customer-portal.md

Backend Development:

 Create quote_view_event table (tracking)
 Create GET /public/quotes/:token endpoint
 Create GET /public/quotes/:token/pdf endpoint
 Create POST /public/quotes/:token/events endpoint (tracking)
 Implement quote token generation
 Implement open/download tracking
 Write integration tests
 Generate API documentation

Frontend Development:

 Create public quote view page (/portal/quotes/:token)
 Display quote details (customer-facing)
 Create download PDF button
 Track open event (pixel/API call)
 Track download event
 Write E2E tests

Status: ⬜ Not Started

📊 SPRINT 7: PROJECT CONVERSION + TASKS + PROGRESS
Goal: Convert accepted quotes to projects with tasks.
7.1 Projects Module
Documentation:

 contracts/projects-contract.md
 backend/module-projects.md
 frontend/module-projects.md

Backend Development:

 Create project table
 Create task table
 Create POST /quotes/:id/accept endpoint (convert to project)
 Create GET /projects endpoint
 Create GET /projects/:id endpoint
 Create POST /projects/:id/tasks endpoint
 Create PATCH /projects/:id/tasks/:taskId endpoint
 Implement progress calculation (% tasks complete)
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create projects list page (/projects)
 Create project detail page (/projects/:id)
 Create task list component
 Create progress bar component
 Write component tests

Status: ⬜ Not Started

🔄 SPRINT 8: CHANGE ORDERS v1
Goal: Add change orders to projects.
8.1 Change Orders Module
Documentation:

 contracts/change-orders-contract.md
 backend/module-change-orders.md
 frontend/module-change-orders.md

Backend Development:

 Create change_order table
 Create POST /projects/:id/change-orders endpoint
 Create GET /projects/:id/change-orders endpoint
 Create PATCH /change-orders/:id endpoint
 Implement change order approval workflow
 Update project totals on acceptance
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create change order form
 Display change orders on project page
 Implement approval UI
 Write component tests

Status: ⬜ Not Started

💳 SPRINT 9: INVOICES + PAYMENTS + CREDITS + INVOICE CAP
Goal: Invoice customers with cap enforcement.
9.1 Invoicing Module
Documentation:

 contracts/invoicing-contract.md
 backend/module-invoicing.md
 frontend/module-invoicing.md

Backend Development:

 Create invoice table
 Create payment table
 Create credit table
 Create POST /invoices endpoint
 Create GET /invoices endpoint
 Create POST /payments endpoint
 Create POST /credits endpoint
 Implement invoice cap rule (quote total + change orders - credits)
 Block invoicing if cap exceeded
 Write unit tests (MUST test invoice cap)
 Write integration tests
 Generate API documentation

Frontend Development:

 Create invoices list page
 Create invoice form
 Create payment recording form
 Display invoice cap warning
 Write component tests

Status: ⬜ Not Started

🤖 SPRINT 10: AI QUOTE AGENT v1 (1 INDUSTRY)
Goal: AI-assisted quote generation.
10.1 AI Quote Agent
Documentation:

 contracts/ai-quote-agent-contract.md
 backend/module-ai-quote-agent.md
 frontend/module-ai-quote-agent.md

Backend Development:

 Create ai_agent_profile table
 Create industry task libraries
 Integrate AI provider (OpenAI/Anthropic)
 Create POST /quotes/generate endpoint
 Implement prompt engineering (industry-specific)
 Mark AI-generated quotes as "Draft"
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create AI quote generation UI
 Display draft quote with approval workflow
 Write component tests

Status: ⬜ Not Started

📅 SPRINT 11: SCHEDULING + REMINDERS
Goal: Google Calendar integration + automated reminders.
11.1 Scheduling Module
Documentation:

 contracts/scheduling-contract.md
 backend/module-scheduling.md
 frontend/module-scheduling.md

Backend Development:

 Integrate Google Calendar OAuth
 Create appointment table
 Create POST /appointments endpoint
 Create calendar event creation
 Create reminder queue processor
 Send SMS/email reminders
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create appointment form
 Display calendar integration
 Write component tests

Status: ⬜ Not Started

📈 SPRINT 12: REPORTING + EXPORTS v1
Goal: Basic reports and CSV exports.
12.1 Reporting Module
Documentation:

 contracts/reporting-contract.md
 backend/module-reporting.md
 frontend/module-reporting.md

Backend Development:

 Create GET /reports/leads endpoint
 Create GET /reports/quotes endpoint
 Create GET /reports/projects endpoint
 Create CSV export endpoints
 Implement date range filters
 Write unit tests
 Write integration tests
 Generate API documentation

Frontend Development:

 Create reports dashboard (/reports)
 Create date range picker
 Create export buttons
 Display charts/graphs
 Write component tests

Status: ⬜ Not Started

🚀 POST-MVP (LATER)
Finance Module + Receipt OCR

 Create financial_entry table
 Create expense categories
 Implement receipt OCR
 Create recurring expense automation
 Create P&L reports

Time Clock + Geo Rules

 Create time_clock_event table
 Implement geofencing
 Create clock-in/out endpoints
 Create manual edit workflow (with audit)
 Create payroll export

AI Voice Live Agent

 Integrate voice AI provider
 Implement call routing
 Create qualification flow
 Create scheduling automation
 Create escalation rules


🎯 Success Metrics
Track these throughout development:

 Code coverage >80% (backend services)
 Code coverage >70% (frontend components)
 Zero tenant isolation bugs
 Zero RBAC bypass bugs
 All APIs documented (100%)
 All critical user flows have E2E tests
 Mobile responsive (all pages)
 Page load time <2s (p95)
 API response time <200ms (p95)


📝 Notes

Update this file after completing each module
Use checkboxes to track progress
Add blockers/risks in notes section
Keep this file in git for version control