-----------------------------------------------------------------------
  Lead360 Platform

  **Project Management Module**

  *Feature Contract --- Phase 1*

  Version 2.0 \| Status: Approved for Development \| Lead360 Platform
  -----------------------------------------------------------------------

  ---------------- ------------------------------------------------------
  **Module**       projects

  **Version**      2.0 --- Masterclass Edition

  **Status**       Approved for Development

  **Working Dir**  /var/www/lead360.app/api/src/modules/projects/

  **Depends On**   Quote Module, Lead Module, Communications Module, Auth
                   Module, Audit Module, Files Module

  **Financial      Gate 1, Gate 2, Gate 3 (defined in Section 10)
  Gates**          

  **Sprint         Sprints 01--35 (Backend) + 36--40 (Frontend)
  Coverage**       

  **Architect**    Lead360 Product --- PM & Technical Spec
  ---------------- ------------------------------------------------------

**1. Platform Architecture Reference**

Every sprint agent must embed these patterns. Do not re-derive from
outside files.

**1.1 Verified Codebase Patterns**

  -----------------------------------------------------------------------
  **TenantId Decorator**

  -----------------------------------------------------------------------

> Path: api/src/modules/auth/decorators/tenant-id.decorator.ts
>
> Import: import { TenantId } from
> \"../../auth/decorators/tenant-id.decorator\";
>
> Usage: \@TenantId() tenantId: string (controller parameter)

  -----------------------------------------------------------------------
  **AuditLoggerService.logTenantChange() --- Exact Signature**

  -----------------------------------------------------------------------

> import { AuditLoggerService } from
> \"../../audit/services/audit-logger.service\";
>
> Module: AuditModule from \"../audit/audit.module\"
>
> logTenantChange({
>
> action: \"created\" \| \"updated\" \| \"deleted\" \| \"accessed\",
>
> entityType: string,
>
> entityId: string,
>
> tenantId: string,
>
> actorUserId: string,
>
> before?: object,
>
> after?: object,
>
> metadata?: object,
>
> description: string,
>
> }): Promise\<void\>

  -----------------------------------------------------------------------
  **EncryptionService --- AES-256-GCM**

  -----------------------------------------------------------------------

> Path: api/src/core/encryption/encryption.service.ts
>
> Module: EncryptionModule from
> \"../../core/encryption/encryption.module\"
>
> Env: ENCRYPTION_KEY (64-char hex string)
>
> encrypt(plaintext: string): string → JSON {iv, encrypted, authTag} ---
> store in TEXT column
>
> decrypt(ciphertext: string): string

  -----------------------------------------------------------------------
  **FilesService.uploadFile() --- Exact Signature**

  -----------------------------------------------------------------------

> import { FilesService } from \"../../files/files.service\";
>
> Module: FilesModule from \"../files/files.module\"
>
> uploadFile(
>
> tenantId: string,
>
> userId: string,
>
> file: Express.Multer.File,
>
> uploadDto: { category: FileCategory, entity_type?: string, entity_id?:
> string }
>
> ): Promise\<{
>
> message: string, file_id: string, url: string,
>
> file: { id, file_id, original_filename, mime_type, size_bytes,
>
> category, url, has_thumbnail, is_optimized, width, height, created_at
> }
>
> }\>

  -----------------------------------------------------------------------
  **FileCategory Enum Values**

  -----------------------------------------------------------------------

> quote \| invoice \| license \| insurance \| logo \| contract \|
> receipt \| photo \| report \| signature \| misc

  -----------------------------------------------------------------------
  **File Storage --- LOCAL NGINX. NEVER S3.**

  -----------------------------------------------------------------------

> Stored at:
> /var/www/lead360.app/uploads/public/{tenant_id}/{images\|files}/{uuid}.ext
>
> Served at: /public/{tenant_id}/{images\|files}/{uuid}.ext (Nginx, no
> API proxy)
>
> On reads: return url from file table --- never reconstruct it
>
> Rule: NEVER write S3, object storage, cloud storage, or bucket in any
> sprint

  -----------------------------------------------------------------------
  **Standard Pagination Response --- Mandatory All List Endpoints**

  -----------------------------------------------------------------------

> { \"data\": \[\...\], \"meta\": { \"total\": 150, \"page\": 1,
> \"limit\": 20, \"totalPages\": 8 } }

  -----------------------------------------------------------------------
  **Guards & Decorators --- Every Authenticated Endpoint**

  -----------------------------------------------------------------------

> \@UseGuards(JwtAuthGuard, RolesGuard)
>
> \@Roles(\"Owner\", \"Admin\", \"Manager\") // adjust per endpoint
>
> JwtAuthGuard: import { JwtAuthGuard } from
> \"../auth/guards/jwt-auth.guard\";
>
> RolesGuard: import { RolesGuard } from \"../auth/guards/roles.guard\";
>
> \@Roles(): import { Roles } from
> \"../auth/decorators/roles.decorator\";

  -----------------------------------------------------------------------
  **Standard Module Structure**

  -----------------------------------------------------------------------

> api/src/modules/{module}/
>
> ├── {module}.module.ts
>
> ├── controllers/
>
> │ └── {entity}.controller.ts
>
> ├── services/
>
> │ └── {entity}.service.ts
>
> └── dto/
>
> ├── create-{entity}.dto.ts
>
> ├── update-{entity}.dto.ts
>
> └── {entity}-response.dto.ts

  -----------------------------------------------------------------------
  **Testing Conventions**

  -----------------------------------------------------------------------

> Unit tests: \*.spec.ts placed NEXT TO the tested file in src/modules/
>
> Integration: api/test/{feature}.e2e-spec.ts
>
> Coverage: Services \>80%, Controllers \>70%, critical logic 100%
>
> Credentials: contact@honeydo4you.com / 978@F32c

  -----------------------------------------------------------------------
  **Sensitive Field Masking Rules**

  -----------------------------------------------------------------------

> SSN: \*\*\*-\*\*-1234 (last 4 digits visible)
>
> ITIN: \*\*\*-\*\*-1234
>
> Bank account: \*\*\*\*1234 (last 4 digits visible)
>
> Bank routing: \*\*\*\*1234
>
> DL number: \*\*\*\*5678
>
> Rule: NEVER return raw encrypted values. Reveal endpoint requires
> Owner/Admin + audit log.

**2. Purpose**

This module manages the full lifecycle of construction projects derived
from accepted quotes. It covers project creation, task management, crew
and subcontractor coordination, scheduling, dependency tracking,
communications, calendar integration, documentation, compliance
monitoring, and the customer-facing project portal.

+-----------------------------------------------------------------------+
| **Module Boundary**                                                   |
|                                                                       |
| The Project Management Module consumes the Financial Module           |
| (project-scoped subset) through defined service interfaces called     |
| Financial Gates. It does not implement financial logic internally.    |
+-----------------------------------------------------------------------+

**3. Scope**

**3.1 In Scope --- Phase 1**

-   Project entity (creation from accepted quote and standalone)

-   Project file attachments (permits, blueprints, contracts, photos)
    via FilesService

-   Project templates (tenant-defined reusable task lists)

-   Crew Member register (system + external profiles, sensitive field
    encryption)

-   Subcontractor register (dedicated entity, separate from vendor)

-   Subcontractor compliance monitoring (insurance expiry alerts)

-   Task engine (CRUD, status transitions, assignment, scheduling)

-   Task dependency types: Finish-to-Start, Start-to-Start,
    Finish-to-Finish

-   Delay detection with cascade decision (PM-controlled, not automatic)

-   Project Log system (structured daily + random entries,
    public/private, photos/files)

-   Photo Progress Timeline (per task/date, portal-visible)

-   SMS from task context (existing CommunicationsModule integration)

-   Calendar events per task (Google Calendar + internal, multiple
    events per task)

-   Permit and Inspection tracking per project

-   Change Order initiation from task (links to existing CO module)

-   Project Completion Checklist (tenant-defined templates)

-   Punch List (sub-list under completion checklist)

-   Customer Portal (email login, bcrypt password, portal JWT,
    per-customer across all projects)

-   Dashboard: Gantt view + List view, filters, financial summary per
    project

-   Architecture reservations: financing integration data layer, clockin
    system hooks

**3.2 Out of Scope --- Phase 1**

-   Material Purchase Order Tracker (Phase 2)

-   Project Health Score automated calculation (Phase 2)

-   Automated milestone SMS (Phase 2)

-   Full Financial Module (separate contract)

-   Budget Forecast vs. Actuals chart (Phase 2 --- after Financial
    Module complete)

-   AI-generated project summaries (future)

-   Photo Before/After comparison view (future)

**4. Database Entities**

**All entities require tenant_id on every row. All queries must include
WHERE tenant_id = ? --- non-negotiable. No cross-tenant data is ever
returned.**

+-----------------------------------------------------------------------+
| **project**                                                           |
|                                                                       |
| Core project record. Created from accepted quote or standalone.       |
+-----------------------------------------------------------------------+

  --------------------------------------------------------------------------------------------------
  **Field**                **Type**        **Req**   **Default**   **Notes**
  ------------------------ --------------- --------- ------------- ---------------------------------
  id                       uuid            yes       uuid()        PK

  tenant_id                uuid            yes       ---           FK → tenant. Required on all
                                                                   queries.

  quote_id                 uuid            no        null          FK → quote. Null if standalone
                                                                   project.

  lead_id                  uuid            no        null          FK → lead. Set when created from
                                                                   quote.

  project_number           varchar(50)     yes       sequence      Auto-generated per tenant.
                                                                   Format: PRJ-{year}-{0042}

  name                     varchar(200)    yes       ---           

  description              text            no        null          Internal project description

  status                   enum            yes       planned       planned, in_progress, on_hold,
                                                                   completed, canceled

  start_date               date            no        null          Scheduled start. Can be future
                                                                   date.

  target_completion_date   date            no        null          

  actual_completion_date   date            no        null          Set automatically when status →
                                                                   completed

  permit_required          boolean         yes       false         

  assigned_pm_user_id      uuid            no        null          FK → user

  contract_value           decimal(12,2)   no        null          Copied from quote.total on
                                                                   creation. Reserved for financing.

  estimated_cost           decimal(12,2)   no        null          Copied from quote internal cost
                                                                   estimate. Reserved for margin
                                                                   calc.

  progress_percent         decimal(5,2)    yes       0.00          Computed: done_tasks /
                                                                   total_tasks \* 100

  is_standalone            boolean         yes       false         true if not created from quote

  portal_enabled           boolean         yes       true          default true when created from
                                                                   quote

  deletion_locked          boolean         yes       false         Set true when project created
                                                                   from quote. Blocks quote
                                                                   deletion.

  notes                    text            no        null          Internal PM notes

  created_by_user_id       uuid            yes       ---           FK → user

  created_at               datetime        yes       now()         Auto

  updated_at               datetime        yes       now()         Auto
  --------------------------------------------------------------------------------------------------

Indexes: (tenant_id, status) \| (tenant_id, created_at) \| (tenant_id,
lead_id) \| (tenant_id, assigned_pm_user_id)

+-----------------------------------------------------------------------+
| **project_task**                                                      |
|                                                                       |
| Individual task within a project. Can be generated from quote_items   |
| or added manually.                                                    |
+-----------------------------------------------------------------------+

  --------------------------------------------------------------------------------------------------
  **Field**                 **Type**       **Req**   **Default**   **Notes**
  ------------------------- -------------- --------- ------------- ---------------------------------
  id                        uuid           yes       uuid()        PK

  tenant_id                 uuid           yes       ---           Tenant isolation

  project_id                uuid           yes       ---           FK → project

  quote_item_id             uuid           no        null          FK → quote_item. Null if manually
                                                                   added.

  title                     varchar(200)   yes       ---           

  description               text           no        null          

  status                    enum           yes       not_started   not_started, in_progress,
                                                                   blocked, done

  estimated_duration_days   int            no        null          

  estimated_start_date      date           no        null          

  estimated_end_date        date           no        null          

  actual_start_date         date           no        null          

  actual_end_date           date           no        null          

  is_delayed                boolean        yes       false         Computed: actual \> estimated OR
                                                                   today \> estimated_end and not
                                                                   done

  order_index               int            yes       ---           For manual ordering

  category                  enum           no        null          labor, material, subcontractor,
                                                                   equipment, other

  notes                     text           no        null          Internal task notes

  created_by_user_id        uuid           yes       ---           

  deleted_at                datetime       no        null          Soft delete

  created_at                datetime       yes       now()         Auto

  updated_at                datetime       yes       now()         Auto
  --------------------------------------------------------------------------------------------------

Indexes: (tenant_id, project_id) \| (tenant_id, project_id, status) \|
(tenant_id, project_id, order_index)

+-----------------------------------------------------------------------+
| **task_assignee**                                                     |
|                                                                       |
| Polymorphic assignee record. One row per assignee per task.           |
+-----------------------------------------------------------------------+

  -------------------------------------------------------------------------------------------
  **Field**             **Type**    **Req**   **Default**   **Notes**
  --------------------- ----------- --------- ------------- ---------------------------------
  id                    uuid        yes       uuid()        PK

  tenant_id             uuid        yes       ---           Tenant isolation

  task_id               uuid        yes       ---           FK → project_task

  assignee_type         enum        yes       ---           crew_member, subcontractor, user

  crew_member_id        uuid        no        null          FK → crew_member (when type =
                                                            crew_member)

  subcontractor_id      uuid        no        null          FK → subcontractor (when type =
                                                            subcontractor)

  user_id               uuid        no        null          FK → user (when type = user)

  assigned_at           datetime    yes       now()         Auto

  assigned_by_user_id   uuid        yes       ---           
  -------------------------------------------------------------------------------------------

Indexes: (tenant_id, task_id) \| (tenant_id, crew_member_id) \|
(tenant_id, subcontractor_id)

+-----------------------------------------------------------------------+
| **task_dependency**                                                   |
|                                                                       |
| Defines prerequisite relationships between tasks. No circular         |
| dependencies allowed.                                                 |
+-----------------------------------------------------------------------+

  ------------------------------------------------------------------------------------------
  **Field**            **Type**    **Req**   **Default**   **Notes**
  -------------------- ----------- --------- ------------- ---------------------------------
  id                   uuid        yes       uuid()        PK

  tenant_id            uuid        yes       ---           Tenant isolation

  task_id              uuid        yes       ---           FK → project_task (the dependent
                                                           task)

  depends_on_task_id   uuid        yes       ---           FK → project_task (the
                                                           prerequisite)

  dependency_type      enum        yes       ---           finish_to_start, start_to_start,
                                                           finish_to_finish

  created_by_user_id   uuid        yes       ---           

  created_at           datetime    yes       now()         Auto
  ------------------------------------------------------------------------------------------

Constraint: task_id and depends_on_task_id must belong to the same
project_id.

Constraint: No circular dependencies --- validate with DFS traversal
before insert.

Indexes: (tenant_id, task_id) \| (tenant_id, depends_on_task_id)

+-----------------------------------------------------------------------+
| **crew_member**                                                       |
|                                                                       |
| Crew member profile. Sensitive fields encrypted at rest using         |
| EncryptionService.                                                    |
+-----------------------------------------------------------------------+

  -----------------------------------------------------------------------------------------------------------
  **Field**                          **Type**       **Req**   **Default**   **Notes**
  ---------------------------------- -------------- --------- ------------- ---------------------------------
  id                                 uuid           yes       uuid()        PK

  tenant_id                          uuid           yes       ---           Tenant isolation

  user_id                            uuid           no        null          FK → user. Reserved for clockin
                                                                            system integration (Field role).

  first_name                         varchar(100)   yes       ---           

  last_name                          varchar(100)   yes       ---           

  email                              varchar(255)   no        null          

  phone                              varchar(20)    no        null          

  address_line1                      varchar(200)   no        null          

  address_line2                      varchar(100)   no        null          

  address_city                       varchar(100)   no        null          

  address_state                      varchar(2)     no        null          2-letter state code

  address_zip                        varchar(10)    no        null          

  date_of_birth                      date           no        null          

  ssn_encrypted                      text           no        null          EncryptionService. Never return
                                                                            raw. Mask: \*\*\*-\*\*-1234

  itin_encrypted                     text           no        null          EncryptionService. Never return
                                                                            raw. Mask: \*\*\*-\*\*-1234

  has_drivers_license                boolean        no        null          

  drivers_license_number_encrypted   text           no        null          EncryptionService. Never return
                                                                            raw. Mask: \*\*\*\*5678

  default_hourly_rate                decimal(8,2)   no        null          

  weekly_hours_schedule              int            no        null          e.g. 36, 40, 50

  overtime_enabled                   boolean        yes       false         

  overtime_rate_multiplier           decimal(4,2)   no        null          e.g. 1.5 = time-and-a-half

  default_payment_method             enum           no        null          cash, check, bank_transfer,
                                                                            venmo, zelle

  bank_name                          varchar(200)   no        null          

  bank_routing_encrypted             text           no        null          EncryptionService. Mask:
                                                                            \*\*\*\*1234

  bank_account_encrypted             text           no        null          EncryptionService. Mask:
                                                                            \*\*\*\*1234

  venmo_handle                       varchar(100)   no        null          

  zelle_contact                      varchar(100)   no        null          Phone or email used for Zelle

  profile_photo_file_id              uuid           no        null          FK → file table. URL retrieved
                                                                            from file record via
                                                                            FilesService.

  notes                              text           no        null          

  is_active                          boolean        yes       true          

  created_by_user_id                 uuid           yes       ---           

  created_at                         datetime       yes       now()         Auto

  updated_at                         datetime       yes       now()         Auto
  -----------------------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **ENCRYPTION RULE**                                                   |
|                                                                       |
| SSN, ITIN, DL number, bank_routing, bank_account must be encrypted    |
| before storage using EncryptionService.encrypt(). Standard GET        |
| endpoints return masked values only. The reveal endpoint (GET         |
| /crew/:id/reveal/:field) requires Owner/Admin role and must call      |
| logTenantChange() with action: \"accessed\".                          |
+-----------------------------------------------------------------------+

Indexes: (tenant_id, is_active) \| (tenant_id, user_id) \| (tenant_id,
created_at)

+-----------------------------------------------------------------------+
| **subcontractor**                                                     |
|                                                                       |
| Subcontractor business profile. Separate entity from vendor register. |
| compliance_status is always computed --- never stored static.         |
+-----------------------------------------------------------------------+

  --------------------------------------------------------------------------------------------------
  **Field**                 **Type**       **Req**   **Default**   **Notes**
  ------------------------- -------------- --------- ------------- ---------------------------------
  id                        uuid           yes       uuid()        PK

  tenant_id                 uuid           yes       ---           Tenant isolation

  business_name             varchar(200)   yes       ---           

  trade_specialty           varchar(200)   no        null          e.g. Electrical, Plumbing,
                                                                   Framing

  email                     varchar(255)   no        null          Primary contact email

  website                   varchar(500)   no        null          

  insurance_provider        varchar(200)   no        null          

  insurance_policy_number   varchar(100)   no        null          

  insurance_expiry_date     date           no        null          Source of truth for
                                                                   compliance_status computation

  coi_on_file               boolean        yes       false         Certificate of Insurance on file

  compliance_status         enum           yes       unknown       COMPUTED on every read. Values:
                                                                   valid, expiring_soon, expired,
                                                                   unknown

  default_payment_method    enum           no        null          cash, check, bank_transfer,
                                                                   venmo, zelle

  bank_name                 varchar(200)   no        null          

  bank_routing_encrypted    text           no        null          EncryptionService

  bank_account_encrypted    text           no        null          EncryptionService

  venmo_handle              varchar(100)   no        null          

  zelle_contact             varchar(100)   no        null          

  notes                     text           no        null          

  is_active                 boolean        yes       true          

  created_by_user_id        uuid           yes       ---           

  created_at                datetime       yes       now()         Auto

  updated_at                datetime       yes       now()         Auto
  --------------------------------------------------------------------------------------------------

  -----------------------------------------------------------------------
  **compliance_status Computation Logic --- Applied on Every Read**

  -----------------------------------------------------------------------

> unknown: insurance_expiry_date IS NULL
>
> expired: insurance_expiry_date \< today
>
> expiring_soon: insurance_expiry_date BETWEEN today AND today + 30 days
>
> valid: insurance_expiry_date \> today + 30 days

Indexes: (tenant_id, compliance_status) \| (tenant_id, is_active) \|
(tenant_id, insurance_expiry_date)

+-----------------------------------------------------------------------+
| **subcontractor_contact**                                             |
|                                                                       |
| Individual contact persons for a subcontractor. Multiple contacts per |
| subcontractor.                                                        |
+-----------------------------------------------------------------------+

  -------------------------------------------------------------------------------------------
  **Field**          **Type**       **Req**   **Default**   **Notes**
  ------------------ -------------- --------- ------------- ---------------------------------
  id                 uuid           yes       uuid()        PK

  tenant_id          uuid           yes       ---           Tenant isolation

  subcontractor_id   uuid           yes       ---           FK → subcontractor

  contact_name       varchar(200)   yes       ---           

  phone              varchar(20)    yes       ---           

  role               varchar(100)   no        null          e.g. Owner, Project Manager,
                                                            Billing

  email              varchar(255)   no        null          

  is_primary         boolean        yes       false         

  created_at         datetime       yes       now()         Auto
  -------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **subcontractor_document**                                            |
|                                                                       |
| Documents uploaded for a subcontractor. COI, license, insurance,      |
| agreements.                                                           |
+-----------------------------------------------------------------------+

  ----------------------------------------------------------------------------------------------
  **Field**             **Type**       **Req**   **Default**   **Notes**
  --------------------- -------------- --------- ------------- ---------------------------------
  id                    uuid           yes       uuid()        PK

  tenant_id             uuid           yes       ---           Tenant isolation

  subcontractor_id      uuid           yes       ---           FK → subcontractor

  file_id               uuid           yes       ---           FK → file table. Managed by
                                                               FilesService.

  file_url              varchar(500)   yes       ---           Nginx-served URL returned by
                                                               FilesService. Store from
                                                               uploadFile() response.

  file_name             varchar(255)   yes       ---           Original filename from
                                                               FilesService response

  document_type         enum           yes       ---           insurance, agreement, coi,
                                                               contract, license, other

  description           varchar(500)   no        null          

  uploaded_by_user_id   uuid           yes       ---           

  created_at            datetime       yes       now()         Auto
  ----------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **FILE UPLOAD RULE**                                                  |
|                                                                       |
| All file uploads in this module MUST use FilesService.uploadFile().   |
| Store both file_id (FK to file table) and file_url (from FilesService |
| response). Never implement custom upload logic. FileCategory for sub  |
| documents: use \"contract\", \"insurance\", or \"misc\" as            |
| appropriate.                                                          |
+-----------------------------------------------------------------------+

+-----------------------------------------------------------------------+
| **project_log**                                                       |
|                                                                       |
| Structured project log entry. Daily or random. Can be public          |
| (portal-visible) or private.                                          |
+-----------------------------------------------------------------------+

  --------------------------------------------------------------------------------------
  **Field**        **Type**    **Req**   **Default**   **Notes**
  ---------------- ----------- --------- ------------- ---------------------------------
  id               uuid        yes       uuid()        PK

  tenant_id        uuid        yes       ---           Tenant isolation

  project_id       uuid        yes       ---           FK → project

  task_id          uuid        no        null          FK → project_task. Optional task
                                                       context.

  author_user_id   uuid        yes       ---           FK → user

  log_date         date        yes       today         Default today. PM can backfill
                                                       past dates.

  content          text        yes       ---           Rich text or plain text content

  is_public        boolean     yes       false         true = visible in customer portal

  weather_delay    boolean     yes       false         

  created_at       datetime    yes       now()         Auto

  updated_at       datetime    yes       now()         Auto
  --------------------------------------------------------------------------------------

Indexes: (tenant_id, project_id, created_at) \| (tenant_id, project_id,
is_public)

Rule: Log content is immutable after creation. Owner/Admin can delete
--- not edit.

+-----------------------------------------------------------------------+
| **project_log_attachment**                                            |
|                                                                       |
| File attached to a project log entry via FilesService.                |
+-----------------------------------------------------------------------+

  ------------------------------------------------------------------------------------------
  **Field**         **Type**       **Req**   **Default**   **Notes**
  ----------------- -------------- --------- ------------- ---------------------------------
  id                uuid           yes       uuid()        PK

  tenant_id         uuid           yes       ---           Tenant isolation

  log_id            uuid           yes       ---           FK → project_log

  file_id           uuid           yes       ---           FK → file table. Managed by
                                                           FilesService.

  file_url          varchar(500)   yes       ---           Nginx-served URL returned by
                                                           FilesService. Store from
                                                           uploadFile() response.

  file_name         varchar(255)   yes       ---           Original filename from
                                                           FilesService response

  file_type         enum           yes       ---           photo, pdf, document

  file_size_bytes   int            no        null          From FilesService response

  created_at        datetime       yes       now()         Auto
  ------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **project_photo**                                                     |
|                                                                       |
| Photo linked to project, task, or log. Public flag controls portal    |
| visibility.                                                           |
+-----------------------------------------------------------------------+

  ----------------------------------------------------------------------------------------------
  **Field**             **Type**       **Req**   **Default**   **Notes**
  --------------------- -------------- --------- ------------- ---------------------------------
  id                    uuid           yes       uuid()        PK

  tenant_id             uuid           yes       ---           Tenant isolation

  project_id            uuid           yes       ---           FK → project

  task_id               uuid           no        null          FK → project_task

  log_id                uuid           no        null          FK → project_log (when uploaded
                                                               via log)

  file_id               uuid           yes       ---           FK → file table. Managed by
                                                               FilesService.

  file_url              varchar(500)   yes       ---           Nginx-served URL from
                                                               FilesService. FileCategory: photo

  thumbnail_url         varchar(500)   no        null          Auto-generated thumbnail URL from
                                                               FilesService response
                                                               (has_thumbnail field)

  caption               varchar(500)   no        null          

  is_public             boolean        yes       false         true = visible in customer portal

  taken_at              date           no        null          When photo was actually taken

  uploaded_by_user_id   uuid           yes       ---           

  created_at            datetime       yes       now()         Auto
  ----------------------------------------------------------------------------------------------

Indexes: (tenant_id, project_id, is_public) \| (tenant_id, project_id,
task_id)

+-----------------------------------------------------------------------+
| **project_document**                                                  |
|                                                                       |
| Document attached to a project (contracts, permits, blueprints,       |
| agreements).                                                          |
+-----------------------------------------------------------------------+

  ----------------------------------------------------------------------------------------------
  **Field**             **Type**       **Req**   **Default**   **Notes**
  --------------------- -------------- --------- ------------- ---------------------------------
  id                    uuid           yes       uuid()        PK

  tenant_id             uuid           yes       ---           Tenant isolation

  project_id            uuid           yes       ---           FK → project

  file_id               uuid           yes       ---           FK → file table. Managed by
                                                               FilesService.

  file_url              varchar(500)   yes       ---           Nginx-served URL from
                                                               FilesService. FileCategory:
                                                               contract, report, or misc.

  file_name             varchar(255)   yes       ---           From FilesService response

  document_type         enum           yes       ---           contract, permit, blueprint,
                                                               agreement, photo, other

  description           varchar(500)   no        null          

  is_public             boolean        yes       false         Portal visibility flag

  uploaded_by_user_id   uuid           yes       ---           

  created_at            datetime       yes       now()         Auto
  ----------------------------------------------------------------------------------------------

Indexes: (tenant_id, project_id, document_type)

+-----------------------------------------------------------------------+
| **permit**                                                            |
|                                                                       |
| Permit record per project. One project can have multiple permits.     |
+-----------------------------------------------------------------------+

  ----------------------------------------------------------------------------------------------------
  **Field**           **Type**       **Req**   **Default**           **Notes**
  ------------------- -------------- --------- --------------------- ---------------------------------
  id                  uuid           yes       uuid()                PK

  tenant_id           uuid           yes       ---                   Tenant isolation

  project_id          uuid           yes       ---                   FK → project

  permit_number       varchar(100)   no        null                  

  permit_type         varchar(200)   yes       ---                   e.g. Building, Electrical,
                                                                     Plumbing

  status              enum           yes       pending_application   not_required,
                                                                     pending_application, submitted,
                                                                     approved, active, failed, closed

  submitted_date      date           no        null                  

  approved_date       date           no        null                  

  expiry_date         date           no        null                  

  issuing_authority   varchar(200)   no        null                  

  notes               text           no        null                  

  created_at          datetime       yes       now()                 Auto

  updated_at          datetime       yes       now()                 Auto
  ----------------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **inspection**                                                        |
|                                                                       |
| Inspection tied to a permit. Tracks result and reinspection need.     |
+-----------------------------------------------------------------------+

  ------------------------------------------------------------------------------------------------
  **Field**               **Type**       **Req**   **Default**   **Notes**
  ----------------------- -------------- --------- ------------- ---------------------------------
  id                      uuid           yes       uuid()        PK

  tenant_id               uuid           yes       ---           Tenant isolation

  permit_id               uuid           yes       ---           FK → permit

  project_id              uuid           yes       ---           FK → project

  inspection_type         varchar(200)   yes       ---           e.g. Framing, Electrical
                                                                 Rough-In, Final

  scheduled_date          date           no        null          

  inspector_name          varchar(200)   no        null          

  result                  enum           no        null          pass, fail, conditional, pending

  reinspection_required   boolean        yes       false         

  reinspection_date       date           no        null          

  notes                   text           no        null          

  created_at              datetime       yes       now()         Auto

  updated_at              datetime       yes       now()         Auto
  ------------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **project_template**                                                  |
|                                                                       |
| Reusable task list template. Tenant-defined. Applied to projects on   |
| creation or manually.                                                 |
+-----------------------------------------------------------------------+

  ---------------------------------------------------------------------------------------------
  **Field**            **Type**       **Req**   **Default**   **Notes**
  -------------------- -------------- --------- ------------- ---------------------------------
  id                   uuid           yes       uuid()        PK

  tenant_id            uuid           yes       ---           Tenant isolation

  name                 varchar(200)   yes       ---           

  description          text           no        null          

  industry_type        varchar(100)   no        null          e.g. Roofing, Painting,
                                                              Remodeling

  is_active            boolean        yes       true          

  created_by_user_id   uuid           yes       ---           

  created_at           datetime       yes       now()         Auto

  updated_at           datetime       yes       now()         Auto
  ---------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **project_template_task**                                             |
|                                                                       |
| Task definition within a template. depends_on_order_index resolves    |
| into real task_dependency records on application.                     |
+-----------------------------------------------------------------------+

  --------------------------------------------------------------------------------------------------
  **Field**                 **Type**       **Req**   **Default**   **Notes**
  ------------------------- -------------- --------- ------------- ---------------------------------
  id                        uuid           yes       uuid()        PK

  template_id               uuid           yes       ---           FK → project_template

  tenant_id                 uuid           yes       ---           Tenant isolation

  title                     varchar(200)   yes       ---           

  description               text           no        null          

  estimated_duration_days   int            no        null          

  category                  enum           no        null          labor, material, subcontractor,
                                                                   equipment, other

  order_index               int            yes       ---           Defines task sequence in template

  depends_on_order_index    int            no        null          References order_index of
                                                                   prerequisite task within same
                                                                   template. Resolved to real
                                                                   task_dependency records on
                                                                   application.
  --------------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **completion_checklist_template**                                     |
|                                                                       |
| Tenant-defined checklist template. Assigned to project during         |
| completion process.                                                   |
+-----------------------------------------------------------------------+

  ---------------------------------------------------------------------------------------------
  **Field**            **Type**       **Req**   **Default**   **Notes**
  -------------------- -------------- --------- ------------- ---------------------------------
  id                   uuid           yes       uuid()        PK

  tenant_id            uuid           yes       ---           Tenant isolation

  name                 varchar(200)   yes       ---           

  description          text           no        null          

  is_active            boolean        yes       true          

  created_by_user_id   uuid           yes       ---           

  created_at           datetime       yes       now()         Auto
  ---------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **completion_checklist_template_item**                                |
|                                                                       |
| Individual item within a checklist template.                          |
+-----------------------------------------------------------------------+

  ---------------------------------------------------------------------------------------
  **Field**      **Type**       **Req**   **Default**   **Notes**
  -------------- -------------- --------- ------------- ---------------------------------
  id             uuid           yes       uuid()        PK

  template_id    uuid           yes       ---           FK →
                                                        completion_checklist_template

  tenant_id      uuid           yes       ---           Tenant isolation

  title          varchar(300)   yes       ---           

  description    text           no        null          

  is_required    boolean        yes       true          

  order_index    int            yes       ---           
  ---------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **project_completion_checklist**                                      |
|                                                                       |
| Active checklist assigned to a project. Created during completion     |
| initiation.                                                           |
+-----------------------------------------------------------------------+

  ------------------------------------------------------------------------------------
  **Field**      **Type**    **Req**   **Default**   **Notes**
  -------------- ----------- --------- ------------- ---------------------------------
  id             uuid        yes       uuid()        PK

  tenant_id      uuid        yes       ---           Tenant isolation

  project_id     uuid        yes       ---           FK → project

  template_id    uuid        no        null          FK →
                                                     completion_checklist_template
                                                     (null if built manually)

  completed_at   datetime    no        null          Set when all required items are
                                                     checked

  created_at     datetime    yes       now()         Auto
  ------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **project_completion_checklist_item**                                 |
|                                                                       |
| Individual checklist item on a project. Copied from template or       |
| manually added.                                                       |
+-----------------------------------------------------------------------+

  -----------------------------------------------------------------------------------------------
  **Field**              **Type**       **Req**   **Default**   **Notes**
  ---------------------- -------------- --------- ------------- ---------------------------------
  id                     uuid           yes       uuid()        PK

  tenant_id              uuid           yes       ---           Tenant isolation

  checklist_id           uuid           yes       ---           FK → project_completion_checklist

  title                  varchar(300)   yes       ---           Copied from template item or
                                                                manually entered

  is_required            boolean        yes       ---           Copied from template item

  is_completed           boolean        yes       false         

  completed_at           datetime       no        null          

  completed_by_user_id   uuid           no        null          

  notes                  text           no        null          

  order_index            int            yes       ---           
  -----------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **punch_list_item**                                                   |
|                                                                       |
| Individual punch list item. Lives under a completion checklist.       |
+-----------------------------------------------------------------------+

  ----------------------------------------------------------------------------------------------
  **Field**             **Type**       **Req**   **Default**   **Notes**
  --------------------- -------------- --------- ------------- ---------------------------------
  id                    uuid           yes       uuid()        PK

  tenant_id             uuid           yes       ---           Tenant isolation

  checklist_id          uuid           yes       ---           FK → project_completion_checklist

  project_id            uuid           yes       ---           FK → project

  title                 varchar(300)   yes       ---           

  description           text           no        null          

  status                enum           yes       open          open, in_progress, resolved

  assigned_to_crew_id   uuid           no        null          FK → crew_member

  resolved_at           datetime       no        null          

  resolved_by_user_id   uuid           no        null          

  created_at            datetime       yes       now()         Auto
  ----------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **task_calendar_event**                                               |
|                                                                       |
| Calendar event linked to a task. Synced to Google Calendar. Multiple  |
| events per task allowed.                                              |
+-----------------------------------------------------------------------+

  -----------------------------------------------------------------------------------------------
  **Field**              **Type**       **Req**   **Default**   **Notes**
  ---------------------- -------------- --------- ------------- ---------------------------------
  id                     uuid           yes       uuid()        PK

  tenant_id              uuid           yes       ---           Tenant isolation

  task_id                uuid           yes       ---           FK → project_task

  project_id             uuid           yes       ---           FK → project

  title                  varchar(300)   yes       ---           

  description            text           no        null          

  start_datetime         datetime       yes       ---           

  end_datetime           datetime       yes       ---           

  google_event_id        varchar(300)   no        null          Google Calendar event ID for sync

  internal_calendar_id   uuid           no        null          FK → internal calendar event (if
                                                                module exists)

  sync_status            enum           yes       pending       pending, synced, failed,
                                                                local_only

  created_by_user_id     uuid           yes       ---           

  created_at             datetime       yes       now()         Auto
  -----------------------------------------------------------------------------------------------

Rule: If Google Calendar sync fails, store event with sync_status =
failed and queue retry. Events are NOT deleted when a task is deleted.

+-----------------------------------------------------------------------+
| **portal_account**                                                    |
|                                                                       |
| Customer portal login account. One per lead per tenant. Created       |
| automatically on project creation from quote.                         |
+-----------------------------------------------------------------------+

  -------------------------------------------------------------------------------------------------
  **Field**                **Type**       **Req**   **Default**   **Notes**
  ------------------------ -------------- --------- ------------- ---------------------------------
  id                       uuid           yes       uuid()        PK

  tenant_id                uuid           yes       ---           Tenant isolation

  lead_id                  uuid           yes       ---           FK → lead. One portal account per
                                                                  customer per tenant.

  email                    varchar(255)   yes       ---           Customer email --- used as login
                                                                  credential

  customer_slug            varchar(200)   yes       ---           URL-safe slug. Unique per tenant.
                                                                  e.g. \"john-smith\"

  password_hash            text           yes       ---           bcrypt hashed. Never returned in
                                                                  API.

  must_change_password     boolean        yes       true          true on creation. Set false after
                                                                  first password change.

  last_login_at            datetime       no        null          

  reset_token              varchar(200)   no        null          For password reset flow

  reset_token_expires_at   datetime       no        null          

  is_active                boolean        yes       true          

  created_at               datetime       yes       now()         Auto

  updated_at               datetime       yes       now()         Auto
  -------------------------------------------------------------------------------------------------

  -----------------------------------------------------------------------
  **Customer Slug Generation Rules**

  -----------------------------------------------------------------------

> Source: lead.first_name + lead.last_name → lowercase, hyphens only
>
> Uniqueness: per tenant. If \"john-smith\" exists → try
> \"john-smith-2\" → \"john-smith-3\"
>
> Portal URL:
> https://{tenant_subdomain}.lead360.app/public/{customer_slug}/

Indexes: (tenant_id, lead_id) UNIQUE \| (tenant_id, email) UNIQUE \|
(tenant_id, customer_slug) UNIQUE

**5. Business Rules**

**5.1 Project Creation**

-   Project from quote: copy quote.total → project.contract_value; copy
    internal cost estimate → project.estimated_cost

-   Generate project_number per tenant sequence. Format:
    PRJ-{year}-{sequence:0042}

-   Set deletion_locked = true on source quote. Quote DELETE returns
    HTTP 409 if deletion_locked = true.

-   Update lead status to \"customer\" via LeadsService

-   Create portal_account if none exists for this lead + tenant.
    Generate temporary password, queue welcome email.

-   Quote status must be \"approved\", \"started\", or \"concluded\" to
    create a project from it.

-   Initial project status is always \"planned\"

-   Standalone project: is_standalone = true, quote_id = null, lead_id =
    null

**5.2 Task Generation from Quote**

-   Each quote_item generates one project_task on project creation

-   Task title = quote_item.title

-   All generated tasks start with status = not_started

-   PM can add manual tasks after creation (no quote_item_id)

-   Tasks can be soft-deleted (deleted_at set). Audit log required.

**5.3 Task Dependency Rules**

-   Three types supported: finish_to_start (FS), start_to_start (SS),
    finish_to_finish (FF)

-   Before inserting a dependency, validate no circular dependencies
    exist using DFS traversal of existing dependencies

-   is_delayed = true when: actual_end_date \> estimated_end_date, OR
    today \> estimated_end_date AND task status is not \"done\"

-   PM decides whether to cascade date changes. System flags delay and
    notifies --- does not auto-cascade.

**5.4 Crew Member Security Rules**

-   SSN, ITIN, DL number, bank_routing, bank_account: encrypt before
    storing with EncryptionService

-   Standard API responses return masked values only: SSN →
    \*\*\*-\*\*-1234, bank → \*\*\*\*1234, DL → \*\*\*\*5678

-   Reveal endpoint: GET /api/v1/crew/:id/reveal/:field --- Roles:
    Owner, Admin only

-   Reveal operation MUST call logTenantChange() with action:
    \"accessed\", metadata includes field name and timestamp

**5.5 Subcontractor Compliance Rules**

-   compliance_status is computed on every read from
    insurance_expiry_date --- never stored static

-   BullMQ daily job scans all active subcontractors assigned to active
    projects

-   When insurance_expiry_date \< 30 days out: create notification for
    Owner/Admin/Manager

-   When insurance_expiry_date is past: create urgent notification

**5.6 Quote Deletion Lock**

-   When project is created from quote: set quote.deletion_locked = true

-   Quote module DELETE endpoint must enforce: if deletion_locked =
    true, return HTTP 409

-   Error message: \"This quote is linked to an active project and
    cannot be deleted\"

**5.7 Project Log Rules**

-   Logs can be created for any date (PM may backfill past entries)

-   is_public = true: visible in customer portal. Default is private.

-   Photos uploaded via log also appear in project_photo (linked via
    log_id)

-   Log content is immutable after creation. Owner/Admin can delete, not
    edit.

**5.8 Portal Rules**

-   Portal account created at project creation from quote.
    must_change_password = true on creation.

-   Portal uses separate JWT (portal token) --- not the same as staff
    JWT

-   Portal GET endpoints validate customerSlug belongs to the token
    holder

-   Portal returns ONLY: is_public logs, is_public photos, task titles
    and status (no notes), project status, schedule dates, permit status

-   Portal NEVER returns: cost data, crew details, financial entries,
    internal notes, subcontractor data, margins

-   File URLs in portal responses are /public/{tenant_id}/\... paths ---
    Nginx serves directly, no proxy

**5.9 SMS from Task**

-   Uses existing SmsSendingService.sendSms() from CommunicationsModule

-   Call signature: sendSms(tenantId, userId, { to_phone, text_body,
    related_entity_type: \"project\", related_entity_id: projectId,
    lead_id })

-   SMS appears on: task activity AND lead/customer communication
    timeline

**5.10 Calendar Event Rules**

-   Multiple events allowed per task

-   Events stored in both Google Calendar AND task_calendar_event table

-   If Google Calendar sync fails: event stored locally with sync_status
    = failed, retry queued

-   Events are NOT deleted when task is deleted --- PM manages manually

**5.11 Completion Checklist Rules**

-   Tenant defines checklist templates in Settings

-   PM selects template when initiating completion process

-   PM can add manual items beyond the template

-   All required items (is_required = true) must be is_completed = true
    before project can be marked \"completed\"

-   Punch list items are separate from checklist items but live under
    the same completion record

**6. CommunicationsModule Integration Reference**

The following is verified from the live codebase. Sprint agents must use
this exact calling convention.

  -----------------------------------------------------------------------
  **SmsSendingService --- Verified Method Signature**

  -----------------------------------------------------------------------

> sendSms(tenantId: string, userId: string, dto: SendSmsDto):
> Promise\<SmsSendingResponse\>
>
> SendSmsDto fields:
>
> to_phone?: string (E.164 format, e.g. +19781234567)
>
> text_body: string (max 1600 chars)
>
> lead_id?: string (auto-resolves phone from lead if no to_phone)
>
> related_entity_type?: string (e.g. \"project\", \"task\")
>
> related_entity_id?: string (UUID of the related entity)
>
> template_id?: string (optional SMS template)
>
> scheduled_at?: string (ISO 8601 for scheduled delivery)

  -----------------------------------------------------------------------
  **Change Order Module --- Verified Integration Point**

  -----------------------------------------------------------------------

The existing ChangeOrderService operates on the quote table using
parent_quote_id FK. To create a change order from task context:

> Parent quote must have status: approved \| started \| concluded
>
> Change order number format: CO-{year}-{0001}
>
> Add task_id to the change order metadata or private_notes if no
> dedicated FK column exists
>
> Coordinate with quote module --- do not duplicate change order logic

**7. API Surface**

All endpoints prefixed with /api/v1. All require Bearer JWT unless
marked Public. All responses use standard pagination format for lists.

**Projects**

  -----------------------------------------------------------------------------------------
  **Method**   **Endpoint**                    **Description**          **Roles**
  ------------ ------------------------------- ------------------------ -------------------
  POST         /projects                       Create project (from     Owner, Admin,
                                               quote or standalone)     Manager

  POST         /projects/from-quote/:quoteId   Create project from      Owner, Admin,
                                               accepted quote           Manager

  GET          /projects                       List projects            Owner, Admin,
                                               (paginated, filtered)    Manager, Field
                                                                        (own)

  GET          /projects/:id                   Get project detail       Owner, Admin,
                                                                        Manager, Field
                                                                        (assigned)

  PATCH        /projects/:id                   Update project           Owner, Admin,
                                                                        Manager

  DELETE       /projects/:id                   Soft delete project      Owner, Admin

  GET          /projects/:id/summary           Financial summary (cost  Owner, Admin,
                                               vs contract)             Manager, Bookkeeper
  -----------------------------------------------------------------------------------------

**Tasks**

  ----------------------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                                           **Description**          **Roles**
  ------------ ------------------------------------------------------ ------------------------ -------------------
  POST         /projects/:projectId/tasks                             Create task              Owner, Admin,
                                                                                               Manager

  GET          /projects/:projectId/tasks                             List tasks (ordered)     Owner, Admin,
                                                                                               Manager, Field

  GET          /projects/:projectId/tasks/:id                         Get task detail          All with project
                                                                                               access

  PATCH        /projects/:projectId/tasks/:id                         Update task              Owner, Admin,
                                                                                               Manager

  DELETE       /projects/:projectId/tasks/:id                         Soft delete task         Owner, Admin,
                                                                                               Manager

  POST         /projects/:projectId/tasks/:id/assignees               Assign crew/sub/user     Owner, Admin,
                                                                                               Manager

  DELETE       /projects/:projectId/tasks/:id/assignees/:assigneeId   Remove assignee          Owner, Admin,
                                                                                               Manager

  POST         /projects/:projectId/tasks/:id/dependencies            Add dependency           Owner, Admin,
                                                                                               Manager

  DELETE       /projects/:projectId/tasks/:id/dependencies/:depId     Remove dependency        Owner, Admin,
                                                                                               Manager

  POST         /projects/:projectId/tasks/:id/sms                     Send SMS from task       Owner, Admin,
                                                                      context                  Manager

  POST         /projects/:projectId/tasks/:id/calendar-events         Create calendar event    Owner, Admin,
                                                                                               Manager

  GET          /projects/:projectId/tasks/:id/calendar-events         List task calendar       Owner, Admin,
                                                                      events                   Manager
  ----------------------------------------------------------------------------------------------------------------

**Crew Members**

  -----------------------------------------------------------------------------------
  **Method**   **Endpoint**              **Description**          **Roles**
  ------------ ------------------------- ------------------------ -------------------
  POST         /crew                     Create crew member       Owner, Admin,
                                                                  Manager

  GET          /crew                     List crew (paginated)    Owner, Admin,
                                                                  Manager

  GET          /crew/:id                 Get crew detail          Owner, Admin,
                                         (sensitive fields        Manager
                                         masked)                  

  GET          /crew/:id/reveal/:field   Reveal sensitive field   Owner, Admin only
                                         (audit logged)           

  PATCH        /crew/:id                 Update crew member       Owner, Admin,
                                                                  Manager

  DELETE       /crew/:id                 Soft delete crew member  Owner, Admin
  -----------------------------------------------------------------------------------

**Subcontractors**

  ----------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                         **Description**          **Roles**
  ------------ ------------------------------------ ------------------------ -------------------
  POST         /subcontractors                      Create subcontractor     Owner, Admin,
                                                                             Manager

  GET          /subcontractors                      List with compliance     Owner, Admin,
                                                    filter                   Manager

  GET          /subcontractors/:id                  Get detail (compliance   Owner, Admin,
                                                    recomputed)              Manager

  PATCH        /subcontractors/:id                  Update subcontractor     Owner, Admin,
                                                                             Manager

  DELETE       /subcontractors/:id                  Soft delete              Owner, Admin

  POST         /subcontractors/:id/contacts         Add contact              Owner, Admin,
                                                                             Manager

  GET          /subcontractors/:id/contacts         List contacts            Owner, Admin,
                                                                             Manager

  DELETE       /subcontractors/:id/contacts/:cId    Remove contact           Owner, Admin,
                                                                             Manager

  POST         /subcontractors/:id/documents        Upload document          Owner, Admin,
                                                    (FilesService)           Manager

  GET          /subcontractors/:id/documents        List documents           Owner, Admin,
                                                                             Manager

  DELETE       /subcontractors/:id/documents/:dId   Delete document          Owner, Admin
  ----------------------------------------------------------------------------------------------

**Project Logs**

  ---------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                    **Description**              **Roles**
  ------------ ------------------------------- ---------------------------- -------------------
  POST         /projects/:projectId/logs       Create log entry             Owner, Admin,
                                                                            Manager, Field
                                                                            (assigned)

  GET          /projects/:projectId/logs       List logs (filter:           Owner, Admin,
                                               all/public/private/photos)   Manager, Field

  DELETE       /projects/:projectId/logs/:id   Delete log                   Owner, Admin
  ---------------------------------------------------------------------------------------------

**Photos**

  -------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                      **Description**          **Roles**
  ------------ --------------------------------- ------------------------ -------------------
  POST         /projects/:projectId/photos       Upload photo             Owner, Admin,
                                                 (FilesService, category: Manager, Field
                                                 photo)                   

  GET          /projects/:projectId/photos       List photos (filter:     All project members
                                                 task, date)              

  PATCH        /projects/:projectId/photos/:id   Update caption / public  Owner, Admin,
                                                 flag                     Manager

  DELETE       /projects/:projectId/photos/:id   Delete photo             Owner, Admin,
                                                                          Manager
  -------------------------------------------------------------------------------------------

**Documents**

  ----------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                         **Description**          **Roles**
  ------------ ------------------------------------ ------------------------ -------------------
  POST         /projects/:projectId/documents       Upload document          Owner, Admin,
                                                    (FilesService)           Manager

  GET          /projects/:projectId/documents       List documents           Owner, Admin,
                                                                             Manager

  DELETE       /projects/:projectId/documents/:id   Delete document          Owner, Admin
  ----------------------------------------------------------------------------------------------

**Permits & Inspections**

  ------------------------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                                             **Description**          **Roles**
  ------------ -------------------------------------------------------- ------------------------ -------------------
  POST         /projects/:projectId/permits                             Create permit            Owner, Admin,
                                                                                                 Manager

  GET          /projects/:projectId/permits                             List permits             Owner, Admin,
                                                                                                 Manager

  PATCH        /projects/:projectId/permits/:id                         Update permit            Owner, Admin,
                                                                                                 Manager

  POST         /projects/:projectId/permits/:permitId/inspections       Add inspection           Owner, Admin,
                                                                                                 Manager

  PATCH        /projects/:projectId/permits/:permitId/inspections/:id   Update inspection        Owner, Admin,
                                                                                                 Manager
  ------------------------------------------------------------------------------------------------------------------

**Project Templates**

  -----------------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                                      **Description**          **Roles**
  ------------ ------------------------------------------------- ------------------------ -------------------
  POST         /project-templates                                Create template          Owner, Admin

  GET          /project-templates                                List templates           Owner, Admin,
                                                                                          Manager

  PATCH        /project-templates/:id                            Update template          Owner, Admin

  DELETE       /project-templates/:id                            Delete template          Owner, Admin

  POST         /projects/:projectId/apply-template/:templateId   Apply template to        Owner, Admin,
                                                                 project                  Manager
  -----------------------------------------------------------------------------------------------------------

**Completion Checklist Settings**

  ---------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                        **Description**          **Roles**
  ------------ ----------------------------------- ------------------------ -------------------
  POST         /settings/checklist-templates       Create checklist         Owner, Admin
                                                   template                 

  GET          /settings/checklist-templates       List templates           Owner, Admin,
                                                                            Manager

  PATCH        /settings/checklist-templates/:id   Update template          Owner, Admin

  DELETE       /settings/checklist-templates/:id   Delete template          Owner, Admin
  ---------------------------------------------------------------------------------------------

**Project Completion**

  --------------------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                                         **Description**          **Roles**
  ------------ ---------------------------------------------------- ------------------------ -------------------
  POST         /projects/:projectId/completion                      Start completion (assign Owner, Admin,
                                                                    template)                Manager

  PATCH        /projects/:projectId/completion/items/:itemId        Complete a checklist     Owner, Admin,
                                                                    item                     Manager

  POST         /projects/:projectId/completion/punch-list           Add punch list item      Owner, Admin,
                                                                                             Manager

  PATCH        /projects/:projectId/completion/punch-list/:itemId   Update punch list item   Owner, Admin,
                                                                                             Manager

  POST         /projects/:projectId/complete                        Mark project complete    Owner, Admin,
                                                                    (validates all required  Manager
                                                                    items)                   
  --------------------------------------------------------------------------------------------------------------

**Dashboard & Gantt**

  -------------------------------------------------------------------------------------
  **Method**   **Endpoint**                **Description**          **Roles**
  ------------ --------------------------- ------------------------ -------------------
  GET          /projects/dashboard         Dashboard data (status   Owner, Admin,
                                           counts, delayed,         Manager
                                           filters)                 

  GET          /projects/dashboard/gantt   Gantt data for all       Owner, Admin,
                                           projects                 Manager

  GET          /projects/:id/gantt         Gantt data for single    Owner, Admin,
                                           project                  Manager
  -------------------------------------------------------------------------------------

**Customer Portal (Separate Auth)**

  -----------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                                **Description**          **Roles**
  ------------ ------------------------------------------- ------------------------ -------------------
  POST         /portal/auth/login                          Portal login --- returns Public
                                                           portal token +           
                                                           customer_slug            

  POST         /portal/auth/forgot-password                Request password reset   Public
                                                           email                    

  POST         /portal/auth/reset-password                 Reset password with      Public
                                                           token                    

  POST         /portal/auth/change-password                Change password          Portal token
                                                           (must_change_password    
                                                           flow)                    

  GET          /portal/:customerSlug/projects              List customer projects   Portal token

  GET          /portal/:customerSlug/projects/:id          Project detail (public   Portal token
                                                           data only)               

  GET          /portal/:customerSlug/projects/:id/logs     Public logs only         Portal token

  GET          /portal/:customerSlug/projects/:id/photos   Public photos only       Portal token

  GET          /portal/:customerSlug/quote/:token          Quote view (reuses       No auth
                                                           existing quote public    (token-based)
                                                           system)                  
  -----------------------------------------------------------------------------------------------------

**8. Architecture Reservations**

**8.1 Financing Module**

-   project.contract_value --- reserved for financing calculation. No
    business logic in Phase 1.

-   project.estimated_cost --- reserved for margin calculation. No
    business logic in Phase 1.

**8.2 Clockin System**

-   crew_member.user_id --- links crew to system user (Field role).
    Clockin queries this to validate assignment before clock-in.

-   task_assignee table --- clockin system validates crew is assigned to
    task before clock-in.

-   project.start_date and project.status --- clockin validates project
    is active.

-   Task actual_start_date --- clockin system may update on first
    clock-in (reserved, not implemented in Phase 1).

**9. Financial Gates**

The Financial Module (project-scoped) is built in three gate sprints
that unblock specific Project Module work.

  ------------------------------------------------------------------------------------
  **Gate**   **Sprint**       **Delivers**                    **Unblocks**
  ---------- ---------------- ------------------------------- ------------------------
  Gate 1     Sprint 06        financial_category +            Task cost logging
                              financial_entry tables,         (Sprint 28+), project
                              FinancialCategoryService,       financial summary
                              FinancialEntryService           endpoint

  Gate 2     Sprint 11        receipt table, ReceiptService,  Receipt capture on tasks
                              FilesService upload for         (Sprint 28+)
                              receipts                        

  Gate 3     Sprint 27        crew_payment_record,            Crew hour logging
                              crew_hour_log,                  (Sprint 29),
                              subcontractor_payment_record,   subcontractor invoicing
                              subcontractor_task_invoice      (Sprint 30)
  ------------------------------------------------------------------------------------

**10. Sprint Acceptance Criteria**

A sprint is complete when ALL of the following are true:

-   All entities in scope exist in the database with correct fields and
    indexes

-   All API endpoints return correct responses per specification and
    response shape examples

-   Tenant isolation verified: no cross-tenant data leakage on any
    endpoint

-   RBAC enforced: each role sees only what it should per the API
    surface table

-   Business rules enforced at API level (not just UI)

-   Audit logs created for all write operations using logTenantChange()

-   All sensitive fields encrypted at rest using EncryptionService,
    masked in responses

-   Portal endpoints return only public data --- no cost/crew/financial
    data ever leaks

-   All list endpoints return standard pagination format: { data, meta:
    { total, page, limit, totalPages } }

-   Unit tests passing (.spec.ts next to each tested file) with \>80%
    service coverage

-   Integration tests passing in api/test/ directory

-   REST API documentation file complete at
    api/documentation/{entity}\_REST_API.md

-   Swagger UI updated --- all new endpoints annotated with
    \@ApiOperation, \@ApiResponse

-   No S3 references anywhere --- all file operations via FilesService
    only

**11. Risks & Open Questions**

  --------------------------------------------------------------------------------------
  **Risk**          **Area**        **Likelihood**   **Impact**   **Mitigation**
  ----------------- --------------- ---------------- ------------ ----------------------
  Google Calendar   Calendar        Medium           Medium       Verify existing OAuth
  OAuth scope may                                                 scope covers
  need expansion                                                  calendar.events write;
  for event                                                       expand if needed
  creation on tasks                                               before Sprint 21

  Circular          Task Engine     Medium           Medium       Implement DFS check
  dependency                                                      before insert; Sprint
  detection DFS                                                   14 must include DFS
  logic complexity                                                test cases

  Subcontractor     BullMQ Jobs     Low              Low          BullMQ job with tenant
  compliance alert                                                batching; job runs
  job load on large                                               nightly not real-time
  tenants                                                         

  Portal JWT must   Auth            High             High         Implement dedicated
  be separate from                                                portal JWT with
  staff JWT to                                                    separate secret and
  prevent privilege                                               audience claim
  escalation                                                      

  Quote             Scope           Medium           High         Sprint 08 must include
  deletion_locked                                                 modification to Quote
  enforcement                                                     module delete endpoint
  requires                                                        
  coordinating with                                               
  Quote module                                                    
  --------------------------------------------------------------------------------------

*Feature Contract --- Project Management Module \| Version 2.0 \|
Lead360 Platform \| Approved for Development*