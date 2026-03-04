# Sprint 19: voice_ai_reschedule_cancel

**Sprint**: Backend Phase 3 - Sprint 19 of 42
**Module**: Calendar & Scheduling
**Estimated Duration**: 5-6 hours
**Prerequisites**: Sprint 18 complete

---

## 🎯 Sprint Goal

Implement Voice AI reschedule and cancel tools with identity verification

---

## 👨‍💻 Sprint Owner Role

You are a **masterclass backend developer** that makes Google, Amazon, and Apple engineers jealous. You build **masterclass code** with thoughtful architecture, never rushing, always breathing and thinking through each decision. You:

- ✅ **Never guess** names, properties, modules, or paths
- ✅ **Always review** existing codebase patterns before writing new code
- ✅ **Always verify** tenant isolation (`tenant_id` filtering) in every query
- ✅ **Always enforce** RBAC (role-based access control)
- ✅ **Always write** unit and integration tests
- ✅ **Review your work** multiple times before considering it complete
- ✅ **Deliver 100% quality** or beyond specification

---

## 📋 Requirements

reschedule_appointment tool, cancel_appointment tool, identity verification

---

## 📐 Critical Files to Review

Before starting, review these existing files:
- Voice AI tools\n- Phone verification

---

## 🛠️ Implementation Steps

See the detailed implementation plan at:
`/root/.claude/plans/curried-petting-bachman.md` - Sprint 19 section

### Quick Reference

1. Review existing codebase patterns
2. Follow multi-tenant isolation rules (always filter by `tenant_id`)
3. Implement RBAC for all endpoints (Owner, Admin, Estimator roles)
4. Write unit tests (>80% coverage for business logic)
5. Write integration tests (all endpoints)
6. Update inline documentation and Swagger decorators
7. Verify all tests passing
8. Review code for security vulnerabilities

---

## ✅ Definition of Done

- [ ] Code follows existing patterns
- [ ] Multi-tenant isolation verified (`tenant_id` in all queries)
- [ ] RBAC enforced (correct roles for each endpoint)
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests for all endpoints
- [ ] Swagger documentation complete
- [ ] No console errors or warnings
- [ ] All tests passing
- [ ] Code reviewed for security issues
- [ ] Inline documentation for complex logic

---

## 🧪 Testing & Verification

Voice AI tool tests

### Database Connection

```env
DATABASE_URL="mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360"
```

### Test Users

**System Admin**:
- Email: `ludsonaiello@gmail.com`
- Password: `978@F32c`

**Tenant User**:
- Email: `contact@honeydo4you.com`
- Password: `978@F32c`

### Development Server

**Run with**: `npm run start:dev` (NOT PM2)
- Backend API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/api/docs`

---

## 📚 References

**Contract**: `/var/www/lead360.app/documentation/contracts/calendar-contract.md`

**Implementation Plan**: `/root/.claude/plans/curried-petting-bachman.md` - Sprint 19

**Existing Patterns**:
- `/var/www/lead360.app/api/src/modules/leads/` - Multi-tenant patterns
- `/var/www/lead360.app/api/src/modules/communication/` - Complex module example
- `/var/www/lead360.app/api/prisma/schema.prisma` - Data model

---

## 🎯 Success Criteria

When this sprint is complete, you should be able to demonstrate:
1. ✅ All sprint requirements met
2. ✅ All tests passing (unit + integration)
3. ✅ Multi-tenant isolation verified
4. ✅ RBAC enforced correctly
5. ✅ No runtime errors or warnings
6. ✅ Ready for next sprint

---

**Next Sprint**: Sprint 20


---

## 📝 Voice AI Tool Documentation Update

### Requirement

**File**: Update `/var/www/lead360.app/api/documentation/voice_ai_REST_API.md`

**Purpose**: Document the new reschedule_appointment and cancel_appointment tools for Voice AI integration

**Content to Add**:

Add the following sections to the Voice AI tool documentation:

```markdown
### Tool: reschedule_appointment

**Purpose**: Allows Voice AI to reschedule an existing appointment with identity verification

**Tool Definition**:
```json
{
  "name": "reschedule_appointment",
  "description": "Reschedules an existing appointment to a new date/time. Verifies caller identity before allowing reschedule.",
  "parameters": {
    "call_log_id": {
      "type": "string",
      "required": true,
      "description": "The UUID of the current call log"
    },
    "lead_id": {
      "type": "string",
      "required": true,
      "description": "The UUID of the lead requesting reschedule"
    },
    "new_date": {
      "type": "string",
      "required": false,
      "description": "Preferred new date in YYYY-MM-DD format (optional - if not provided, tool returns next available slots)"
    }
  }
}
```

**Endpoint**: POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/reschedule_appointment

**Identity Verification**: Caller phone number (from call_log) must match lead's phone number

**Response - Verification Failed**:
```json
{
  "status": "verification_failed",
  "message": "Phone number does not match our records.",
  "action": "Voice AI should ask for name + appointment date for manual verification"
}
```

**Response - No Active Appointment**:
```json
{
  "status": "no_appointment_found",
  "message": "No active appointments found for this lead.",
  "action": "Voice AI should offer to book a new appointment"
}
```

**Response - Multiple Active Appointments**:
```json
{
  "status": "multiple_appointments",
  "appointments": [
    {
      "id": "uuid",
      "date": "2026-03-10",
      "time": "09:00",
      "type": "Quote Visit"
    },
    {
      "id": "uuid",
      "date": "2026-03-15",
      "time": "14:00",
      "type": "Follow-up Visit"
    }
  ],
  "message": "You have multiple appointments. Which one would you like to reschedule?",
  "action": "Voice AI should read appointments and ask caller to choose one"
}
```

**Response - Available Slots**:
```json
{
  "status": "slots_available",
  "current_appointment": {
    "id": "uuid",
    "date": "2026-03-10",
    "time": "09:00"
  },
  "available_slots": [
    {
      "date": "2026-03-12",
      "day_name": "Thursday",
      "slots": [
        { "start_time": "09:00", "end_time": "10:30" },
        { "start_time": "10:30", "end_time": "12:00" }
      ]
    }
  ],
  "message": "Your current appointment is March 10 at 9 AM. Next available times are Thursday March 12...",
  "action": "Voice AI should present slots conversationally and ask caller to choose"
}
```

**Confirming Reschedule** (caller selects slot):
Voice AI calls the same endpoint again with full parameters:
```json
{
  "call_log_id": "uuid",
  "lead_id": "uuid",
  "appointment_id": "uuid",
  "new_date": "2026-03-12",
  "new_time": "10:30"
}
```

**Response - Rescheduled Successfully**:
```json
{
  "status": "rescheduled",
  "new_appointment_id": "uuid",
  "old_appointment_id": "uuid",
  "message": "Your appointment has been rescheduled to March 12 at 10:30 AM",
  "confirmation_sent": true
}
```

---

### Tool: cancel_appointment

**Purpose**: Allows Voice AI to cancel an existing appointment with identity verification

**Tool Definition**:
```json
{
  "name": "cancel_appointment",
  "description": "Cancels an existing appointment. Verifies caller identity before allowing cancellation.",
  "parameters": {
    "call_log_id": {
      "type": "string",
      "required": true,
      "description": "The UUID of the current call log"
    },
    "lead_id": {
      "type": "string",
      "required": true,
      "description": "The UUID of the lead requesting cancellation"
    },
    "reason": {
      "type": "string",
      "required": false,
      "description": "Reason for cancellation (optional - Voice AI can ask)"
    }
  }
}
```

**Endpoint**: POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/cancel_appointment

**Identity Verification**: Same as reschedule_appointment

**Response - Verification Failed**: (same as reschedule)

**Response - No Active Appointment**: (same as reschedule)

**Response - Multiple Active Appointments**: (same as reschedule)

**Response - Cancelled Successfully**:
```json
{
  "status": "cancelled",
  "appointment_id": "uuid",
  "appointment_date": "2026-03-10",
  "appointment_time": "09:00",
  "cancellation_reason": "customer_cancelled",
  "message": "Your appointment on March 10 at 9 AM has been cancelled.",
  "confirmation_sent": true
}
```

---

### Voice AI Conversation Flow Examples

**Example 1: Successful Reschedule**

Caller: "I need to reschedule my appointment"
AI: [Calls reschedule_appointment with call_log_id and lead_id]
AI: [Receives slots_available response]
AI: "Your current appointment is Thursday, March 10 at 9 AM. I have availability on March 12 at 9 AM, 10:30 AM, or March 15 at 2 PM. Which works best for you?"
Caller: "March 12 at 10:30"
AI: [Confirms reschedule with appointment_id, new_date, new_time]
AI: [Receives rescheduled response]
AI: "Perfect! I've rescheduled your appointment to Thursday, March 12 at 10:30 AM. You'll receive a confirmation text message shortly."

**Example 2: Identity Verification Failure**

Caller: "I want to cancel my appointment"
AI: [Calls cancel_appointment with call_log_id and lead_id]
AI: [Receives verification_failed response]
AI: "I need to verify your identity. Can you please provide your full name and the date of your appointment?"
Caller: "John Smith, March 10"
AI: [Manual verification by staff or secondary check]

**Example 3: No Active Appointment**

Caller: "I'd like to reschedule"
AI: [Calls reschedule_appointment]
AI: [Receives no_appointment_found response]
AI: "I don't see any upcoming appointments for you. Would you like to schedule a new appointment?"
```

---

**This documentation update is REQUIRED to complete Sprint 19.**

---
