# Sprint 9 — Invite Email Template + Flow Verification
**Module:** users
**File:** ./documentation/sprints/users/sprint_9.md
**Type:** Backend — Email Template Setup
**Depends On:** Sprint 7 (UsersService dispatches the email via JobQueueService.queueEmail())
**Gate:** STOP — Invite email must be processed by the existing SendEmailProcessor and delivered (or logged if SMTP is not configured). Verify via job queue logs before Sprint 10.
**Estimated Complexity:** Low

---

## Objective

Create the `user-invite` email template in the database so the invite email flow works end-to-end. Sprint 6's `UsersService.inviteUser()` calls `jobQueueService.queueEmail({ templateKey: 'user-invite', ... })`. The existing email pipeline (`JobQueueService` → `'email'` queue → `SendEmailProcessor` → `EmailService.sendTemplatedEmail()` → `SmtpService`) handles delivery. This sprint creates the template record that `EmailService` looks up by key.

No custom processor is needed. The platform's existing email infrastructure handles everything.

---

## Pre-Sprint Checklist
- [ ] Sprint 7 gate verified (invite endpoint creates membership, dispatches email job)
- [ ] Read `src/modules/jobs/services/email.service.ts` — understand how `sendTemplatedEmail()` renders templates
- [ ] Read `src/modules/jobs/services/email-template.service.ts` — understand how templates are fetched by key
- [ ] Read `src/modules/jobs/processors/send-email.processor.ts` — confirm it processes `'send-email'` jobs from the `'email'` queue
- [ ] Check the `email_template` table schema: `mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -e "DESCRIBE email_template;"`
- [ ] Check existing templates: `mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -e "SELECT id, \`key\`, subject FROM email_template;"`
- [ ] Understand the template variable syntax used by `EmailTemplateService` (e.g., `{{variable}}`, `{variable}`, or Handlebars-style `{{variable}}`)
- [ ] Check `.env` for SMTP config: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- [ ] Confirm the `FRONTEND_URL` env variable exists

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   ← must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   ← must return nothing
```

---

## Tasks

### Task 1 — Understand the Email Template System

**What:** Before creating the template, read how existing templates work:

1. Read `src/modules/jobs/services/email-template.service.ts` FULLY — identify:
   - How templates are fetched (by `key` field? by `id`?)
   - What variable syntax is used (e.g., `{{variable_name}}` or `{variable_name}`)
   - Whether templates are stored in the DB (`email_template` table) or as files

2. Inspect the `email_template` table:
   ```bash
   mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 \
     -e "DESCRIBE email_template;"
   ```

3. Read an existing template record to understand the structure:
   ```bash
   mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 \
     -e "SELECT \`key\`, subject, html_body FROM email_template LIMIT 1\G"
   ```

Record the exact column names, variable syntax, and any required fields.

---

### Task 2 — Create the user-invite Email Template

**What:** Insert the `user-invite` template into the `email_template` table. The variable names must match exactly what Sprint 6's `UsersService.inviteUser()` passes in the `variables` object:

Variables passed by `inviteUser()`:
- `first_name` — invitee's first name
- `last_name` — invitee's last name
- `invite_link` — full URL: `{FRONTEND_URL}/invite/{raw_token}`
- `tenant_name` — company name of the inviting tenant
- `inviter_name` — full name of the person who sent the invite
- `role_name` — role being assigned (e.g., "Employee", "Admin")
- `expires_at` — human-readable expiry date string

**Adapt the variable syntax to match** what you found in Task 1. The examples below use `{{variable}}` syntax — update if the codebase uses a different pattern.

```sql
INSERT INTO email_template (
  id, `key`, name, subject, html_body, text_body,
  description, is_system, is_active, created_at, updated_at
) VALUES (
  UUID(),
  'user-invite',
  'User Invitation',
  'You''ve been invited to join {{tenant_name}} on Lead360',
  '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 32px;">
    <h2 style="color: #1a1a1a; margin-top: 0;">You''re Invited!</h2>
    <p style="color: #333; font-size: 16px;">
      Hello {{first_name}} {{last_name}},
    </p>
    <p style="color: #333; font-size: 16px;">
      {{inviter_name}} has invited you to join <strong>{{tenant_name}}</strong> as a <strong>{{role_name}}</strong> on Lead360.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{invite_link}}"
         style="background: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 6px;
                text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block;">
        Accept Invitation
      </a>
    </div>
    <p style="color: #666; font-size: 14px;">
      This invitation link expires on <strong>{{expires_at}}</strong>.
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="color: #999; font-size: 12px;">
      If the button above doesn''t work, copy and paste this link into your browser:<br>
      <a href="{{invite_link}}" style="color: #2563eb;">{{invite_link}}</a>
    </p>
    <p style="color: #999; font-size: 12px;">
      If you did not expect this invitation, you can safely ignore this email.
    </p>
  </div>
</body>
</html>',
  'Hello {{first_name}} {{last_name}},

{{inviter_name}} has invited you to join {{tenant_name}} as a {{role_name}} on Lead360.

Accept your invitation: {{invite_link}}

This link expires on {{expires_at}}.

If you did not expect this invitation, you can safely ignore this email.',
  'Sent when an Owner or Admin invites a new user to the tenant',
  true,
  true,
  NOW(),
  NOW()
);
```

**Run via:**
```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 < /tmp/user-invite-template.sql
```

Or inline (save the SQL to a temp file first for readability, then execute).

**Verify template was created:**
```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 \
  -e "SELECT id, \`key\`, subject, is_active FROM email_template WHERE \`key\` = 'user-invite';"
```

Must return exactly one row with `is_active = 1`.

**Adapt the SQL:** If the `email_template` table has different column names (e.g., `template_key` instead of `key`), adapt the INSERT accordingly. Use the schema from Task 1.

---

### Task 3 — Test the Invite Email Flow End-to-End

**What:** With the dev server running:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r .access_token)

ROLE_ID=$(mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -s -N \
  -e "SELECT id FROM role WHERE name='Employee' LIMIT 1;")

curl -s -X POST http://localhost:8000/api/v1/users/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"sprinttest$(date +%s)@example.com\",
    \"first_name\": \"Sprint\",
    \"last_name\": \"Test\",
    \"role_id\": \"${ROLE_ID}\"
  }" | jq .
```

**Verify the flow worked — check all three stages:**

1. **Membership created:**
   ```bash
   mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 \
     -e "SELECT id, status, invite_token_expires_at FROM user_tenant_membership ORDER BY created_at DESC LIMIT 3;"
   ```
   Must show a row with `status = 'INVITED'`.

2. **Job was queued and processed:**
   ```bash
   # Check dev server logs for SendEmailProcessor output:
   # "🔄 PROCESSING: Email job {jobId} to sprinttest...@example.com"
   #
   # Or check the email_queue table:
   mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 \
     -e "SELECT id, template_key, to_email, status FROM email_queue ORDER BY created_at DESC LIMIT 3;"
   ```
   Must show a row with `template_key = 'user-invite'`.

3. **Email sent (if SMTP is configured):**
   Check the inbox of the test email address. If SMTP is not configured locally, verify the job completed without errors in the logs — this is acceptable for dev.

**Note:** If SMTP is not configured, the SendEmailProcessor will throw an error and BullMQ will retry (3 attempts). This is expected behavior — the job infrastructure is working correctly. The email will be sent once SMTP is configured in production.

---

### Task 4 — Verify Template Rendering

**What:** Check that the template variables were rendered correctly by inspecting the `email_queue` record:

```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 \
  -e "SELECT subject, LEFT(html_body, 500) AS html_preview FROM email_queue WHERE template_key = 'user-invite' ORDER BY created_at DESC LIMIT 1\G"
```

**Expected:**
- `subject` should contain the actual tenant name (not `{{tenant_name}}`)
- `html_body` should contain the actual invite link (not `{{invite_link}}`)
- All `{{variable}}` placeholders should be replaced with real values

If placeholders are NOT replaced, the variable syntax in the template doesn't match what `EmailTemplateService` expects. Go back to Task 1, verify the syntax, and update the template.

---

## Email Content Requirements

Per the contract (§12), the invite email must include:
- ✅ Invite link: `{FRONTEND_URL}/invite/{raw_token}` — passed as `invite_link` variable
- ✅ Tenant name — passed as `tenant_name` variable (resolved in Sprint 6 `inviteUser()`)
- ✅ Inviter name — passed as `inviter_name` variable (resolved in Sprint 6 `inviteUser()`)
- ✅ Role name — passed as `role_name` variable
- ✅ Expiry note — passed as `expires_at` variable (human-readable formatted string)

All five content requirements are satisfied because Sprint 6 resolves tenant/inviter names before dispatching and passes all values as template variables.

---

## Patterns to Apply

### Email Template Pipeline (This Codebase)
```
UsersService.inviteUser()
  → jobQueueService.queueEmail({ to, templateKey: 'user-invite', variables })
    → Creates a 'send-email' job on the 'email' BullMQ queue
      → SendEmailProcessor.process(job) picks it up
        → emailService.sendTemplatedEmail({ to, templateKey, variables })
          → emailTemplateService.getTemplate('user-invite')  // fetches from DB
          → emailTemplateService.renderTemplate(template, variables)  // replaces {{vars}}
          → smtpService.sendEmail({ to, subject, html, text })  // delivers via SMTP
```

No custom processor needed. The existing pipeline handles everything.

### Email Template Table
```sql
-- email_template table stores templates by 'key'
-- Variables use the syntax discovered in Task 1 (likely {{variable_name}})
-- is_system = true: template cannot be deleted by tenants
-- is_active = true: template is available for use
```

---

## Business Rules Enforced in This Sprint
- **BR-05 (email delivery):** Contract states invite must include invite link, tenant name, inviter name, role name, expiry note — all provided via template variables
- **Email template:** `user-invite` — matches the contract's specified template name

---

## Integration Points
| What | Notes |
|---|---|
| `UsersService.inviteUser()` | Dispatches via `jobQueueService.queueEmail()` — Sprint 6 |
| `email_template` table | Template record with `key = 'user-invite'` — created in this sprint |
| `SendEmailProcessor` | Existing processor on `'email'` queue — no modification needed |
| `EmailService.sendTemplatedEmail()` | Renders template + sends — no modification needed |
| `FRONTEND_URL` env var | Used in Sprint 6 to construct the invite link before dispatching |

---

## Acceptance Criteria
- [ ] `email_template` table contains a row with `key = 'user-invite'` and `is_active = true`
- [ ] `POST /api/v1/users/invite` returns 201 AND a `'send-email'` job appears in the `'email'` queue (verify in logs or `email_queue` table)
- [ ] Template variables are rendered correctly (no `{{variable}}` placeholders in the sent email)
- [ ] If SMTP is configured: invite email is received at the target address with the correct invite link, tenant name, inviter name, role name, and expiry note
- [ ] If SMTP is not configured: job is processed (may fail on SMTP) without crashing the server
- [ ] Invite link format in the email: `{FRONTEND_URL}/invite/{64-char-hex-token}`
- [ ] Dev server compiles with zero TypeScript errors
- [ ] No code files modified in this sprint (template only)
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 10 until:
1. Email template exists in DB (verified by SELECT query)
2. Invite endpoint triggers email job (verified in logs or `email_queue` table)
3. Template rendering works (no raw `{{variable}}` in output)

---

## Handoff Notes
- The `raw_token` is generated by `randomBytes(32).toString('hex')` — 64 characters. The invite link is `{FRONTEND_URL}/invite/{raw_token}`
- Sprint 10 (Unit Tests) will mock `JobQueueService` to avoid email dispatching in tests
- The invite email job failure should NOT block the invite creation — if the job fails after creation, the admin can resend by re-inviting (per contract: "Resend invite endpoint available; job failure logged")
- No custom BullMQ processor was created — the existing `SendEmailProcessor` handles `'send-email'` jobs generically using the template system
