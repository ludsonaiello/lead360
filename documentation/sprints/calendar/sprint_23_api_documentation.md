# Sprint 23: api_documentation

**Sprint**: Backend Phase 5 - Sprint 23 of 42
**Module**: Calendar & Scheduling
**Estimated Duration**: 6-8 hours
**Prerequisites**: Sprints 1-22 complete (all features implemented)

---

## 🎯 Sprint Goal

Write complete API documentation with 100% endpoint coverage

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

Document all 45+ endpoints, request/response examples, authentication, RBAC, errors

---

## 📐 Critical Files to Review

Before starting, review these existing files:
- quotes_REST_API.md (gold standard)\n- API conventions

---

## 🛠️ Implementation Steps

See the detailed implementation plan at:
`/root/.claude/plans/curried-petting-bachman.md` - Sprint 23 section

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

Documentation review

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

**Implementation Plan**: `/root/.claude/plans/curried-petting-bachman.md` - Sprint 23

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

**Next Sprint**: Sprint 24


---

## 📝 Additional Documentation Required

### Google Calendar Platform Setup Guide

**File**: Create `/var/www/lead360.app/api/documentation/google_calendar_platform_setup.md`

**Purpose**: Guide for system administrators to configure Google Cloud project and OAuth credentials

**Content Structure**:
```markdown
# Google Calendar Integration - Platform Setup Guide

## Prerequisites
- Access to Google Cloud Console
- System admin privileges in Lead360

## Setup Steps

### 1. Create Google Cloud Project
- Go to https://console.cloud.google.com
- Click "Select a project" → "New Project"
- Project name: "Lead360 Calendar Integration"
- Click "Create"

### 2. Enable Google Calendar API
- Navigate to APIs & Services → Library
- Search for "Google Calendar API"
- Click on "Google Calendar API"
- Click "Enable"

### 3. Configure OAuth Consent Screen
- Go to APIs & Services → OAuth consent screen
- User Type: External (for multi-tenant SaaS)
- Click "Create"
- Fill in:
  - App name: "Lead360"
  - User support email: [your email]
  - App logo: [optional]
  - Developer contact: [your email]
- Scopes: Add the following scopes
  - https://www.googleapis.com/auth/calendar.readonly (Read calendar events)
  - https://www.googleapis.com/auth/calendar.events (Create/edit/delete events)
- Click "Save and Continue"
- Test users: Add your tenant email for testing

### 4. Create OAuth 2.0 Credentials
- Go to APIs & Services → Credentials
- Click "Create Credentials" → "OAuth client ID"
- Application type: Web application
- Name: "Lead360 Calendar OAuth Client"
- Authorized JavaScript origins:
  - https://api.lead360.app
  - https://app.lead360.app
- Authorized redirect URIs:
  - https://api.lead360.app/api/v1/calendar/integration/google/callback
- Click "Create"
- Copy Client ID and Client Secret

### 5. Store Credentials in Platform Environment

Add to backend `.env` file:
```env
GOOGLE_CALENDAR_CLIENT_ID=your_client_id_here
GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret_here
GOOGLE_CALENDAR_REDIRECT_URI=https://api.lead360.app/api/v1/calendar/integration/google/callback
```

Restart backend server:
```bash
npm run start:dev
```

### 6. Verify Configuration

Test the OAuth flow:
```bash
# Get auth URL
curl http://localhost:8000/api/v1/calendar/integration/google/auth-url \
  -H "Authorization: Bearer $TOKEN"

# Should return a Google OAuth URL starting with:
# https://accounts.google.com/o/oauth2/v2/auth...
```

### 7. Webhook Configuration (Optional - for push notifications)

- Verify domain ownership in Google Search Console (required for webhooks)
- Ensure your backend is publicly accessible via HTTPS
- Webhooks will be auto-configured when tenants connect their calendars

## Troubleshooting

### "redirect_uri_mismatch" error
- Verify redirect URI in Google Cloud Console exactly matches: https://api.lead360.app/api/v1/calendar/integration/google/callback
- Check for trailing slashes (should NOT have one)

### "Access blocked: Lead360 has not completed verification"
- During development: Add tenant email to "Test users" in OAuth consent screen
- For production: Submit app for verification

### Webhook 404 errors
- Verify domain ownership in Google Search Console
- Ensure /api/webhooks/google-calendar endpoint is publicly accessible
- Check firewall/nginx configuration
```

**This documentation is REQUIRED before Sprint 11 (Google OAuth) can be completed in production.**

---
