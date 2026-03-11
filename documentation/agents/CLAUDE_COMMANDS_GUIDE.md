# CLAUDE_COMMANDS_GUIDE.md
## Lead360 — Agent Slash Command Reference

**Location**: `/var/www/lead360.app/.claude/commands/`  
**Usage**: Open Claude Code in `/var/www/lead360.app/` and type the slash command below.

---

## Available Commands

| Command | Agent | When to Use |
|---------|-------|-------------|
| `/project:pm-sprint-planner` | Sprint Planner | Once — before development starts, to generate all sprint files |
| `/project:backend-developer` | Backend Developer | Each backend sprint |
| `/project:code-review` | Code Review & Compliance | After each backend sprint completes |
| `/project:documentation` | Documentation Agent | After each sprint passes code review |
| `/project:frontend-developer` | Frontend Developer | After documentation for a module is verified |
| `/project:integration-test` | Integration Test | After each sprint (backend or frontend) |

---

## The Development Cycle — Step by Step

### STEP 0 — Generate Sprint Files (Run Once)

```
/project:pm-sprint-planner
```

Input to give:
```
Read all contracts and the integration handoff table. Generate all sprint files for the 
Project Management Module and Financial Module (Project-Scoped). Output sprint files to 
/var/www/lead360.app/documentation/sprints/ and produce the SPRINT_INDEX.md.
```

Wait for completion. You will have 18–24 sprint files and a sprint index before any code is written.

---

### STEP 1 — Backend Development

```
/project:backend-developer
```

Input to give (example):
```
Your sprint is: documentation/sprints/sprint-01-crew-register.md
Read all required documents and implement the sprint exactly as specified.
```

The agent will:
1. Read its mandatory documents
2. Read the sprint file
3. Check if the dev server is already running (`lsof -i :8000`)
4. Build schema, migration, service, controller, DTOs, tests
5. Generate the REST API documentation markdown
6. Kill the server when done
7. Output a completion report

---

### STEP 2 — Code Review

```
/project:code-review
```

Input to give:
```
Review sprint: documentation/sprints/sprint-01-crew-register.md
Backend development is complete. Run the full compliance checklist.
```

The agent will:
1. Read the sprint and all contracts
2. Scan every file produced by the backend agent
3. Start the server, run live endpoint tests, kill the server
4. Output a review report with PASS / FAIL per section

**If the report says BLOCKED**: send it back to the backend developer:
```
/project:backend-developer

The code review found these violations: [paste violations from report]
Fix all blocking issues before proceeding.
```

Repeat until code review outputs: **Frontend Can Start: YES**

---

### STEP 3 — Documentation

```
/project:documentation
```

Input to give:
```
Document sprint: documentation/sprints/sprint-01-crew-register.md
Code review has passed. Read the codebase, verify all endpoints, and produce 
the frontend integration guide.
```

The agent will:
1. Read actual source files (not just contracts)
2. Start the server, hit every endpoint with real requests, kill the server
3. Verify and correct the backend agent's REST API doc
4. Produce the frontend integration guide
5. Update the integration status dashboard
6. Log any deviations found

---

### STEP 4 — Integration Testing (Backend)

```
/project:integration-test
```

Input to give:
```
Test sprint: documentation/sprints/sprint-01-crew-register.md
Backend and documentation are complete. Run all 6 test categories.
```

The agent will:
1. Start the server
2. Run multi-tenant isolation tests (Category 1 — blocking if failed)
3. Run RBAC boundary tests
4. Run business rule tests
5. Run cross-module integration tests
6. Kill the server
7. Output a test report

**If any Category 1 (isolation) test fails**: stop everything and report to you. Do not continue.

---

### STEP 5 — Frontend Development

Only invoke after:
- Backend sprint passed code review ✅
- Documentation agent produced frontend integration guide ✅
- Integration tests passed ✅

```
/project:frontend-developer
```

Input to give:
```
Your sprint is: documentation/sprints/sprint-XX-frontend-crew-register.md
Backend documentation is at: api/documentation/crew_REST_API.md
Frontend integration guide is at: documentation/frontend/crew-frontend-guide.md
Read all required documents, verify all API endpoints, then build the UI.
```

---

### STEP 6 — Integration Testing (Frontend)

```
/project:integration-test
```

Input to give:
```
Test sprint: documentation/sprints/sprint-XX-frontend-crew-register.md
Frontend development is complete. Run portal tests and end-to-end flow tests.
```

---

## Financial Gate Handling

When a sprint file contains `FINANCIAL_GATE_BEFORE_START`, the backend developer agent will stop and tell you. At that point:

1. Check the gate number in the sprint file (Gate 1, 2, or 3)
2. Look up the required Financial Module sprint in `SPRINT_INDEX.md`
3. Run the financial sprint through the full cycle (backend → review → docs → test)
4. Once the financial sprint passes, resume the blocked project sprint:

```
/project:backend-developer

The Financial Gate 1 is now open. Resume sprint: 
documentation/sprints/sprint-04-task-cost-logging.md
```

---

## Invoking Multiple Sprints in a Session

You can give a backend agent multiple sprints in sequence within one session if they are small and sequential with no gates between them:

```
/project:backend-developer

Complete these sprints in order:
1. documentation/sprints/sprint-01-crew-register.md
2. documentation/sprints/sprint-02-subcontractor-register.md

Treat them as sequential. Complete and report on each before starting the next.
Do not start sprint-02 until sprint-01 is fully complete including tests and API docs.
```

Use this sparingly — only for low-complexity sprints with no dependencies between them.

---

## Emergency Procedures

### If Tenant Isolation Fails (Category 1 test)
```
STOP all development.
Do not invoke any more agents.
Report to Ludson: [paste the exact test failure and reproduction steps]
Wait for instructions before continuing.
```

### If API Contract Breaks Mid-Sprint
```
/project:backend-developer

The following contract violation was found by the review agent:
[paste violation]
Fix this before any other work proceeds.
```

### If Two Agents Produce Conflicting Output
The Documentation Agent is the tiebreaker — it reads the actual codebase and what it documents is what the frontend uses. If the backend doc and the documentation agent disagree, the documentation agent wins and the backend agent must fix.

---

## Quick Reference — File Locations

| What | Where |
|------|-------|
| Sprint files | `documentation/sprints/` |
| Sprint index | `documentation/sprints/SPRINT_INDEX.md` |
| Feature contracts | `documentation/contracts/` |
| Integration handoff table | `documentation/contracts/integration-handoff-table.md` |
| Backend API docs (per module) | `api/documentation/{module}_REST_API.md` |
| Frontend integration guides | `documentation/frontend/{module}-frontend-guide.md` |
| Architecture docs | `documentation/architecture/` |
| Deviation log | `documentation/DEVIATION_LOG.md` |
| Integration status | `documentation/INTEGRATION_STATUS.md` |
| Agent commands | `.claude/commands/` |

---

## Dev Server Reminder

Every agent that touches code manages the server itself. But if you ever need to check manually:

```bash
# Is backend running?
lsof -i :8000

# Is frontend running?
lsof -i :7000

# Kill backend
pkill -f "nest start"

# Kill frontend  
pkill -f "next dev"
```

Never leave either server running between agent sessions.

---

*Last updated: March 2026 | Lead360 Platform v1.0*