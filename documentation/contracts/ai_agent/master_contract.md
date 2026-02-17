# Voice AI Module - Master Contract

**Module**: Voice AI for Lead360  
**Version**: 2.0  
**Status**: Requirements Finalized  
**Purpose**: PM validation document - verify sprint coverage against all requirements

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Business Model](#2-business-model)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Database Requirements](#4-database-requirements)
5. [API Requirements](#5-api-requirements)
6. [System Admin Features](#6-system-admin-features)
7. [Tenant Admin Features](#7-tenant-admin-features)
8. [Python Agent Requirements](#8-python-agent-requirements)
9. [Integration Requirements](#9-integration-requirements)
10. [Security Requirements](#10-security-requirements)
11. [Testing Requirements](#11-testing-requirements)
12. [Sprint Coverage Checklist](#12-sprint-coverage-checklist)

---

## 1. Module Overview

### 1.1 Purpose

Enable Lead360 tenants to deploy AI-powered voice agents that:
- Answer inbound phone calls automatically
- Speak naturally in multiple languages
- Qualify leads and collect customer information
- Book appointments
- Transfer calls to human agents when needed
- Integrate with existing CRM data

### 1.2 Architecture Model

**Two-Layer Configuration**:

| Layer | Controller | Contains |
|-------|------------|----------|
| Infrastructure | System Admin ONLY | Providers, API keys, tier access, costs |
| Behavior | Tenant Admin (with global defaults) | Languages, greeting, instructions, tools, transfer numbers |

### 1.3 Business Model

- **Managed Service**: Lead360 owns all AI provider API keys
- **Tier-Based Access**: Feature enabled/disabled per subscription tier
- **Usage-Based Billing**: Track minutes per tenant for billing
- **Global Defaults**: All settings have platform defaults with tenant overrides

---

## 2. Business Model

### 2.1 Feature Access Control

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| BM-001 | Voice AI feature controlled by subscription tier flag | Must Have |
| BM-002 | Each tier has configurable minutes included | Must Have |
| BM-003 | System admin can override minutes limit per tenant | Must Have |
| BM-004 | Usage tracking per tenant for billing | Must Have |
| BM-005 | Overage rate configurable per tier | Should Have |

### 2.2 Provider Management

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| BM-006 | Lead360 manages all provider API keys centrally | Must Have |
| BM-007 | Tenants cannot see or select providers | Must Have |
| BM-008 | System admin sets global default providers | Must Have |
| BM-009 | System admin can override providers per tenant | Should Have |
| BM-010 | Provider-agnostic architecture (swap without code changes) | Must Have |

### 2.3 Cost Tracking

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| BM-011 | Track usage per provider type (STT, LLM, TTS) per call | Must Have |
| BM-012 | Store estimated cost per usage record | Should Have |
| BM-013 | Aggregate usage by tenant, date range | Must Have |
| BM-014 | Platform-wide usage dashboard for system admin | Should Have |

---

## 3. User Roles & Permissions

### 3.1 System Admin Permissions

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| UR-001 | Full CRUD on provider registry | Must Have |
| UR-002 | Manage encrypted API credentials | Must Have |
| UR-003 | Configure global defaults (infrastructure + behavior) | Must Have |
| UR-004 | Enable/disable voice AI per subscription tier | Must Have |
| UR-005 | Override infrastructure settings per tenant | Must Have |
| UR-006 | View all tenants' settings and usage | Must Have |
| UR-007 | View platform-wide analytics | Should Have |

### 3.2 Tenant Admin Permissions

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| UR-008 | Enable/disable voice AI for own tenant | Must Have |
| UR-009 | Configure languages (from global options) | Must Have |
| UR-010 | Set custom greeting | Must Have |
| UR-011 | Set custom instructions | Must Have |
| UR-012 | Toggle agent capabilities (booking, leads, transfer) | Must Have |
| UR-013 | Manage transfer numbers | Must Have |
| UR-014 | View own call history | Must Have |
| UR-015 | View own usage statistics | Must Have |

### 3.3 Tenant Admin Restrictions

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| UR-016 | Cannot view or change provider selection | Must Have |
| UR-017 | Cannot view or change API credentials | Must Have |
| UR-018 | Cannot view other tenants' data | Must Have |
| UR-019 | Cannot exceed tier limits | Must Have |

---

## 4. Database Requirements

### 4.1 New Tables Required

#### 4.1.1 voice_ai_providers (System Table)

| Requirement ID | Field | Type | Constraints | Priority |
|----------------|-------|------|-------------|----------|
| DB-001 | id | UUID | PK | Must Have |
| DB-002 | provider_type | Enum | stt, llm, tts, vad | Must Have |
| DB-003 | provider_key | String(50) | Unique, lowercase | Must Have |
| DB-004 | display_name | String(100) | Required | Must Have |
| DB-005 | description | Text | Optional | Should Have |
| DB-006 | is_active | Boolean | Default true | Must Have |
| DB-007 | config_schema | JSON | Valid JSON Schema | Must Have |
| DB-008 | default_config | JSON | Validates against schema | Should Have |
| DB-009 | capabilities | JSON | Optional | Should Have |
| DB-010 | pricing_info | JSON | Optional | Should Have |
| DB-011 | logo_url | String(500) | Optional | Nice to Have |
| DB-012 | documentation_url | String(500) | Optional | Nice to Have |
| DB-013 | created_at, updated_at | DateTime | Auto | Must Have |

#### 4.1.2 voice_ai_credentials (System Table)

| Requirement ID | Field | Type | Constraints | Priority |
|----------------|-------|------|-------------|----------|
| DB-014 | id | UUID | PK | Must Have |
| DB-015 | provider_id | UUID | FK, Unique | Must Have |
| DB-016 | credentials_encrypted | Blob | AES-256-GCM | Must Have |
| DB-017 | updated_by | UUID | FK to users | Must Have |
| DB-018 | created_at, updated_at | DateTime | Auto | Must Have |

#### 4.1.3 voice_ai_global_config (System Table - Singleton)

| Requirement ID | Field | Type | Constraints | Priority |
|----------------|-------|------|-------------|----------|
| DB-019 | id | UUID | PK, Single row only | Must Have |
| DB-020 | default_stt_provider_id | UUID | FK, Required | Must Have |
| DB-021 | default_stt_config | JSON | Optional | Should Have |
| DB-022 | default_llm_provider_id | UUID | FK, Required | Must Have |
| DB-023 | default_llm_config | JSON | Optional | Should Have |
| DB-024 | default_tts_provider_id | UUID | FK, Required | Must Have |
| DB-025 | default_tts_config | JSON | Optional | Should Have |
| DB-026 | default_voice_id | String(100) | Required | Must Have |
| DB-027 | default_languages | JSON Array | Required | Must Have |
| DB-028 | default_language | String(10) | Required | Must Have |
| DB-029 | default_greeting_template | Text | Required | Must Have |
| DB-030 | default_system_prompt | Text | Required | Must Have |
| DB-031 | default_tools_enabled | JSON | Required | Must Have |
| DB-032 | default_max_call_duration | Integer | Required | Must Have |
| DB-033 | default_transfer_behavior | String(20) | Required | Should Have |
| DB-034 | updated_by | UUID | FK to users | Must Have |
| DB-035 | updated_at | DateTime | Auto | Must Have |

#### 4.1.4 tenant_voice_ai_settings (Tenant Table)

| Requirement ID | Field | Type | Constraints | Priority |
|----------------|-------|------|-------------|----------|
| DB-036 | id | UUID | PK | Must Have |
| DB-037 | tenant_id | UUID | FK, Unique | Must Have |
| **Infrastructure Overrides (System Admin only)** |
| DB-038 | stt_provider_override_id | UUID | FK, Optional | Should Have |
| DB-039 | stt_config_override | JSON | Optional | Should Have |
| DB-040 | llm_provider_override_id | UUID | FK, Optional | Should Have |
| DB-041 | llm_config_override | JSON | Optional | Should Have |
| DB-042 | tts_provider_override_id | UUID | FK, Optional | Should Have |
| DB-043 | tts_config_override | JSON | Optional | Should Have |
| DB-044 | voice_id_override | String(100) | Optional | Should Have |
| DB-045 | monthly_minutes_override | Integer | Optional | Must Have |
| DB-046 | admin_notes | Text | Optional | Should Have |
| **Behavior Settings (Tenant Admin editable)** |
| DB-047 | is_enabled | Boolean | Default false | Must Have |
| DB-048 | enabled_languages | JSON Array | Optional | Must Have |
| DB-049 | default_language | String(10) | Optional | Must Have |
| DB-050 | custom_greeting | Text | Optional | Must Have |
| DB-051 | custom_instructions | Text | Optional | Must Have |
| DB-052 | booking_enabled | Boolean | Optional | Must Have |
| DB-053 | lead_creation_enabled | Boolean | Optional | Must Have |
| DB-054 | transfer_enabled | Boolean | Optional | Must Have |
| DB-055 | default_transfer_number | String(20) | Optional | Must Have |
| DB-056 | max_call_duration | Integer | Optional | Should Have |
| DB-057 | after_hours_behavior | Enum | Optional | Should Have |
| DB-058 | updated_by | UUID | FK to users | Must Have |
| DB-059 | created_at, updated_at | DateTime | Auto | Must Have |

#### 4.1.5 tenant_voice_transfer_numbers (Tenant Table)

| Requirement ID | Field | Type | Constraints | Priority |
|----------------|-------|------|-------------|----------|
| DB-060 | id | UUID | PK | Must Have |
| DB-061 | tenant_id | UUID | FK | Must Have |
| DB-062 | transfer_type | String(50) | Required | Must Have |
| DB-063 | label | String(100) | Required | Must Have |
| DB-064 | phone_number | String(20) | Required | Must Have |
| DB-065 | description | Text | Optional | Should Have |
| DB-066 | available_hours | JSON | Optional | Should Have |
| DB-067 | is_active | Boolean | Default true | Must Have |
| DB-068 | display_order | Integer | Default 0 | Should Have |
| DB-069 | Unique constraint | (tenant_id, transfer_type) | | Must Have |
| DB-070 | created_at, updated_at | DateTime | Auto | Must Have |

#### 4.1.6 voice_call_logs (Tenant Table)

| Requirement ID | Field | Type | Constraints | Priority |
|----------------|-------|------|-------------|----------|
| DB-071 | id | UUID | PK | Must Have |
| DB-072 | tenant_id | UUID | FK | Must Have |
| DB-073 | call_sid | String(50) | Required | Must Have |
| DB-074 | direction | Enum | inbound, outbound | Must Have |
| DB-075 | caller_phone | String(20) | Required | Must Have |
| DB-076 | callee_phone | String(20) | Required | Must Have |
| DB-077 | status | Enum | Multiple values | Must Have |
| DB-078 | duration_seconds | Integer | Optional | Must Have |
| DB-079 | started_at | DateTime | Required | Must Have |
| DB-080 | ended_at | DateTime | Optional | Must Have |
| DB-081 | transcript | Text | Optional | Must Have |
| DB-082 | summary | Text | Optional | Should Have |
| DB-083 | lead_id | UUID | FK, Optional | Should Have |
| DB-084 | actions_taken | JSON | Optional | Must Have |
| DB-085 | stt_provider_id | UUID | FK, Optional | Should Have |
| DB-086 | llm_provider_id | UUID | FK, Optional | Should Have |
| DB-087 | tts_provider_id | UUID | FK, Optional | Should Have |
| DB-088 | metadata | JSON | Optional | Should Have |
| DB-089 | Unique constraint | (tenant_id, call_sid) | | Must Have |
| DB-090 | created_at, updated_at | DateTime | Auto | Must Have |

#### 4.1.7 voice_usage_records (Tenant Table)

| Requirement ID | Field | Type | Constraints | Priority |
|----------------|-------|------|-------------|----------|
| DB-091 | id | UUID | PK | Must Have |
| DB-092 | tenant_id | UUID | FK | Must Have |
| DB-093 | call_log_id | UUID | FK | Must Have |
| DB-094 | provider_id | UUID | FK | Must Have |
| DB-095 | provider_type | Enum | stt, llm, tts | Must Have |
| DB-096 | usage_quantity | Decimal(10,4) | Required | Must Have |
| DB-097 | usage_unit | String(20) | Required | Must Have |
| DB-098 | estimated_cost | Decimal(10,6) | Optional | Should Have |
| DB-099 | created_at | DateTime | Auto | Must Have |

### 4.2 Existing Table Extensions

#### 4.2.1 subscription_tiers (Add Columns)

| Requirement ID | Field | Type | Constraints | Priority |
|----------------|-------|------|-------------|----------|
| DB-100 | voice_ai_enabled | Boolean | Default false | Must Have |
| DB-101 | voice_ai_minutes_included | Integer | Optional | Must Have |
| DB-102 | voice_ai_overage_rate | Decimal(6,4) | Optional | Should Have |

### 4.3 Indexes Required

| Requirement ID | Table | Index | Priority |
|----------------|-------|-------|----------|
| DB-103 | voice_ai_providers | (provider_type) | Must Have |
| DB-104 | voice_ai_providers | (is_active) | Must Have |
| DB-105 | tenant_voice_ai_settings | (is_enabled) | Must Have |
| DB-106 | tenant_voice_transfer_numbers | (tenant_id, is_active) | Must Have |
| DB-107 | voice_call_logs | (tenant_id, created_at) | Must Have |
| DB-108 | voice_call_logs | (tenant_id, status) | Must Have |
| DB-109 | voice_usage_records | (tenant_id, created_at) | Must Have |

### 4.4 Enums Required

| Requirement ID | Enum | Values | Priority |
|----------------|------|--------|----------|
| DB-110 | VoiceAiProviderType | stt, llm, tts, vad | Must Have |
| DB-111 | VoiceCallDirection | inbound, outbound | Must Have |
| DB-112 | VoiceCallStatus | initiated, ringing, in_progress, completed, failed, no_answer, transferred | Must Have |
| DB-113 | AfterHoursBehavior | voicemail, callback, emergency_only, unavailable | Should Have |

---

## 5. API Requirements

### 5.1 System Admin Endpoints

#### 5.1.1 Provider Management

| Requirement ID | Method | Endpoint | Purpose | Priority |
|----------------|--------|----------|---------|----------|
| API-001 | GET | /api/v1/system/voice-ai/providers | List all providers | Must Have |
| API-002 | GET | /api/v1/system/voice-ai/providers/:id | Get provider details | Must Have |
| API-003 | POST | /api/v1/system/voice-ai/providers | Create provider | Must Have |
| API-004 | PATCH | /api/v1/system/voice-ai/providers/:id | Update provider | Must Have |
| API-005 | DELETE | /api/v1/system/voice-ai/providers/:id | Delete provider | Must Have |

#### 5.1.2 Credentials Management

| Requirement ID | Method | Endpoint | Purpose | Priority |
|----------------|--------|----------|---------|----------|
| API-006 | GET | /api/v1/system/voice-ai/credentials | List (no secrets) | Must Have |
| API-007 | POST | /api/v1/system/voice-ai/credentials/:providerId | Save credentials | Must Have |
| API-008 | DELETE | /api/v1/system/voice-ai/credentials/:providerId | Delete credentials | Must Have |

#### 5.1.3 Global Configuration

| Requirement ID | Method | Endpoint | Purpose | Priority |
|----------------|--------|----------|---------|----------|
| API-009 | GET | /api/v1/system/voice-ai/global-config | Get global config | Must Have |
| API-010 | PUT | /api/v1/system/voice-ai/global-config | Update global config | Must Have |

#### 5.1.4 Tenant Management

| Requirement ID | Method | Endpoint | Purpose | Priority |
|----------------|--------|----------|---------|----------|
| API-011 | GET | /api/v1/system/voice-ai/tenants | List all tenant configs | Must Have |
| API-012 | GET | /api/v1/system/voice-ai/tenants/:tenantId | Get tenant config | Must Have |
| API-013 | PUT | /api/v1/system/voice-ai/tenants/:tenantId/infrastructure | Update infra overrides | Must Have |

#### 5.1.5 Platform Analytics

| Requirement ID | Method | Endpoint | Purpose | Priority |
|----------------|--------|----------|---------|----------|
| API-014 | GET | /api/v1/system/voice-ai/usage | Platform usage summary | Should Have |
| API-015 | GET | /api/v1/system/voice-ai/calls | All calls (admin view) | Should Have |

### 5.2 Tenant Admin Endpoints

#### 5.2.1 Settings

| Requirement ID | Method | Endpoint | Purpose | Priority |
|----------------|--------|----------|---------|----------|
| API-016 | GET | /api/v1/voice-ai/settings | Get own settings | Must Have |
| API-017 | PUT | /api/v1/voice-ai/settings | Update behavior settings | Must Have |

#### 5.2.2 Transfer Numbers

| Requirement ID | Method | Endpoint | Purpose | Priority |
|----------------|--------|----------|---------|----------|
| API-018 | GET | /api/v1/voice-ai/transfer-numbers | List transfer numbers | Must Have |
| API-019 | POST | /api/v1/voice-ai/transfer-numbers | Create transfer number | Must Have |
| API-020 | PATCH | /api/v1/voice-ai/transfer-numbers/:id | Update transfer number | Must Have |
| API-021 | DELETE | /api/v1/voice-ai/transfer-numbers/:id | Delete transfer number | Must Have |

#### 5.2.3 Call History & Usage

| Requirement ID | Method | Endpoint | Purpose | Priority |
|----------------|--------|----------|---------|----------|
| API-022 | GET | /api/v1/voice-ai/calls | List own calls | Must Have |
| API-023 | GET | /api/v1/voice-ai/calls/:id | Get call details | Must Have |
| API-024 | GET | /api/v1/voice-ai/usage | Get own usage | Must Have |

### 5.3 Internal API (Python Agent Only)

| Requirement ID | Method | Endpoint | Purpose | Priority |
|----------------|--------|----------|---------|----------|
| API-025 | GET | /api/internal/voice-ai/tenant/:tenantId/context | Full agent context | Must Have |
| API-026 | GET | /api/internal/voice-ai/tenant/:tenantId/access | Check access | Must Have |
| API-027 | POST | /api/internal/voice-ai/tenant/:tenantId/tools/:tool | Execute CRM tool | Must Have |
| API-028 | POST | /api/internal/voice-ai/calls | Create call log | Must Have |
| API-029 | PATCH | /api/internal/voice-ai/calls/:callSid | Update call log | Must Have |
| API-030 | POST | /api/internal/voice-ai/calls/:callSid/complete | Complete call with usage | Must Have |

### 5.4 Webhooks

| Requirement ID | Method | Endpoint | Purpose | Priority |
|----------------|--------|----------|---------|----------|
| API-031 | POST | /api/webhooks/voice-ai/livekit | LiveKit events | Must Have |

---

## 6. System Admin Features

### 6.1 Provider Management UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| SA-001 | List all providers with filters (type, status) | Must Have |
| SA-002 | Create new provider with JSON Schema editor | Must Have |
| SA-003 | Edit provider (except key and type) | Must Have |
| SA-004 | Delete provider (block if in use) | Must Have |
| SA-005 | Show usage count per provider | Should Have |

### 6.2 Credentials Management UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| SA-006 | List providers with credential status | Must Have |
| SA-007 | Save credentials (masked input) | Must Have |
| SA-008 | Delete credentials | Must Have |
| SA-009 | Never display actual credential values | Must Have |

### 6.3 Global Configuration UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| SA-010 | Select default STT provider with config | Must Have |
| SA-011 | Select default LLM provider with config | Must Have |
| SA-012 | Select default TTS provider with config | Must Have |
| SA-013 | Select default voice with preview | Must Have |
| SA-014 | Configure default languages | Must Have |
| SA-015 | Edit default greeting template | Must Have |
| SA-016 | Edit default system prompt | Must Have |
| SA-017 | Configure default tool toggles | Must Have |
| SA-018 | Set default max call duration | Should Have |
| SA-019 | Set default transfer behavior | Should Have |

### 6.4 Tier Configuration UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| SA-020 | Toggle voice_ai_enabled per tier | Must Have |
| SA-021 | Set minutes_included per tier | Must Have |
| SA-022 | Set overage_rate per tier | Should Have |

### 6.5 Tenant Override UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| SA-023 | List all tenants with voice AI status | Must Have |
| SA-024 | Override provider selections per tenant | Should Have |
| SA-025 | Override minutes limit per tenant | Must Have |
| SA-026 | Add admin notes per tenant | Should Have |
| SA-027 | View tenant usage summary | Must Have |

### 6.6 Platform Analytics UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| SA-028 | Total calls and minutes (platform-wide) | Should Have |
| SA-029 | Usage over time chart | Should Have |
| SA-030 | Top tenants by usage | Should Have |
| SA-031 | Usage breakdown by provider | Should Have |
| SA-032 | Cost estimates | Nice to Have |

---

## 7. Tenant Admin Features

### 7.1 Voice AI Settings UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| TA-001 | Show feature availability (tier check) | Must Have |
| TA-002 | Enable/disable toggle | Must Have |
| TA-003 | Usage summary (minutes used/limit) | Must Have |
| TA-004 | Quick stats (calls, leads, appointments) | Should Have |

### 7.2 Language & Greeting UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| TA-005 | Select enabled languages (from global options) | Must Have |
| TA-006 | Set primary language | Must Have |
| TA-007 | Custom greeting editor | Must Have |
| TA-008 | Custom instructions editor | Must Have |
| TA-009 | Show default when custom is empty | Must Have |

### 7.3 Agent Capabilities UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| TA-010 | Toggle booking capability | Must Have |
| TA-011 | Toggle lead creation capability | Must Have |
| TA-012 | Toggle transfer capability | Must Have |

### 7.4 Transfer Numbers UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| TA-013 | Set default transfer number | Must Have |
| TA-014 | Add department transfer numbers | Must Have |
| TA-015 | Edit transfer numbers | Must Have |
| TA-016 | Delete transfer numbers | Must Have |
| TA-017 | Set availability hours per number | Should Have |
| TA-018 | Reorder transfer numbers | Nice to Have |

### 7.5 Call Settings UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| TA-019 | Set max call duration | Should Have |
| TA-020 | Set after-hours behavior | Should Have |

### 7.6 IVR Integration UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| TA-021 | Add voice AI option to IVR menu | Must Have |
| TA-022 | Configure IVR key for voice AI | Must Have |

### 7.7 Call History UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| TA-023 | List calls with pagination | Must Have |
| TA-024 | Filter by date range | Must Have |
| TA-025 | Filter by status | Should Have |
| TA-026 | Filter by outcome | Should Have |
| TA-027 | Search by phone number | Should Have |
| TA-028 | View call details (transcript, actions) | Must Have |

### 7.8 Usage Dashboard UI

| Requirement ID | Feature | Priority |
|----------------|---------|----------|
| TA-029 | Minutes used vs limit (progress bar) | Must Have |
| TA-030 | Usage over time chart | Should Have |
| TA-031 | Calls by outcome breakdown | Should Have |
| TA-032 | Recent calls list | Should Have |

---

## 8. Python Agent Requirements

### 8.1 Architecture

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| AG-001 | Provider-agnostic architecture with interfaces | Must Have |
| AG-002 | Provider registry mapping keys to implementations | Must Have |
| AG-003 | Provider factory creating instances from config | Must Have |
| AG-004 | HTTP client for Lead360 internal API | Must Have |

### 8.2 Provider Implementations

| Requirement ID | Provider | Type | Priority |
|----------------|----------|------|----------|
| AG-005 | Deepgram | STT | Must Have |
| AG-006 | AssemblyAI | STT | Nice to Have |
| AG-007 | OpenAI GPT-4o-mini | LLM | Must Have |
| AG-008 | OpenAI GPT-4o | LLM | Should Have |
| AG-009 | Anthropic Claude | LLM | Nice to Have |
| AG-010 | Cartesia | TTS | Must Have |
| AG-011 | ElevenLabs | TTS | Nice to Have |

### 8.3 Agent Functionality

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| AG-012 | Receive calls via LiveKit SIP | Must Have |
| AG-013 | Extract tenant_id from SIP headers | Must Have |
| AG-014 | Fetch full context from Lead360 API | Must Have |
| AG-015 | Build system prompt from context | Must Have |
| AG-016 | Conversation loop (STT → LLM → TTS) | Must Have |
| AG-017 | Play greeting at call start | Must Have |
| AG-018 | Handle tool calls (booking, lead, transfer) | Must Have |
| AG-019 | Log call completion with transcript | Must Have |
| AG-020 | Record usage per provider | Must Have |

### 8.4 Multi-Language Support

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| AG-021 | Support English, Spanish, Portuguese | Must Have |
| AG-022 | Detect caller language | Should Have |
| AG-023 | Switch language mid-call if supported | Should Have |

### 8.5 Error Handling

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| AG-024 | Graceful provider error handling | Must Have |
| AG-025 | Retry logic for transient failures | Should Have |
| AG-026 | Fallback messages for errors | Must Have |
| AG-027 | Log all errors for debugging | Must Have |

### 8.6 Tools (CRM Actions)

| Requirement ID | Tool | Purpose | Priority |
|----------------|------|---------|----------|
| AG-028 | book_appointment | Schedule appointment | Should Have |
| AG-029 | create_lead | Create lead record | Must Have |
| AG-030 | transfer_call | Get transfer number | Must Have |
| AG-031 | check_availability | Check calendar | Nice to Have |

---

## 9. Integration Requirements

### 9.1 Existing Module Integration

| Requirement ID | Module | Integration | Priority |
|----------------|--------|-------------|----------|
| INT-001 | tenant_settings | Read business name, description, hours | Must Have |
| INT-002 | service_catalog | Read services offered | Must Have |
| INT-003 | service_areas | Read geographic coverage | Must Have |
| INT-004 | subscription_tiers | Read/extend tier settings | Must Have |
| INT-005 | IVR module | Add voice AI menu option | Must Have |
| INT-006 | Twilio | Receive inbound calls | Must Have |
| INT-007 | Leads module | Create leads via API | Must Have |
| INT-008 | Appointments module | Book appointments via API | Should Have |
| INT-009 | Users module | Audit trails (updated_by) | Must Have |
| INT-010 | Encryption service | Encrypt/decrypt credentials | Must Have |

### 9.2 External Service Integration

| Requirement ID | Service | Purpose | Priority |
|----------------|---------|---------|----------|
| INT-011 | LiveKit Cloud | WebRTC/SIP routing | Must Have |
| INT-012 | Deepgram | Speech-to-text | Must Have |
| INT-013 | OpenAI | Language model | Must Have |
| INT-014 | Cartesia | Text-to-speech | Must Have |

### 9.3 Fallback Resolution

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| INT-015 | All settings resolve: tenant override → global default | Must Have |
| INT-016 | Minutes limit: tenant override → tier limit → unlimited | Must Have |
| INT-017 | Languages: tenant selection must be subset of global | Must Have |

---

## 10. Security Requirements

### 10.1 Authentication

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| SEC-001 | System admin endpoints require SystemAdmin role | Must Have |
| SEC-002 | Tenant endpoints require authenticated user with tenant_id | Must Have |
| SEC-003 | Internal API requires X-Internal-Api-Key header | Must Have |
| SEC-004 | Webhooks require signature verification | Must Have |

### 10.2 Authorization

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| SEC-005 | Tenant cannot access infrastructure settings | Must Have |
| SEC-006 | Tenant cannot access other tenants' data | Must Have |
| SEC-007 | Tenant cannot update infrastructure via behavior endpoint | Must Have |

### 10.3 Data Protection

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| SEC-008 | API credentials encrypted at rest (AES-256-GCM) | Must Have |
| SEC-009 | Credentials never returned in API responses | Must Have |
| SEC-010 | Credentials never logged | Must Have |
| SEC-011 | Internal API key timing-safe comparison | Must Have |

### 10.4 Multi-Tenant Isolation

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| SEC-012 | All tenant table queries include tenant_id filter | Must Have |
| SEC-013 | tenant_id from JWT, never from request body | Must Have |
| SEC-014 | Tenant isolation tests for all tenant endpoints | Must Have |

---

## 11. Testing Requirements

### 11.1 Unit Tests

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| TEST-001 | Service unit tests > 80% coverage | Must Have |
| TEST-002 | Fallback resolution logic tests | Must Have |
| TEST-003 | Validation logic tests | Must Have |

### 11.2 Integration Tests

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| TEST-004 | All API endpoints tested | Must Have |
| TEST-005 | Authorization tests (role-based) | Must Have |
| TEST-006 | Error response tests | Must Have |

### 11.3 Multi-Tenant Isolation Tests

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| TEST-007 | Cannot list other tenant's settings | Must Have |
| TEST-008 | Cannot view other tenant's calls | Must Have |
| TEST-009 | Cannot update other tenant's data | Must Have |
| TEST-010 | Cannot delete other tenant's data | Must Have |

### 11.4 Security Tests

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| TEST-011 | Credentials encrypted in database | Must Have |
| TEST-012 | Credentials not in API responses | Must Have |
| TEST-013 | Internal API rejects invalid key | Must Have |

---

## 12. Sprint Coverage Checklist

Use this checklist to verify sprint coverage of all requirements.

### Database Requirements Coverage

| Requirement | Sprint(s) | Covered? |
|-------------|-----------|----------|
| DB-001 to DB-013 (voice_ai_providers) | B01 | ☐ |
| DB-014 to DB-018 (voice_ai_credentials) | B03 | ☐ |
| DB-019 to DB-035 (voice_ai_global_config) | B04 | ☐ |
| DB-036 to DB-059 (tenant_voice_ai_settings) | B07 | ☐ |
| DB-060 to DB-070 (tenant_voice_transfer_numbers) | B07 | ☐ |
| DB-071 to DB-090 (voice_call_logs) | B11 | ☐ |
| DB-091 to DB-099 (voice_usage_records) | B11 | ☐ |
| DB-100 to DB-102 (subscription_tiers extension) | B06 | ☐ |
| DB-103 to DB-109 (indexes) | B01, B07, B11 | ☐ |
| DB-110 to DB-113 (enums) | B01, B07, B11 | ☐ |

### API Requirements Coverage

| Requirement | Sprint(s) | Covered? |
|-------------|-----------|----------|
| API-001 to API-005 (Provider CRUD) | B02 | ☐ |
| API-006 to API-008 (Credentials) | B03 | ☐ |
| API-009 to API-010 (Global Config) | B05 | ☐ |
| API-011 to API-013 (Tenant Admin) | B09 | ☐ |
| API-014 to API-015 (Platform Analytics) | B12 | ☐ |
| API-016 to API-017 (Tenant Settings) | B09 | ☐ |
| API-018 to API-021 (Transfer Numbers) | B09 | ☐ |
| API-022 to API-024 (Call History & Usage) | B12 | ☐ |
| API-025 to API-030 (Internal API) | B13, B14 | ☐ |
| API-031 (Webhooks) | B15 | ☐ |

### System Admin UI Coverage

| Requirement | Sprint(s) | Covered? |
|-------------|-----------|----------|
| SA-001 to SA-005 (Provider Management) | FSA01 | ☐ |
| SA-006 to SA-009 (Credentials) | FSA02 | ☐ |
| SA-010 to SA-019 (Global Config) | FSA03, FSA04 | ☐ |
| SA-020 to SA-022 (Tier Config) | FSA05 | ☐ |
| SA-023 to SA-027 (Tenant Overrides) | FSA06 | ☐ |
| SA-028 to SA-032 (Platform Analytics) | FSA07, FSA08 | ☐ |

### Tenant Admin UI Coverage

| Requirement | Sprint(s) | Covered? |
|-------------|-----------|----------|
| TA-001 to TA-004 (Settings Overview) | FTA01 | ☐ |
| TA-005 to TA-009 (Language & Greeting) | FTA02 | ☐ |
| TA-010 to TA-012 (Capabilities) | FTA02 | ☐ |
| TA-013 to TA-018 (Transfer Numbers) | FTA03 | ☐ |
| TA-019 to TA-020 (Call Settings) | FTA03 | ☐ |
| TA-021 to TA-022 (IVR Integration) | FTA04 | ☐ |
| TA-023 to TA-028 (Call History) | FTA05 | ☐ |
| TA-029 to TA-032 (Usage Dashboard) | FTA06 | ☐ |

### Agent Requirements Coverage

| Requirement | Sprint(s) | Covered? |
|-------------|-----------|----------|
| AG-001 to AG-004 (Architecture) | A01, A02, A03, A04 | ☐ |
| AG-005 to AG-011 (Provider Implementations) | A05, A06, A07 | ☐ |
| AG-012 to AG-020 (Agent Functionality) | A08, A09, A10, A11 | ☐ |
| AG-021 to AG-023 (Multi-Language) | A12 | ☐ |
| AG-024 to AG-027 (Error Handling) | A12 | ☐ |
| AG-028 to AG-031 (Tools) | A10 | ☐ |

### Integration Requirements Coverage

| Requirement | Sprint(s) | Covered? |
|-------------|-----------|----------|
| INT-001 to INT-010 (Existing Modules) | B10 | ☐ |
| INT-011 to INT-014 (External Services) | A05, A06, A07, A09 | ☐ |
| INT-015 to INT-017 (Fallback Resolution) | B08 | ☐ |

### Security Requirements Coverage

| Requirement | Sprint(s) | Covered? |
|-------------|-----------|----------|
| SEC-001 to SEC-004 (Authentication) | B02, B09, B13, B15 | ☐ |
| SEC-005 to SEC-007 (Authorization) | B09 | ☐ |
| SEC-008 to SEC-011 (Data Protection) | B03 | ☐ |
| SEC-012 to SEC-014 (Multi-Tenant Isolation) | B08, B09, B12 | ☐ |

### Testing Requirements Coverage

| Requirement | Sprint(s) | Covered? |
|-------------|-----------|----------|
| TEST-001 to TEST-003 (Unit Tests) | All backend sprints | ☐ |
| TEST-004 to TEST-006 (Integration Tests) | All backend sprints | ☐ |
| TEST-007 to TEST-010 (Tenant Isolation) | B08, B09, B12 | ☐ |
| TEST-011 to TEST-013 (Security Tests) | B03, B13 | ☐ |

---

## Document Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Project Manager | | | |
| Tech Lead | | | |
| Security Review | | | |

---

**End of Master Contract**