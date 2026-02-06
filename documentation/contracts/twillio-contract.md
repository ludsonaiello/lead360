FEATURE CONTRACT: TWILIO SMS/CALLS COMMUNICATION PROVIDER
Document Version: 1.0
Last Updated: February 5, 2026
Owner: Ludson (Project Manager)
Status: APPROVED FOR DEVELOPMENT

1. PURPOSE & BUSINESS VALUE
1.1 Purpose
Extend the Lead360 Communication Module to support SMS and voice call capabilities through Twilio integration, enabling tenants to:

Send and receive SMS messages linked to Leads
Make and receive phone calls with automatic recording
Configure interactive voice response (IVR) menus
Transcribe call recordings for searchability
Track communication history per Lead
Use office phone bypass for outbound calling
Prepare for future AI voice agent integration

1.2 Business Value

Unified Communication Hub: All SMS and call interactions stored with Lead context
Compliance & Audit: Automatic recording and transcription of all calls
Professional Presentation: Tenants use business phone numbers instead of personal numbers
Operational Efficiency: Office bypass allows employees to make outbound calls from any device while presenting business number
Customer Experience: IVR menus route customers to appropriate resources
Future AI Readiness: Architecture supports AI voice agent takeover


2. SCOPE
2.1 IN SCOPE
Twilio Provider Integration:

Support two configuration models (tenant-owned account OR system-managed account)
Multi-tenant webhook routing via subdomain parsing
Usage tracking via Twilio API integration

SMS Capabilities:

Inbound SMS linked to Leads (auto-create if unknown)
Outbound SMS from Lead detail view
Full SMS history per Lead
Message body storage and display

Voice Call Capabilities:

Inbound calls with automatic recording
Outbound calls with conference bridging (user → system → lead)
Call recording storage in existing File Storage module
Recording playback with speed controls (0.5x, 1x, 2x)
Download option for recordings

IVR Menu System:

Single-level menu (digits 0-9)
Dynamic configuration per tenant
Four action types: route to number, route to default/queue, trigger webhook, save voicemail

Office Number Bypass:

Whitelisted office numbers skip IVR
Prompt for target number entry
Outbound call initiated from tenant's Twilio number
Call linked to Lead if target matches existing Lead

Call Transcription:

Provider Registry Pattern supporting multiple transcription services
Initial providers: OpenAI Whisper API (others pluggable)
Transcription job queue with 30-minute SLA
Full-text searchable transcriptions
Stored alongside recordings

Lead Matching & Auto-Creation:

Match by tenant_twilio_number + lead_phone_number
Auto-create Lead for unknown numbers with default data
Support same phone number across multiple tenants

RBAC & Visibility:

System Admin views all tenant activity
Tenant Admin configures Twilio and views all tenant data
Tenant Users (with permission) view all tenant call/SMS history

Data Retention:

Forever retention for recordings, transcriptions, SMS messages
Manual deletion only (no automatic purge)

2.2 OUT OF SCOPE

MMS (multimedia messaging) support
Multi-level IVR menus (nested menus)
Real-time call monitoring/whisper/barge-in
Call analytics/sentiment analysis (future module)
Voicemail transcription (Phase 1 — just storage)
Fax support
International SMS/call routing optimization
Custom call queue music/hold messages (future enhancement)
SMS campaign automation (future Marketing module)


3. SYSTEM ARCHITECTURE (CONCEPTUAL)
3.1 Provider Registry Pattern
Twilio Provider:

Registered in Communication Provider Registry
Type: SMS_VOICE
Configuration stored as JSON per tenant
Supports two deployment models (Model A and Model B)

Transcription Provider Registry:

New registry for transcription services
Pluggable architecture (add providers without database migration)
Initial provider: OpenAI Whisper API
Future providers: Oracle, AssemblyAI, Deepgram, custom engines
Configuration stored as JSON (API keys, model parameters, language settings)

3.2 Multi-Tenant Webhook Routing
Webhook URL Structure:
{tenant_subdomain}.lead360.app/api/twilio/sms/inbound
{tenant_subdomain}.lead360.app/api/twilio/call/inbound
{tenant_subdomain}.lead360.app/api/twilio/call/status
{tenant_subdomain}.lead360.app/api/twilio/recording/ready
{tenant_subdomain}.lead360.app/api/twilio/ivr/input
Tenant Identification:

Subdomain parsing from incoming webhook URL
Lookup tenant by subdomain
All subsequent operations scoped to tenant_id

3.3 Component Dependencies
Existing Modules:

File Storage Module: Store call recordings in tenant-specific folders
Encryption Service: Encrypt Twilio API credentials and transcription API keys
Communication Provider Registry: Register Twilio as new provider type
BullMQ Job Queue: Process transcription jobs asynchronously
RBAC System: Enforce permissions for call/SMS access

New Components:

Transcription Provider Registry: Manage pluggable transcription services
Call State Machine: Track call lifecycle (ringing, in-progress, recording, transcribing, completed)
SMS State Machine: Track SMS lifecycle (pending, sent, delivered, failed)
Lead Matching Engine: Match phone numbers to existing Leads or auto-create
IVR Configuration Manager: Store and execute IVR menu logic
Office Number Whitelist Manager: Manage per-tenant bypass numbers


4. DATA MODEL ENTITIES
4.1 TwilioProviderConfiguration
Purpose: Store tenant-specific Twilio setup
Attributes:

Configuration ID (unique)
Tenant ID (foreign key)
Deployment Model (Model A: own account | Model B: system account)
Account SID (encrypted, nullable if Model B)
Auth Token (encrypted, nullable if Model B)
Phone Number (E.164 format)
System-Assigned (boolean, true if Model B)
Status (active | inactive | suspended)
Webhook URLs (JSON: SMS, call, status, recording)
Usage Tracking Enabled (boolean)
Last Synced (timestamp)
Created At / Updated At

Relationships:

Belongs to one Tenant
Has many CallRecords
Has many SmsRecords
Has one IvrConfiguration

4.2 IvrConfiguration
Purpose: Store tenant's IVR menu setup
Attributes:

Configuration ID (unique)
Tenant ID (foreign key)
Twilio Provider Configuration ID (foreign key)
IVR Enabled (boolean)
Greeting Message (text or audio file reference)
Menu Options (JSON array, 0-9 digits, see structure below)
Default Action (if no input, what happens)
Timeout Seconds (how long to wait for input)
Max Retries (how many times to repeat menu)
Status (active | inactive)
Created At / Updated At

Menu Options JSON Structure:
[
  {
    "digit": "1",
    "action": "route_to_number",
    "label": "Request a quote",
    "config": { "phone_number": "+19781234567" }
  },
  {
    "digit": "2",
    "action": "route_to_default",
    "label": "Customer support",
    "config": { "queue_name": "support" }
  },
  {
    "digit": "3",
    "action": "trigger_webhook",
    "label": "Schedule appointment",
    "config": { "webhook_url": "https://..." }
  },
  {
    "digit": "4",
    "action": "voicemail",
    "label": "Leave a message",
    "config": { "max_duration_seconds": 180 }
  }
]
Relationships:

Belongs to one Tenant
Belongs to one TwilioProviderConfiguration

4.3 CallRecord
Purpose: Track all inbound and outbound calls
Attributes:

Record ID (unique)
Tenant ID (foreign key)
Lead ID (foreign key, nullable if unknown number)
Twilio Provider Configuration ID (foreign key)
Twilio Call SID (Twilio's unique call identifier)
Direction (inbound | outbound)
From Number (E.164 format)
To Number (E.164 format)
Status (initiated | ringing | in_progress | completed | failed | no_answer | busy | canceled)
Call Type (customer_call | office_bypass_call | ivr_routed_call)
Initiated By (User ID, if outbound)
Call Reason (text, entered by user if outbound)
Recording URL (File Storage reference)
Recording Duration Seconds (integer)
Recording Status (pending | available | processing_transcription | transcribed | failed)
Transcription ID (foreign key, nullable)
IVR Action Taken (JSON, if IVR was used)
Consent Message Played (boolean)
Cost (decimal, from Twilio API)
Started At (timestamp)
Ended At (timestamp)
Created At / Updated At

Relationships:

Belongs to one Tenant
Belongs to one TwilioProviderConfiguration
Belongs to zero or one Lead (nullable if unknown caller)
Initiated by zero or one User (nullable if inbound)
Has zero or one CallTranscription

4.4 SmsRecord
Purpose: Track all inbound and outbound SMS messages
Attributes:

Record ID (unique)
Tenant ID (foreign key)
Lead ID (foreign key, nullable if unknown number)
Twilio Provider Configuration ID (foreign key)
Twilio Message SID (Twilio's unique message identifier)
Direction (inbound | outbound)
From Number (E.164 format)
To Number (E.164 format)
Message Body (text)
Status (queued | sending | sent | delivered | failed | undelivered)
Sent By (User ID, if outbound)
Error Code (Twilio error code if failed)
Error Message (text)
Cost (decimal, from Twilio API)
Sent At (timestamp)
Delivered At (timestamp, nullable)
Created At / Updated At

Relationships:

Belongs to one Tenant
Belongs to one TwilioProviderConfiguration
Belongs to zero or one Lead (nullable if unknown sender)
Sent by zero or one User (nullable if inbound)

4.5 CallTranscription
Purpose: Store transcriptions of call recordings
Attributes:

Transcription ID (unique)
Tenant ID (foreign key)
Call Record ID (foreign key)
Transcription Provider (string, e.g., "openai_whisper")
Status (queued | processing | completed | failed)
Transcription Text (full text, full-text searchable)
Language Detected (ISO language code)
Confidence Score (decimal, 0-1)
Processing Duration Seconds (integer)
Cost (decimal, from provider API)
Error Message (text, if failed)
Created At (timestamp)
Completed At (timestamp, nullable)

Relationships:

Belongs to one Tenant
Belongs to one CallRecord
Uses one TranscriptionProviderConfiguration

4.6 TranscriptionProviderConfiguration
Purpose: Store transcription service credentials and settings
Attributes:

Configuration ID (unique)
Tenant ID (foreign key, nullable if system-level)
Provider Name (string: "openai_whisper" | "oracle" | "assemblyai" | custom)
Is System Default (boolean)
Status (active | inactive)
Configuration JSON (encrypted, contains API keys, model settings, language preferences)
Usage Limit (integer, messages/month, nullable)
Usage Current (integer, messages this month)
Cost Per Minute (decimal)
Created At / Updated At

Configuration JSON Example (OpenAI Whisper):
{
  "api_key": "sk-...",
  "model": "whisper-1",
  "language": "en",
  "response_format": "json",
  "temperature": 0
}
Relationships:

Belongs to zero or one Tenant (nullable if system-wide)
Has many CallTranscriptions

4.7 OfficeNumberWhitelist
Purpose: Store office numbers that bypass IVR
Attributes:

Record ID (unique)
Tenant ID (foreign key)
Phone Number (E.164 format)
Label (string, e.g., "John's Mobile", "Office Desk 1")
Status (active | inactive)
Created At / Updated At

Relationships:

Belongs to one Tenant


5. MULTI-TENANT CONFIGURATION MODELS
5.1 Model A: Tenant-Owned Twilio Account
Setup Process:

Tenant provides Twilio Account SID
Tenant provides Twilio Auth Token
Tenant provides Twilio Phone Number
System encrypts credentials
System configures webhook URLs in Twilio via API
System validates connection by sending test SMS
System activates provider

Tenant Responsibilities:

Pay Twilio directly
Manage Twilio account settings
Ensure sufficient balance

System Responsibilities:

Store encrypted credentials
Configure webhooks automatically
Track usage via Twilio API (read-only)

5.2 Model B: System-Managed Twilio Account
Setup Process:

Tenant requests phone number from system
System Admin assigns number from master Twilio pool
System creates sub-configuration for tenant
System configures tenant-specific webhooks
System activates provider

Tenant Responsibilities:

None (system handles all Twilio interactions)

System Responsibilities:

Pay Twilio for all usage
Allocate phone numbers from pool
Track usage per tenant
Bill tenant (if applicable, via usage reports)

5.3 Switching Between Models
Allowed: Tenant can switch from Model B to Model A, or vice versa
Process:

Tenant initiates switch in UI
System deactivates current configuration
Tenant completes setup for new model
System validates new configuration
System activates new configuration
Old configuration archived (not deleted, for history)

Data Preservation:

All historical CallRecords and SmsRecords remain linked to tenant
New calls/SMS use new configuration
Reporting shows combined history


6. CALL FLOW STATE MACHINES
6.1 Inbound Call Flow (Customer → Tenant)
State Sequence:

Call Received

Twilio webhook hits {tenant}.lead360.app/api/twilio/call/inbound
System identifies tenant by subdomain
System looks up caller phone number
System checks if number is on Office Whitelist


Branch A: Office Number Detected (Bypass IVR)

System plays: "You've reached [Tenant Name]. Please enter the phone number you'd like to call."
System waits for DTMF input (10 digits)
User enters target number
System validates number format
System initiates outbound call FROM tenant's Twilio number TO target number
System bridges caller to target
Go to Recording State


Branch B: Regular Customer Call

System checks if Lead exists for caller number
If Lead exists: Load Lead context
If Lead does not exist: Prepare to auto-create Lead
System checks if IVR is enabled


Branch B1: IVR Enabled

System plays consent message: "This call will be recorded for training purposes."
System plays IVR greeting and menu
System waits for DTMF input (digits 0-9)
User presses digit
System executes configured action:

Route to Number: Transfer call to specified number, Go to Recording State
Route to Default/Queue: Place in queue or route to default handler, Go to Recording State
Trigger Webhook: Send POST to webhook URL with call context, Go to Recording State or end call
Voicemail: Start recording voicemail, save to File Storage, end call




Branch B2: IVR Disabled

System plays consent message: "This call will be recorded for training purposes."
System routes to tenant's default handler (configured number or queue)
Go to Recording State


Recording State

System starts call recording
Call proceeds (parties connected)
Recording continues until call ends


Call Ended

Twilio sends end-of-call webhook
System updates CallRecord status to completed
System stores recording URL in CallRecord
System sets recording status to processing_transcription
System queues transcription job
If caller was unknown: Auto-create Lead with phone number, name = phone number, last name = "Phone/SMS lead", address = tenant's office address, origin = "Phone/SMS"
Link CallRecord to Lead



6.2 Outbound Call Flow (User → Lead)
State Sequence:

User Initiates Call

User clicks "Call" button on Lead detail view
System prompts: "Who is calling?" (enter phone number)
User enters their phone number
System prompts: "Why are you calling?" (enter reason)
User enters call reason (text)
System validates inputs


Call Initiated

System creates CallRecord with status initiated
System calls user's phone number FROM tenant's Twilio number
User's phone rings


User Answers

System plays: "Please wait, we're connecting your call."
System calls Lead's phone number FROM tenant's Twilio number
Lead's phone rings


Lead Answers

System bridges user and Lead into conference
System plays consent message to both parties: "This call will be recorded for training purposes."
System starts call recording
CallRecord status updated to in_progress


Call In Progress

Recording continues
Both parties can talk


Call Ended

Either party hangs up
Twilio sends end-of-call webhook
System updates CallRecord status to completed
System stores recording URL
System sets recording status to processing_transcription
System queues transcription job
Call reason stored in CallRecord




7. SMS FLOW STATE MACHINES
7.1 Inbound SMS Flow
State Sequence:

SMS Received

Twilio webhook hits {tenant}.lead360.app/api/twilio/sms/inbound
System identifies tenant by subdomain
System looks up sender phone number


Lead Matching

Key: tenant_id + sender_phone_number
If Lead exists: Load Lead
If Lead does not exist: Auto-create Lead with phone number, name = phone number, last name = "Phone/SMS lead", address = tenant's office address, origin = "Phone/SMS"


SMS Stored

System creates SmsRecord
Direction: inbound
From: sender phone number
To: tenant's Twilio number
Message Body: full text
Status: delivered
Link to Lead


Notification (Optional Future Enhancement)

System could notify assigned user of new SMS
Out of scope for Phase 1



7.2 Outbound SMS Flow
State Sequence:

User Initiates SMS

User clicks "Send SMS" button on Lead detail view
System displays SMS compose modal
User enters message body
User clicks "Send"


SMS Queued

System creates SmsRecord with status queued
Direction: outbound
From: tenant's Twilio number
To: Lead's phone number
Message Body: user-entered text
Sent By: current user ID


SMS Sent to Twilio

System calls Twilio API to send SMS
Twilio returns Message SID
System updates SmsRecord with Message SID
Status updated to sent


SMS Delivered

Twilio sends delivery webhook (success or failure)
System updates SmsRecord status to delivered or failed
If failed: Store error code and message




8. TRANSCRIPTION JOB QUEUE
8.1 Transcription Process
Trigger: Call recording becomes available
Steps:

Job Queued

Twilio sends recording-ready webhook
System creates transcription job in BullMQ
Job contains: CallRecord ID, Recording URL, Tenant ID
Priority: Normal (SLA: 30 minutes)


Job Processing

Worker picks up job
Worker determines transcription provider:

If tenant has custom provider configured: Use tenant's provider
Else: Use system default provider (OpenAI Whisper)


Worker retrieves provider configuration (API key, model, settings)


Transcription Execution

Worker downloads recording from File Storage
Worker sends recording to transcription provider API
Worker waits for transcription response (async or sync depending on provider)


Transcription Received

Worker creates CallTranscription record
Transcription Text: full transcript
Language Detected: ISO code
Confidence Score: provider-specific
Worker updates CallRecord recording status to transcribed


Job Completed

Worker marks job as complete
Transcription available for viewing and search


Job Failed

Worker retries up to 3 times (exponential backoff)
If all retries fail: Mark transcription status as failed
Store error message in CallTranscription record
Alert System Admin (via notification system)



8.2 Provider Selection Logic
Decision Tree:

Does tenant have custom TranscriptionProviderConfiguration?

Yes: Use tenant's provider (check API key validity, usage limits)
No: Go to step 2


Is system default TranscriptionProviderConfiguration available?

Yes: Use system default
No: Fail job (alert System Admin)


Check usage limits:

If tenant provider: Check tenant's monthly limit
If system provider: Check system-wide monthly limit
If limit exceeded: Fail job with "quota exceeded" message


Execute transcription with selected provider


9. LEAD MATCHING & AUTO-CREATION RULES
9.1 Matching Algorithm
Key: tenant_id + phone_number
Lookup Process:

Extract tenant ID from webhook subdomain
Extract phone number from caller/sender (normalize to E.164 format)
Query Leads table: WHERE tenant_id = ? AND phone = ?
If match found: Return Lead
If no match: Go to Auto-Creation

9.2 Auto-Creation Rules
Trigger: Inbound SMS or call from unknown number
Lead Data:

Name (First Name): Phone number (e.g., "+19781234567")
Last Name: "Phone/SMS lead"
Phone: Caller/sender phone number (E.164 format)
Address: Tenant's office main address (from tenant settings)
Origin: "Phone/SMS"
Status: Default Lead status (e.g., "New")
Assigned To: Null (unassigned, requires manual assignment)
Created By: System (auto-generated)

Post-Creation:

Link CallRecord or SmsRecord to new Lead
Notify tenant users of new Lead (optional, future enhancement)

9.3 Cross-Tenant Phone Numbers
Scenario: Phone number A exists in Tenant X and Tenant Y
Behavior:

Each tenant has separate Lead record for phone number A
No data sharing between tenants
Key enforces isolation: tenant_id + phone_number


10. RBAC MATRIX
RoleView All Tenant ActivityConfigure TwilioConfigure IVRManage WhitelistSend SMSMake CallsView Call/SMS HistoryDownload RecordingsView TranscriptionsSystem Admin✅ Yes✅ Yes (all tenants)✅ Yes (all tenants)✅ Yes (all tenants)✅ Yes (any tenant)✅ Yes (any tenant)✅ Yes (all tenants)✅ Yes (all tenants)✅ Yes (all tenants)Tenant Admin❌ No (own tenant only)✅ Yes✅ Yes✅ Yes✅ Yes✅ Yes✅ Yes (all tenant data)✅ Yes✅ YesTenant User (with permission)❌ No❌ No❌ No❌ No✅ Yes✅ Yes✅ Yes (all tenant data)✅ Yes✅ YesTenant User (no permission)❌ No❌ No❌ No❌ No❌ No❌ No❌ No❌ No❌ No
Permission Names:

communication.twilio.configure → Configure Twilio provider
communication.ivr.manage → Configure IVR menu
communication.whitelist.manage → Manage office number whitelist
communication.sms.send → Send SMS to Leads
communication.calls.make → Make outbound calls to Leads
communication.history.view → View all call/SMS history for tenant
communication.recordings.access → Download and playback recordings
communication.transcriptions.view → View transcriptions


11. EDGE CASES & VALIDATION
11.1 Edge Cases
Case 1: Lead Phone Number Changes

Scenario: Lead's phone number is updated in system
Behavior: New calls/SMS to old number will NOT match Lead (creates new auto-generated Lead unless manually merged)
Mitigation: Implement phone number change audit log; warn user when changing phone number

Case 2: Multiple Users Call Same Lead Simultaneously

Scenario: Two users click "Call" on same Lead at same time
Behavior: Both calls proceed independently; both CallRecords created
Mitigation: No conflict; both calls are valid and recorded

Case 3: Twilio Webhook Arrives Before Call Ends

Scenario: Recording webhook arrives while call still in progress
Behavior: System ignores duplicate webhooks; uses twilio_call_sid to deduplicate
Mitigation: Idempotent webhook handlers; check if CallRecord already processed

Case 4: Transcription Provider Fails

Scenario: OpenAI Whisper API returns error (e.g., rate limit, server error)
Behavior: Job retries 3 times; if all fail, mark transcription as failed
Mitigation: Alert System Admin; provide manual retry option in UI

Case 5: Tenant Switches Twilio Model Mid-Month

Scenario: Tenant switches from Model A to Model B during active usage
Behavior: All historical records remain intact; new calls/SMS use new configuration
Mitigation: Archive old configuration (do not delete); reporting aggregates both configurations

Case 6: Office Bypass Caller Enters Invalid Number

Scenario: Whitelisted caller enters non-numeric or incomplete phone number
Behavior: System validates input; if invalid, re-prompts up to 3 times; then ends call
Mitigation: Clear voice prompts; validation logic for E.164 format

Case 7: IVR Timeout (No User Input)

Scenario: Customer does not press any digit within timeout period
Behavior: System executes default action (configured by tenant, e.g., route to queue or voicemail)
Mitigation: Tenant configures sensible default; system repeats menu up to max retries before default action

Case 8: Lead Has No Assigned User

Scenario: Auto-created Lead from inbound call/SMS has no assigned user
Behavior: Lead remains unassigned; appears in "Unassigned Leads" queue
Mitigation: Tenant admin assigns Lead manually; notification system (future) can alert users of new unassigned Leads

Case 9: Transcription Provider Quota Exceeded

Scenario: Tenant's custom transcription provider hits monthly usage limit
Behavior: Job fails with "quota exceeded" message; System Admin alerted
Mitigation: Fallback to system default provider (if configured); warn tenant in UI when approaching limit

Case 10: Recording File Corruption

Scenario: Recording file in File Storage is corrupted or missing
Behavior: Transcription job fails; CallRecord marked as failed
Mitigation: Retry download from Twilio; if Twilio no longer has recording (expired), mark as permanently failed

11.2 Validation Criteria
Configuration Validation:

Twilio Account SID format: AC[a-z0-9]{32}
Twilio Auth Token format: 32-character alphanumeric
Phone numbers: E.164 format (e.g., +19781234567)
Webhook URLs: HTTPS only (no HTTP)
IVR menu options: Max 10 entries, unique digits 0-9
Office whitelist numbers: E.164 format

Data Integrity Validation:

Every CallRecord must have tenant_id
Every SmsRecord must have tenant_id
CallRecord with status completed must have recording URL (unless recording failed)
CallTranscription must reference valid CallRecord
Outbound calls must have initiated_by (User ID)

Security Validation:

All Twilio webhook requests must include valid signature (validate via Twilio library)
Encrypted fields (API keys, tokens) must never appear in logs or API responses
RBAC permissions enforced on all endpoints
Tenant isolation enforced: User from Tenant A cannot access Tenant B's calls/SMS

Performance Validation:

Webhook response time < 2 seconds (to avoid Twilio timeout)
Transcription job processing time < 30 minutes (SLA)
Call/SMS history query with pagination (max 100 records per page)
Recording file access via signed URLs (expire after 1 hour)


12. DEPENDENCIES
12.1 Internal Dependencies
Required Modules (Must Be Complete):

File Storage Module → Store recordings
Encryption Service → Encrypt API credentials
Communication Provider Registry → Register Twilio
BullMQ Job Queue → Process transcription jobs
RBAC System → Enforce permissions
Tenant Settings → Office address for auto-created Leads

Optional Modules (Nice to Have):

Notification System → Alert users of new SMS/calls
Reporting Module → Usage analytics dashboards

12.2 External Dependencies
Twilio API:

Account creation (Model A tenants)
Webhook configuration (both models)
Usage tracking API (for billing/reporting)
Phone number provisioning (Model B)

Transcription Providers:

OpenAI Whisper API (initial provider)
Future: Oracle, AssemblyAI, Deepgram

Infrastructure:

BullMQ Redis instance (for job queue)
File Storage (S3, local, or existing Lead360 storage)
HTTPS endpoints (for Twilio webhooks)

12.3 Third-Party SDKs
Backend:

twilio (Node.js SDK) → Twilio API integration
openai (Node.js SDK) → OpenAI Whisper API integration

Frontend:

Audio playback library (HTML5 native or library like Howler.js)
File upload library (if custom transcription provider credentials require file upload)


13. RISKS
13.1 Technical Risks
RiskImpactLikelihoodMitigationTwilio webhook downtimeHigh (calls/SMS not recorded)LowImplement retry logic; queue failed webhooks for replayTranscription provider rate limitsMedium (delayed transcriptions)MediumImplement fallback providers; queue management with priorityRecording storage costsMedium (high storage usage)HighImplement retention policy (future); compress recordingsE.164 phone number validation failuresMedium (incorrect matching)LowUse battle-tested validation library (libphonenumber)Concurrent transcription jobsMedium (queue overload)MediumRate limit per tenant; scale workers horizontallyTwilio webhook signature validation bypassHigh (security breach)LowEnforce signature validation on all webhooks; fail closed
13.2 Operational Risks
RiskImpactLikelihoodMitigationTenant switches Twilio account mid-callLow (call continues on old account)Very LowPrevent account switching during active calls; display warningTenant deletes Twilio account externallyHigh (system loses access)MediumDetect API errors; alert tenant; gracefully disable providerOffice bypass abuseMedium (unauthorized calls)LowAudit log all bypass calls; limit to whitelisted numbers onlyIVR misconfigurationMedium (customer frustration)MediumValidate IVR config before saving; provide preview/test modeAuto-created Leads not reviewedLow (data clutter)HighImplement "Unassigned Leads" queue; notifications (future)
13.3 Compliance Risks
RiskImpactLikelihoodMitigationCall recording consent not capturedHigh (legal liability)LowAlways play consent message; log consent in CallRecordTranscription data leakageHigh (privacy breach)Very LowEncrypt transcriptions at rest; enforce tenant isolationRetention policy non-complianceMedium (legal/regulatory risk)LowImplement configurable retention (future); default to forever for now

14. OPEN QUESTIONS
None remaining — all clarifications received from stakeholder.

15. ACCEPTANCE CRITERIA
Phase 1 is complete when:

System Admin can activate Twilio provider globally
Tenant can configure Twilio using Model A (own account) or Model B (system account)
Tenant can switch between Model A and Model B without data loss
Inbound SMS correctly matches or auto-creates Leads
Outbound SMS sends from tenant's Twilio number and logs to Lead history
Inbound calls correctly route through IVR or office bypass
Outbound calls connect user to Lead via conference bridge
All calls are recorded and stored in File Storage
Recordings are playable with speed controls (0.5x, 1x, 2x) and downloadable
Consent message plays at start of every call
IVR menu executes configured actions (route, webhook, voicemail)
Office bypass prompts for target number and initiates call
Transcription jobs process within 30-minute SLA
Transcriptions are searchable (full-text)
System Admin can view all tenant activity
Tenant users with permission can view all tenant call/SMS history
Usage tracking pulls data from Twilio API (for Model A and Model B)
Multi-tenant isolation is enforced (no cross-tenant data leakage)
RBAC permissions are enforced on all endpoints
All webhook handlers validate Twilio signatures


16. NEXT STEPS
Immediate Actions:

Backend Team: Review Feature Contract, begin Backend Implementation Guide
Frontend Team: Review Feature Contract, wait for Backend Implementation Guide completion
DevOps Team: Provision BullMQ Redis instance, configure HTTPS endpoints for webhooks
System Admin: Create Twilio master account for Model B testing

Documentation To Follow:

Backend Implementation Guide (deliverable 2)
Frontend Implementation Guide (deliverable 3)
API Endpoint Documentation (REST API specs)
Database Migration Scripts (Prisma schema updates)


END OF FEATURE CONTRACT
✅ FEATURE CONTRACT COMPLETE
I have produced the comprehensive Feature Contract: Twilio SMS/Calls Communication Provider.

📊 DOCUMENT SUMMARY
Total Sections: 16
Key Components:

Multi-tenant configuration models (Model A & Model B)
Complete data model (7 entities)
Call and SMS state machines
Transcription Provider Registry architecture
IVR menu structure
Office number bypass logic
Lead matching and auto-creation rules
RBAC matrix
10 edge cases with mitigations
Risk analysis (technical, operational, compliance)
20 acceptance criteria


🎯 WHAT THIS ENABLES
For Developers:

Clear understanding of all entities and relationships
State machine flows for implementation logic
Edge case handling requirements
Validation rules for all inputs

For Sprint Planning:

Clear scope boundaries (in/out)
Dependency identification
Risk mitigation strategies
Testable acceptance criteria

For Stakeholders:

Business value articulation
Multi-tenant model comparison
Compliance considerations
Future AI voice agent readiness