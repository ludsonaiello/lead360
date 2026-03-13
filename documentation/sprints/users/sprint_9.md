# Sprint 9 — Invite Email Job
**Module:** users
**File:** ./documentation/sprints/users/sprint_9.md
**Type:** Backend — Background Job
**Depends On:** Sprint 7 (UsersService dispatches the job via jobsService)
**Gate:** STOP — Invite email job must be processed by the queue worker and email must be sent. Verify via job queue logs before Sprint 10.
**Estimated Complexity:** Medium

---

## Objective

Implement the BullMQ job handler for the `user-invite` job that is dispatched by `UsersService.inviteUser()`. When a user is invited, the system queues a job with the invite details. This sprint creates the job processor that picks up that job and sends the invite email using the platform's existing email infrastructure.

---

## Pre-Sprint Checklist
- [ ] Sprint 7 gate verified (invite endpoint creates membership, dispatches job)
- [ ] Read `src/modules/jobs/jobs.service.ts` — understand how to dispatch and register jobs
- [ ] Read `src/modules/jobs/jobs.module.ts` — know the module structure
- [ ] Check if a `user-invite` job name already exists: `grep -rn "user-invite\|userInvite\|invite" /var/www/lead360.app/api/src/modules/jobs/ --include="*.ts"`
- [ ] Read an existing job processor in the codebase to understand the pattern (e.g., `src/modules/audit/jobs/audit-log-write.job.ts`)
- [ ] Understand the email sending pattern — check `src/modules/communication/` or `src/modules/jobs/` for how emails are sent (look for `EmailService`, `MailService`, or a nodemailer/SES call)
- [ ] Check `.env` for SMTP config: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- [ ] Check existing email templates — look for `templates/` directory or `handlebars` template files
- [ ] Confirm the FRONTEND_URL env variable: this is the base URL for the invite link (e.g., `https://app.lead360.app`)

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

### Task 1 — Understand the Existing Job Infrastructure

**What:** Before writing any code:

1. Read `src/modules/jobs/jobs.service.ts` completely. Identify:
   - The method signature for dispatching a job (is it `addJob(name, data)`, `dispatch(name, data)`, `add(name, data)`, or `queue.add(name, data)`)
   - How the BullMQ queue is configured (queue name)

2. List all existing job processors: `ls /var/www/lead360.app/api/src/modules/jobs/processors/ 2>/dev/null || ls /var/www/lead360.app/api/src/modules/jobs/ | grep -i job`

3. Read one existing processor to understand the `@Processor` and `@Process` decorator pattern (or `@OnWorkerEvent` if using BullMQ workers)

4. Understand the email-sending mechanism:
   ```bash
   grep -rn "sendMail\|transporter\|nodemailer\|MailService\|EmailService\|email_queue" \
     /var/www/lead360.app/api/src/modules/ --include="*.ts" -l
   ```

After this audit, implement the job using the same pattern as the existing jobs.

---

### Task 2 — Create the User Invite Job Processor

**What:** Based on the patterns found in Task 1, create the job processor. The job name is `'user-invite'` (this must match exactly what `UsersService.inviteUser()` dispatches).

The job payload shape (dispatched from Sprint 6, `inviteUser()`):
```typescript
interface UserInviteJobPayload {
  email: string;
  first_name: string;
  last_name: string;
  raw_token: string;        // The raw token — embed in the invite link
  tenant_id: string;
  invited_by_user_id: string;
  role_name: string;
  expires_at: string;       // ISO datetime string
}
```

Create the processor file at `src/modules/jobs/processors/user-invite.job.ts` (or follow the existing naming convention):

```typescript
// Pattern based on existing job processors in the codebase
// Use @Processor('queue-name') and @Process('user-invite') decorators
// OR BullMQ Worker pattern — match the existing codebase pattern exactly

import { Process, Processor } from '@nestjs/bull'; // or @nestjs/bullmq
import { Job } from 'bull'; // or 'bullmq'
import { ConfigService } from '@nestjs/config';
// Import the email service or use nodemailer directly — match existing pattern

@Processor('jobs') // Use the same queue name as existing processors
export class UserInviteJob {
  constructor(private readonly configService: ConfigService) {}

  @Process('user-invite')
  async handle(job: Job<UserInviteJobPayload>): Promise<void> {
    const { email, first_name, last_name, raw_token, role_name, expires_at } = job.data;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'https://app.lead360.app';
    const inviteLink = `${frontendUrl}/invite/${raw_token}`;
    const expiryFormatted = new Date(expires_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Use the existing email sending pattern from the codebase
    // (Replace this block with the actual email service call found in Task 1)
    await this.sendInviteEmail({
      to: email,
      subject: `You've been invited to join Lead360`,
      inviteLink,
      firstName: first_name,
      lastName: last_name,
      roleName: role_name,
      expiryFormatted,
    });
  }

  private async sendInviteEmail(params: {
    to: string;
    subject: string;
    inviteLink: string;
    firstName: string;
    lastName: string;
    roleName: string;
    expiryFormatted: string;
  }): Promise<void> {
    // Implement using the email infrastructure discovered in Task 1
    // The email HTML content must include:
    // - Greeting: "Hello {first_name} {last_name}"
    // - Body: "You've been invited to join as {role_name} on Lead360."
    // - CTA button: "Accept Invitation" → {inviteLink}
    // - Expiry note: "This link expires on {expiryFormatted}."
    // - Plain text fallback with the raw link
  }
}
```

**If the email infrastructure uses a different pattern** (e.g., an `EmailQueueService`, an existing `email_queue` table in the DB, or a direct SMTP call), use that instead. The important thing is that the email is delivered.

---

### Task 3 — Reconcile the jobsService.dispatch() Call in UsersService

**What:** In Sprint 6, `usersService.inviteUser()` calls:
```typescript
await this.jobsService.dispatch('user-invite', { ... });
```

Now that you've read `jobs.service.ts`, verify the method signature is correct. If the method is named differently (e.g., `add()`, `addJob()`, `queue.add()`), update the call in `usersService.inviteUser()` to match.

Also verify the queue name matches. If BullMQ queues are identified by name (e.g., `'jobs'`, `'email'`, `'notifications'`), use the correct queue name in both the job processor `@Processor` decorator and the dispatch call.

---

### Task 4 — Register the Job Processor

**What:** Register `UserInviteJob` in the Jobs module. Open `src/modules/jobs/jobs.module.ts`.

Following the existing pattern for registering job processors, add `UserInviteJob` to the `providers` array:
```typescript
providers: [
  // ... existing providers
  UserInviteJob,
],
```

If the module uses `BullModule.registerQueue()` or similar, verify the queue configuration includes the `'jobs'` queue (or whatever queue name the processor uses).

---

### Task 5 — Test the Invite Email Flow End-to-End

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

**Verify job was enqueued:**
- Watch the dev server logs — look for the BullMQ job being processed
- Or check Redis: `redis-cli keys "bull:*" | grep invite`

**Verify membership was created with INVITED status:**
```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 \
  -e "SELECT id, status, invite_token_expires_at FROM user_tenant_membership ORDER BY created_at DESC LIMIT 3;"
```

**Verify invite link works:**
```bash
# Get the raw token from the membership (for testing — in production it's only in the email)
INVITE_ID=$(mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -s -N \
  -e "SELECT id FROM user_tenant_membership WHERE status='INVITED' ORDER BY created_at DESC LIMIT 1;")

# The raw token is sent via email and NOT stored in the DB (only the hash is stored)
# To test: trigger the invite, capture the raw_token from job logs (if logged at DEBUG level)
# OR: in dev only, temporarily log the raw_token in the job processor
```

**Note:** If SMTP is not configured in the local environment, the email will fail silently. This is acceptable — verify the job was processed in BullMQ logs. The email content correctness can be verified by logging the HTML in dev mode.

---

## Email Content Requirements

Per the contract, the invite email must include:
- Invite link: `https://app.lead360.app/invite/{raw_token}` (use `FRONTEND_URL` env var)
- Tenant name (load from DB in the job processor using `tenant_id`)
- Inviter name (load from DB using `invited_by_user_id`)
- Role name (from `role_name` in the job payload)
- Expiry note: link expires 72 hours after creation (from `expires_at` field)

**Update the job payload to load tenant name and inviter name:**

In the job processor `handle()` method, load these from the database:
```typescript
const tenant = await this.prisma.tenant.findUnique({
  where: { id: job.data.tenant_id },
  select: { company_name: true },
});

const inviter = await this.prisma.user.findUnique({
  where: { id: job.data.invited_by_user_id },
  select: { first_name: true, last_name: true },
});

const tenantName = tenant?.company_name ?? 'Lead360';
const inviterName = inviter
  ? `${inviter.first_name} ${inviter.last_name}`
  : 'Your administrator';
```

---

## Patterns to Apply

### BullMQ Job Pattern (NestJS Bull)
```typescript
// Using @nestjs/bull (check package.json for bull vs bullmq):
@Processor('queue-name')
export class MyJobProcessor {
  @Process('job-name')
  async handle(job: Job<JobDataType>): Promise<void> {
    // job.data contains the payload
    // Throw to trigger retry; return void for success
  }
}
```

### Job Retry Configuration
If the job processor fails, BullMQ/Bull will retry based on the queue configuration. Do NOT wrap the processor body in a try/catch that swallows errors — let errors propagate so the queue retries. Only catch errors that are unrecoverable (like invalid job data) to avoid infinite retries.

---

## Business Rules Enforced in This Sprint
- **BR-05 (email delivery):** Contract states invite must include invite link, tenant name, inviter name, role name, expiry note
- **Email template:** `user-invite` — matches the contract's specified template name

---

## Integration Points
| What | Notes |
|---|---|
| `UsersService.inviteUser()` | Dispatches the job — must use correct method and queue name |
| `JobsModule` | Register `UserInviteJob` in providers |
| `PrismaService` | Load tenant name and inviter name in job processor |
| Email infrastructure | Use existing pattern from codebase (nodemailer/SES/queue) |
| `FRONTEND_URL` env var | Base URL for invite link |

---

## Acceptance Criteria
- [ ] `POST /api/v1/users/invite` returns 201 AND the job appears in the BullMQ queue (verify in logs or Redis)
- [ ] Job processor handles the `user-invite` job without throwing errors
- [ ] If SMTP is configured: invite email is received at the target address with the correct invite link
- [ ] If SMTP is not configured: job completes without crashing the server (graceful error handling)
- [ ] Invite link format: `{FRONTEND_URL}/invite/{raw_token}` — raw_token is 64-char hex string
- [ ] Dev server compiles with zero TypeScript errors
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 10 until:
1. Invite endpoint triggers job queue (verified in logs)
2. Job processor is registered and handles the job (no unhandled errors in logs)
3. TypeScript compiles clean

---

## Handoff Notes
- The `raw_token` is generated by `randomBytes(32).toString('hex')` — 64 characters. The invite link is `{FRONTEND_URL}/invite/{raw_token}`
- Sprint 10 (Unit Tests) will mock the `JobsService` to avoid job dispatching in tests
- The invite email job failure should NOT block the invite creation — if the job fails after creation, the admin can resend by re-inviting (per contract: "Resend invite endpoint available; job failure logged")
