🚀 PROCEEDING WITH BACKEND IMPLEMENTATION GUIDE
Generating comprehensive backend implementation documentation...

📘 BACKEND IMPLEMENTATION GUIDE: TWILIO SMS/CALLS COMMUNICATION PROVIDER
Document Version: 1.0
Last Updated: February 5, 2026
Owner: Ludson (Project Manager)
Status: READY FOR DEVELOPMENT
Prerequisite: Feature Contract v1.0 (approved)

1. DOCUMENT PURPOSE
This guide defines the backend architecture, service responsibilities, data flows, and integration requirements for the Twilio SMS/Calls Communication Provider feature.

Audience:

Backend developers implementing the feature
Technical leads reviewing architecture
QA engineers designing test cases
DevOps engineers setting up infrastructure
What This Document Contains:

Service layer structure and responsibilities
Data processing flows and state transitions
Webhook handler logic and routing
Job queue architecture and worker design
API endpoint contracts (inputs/outputs, not implementation)
Integration points with existing modules
Error handling strategies
Security requirements
Testing requirements
What This Document Does NOT Contain:

Code or pseudocode
SQL queries
Specific library recommendations (unless architecturally critical)
UI implementation details (see Frontend Implementation Guide)
2. ARCHITECTURE OVERVIEW
2.1 Service Layer Structure
The backend is organized into distinct service layers following NestJS patterns and existing Lead360 architecture:

Core Services:

TwilioProviderService → Manages Twilio provider configuration, credential validation, phone number provisioning
TwilioWebhookService → Handles all incoming Twilio webhooks, routes to appropriate handlers
CallManagementService → Manages call lifecycle, state transitions, recording storage
SmsManagementService → Manages SMS lifecycle, message delivery, status tracking
IvrConfigurationService → Manages IVR menu configuration, executes IVR logic
OfficeBypassService → Handles office number whitelist, bypass call routing
LeadMatchingService → Matches phone numbers to Leads, handles auto-creation
TranscriptionProviderService → Manages transcription provider registry, credential validation
TranscriptionJobService → Queues and processes transcription jobs
TwilioUsageTrackingService → Tracks usage via Twilio API, generates reports
Supporting Services (Existing):

EncryptionService → Encrypts/decrypts API credentials
FileStorageService → Stores call recordings
PrismaService → Database operations
BullMQService → Job queue management
Communication Flow:

Twilio → Webhook Endpoint → TwilioWebhookService → Route to Handler
                                                    ↓
                                   CallManagementService / SmsManagementService
                                                    ↓
                                            LeadMatchingService
                                                    ↓
                                              Database Update
                                                    ↓
                                      TranscriptionJobService (if call ended)
2.2 Multi-Tenant Request Scoping
All operations must enforce tenant isolation:

Webhook Request → Tenant Identification
Extract subdomain from request URL
Query Tenants table to get tenant_id
Attach tenant_id to request context
All subsequent queries MUST include WHERE tenant_id = ?
API Request → Tenant Identification
Extract tenant from authenticated user session
Attach tenant_id to request context
All queries scoped to user's tenant
Job Queue → Tenant Scoping
Every job payload includes tenant_id
Workers query only tenant-scoped data
Critical Rule: No service method should accept operations without tenant context. Every database query MUST filter by tenant_id.

3. DATA MODEL IMPLEMENTATION REQUIREMENTS
3.1 Prisma Schema Entities
The following entities must be added to the Prisma schema. Relationships and indexes are defined conceptually.

TwilioProviderConfiguration
Fields:

id → UUID, primary key
tenant_id → UUID, foreign key to Tenants, indexed
deployment_model → Enum: OWN_ACCOUNT, SYSTEM_MANAGED
account_sid → Encrypted string, nullable (null if SYSTEM_MANAGED)
auth_token → Encrypted string, nullable (null if SYSTEM_MANAGED)
phone_number → String (E.164 format), indexed
system_assigned → Boolean, default false
status → Enum: ACTIVE, INACTIVE, SUSPENDED
webhook_urls → JSON (structure: { sms_inbound, call_inbound, call_status, recording_ready, ivr_input })
usage_tracking_enabled → Boolean, default true
last_synced_at → Timestamp, nullable
created_at → Timestamp
updated_at → Timestamp
Indexes:

tenant_id
phone_number
status
Unique constraint: tenant_id + phone_number (one config per tenant per number)
Relationships:

Belongs to one Tenant
Has many CallRecords
Has many SmsRecords
Has one IvrConfiguration
IvrConfiguration
Fields:

id → UUID, primary key
tenant_id → UUID, foreign key to Tenants, indexed
twilio_config_id → UUID, foreign key to TwilioProviderConfiguration
ivr_enabled → Boolean, default false
greeting_message → Text (TwiML or plain text)
menu_options → JSON array (structure defined in Feature Contract)
default_action → JSON (action if no input)
timeout_seconds → Integer, default 10
max_retries → Integer, default 3
status → Enum: ACTIVE, INACTIVE
created_at → Timestamp
updated_at → Timestamp
Indexes:

tenant_id
twilio_config_id
Relationships:

Belongs to one Tenant
Belongs to one TwilioProviderConfiguration
CallRecord
Fields:

id → UUID, primary key
tenant_id → UUID, foreign key to Tenants, indexed
lead_id → UUID, foreign key to Leads, nullable, indexed
twilio_config_id → UUID, foreign key to TwilioProviderConfiguration
twilio_call_sid → String, unique, indexed
direction → Enum: INBOUND, OUTBOUND
from_number → String (E.164 format), indexed
to_number → String (E.164 format), indexed
status → Enum: INITIATED, RINGING, IN_PROGRESS, COMPLETED, FAILED, NO_ANSWER, BUSY, CANCELED
call_type → Enum: CUSTOMER_CALL, OFFICE_BYPASS_CALL, IVR_ROUTED_CALL
initiated_by → UUID, foreign key to Users, nullable
call_reason → Text, nullable
recording_url → String (File Storage reference), nullable
recording_duration_seconds → Integer, nullable
recording_status → Enum: PENDING, AVAILABLE, PROCESSING_TRANSCRIPTION, TRANSCRIBED, FAILED
transcription_id → UUID, foreign key to CallTranscription, nullable
ivr_action_taken → JSON, nullable
consent_message_played → Boolean, default false
cost → Decimal (precision 10, scale 4), nullable
started_at → Timestamp, nullable
ended_at → Timestamp, nullable
created_at → Timestamp
updated_at → Timestamp
Indexes:

tenant_id
lead_id
twilio_call_sid (unique)
from_number
to_number
status
recording_status
created_at (for sorting)
Relationships:

Belongs to one Tenant
Belongs to one TwilioProviderConfiguration
Belongs to zero or one Lead
Initiated by zero or one User
Has zero or one CallTranscription
SmsRecord
Fields:

id → UUID, primary key
tenant_id → UUID, foreign key to Tenants, indexed
lead_id → UUID, foreign key to Leads, nullable, indexed
twilio_config_id → UUID, foreign key to TwilioProviderConfiguration
twilio_message_sid → String, unique, indexed
direction → Enum: INBOUND, OUTBOUND
from_number → String (E.164 format), indexed
to_number → String (E.164 format), indexed
message_body → Text
status → Enum: QUEUED, SENDING, SENT, DELIVERED, FAILED, UNDELIVERED
sent_by → UUID, foreign key to Users, nullable
error_code → String, nullable
error_message → Text, nullable
cost → Decimal (precision 10, scale 4), nullable
sent_at → Timestamp, nullable
delivered_at → Timestamp, nullable
created_at → Timestamp
updated_at → Timestamp
Indexes:

tenant_id
lead_id
twilio_message_sid (unique)
from_number
to_number
status
created_at (for sorting)
Relationships:

Belongs to one Tenant
Belongs to one TwilioProviderConfiguration
Belongs to zero or one Lead
Sent by zero or one User
CallTranscription
Fields:

id → UUID, primary key
tenant_id → UUID, foreign key to Tenants, indexed
call_record_id → UUID, foreign key to CallRecords, unique
transcription_provider → String (e.g., "openai_whisper")
status → Enum: QUEUED, PROCESSING, COMPLETED, FAILED
transcription_text → Text (full-text searchable)
language_detected → String (ISO code), nullable
confidence_score → Decimal (precision 3, scale 2), nullable
processing_duration_seconds → Integer, nullable
cost → Decimal (precision 10, scale 4), nullable
error_message → Text, nullable
created_at → Timestamp
completed_at → Timestamp, nullable
Indexes:

tenant_id
call_record_id (unique)
status
Full-text index on transcription_text
Relationships:

Belongs to one Tenant
Belongs to one CallRecord
Uses one TranscriptionProviderConfiguration (via tenant or system default)
TranscriptionProviderConfiguration
Fields:

id → UUID, primary key
tenant_id → UUID, foreign key to Tenants, nullable, indexed (null = system-wide)
provider_name → String (e.g., "openai_whisper", "oracle", "assemblyai")
is_system_default → Boolean, default false
status → Enum: ACTIVE, INACTIVE
configuration_json → Encrypted JSON (contains API keys, model settings, language preferences)
usage_limit → Integer (messages per month), nullable
usage_current → Integer, default 0
cost_per_minute → Decimal (precision 10, scale 4), nullable
created_at → Timestamp
updated_at → Timestamp
Indexes:

tenant_id
provider_name
is_system_default
status
Relationships:

Belongs to zero or one Tenant (nullable for system-wide)
Has many CallTranscriptions (implicit, via usage)
OfficeNumberWhitelist
Fields:

id → UUID, primary key
tenant_id → UUID, foreign key to Tenants, indexed
phone_number → String (E.164 format), indexed
label → String (e.g., "John's Mobile", "Office Desk 1")
status → Enum: ACTIVE, INACTIVE
created_at → Timestamp
updated_at → Timestamp
Indexes:

tenant_id
phone_number
status
Unique constraint: tenant_id + phone_number
Relationships:

Belongs to one Tenant
3.2 Data Migration Considerations
Migration Must Include:

Create all new tables with proper indexes
Add foreign key constraints with cascade rules
Create full-text index on CallTranscription.transcription_text
Seed system default TranscriptionProviderConfiguration (if applicable)
No Data Backfill Required:

This is a new feature; no existing data to migrate
4. SERVICE RESPONSIBILITIES
4.1 TwilioProviderService
Purpose: Manage Twilio provider lifecycle, validate credentials, provision phone numbers

Responsibilities:

Configuration Management:

Create new Twilio provider configuration for tenant
Validate Twilio credentials (Account SID, Auth Token)
Test connection by sending test SMS or making test call
Update configuration (switch between Model A and Model B)
Deactivate configuration
Archive old configuration when switching models
Model A (Tenant-Owned Account):

Accept Account SID, Auth Token, Phone Number from tenant
Encrypt credentials using EncryptionService
Configure webhook URLs in tenant's Twilio account via Twilio API
Validate that webhooks are reachable
Store configuration in database
Model B (System-Managed Account):

Query available phone numbers from system's Twilio account
Provision new phone number for tenant
Configure webhook URLs for provisioned number
Store configuration with system_assigned = true
Track which numbers are allocated to which tenants
Webhook URL Generation:

Generate tenant-specific webhook URLs using subdomain
Format: https://{tenant_subdomain}.lead360.app/api/twilio/{webhook_type}
Webhook types: sms/inbound, call/inbound, call/status, recording/ready, ivr/input
Store webhook URLs in configuration JSON
Credential Encryption:

Use EncryptionService to encrypt Account SID and Auth Token before storing
Decrypt credentials only when needed for API calls (never expose in API responses)
Validation Logic:

Verify Account SID format: AC[a-z0-9]{32}
Verify Auth Token format: 32-character alphanumeric
Verify phone number format: E.164 (must start with +)
Test Twilio API connectivity by fetching account details
Validate that phone number belongs to provided account (Model A)
Error Handling:

Invalid credentials → Return clear error message, do not save configuration
Twilio API unreachable → Return timeout error, suggest retry
Phone number already in use → Return conflict error
Webhook configuration failed → Rollback configuration, return error
Integration Points:

EncryptionService → Encrypt/decrypt credentials
Twilio API → Validate account, configure webhooks, provision numbers
TenantService → Retrieve tenant details (subdomain, office address)
PrismaService → Store configuration
4.2 TwilioWebhookService
Purpose: Receive and route all Twilio webhooks, validate signatures, extract tenant context

Responsibilities:

Webhook Signature Validation:

Every incoming webhook must include Twilio signature header
Validate signature using Twilio library and Auth Token
Reject requests with invalid or missing signatures (return 403)
Log rejected requests for security monitoring
Tenant Identification:

Extract subdomain from request URL
Query Tenants table to resolve tenant_id
If tenant not found → Return 404, log error
Attach tenant_id to request context for downstream handlers
Webhook Routing:

Identify webhook type from URL path (/sms/inbound, /call/inbound, etc.)
Route to appropriate handler:
SMS Inbound → SmsManagementService.handleInboundSms()
Call Inbound → CallManagementService.handleInboundCall()
Call Status → CallManagementService.handleCallStatusUpdate()
Recording Ready → CallManagementService.handleRecordingReady()
IVR Input → IvrConfigurationService.handleIvrInput()
Idempotency:

Check if webhook already processed using twilio_call_sid or twilio_message_sid
If duplicate detected → Return 200 OK, do not reprocess
Twilio may send duplicate webhooks; system must handle gracefully
Response Time:

Webhook handlers must respond within 2 seconds to avoid Twilio timeout
For long-running operations (e.g., transcription), acknowledge webhook immediately, then queue job
Error Handling:

Webhook processing error → Log error, return 500, allow Twilio to retry
Tenant not found → Return 404, log for investigation
Invalid signature → Return 403, log security alert
Integration Points:

TenantService → Resolve tenant by subdomain
SmsManagementService → Handle SMS webhooks
CallManagementService → Handle call webhooks
IvrConfigurationService → Handle IVR webhooks
Twilio library → Validate webhook signatures
4.3 CallManagementService
Purpose: Manage call lifecycle, record calls, handle state transitions, link calls to Leads

Responsibilities:

Inbound Call Handling:

Step 1: Call Received

Webhook contains: CallSid, From (caller number), To (tenant's Twilio number)
Create CallRecord with status INITIATED
Store twilio_call_sid, from_number, to_number, direction = INBOUND
Check if caller number is on OfficeNumberWhitelist
If whitelisted → Route to OfficeBypassService
If not whitelisted → Continue to IVR or default routing
Step 2: IVR or Direct Routing

Query IvrConfiguration for tenant
If IVR enabled → Generate TwiML response with IVR menu, play consent message
If IVR disabled → Generate TwiML response to route to default handler, play consent message
Update CallRecord status to RINGING
Return TwiML response to Twilio
Step 3: Call Answered

Webhook contains: CallSid, CallStatus = in-progress
Update CallRecord status to IN_PROGRESS
Set started_at timestamp
Start call recording (Twilio API call to start recording)
Step 4: Call Ended

Webhook contains: CallSid, CallStatus = completed, CallDuration
Update CallRecord status to COMPLETED
Set ended_at timestamp
Store call duration
Match caller to Lead via LeadMatchingService
If Lead matched → Link CallRecord to Lead
If no match → Auto-create Lead, link CallRecord
Set recording_status = PENDING (waiting for recording webhook)
Outbound Call Handling:

Step 1: User Initiates Call

Input: lead_id, user_phone_number, call_reason
Validate inputs (phone numbers in E.164 format)
Create CallRecord with status INITIATED, direction OUTBOUND
Store initiated_by (user ID), call_reason, lead_id
Step 2: Call User First

Use Twilio API to call user's phone number FROM tenant's Twilio number
TwiML: "Please wait, we're connecting your call."
Wait for user to answer
Step 3: Call Lead Second

Once user answers, use Twilio API to call Lead's phone number FROM tenant's Twilio number
Bridge both calls into conference
Play consent message to both parties
Start recording
Update CallRecord status to IN_PROGRESS
Step 4: Call Ended

Webhook received with call completion
Update CallRecord status to COMPLETED
Store duration, end time
Set recording_status = PENDING
Recording Handling:

Recording Ready Webhook:

Webhook contains: CallSid, RecordingUrl, RecordingDuration
Download recording file from Twilio
Store recording in FileStorageService (tenant-specific folder)
Store File Storage reference URL in CallRecord recording_url
Update recording_duration_seconds
Update recording_status = AVAILABLE
Queue transcription job via TranscriptionJobService
TwiML Generation:

Generate valid TwiML XML responses for:
Playing consent message
IVR menu prompts
Call routing instructions
Conference bridging
Recording start commands
Lead Matching:

For inbound calls: Pass caller from_number to LeadMatchingService
For outbound calls: Lead is already known (lead_id provided)
Update CallRecord with lead_id once matched
Error Handling:

Twilio API error (e.g., invalid number) → Update CallRecord status to FAILED, store error message
Recording download failed → Retry 3 times, then mark recording_status = FAILED
TwiML generation error → Return error to Twilio, log for debugging
Integration Points:

TwilioWebhookService → Receive webhooks
LeadMatchingService → Match calls to Leads
IvrConfigurationService → Execute IVR logic
OfficeBypassService → Handle bypass calls
FileStorageService → Store recordings
TranscriptionJobService → Queue transcription jobs
Twilio API → Initiate calls, start recordings, generate TwiML
4.4 SmsManagementService
Purpose: Manage SMS lifecycle, send/receive messages, link messages to Leads

Responsibilities:

Inbound SMS Handling:

Step 1: SMS Received

Webhook contains: MessageSid, From (sender number), To (tenant's Twilio number), Body (message text)
Create SmsRecord with status DELIVERED, direction INBOUND
Store twilio_message_sid, from_number, to_number, message_body
Step 2: Lead Matching

Pass sender from_number to LeadMatchingService
If Lead found → Link SmsRecord to Lead
If no Lead found → Auto-create Lead, link SmsRecord
Step 3: Store and Acknowledge

Save SmsRecord to database
Return 200 OK to Twilio (acknowledge receipt)
Outbound SMS Handling:

Step 1: User Initiates SMS

Input: lead_id, message_body
Validate inputs (message body not empty, max length)
Retrieve Lead's phone number
Create SmsRecord with status QUEUED, direction OUTBOUND
Store sent_by (user ID), message_body, lead_id
Step 2: Send to Twilio

Use Twilio API to send SMS FROM tenant's Twilio number TO Lead's phone number
Twilio returns MessageSid
Update SmsRecord with twilio_message_sid
Update status to SENT
Step 3: Delivery Status Update

Twilio sends status webhook (delivered, failed, undelivered)
Update SmsRecord status based on webhook
If failed → Store error code and message
Error Handling:

Twilio API error → Update SmsRecord status to FAILED, store error
Invalid phone number → Return validation error to user, do not create record
Tenant Twilio config not active → Return error to user
Integration Points:

TwilioWebhookService → Receive webhooks
LeadMatchingService → Match SMS to Leads
Twilio API → Send SMS, receive delivery status
PrismaService → Store SmsRecords
4.5 IvrConfigurationService
Purpose: Manage IVR menu configuration, execute IVR logic during calls

Responsibilities:

Configuration Management:

Create/update IVR configuration for tenant
Validate IVR menu structure (max 10 options, unique digits 0-9)
Validate action configurations (phone numbers in E.164, URLs valid HTTPS)
Store IVR configuration in database
IVR Execution:

Step 1: Generate IVR Menu TwiML

Input: tenant_id, call_record_id
Retrieve IvrConfiguration for tenant
Generate TwiML that:
Plays consent message: "This call will be recorded for training purposes."
Plays greeting message
Plays menu options (e.g., "Press 1 for quotes, Press 2 for support...")
Waits for DTMF input with timeout
Step 2: Handle IVR Input

Webhook contains: CallSid, Digits (user pressed digit)
Retrieve CallRecord by twilio_call_sid
Retrieve IvrConfiguration for tenant
Find menu option matching pressed digit
Execute configured action:
route_to_number: Generate TwiML to transfer call to specified number
route_to_default: Generate TwiML to transfer call to default/queue
trigger_webhook: Send POST request to configured webhook URL with call context, then end call or route
voicemail: Generate TwiML to record voicemail, save to FileStorageService
Store executed action in CallRecord ivr_action_taken JSON field
Step 3: Handle No Input (Timeout)

If timeout occurs (no digit pressed within timeout_seconds)
Retry menu up to max_retries times
If max retries exceeded → Execute default action from IVR configuration
Validation Logic:

Menu options: Each must have unique digit (0-9)
Phone numbers: Must be valid E.164 format
Webhook URLs: Must be valid HTTPS URLs
Greeting message: Max length validation
Timeout: Between 5-60 seconds
Max retries: Between 1-5
Error Handling:

Invalid menu option selected → Replay menu
Webhook POST failed → Log error, continue with fallback action
TwiML generation error → Route to default handler, log error
Integration Points:

CallManagementService → Receive IVR execution requests
TwilioWebhookService → Receive IVR input webhooks
FileStorageService → Store voicemail recordings
External webhooks → Trigger automation (out of system scope)
4.6 OfficeBypassService
Purpose: Handle office number bypass logic, route calls for whitelisted office numbers

Responsibilities:

Whitelist Management:

Add office number to whitelist for tenant
Remove office number from whitelist
Update office number label
Activate/deactivate office number
Validate phone numbers in E.164 format
Bypass Call Handling:

Step 1: Detect Whitelisted Caller

Input: tenant_id, caller_from_number
Query OfficeNumberWhitelist: WHERE tenant_id = ? AND phone_number = ? AND status = ACTIVE
Return true/false
Step 2: Prompt for Target Number

Generate TwiML that plays: "You've reached [Tenant Name]. Please enter the phone number you'd like to call."
Wait for DTMF input (expect 10 digits)
Validate input (must be numeric, 10 digits)
Step 3: Initiate Outbound Call

Format entered digits to E.164 (prepend +1 if U.S.)
Use Twilio API to call target number FROM tenant's Twilio number
Bridge caller to target number
Play consent message to both parties
Start call recording
Create CallRecord with call_type = OFFICE_BYPASS_CALL
Step 4: Link to Lead (If Applicable)

Pass target number to LeadMatchingService
If Lead found for target number → Link CallRecord to Lead
If no Lead found → CallRecord remains unlinked (can be manually linked later)
Retry Logic:

If invalid input (non-numeric, wrong length) → Re-prompt up to 3 times
If max retries exceeded → End call, thank caller
Error Handling:

Target number unreachable → Play error message to caller, offer to re-enter number
Twilio API error → Log error, end call gracefully
Integration Points:

CallManagementService → Detect bypass eligibility
LeadMatchingService → Match target number to Lead
Twilio API → Initiate outbound call, bridge calls
4.7 LeadMatchingService
Purpose: Match phone numbers to existing Leads, auto-create Leads for unknown numbers

Responsibilities:

Lead Matching Logic:

Input: tenant_id, phone_number

Process:

Normalize phone number to E.164 format (if not already)
Query Leads table: WHERE tenant_id = ? AND phone = ?
If match found → Return Lead
If no match → Proceed to auto-creation
Auto-Creation Logic:

Trigger: Inbound SMS or call from unknown number

Steps:

Create new Lead with:
tenant_id → From request context
first_name → Phone number (e.g., "+19781234567")
last_name → "Phone/SMS lead"
phone → Caller/sender phone number (E.164 format)
address → Tenant's office main address (retrieved from TenantSettings)
origin → "Phone/SMS"
status → Default Lead status (e.g., "New")
assigned_to → Null (unassigned)
created_by → System user ID (special system user for auto-generated records)
Save Lead to database
Return newly created Lead
Phone Number Normalization:

Accept various formats: (978) 896-8047, 978-896-8047, 9788968047, +19788968047
Normalize all to E.164: +19788968047
Use phone number validation library (e.g., libphonenumber)
Reject invalid phone numbers (wrong country code, too short, etc.)
Cross-Tenant Isolation:

Same phone number CAN exist in multiple tenants
Unique constraint: tenant_id + phone_number
No data sharing between tenants
Error Handling:

Invalid phone number format → Return validation error, do not create Lead
Tenant office address not configured → Use placeholder address, flag for manual update
Database constraint violation (duplicate) → Return existing Lead (race condition handling)
Integration Points:

CallManagementService → Match calls to Leads
SmsManagementService → Match SMS to Leads
TenantService → Retrieve office address for auto-creation
PrismaService → Query Leads, create new Leads
4.8 TranscriptionProviderService
Purpose: Manage transcription provider registry, validate credentials, configure providers

Responsibilities:

Provider Registry Management:

Register new transcription provider (System Admin only)
Update provider configuration
Activate/deactivate provider
Set system default provider
Validate provider-specific configuration JSON
Provider Types:

openai_whisper → OpenAI Whisper API
oracle → Oracle transcription service (if available)
assemblyai → AssemblyAI API
deepgram → Deepgram API
custom → Custom transcription endpoint
Configuration Validation:

OpenAI Whisper:

Required fields: api_key, model (default: "whisper-1")
Optional fields: language, temperature, response_format
Validation: Test API key by making test transcription call
Oracle:

Required fields: TBD (depends on Oracle service availability)
Custom Provider:

Required fields: endpoint_url, api_key (if applicable)
Validation: Test endpoint by sending sample audio
Credential Encryption:

Use EncryptionService to encrypt configuration_json before storing
Decrypt only when executing transcription job
Usage Tracking:

Track transcriptions per month per provider
If usage_limit is set → Enforce limit (reject jobs if exceeded)
Reset usage_current at start of each month (cron job)
Provider Selection Logic:

Used by TranscriptionJobService when queueing jobs
Priority:
Tenant-specific provider (if configured)
System default provider
Fail if neither available
Error Handling:

Invalid configuration JSON → Return validation error, do not save
API key test failed → Return error, do not activate provider
Provider quota exceeded → Return quota error, suggest alternative provider
Integration Points:

EncryptionService → Encrypt/decrypt configuration JSON
TranscriptionJobService → Provide active provider for job execution
PrismaService → Store provider configurations
4.9 TranscriptionJobService
Purpose: Queue and process transcription jobs, handle retries, update transcription records

Responsibilities:

Job Queueing:

Trigger: CallRecord with recording_status = AVAILABLE

Process:

Create BullMQ job with payload:
tenant_id
call_record_id
recording_url (File Storage reference)
Set job priority: Normal (no urgent transcription)
Set job options:
Max attempts: 3
Backoff strategy: Exponential (30 seconds, 2 minutes, 10 minutes)
Update CallRecord recording_status = PROCESSING_TRANSCRIPTION
Create CallTranscription record with status QUEUED
Job Processing (Worker):

Step 1: Retrieve Job Data

Extract tenant_id, call_record_id, recording_url from job payload
Retrieve CallRecord from database
Verify recording file exists in FileStorageService
Step 2: Select Transcription Provider

Query TranscriptionProviderConfiguration:
First, check if tenant has custom provider
If not, use system default provider (is_system_default = true)
If no provider available → Fail job, log error
Step 3: Check Usage Limits

If provider has usage_limit → Check usage_current < usage_limit
If limit exceeded → Fail job with "quota exceeded" error, alert System Admin
Step 4: Download Recording

Download recording file from FileStorageService
Verify file integrity (non-zero size, valid audio format)
Step 5: Execute Transcription

Decrypt provider configuration_json to get API key and settings
Call transcription provider API with recording file
Wait for transcription response (may be async depending on provider)
Parse response to extract:
Transcription text
Language detected
Confidence score (if available)
Step 6: Store Transcription

Update CallTranscription record:
transcription_text → Full text
language_detected → ISO code
confidence_score → Decimal value
status = COMPLETED
completed_at → Current timestamp
cost → From provider response (if available)
Update CallRecord recording_status = TRANSCRIBED
Increment provider usage_current by 1
Step 7: Job Completed

Mark BullMQ job as complete
Return success
Retry Logic:

If transcription fails (API error, timeout, etc.) → Retry with backoff
Attempt 1: Wait 30 seconds, retry
Attempt 2: Wait 2 minutes, retry
Attempt 3: Wait 10 minutes, retry
If all attempts fail → Update CallTranscription status = FAILED, store error_message
Error Handling:

Recording file missing → Mark as FAILED, do not retry
Provider API error → Retry with backoff
Invalid API response → Log error, retry
Quota exceeded → Mark as FAILED, alert System Admin
SLA Monitoring:

Track job completion time (from queued to completed)
Alert if transcription takes longer than 30 minutes
Generate report of failed transcriptions for System Admin
Integration Points:

BullMQ → Job queue management
CallManagementService → Trigger job queueing when recording ready
FileStorageService → Download recording files
TranscriptionProviderService → Get active provider configuration
OpenAI/Oracle/Custom APIs → Execute transcription
PrismaService → Update CallTranscription and CallRecord
4.10 TwilioUsageTrackingService
Purpose: Track Twilio usage via API, generate reports, calculate costs

Responsibilities:

Usage Data Collection:

For each TwilioProviderConfiguration, periodically sync usage data from Twilio API
Usage data includes:
Total calls (inbound/outbound)
Total SMS (inbound/outbound)
Call duration (total minutes)
SMS count
Cost per call/SMS (from Twilio)
Total cost
Store usage data in tenant-specific usage records (may require new table: TwilioUsageRecord)
Sync Frequency:

Run nightly cron job to sync usage for all active configurations
Update last_synced_at timestamp after successful sync
Usage Reporting:

Generate usage reports for tenants:
Date range: Daily, Weekly, Monthly
Metrics: Calls, SMS, Duration, Cost
Breakdown by direction (inbound vs. outbound)
System Admin can view aggregated usage across all tenants
Cost Calculation:

For Model A (tenant-owned account): Track usage only, no billing (tenant pays Twilio directly)
For Model B (system-managed account): Track usage and calculate cost for internal billing
Error Handling:

Twilio API unreachable → Log error, skip sync, retry next cycle
Invalid credentials (for Model A) → Alert tenant, mark configuration as SUSPENDED
Integration Points:

Twilio API → Fetch usage data
TwilioProviderService → Get active configurations
PrismaService → Store usage records
5. API ENDPOINT CONTRACTS
Important: These are contract definitions (inputs, outputs, behavior), NOT implementation code.

5.1 Twilio Provider Configuration
POST /api/communication/twilio/configure
Purpose: Create or update Twilio provider configuration for tenant

Authentication: Required (Tenant Admin or System Admin)

Request Body:

{
  deployment_model: "OWN_ACCOUNT" | "SYSTEM_MANAGED"
  account_sid?: string (required if OWN_ACCOUNT)
  auth_token?: string (required if OWN_ACCOUNT)
  phone_number?: string (required if OWN_ACCOUNT)
}
Validation:

deployment_model required
If OWN_ACCOUNT: account_sid, auth_token, phone_number all required
Phone number must be E.164 format
Credentials must be valid (test connection)
Success Response (201):

{
  success: true
  configuration: {
    id: string
    tenant_id: string
    deployment_model: string
    phone_number: string
    status: string
    webhook_urls: object
    created_at: timestamp
  }
}
Error Responses:

400: Invalid input, validation failed
401: Unauthorized
403: Insufficient permissions
409: Configuration already exists for tenant
500: Twilio API error
GET /api/communication/twilio/configuration
Purpose: Retrieve tenant's Twilio configuration

Authentication: Required (Tenant User with permission)

Query Parameters: None

Success Response (200):

{
  success: true
  configuration: {
    id: string
    deployment_model: string
    phone_number: string
    status: string
    webhook_urls: object
    usage_tracking_enabled: boolean
    created_at: timestamp
    updated_at: timestamp
  }
}
Note: Credentials (Account SID, Auth Token) NEVER returned in API responses

Error Responses:

401: Unauthorized
404: Configuration not found
DELETE /api/communication/twilio/configuration
Purpose: Deactivate Twilio provider configuration

Authentication: Required (Tenant Admin)

Success Response (200):

{
  success: true
  message: "Twilio provider deactivated"
}
Behavior:

Sets configuration status = INACTIVE
Does NOT delete historical CallRecords or SmsRecords
Webhooks stop working (returns 404 to Twilio)
Error Responses:

401: Unauthorized
403: Insufficient permissions
404: Configuration not found
5.2 IVR Configuration
POST /api/communication/ivr/configure
Purpose: Create or update IVR menu configuration

Authentication: Required (Tenant Admin)

Request Body:

{
  ivr_enabled: boolean
  greeting_message: string
  menu_options: array[{
    digit: string (0-9)
    action: "route_to_number" | "route_to_default" | "trigger_webhook" | "voicemail"
    label: string
    config: object (varies by action)
  }]
  default_action: object
  timeout_seconds: integer (5-60)
  max_retries: integer (1-5)
}
Validation:

menu_options max 10 entries
Each digit must be unique (0-9)
Phone numbers in config must be E.164 format
Webhook URLs must be HTTPS
Success Response (201):

{
  success: true
  configuration: {
    id: string
    tenant_id: string
    ivr_enabled: boolean
    menu_options: array
    created_at: timestamp
  }
}
Error Responses:

400: Invalid input, validation failed
401: Unauthorized
403: Insufficient permissions
GET /api/communication/ivr/configuration
Purpose: Retrieve tenant's IVR configuration

Authentication: Required (Tenant User with permission)

Success Response (200):

{
  success: true
  configuration: {
    id: string
    ivr_enabled: boolean
    greeting_message: string
    menu_options: array
    default_action: object
    timeout_seconds: integer
    max_retries: integer
  }
}
Error Responses:

401: Unauthorized
404: Configuration not found
5.3 Office Number Whitelist
POST /api/communication/office-whitelist
Purpose: Add phone number to office whitelist

Authentication: Required (Tenant Admin)

Request Body:

{
  phone_number: string (E.164 format)
  label: string
}
Validation:

phone_number required, must be E.164 format
Unique constraint: Cannot add same number twice for same tenant
Success Response (201):

{
  success: true
  whitelist_entry: {
    id: string
    phone_number: string
    label: string
    status: "ACTIVE"
  }
}
Error Responses:

400: Invalid phone number
401: Unauthorized
409: Phone number already whitelisted
GET /api/communication/office-whitelist
Purpose: List all whitelisted office numbers for tenant

Authentication: Required (Tenant User with permission)

Success Response (200):

{
  success: true
  whitelist: array[{
    id: string
    phone_number: string
    label: string
    status: string
    created_at: timestamp
  }]
}
DELETE /api/communication/office-whitelist/:id
Purpose: Remove phone number from whitelist

Authentication: Required (Tenant Admin)

Success Response (200):

{
  success: true
  message: "Whitelist entry removed"
}
Error Responses:

401: Unauthorized
404: Entry not found
5.4 Outbound SMS
POST /api/communication/sms/send
Purpose: Send SMS to Lead

Authentication: Required (Tenant User with communication.sms.send permission)

Request Body:

{
  lead_id: string (UUID)
  message_body: string (max 1600 characters)
}
Validation:

lead_id must exist in tenant's Leads
message_body not empty, max 1600 characters
Lead must have valid phone number
Success Response (201):

{
  success: true
  sms_record: {
    id: string
    lead_id: string
    message_body: string
    status: "SENT"
    sent_at: timestamp
  }
}
Error Responses:

400: Invalid input
401: Unauthorized
403: Insufficient permissions
404: Lead not found
500: Twilio API error
5.5 Outbound Call
POST /api/communication/call/initiate
Purpose: Initiate call to Lead

Authentication: Required (Tenant User with communication.calls.make permission)

Request Body:

{
  lead_id: string (UUID)
  user_phone_number: string (E.164 format)
  call_reason: string
}
Validation:

lead_id must exist in tenant's Leads
user_phone_number must be valid E.164 format
Lead must have valid phone number
Success Response (201):

{
  success: true
  call_record: {
    id: string
    lead_id: string
    status: "INITIATED"
    call_reason: string
    initiated_by: string (user ID)
  }
}
Behavior:

Creates CallRecord with status INITIATED
Calls user's phone first
Once user answers, calls Lead and bridges
Error Responses:

400: Invalid input
401: Unauthorized
403: Insufficient permissions
404: Lead not found
500: Twilio API error
5.6 Call/SMS History
GET /api/communication/history
Purpose: Retrieve call and SMS history for tenant

Authentication: Required (Tenant User with communication.history.view permission)

Query Parameters:

lead_id (optional) → Filter by specific Lead
type (optional) → Filter by call or sms
direction (optional) → Filter by inbound or outbound
date_from (optional) → Start date (ISO format)
date_to (optional) → End date (ISO format)
page (optional, default: 1) → Page number
limit (optional, default: 100, max: 100) → Results per page
Success Response (200):

{
  success: true
  history: array[{
    type: "call" | "sms"
    id: string
    lead: {
      id: string
      name: string
    }
    direction: string
    from_number: string
    to_number: string
    status: string
    created_at: timestamp
    
    // Call-specific fields
    recording_url?: string
    recording_duration_seconds?: integer
    transcription_available?: boolean
    
    // SMS-specific fields
    message_body?: string
  }]
  pagination: {
    total: integer
    page: integer
    limit: integer
    total_pages: integer
  }
}
Error Responses:

401: Unauthorized
403: Insufficient permissions
5.7 Recording Playback
GET /api/communication/call/:id/recording
Purpose: Retrieve call recording URL for playback

Authentication: Required (Tenant User with communication.recordings.access permission)

Path Parameters:

id → CallRecord ID
Success Response (200):

{
  success: true
  recording: {
    url: string (signed URL, expires in 1 hour)
    duration_seconds: integer
    transcription_available: boolean
  }
}
Behavior:

Returns signed URL from FileStorageService
URL expires after 1 hour for security
Error Responses:

401: Unauthorized
403: Insufficient permissions
404: Call record or recording not found
GET /api/communication/call/:id/recording/download
Purpose: Download call recording file

Authentication: Required (Tenant User with communication.recordings.access permission)

Path Parameters:

id → CallRecord ID
Success Response (200):

Binary file download (MP3 or WAV format)
Content-Disposition: attachment; filename="call_{id}.mp3"
Error Responses:

401: Unauthorized
403: Insufficient permissions
404: Call record or recording not found
5.8 Transcription
GET /api/communication/call/:id/transcription
Purpose: Retrieve call transcription

Authentication: Required (Tenant User with communication.transcriptions.view permission)

Path Parameters:

id → CallRecord ID
Success Response (200):

{
  success: true
  transcription: {
    text: string
    language_detected: string
    confidence_score: decimal
    status: string
    created_at: timestamp
    completed_at: timestamp
  }
}
Error Responses:

401: Unauthorized
403: Insufficient permissions
404: Call record or transcription not found
425: Transcription still processing (status: QUEUED or PROCESSING)
5.9 Transcription Search
GET /api/communication/transcriptions/search
Purpose: Full-text search across all transcriptions for tenant

Authentication: Required (Tenant User with communication.transcriptions.view permission)

Query Parameters:

query (required) → Search term(s)
page (optional, default: 1)
limit (optional, default: 20, max: 100)
Success Response (200):

{
  success: true
  results: array[{
    call_record_id: string
    transcription_text: string (snippet with search highlights)
    lead: {
      id: string
      name: string
    }
    call_date: timestamp
    relevance_score: decimal
  }]
  pagination: {
    total: integer
    page: integer
    limit: integer
  }
}
Behavior:

Uses full-text search on CallTranscription.transcription_text
Returns snippets with search term highlighted
Sorted by relevance score
Error Responses:

400: Missing query parameter
401: Unauthorized
403: Insufficient permissions
5.10 Webhook Endpoints (Twilio → System)
Note: These are NOT called by frontend; they receive webhooks from Twilio.

POST /api/twilio/sms/inbound
Purpose: Receive inbound SMS from Twilio

Authentication: Twilio signature validation

Request Body: (Twilio webhook format)

{
  MessageSid: string
  From: string
  To: string
  Body: string
  AccountSid: string
  // ... other Twilio fields
}
Success Response (200):

Empty response (acknowledge receipt)
Behavior:

Validate Twilio signature
Identify tenant from subdomain
Create SmsRecord
Match or auto-create Lead
Return 200 OK
POST /api/twilio/call/inbound
Purpose: Receive inbound call from Twilio

Authentication: Twilio signature validation

Request Body: (Twilio webhook format)

{
  CallSid: string
  From: string
  To: string
  CallStatus: string
  AccountSid: string
  // ... other Twilio fields
}
Success Response (200):

TwiML XML response (IVR menu, routing, consent message)
Behavior:

Validate Twilio signature
Identify tenant from subdomain
Create CallRecord
Check office whitelist
Generate appropriate TwiML (IVR or direct routing)
Return TwiML
POST /api/twilio/call/status
Purpose: Receive call status updates from Twilio

Authentication: Twilio signature validation

Request Body: (Twilio webhook format)

{
  CallSid: string
  CallStatus: string
  CallDuration: integer
  // ... other Twilio fields
}
Success Response (200):

Empty response
Behavior:

Validate Twilio signature
Update CallRecord status and duration
If status completed → Queue transcription job
POST /api/twilio/recording/ready
Purpose: Receive notification when call recording is ready

Authentication: Twilio signature validation

Request Body: (Twilio webhook format)

{
  CallSid: string
  RecordingSid: string
  RecordingUrl: string
  RecordingDuration: integer
  // ... other Twilio fields
}
Success Response (200):

Empty response
Behavior:

Validate Twilio signature
Download recording from Twilio
Store in FileStorageService
Update CallRecord with recording URL
Queue transcription job
POST /api/twilio/ivr/input
Purpose: Receive IVR menu digit input from Twilio

Authentication: Twilio signature validation

Request Body: (Twilio webhook format)

{
  CallSid: string
  Digits: string (pressed digit)
  // ... other Twilio fields
}
Success Response (200):

TwiML XML response (execute menu action)
Behavior:

Validate Twilio signature
Retrieve IvrConfiguration
Execute action for pressed digit
Generate TwiML for next step
5.11 Admin Endpoints
GET /api/admin/communication/twilio/usage
Purpose: View aggregated Twilio usage across all tenants (System Admin only)

Authentication: Required (System Admin)

Query Parameters:

date_from (optional) → Start date
date_to (optional) → End date
tenant_id (optional) → Filter by specific tenant
Success Response (200):

{
  success: true
  usage: array[{
    tenant_id: string
    tenant_name: string
    total_calls: integer
    total_sms: integer
    total_duration_minutes: integer
    total_cost: decimal
    period: { from: date, to: date }
  }]
}
Error Responses:

401: Unauthorized
403: Not System Admin
GET /api/admin/communication/transcriptions/failed
Purpose: View failed transcriptions for debugging (System Admin only)

Authentication: Required (System Admin)

Success Response (200):

{
  success: true
  failed_transcriptions: array[{
    id: string
    tenant_id: string
    call_record_id: string
    provider: string
    error_message: string
    attempts: integer
    created_at: timestamp
  }]
}
6. INTEGRATION WITH EXISTING MODULES
6.1 File Storage Module
Integration Points:

Recording Storage:

Store call recordings in tenant-specific folder structure
Path format: /tenants/{tenant_id}/communication/recordings/{year}/{month}/{call_record_id}.mp3
Use existing FileStorageService methods for upload/download
Generate signed URLs for playback (1-hour expiration)
Voicemail Storage:

Store voicemail recordings in similar structure
Path format: /tenants/{tenant_id}/communication/voicemails/{year}/{month}/{call_record_id}.mp3
File Metadata:

Store file size, duration, format in CallRecord
Link CallRecord to File Storage via recording_url field
6.2 Encryption Service
Integration Points:

Credential Encryption:

Encrypt Twilio Account SID and Auth Token before storing
Encrypt TranscriptionProviderConfiguration configuration_json
Use existing EncryptionService encrypt/decrypt methods
Encryption Scope:

All sensitive API keys and tokens must be encrypted at rest
Decrypt only when needed for API calls
Never expose decrypted values in API responses or logs
6.3 RBAC System
New Permissions Required:

communication.twilio.configure → Configure Twilio provider (Tenant Admin)
communication.ivr.manage → Manage IVR menu (Tenant Admin)
communication.whitelist.manage → Manage office whitelist (Tenant Admin)
communication.sms.send → Send SMS to Leads (Tenant User)
communication.calls.make → Make outbound calls (Tenant User)
communication.history.view → View call/SMS history (Tenant User)
communication.recordings.access → Download/playback recordings (Tenant User)
communication.transcriptions.view → View transcriptions (Tenant User)
communication.admin.usage → View usage reports (System Admin)
Permission Assignment:

Tenant Admin role gets all permissions by default
Tenant User role gets no permissions by default (must be assigned)
System Admin gets all permissions globally
Enforcement:

Every endpoint must check user permissions before execution
Use existing RBAC guards/decorators from Lead360
6.4 Tenant Settings
Required Tenant Data:

Office Address:

Used for auto-created Leads (address field)
Must be configurable in Tenant Settings
If not configured → Use placeholder, flag Lead for manual update
Default Lead Status:

Used when auto-creating Leads from SMS/calls
Should default to "New" or configurable status
6.5 BullMQ Job Queue
New Job Queues:

Transcription Queue:

Queue name: transcription
Concurrency: 5 workers initially (scalable)
Priority: Normal
Retry strategy: 3 attempts, exponential backoff
Usage Sync Queue:

Queue name: twilio-usage-sync
Concurrency: 1 worker (sequential processing)
Schedule: Nightly cron (2 AM)
Retry strategy: 3 attempts
Worker Requirements:

Workers must handle tenant-scoped jobs
Workers must enforce tenant isolation (no cross-tenant access)
Workers must log all errors for debugging
7. ERROR HANDLING STRATEGIES
7.1 Webhook Error Handling
Twilio Signature Validation Failure:

Return 403 Forbidden
Log security alert with IP address, headers
Do NOT process webhook
Tenant Not Found:

Return 404 Not Found
Log error with subdomain for investigation
Alert System Admin if recurring
Database Error During Webhook:

Return 500 Internal Server Error
Allow Twilio to retry (Twilio retries failed webhooks)
Log error with full context
Timeout Risk:

Webhook handlers must respond within 2 seconds
For long operations (e.g., recording download), acknowledge immediately, then queue job
7.2 Twilio API Error Handling
Invalid Credentials:

Return clear error message to user
Suggest re-entering credentials
Do NOT save configuration
Rate Limit Exceeded:

Return 429 Too Many Requests to user
Suggest retry after delay
Log for monitoring
Phone Number Unreachable:

Update CallRecord or SmsRecord status to FAILED
Store Twilio error code and message
Display to user in UI
Network Timeout:

Retry API call up to 3 times
If all retries fail → Return error to user
Log for investigation
7.3 Transcription Error Handling
Provider API Failure:

Retry job with exponential backoff (3 attempts)
If all attempts fail → Mark transcription as FAILED
Store error message for debugging
Recording File Corrupted:

Do NOT retry (corruption won't fix itself)
Mark transcription as FAILED with specific error
Alert System Admin for investigation
Quota Exceeded:

Mark transcription as FAILED with "quota exceeded" message
Alert System Admin
Suggest fallback provider (future enhancement)
Invalid Audio Format:

Log error with file details
Mark transcription as FAILED
Investigate why Twilio sent invalid format
7.4 Database Error Handling
Constraint Violation (Duplicate):

Handle gracefully (e.g., phone number already whitelisted)
Return 409 Conflict to user
Provide helpful error message
Foreign Key Violation:

Indicates data integrity issue (e.g., Lead deleted mid-process)
Return 400 Bad Request
Log error for investigation
Connection Timeout:

Retry database operation up to 3 times
If all retries fail → Return 500 to user
Alert DevOps if recurring
8. SECURITY REQUIREMENTS
8.1 Webhook Security
Signature Validation:

Every Twilio webhook MUST be validated using Twilio's signature
Use Twilio library to validate signature against Auth Token
Reject invalid signatures immediately (return 403)
Never skip validation, even in development
HTTPS Only:

All webhook URLs must use HTTPS
Reject HTTP webhooks (Twilio should be configured for HTTPS only)
Rate Limiting:

Implement rate limiting on webhook endpoints to prevent abuse
Limit: 100 requests per minute per tenant
Return 429 if exceeded
8.2 Credential Security
Encryption at Rest:

All API credentials (Twilio Account SID, Auth Token, transcription API keys) must be encrypted before storing
Use EncryptionService with strong encryption (AES-256)
Decryption Scope:

Decrypt credentials only when needed for API calls
Never expose decrypted credentials in API responses
Never log decrypted credentials (log only encrypted or redacted versions)
Access Control:

Only authorized services can decrypt credentials
Frontend NEVER receives decrypted credentials
8.3 Tenant Isolation
Database Query Enforcement:

Every database query MUST include WHERE tenant_id = ?
Use Prisma middleware to enforce tenant filtering globally
No query should ever return cross-tenant data
Webhook Routing:

Subdomain parsing must be reliable
Validate tenant exists before processing webhook
Reject webhooks for inactive tenants
File Storage Isolation:

Call recordings stored in tenant-specific folders
File URLs must be signed and expire after 1 hour
Users cannot access recordings from other tenants
8.4 Input Validation
Phone Number Validation:

Use libphonenumber library for robust validation
Accept only E.164 format for storage
Normalize input phone numbers before querying database
URL Validation:

Webhook URLs in IVR configuration must be HTTPS
Validate URL format before saving
Text Input Sanitization:

SMS message bodies: Sanitize for SQL injection, XSS (though Prisma handles SQL)
IVR greeting messages: Sanitize for TwiML injection
8.5 RBAC Enforcement
Permission Checks:

Every API endpoint must check user permissions before execution
Use existing Lead360 RBAC guards
Never trust client-side permission checks
Tenant Context:

Authenticated user's tenant must match resource tenant
System Admin can access all tenants
Tenant users can ONLY access their own tenant data
9. TESTING REQUIREMENTS
9.1 Unit Testing
Service Layer Tests:

Test each service method in isolation
Mock external dependencies (Twilio API, FileStorageService, etc.)
Test happy path and error scenarios
Target: 90% code coverage
Key Test Cases:

TwilioProviderService:

Valid credential configuration (Model A and Model B)
Invalid credentials handling
Webhook URL generation
Tenant switching between models
CallManagementService:

Inbound call routing (IVR enabled/disabled)
Outbound call initiation
Office bypass detection
Call state transitions
LeadMatchingService:

Existing Lead match
Auto-create new Lead
Phone number normalization
Cross-tenant isolation
TranscriptionJobService:

Job queueing and processing
Provider selection logic
Retry mechanism
Error handling
9.2 Integration Testing
API Endpoint Tests:

Test all endpoints with valid and invalid inputs
Test authentication and authorization
Test tenant isolation (user from Tenant A cannot access Tenant B data)
Test pagination and filtering
Webhook Tests:

Simulate Twilio webhooks with valid signatures
Test invalid signature rejection
Test tenant identification from subdomain
Test idempotent webhook handling (duplicate detection)
Database Integration:

Test entity relationships
Test unique constraints
Test foreign key cascades
Test full-text search on transcriptions
9.3 End-to-End Testing
SMS Flow:

Send outbound SMS via API
Verify SmsRecord created
Simulate Twilio delivery webhook
Verify status updated to DELIVERED
Simulate inbound SMS webhook
Verify Lead matched or auto-created
Verify SmsRecord linked to Lead
Outbound Call Flow:

Initiate call via API
Verify CallRecord created
Simulate Twilio call answered webhook
Verify status updated to IN_PROGRESS
Simulate call ended webhook
Verify recording URL stored
Verify transcription job queued
Inbound Call Flow (With IVR):

Simulate inbound call webhook
Verify CallRecord created
Verify IVR TwiML returned
Simulate IVR input webhook (digit pressed)
Verify action executed
Simulate call ended webhook
Verify Lead matched or auto-created
Office Bypass Flow:

Simulate inbound call from whitelisted number
Verify bypass detected
Verify prompt TwiML returned (no IVR)
Simulate DTMF input (target number)
Verify outbound call initiated
Verify CallRecord linked to Lead (if target matches)
9.4 Performance Testing
Webhook Handler Performance:

Target: Respond to Twilio webhook within 500ms (well under 2-second timeout)
Test with 100 concurrent webhooks
Monitor database query performance
Transcription Job Processing:

Target: Process transcription within 30 minutes (SLA)
Test with 10 concurrent jobs
Monitor worker CPU/memory usage
API Response Time:

Target: 95th percentile response time < 300ms for read operations
Target: 95th percentile response time < 1 second for write operations
Test with 100 concurrent users
9.5 Security Testing
Webhook Signature Bypass Attempt:

Attempt to send webhook without valid signature
Verify rejection (403 Forbidden)
Cross-Tenant Data Access Attempt:

User from Tenant A attempts to access Tenant B's CallRecord
Verify rejection (403 Forbidden or 404 Not Found)
Credential Exposure Test:

Check API responses for decrypted credentials
Verify credentials never appear in logs
SQL Injection Test:

Attempt SQL injection in SMS message body
Verify Prisma protects against injection
10. DEVELOPMENT TASK BREAKDOWN
Note: This is a high-level breakdown. Detailed tasks will be created during sprint planning.

Phase 1: Foundation (Sprint 1)
Database & Models:

Create Prisma schema entities (all 7 entities)
Generate and run migration
Add full-text index on transcriptions
Seed system default transcription provider (if applicable)
Core Services:

Implement TwilioProviderService (configuration management)
Implement EncryptionService integration (encrypt/decrypt credentials)
Implement TwilioWebhookService (signature validation, tenant identification, routing)
API Endpoints:

POST /api/communication/twilio/configure
GET /api/communication/twilio/configuration
DELETE /api/communication/twilio/configuration
Testing:

Unit tests for TwilioProviderService
Integration tests for configuration endpoints
Webhook signature validation tests
Phase 2: SMS Functionality (Sprint 2)
SMS Services:

Implement SmsManagementService (inbound/outbound SMS)
Implement LeadMatchingService (match/auto-create Leads)
API Endpoints:

POST /api/communication/sms/send
POST /api/twilio/sms/inbound (webhook)
GET /api/communication/history (SMS only)
Testing:

Unit tests for SmsManagementService and LeadMatchingService
E2E tests for SMS flow (send → webhook → delivery)
Lead auto-creation tests
Phase 3: Call Functionality (Sprint 3)
Call Services:

Implement CallManagementService (inbound/outbound calls, recording)
Implement IvrConfigurationService (IVR menu execution)
Implement OfficeBypassService (whitelist, bypass routing)
API Endpoints:

POST /api/communication/call/initiate
POST /api/twilio/call/inbound (webhook)
POST /api/twilio/call/status (webhook)
POST /api/twilio/recording/ready (webhook)
POST /api/twilio/ivr/input (webhook)
GET /api/communication/call/:id/recording
GET /api/communication/call/:id/recording/download
Testing:

Unit tests for CallManagementService
E2E tests for outbound call flow
E2E tests for inbound call flow (IVR and bypass)
Recording storage tests
Phase 4: IVR & Whitelist Management (Sprint 4)
IVR Services:

Complete IVR configuration validation
Implement IVR action execution (route, webhook, voicemail)
API Endpoints:

POST /api/communication/ivr/configure
GET /api/communication/ivr/configuration
POST /api/communication/office-whitelist
GET /api/communication/office-whitelist
DELETE /api/communication/office-whitelist/:id
Testing:

IVR configuration validation tests
IVR menu execution tests
Office whitelist CRUD tests
Phase 5: Transcription System (Sprint 5)
Transcription Services:

Implement TranscriptionProviderService (provider registry)
Implement TranscriptionJobService (job queue, workers)
Integrate OpenAI Whisper API
API Endpoints:

GET /api/communication/call/:id/transcription
GET /api/communication/transcriptions/search
BullMQ Workers:

Transcription job worker
Usage sync job worker (cron)
Testing:

Unit tests for transcription services
Integration tests with OpenAI Whisper API
Job retry and error handling tests
Full-text search tests
Phase 6: Usage Tracking & Admin (Sprint 6)
Usage Tracking:

Implement TwilioUsageTrackingService
Implement nightly usage sync cron job
Store usage data in database
API Endpoints:

GET /api/admin/communication/twilio/usage
GET /api/admin/communication/transcriptions/failed
Testing:

Usage sync tests
Admin reporting tests
Phase 7: Call History & Playback (Sprint 7)
History Services:

Implement unified call/SMS history query
Implement pagination and filtering
Implement recording playback (signed URLs)
API Endpoints:

GET /api/communication/history (unified, with filters)
Testing:

History query performance tests
Pagination tests
Signed URL generation and expiration tests
Phase 8: RBAC & Security Hardening (Sprint 8)
RBAC:

Add new permissions to RBAC system
Implement permission guards on all endpoints
Test tenant isolation across all endpoints
Security:

Implement rate limiting on webhook endpoints
Add security headers
Conduct security testing (signature bypass, cross-tenant access, credential exposure)
Testing:

RBAC enforcement tests
Security vulnerability tests
Load testing
Phase 9: Performance Optimization & Monitoring (Sprint 9)
Optimization:

Optimize database queries (add indexes if needed)
Optimize webhook response time
Scale BullMQ workers if needed
Monitoring:

Add logging for all critical operations
Add metrics for webhook response time, transcription SLA, API performance
Set up alerts for failed transcriptions, webhook errors
Testing:

Performance testing under load
Monitor SLA compliance
11. RISKS & MITIGATION
11.1 Technical Risks
Risk: Twilio Webhook Downtime

Impact: Calls/SMS not recorded
Mitigation: Implement retry queue for failed webhooks; monitor webhook success rate; alert on failures
Risk: Transcription Provider Rate Limits

Impact: Delayed transcriptions
Mitigation: Implement fallback providers; queue management with priority; scale workers
Risk: Recording Storage Costs

Impact: High storage costs for long recordings
Mitigation: Implement compression (future); monitor storage usage; implement retention policy (future)
Risk: Concurrent Transcription Jobs Overload

Impact: Queue backlog, SLA breaches
Mitigation: Scale workers horizontally; implement job priority; monitor queue depth
11.2 Integration Risks
Risk: FileStorageService Unavailable

Impact: Recording storage fails
Mitigation: Implement retry logic; queue failed uploads; alert on persistent failures
Risk: Twilio API Changes

Impact: Webhook format changes break handlers
Mitigation: Use Twilio SDK (abstracts API changes); monitor Twilio changelog; test webhook changes in staging
Risk: OpenAI Whisper API Downtime

Impact: Transcriptions fail
Mitigation: Implement retry logic; alert on high failure rate; consider fallback provider
11.3 Data Integrity Risks
Risk: Lead Phone Number Changed

Impact: New calls/SMS don't match existing Lead
Mitigation: Audit log phone number changes; warn user when changing; provide manual merge tool (future)
Risk: Duplicate CallRecords (Race Condition)

Impact: Same call recorded twice
Mitigation: Idempotent webhook handlers; check twilio_call_sid uniqueness before creating record
12. DEPLOYMENT CHECKLIST
Pre-Deployment:
 All database migrations tested and reviewed
 All environment variables configured (Twilio credentials, OpenAI API key)
 BullMQ Redis instance provisioned and accessible
 HTTPS endpoints configured for webhooks
 Rate limiting configured on webhook endpoints
 Security headers added to all endpoints
 RBAC permissions added and assigned to roles
 Encryption keys rotated (if needed)
Deployment:
 Deploy backend services to staging environment
 Run database migration on staging
 Test webhook endpoints with Twilio test tools
 Test transcription job processing
 Conduct security testing
 Conduct performance testing
 Deploy to production
 Monitor logs for errors
 Verify webhook success rate
Post-Deployment:
 Configure system default transcription provider
 Test end-to-end SMS flow in production
 Test end-to-end call flow in production
 Monitor transcription SLA compliance
 Monitor usage tracking accuracy
 Set up alerts for critical failures
13. OPEN QUESTIONS FOR DEVELOPMENT TEAM
None at this time. All requirements clarified.

14. APPENDICES
Appendix A: Twilio Webhook Event Types
SMS Webhooks:

message.sent → SMS sent to Twilio
message.delivered → SMS delivered to recipient
message.failed → SMS delivery failed
message.received → Inbound SMS received
Call Webhooks:

call.initiated → Call started
call.ringing → Call ringing
call.answered → Call answered
call.in-progress → Call active
call.completed → Call ended
call.busy → Recipient busy
call.no-answer → Recipient didn't answer
call.failed → Call failed
Recording Webhooks:

recording.ready → Recording available for download
Appendix B: Transcription Provider Comparison
Provider	Cost per Minute	Turnaround Time	Accuracy	Notes
OpenAI Whisper	$0.006	10-60 seconds	High	Recommended default
Oracle	TBD (verify free tier)	TBD	TBD	Research availability
AssemblyAI	$0.025	5-30 seconds	Very High	Premium option
Deepgram	$0.0125	5-15 seconds	High	Good balance
Appendix C: Phone Number Formats
E.164 Format (Standard):

Format: +[country code][number]
Example: +19788968047 (U.S.)
Used for storage and API calls
Display Formats (Frontend):

U.S.: (978) 896-8047
International: +44 20 7946 0958
Normalization Process:

Accept user input in any format
Use libphonenumber to parse and validate
Convert to E.164 for storage
Convert to display format for UI
END OF BACKEND IMPLEMENTATION GUIDE

✅ BACKEND IMPLEMENTATION GUIDE COMPLETE
Document Length: ~20,000 tokens
Total Sections: 14 + 3 Appendices

📊 WHAT THIS GUIDE PROVIDES
For Backend Developers:

Clear service responsibilities and boundaries
Data model structure and relationships
API contract definitions (inputs/outputs)
Integration requirements with existing modules
Error handling strategies
Security requirements
Testing requirements
For Sprint Planning:

9-phase development breakdown
Task dependencies clearly identified
Risk mitigation strategies
Deployment checklist
For QA Engineers:

Comprehensive testing requirements
Unit, integration, and E2E test scenarios
Performance testing targets
Security testing checklist
