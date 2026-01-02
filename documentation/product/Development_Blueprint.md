**Development Blueprint (SaaS CRM/ERP + AI Voice/SMS +
Quotes/Projects/Financials/Clock)**

This is the "hand-it-to-the-dev-team" blueprint: architecture, repo
layout, module boundaries, DB/API conventions, queues/events, and a
sprint plan.

**1) Architecture Overview**

**1.1 Approach**

**Modular Monolith (NestJS)** + **MySQL** + **Redis/BullMQ** + **Object
Storage** + **Next.js**.

Why:

-   Multi-tenant consistency is easier.

-   Faster shipping.

-   Clear module boundaries.

-   You can later split heavy workloads (AI voice, PDF rendering) into
    services if needed.

**1.2 High-level components**

1.  **API Backend (NestJS)**

    -   Multi-tenant core

    -   RBAC

    -   Modules (Leads, Quotes, Projects, Finance, Workforce, Reports)

    -   Integrations (Twilio, Calendar, Email)

    -   Public customer portal endpoints (subdomain + token)

2.  **Worker(s) (NestJS command app or separate Node process)**

    -   BullMQ processors:

        -   Twilio webhook processing

        -   Transcription + summarization

        -   PDF generation

        -   Notifications (email/SMS)

        -   Recurring financial entries

        -   Appointment reminders

3.  **Web App (Next.js)**

    -   Business dashboard

    -   Lead/Customer timeline

    -   Quote builder + templates

    -   Project/task views

    -   Finance + receipts

    -   Time clock (mobile-first)

4.  **Customer Portal (Next.js public route)**

    -   https://{tenant}.yourapp.com/q/{token}

    -   View quote, download PDF, open tracking, optional acceptance
        later

5.  **Storage**

    -   MySQL: all business data (tenant-scoped)

    -   Object storage: logos, photos, receipts, quote PDFs

    -   Redis: queues, caching, rate-limits, idempotency keys

**2) Repo & Code Organization**

**2.1 Monorepo recommended**

**Turborepo** or **Nx**:

-   apps/api (NestJS)

-   apps/worker (NestJS/BullMQ processors)

-   apps/web (Next.js business UI)

-   apps/portal (optional separate Next.js app, or inside web)

-   packages/shared (types, zod validators, constants)

-   packages/ui (shared UI components)

-   packages/config (eslint/tsconfig)

**2.2 NestJS module boundaries (apps/api)**

-   core/

    -   auth, sessions, JWT

    -   tenant resolution

    -   rbac/permissions

    -   audit logs

    -   file service

    -   notification service abstraction

    -   webhook idempotency

-   modules/

    -   tenants (business settings, branding, subdomain)

    -   users (users, roles, invitations)

    -   leads (lead, addresses, service requests)

    -   communications (calls/sms/email timeline)

    -   quotes (quote engine, templates, pdf jobs, portal tokens)

    -   projects (tasks, progress, change orders, permits)

    -   billing (invoices, payments, credits)

    -   finance (expenses, recurring, vendors, categories, receipts)

    -   workforce (employees, clock events, geofences)

    -   reports (aggregations, exports)

    -   integrations

        -   twilio

        -   google-calendar

        -   email-provider

**2.3 Worker processors (apps/worker)**

-   processors/

    -   twilioInboundSms

    -   twilioCallEvents

    -   transcriptionJob

    -   aiSummarizeCall

    -   pdfRenderQuote

    -   sendEmail

    -   sendSms

    -   appointmentReminder

    -   recurringFinanceGenerate

-   Same domain services imported from shared package or duplicated
    cleanly.

**3) Multi-Tenant Strategy (Non-negotiable)**

**3.1 Tenant resolution**

-   Tenant identified by:

    -   **Subdomain** for portal + optionally for app:
        {tenant}.yourapp.com

    -   For API: either header (X-Tenant-ID) after auth, or derived from
        request host.

-   Store:

    -   tenant.id

    -   tenant.slug (subdomain key)

**3.2 Database enforcement**

Every business-owned table includes:

-   tenant_id (indexed)

-   composite indexes like (tenant_id, created_at), (tenant_id, status)

Back-end guard:

-   A global Prisma/Nest interceptor ensures every query includes
    tenant_id.

-   Never allow "admin cross-tenant" unless you build a separate
    superadmin console with explicit safeguards.

**3.3 Data isolation rule**

-   All reads/writes must filter by tenant_id.

-   Public portal access never uses tenant_id from client; it's derived
    from:

    -   subdomain + quote token lookup (token maps to quote_id +
        tenant_id)

**4) Database Conventions**

**4.1 Naming**

-   Tables: snake_case, plural or singular is fine if consistent
    (recommend singular: lead, quote)

-   Columns: snake_case

-   Primary keys: id (UUID recommended)

-   Foreign keys: tenant_id, lead_id, etc.

**4.2 Common fields for most tables**

-   id

-   tenant_id

-   created_at, updated_at

-   created_by (user id when relevant)

-   deleted_at for soft delete (only when needed)

**4.3 Audit logging**

Tables that require audit:

-   quotes, quote_items, invoices, payments, credits

-   time clock events and edits

-   financial entries

-   role/permission changes

Audit log table:

-   audit_log:

    -   tenant_id

    -   actor_user_id

    -   entity_type

    -   entity_id

    -   action

    -   before_json, after_json

    -   created_at

    -   ip, user_agent

**5) API Blueprint & Standards**

**5.1 API style**

-   REST JSON for MVP (fast, simple)

-   Versioning: /api/v1/\...

-   Auth: JWT + refresh tokens (or session cookies)

-   Validation: Zod or class-validator (pick one and standardize)

-   OpenAPI/Swagger auto-generated

**5.2 Core patterns**

-   Pagination: cursor-based recommended for large lists

-   Filters: status, channel, assigned user, date range

-   Sorting: sort=created_at:desc

-   Idempotency: required on webhooks and invoice/payment create
    endpoints

**5.3 Public portal endpoints**

-   GET /public/quotes/:token (resolve tenant via host + token)

-   GET /public/quotes/:token/pdf

-   POST /public/quotes/:token/events (open/download tracking)

Portal tracking:

-   quote_view_event table:

    -   event_type: OPEN, DOWNLOAD

    -   timestamp, ip, user_agent

**6) Twilio + Communication Timeline Design**

**6.1 Communication timeline is a first-class module**

Single table pattern:

-   communication_event

    -   tenant_id

    -   lead_id (nullable if unknown)

    -   customer_id (nullable; you can unify lead/customer later)

    -   channel: CALL \| SMS \| EMAIL

    -   direction: IN \| OUT

    -   status: SENT/DELIVERED/FAILED, etc.

    -   external_id (twilio message sid, call sid)

    -   body (sms/email)

    -   recording_url (call)

    -   transcript_text (call)

    -   ai_summary_json

    -   timestamps

**6.2 Lead → Customer transition**

Don't "move data"; **promote the entity**:

-   Option A (recommended): keep lead as the person record and add
    is_customer=true after acceptance.

-   Option B: separate customer table; then you need linking and
    timeline continuity.

Pick A for MVP simplicity:

-   Lead becomes customer upon first accepted quote/project.

**7) Quote Templates + Branding + Subdomain**

**7.1 Branding model**

-   tenant_branding:

    -   logo file id/url

    -   primary/secondary colors

    -   accent color

    -   company name, address, phone

    -   default footer notes

-   Uploaded assets stored in object storage.

**7.2 Templates model**

-   Global templates:

    -   quote_template (system)

-   Tenant selection:

    -   tenant_quote_template (tenant_id + template_id + overrides)

Templates are HTML/CSS skeletons with slots:

-   header logo

-   company info

-   customer info

-   items table

-   totals

-   terms/draw schedule

-   notes

-   images

**7.3 Rendering pipeline**

-   Quote created/updated → "generate pdf" triggers job

-   Worker renders HTML → PDF (Playwright recommended)

-   Store PDF in object storage, save quote.pdf_file_id

-   Public portal serves it

**8) AI Systems Blueprint**

**8.1 AI governance layer**

Per tenant:

-   services offered

-   service areas

-   no-price rule

-   scheduling rules

-   escalation rules

-   tone/script

Store in:

-   tenant_ai_settings + industry_profile + service_catalog

**8.2 AI Voice Agent (MVP path)**

Phase approach:

-   **Phase A**: Twilio call recording + transcription + AI summary
    after call (no live agent yet)

-   **Phase B**: interactive voice agent for qualification + scheduling

This reduces risk and ships faster.

**8.3 AI Quote Agents**

-   ai_agent_profile:

    -   industry type

    -   prompt template

    -   tasks library references

    -   unit defaults

    -   assumptions list

    -   required questions checklist

-   Output always marked as "Draft -- Needs human approval".

Material prices:

-   MVP: tenant-managed material catalog + allowances

-   Later: provider API integration (avoid brittle scraping)

**9) Queues, Events, and Idempotency**

**9.1 BullMQ queues**

-   webhooks

-   notifications

-   pdf

-   ai

-   scheduler

-   exports

**9.2 Idempotency keys**

-   Twilio: use MessageSid / CallSid

-   Store in webhook_event table:

    -   provider

    -   external_id

    -   hash

    -   processed_at

    -   result_status

Any repeated webhook returns 200 but does nothing.

**10) Testing & Quality Gates**

Minimum:

-   Unit tests for:

    -   tenant guard

    -   RBAC

    -   invoice cap rule

    -   time clock geo rule

-   Integration tests for:

    -   Twilio inbound SMS webhook

    -   Quote portal token resolution

    -   PDF generation pipeline

-   E2E tests (Playwright) for:

    -   create lead → send sms → timeline

    -   create quote → view portal → opened status

**11) Deployment Blueprint**

**11.1 Environments**

-   dev

-   staging

-   prod

**11.2 Infrastructure**

-   Nginx reverse proxy

-   Docker compose or Kubernetes (compose is fine early)

-   MySQL managed or self-hosted

-   Redis

-   Object storage (S3 compatible)

-   Secrets manager (or env with strict handling)

**11.3 Subdomains**

Wildcard DNS:

-   \*.yourapp.com → same load balancer\
    App routes based on Host header.

**12) Sprint Plan (12 sprints, realistic MVP-to-value)**

**Sprint 0 --- Platform Foundation**

-   Monorepo setup

-   Auth, RBAC

-   Tenant resolution (subdomain)

-   Audit log base

-   File storage service

-   BullMQ baseline + Redis

**Sprint 1 --- Leads + Addresses + Service Requests (CRUD)**

-   DB + API + UI list/detail

-   Status pipeline

-   Attachments upload

**Sprint 2 --- Communications Timeline + Twilio SMS**

-   Inbound SMS webhook + idempotency

-   Outbound SMS from lead page

-   Timeline UI

**Sprint 3 --- Email sending + Notification framework**

-   Email provider integration

-   Email log in timeline

-   Notification templates

**Sprint 4 --- Quotes v1 (Manual)**

-   Quote + items + units

-   Quote builder UI

-   Quote statuses + validity days

**Sprint 5 --- PDF Templates + Branding**

-   Tenant branding upload

-   Template picker

-   PDF render job

-   Store PDF

**Sprint 6 --- Customer Portal on Subdomain + Tracking**

-   Public quote view + download

-   Open/download tracking

-   Quote "Opened" status

**Sprint 7 --- Project conversion + tasks + progress**

-   Accept quote → project

-   Tasks CRUD

-   Progress bar

**Sprint 8 --- Change Orders v1**

-   Change order create/send/accept

-   Update totals

**Sprint 9 --- Invoices + Payments + Credits + Invoice Cap**

-   Draw schedule

-   Invoice cap enforcement

-   Payment posting

-   Ledger view

**Sprint 10 --- AI Quote Agent v1 (1 industry)**

-   Agent profile + prompt + pipeline

-   Draft quote generation

-   Human approval flow

**Sprint 11 --- Scheduling + Reminders**

-   Google Calendar integration

-   Appointment creation

-   Automated reminder SMS/email

**Sprint 12 --- Reporting + Exports v1**

-   Leads report

-   Quote funnel

-   Project margin basic

-   CSV export framework

**Later (Post-MVP):**

-   Finance module + receipt OCR

-   Time clock + geo rules

-   AI Voice live agent