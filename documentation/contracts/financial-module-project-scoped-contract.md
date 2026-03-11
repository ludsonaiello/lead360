-----------------------------------------------------------------------
  Lead360 Platform

  **Financial Module (Project-Scoped)**

  *Feature Contract --- Phase 1*

  Version 2.0 \| Status: Approved for Development \| Lead360 Platform
  -----------------------------------------------------------------------

  ---------------- ------------------------------------------------------
  **Module**       financial (project-scoped subset)

  **Version**      2.0 --- Masterclass Edition

  **Status**       Approved for Development

  **Working Dir**  /var/www/lead360.app/api/src/modules/financial/

  **Depends On**   Project Module (project and project_task must exist at
                   each gate), Auth Module, Audit Module, Files Module

  **Gate Model**   Three gate sprints: Gate 1 (Sprint 06), Gate 2 (Sprint
                   11), Gate 3 (Sprint 27)

  **Full           OUT OF SCOPE. Full P&L, invoicing, revenue, QuickBooks
  Financial**      --- separate future contract.
  ---------------- ------------------------------------------------------

**1. Platform Architecture Reference**

Same platform patterns apply here. Repeated for sprint agent reference.

  -----------------------------------------------------------------------
  **FilesService.uploadFile() --- File Uploads for Receipts**

  -----------------------------------------------------------------------

> import { FilesService } from \"../../files/files.service\";
>
> Module: FilesModule from \"../files/files.module\"
>
> uploadFile(tenantId, userId, file: Express.Multer.File,
>
> { category: FileCategory, entity_type?: string, entity_id?: string }
>
> ): Promise\<{ message, file_id, url, file: { id, file_id,
> original_filename,
>
> mime_type, size_bytes, category, url, has_thumbnail, \... } }\>
>
> FileCategory for receipts: \"receipt\"
>
> FileCategory for sub invoices: \"invoice\"
>
> File storage: LOCAL Nginx-served at /public/{tenant_id}/\... --- NEVER
> S3

  -----------------------------------------------------------------------
  **AuditLoggerService --- Required on All Write Operations**

  -----------------------------------------------------------------------

> logTenantChange({ action, entityType, entityId, tenantId, actorUserId,
>
> before?, after?, metadata?, description }): Promise\<void\>
>
> Import: import { AuditLoggerService } from
> \"../../audit/services/audit-logger.service\";
>
> Module: AuditModule from \"../audit/audit.module\"

  -----------------------------------------------------------------------
  **Standard Pagination --- Mandatory All List Endpoints**

  -----------------------------------------------------------------------

> { \"data\": \[\...\], \"meta\": { \"total\": 150, \"page\": 1,
> \"limit\": 20, \"totalPages\": 8 } }

  -----------------------------------------------------------------------
  **Multi-Tenant Isolation --- Non-Negotiable**

  -----------------------------------------------------------------------

> Every query: WHERE tenant_id = :tenantId
>
> Every service task acceptance criteria must state this explicitly.

**2. Purpose**

This contract defines the financial infrastructure required to support
the Project Management Module in Phase 1. It is NOT the full Financial
Module --- it is the project-scoped subset that must be built in three
gate sprints to enable task cost tracking, receipt capture, crew payment
history, and subcontractor payment history within projects.

+-----------------------------------------------------------------------+
| **SCOPE BOUNDARY**                                                    |
|                                                                       |
| Full Financial Module (P&L reporting, overhead tracking, recurring    |
| expenses, revenue tracking, comprehensive dashboard, QuickBooks       |
| integration) is a SEPARATE contract to be produced after Phase 1 is   |
| complete. Do not implement any of those features here.                |
+-----------------------------------------------------------------------+

**3. Scope**

**3.1 In Scope --- Phase 1 (Project-Scoped)**

**Gate 1 deliverables (unblocks task cost logging):**

-   financial_category --- tenant-defined, typed, system defaults seeded
    on tenant creation

-   financial_entry --- project/task-level cost entries

-   Project cost summary computation endpoint

**Gate 2 deliverables (unblocks receipt capture on tasks):**

-   receipt entity --- linked to financial_entry via FilesService

-   Receipt file upload via FilesService (FileCategory: receipt)

-   Receipt categorization (link to financial_entry)

**Gate 3 deliverables (unblocks crew/subcontractor financial
profiles):**

-   crew_payment_record --- manual payment recording

-   crew_hour_log --- manual hour logging (Phase 1; clockin system is
    Phase 2)

-   subcontractor_payment_record --- manual payment recording

-   subcontractor_task_invoice --- task-level invoice from subcontractor

**3.2 Out of Scope --- Phase 1**

-   Overhead / operating expense tracking

-   Recurring expense engine

-   Full P&L dashboard

-   Revenue tracking and invoice reconciliation

-   Budget Forecast vs. Actuals chart

-   Tax calculation

-   Payroll export

-   QuickBooks / accounting software integration

-   Financial reporting module

-   Receipt OCR processing (fields reserved --- not processed in Phase
    1)

-   Clock-in based hour logging (crew_hour_log.source = clockin_system
    reserved for Phase 2)

**4. Database Entities**

**All entities require tenant_id on every row. All queries must include
WHERE tenant_id = ? --- non-negotiable.**

+-----------------------------------------------------------------------+
| **financial_category**                                                |
|                                                                       |
| Gate 1. Typed cost category. System defaults seeded on tenant         |
| creation.                                                             |
+-----------------------------------------------------------------------+

  ---------------------------------------------------------------------------------------------
  **Field**            **Type**       **Req**   **Default**   **Notes**
  -------------------- -------------- --------- ------------- ---------------------------------
  id                   uuid           yes       uuid()        PK

  tenant_id            uuid           yes       ---           Tenant isolation

  name                 varchar(200)   yes       ---           e.g. \"Labor - Crew\",
                                                              \"Materials - Lumber\",
                                                              \"Subcontractor - Electrical\"

  type                 enum           yes       ---           labor, material, subcontractor,
                                                              equipment, other

  description          text           no        null          

  is_active            boolean        yes       true          

  is_system_default    boolean        yes       false         true for seeded defaults. Cannot
                                                              be deleted --- only deactivated.

  created_by_user_id   uuid           no        null          null for system-seeded records

  created_at           datetime       yes       now()         Auto

  updated_at           datetime       yes       now()         Auto
  ---------------------------------------------------------------------------------------------

  -----------------------------------------------------------------------
  **System Default Categories --- Seeded on Tenant Creation**

  -----------------------------------------------------------------------

  ------------------------------------------------------------------------
  **Name**                   **Type**        **Notes**
  -------------------------- --------------- -----------------------------
  Labor - General            labor           Default labor category

  Labor - Crew Overtime      labor           For overtime hour entries

  Materials - General        material        

  Materials - Tools          equipment       

  Materials - Safety         equipment       
  Equipment                                  

  Subcontractor - General    subcontractor   

  Equipment Rental           equipment       

  Fuel & Transportation      other           

  Miscellaneous              other           
  ------------------------------------------------------------------------

Indexes: (tenant_id, type) \| (tenant_id, is_active)

Rule: type cannot be changed after creation. Deactivated categories
still appear on existing entries (historical integrity).

+-----------------------------------------------------------------------+
| **financial_entry**                                                   |
|                                                                       |
| Gate 1. A single cost entry linked to a project and optionally a      |
| task.                                                                 |
+-----------------------------------------------------------------------+

  ----------------------------------------------------------------------------------------------
  **Field**            **Type**        **Req**   **Default**   **Notes**
  -------------------- --------------- --------- ------------- ---------------------------------
  id                   uuid            yes       uuid()        PK

  tenant_id            uuid            yes       ---           Tenant isolation

  project_id           uuid            yes       ---           FK → project. Required in
                                                               Phase 1. Cannot be null.

  task_id              uuid            no        null          FK → project_task. Optional ---
                                                               entry may be project-level.

  category_id          uuid            yes       ---           FK → financial_category.
                                                               Required.

  entry_type           enum            yes       expense       expense (Phase 1 only). income
                                                               reserved for future.

  amount               decimal(12,2)   yes       ---           Must be \> 0

  entry_date           date            yes       ---           Cannot be a future date

  vendor_name          varchar(200)    no        null          Who was paid (supplier or company
                                                               name)

  crew_member_id       uuid            no        null          FK → crew_member. Set when
                                                               logging labor for a specific crew
                                                               member.

  subcontractor_id     uuid            no        null          FK → subcontractor. Set when
                                                               logging subcontractor cost.

  notes                text            no        null          

  has_receipt          boolean         yes       false         Set true when a receipt is linked
                                                               via receipt.financial_entry_id

  created_by_user_id   uuid            yes       ---           

  updated_by_user_id   uuid            no        null          Set on updates

  created_at           datetime        yes       now()         Auto

  updated_at           datetime        yes       now()         Auto
  ----------------------------------------------------------------------------------------------

Indexes: (tenant_id, project_id) \| (tenant_id, task_id) \| (tenant_id,
project_id, category_id) \| (tenant_id, entry_date) \| (tenant_id,
crew_member_id) \| (tenant_id, subcontractor_id)

+-----------------------------------------------------------------------+
| **receipt**                                                           |
|                                                                       |
| Gate 2. Receipt image or PDF linked to a financial entry via          |
| FilesService.                                                         |
+-----------------------------------------------------------------------+

  -------------------------------------------------------------------------------------------------
  **Field**             **Type**        **Req**   **Default**     **Notes**
  --------------------- --------------- --------- --------------- ---------------------------------
  id                    uuid            yes       uuid()          PK

  tenant_id             uuid            yes       ---             Tenant isolation

  financial_entry_id    uuid            no        null            FK → financial_entry. Null if
                                                                  uploaded before categorization.

  project_id            uuid            no        null            FK → project

  task_id               uuid            no        null            FK → project_task

  file_id               uuid            yes       ---             FK → file table. Managed by
                                                                  FilesService.

  file_url              varchar(500)    yes       ---             Nginx-served URL from
                                                                  FilesService uploadFile()
                                                                  response. FileCategory: receipt.

  file_name             varchar(255)    yes       ---             Original filename from
                                                                  FilesService response

  file_type             enum            yes       ---             photo, pdf

  file_size_bytes       int             no        null            From FilesService response

  vendor_name           varchar(200)    no        null            Manually entered by user

  amount                decimal(12,2)   no        null            Manually entered by user

  receipt_date          date            no        null            Manually entered by user

  ocr_raw               text            no        null            RESERVED --- NOT PROCESSED IN
                                                                  PHASE 1

  ocr_status            enum            yes       not_processed   not_processed (Phase 1 only).
                                                                  processing, complete, failed
                                                                  reserved.

  ocr_vendor            varchar(200)    no        null            RESERVED --- NOT PROCESSED IN
                                                                  PHASE 1

  ocr_amount            decimal(12,2)   no        null            RESERVED --- NOT PROCESSED IN
                                                                  PHASE 1

  ocr_date              date            no        null            RESERVED --- NOT PROCESSED IN
                                                                  PHASE 1

  is_categorized        boolean         yes       false           Set true when linked to
                                                                  financial_entry

  uploaded_by_user_id   uuid            yes       ---             

  created_at            datetime        yes       now()           Auto

  updated_at            datetime        yes       now()           Auto
  -------------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **FILE UPLOAD RULE**                                                  |
|                                                                       |
| Receipt upload MUST use FilesService.uploadFile() with FileCategory:  |
| \"receipt\". Store file_id (FK to file table) and file_url (from      |
| FilesService response). Max receipt file size: 25MB. Accepted         |
| formats: jpg, png, webp, pdf.                                         |
+-----------------------------------------------------------------------+

Indexes: (tenant_id, financial_entry_id) \| (tenant_id, project_id) \|
(tenant_id, task_id) \| (tenant_id, is_categorized)

+-----------------------------------------------------------------------+
| **crew_payment_record**                                               |
|                                                                       |
| Gate 3. Manual record of payment made to a crew member.               |
+-----------------------------------------------------------------------+

  ----------------------------------------------------------------------------------------------
  **Field**            **Type**        **Req**   **Default**   **Notes**
  -------------------- --------------- --------- ------------- ---------------------------------
  id                   uuid            yes       uuid()        PK

  tenant_id            uuid            yes       ---           Tenant isolation

  crew_member_id       uuid            yes       ---           FK → crew_member

  project_id           uuid            no        null          FK → project. Optional ---
                                                               payment may be general, not
                                                               project-specific.

  amount               decimal(10,2)   yes       ---           Must be \> 0

  payment_date         date            yes       ---           Cannot be future date

  payment_method       enum            yes       ---           cash, check, bank_transfer,
                                                               venmo, zelle

  reference_number     varchar(200)    no        null          Check number, transfer ID, Venmo
                                                               transaction ID, etc.

  period_start_date    date            no        null          Pay period start

  period_end_date      date            no        null          Pay period end

  hours_paid           decimal(6,2)    no        null          Hours this payment covers (for
                                                               reference only)

  notes                text            no        null          

  created_by_user_id   uuid            yes       ---           

  created_at           datetime        yes       now()         Auto
  ----------------------------------------------------------------------------------------------

Indexes: (tenant_id, crew_member_id) \| (tenant_id, crew_member_id,
payment_date) \| (tenant_id, project_id)

+-----------------------------------------------------------------------+
| **crew_hour_log**                                                     |
|                                                                       |
| Gate 3. Manual hour log for a crew member on a project/task. Clockin  |
| integration reserved.                                                 |
+-----------------------------------------------------------------------+

  ---------------------------------------------------------------------------------------------
  **Field**            **Type**       **Req**   **Default**   **Notes**
  -------------------- -------------- --------- ------------- ---------------------------------
  id                   uuid           yes       uuid()        PK

  tenant_id            uuid           yes       ---           Tenant isolation

  crew_member_id       uuid           yes       ---           FK → crew_member

  project_id           uuid           yes       ---           FK → project. Required.

  task_id              uuid           no        null          FK → project_task. Optional.

  log_date             date           yes       ---           

  hours_regular        decimal(5,2)   yes       ---           Cannot be 0

  hours_overtime       decimal(5,2)   yes       0.00          default 0. Log separately from
                                                              regular hours.

  source               enum           yes       manual        manual (Phase 1). clockin_system
                                                              reserved for Phase 2.

  clockin_event_id     uuid           no        null          RESERVED --- FK to future clockin
                                                              table. Null in Phase 1.

  notes                text           no        null          

  created_by_user_id   uuid           yes       ---           

  created_at           datetime       yes       now()         Auto

  updated_at           datetime       yes       now()         Auto
  ---------------------------------------------------------------------------------------------

Indexes: (tenant_id, crew_member_id, log_date) \| (tenant_id,
project_id) \| (tenant_id, task_id)

Rule: Zero-hours entry is not allowed (hours_regular must be \> 0).
Corrections require audit log with before/after values.

+-----------------------------------------------------------------------+
| **subcontractor_payment_record**                                      |
|                                                                       |
| Gate 3. Manual record of payment made to a subcontractor.             |
+-----------------------------------------------------------------------+

  ----------------------------------------------------------------------------------------------
  **Field**            **Type**        **Req**   **Default**   **Notes**
  -------------------- --------------- --------- ------------- ---------------------------------
  id                   uuid            yes       uuid()        PK

  tenant_id            uuid            yes       ---           Tenant isolation

  subcontractor_id     uuid            yes       ---           FK → subcontractor

  project_id           uuid            no        null          FK → project. Optional.

  amount               decimal(10,2)   yes       ---           Must be \> 0

  payment_date         date            yes       ---           Cannot be future date

  payment_method       enum            yes       ---           cash, check, bank_transfer,
                                                               venmo, zelle

  reference_number     varchar(200)    no        null          Check number, transfer ID, etc.

  notes                text            no        null          

  created_by_user_id   uuid            yes       ---           

  created_at           datetime        yes       now()         Auto
  ----------------------------------------------------------------------------------------------

Indexes: (tenant_id, subcontractor_id) \| (tenant_id, subcontractor_id,
payment_date) \| (tenant_id, project_id)

+-----------------------------------------------------------------------+
| **subcontractor_task_invoice**                                        |
|                                                                       |
| Gate 3. Invoice from a subcontractor for work on a specific task.     |
+-----------------------------------------------------------------------+

  ----------------------------------------------------------------------------------------------
  **Field**            **Type**        **Req**   **Default**   **Notes**
  -------------------- --------------- --------- ------------- ---------------------------------
  id                   uuid            yes       uuid()        PK

  tenant_id            uuid            yes       ---           Tenant isolation

  subcontractor_id     uuid            yes       ---           FK → subcontractor

  task_id              uuid            yes       ---           FK → project_task

  project_id           uuid            yes       ---           FK → project

  invoice_number       varchar(100)    no        null          Subcontractor\'s invoice number

  invoice_date         date            no        null          

  amount               decimal(12,2)   yes       ---           Must be \> 0

  status               enum            yes       pending       pending → approved → paid

  notes                text            no        null          

  file_id              uuid            no        null          FK → file table. Managed by
                                                               FilesService. FileCategory:
                                                               invoice.

  file_url             varchar(500)    no        null          Nginx-served URL from
                                                               FilesService. Store from
                                                               uploadFile() response.

  file_name            varchar(255)    no        null          From FilesService response

  created_by_user_id   uuid            yes       ---           

  created_at           datetime        yes       now()         Auto

  updated_at           datetime        yes       now()         Auto
  ----------------------------------------------------------------------------------------------

Indexes: (tenant_id, subcontractor_id) \| (tenant_id, task_id) \|
(tenant_id, project_id) \| (tenant_id, status)

Status flow: pending → approved → paid. Amount updatable before
approval. After approved, amount requires Owner/Admin + audit log.

**5. Exported Service Interfaces**

These service methods MUST be exported from the Financial module so the
Project module can import and call them. Signatures are the interface
contract between modules.

**5.1 FinancialCategoryService --- Gate 1**

  -----------------------------------------------------------------------
  **Method Signatures**

  -----------------------------------------------------------------------

> findAllForTenant(tenantId: string): Promise\<FinancialCategory\[\]\>
>
> → Returns all active categories, ordered by type then name
>
> createCategory(tenantId: string, userId: string, dto:
> CreateCategoryDto): Promise\<FinancialCategory\>
>
> updateCategory(tenantId: string, categoryId: string, userId: string,
> dto: UpdateCategoryDto): Promise\<FinancialCategory\>
>
> deactivateCategory(tenantId: string, categoryId: string, userId:
> string): Promise\<void\>
>
> → System default categories (is_system_default = true) cannot be
> deactivated

**5.2 FinancialEntryService --- Gate 1**

> createEntry(tenantId: string, userId: string, dto:
> CreateFinancialEntryDto): Promise\<FinancialEntry\>
>
> dto: project_id, task_id?, category_id, amount, entry_date,
> vendor_name?,
>
> notes?, crew_member_id?, subcontractor_id?
>
> getProjectEntries(tenantId: string, projectId: string):
> Promise\<FinancialEntry\[\]\>
>
> → All entries linked to project (including task-level entries within
> project)
>
> getTaskEntries(tenantId: string, taskId: string):
> Promise\<FinancialEntry\[\]\>
>
> getProjectCostSummary(tenantId: string, projectId: string): Promise\<{
>
> total_actual_cost: number,
>
> cost_by_category: { labor: number, material: number, subcontractor:
> number,
>
> equipment: number, other: number },
>
> entry_count: number
>
> }\>
>
> getTaskCostSummary(tenantId: string, taskId: string): Promise\<{
>
> total_actual_cost: number, entry_count: number
>
> }\>

**5.3 ReceiptService --- Gate 2**

> uploadReceipt(tenantId: string, userId: string, file:
> Express.Multer.File,
>
> dto: { project_id?, task_id?, vendor_name?, amount?, receipt_date? }
>
> ): Promise\<Receipt\>
>
> → Calls FilesService.uploadFile() with FileCategory: \"receipt\"
>
> → Stores file_id and file_url from FilesService response
>
> → Creates receipt with ocr_status = \"not_processed\", is_categorized
> = false
>
> linkReceiptToEntry(tenantId: string, receiptId: string,
> financialEntryId: string): Promise\<Receipt\>
>
> → Sets receipt.financial_entry_id, is_categorized = true
>
> → Sets financial_entry.has_receipt = true
>
> → One receipt to one financial entry only
>
> getProjectReceipts(tenantId: string, projectId: string):
> Promise\<Receipt\[\]\>
>
> getTaskReceipts(tenantId: string, taskId: string):
> Promise\<Receipt\[\]\>

**5.4 CrewPaymentService --- Gate 3**

> createPayment(tenantId: string, userId: string, crewMemberId: string,
>
> dto: CreateCrewPaymentDto): Promise\<CrewPaymentRecord\>
>
> dto: project_id?, amount, payment_date, payment_method,
> reference_number?,
>
> period_start_date?, period_end_date?, hours_paid?, notes?
>
> getPaymentHistory(tenantId: string, crewMemberId: string):
> Promise\<CrewPaymentRecord\[\]\>
>
> getTotalPaid(tenantId: string, crewMemberId: string):
> Promise\<number\>

**5.5 CrewHourLogService --- Gate 3**

> logHours(tenantId: string, userId: string, dto: LogCrewHoursDto):
> Promise\<CrewHourLog\>
>
> dto: crew_member_id, project_id, task_id?, log_date, hours_regular,
>
> hours_overtime?, notes?
>
> source always set to \"manual\" in Phase 1
>
> getHoursForProject(tenantId: string, projectId: string, crewMemberId?:
> string): Promise\<CrewHourLog\[\]\>
>
> getHoursForCrew(tenantId: string, crewMemberId: string, dateRange?: {
> from: Date, to: Date }): Promise\<CrewHourLog\[\]\>

**5.6 SubcontractorPaymentService --- Gate 3**

> createPayment(tenantId: string, userId: string, subcontractorId:
> string,
>
> dto: CreateSubPaymentDto): Promise\<SubcontractorPaymentRecord\>
>
> dto: project_id?, amount, payment_date, payment_method,
> reference_number?, notes?
>
> getPaymentHistory(tenantId: string, subcontractorId: string):
> Promise\<SubcontractorPaymentRecord\[\]\>
>
> getTotalPaid(tenantId: string, subcontractorId: string):
> Promise\<number\>

**5.7 SubcontractorInvoiceService --- Gate 3**

> createInvoice(tenantId: string, userId: string, dto:
> CreateSubInvoiceDto): Promise\<SubcontractorTaskInvoice\>
>
> dto: subcontractor_id, task_id, project_id, amount, invoice_number?,
> invoice_date?,
>
> notes?, file? (multipart --- optional)
>
> → If file provided: calls FilesService.uploadFile() with FileCategory:
> \"invoice\"
>
> updateStatus(tenantId: string, invoiceId: string, userId: string,
>
> status: \"pending\" \| \"approved\" \| \"paid\"):
> Promise\<SubcontractorTaskInvoice\>
>
> → Audit log required on every status change
>
> getTaskInvoices(tenantId: string, taskId: string):
> Promise\<SubcontractorTaskInvoice\[\]\>
>
> getSubcontractorInvoices(tenantId: string, subcontractorId: string):
> Promise\<SubcontractorTaskInvoice\[\]\>

**6. API Endpoints**

All endpoints prefixed with /api/v1. All require Bearer JWT. All list
endpoints return standard pagination format.

**Financial Categories (Settings) --- Gate 1**

  ------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                         **Description**      **Roles**
  ------------ ------------------------------------ -------------------- -------------------
  POST         /settings/financial-categories       Create category      Owner, Admin,
                                                                         Manager

  GET          /settings/financial-categories       List categories (all Owner, Admin,
                                                    types)               Manager, Bookkeeper

  PATCH        /settings/financial-categories/:id   Update category      Owner, Admin

  DELETE       /settings/financial-categories/:id   Deactivate category  Owner, Admin
  ------------------------------------------------------------------------------------------

**Financial Entries (Project/Task Cost Logging) --- Gate 1**

  ----------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                             **Description**      **Roles**
  ------------ ---------------------------------------- -------------------- -------------------
  POST         /financial/entries                       Create cost entry    Owner, Admin,
                                                                             Manager, Bookkeeper

  GET          /financial/entries                       List entries         Owner, Admin,
                                                        (filter: project,    Manager, Bookkeeper
                                                        task, category, date 
                                                        range)               

  GET          /financial/entries/:id                   Get entry detail     Owner, Admin,
                                                                             Manager, Bookkeeper

  PATCH        /financial/entries/:id                   Update entry (audit  Owner, Admin,
                                                        logged)              Manager, Bookkeeper

  DELETE       /financial/entries/:id                   Delete entry (audit  Owner, Admin,
                                                        logged)              Bookkeeper

  GET          /projects/:projectId/financial-summary   Project cost summary Owner, Admin,
                                                        by category          Manager, Bookkeeper
  ----------------------------------------------------------------------------------------------

**Receipts --- Gate 2**

  ------------------------------------------------------------------------------------
  **Method**   **Endpoint**                   **Description**      **Roles**
  ------------ ------------------------------ -------------------- -------------------
  POST         /financial/receipts            Upload receipt       Owner, Admin,
                                              (multipart,          Manager,
                                              FilesService)        Bookkeeper, Field
                                                                   (own tasks)

  GET          /financial/receipts            List receipts        Owner, Admin,
                                              (filter: project,    Manager, Bookkeeper
                                              task, categorized)   

  PATCH        /financial/receipts/:id/link   Link receipt to      Owner, Admin,
                                              financial entry      Manager, Bookkeeper

  PATCH        /financial/receipts/:id        Update receipt       Owner, Admin,
                                              details (vendor,     Manager, Bookkeeper
                                              amount, date)        
  ------------------------------------------------------------------------------------

**Crew Hour Logs --- Gate 3**

  ---------------------------------------------------------------------------------
  **Method**   **Endpoint**                **Description**      **Roles**
  ------------ --------------------------- -------------------- -------------------
  POST         /financial/crew-hours       Log crew hours       Owner, Admin,
                                           (manual)             Manager

  GET          /financial/crew-hours       List logs (filter:   Owner, Admin,
                                           crew, project, date  Manager, Bookkeeper
                                           range)               

  PATCH        /financial/crew-hours/:id   Correct hours (audit Owner, Admin
                                           logged before/after) 
  ---------------------------------------------------------------------------------

**Crew Payments --- Gate 3**

  -------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                          **Description**      **Roles**
  ------------ ------------------------------------- -------------------- -------------------
  POST         /financial/crew-payments              Record crew payment  Owner, Admin,
                                                                          Bookkeeper

  GET          /financial/crew-payments              List (filter: crew,  Owner, Admin,
                                                     project)             Bookkeeper

  GET          /crew/:crewMemberId/payment-history   Payment history on   Owner, Admin,
                                                     crew profile         Manager, Bookkeeper
  -------------------------------------------------------------------------------------------

**Subcontractor Payments --- Gate 3**

  --------------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                                       **Description**      **Roles**
  ------------ -------------------------------------------------- -------------------- -------------------
  POST         /financial/subcontractor-payments                  Record subcontractor Owner, Admin,
                                                                  payment              Bookkeeper

  GET          /financial/subcontractor-payments                  List payments        Owner, Admin,
                                                                                       Bookkeeper

  GET          /subcontractors/:subcontractorId/payment-history   History on sub       Owner, Admin,
                                                                  profile              Manager, Bookkeeper
  --------------------------------------------------------------------------------------------------------

**Subcontractor Task Invoices --- Gate 3**

  ---------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                                  **Description**      **Roles**
  ------------ --------------------------------------------- -------------------- -------------------
  POST         /financial/subcontractor-invoices             Create invoice       Owner, Admin,
                                                             (optional file       Manager, Bookkeeper
                                                             upload)              

  GET          /financial/subcontractor-invoices             List (filter: sub,   Owner, Admin,
                                                             task, project,       Manager, Bookkeeper
                                                             status)              

  PATCH        /financial/subcontractor-invoices/:id         Update               Owner, Admin,
                                                             status/details       Bookkeeper
                                                             (audit logged)       

  GET          /projects/:projectId/tasks/:taskId/invoices   Task-level invoices  Owner, Admin,
                                                                                  Manager, Bookkeeper
  ---------------------------------------------------------------------------------------------------

**7. Business Rules**

**7.1 Financial Category Rules**

-   System default categories seeded on tenant creation --- cannot be
    deleted, only deactivated

-   Tenant can create custom categories at any time

-   category.type cannot be changed after creation

-   Deactivated categories still appear on existing entries --- never
    purge historical data

**7.2 Financial Entry Rules**

-   project_id is required in Phase 1 --- every entry must be linked to
    a project

-   task_id is optional --- entry may be project-level without a task

-   amount must be \> 0

-   entry_date cannot be a future date

-   category_id must belong to the same tenant (validate before insert)

-   Editing an entry after creation creates audit log with before/after
    values (logTenantChange)

**7.3 Receipt Rules**

-   Receipt can be uploaded before categorization (is_categorized =
    false, financial_entry_id = null)

-   Receipt becomes categorized when linked to financial_entry
    (is_categorized = true)

-   One receipt links to one financial entry only --- no many-to-one
    receipt linking

-   When receipt is linked: set financial_entry.has_receipt = true

-   OCR fields are reserved architecture. ocr_status must be set to
    \"not_processed\" on upload. Do not process in Phase 1.

-   Accepted file formats: jpg, png, webp, pdf

-   Max file size: 25MB per receipt

**7.4 Crew Hour Log Rules**

-   Phase 1: source always = \"manual\". clockin_event_id always = null.

-   hours_regular must be \> 0

-   hours_overtime defaults to 0 --- logged separately from regular
    hours

-   Corrections to existing logs require audit log with before/after
    values

**7.5 Payment Record Rules (Crew & Subcontractor)**

-   Payments are manually recorded --- no automatic payment processing
    in Phase 1

-   payment_method must be specified from enum: cash, check,
    bank_transfer, venmo, zelle

-   amount must be \> 0

-   payment_date cannot be a future date

-   Payments are immutable after 24 hours except by Owner/Admin (audit
    log required on edit)

**7.6 Subcontractor Invoice Rules**

-   Status flow: pending → approved → paid (forward only)

-   amount can be updated before status = approved

-   After status = approved: amount change requires Owner/Admin role +
    audit log

-   File attachment is optional. If provided: use FilesService with
    FileCategory: \"invoice\"

**8. Tenant Creation Seeding Hook**

When a new tenant is created, the system must seed default financial
categories. The Sprint 06 (Gate 1) agent must coordinate with the
existing tenant creation flow to add this seeding step.

+-----------------------------------------------------------------------+
| **COORDINATION REQUIRED**                                             |
|                                                                       |
| Identify the existing tenant creation service/hook and add the        |
| financial category seeding call. Do not create a new tenant creation  |
| path. The seed must run inside the same transaction as tenant         |
| creation.                                                             |
+-----------------------------------------------------------------------+

**9. Architecture Reservations**

-   financial_entry.entry_type enum includes \"income\" --- reserved,
    not used in Phase 1

-   financial_category table will gain overhead expense categories in
    Phase 2

-   receipt.ocr\_\* fields are reserved --- OCR processing is Phase 2

-   crew_hour_log.clockin_event_id is reserved --- clockin system
    integration Phase 2

-   A future project_financial_budget table will hold per-category
    budget allocations for Forecast vs. Actuals

**10. Gate Acceptance Criteria**

**Gate 1 is open when:**

-   financial_category table exists with correct fields and indexes

-   Default categories seeded for the test tenant
    (contact@honeydo4you.com)

-   financial_entry table exists with correct fields and indexes

-   FinancialCategoryService exported with correct interface (Section
    5.1)

-   FinancialEntryService exported with correct interface (Section 5.2)

-   GET /api/v1/projects/:projectId/financial-summary returns correct
    cost totals grouped by category

-   Tenant isolation verified: entries from another tenant never
    returned

-   All list endpoints return standard pagination format

-   Unit tests passing with \>80% service coverage

-   Integration tests in api/test/ passing

-   REST API documentation complete at
    api/documentation/financial_categories_REST_API.md and
    api/documentation/financial_entries_REST_API.md

-   Swagger UI updated

**Gate 2 is open when:**

-   receipt table exists with correct fields and indexes

-   File upload via FilesService working with FileCategory: receipt

-   file_id and file_url correctly stored from FilesService response
    (not from custom storage)

-   ReceiptService exported with correct interface (Section 5.3)

-   receipts correctly link to financial_entries (is_categorized flips
    to true on link)

-   financial_entry.has_receipt set to true when receipt is linked

-   Tenant isolation verified

-   Unit tests passing, integration tests passing

-   REST API documentation complete at
    api/documentation/receipts_REST_API.md

**Gate 3 is open when:**

-   crew_payment_record table exists with correct fields and indexes

-   crew_hour_log table exists with correct fields and indexes

-   subcontractor_payment_record table exists with correct fields and
    indexes

-   subcontractor_task_invoice table exists with correct fields and
    indexes

-   All four payment services exported with correct interfaces (Sections
    5.4--5.7)

-   Payment history endpoints return correct paginated data

-   Invoice status transitions enforced (pending → approved → paid)

-   Audit log generated on all payment record creates and invoice status
    changes

-   Tenant isolation verified on all four new tables

-   Unit tests passing, integration tests passing

-   REST API documentation complete for all four entities

-   Swagger UI updated

-   File upload for subcontractor invoices uses FilesService with
    FileCategory: invoice

*Feature Contract --- Financial Module (Project-Scoped) \| Version 2.0
\| Lead360 Platform \| Approved for Development*