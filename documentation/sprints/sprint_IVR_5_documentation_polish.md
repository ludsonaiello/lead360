# Sprint IVR-5: Documentation & Polish

**Sprint Goal**: Update API documentation, document internal endpoints, create user guide, and perform final testing/bug fixes.

**Duration**: 3-4 hours
**Priority**: MEDIUM (cleanup and documentation)
**Dependencies**: Sprint IVR-4 (all features working end-to-end)

---

## Context

All multi-level IVR functionality is now implemented and tested. This final sprint ensures:
- API documentation accurately reflects multi-level support
- Internal Voice AI endpoints are documented (currently missing)
- User-facing guide explains how to use multi-level IVR
- All edge cases are tested and bugs fixed
- Code is clean and production-ready

---

## Sprint Tasks

### Task 1: Update REST API Documentation for Multi-Level IVR

**File**: `/var/www/lead360.app/api/documentation/communication_twillio_REST_API.md`

**Current State** (from exploration):
- 2,687 lines
- Documents IVR endpoints but only single-level structure
- Missing multi-level examples and depth limits

#### Updates Required:

**1.1 Add Multi-Level IVR Section**

**Find IVR Configuration Section** (around line 1000-1200) and update:

```markdown
## Multi-Level IVR Support

Lead360 supports multi-level (nested) IVR menus with up to 5 levels of depth. This allows for complex phone tree navigation similar to enterprise phone systems.

### Key Features

- **Nested Submenus**: Each menu option can either execute a terminal action or open a submenu with its own greeting and options
- **Configurable Depth**: Tenants can set max_depth (1-5 levels) to control menu complexity
- **Path-Based Navigation**: Twilio navigates through menu levels using path notation (e.g., "1.2.1")
- **Recursive Structure**: Submenus can contain submenus up to the configured depth limit
- **Validation**: Automatic detection of circular references, depth violations, and node count limits

### Action Types

| Action | Description | Config Required | Can be in Submenu? |
|--------|-------------|-----------------|-------------------|
| `route_to_number` | Forward call to specific phone number | `phone_number` (E.164) | ✅ Yes |
| `route_to_default` | Forward to default company number | None | ✅ Yes |
| `trigger_webhook` | Send webhook notification | `webhook_url` (HTTPS) | ✅ Yes |
| `voicemail` | Record voicemail message | `max_duration_seconds` (60-300) | ✅ Yes |
| `voice_ai` | Connect to AI voice assistant | None (uses tenant Voice AI config) | ✅ Yes |
| `submenu` | Navigate to nested submenu | `submenu` object with greeting and options | ✅ Yes (up to max_depth) |

### Data Model

#### IVR Menu Option (Recursive)

```typescript
interface IVRMenuOption {
  id: string;                        // UUID (required for circular reference detection)
  digit: string;                     // "0"-"9"
  action: IVRActionType;
  label: string;                     // 1-100 characters
  config: {
    phone_number?: string;           // E.164 format (e.g., "+19781234567")
    webhook_url?: string;            // HTTPS only
    max_duration_seconds?: number;   // 60-300 seconds
  };
  submenu?: {                        // Only present if action === "submenu"
    greeting_message: string;        // 5-500 characters
    options: IVRMenuOption[];       // Recursive array (1-10 options)
    timeout_seconds?: number;        // Optional override (5-60 seconds)
  };
}
```

### Constraints

- **Max Depth**: 1-5 levels (default: 4)
- **Max Options Per Level**: 10 (digits 0-9)
- **Max Total Nodes**: 100 across entire tree
- **Greeting Length**: 5-500 characters (root and submenu)
- **Digit Uniqueness**: Must be unique within each level (not globally)
- **Circular References**: Not allowed (validated by checking duplicate UUIDs)
- **Submenu Action**: Cannot be used at max_depth (terminal actions only)

### Example: Multi-Level IVR Configuration

```json
{
  "ivr_enabled": true,
  "greeting_message": "Thank you for calling ABC Company.",
  "menu_options": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "digit": "1",
      "action": "submenu",
      "label": "Sales Department",
      "config": {},
      "submenu": {
        "greeting_message": "Sales Department. Press 1 for new customers or 2 for existing customers.",
        "options": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "digit": "1",
            "action": "route_to_number",
            "label": "New Customers",
            "config": {
              "phone_number": "+19781234567"
            }
          },
          {
            "id": "550e8400-e29b-41d4-a716-446655440003",
            "digit": "2",
            "action": "submenu",
            "label": "Existing Customers",
            "config": {},
            "submenu": {
              "greeting_message": "Press 1 for account support or 2 for technical support.",
              "options": [
                {
                  "id": "550e8400-e29b-41d4-a716-446655440004",
                  "digit": "1",
                  "action": "voice_ai",
                  "label": "Account Support",
                  "config": {}
                },
                {
                  "id": "550e8400-e29b-41d4-a716-446655440005",
                  "digit": "2",
                  "action": "route_to_number",
                  "label": "Technical Support",
                  "config": {
                    "phone_number": "+19781234568"
                  }
                }
              ],
              "timeout_seconds": 15
            }
          }
        ],
        "timeout_seconds": 10
      }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440006",
      "digit": "2",
      "action": "voicemail",
      "label": "Leave a message",
      "config": {
        "max_duration_seconds": 180
      }
    }
  ],
  "default_action": {
    "action": "voicemail",
    "config": {
      "max_duration_seconds": 180
    }
  },
  "timeout_seconds": 10,
  "max_retries": 3,
  "max_depth": 4
}
```

**Call Flow for Above Example**:

1. Caller hears: "Thank you for calling ABC Company. Press 1 for Sales Department or 2 to leave a message."
2. Caller presses 1
3. Caller hears: "Sales Department. Press 1 for new customers or 2 for existing customers."
4. Caller presses 2
5. Caller hears: "Press 1 for account support or 2 for technical support."
6. Caller presses 1
7. Call connects to Voice AI assistant

### TwiML Navigation

Multi-level IVR uses path-based navigation:

- **Root Level**: `/api/v1/communication/twilio/ivr/menu`
- **First Submenu**: `/api/v1/communication/twilio/ivr/menu?path=1` (after pressing 1)
- **Second Level**: `/api/v1/communication/twilio/ivr/menu?path=1.2` (pressed 1, then 2)
- **Third Level**: `/api/v1/communication/twilio/ivr/menu?path=1.2.1` (pressed 1, then 2, then 1)

Path accumulates as user navigates deeper. Each level generates TwiML with current menu's greeting and options.

### Validation Errors

| Error | Cause | HTTP Status |
|-------|-------|-------------|
| `Menu depth exceeds maximum of {N} levels` | Nested submenus exceed max_depth | 400 |
| `Circular reference detected: Option ID "{id}" appears multiple times` | Duplicate UUID in tree | 400 |
| `Total menu options ({N}) exceeds maximum of 100` | Too many nodes across tree | 400 |
| `Digits must be unique within each submenu level` | Duplicate digit at same level | 400 |
| `Option has submenu action but no submenu configuration` | Missing submenu object | 400 |
| `Option has submenu configuration but action is not submenu` | Action/config mismatch | 400 |
| `Invalid menu path: digit "{digit}" not found` | Invalid path during call | 404 |
```

---

### Task 2: Document Internal Voice AI Endpoints

**File**: `/var/www/lead360.app/api/documentation/voice_ai_REST_API.md`

**Current State** (from exploration):
- 1,787 lines
- Missing internal endpoints used by Python Voice AI agent

#### Add New Section:

**Insert after Admin Endpoints section** (around line 1500):

```markdown
---

## Internal Endpoints (Voice AI Agent Integration)

**⚠️ INTERNAL USE ONLY**: These endpoints are used by the Python Voice AI agent running in separate containers. They require special authentication via `X-Voice-Agent-Key` header.

**Authentication**:
- Header: `X-Voice-Agent-Key: {global_config.agent_api_key}`
- This key is managed in Voice AI Global Configuration (admin only)
- Automatically rotated on regeneration

---

### 1. Check Tenant Access (Pre-flight)

**Endpoint**: `GET /api/v1/internal/voice-ai/tenant/:tenantId/access`

**Purpose**: Pre-flight check to determine if tenant can use Voice AI for this call. Validates subscription plan, checks quota, and returns access decision.

**Request**:
```http
GET /api/v1/internal/voice-ai/tenant/14a34ab2-6f6f-4e41-9bea-c444a304557e/access
X-Voice-Agent-Key: secret-key-here
```

**Response** (200 OK - Access Granted):
```json
{
  "allowed": true,
  "reason": "quota_available",
  "tenant": {
    "id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "subdomain": "honeydo4you",
    "business_name": "HoneyDo Home Services"
  },
  "quota": {
    "minutes_used": 120,
    "minutes_limit": 500,
    "minutes_remaining": 380,
    "overage_rate": null
  },
  "plan": {
    "tier": "professional",
    "voice_ai_enabled": true,
    "voice_ai_minutes_included": 500
  }
}
```

**Response** (200 OK - Access Denied):
```json
{
  "allowed": false,
  "reason": "quota_exceeded",
  "fallback_action": "transfer_to_number",
  "fallback_config": {
    "phone_number": "+19781234567",
    "message": "We are currently experiencing high call volume. Transferring you to our team."
  }
}
```

**Denial Reasons**:
- `voice_ai_disabled`: Tenant has Voice AI disabled in settings
- `plan_not_included`: Subscription plan doesn't include Voice AI
- `quota_exceeded`: Monthly minutes limit reached and no overage rate configured
- `no_credentials`: Missing STT/LLM/TTS provider credentials
- `tenant_not_found`: Invalid tenant ID

---

### 2. Get Full Voice AI Context

**Endpoint**: `GET /api/v1/internal/voice-ai/tenant/:tenantId/context`

**Purpose**: Retrieve complete merged context for Voice AI agent including decrypted API keys, tenant settings, and business information.

**Request**:
```http
GET /api/v1/internal/voice-ai/tenant/14a34ab2-6f6f-4e41-9bea-c444a304557e/context
X-Voice-Agent-Key: secret-key-here
```

**Response** (200 OK):
```json
{
  "tenant": {
    "id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "subdomain": "honeydo4you",
    "business_name": "HoneyDo Home Services",
    "business_description": "Professional home repair and maintenance services",
    "industry": "Home Services"
  },
  "settings": {
    "voice_ai_enabled": true,
    "default_language": "en-US",
    "greeting_message": "Hi, I'm the HoneyDo assistant. How can I help you today?",
    "system_prompt": "You are a helpful assistant for HoneyDo Home Services...",
    "transfer_enabled": true,
    "default_transfer_number": "+19781234567",
    "voicemail_enabled": true
  },
  "providers": {
    "stt": {
      "provider_id": "deepgram-stt",
      "provider_name": "Deepgram",
      "model": "nova-2",
      "api_key": "decrypted-key-here"
    },
    "llm": {
      "provider_id": "openai-gpt4",
      "provider_name": "OpenAI GPT-4",
      "model": "gpt-4-turbo",
      "api_key": "decrypted-key-here"
    },
    "tts": {
      "provider_id": "elevenlabs-tts",
      "provider_name": "ElevenLabs",
      "voice_id": "rachel",
      "api_key": "decrypted-key-here"
    }
  },
  "transfer_numbers": [
    {
      "id": "uuid-here",
      "label": "Main Office",
      "phone_number": "+19781234567",
      "priority": 1
    }
  ]
}
```

**Security Notes**:
- API keys are decrypted server-side (stored encrypted in database)
- Response is only sent over HTTPS
- Agent must validate X-Voice-Agent-Key before decryption

---

### 3. Start Call Log

**Endpoint**: `POST /api/v1/internal/voice-ai/calls/start`

**Purpose**: Create call log record when Voice AI call begins. Returns call log ID for tracking.

**Request**:
```http
POST /api/v1/internal/voice-ai/calls/start
X-Voice-Agent-Key: secret-key-here
Content-Type: application/json

{
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "call_sid": "CA1234567890abcdef",
  "room_name": "room-abc123",
  "from_number": "+12025551234",
  "to_number": "+19781234567",
  "direction": "inbound",
  "language_used": "en-US",
  "intent": "sales_new_customer",
  "stt_provider_id": "deepgram-stt",
  "llm_provider_id": "openai-gpt4",
  "tts_provider_id": "elevenlabs-tts"
}
```

**Response** (201 Created):
```json
{
  "call_log_id": "550e8400-e29b-41d4-a716-446655440000",
  "call_sid": "CA1234567890abcdef",
  "status": "in_progress",
  "started_at": "2026-02-25T10:30:00Z"
}
```

**Field Descriptions**:
- `intent`: Optional. If call came from IVR submenu, this captures the selected path/intent
- `direction`: "inbound" or "outbound"
- `language_used`: ISO language code (e.g., "en-US", "es-ES")
- `stt_provider_id`: STT provider used for this call
- `llm_provider_id`: LLM provider used for this call
- `tts_provider_id`: TTS provider used for this call

---

### 4. Complete Call Log

**Endpoint**: `POST /api/v1/internal/voice-ai/calls/:callSid/complete`

**Purpose**: Finalize call log with usage data, transcript, and outcomes. Persists usage for billing.

**Request**:
```http
POST /api/v1/internal/voice-ai/calls/CA1234567890abcdef/complete
X-Voice-Agent-Key: secret-key-here
Content-Type: application/json

{
  "status": "completed",
  "end_reason": "caller_hangup",
  "duration_seconds": 185,
  "recording_url": "https://api.twilio.com/recordings/RE1234",
  "transcript": "Full conversation transcript here...",
  "sentiment": "positive",
  "call_outcome": "qualified_lead",
  "transferred": false,
  "transfer_number": null,
  "voicemail_left": false,
  "usage": {
    "stt_seconds": 120,
    "llm_tokens_input": 1500,
    "llm_tokens_output": 800,
    "tts_characters": 3200,
    "total_cost_usd": 0.45
  }
}
```

**Response** (200 OK):
```json
{
  "call_log_id": "550e8400-e29b-41d4-a716-446655440000",
  "call_sid": "CA1234567890abcdef",
  "status": "completed",
  "duration_seconds": 185,
  "usage_recorded": true,
  "quota_updated": true,
  "tenant_minutes_used": 123.08,
  "tenant_minutes_remaining": 376.92
}
```

**End Reasons**:
- `caller_hangup`: Caller disconnected
- `agent_transfer`: Transferred to human agent
- `voicemail`: Left voicemail
- `timeout`: Call timed out (no response)
- `error`: Technical error occurred

**Call Outcomes**:
- `qualified_lead`: Successfully qualified lead
- `appointment_scheduled`: Booked appointment
- `information_provided`: Provided information
- `transferred_to_agent`: Transferred to human
- `voicemail`: Left voicemail
- `unqualified`: Did not meet qualification criteria

---

### Error Responses

**401 Unauthorized** (Invalid or missing X-Voice-Agent-Key):
```json
{
  "statusCode": 401,
  "message": "Invalid or missing Voice Agent API key",
  "error": "Unauthorized"
}
```

**403 Forbidden** (Tenant access denied):
```json
{
  "statusCode": 403,
  "message": "Tenant does not have access to Voice AI",
  "reason": "quota_exceeded",
  "error": "Forbidden"
}
```

**404 Not Found** (Tenant or call not found):
```json
{
  "statusCode": 404,
  "message": "Tenant not found",
  "error": "Not Found"
}
```

---

### Security Considerations

1. **API Key Rotation**: Agent API key should be rotated periodically. Regenerate via Admin Global Config endpoint.

2. **Encryption**: All API keys in context response are decrypted from database. Never log or expose these keys.

3. **Rate Limiting**: Internal endpoints are rate-limited to prevent abuse (100 requests/minute per tenant).

4. **IP Whitelisting**: Consider restricting internal endpoints to Voice AI container IPs only.

5. **Audit Logging**: All internal endpoint calls are logged with tenant ID, call SID, and timestamp.
```

---

### Task 3: Create User Guide for Multi-Level IVR

**File**: `/var/www/lead360.app/documentation/user_guides/multi_level_ivr_guide.md` (NEW)

```markdown
# Multi-Level IVR User Guide

**Last Updated**: February 2026
**Feature**: Multi-Level IVR (Interactive Voice Response)
**Audience**: Lead360 Tenants (Business Owners, Admins)

---

## What is Multi-Level IVR?

Multi-Level IVR allows you to create complex phone tree menus with nested submenus, similar to the systems used by large enterprises. Instead of a simple flat menu, you can create hierarchical navigation:

**Example**:
```
Root Menu:
  Press 1 for Sales
    → Submenu:
      Press 1 for New Customers
      Press 2 for Existing Customers
        → Sub-Submenu:
          Press 1 for Account Support
          Press 2 for Technical Support
  Press 2 for Support
```

---

## Benefits

- **Better Call Routing**: Direct callers to the right department/person faster
- **Professional Image**: Enterprise-grade phone system for small businesses
- **Reduced Missed Calls**: Automated routing 24/7
- **AI Integration**: Route specific paths to Voice AI assistant
- **Flexibility**: Up to 5 levels of nested menus

---

## Getting Started

### Step 1: Navigate to IVR Settings

1. Log in to Lead360
2. Go to **Communications → Twilio → IVR**
3. Click **Configure IVR** (first time) or **Edit** (if already configured)

### Step 2: Enable IVR

Toggle **Enable IVR Menu** to ON.

### Step 3: Set Root Greeting

Enter the message callers will hear first (keep it under 30 seconds):

**Example**: "Thank you for calling ABC Company. Press 1 for Sales, Press 2 for Support, or Press 3 to leave a message."

---

## Creating Menu Options

### Basic Options (Root Level)

Click **Add Option** to create your first menu choice:

1. **Digit** (0-9): Which key callers press
2. **Label**: Internal name (e.g., "Sales Department")
3. **Action**: What happens when they press this key

### Available Actions

| Action | What It Does | When to Use |
|--------|--------------|-------------|
| **Route to Phone Number** | Forwards call to a specific number | Connect to team member's cell phone |
| **Route to Default** | Forwards to your main company number | General routing |
| **Voice AI Assistant** | Connects to AI voice agent | Automated lead qualification, FAQ |
| **Voicemail** | Records a message | After hours, busy times |
| **Trigger Webhook** | Sends notification to external system | Integration with other tools |
| **Navigate to Submenu** | Opens nested menu with more options | Complex routing (see below) |

---

## Creating Submenus (Multi-Level Navigation)

### When to Use Submenus

Use submenus when you need to:
- Break down departments into sub-categories
- Qualify callers before routing (new vs. existing customers)
- Offer specialized options within a department

### How to Create a Submenu

1. Add a menu option (e.g., Digit 1, Label "Sales")
2. Set **Action** to **Navigate to Submenu**
3. Click **Configure Submenu Options** (accordion expands)
4. Enter **Submenu Greeting** (e.g., "Sales Department. Press 1 for new customers or 2 for existing customers.")
5. Add submenu options (same process as root level)

**Visual Example**:

```
Option 1: Sales (Action: Submenu)
  ├── Submenu Greeting: "Sales. Press 1 for new or 2 for existing."
  ├── Option 1-1: New Customers (Action: Route to +1234567890)
  └── Option 1-2: Existing Customers (Action: Voice AI)
```

### Nesting Levels

You can nest up to **5 levels deep** (configurable in Advanced Settings):

```
Level 1: Press 1 for Sales
  Level 2: Press 1 for New Customers
    Level 3: Press 1 for Residential
      Level 4: Press 1 for Emergency Service
        Level 5: Press 1 for Plumbing
```

**⚠️ Recommendation**: Keep it to 3 levels or less. Deeper menus confuse callers.

---

## Advanced Settings

### Timeout

How long to wait for caller input before executing default action (5-60 seconds).

**Recommended**: 10 seconds

### Max Retries

How many times to retry after invalid input (1-5 attempts).

**Recommended**: 3 attempts

### Max Depth

Controls how many levels of submenus are allowed (1-5 levels).

**Recommended**: 4 levels

### Default Action

What happens if caller doesn't press anything or presses an invalid key.

**Recommended**: Voicemail or Route to Default

---

## Best Practices

### ✅ Do's

1. **Keep Greetings Short**: 20-30 seconds maximum
2. **Limit Options**: 3-5 options per level (callers can't remember 10 choices)
3. **Use Voice AI for Common Questions**: Route FAQs to AI assistant
4. **Test Your Menu**: Call your number and navigate through all paths
5. **Provide an "Out"**: Always offer a way to reach a human (e.g., "Press 0 for operator")
6. **Mobile-Friendly**: Remember callers may be driving (keep it simple)

### ❌ Don'ts

1. **Don't Nest Too Deep**: Beyond 3 levels, callers get frustrated
2. **Don't Use Jargon**: Speak in terms callers understand
3. **Don't Hide Live Support**: Make it easy to reach a human if needed
4. **Don't Forget to Update**: Keep menu options current (remove old extensions)
5. **Don't Overwhelm**: Fewer choices = better experience

---

## Example Configurations

### Example 1: Simple Service Business

**Root Menu**:
- Press 1: Schedule Appointment (Voice AI)
- Press 2: Speak with Team (Route to office)
- Press 3: Leave Message (Voicemail)

**Result**: 3 options, no submenus, clear actions.

---

### Example 2: Multi-Department Company

**Root Menu**:
- Press 1: Sales (Submenu)
  - Press 1: New Customers (Route to sales rep)
  - Press 2: Existing Customers (Voice AI)
  - Press 3: Pricing Questions (Webhook → CRM)
- Press 2: Support (Submenu)
  - Press 1: Technical Support (Route to tech team)
  - Press 2: Billing Support (Route to billing)
- Press 3: General Inquiries (Voicemail)

**Result**: 2 submenus, clear categorization.

---

## Troubleshooting

### Issue: "Menu depth exceeds maximum"

**Cause**: You've nested too many levels (beyond max_depth setting).

**Fix**: Reduce nesting or increase max_depth in Advanced Settings (not recommended beyond 5).

---

### Issue: "Digits must be unique within each level"

**Cause**: Two options at the same level have the same digit (e.g., both use "1").

**Fix**: Change one of the digits to a different number.

---

### Issue: Callers say they can't hear menu options

**Cause**: Greeting message too long or audio quality issue.

**Fix**:
- Shorten greeting to 20-30 seconds
- Speak slowly and clearly in greeting
- Test audio quality (use Twilio's voice options)

---

### Issue: Calls not routing correctly

**Cause**: Phone number format incorrect or action misconfigured.

**Fix**:
- Use E.164 format for phone numbers (e.g., +19781234567)
- Verify action type matches configuration
- Check Twilio webhook URL is correct

---

## Integrations

### Voice AI Integration

Route specific menu paths to AI assistant for intelligent conversations:

**Example**:
```
Press 1 for Sales
  Press 1 for New Customers (Action: Voice AI)
```

AI will use the selected "intent" to customize its responses.

### Webhook Integration

Trigger external systems when callers select specific options:

**Example**:
```
Press 2 for Callback Request (Action: Webhook → your-system.com/callback)
```

Your system receives caller information and can follow up automatically.

---

## FAQ

**Q: Can I change the voice used in IVR?**
A: Currently using Amazon Polly (Joanna voice). Contact support for customization.

**Q: Does IVR work 24/7?**
A: Yes, IVR is always active when enabled.

**Q: Can I have different IVR menus for business hours vs. after hours?**
A: Not currently. Consider using conditional routing in your Twilio configuration.

**Q: How much does multi-level IVR cost?**
A: Included in your Lead360 subscription. Twilio charges apply for call minutes.

**Q: Can I see analytics on which options callers select?**
A: Yes, view call logs at Communications → Twilio → Call Logs.

---

## Support

Need help? Contact Lead360 support:
- Email: support@lead360.app
- Documentation: https://docs.lead360.app

---

**End of User Guide**
```

---

### Task 4: Final Testing & Bug Fixes

**Testing Checklist**:

#### Functional Tests
- [ ] Create single-level IVR (backward compatibility)
- [ ] Create 2-level IVR with submenus
- [ ] Create 4-level IVR (max recommended)
- [ ] Try to create 6-level IVR (should fail validation)
- [ ] Edit existing multi-level config
- [ ] Delete IVR configuration
- [ ] Disable IVR (soft delete)
- [ ] Re-enable IVR

#### Validation Tests
- [ ] Duplicate digit at same level (should fail)
- [ ] Duplicate option ID (circular ref should fail)
- [ ] Submenu action without submenu config (should fail)
- [ ] Non-submenu action with submenu config (should fail)
- [ ] Total nodes > 100 (should fail)
- [ ] Max depth exceeded (should fail)
- [ ] Empty submenu options array (should fail)

#### UI Tests
- [ ] Form loads correctly with nested structure
- [ ] Accordions expand/collapse properly
- [ ] Level badges display correctly
- [ ] Digit selector filters used digits
- [ ] Action selector hides submenu at max depth
- [ ] Remove option works at all levels
- [ ] View page displays hierarchy with indentation
- [ ] Mobile responsive on all screens

#### Integration Tests
- [ ] API saves multi-level config
- [ ] API returns multi-level config correctly
- [ ] TwiML generated for root level
- [ ] TwiML generated for submenu (path=1)
- [ ] TwiML generated for deep submenu (path=1.2.3)
- [ ] Invalid path returns 404
- [ ] Twilio call navigates through menus
- [ ] Terminal actions execute at any level

#### Performance Tests
- [ ] Load time with 50 total nodes < 1s
- [ ] Load time with 100 total nodes < 2s
- [ ] Form submission with deep nesting < 3s
- [ ] View page render with complex tree < 1s

---

## Acceptance Criteria

- [ ] REST API documentation updated:
  - [ ] Multi-level IVR section added with examples
  - [ ] Action types table includes submenu
  - [ ] Data model shows recursive structure
  - [ ] Constraints documented (depth, nodes, etc.)
  - [ ] TwiML navigation explained with path notation
  - [ ] Validation errors documented
- [ ] Internal endpoints documented:
  - [ ] All 4 internal endpoints documented
  - [ ] Request/response schemas complete
  - [ ] Authentication explained (X-Voice-Agent-Key)
  - [ ] Security considerations listed
- [ ] User guide created:
  - [ ] Plain-language explanation of multi-level IVR
  - [ ] Step-by-step instructions with examples
  - [ ] Best practices section
  - [ ] Troubleshooting section
  - [ ] FAQ section
- [ ] All tests passing:
  - [ ] 100% of functional tests pass
  - [ ] 100% of validation tests pass
  - [ ] 100% of UI tests pass
  - [ ] 100% of integration tests pass
  - [ ] Performance benchmarks met
- [ ] Code quality:
  - [ ] No console errors or warnings
  - [ ] TypeScript types correct (no `any` unless necessary)
  - [ ] Comments added for complex logic
  - [ ] Console.logs removed from production code
  - [ ] Error handling comprehensive

---

## Database Credentials

**MySQL Connection**:
- Host: `127.0.0.1`
- Port: `3306`
- Database: `lead360`
- User: `lead360_user`
- Password: `978@F32c`

**Test Users**:
- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing (backend + frontend)
- [ ] Database migration applied
- [ ] Documentation reviewed and approved
- [ ] User guide published
- [ ] Release notes written
- [ ] Changelog updated
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Performance baseline established

---

## Post-Deployment

After deploying:

1. **Monitor Error Logs**: Watch for new errors related to IVR
2. **User Feedback**: Collect feedback from early adopters
3. **Twilio Webhook Logs**: Check Twilio dashboard for webhook failures
4. **Performance Metrics**: Track API response times
5. **Usage Analytics**: Monitor how many tenants use multi-level IVR

---

## Notes for Developer

1. **Documentation Quality**: Ensure examples are copy-paste ready and accurate.

2. **User Guide Tone**: Keep it conversational and non-technical. Target audience is small business owners, not developers.

3. **Internal Docs**: Internal endpoints are sensitive. Mark them clearly as "INTERNAL USE ONLY".

4. **Testing Time**: Don't rush final testing. Thorough QA prevents production issues.

5. **Known Limitations**: Document any features intentionally not implemented (e.g., voice customization, time-based routing).

---

## Success Metrics

**Technical Metrics**:
- Zero production errors in first week
- API response time < 200ms (p95)
- Test coverage > 85%

**User Metrics**:
- 20% of tenants adopt multi-level IVR within 1 month
- < 5% of configs hit validation errors
- Zero support tickets related to bugs

**Business Metrics**:
- Feature parity with enterprise IVR systems
- Positive user feedback (> 4.5/5 rating)
- Reduced churn (better call handling = happier customers)

---

**End of Sprint IVR-5**

🎉 **Congratulations!** You've completed the Multi-Level IVR feature implementation!
