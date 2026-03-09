LEAD360
Multi-Language Voice Agent — Feature Contract
Backend Implementation Specification  ·  v1.0
Date	March 2026
Product Owner	Ludson
Status	APPROVED FOR DEVELOPMENT
Modules Affected	voice-ai · communication (IVR)



1. Purpose & Business Problem
Currently Lead360 supports a single voice per tenant. The entire Voice AI stack resolves the active TTS voice through a single field: voice_id_override on tenant_voice_ai_settings, falling back to default_voice_id on voice_ai_global_config. There is no concept of a named, labeled agent, and no per-language voice binding.

This feature introduces:
•	Named, titled voice agent profiles — each profile binds a language, a TTS voice ID, a greeting, and custom instructions into a single referenceable record.
•	Per-plan voice slot limits — the subscription_plan controls how many agent profiles a tenant is allowed to create.
•	IVR action enrichment — when a tenant configures a voice_ai IVR menu option, they select a specific agent profile rather than a generic "Voice AI" action. The label shown to the caller (e.g., "Press 1 for Voice Agent - English - Main Agent") is driven by the selected profile.
•	Context builder upgrade — at call time, the agent profile selected in the IVR is resolved and its language and voice_id are injected into the VoiceAiContext, replacing the current flat voice_id_override.

⚠  SCOPE CONSTRAINT: This specification covers the backend only. The frontend (agent profile UI, IVR builder update) is out of scope for this sprint and will be documented separately.


2. Full Scope
2.1  In Scope — Backend
•	New Prisma model: tenant_voice_agent_profile
•	New subscription_plan column: voice_ai_max_agent_profiles (Int, default 1)
•	New tenant_voice_ai_settings column: default_agent_profile_id (FK → tenant_voice_agent_profile, nullable)
•	Tenant CRUD endpoints for agent profiles (5 endpoints)
•	Plan-config admin endpoint extension (expose voice_ai_max_agent_profiles)
•	Admin override endpoint extension (allow default_agent_profile_id override)
•	IVR DTO/service update: voice_ai action config gains optional field agent_profile_id
•	Context builder update: resolve language and voice_id from agent_profile_id if present in the IVR action context, else fall back to existing behavior
•	Prisma migration

2.2  Explicitly Out of Scope
•	Frontend pages for agent profile management
•	Frontend IVR builder changes
•	Real-time language switching mid-call
•	STT per-language model selection (STT language is already driven by context.behavior.language — no change needed)
•	LLM provider per-language override


3. Current State — Evidence from Codebase
The following facts are confirmed from reading the actual source files. No assumptions are made.

3.1  Prisma — tenant_voice_ai_settings
File: api/prisma/schema.prisma — model tenant_voice_ai_settings

Column	Type / Default	Relevance
voice_id_override	String? @db.VarChar(100)	Current single TTS voice ID — will remain but lose primary role
default_language	String @default("en")	Kept; used when no profile is selected
enabled_languages	String @default('["en"]') @db.Text	JSON array; drives context builder parseJsonArray() fallback
stt_provider_override_id	String? @db.VarChar(36)	Unchanged
tts_provider_override_id	String? @db.VarChar(36)	Unchanged

3.2  Prisma — subscription_plan (voice AI fields that exist today)
File: api/prisma/schema.prisma — model subscription_plan

Column	Type / Default	Note
voice_ai_enabled	Boolean @default(false)	Existing — unchanged
voice_ai_minutes_included	Int @default(0)	Existing — unchanged
voice_ai_overage_rate	Decimal?	Existing — unchanged
voice_ai_max_agent_profiles	Int @default(1)	NEW — controls max profiles per tenant

3.3  Context Builder — Current Language & Voice Resolution
File: api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts

Current resolution chain (confirmed from source):
•	language = enabledLanguages[0] ?? globalConfig.default_language ?? 'en'   (where enabledLanguages is parsed from tenant_voice_ai_settings.enabled_languages)
•	ttsVoiceId = tenantSettings?.voice_id_override ?? globalConfig.default_voice_id ?? null
•	Both are placed into context.behavior.language and context.providers.tts.voice_id

After this sprint, the context builder must additionally:
•	Accept an optional agent_profile_id parameter (passed by the internal agent endpoint from IVR action config)
•	If agent_profile_id is provided and valid, override language and voice_id from the resolved profile
•	All other fields (providers, quota, services, etc.) remain unchanged

3.4  IVR — Current voice_ai Action Config Shape
File: api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts — class IvrMenuOptionDto

Current config field type:
config: { phone_number?: string; webhook_url?: string; max_duration_seconds?: number; }

The voice_ai action type is already a valid value in IVR_ACTION_TYPES (confirmed in ivr-configuration.service.ts). The config object currently has no voice_ai-specific fields. After this sprint, config must accept an optional agent_profile_id for the voice_ai action type.

3.5  IVR — Execution Path for voice_ai
File: api/src/modules/communication/services/ivr-configuration.service.ts

Confirmed execution path:
1.	Digit pressed → executeIvrAction() checks selectedOption.action === 'voice_ai'
2.	Calls executeVoiceAiAction(tenantId, callSid, selectedOption, toNumber)
3.	executeVoiceAiAction() calls voiceAiSipService.canHandleCall(tenantId)
4.	If allowed: returns voiceAiSipService.buildSipTwiml(tenantId, callSid, toNumber)

The agent_profile_id from selectedOption.config must be threaded through to buildSipTwiml() so that the LiveKit SIP routing can include it as a SIP header or metadata, making it available to the agent session for context building.

3.6  VoiceAiInternalController — Context Endpoint
File: api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts (confirmed from module registration)
The internal context endpoint is authenticated via VoiceAgentKeyGuard. It calls VoiceAiContextBuilderService.buildContext(). The agent_profile_id must be passable as a query/body param on this endpoint so the agent worker can request a language-and-voice-specific context.


4. New Database Model — tenant_voice_agent_profile
4.1  Model Definition
This model is the core addition of this sprint. It represents a single named voice agent profile for a tenant.

Column	Type	Required	Business Rule
id	String @id @default(uuid()) @db.VarChar(36)	Yes	Primary key
tenant_id	String @db.VarChar(36)	Yes	Multi-tenant isolation. Every query MUST filter by this.
title	String @db.VarChar(100)	Yes	Human-readable name. Shown in IVR builder and call logs. Example: "Main Agent", "Agente Portugues"
language_code	String @db.VarChar(10)	Yes	BCP-47 code: 'en', 'pt', 'es', etc. Must match what the STT and TTS providers accept.
voice_id	String @db.VarChar(200)	Yes	Provider-specific TTS voice identifier. For Cartesia this is the voice UUID string.
custom_greeting	String? @db.Text	No	Profile-level greeting override. If null, falls back to tenant_voice_ai_settings.custom_greeting, then global template.
custom_instructions	String? @db.LongText	No	Profile-level instruction override. Appended to global system prompt, replacing tenant-level custom_instructions when this profile is active.
is_active	Boolean @default(true)	Yes	Inactive profiles cannot be selected in new IVR configs. Existing IVR configs referencing them continue to work until next IVR config save.
display_order	Int @default(0)	Yes	Controls sort order in UI dropdowns and lists.
created_at	DateTime @default(now())	Auto	
updated_at	DateTime @updatedAt	Auto	
updated_by	String? @db.VarChar(36)	No	User UUID of last editor. Set by service layer from JWT.

4.2  Indexes
•	@@index([tenant_id])
•	@@index([tenant_id, is_active])
•	@@index([tenant_id, language_code])
•	@@map("tenant_voice_agent_profile")

4.3  Relations
•	tenant → tenant_voice_ai_settings already has a default_agent_profile_id nullable FK added in this sprint (see Section 5.2)
•	No back-relation required on tenant_voice_agent_profile itself — profiles are queried by tenant_id, not traversed from settings


5. Schema Modifications to Existing Models
5.1  subscription_plan — Add voice_ai_max_agent_profiles
New column to add to the existing subscription_plan model:

Column	voice_ai_max_agent_profiles
Type	Int @default(1)
Constraint	Min value: 1. Value enforced at the service layer, not at DB level.
Business rule	Tenants may not create more active agent profiles than this value. Counted at create-time. Deleting or deactivating a profile reduces the active count.
Migration note	Existing subscription_plan rows will receive the default value of 1 via Prisma migration.

5.2  tenant_voice_ai_settings — Add default_agent_profile_id
New nullable FK column:

Column	default_agent_profile_id
Type	String? @db.VarChar(36)
FK target	tenant_voice_agent_profile.id
onDelete	SetNull — if the profile is deleted, this field becomes null automatically.
Business rule	Used as fallback when an IVR voice_ai action has no agent_profile_id set. If null and no IVR profile, existing behavior (voice_id_override + default_language) applies.
Prisma relation name	@relation("settings_default_profile")

5.3  ivr_configuration — No Schema Change
The menu_options and default_action columns are already typed as Json in Prisma schema (confirmed). The agent_profile_id field in the IVR config is a runtime-validated property inside the JSON object, not a schema-level FK. No migration is required for the IVR table.

MIGRATION NAME REQUIRED: The developer must create a single migration with a descriptive name covering all three schema changes above. Suggested name: add_multi_language_voice_agent_profiles


6. IVR DTO & Service Update
6.1  IvrMenuOptionDto — config Field Extension
File: api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts

The config field on IvrMenuOptionDto is currently typed as a plain object. The type must be extended to accept an optional agent_profile_id field for use when action === 'voice_ai'.

Extended config type (describes what is valid, enforcement is in the service):
Field	Type	Rule
phone_number	string (optional)	Existing — unchanged
webhook_url	string (optional)	Existing — unchanged
max_duration_seconds	number (optional)	Existing — unchanged
agent_profile_id	string UUID (optional)	NEW. Only valid when action === 'voice_ai'. If provided, must be a valid UUID. Service validates it belongs to the tenant at save-time.

The IvrDefaultActionDto config type must receive the same extension.

6.2  IVR Service — validateAction() Update
File: api/src/modules/communication/services/ivr-configuration.service.ts — method validateAction()

Current behavior: validates action type and phone_number/webhook_url fields. Must be extended with:
•	When action === 'voice_ai' AND config.agent_profile_id is present, validate that it is a valid UUID string (format only — tenant ownership is validated in createOrUpdate()).
•	No other changes to validateAction().

6.3  IVR Service — createOrUpdate() Update
File: api/src/modules/communication/services/ivr-configuration.service.ts — method createOrUpdate()

New validation step to add after existing menu option validation:
•	Collect all agent_profile_id values from menu_options and default_action where action === 'voice_ai' and agent_profile_id is set.
•	For each collected UUID: query tenant_voice_agent_profile WHERE id = ? AND tenant_id = ? AND is_active = true.
•	If any profile is not found for that tenant: throw BadRequestException with message: 'Voice agent profile {agent_profile_id} not found or not active for this tenant.'
•	This prevents referencing another tenant's profiles or inactive profiles.

6.4  IVR Service — executeVoiceAiAction() Update
File: api/src/modules/communication/services/ivr-configuration.service.ts — method executeVoiceAiAction()

This private method currently calls voiceAiSipService.buildSipTwiml(tenantId, callSid, toNumber).

Update: extract config.agent_profile_id from the action config (may be undefined) and pass it to buildSipTwiml() as a fourth parameter.

6.5  VoiceAiSipService — buildSipTwiml() Update
File: api/src/modules/voice-ai/services/voice-ai-sip.service.ts — method buildSipTwiml()

Current signature: buildSipTwiml(tenantId: string, callSid: string, toNumber?: string): Promise<string>

New signature: buildSipTwiml(tenantId: string, callSid: string, toNumber?: string, agentProfileId?: string): Promise<string>

When agentProfileId is provided, it must be included as a SIP X-header in the TwiML <Sip> element. The header name must be X-Agent-Profile-Id. The value is the raw UUID string.

Current TwiML output structure (confirmed from source):
<Response><Dial><Sip sip:voice-ai@{livekit_sip_trunk_url}><SipHeader name="X-Twilio-Number">{toNumber}</SipHeader></Sip></Dial></Response>

Required TwiML output when agentProfileId is present:
<Response><Dial><Sip sip:voice-ai@{livekit_sip_trunk_url}><SipHeader name="X-Twilio-Number">{toNumber}</SipHeader><SipHeader name="X-Agent-Profile-Id">{agentProfileId}</SipHeader></Sip></Dial></Response>


7. Tenant API — Agent Profile Endpoints
These are entirely new endpoints. They live in the voice-ai module under the existing tenant controllers path.

7.1  Controller Location
File to create	api/src/modules/voice-ai/controllers/tenant/voice-agent-profiles.controller.ts
Route prefix	voice-ai/agent-profiles
Full base path	/api/v1/voice-ai/agent-profiles
Auth	JwtAuthGuard + RolesGuard (same pattern as VoiceAiSettingsController)
Tenant ID source	req.user.tenant_id — NEVER from request body or params

7.2  Endpoint: POST /api/v1/voice-ai/agent-profiles
Create a new agent profile for the authenticated tenant.

Roles allowed	Owner, Admin
HTTP method	POST
Success status	201 Created
Plan guard	Before creating, the service must count active profiles for tenant. If count >= subscription_plan.voice_ai_max_agent_profiles: throw 403 ForbiddenException with message: 'Your plan allows a maximum of {N} voice agent profiles. Upgrade your plan to add more.'
Uniqueness rule	Within a tenant, the combination of (language_code + title) must be unique. If duplicate: throw 409 ConflictException.
Response	Full tenant_voice_agent_profile row

Request DTO fields (CreateVoiceAgentProfileDto):
Field	Type	Required	Validation
title	string	Yes	MinLength 1, MaxLength 100
language_code	string	Yes	MinLength 2, MaxLength 10
voice_id	string	Yes	MinLength 1, MaxLength 200
custom_greeting	string | null	No	MaxLength 500
custom_instructions	string | null	No	MaxLength 3000
is_active	boolean	No	Default: true
display_order	number (int)	No	Default: 0, Min: 0

7.3  Endpoint: GET /api/v1/voice-ai/agent-profiles
List all agent profiles for the authenticated tenant.

Roles allowed	Owner, Admin, Manager
HTTP method	GET
Query params	active_only (boolean, optional, default false) — if true, returns only is_active = true profiles
Sort	display_order ASC, then created_at ASC
Response	Array of tenant_voice_agent_profile rows. Empty array if none.
Tenant isolation	WHERE tenant_id = req.user.tenant_id on all queries. No exceptions.

7.4  Endpoint: GET /api/v1/voice-ai/agent-profiles/:id
Get a single agent profile by ID.

Roles allowed	Owner, Admin, Manager
Success status	200 OK
Not found	404 if id does not exist OR belongs to a different tenant
Tenant isolation	WHERE id = :id AND tenant_id = req.user.tenant_id

7.5  Endpoint: PATCH /api/v1/voice-ai/agent-profiles/:id
Partial update of an agent profile. PATCH semantics — only provided fields are written.

Roles allowed	Owner, Admin
Success status	200 OK — returns updated row
Not found	404 if id does not exist OR belongs to a different tenant
Uniqueness rule	If title or language_code is changed, re-validate uniqueness: (language_code + title) must be unique within tenant excluding the current record.
Deactivation guard	If is_active is being set to false AND this profile is the tenant's default_agent_profile_id in tenant_voice_ai_settings: set default_agent_profile_id to null in the same transaction.
updated_by	Set from req.user.id

Update DTO fields (UpdateVoiceAgentProfileDto):
All fields are optional. Same types and validation rules as CreateVoiceAgentProfileDto.

7.6  Endpoint: DELETE /api/v1/voice-ai/agent-profiles/:id
Hard delete of a profile. Allowed only if not referenced by any active IVR configuration.

Roles allowed	Owner, Admin
Success status	204 No Content
Not found	404 if id does not exist OR belongs to a different tenant
IVR reference guard	Before deletion, the service must scan all IVR menu_options and default_action JSON fields for the tenant to check if this profile ID appears. If found in any active IVR config: throw 409 ConflictException with message: 'This agent profile is in use by an active IVR configuration. Deactivate it instead, or remove it from your IVR settings first.'
Settings FK cleanup	If this profile is the tenant's default_agent_profile_id: set default_agent_profile_id to null before deletion (or rely on onDelete: SetNull from Prisma FK).


8. Admin API Extensions
8.1  UpdatePlanVoiceConfigDto — Add voice_ai_max_agent_profiles
File: api/src/modules/voice-ai/dto/update-plan-voice-config.dto.ts

Add optional field:
Field	Type	Validation
voice_ai_max_agent_profiles	number (int) | optional	IsOptional, IsInt, Min(1), Max(50)

File: api/src/modules/voice-ai/services/voice-ai-plan-config.service.ts — method updatePlanVoiceConfig()
Include voice_ai_max_agent_profiles in the update payload when present in the DTO. The PlanWithVoiceConfig interface must expose this field.

8.2  AdminOverrideTenantVoiceDto — Add default_agent_profile_id
File: api/src/modules/voice-ai/dto/admin-override-tenant-voice.dto.ts

Add optional field:
Field	Type	Validation / Rule
default_agent_profile_id	string | null | optional	IsOptional. When not null: IsUUID('4'). When setting a non-null value, service must verify the profile belongs to the target tenant.

File: api/src/modules/voice-ai/services/voice-ai-settings.service.ts — method adminOverride()
Handle default_agent_profile_id in updateData construction. When non-null, validate tenant ownership of the profile before upsert.


9. Context Builder Update — Language & Voice Resolution
File: api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts
Method: buildContext(tenantId: string, callSid?: string, agentProfileId?: string)

9.1  New Parameter
Add optional agentProfileId?: string parameter to buildContext(). This value originates from the X-Agent-Profile-Id SIP header extracted by the agent worker at call time.

9.2  Resolution Logic (in order)
After the existing tenant settings and global config are loaded (Steps 1–4 in the current method), apply this resolution chain for language and voice_id:

Step	Condition	Action
1	agentProfileId is provided and is not null	Load tenant_voice_agent_profile WHERE id = agentProfileId AND tenant_id = tenantId. If found and is_active = true: use profile.language_code as language, profile.voice_id as ttsVoiceId, profile.custom_greeting (if set) as greeting, profile.custom_instructions (if set) appended to system prompt instead of tenant-level custom_instructions.
2	agentProfileId not provided OR profile not found OR profile is inactive	Fall through to existing behavior: language from enabledLanguages[0] / globalConfig.default_language; ttsVoiceId from tenantSettings.voice_id_override / globalConfig.default_voice_id.
3	tenantSettings.default_agent_profile_id is set AND Step 1 did not resolve	Load tenant_voice_agent_profile WHERE id = default_agent_profile_id AND tenant_id = tenantId. If found and active: use same profile-level overrides as Step 1.

CRITICAL: The VoiceAiContext interface (api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts) must be extended with an optional active_agent_profile field to expose the resolved profile metadata to the agent worker. This allows call logs and debug traces to record which profile was active.

9.3  VoiceAiContext Interface Extension
File: api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts

Add optional field to the VoiceAiContext interface:
Field name	active_agent_profile
Type	{ id: string; title: string; language_code: string; } | null (optional)
Set when	An agent profile was successfully resolved and applied in Step 1 or 3 of the resolution chain
Set to null	When no profile was resolved (fallback path taken)

The same field must be added to the api-types.ts interface copy in the agent utils:
File: api/src/modules/voice-ai/agent/utils/api-types.ts — interface VoiceAiContext


10. Internal Endpoint Update
10.1  Context Endpoint
File: api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts

The internal context endpoint that the agent worker calls must accept an optional agent_profile_id query parameter. This value is extracted by the agent worker from the X-Agent-Profile-Id SIP header on the incoming call and forwarded to the context endpoint.

Endpoint	Existing internal context endpoint (confirmed present in module, exact path is in controller file)
New query param	agent_profile_id (string, optional, UUID format)
Forwarded to	VoiceAiContextBuilderService.buildContext(tenantId, callSid, agentProfileId)
Guard	Unchanged — VoiceAgentKeyGuard


11. Business Rules — Complete List
11.1  Profile Creation
•	Tenant must have voice_ai_enabled = true on their subscription plan to create profiles. If not: 403.
•	Active profile count (is_active = true) must be less than subscription_plan.voice_ai_max_agent_profiles. If at limit: 403.
•	(language_code + title) must be unique per tenant. Case-sensitive. If duplicate: 409.
•	voice_id is free-text. The service does not validate it against the TTS provider — that is the admin's responsibility.

11.2  Profile Update
•	Only the owning tenant can update their profiles. Tenant isolation enforced via WHERE tenant_id = req.user.tenant_id on all queries.
•	Deactivating a profile that is set as default_agent_profile_id must clear that FK in tenant_voice_ai_settings atomically in the same Prisma transaction.
•	Title/language_code uniqueness re-validated on update, excluding the record being updated.

11.3  Profile Deletion
•	Cannot delete a profile referenced in any active IVR configuration (menu_options or default_action). 409 with explicit message.
•	Profiles that are inactive (is_active = false) can be deleted freely if not in an active IVR config.

11.4  IVR Config Save
•	All agent_profile_id references in menu_options and default_action must be validated against tenant_voice_agent_profile WHERE tenant_id = tenantId AND is_active = true at time of save.
•	An inactive profile ID or a profile from another tenant will fail validation with 400.

11.5  Call Routing
•	The agent_profile_id is transmitted from IVR → SIP TwiML → LiveKit SIP header → agent worker → internal context call. The chain must not break at any point.
•	If the SIP header is missing or blank, the agent worker passes no agentProfileId to the context endpoint and the existing fallback behavior applies. No error is thrown.
•	If the profile is deactivated between IVR config save and call arrival: context builder falls through to fallback behavior. No error is thrown. The call proceeds normally.


12. Prisma Migration Requirements
Item	Specification
Migration name	add_multi_language_voice_agent_profiles
New table	tenant_voice_agent_profile — all columns as defined in Section 4
Altered table 1	subscription_plan — ADD COLUMN voice_ai_max_agent_profiles INT NOT NULL DEFAULT 1
Altered table 2	tenant_voice_ai_settings — ADD COLUMN default_agent_profile_id VARCHAR(36) NULL, ADD CONSTRAINT FK with onDelete SetNull
Existing data	No existing data migration needed. Existing tenants with voice_id_override set continue to use that value via fallback behavior.
After migration	Run npx prisma generate to update the Prisma client.


13. Module Registration Changes
File: api/src/modules/voice-ai/voice-ai.module.ts

The following must be added to VoiceAiModule:

Section	Item to add
controllers	VoiceAgentProfilesController (new controller file in controllers/tenant/)
providers	VoiceAgentProfilesService (new service file in services/)
exports	VoiceAgentProfilesService — not needed unless consumed by another module. Leave un-exported unless the communication module needs it.

No changes to CommunicationModule imports — VoiceAiSipService is already exported from VoiceAiModule and imported by CommunicationModule.


14. Acceptance Criteria
14.1  Agent Profile CRUD
•	POST creates a profile, returns 201 with the created row including id and all fields.
•	POST returns 403 when active profile count equals plan limit.
•	POST returns 409 when (language_code + title) duplicate exists for the tenant.
•	GET returns profiles sorted by display_order ASC, created_at ASC.
•	GET with active_only=true returns only is_active=true profiles.
•	GET /:id returns 404 when id belongs to another tenant.
•	PATCH updates only the provided fields. Unset fields remain unchanged.
•	PATCH deactivating the default profile clears default_agent_profile_id atomically.
•	DELETE returns 409 when the profile is referenced in an active IVR config.
•	DELETE returns 204 when the profile is not referenced.

14.2  IVR Config
•	Saving an IVR config with a valid, active agent_profile_id in a voice_ai action config succeeds.
•	Saving with an inactive or foreign tenant's agent_profile_id returns 400.
•	Saving without agent_profile_id on a voice_ai action continues to work unchanged.

14.3  Call Context
•	When a call arrives with X-Agent-Profile-Id SIP header present and matching an active profile: context.behavior.language equals profile.language_code and context.providers.tts.voice_id equals profile.voice_id.
•	When X-Agent-Profile-Id is absent or profile not found: existing fallback behavior unchanged.
•	context.active_agent_profile is populated when a profile was resolved, null otherwise.

14.4  Multi-Tenant Isolation
•	A tenant cannot read, update, delete, or reference via IVR any agent profile belonging to another tenant.
•	All Prisma queries include WHERE tenant_id = tenantId without exception.

14.5  Plan Enforcement
•	A tenant on a plan with voice_ai_max_agent_profiles = 2 cannot create a third active profile.
•	The count is of is_active = true profiles only. Inactive profiles do not count toward the limit.


15. Risks & Open Questions
15.1  Risks
Risk	Likelihood	Mitigation
SIP header X-Agent-Profile-Id not reaching the agent worker	Medium	Confirm with the LiveKit/Twilio SIP trunk that custom X-headers are forwarded through the SIP INVITE. Test with a real call before claiming completion.
IVR menu_options JSON scanning for profile IDs is slow for tenants with large configs	Low	The JSON scan at IVR save-time is a one-time validation, not on every call. Acceptable.
voice_id values differ between Cartesia and any future TTS provider	Low	voice_id is stored as free-text. No format validation. Admin is responsible for entering the correct value per provider.
Concurrent profile deactivation and call routing race	Very Low	Handled by fallback: if profile is inactive at call time, context builder falls through to defaults. Call proceeds normally.

15.2  Open Questions
Question	Impact	Owner
What is the default voice_ai_max_agent_profiles value for each existing plan tier? Default in schema is 1 — is this correct for all tiers?	Plan config data	Ludson
Should the IVR label shown to the caller auto-generate from the profile data (e.g., 'Voice Agent - English - Main Agent'), or does the IVR option label remain fully manual?	IVR builder UX only — no backend impact	Ludson / Frontend sprint
When a profile's custom_instructions is set, does it REPLACE or APPEND to tenant-level custom_instructions?	Context builder behavior	Ludson — decision in Section 9.2 is REPLACE. Confirm.


16. Complete File Change Summary
This section lists every file the backend developer must touch, in recommended implementation order.

#	File Path	Change Type
1	api/prisma/schema.prisma	ADD model tenant_voice_agent_profile; ADD column subscription_plan.voice_ai_max_agent_profiles; ADD column tenant_voice_ai_settings.default_agent_profile_id
2	api/prisma/migrations/(new)	New migration: add_multi_language_voice_agent_profiles
3	api/src/modules/voice-ai/dto/create-voice-agent-profile.dto.ts	NEW FILE — CreateVoiceAgentProfileDto
4	api/src/modules/voice-ai/dto/update-voice-agent-profile.dto.ts	NEW FILE — UpdateVoiceAgentProfileDto
5	api/src/modules/voice-ai/services/voice-agent-profiles.service.ts	NEW FILE — VoiceAgentProfilesService (all 5 operations + plan guard)
6	api/src/modules/voice-ai/controllers/tenant/voice-agent-profiles.controller.ts	NEW FILE — VoiceAgentProfilesController (5 endpoints)
7	api/src/modules/voice-ai/voice-ai.module.ts	MODIFY — register new controller and service
8	api/src/modules/voice-ai/dto/update-plan-voice-config.dto.ts	MODIFY — add voice_ai_max_agent_profiles field
9	api/src/modules/voice-ai/services/voice-ai-plan-config.service.ts	MODIFY — handle new field in updatePlanVoiceConfig() and PlanWithVoiceConfig interface
10	api/src/modules/voice-ai/dto/admin-override-tenant-voice.dto.ts	MODIFY — add default_agent_profile_id field
11	api/src/modules/voice-ai/services/voice-ai-settings.service.ts	MODIFY — handle default_agent_profile_id in adminOverride()
12	api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts	MODIFY — add optional active_agent_profile field
13	api/src/modules/voice-ai/agent/utils/api-types.ts	MODIFY — mirror active_agent_profile in VoiceAiContext interface copy
14	api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts	MODIFY — add agentProfileId param to buildContext(); add three-step resolution chain
15	api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts	MODIFY — accept agent_profile_id query param and forward to buildContext()
16	api/src/modules/voice-ai/services/voice-ai-sip.service.ts	MODIFY — buildSipTwiml() add agentProfileId param; add X-Agent-Profile-Id SIP header to TwiML when present
17	api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts	MODIFY — extend IvrMenuOptionDto and IvrDefaultActionDto config type with optional agent_profile_id
18	api/src/modules/communication/services/ivr-configuration.service.ts	MODIFY — validateAction(), createOrUpdate() profile ownership check, executeVoiceAiAction() forward profile ID, buildSipTwiml() call update


END OF SPECIFICATION
Lead360 · Multi-Language Voice Agent · Backend Contract v1.0
