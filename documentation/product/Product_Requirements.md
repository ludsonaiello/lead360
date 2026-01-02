**Honeydo-style SaaS CRM/ERP for Service Businesses (US)**

**Product Requirements & Functional Specification (v1.0)**

**1) Product Vision**

Build a **multi-tenant SaaS platform** for U.S. service businesses to
manage the entire lifecycle:\
**Lead → Qualification (AI Voice/SMS) → Service Request → Quote →
Project → Tasks → Costs → Invoices → Payments → Financial Reporting**,
plus **employee time clock with geo rules**.

The product is **mobile-first + web-ready**, designed for multi-user
teams per business, with strong permissions, auditing, and exports. The
platform includes multiple AI agents that support call qualification,
scheduling, and quote creation (industry-specific).

**2) Goals & Success Metrics**

**Primary goals**

1.  Centralize lead intake from **phone, SMS, website forms**, and
    manual entry.

2.  Provide **fast quoting**, both manual and AI-assisted.

3.  Convert accepted quotes into **structured projects** with tasks,
    timelines, costs, progress.

4.  Provide **true profitability** per project and overall via financial
    module.

5.  Provide **employee time tracking** (clock in/out) with geofencing
    and audit logs.

6.  Provide reporting/exports across every module.

**Success metrics (examples)**

-   Lead-to-quote conversion rate

-   Quote-to-project conversion rate

-   Average response time to new leads (phone/SMS)

-   Average quote creation time

-   Project gross margin accuracy (charged vs costs)

-   Employee clock-in compliance (geo-rule pass rate)

-   Retention: daily/weekly active usage

**3) Core Principles & Rules**

1.  **Multi-tenant isolation**: Every object belongs to a business
    (tenant). No cross-tenant leakage.

2.  **No pricing by AI voice**: AI agent must never provide specific
    pricing, only qualification + scheduling.

3.  **Audit everything**: Changes to quotes, invoices, time logs, and
    financial entries must be logged.

4.  **Permissions**: Role-based access for sensitive operations (editing
    invoices, time logs, financial).

5.  **Modular design**: Modules can be enabled/disabled per business
    subscription plan.

6.  **Mobile first**: Every action must work on phone (leads, quote
    creation, photo capture, receipts).

7.  **Exports**: Every module supports export with filters.

**4) Tenant Model & Users**

**4.1 Tenant (Business) entity**

Each "Business" (tenant) has:

-   Name, DBA, EIN (optional)

-   Industry type(s) (Painting, Gutter, Asphalt, Cleaning, etc.)

-   Service catalog + default service areas

-   Default labor rates and pricing rules

-   Integrations:

    -   Twilio subaccount or credentials

    -   Google Calendar OAuth (per user and/or per business)

-   Business settings:

    -   Quote numbering format

    -   Allowed measurement units + custom units

    -   Tax settings (optional; often external)

    -   Scheduling rules

    -   AI rules & scripts

    -   Geofence rules for clock-in

**4.2 Users & Roles**

Multi-user per business:

-   **Owner** (full access)

-   **Admin** (almost full, no billing)

-   **Estimator** (leads/quotes/projects, limited financial)

-   **Project Manager** (projects/tasks/change orders)

-   **Bookkeeper** (financial/invoices/payments)

-   **Employee** (time clock, assigned tasks, limited visibility)

-   **Read-only** (reports only)

**Permission rules**

-   Quote edit: Estimator/Admin/Owner

-   Change order approval: Owner/Admin (optional)

-   Invoice creation: Bookkeeper/Admin/Owner

-   Invoice editing after "Sent": restricted (Owner/Admin only)

-   Time log editing: Admin/Owner; edits must be audit-logged

-   Financial entries: Bookkeeper/Admin/Owner

-   Integration settings: Owner/Admin

**4.3 Multi-business login (optional future)**

A single user may belong to multiple businesses with different roles.

**5) Lead Intake & Qualification Module**

**5.1 Lead Sources**

-   Phone calls (Twilio Voice)

-   SMS (Twilio Messaging)

-   Website form (API endpoint / embedded form)

-   Manual entry

**5.2 Lead Data Model (Minimum)**

Lead (person/company):

-   Full name

-   Phone number

-   Email (optional)

-   SMS consent (boolean + consent timestamp + source)

-   Preferred contact method

-   Tags (custom)

-   Notes

-   Status pipeline (New → Qualified → Unqualified → Converted → Lost)

-   Lead owner (assigned user)

-   Channel/source (Call/SMS/Form/Manual)

-   Communication log (calls, sms, emails)

-   Multiple addresses:

    -   Address line, city, state, zip

    -   Address type: Home, Rental, Business, Other

    -   Default address flag

**5.3 Service Request (separate entity)**

Rule: A lead can have multiple addresses and multiple service requests.\
Service Request includes:

-   Lead ID

-   Address ID

-   Requested service category (e.g., Painting, Gutter, Asphalt)

-   Description of problem/request

-   Attachments/photos

-   Priority/urgency

-   Desired time window

-   Status: New → Scheduled Visit → Awaiting Quote → Quoted → Converted
    → Closed

**5.4 AI Voice Agent (Call Qualification)**

**Purpose**

Answer inbound calls, qualify the lead, capture data, and schedule an
appointment.

**Hard rules**

-   **Never quote a price** (no dollar amounts, no estimates, no ranges
    that sound like a quote)

-   Must be transparent it's an automated assistant if required by
    law/policy (implementation decision)

-   Must respect business-specific rules:

    -   Services offered

    -   Service area (zip/city)

    -   Operating hours

    -   Minimum job size (if configured)

    -   Availability rules

**Qualification flow (example)**

1.  Greeting + identify business

2.  Ask for service type

3.  Confirm address + zip (service area validation)

4.  Collect name, phone, email

5.  Ask timeline/urgency

6.  Ask job context (e.g., size, material, symptoms)

7.  Confirm SMS permission

8.  Offer scheduling options and book appointment

9.  Confirm appointment and next steps (visit for measurements,
    estimator will follow up)

**Scheduling logic**

-   Connect to Google Calendar (preferred)

-   Or built-in calendar module (fallback)

-   Must check availability windows + travel buffer rules (optional)

-   Creates calendar event:

    -   Title: "Estimate Visit -- \[Lead Name\]"

    -   Address included

    -   Notes summary

    -   Attendee: assigned estimator (if any)

-   Save appointment back to Service Request and Lead timeline

**Call outcomes**

-   Booked appointment

-   Needs callback (create task for staff)

-   Not serviceable (out of area/service not offered)

-   Missed call fallback: send SMS follow-up if consent or if allowed

**5.5 AI SMS Agent (Optional)**

-   Replies to inbound SMS for qualification

-   Can send appointment confirmations, reminders, follow-ups

-   Must follow same "no pricing" rule

**5.6 Communication Log**

Every call/SMS logged:

-   direction (in/out)

-   timestamps

-   recording URL (calls)

-   transcript (calls)

-   AI summary (structured)

-   sentiment/urgency score (optional)

-   linked to Lead + Service Request

**6) Quote Module (Manual + AI)**

**6.1 Quote Entity**

A quote is created from a Service Request.\
Quote includes:

-   Quote number (per business numbering system)

-   Lead snapshot (name, contact, address)

-   Service Request link

-   Estimator (user or custom estimator profile)

-   Status:

    -   Draft

    -   Ready to Send

    -   Sent

    -   Opened (tracked via link pixel)

    -   Accepted

    -   Rejected

    -   Expired

-   Validity period (custom days: 5/10/30/etc.)

-   Global description (scope summary)

-   Global notes (customer-facing)

-   Internal notes (staff only)

-   Draw schedule (payment terms)

-   Attachments/photos

-   Line items list

-   Subtotal, tax (optional), total

-   Profit modifiers:

    -   Overhead (fixed or %)

    -   Contingency (fixed or %)

    -   Discount (fixed or %)

**Rules**

-   Quote can be edited freely in Draft.

-   Once "Sent", edits either:

    -   create a new version (recommended), or

    -   require "Owner/Admin" permission and log it.

-   Acceptance can be:

    -   manual toggle by staff, or

    -   customer acceptance flow (e-sign later).

**6.2 Quote Line Item Model**

Each item includes:

-   Title

-   Description

-   Category: Labor / Material / Subcontractor / Equipment / Other

-   Quantity

-   Unit of measure (global list + business custom units)

-   Rate (unit price)

-   Cost fields (optional, for internal margin):

    -   Estimated labor cost

    -   Estimated material cost

    -   Estimated subcontractor cost

-   Total (quantity \* rate)

Units examples:

-   each, hour, day, week, month

-   sqft, linear ft, cubic yard, cubic meter

-   gallon, liter

-   bag, box, board, sheet, etc.

**6.3 AI Quote Agent (Text-to-Quote)**

**Purpose**

Generate quote line items and scope text from structured input + notes.

**Inputs**

-   Business industry profile

-   Labor rate rules (per business)

-   Typical tasks library for that industry

-   Service request notes + measurements

-   Photos (future: vision)

-   Market pricing range (low/high) by region and job type
    (configurable)

-   Material pricing:

    -   "Material price fetch" from Home Depot / Lowe's (see below)

**Outputs**

-   Global scope description

-   Suggested line items with quantities/units

-   Suggested materials list

-   Suggested internal cost estimates

-   Suggested timeline/duration (optional)

-   Assumptions list (for transparency)

**Hard rules**

-   Never fabricate exact material prices as facts.

-   If fetching fails, AI must produce:

    -   "Estimated material allowance" and mark it clearly.

-   Quote should include disclaimers for price variability.

**Industry-specific agents**

System supports multiple agent templates:

-   Painting Quote Agent

-   Gutter Quote Agent

-   Cleaning Quote Agent

-   Asphalt Quote Agent

-   etc.

Each template includes:

-   Typical tasks library

-   Common measurement assumptions

-   Common exclusions/inclusions

-   Required clarification questions

**Material price fetch requirement**

The spec says: "request updated price for materials on Home Depot and
Lowe's website."\
Implementation options (developer decision):

1.  Use publicly available product APIs (if available) or affiliate APIs

2.  Use approved third-party price data providers

3.  If scraping is used, it must be reliable and compliant (risk)

4.  Fallback: manually maintained material catalog per business

**Rule**: system must not depend on fragile scraping for core MVP.

**6.4 Quote Send/Delivery**

Quote can be:

-   Sent by system (email + optional SMS link)

-   Downloaded as PDF for manual sending

Tracking:

-   "Opened" status when customer views link

-   Versioning: customer sees latest sent version

**7) Project Module (Post-Acceptance)**

**7.1 Project Creation**

When quote is Accepted:

-   Create Project from Quote

-   Copy line items as baseline "scope"

-   Generate tasks:

    -   either from quote items directly

    -   or from industry task templates

**Project fields**

-   Project number

-   Customer & address

-   Start date, target completion date (optional)

-   Status: Planned → In Progress → On Hold → Completed → Canceled

-   Permit required? (yes/no)

-   Permit number (if applicable)

-   Assigned project manager

-   Attachments (contracts, permits, photos)

-   Progress % (computed)

**7.2 Task Management**

Each project has tasks:

-   Title, description

-   Assigned to user/team

-   Estimated duration (days/hours)

-   Dependencies (optional)

-   Status: Not Started → In Progress → Blocked → Done

-   Notes & photos

-   Costs per task:

    -   Labor cost entries

    -   Material receipts/items

    -   Subcontractor invoices

    -   Equipment rentals

**Progress calculation rules**

-   Default: progress = (# tasks Done / \# total tasks)

-   Optionally weighted by estimated duration or cost (future
    enhancement)

**7.3 Change Orders**

Change orders add scope + price after acceptance.

Change order includes:

-   Items added/removed

-   Customer-facing description

-   Internal notes

-   Status: Draft → Sent → Accepted/Rejected

-   Once accepted, it:

    -   updates project contract total

    -   updates invoice allowable limits

**Rule**: Change orders must be traceable and included in totals.

**7.4 Materials List (per project)**

Project can include a materials list:

-   Item name

-   Quantity/unit

-   Estimated unit cost

-   Supplier (Home Depot, Lowe's, Other)

-   Purchased? yes/no

-   Linked purchase orders (if used)

**8) Invoicing, Payments, Credits, Purchase Orders**

**8.1 Invoices**

Invoices generated from:

-   Draw schedule milestones (deposit, progress payment, final)

-   Or manual invoice based on approved amount

Invoice fields:

-   Invoice number

-   Project reference

-   Amount

-   Due date

-   Status: Draft → Sent → Paid → Partial → Overdue → Voided

-   Payment method fields (record only)

-   PDF + email send

**Critical rule: invoice cap**

System must prevent invoicing more than:\
**Quote total + accepted change orders -- credits applied**

If user attempts to invoice higher:

-   Block action and display allowable remaining amount.

**8.2 Payments**

Payments can be recorded:

-   Date, amount

-   Method (check, cash, ACH, card external)

-   Reference number

-   Notes

-   Attachment (photo of check)

Updates invoice balance + project "realized revenue".

**8.3 Credits**

Customer credits (goodwill, refunds, etc.):

-   Credit amount

-   Reason

-   Applied to invoice(s)

-   Credit cannot exceed outstanding

**8.4 Purchase Orders (Optional MVP+)**

POs track purchases:

-   Vendor

-   Items

-   Expected total

-   Status: Draft → Ordered → Received → Closed

-   Links to project and/or specific task

-   PO can later be reconciled with receipt capture

**9) Financial Module**

**9.1 Purpose**

Track the financial reality of the business:

-   Pipeline forecast (quotes)

-   Project forecast (accepted)

-   Realized revenue (payments)

-   Costs (project + overhead)

-   Profitability per project and overall

**9.2 Financial Categories**

-   Project costs:

    -   Labor

    -   Materials

    -   Subcontractors

    -   Equipment

-   Overhead / Operating expenses:

    -   Insurance

    -   Office

    -   Vehicle maintenance

    -   Tools

    -   Marketing

    -   Taxes

    -   Payroll overhead (optional)

**9.3 Financial Entries**

Each entry:

-   Date

-   Amount

-   Type: Income / Expense

-   Category

-   Project link (optional)

-   Task link (optional)

-   Vendor/payee

-   Notes

-   Attachment(s) (receipt)

**9.4 Recurring Costs**

Recurring expense rule:

-   Frequency: weekly/monthly/annual

-   Auto-create entries on schedule

-   Editable and auditable

**9.5 Receipt Capture (Mobile)**

User can take photo of receipt:

-   Save as attachment

-   Optional OCR (future)

-   Prompt user to categorize + link to project/task

-   Store raw + processed data

**10) Time Clock / Workforce Module**

**10.1 Employee Setup**

Employee entity:

-   Linked to user (or separate worker profile)

-   Hourly rate

-   Overtime rules (yes/no, threshold)

-   Allowed clock-in zones:

    -   Anywhere

    -   Only specific addresses

    -   Only active job sites assigned

-   Break policy

**10.2 Clock Events**

Clock entry includes:

-   Clock in timestamp

-   Clock out timestamp

-   Break(s) start/stop

-   Geo coordinates at clock-in/out

-   Associated job/project/task (required if configured)

-   Flags: outside geofence, manual edit, late entry

**Rules**

-   If business restricts locations:

    -   app checks GPS at clock-in

    -   blocks clock-in if outside allowed area (or allow with warning +
        admin approval)

-   Manual adjustments allowed only for Admin/Owner:

    -   Must store original value + edited value + reason + editor
        user + timestamp

**10.3 Payroll Export**

System calculates:

-   Regular hours

-   Overtime hours

-   Total pay estimate

Export options:

-   CSV per pay period

-   Filters by employee/project

**11) Reporting & Export Module**

**11.1 Reporting Areas**

**Leads**

-   Leads by date range

-   Leads by channel (call/sms/form)

-   Leads by status

-   Call outcomes (booked vs not)

-   Conversion metrics

**Quotes**

-   Quotes created/sent/opened/accepted

-   Acceptance rate by estimator

-   Average quote value

**Projects**

-   Active projects

-   Completion progress

-   Project profitability (revenue vs costs)

-   Change orders volume

**Financial**

-   Monthly P&L (internal)

-   Expense breakdown by category

-   Revenue realized vs forecast

**Workforce**

-   Hours by employee

-   Hours by project

-   Overtime totals

-   Geo violations

**11.2 Export Requirements**

Exports must support:

-   Column selection

-   Date range filters

-   CSV + Excel output

-   Basic PII control (who can export contact info)

Minimum export lists:

-   Leads export: name, phone, email, address, city, zip, source, status

-   Financial export: date, amount, category, project, vendor, notes

**12) AI Capabilities (All Agents)**

**12.1 AI Agent Governance**

Every business has AI settings:

-   Services offered list

-   Service area rules

-   Business hours

-   "No price disclosure" policy

-   Script tone (formal/friendly)

-   Safety rules (no harassment, no sensitive info)

-   Escalation rules (when to handoff to human)

**12.2 AI Voice Agent Capabilities**

-   Answer inbound calls

-   Qualify lead

-   Schedule appointment

-   Summarize call into structured fields

-   Create tasks for staff follow-up

**12.3 AI Quote Agent Capabilities**

-   Convert notes/measurements into draft quote

-   Generate line items + descriptions

-   Suggest materials list

-   Ask clarification questions if missing info

-   Use business labor rates and templates

**12.4 AI Task/Project Assistant (Future)**

-   Suggest task sequences

-   Identify permit needs based on scope

-   Suggest timelines

-   Risk alerts (delays, missing materials)

**13) Integration Requirements**

**13.1 Twilio Integration**

-   Voice:

    -   Inbound routing to AI Voice Agent

    -   Recording

    -   Transcription

-   SMS:

    -   Inbound/outbound logging

    -   Templates for follow-ups

-   Per tenant:

    -   Twilio subaccount recommended for isolation and billing

**13.2 Google Calendar Integration**

-   OAuth connection

-   Read availability

-   Create events

-   Update/cancel events

-   Sync event IDs to Service Requests

**13.3 Email/SMS Delivery**

-   Email sending (SendGrid/Mailgun/etc.)

-   SMS via Twilio

-   Track deliverability logs

**14) System-Wide Non-Functional Requirements**

**14.1 Security & Compliance**

-   Tenant data isolation

-   Encryption at rest for sensitive fields

-   Secure storage for Twilio and OAuth tokens

-   Role-based access control

-   Audit logs

-   GDPR-like data export/delete (optional, good practice)

-   Recording consent considerations (state-specific; implement
    disclaimers)

**14.2 Performance**

-   Lead creation must be fast

-   Calls must not lag (low latency)

-   Quote PDFs generated quickly

**14.3 Reliability**

-   Retry queues for Twilio webhooks

-   Background jobs for transcripts, summaries, PDF generation

**14.4 Logging & Monitoring**

-   Central logs per tenant

-   Error tracking

-   Webhook debugging dashboard

**15) Suggested MVP Scope (Build in Phases)**

**Phase 1 (MVP Sellable)**

1.  Multi-tenant + roles

2.  Leads + service requests

3.  Twilio SMS logging + basic inbound routing

4.  Calendar scheduling (Google)

5.  Manual quotes + PDF + send tracking

6.  Convert quote → project basic

7.  Basic reporting + exports

**Phase 2**

1.  AI voice agent qualification

2.  AI quote agent for 1--2 industries

3.  Project tasks + progress bar

4.  Change orders

5.  Invoice cap rules + payments recording

**Phase 3**

1.  Financial module + receipt capture

2.  Time clock + geo rules

3.  Advanced reports dashboards

**16) Developer Task Breakdown (High-Level Epics)**

1.  **Platform foundation**

    -   Multi-tenant schema, auth, roles, permissions, audit logs

2.  **Leads & service requests**

    -   CRUD, status pipeline, address model, attachments

3.  **Twilio integration**

    -   SMS webhooks, call logs, recordings, transcripts storage

4.  **Calendar integration**

    -   OAuth, availability query, event creation/update

5.  **Quote engine**

    -   Line items, units, templates, PDF, send tracking, versioning

6.  **AI voice agent**

    -   Conversation flow, extraction, safety rules, escalation

7.  **AI quote agent**

    -   Industry templates, generation pipeline, approval workflow

8.  **Projects**

    -   Convert from quote, tasks, progress, change orders, permit
        fields

9.  **Invoices/payments/credits**

    -   Invoice rules + cap enforcement, payment posting

10. **Financials**

-   Expenses/income, categories, recurring costs, receipts

11. **Time clock**

-   Geo rules, clock events, manual edits + audit

12. **Reports & exports**

-   Filters, KPI dashboards, CSV/Excel

**17) Open Decisions (Developer Should Propose)**

-   Tech stack (Node/NestJS + MySQL is fine)

-   PDF generation (server-side)

-   AI provider + voice architecture

-   Material pricing approach (API vs catalog vs scraping risk)

-   Mobile approach:

    -   Responsive web app first

    -   Optional native app later (Capacitor/React Native)