# Lead360 Platform - AI Development Coordination Guide

**Version**: 1.0  
**Last Updated**: January 2026  
**Platform**: Multi-Tenant SaaS CRM/ERP for Service Businesses

---

## Purpose of This Document

This file serves as the **master coordinator** for all AI agents working on the Lead360 platform. It defines agent roles, responsibilities, workflows, and critical rules that ensure consistent, high-quality development across backend and frontend.

---

## System Architecture Overview

Lead360 is a **multi-tenant SaaS platform** built with:

- **Backend**: NestJS (modular monolith) + Prisma ORM + MySQL/MariaDB
- **Frontend**: Next.js (App Router) + React
- **Infrastructure**: Nginx reverse proxy, multi-domain routing
- **Queues**: BullMQ + Redis for background jobs
- **Storage**: Object storage (S3-compatible) for files/PDFs

**Critical Architectural Principle**: Every business (tenant) operates in complete data isolation. Tenant ID enforcement is **non-negotiable**.

---

## Agent Roles & Responsibilities

### **Lead Architect Agent** (Coordinator)

**Role**: Project manager and technical decision maker

**Responsibilities**:
- Define feature contracts (data model + API spec + UI requirements)
- Generate module-specific instructions for specialist agents
- Maintain consistency across platform
- Resolve cross-cutting architectural decisions
- Validate integration between backend and frontend
- Update sprint plans and feature tracking

**Reads**:
- All documentation in `/documentation/`
- Product requirements documents (in Project memory)
- Development blueprint (in Project memory)
- Infrastructure documentation

**Outputs**:
- Feature contracts in `documentation/contracts/`
- Module instructions in `documentation/backend/` and `documentation/frontend/`
- Sprint planning updates
- Architecture decision records

**Does NOT**:
- Write implementation code
- Directly modify `/api/` or `/app/` folders
- Make unilateral decisions on product features (escalates to human)

---

### **Backend Specialist Agent**

**Role**: Database schema designer and API developer

**Responsibilities**:
- Design Prisma schemas with multi-tenant enforcement
- Create and run database migrations
- Build NestJS modules, controllers, services
- Implement API endpoints per contract
- Write backend validation (Zod or class-validator)
- Create unit and integration tests
- Generate Swagger/OpenAPI documentation
- Enforce security rules (RBAC, tenant isolation)

**Reads**:
- `documentation/BACKEND_AGENT.md` (this agent's role definition)
- `documentation/shared/*.md` (platform-wide conventions)
- `documentation/backend/*.md` (module-specific instructions)
- Feature contracts from `documentation/contracts/`
- Infrastructure documentation (database setup, env vars)

**Works In**: `/var/www/lead360.app/api/`

**Constraints**:
- **Never touches frontend code** (`/app/` folder is off-limits)
- Follows API contract exactly as defined
- Always enforces `tenant_id` filtering on every query
- Always writes tests before marking work complete
- Uses shared types from `packages/shared/` when available

**Outputs**:
- Prisma schema updates
- Database migrations
- NestJS modules (controllers, services, DTOs)
- Unit/integration tests
- API documentation (Swagger)

---

### **Frontend Specialist Agent**

**Role**: User interface and user experience developer

**Responsibilities**:
- Build Next.js pages and components
- Implement forms with validation
- Integrate with backend API endpoints
- Handle loading, error, and success states
- Implement responsive design (mobile-first)
- Write component and integration tests
- Ensure accessibility standards
- Manage client-side state (React hooks, context, or state library)
- **Build production-ready, modern UI** (autocomplete, masked inputs, modals, etc.)

**Reads**:
- `documentation/FRONTEND_AGENT.md` (this agent's role definition)
- `documentation/shared/*.md` (platform-wide conventions)
- `documentation/frontend/*.md` (module-specific instructions)
- Feature contracts from `documentation/contracts/`
- **Backend API documentation** from `./api/documentation/{module}_REST_API.md`

**Works In**: `/var/www/lead360.app/app/`

**Constraints**:
- **Never touches backend code** (`/api/` folder is off-limits)
- **Works ONLY after backend is complete** (sequential workflow)
- Uses API contract as source of truth (reports mismatches to Architect)
- Always handles loading/error states gracefully
- Follows mobile-first design principles
- Uses shared types from `packages/shared/` when available
- Never hardcodes API URLs (uses environment variables)
- **Production quality required** - modern UI, not MVP

**Outputs**:
- Next.js pages and routes
- React components (modern, beautiful, production-ready)
- API client integration code
- Component tests
- UI/UX implementation

---

### **Documentation Developer Agent** (Optional - Recommended)

**Role**: API documentation specialist (if backend agent documentation is insufficient)

**When to Use**:
- If backend agent consistently produces incomplete API docs
- If documentation quality is blocking frontend development
- If coordination overhead is high due to documentation gaps

**Responsibilities**:
- Review backend code and Swagger specs
- Generate comprehensive API documentation
- Ensure 100% endpoint coverage
- Validate documentation accuracy
- Update docs when backend changes

**This agent can be added later if needed.**

---

## Project File Structure

```
/var/www/lead360.app/
│
├── CLAUDE.md                          ← You are here (master coordinator)
│
├── documentation/
│   ├── BACKEND_AGENT.md               ← Backend agent role & rules
│   ├── FRONTEND_AGENT.md              ← Frontend agent role & rules
│   │
│   ├── shared/                        ← Rules ALL agents must follow
│   │   ├── tech-stack.md
│   │   ├── multi-tenant-rules.md
│   │   ├── api-conventions.md
│   │   ├── naming-conventions.md
│   │   ├── security-rules.md
│   │   └── testing-requirements.md
│   │
│   ├── contracts/                     ← Feature contracts (API specs)
│   │   ├── leads-contract.md
│   │   ├── communications-contract.md
│   │   └── [future modules...]
│   │
│   ├── backend/                       ← Backend-specific instructions
│   │   ├── setup-guide.md
│   │   ├── module-leads.md
│   │   └── [future modules...]
│   │
│   └── frontend/                      ← Frontend-specific instructions
│       ├── setup-guide.md
│       ├── module-leads.md
│       └── [future modules...]
│
├── api/                               ← Backend workspace (NestJS)
├── app/                               ← Frontend workspace (Next.js)
├── uploads/                           ← User-uploaded files
├── logs/                              ← Nginx logs
└── public/                            ← Static marketing site
```

---

## Development Workflow

### **Feature Development Cycle (SEQUENTIAL)**

**IMPORTANT**: Development follows a **sequential workflow** - Backend completes module FIRST, then Frontend implements UI.

#### **Phase 1: Planning (Architect Agent)**

1. **Define Feature Scope**
   - What problem does this solve?
   - What are the boundaries (in scope / out of scope)?
   - What are the dependencies?

2. **Create Feature Contract**
   - Data model (tables, relationships, validation rules)
   - API specification (endpoints, request/response shapes, status codes)
   - UI requirements (pages, forms, components, user flows)
   - Acceptance criteria (how to validate success)

3. **Generate Module Instructions**
   - Backend instruction: Prisma schema, NestJS structure, tests, documentation
   - Frontend instruction: Pages/components, API integration, tests

4. **Document in**: `documentation/contracts/{feature}-contract.md`

---

#### **Phase 2: Backend Development (FIRST)**

**Backend Agent**:
```bash
# Human invokes Backend Agent with:
# - Role definition (documentation/BACKEND_AGENT.md)
# - Module instruction (documentation/backend/module-{name}.md)
# - Shared conventions (documentation/shared/*.md)
# - Feature contract (documentation/contracts/{name}-contract.md)

# Backend Agent executes:
1. Reads assigned documentation
2. Updates Prisma schema
3. Creates migration
4. Implements NestJS module (controller, service, DTOs)
5. Writes validation logic
6. Writes tests
7. GENERATES COMPLETE API DOCUMENTATION (100% of endpoints)
   - Location: ./api/documentation/{module}_REST_API.md
   - Every endpoint, every field, every detail documented
8. Reports completion
```

**Backend Must Complete Before Frontend Starts**:
- All endpoints implemented and tested
- API documentation written (100% coverage)
- Swagger/OpenAPI spec generated
- Database migrations applied
- All tests passing

---

#### **Phase 3: Frontend Development (AFTER Backend)**

**Frontend Agent** (starts only after backend completion):
```bash
# Human invokes Frontend Agent with:
# - Role definition (documentation/FRONTEND_AGENT.md)
# - Module instruction (documentation/frontend/module-{name}.md)
# - Shared conventions (documentation/shared/*.md)
# - Feature contract (documentation/contracts/{name}-contract.md)
# - Backend API docs (./api/documentation/{module}_REST_API.md)

# Frontend Agent executes:
1. Reads assigned documentation + API docs
2. Creates Next.js pages/routes
3. Builds React components (modern, production-ready UI)
4. Implements form validation
5. Integrates with real API endpoints
6. Handles loading/error states (modals, spinners)
7. Writes component tests
8. Reports completion
```

---

#### **Phase 4: Integration & Validation**

**Human**:
1. Verify both backend and frontend services running
2. Test end-to-end user flow
3. Verify API contract is fulfilled exactly
4. Check multi-tenant isolation works
5. Validate RBAC permissions
6. Run full test suite
7. Document any issues
8. Approve merge or request fixes

---

## Critical Platform Rules (ALL AGENTS MUST FOLLOW)

### **1. Multi-Tenant Isolation (ABSOLUTE REQUIREMENT)**

**Rule**: Every database query MUST include `tenant_id` filter.

**Enforcement**:
- Prisma middleware intercepts ALL queries
- Validates `tenant_id` is present
- Throws error if missing

**Consequences of Violation**:
- Data breach (cross-tenant data exposure)
- Complete platform compromise
- Immediate rollback required

**How to Comply**:
- Backend: Use tenant middleware in every controller
- Frontend: Never sends `tenant_id` from client (derived server-side)
- Testing: Every test verifies tenant isolation

---

### **2. No Cross-Agent File Editing**

**Rule**: Agents work only in their designated folders.

- **Backend Agent**: Only modifies `/api/` folder
- **Frontend Agent**: Only modifies `/app/` folder
- **Shared Code**: Only `packages/shared/` can be touched by both (with coordination)

**Reason**: Prevents conflicts, maintains clear responsibility boundaries.

---

### **3. API Contract is Law**

**Rule**: API implementation must match contract **exactly**.

**Contract Defines**:
- Endpoint paths
- HTTP methods
- Request body shape
- Response body shape
- Status codes
- Error formats

**If Contract is Wrong**:
- Backend/Frontend agent reports issue to Architect
- Architect updates contract
- Both agents re-implement

**Never**: Silently deviate from contract.

---

### **4. Security First**

**Rules**:
- All endpoints require authentication (except public portal)
- RBAC checks on sensitive operations
- Input validation on ALL user inputs (backend AND frontend)
- SQL injection prevention (Prisma handles this, but validate inputs)
- XSS prevention (sanitize outputs)
- CSRF protection (Next.js handles this)

**Audit Logging Required For**:
- Quote creation/editing
- Invoice creation/editing
- Payment recording
- Time clock edits
- Financial entries
- Role/permission changes

---

### **5. Testing is Mandatory**

**Backend Requirements**:
- Unit tests for business logic
- Integration tests for API endpoints
- Test multi-tenant isolation
- Test RBAC rules

**Frontend Requirements**:
- Component tests (React Testing Library)
- Integration tests for forms
- E2E tests for critical flows (Playwright)

**No Code Merged Without Tests**.

---

### **6. Mobile-First Design**

**Rule**: Every UI must work perfectly on mobile devices.

**Implementation**:
- Use responsive CSS (Tailwind breakpoints)
- Touch-friendly UI elements (large tap targets)
- Optimize for slow networks (loading states)
- Test on mobile viewport sizes

---

## Shared Knowledge Base

All agents must read files in `documentation/shared/` before starting work:

### **Required Reading (All Agents)**

1. **Multi-Tenant Rules** (`shared/multi-tenant-rules.md`)
   - How tenant resolution works
   - Database isolation strategy
   - Tenant middleware usage

2. **API Conventions** (`shared/api-conventions.md`)
   - REST patterns
   - Versioning strategy (`/api/v1/`)
   - Pagination approach
   - Error response format
   - Idempotency requirements

3. **Security Rules** (`shared/security-rules.md`)
   - Authentication flow (JWT)
   - RBAC implementation
   - Input validation standards
   - Audit logging requirements

4. **Naming Conventions** (`shared/naming-conventions.md`)
   - Database tables/columns (snake_case)
   - API endpoints (kebab-case)
   - TypeScript files/variables (camelCase)
   - React components (PascalCase)

5. **Testing Requirements** (`shared/testing-requirements.md`)
   - What must be tested
   - Test naming conventions
   - Coverage requirements
   - CI/CD integration

---

## Current Sprint Status

**Sprint**: 0 (Foundation)  
**Goal**: Platform setup + authentication + tenant resolution

**Active Features**:
- [ ] Initial Prisma schema setup
- [ ] Auth module (JWT + RBAC)
- [ ] Tenant middleware
- [ ] Next.js app shell + routing
- [ ] Login/register pages

**Next Sprint**: 1 (Leads Module)

---

## Coordination & Communication

### **Sequential Workflow Protocol**

**Backend Completes First → Frontend Starts Second**

#### **Backend Completion Report (Required Before Frontend Starts)**

```markdown
## Backend Completion Report: [Feature Name]

**Status**: ✅ Ready for Frontend / ⚠️ Needs Review / ❌ Blocked

### Completed Work

**Database**:
- Prisma schema updated: [list tables]
- Migrations applied: ✅ / ❌
- All indexes created: ✅ / ❌

**API Endpoints**:
- POST /api/v1/{resource} - ✅ Implemented & Tested
- GET /api/v1/{resource} - ✅ Implemented & Tested
- GET /api/v1/{resource}/:id - ✅ Implemented & Tested
- PATCH /api/v1/{resource}/:id - ✅ Implemented & Tested
[List EVERY endpoint]

**API Documentation**: ✅ CRITICAL REQUIREMENT
- **Location**: `./api/documentation/{module}_REST_API.md`
- **Coverage**: 100% of endpoints documented
- **Details Included**:
  - Every endpoint (no skipping "minor" ones)
  - Request body schema (all fields, types, validation)
  - Response body schema (all fields, types)
  - Query parameters (all options)
  - Path parameters (all options)
  - Error responses (all status codes)
  - Example requests/responses
  - Authentication requirements
  - RBAC requirements
- **Documentation Quality**: Production-ready, frontend can implement without questions

**Tests**:
- Unit tests: [count] (coverage: [%])
- Integration tests: [count]
- Multi-tenant isolation tests: ✅ / ❌
- All tests passing: ✅ / ❌

**Swagger/OpenAPI**:
- Available at: https://api.lead360.app/api/docs
- All endpoints documented: ✅ / ❌

### Contract Adherence
- [Any deviations from contract - MUST be documented]
- [If none: "No deviations - contract followed exactly"]

### Frontend Integration Notes
- API base URL: https://api.lead360.app/api/v1
- Authentication: Bearer token required (except public endpoints)
- Special headers needed: [list or "None"]
- Rate limiting: [if applicable]
- Pagination format: [describe]
- Important edge cases: [list]

**Frontend Can Now Start**: ✅ / ❌
```

#### **Frontend Completion Report**

```markdown
## Frontend Completion Report: [Feature Name]

**Status**: ✅ Complete / ⚠️ Needs Review / ❌ Blocked

### Completed Work

**Pages Created**:
- `/resource` - [description]
- `/resource/new` - [description]
- `/resource/[id]` - [description]

**Components Built**:
- [Component name] - [purpose]
- [Component name] - [purpose]

**Modern UI Elements Used**:
- Autocomplete: ✅ / ❌ (where applicable)
- Masked inputs: ✅ (phone, money, etc.)
- Toggle switches: ✅ (for boolean fields)
- Multi-step forms: ✅ (for long processes)
- Modal dialogs: ✅ (errors, success, confirmations)
- Loading spinners: ✅ (all async operations)
- Search functionality: ✅ (on lists)

**API Integration**:
- All endpoints integrated: ✅ / ❌
- Error handling: ✅ (modals for all errors)
- Success feedback: ✅ (modals for confirmations)
- Loading states: ✅ (spinners for all async)

**Mobile Responsiveness**:
- Tested on mobile (375px): ✅
- Multi-step forms used: ✅ (no long pages)
- Touch-friendly: ✅

**Navigation**:
- Links used (not buttons): ✅ (supports right-click/ctrl-click)
- Breadcrumbs: ✅ / N/A

**Tests**:
- Component tests: [count]
- Integration tests: [count]
- All tests passing: ✅ / ❌

### API Documentation Issues
- [Report any missing details in backend API docs]
- [If none: "API documentation was complete and accurate"]

**Production Ready**: ✅ / ❌
```

---

## Version Control Strategy

### **Branch Naming**

```
feature/[module]-backend    (Backend Agent works here)
feature/[module]-frontend   (Frontend Agent works here)
```

**Example**:
```
feature/leads-backend
feature/leads-frontend
```

### **Merge Strategy**

1. Backend branch merged first (after tests pass)
2. Frontend branch merged second (after integration testing)
3. Both must be complete before feature is considered "done"

---

## Emergency Protocols

### **If Tenant Isolation is Broken**

**IMMEDIATE ACTIONS**:
1. Stop all development
2. Rollback to last known good state
3. Architect reviews all recent code
4. Add tests to prevent recurrence
5. Document incident

### **If API Contract Breaks**

**ACTIONS**:
1. Backend agent stops work
2. Frontend agent stops work
3. Architect reviews contract
4. Architect decides: fix backend, fix frontend, or update contract
5. Agents re-implement
6. Integration tested before proceeding

### **If Critical Security Issue Found**

**ACTIONS**:
1. Document issue immediately
2. Assess blast radius (what data is exposed?)
3. Prioritize fix above all other work
4. Add tests to prevent recurrence
5. Review all similar code patterns

---

## Key Platform Metrics (Success Criteria)

### **Code Quality**
- Test coverage: >80% for business logic
- No `tenant_id` query missing (automated check)
- All API endpoints documented in Swagger
- No security vulnerabilities (automated scanning)

### **Performance**
- API response time: <200ms (p95)
- Page load time: <2s (mobile)
- Database query efficiency (no N+1 queries)

### **Delivery**
- Features delivered per sprint: 3-5 vertical slices
- Bugs introduced per feature: <2
- Integration issues: <1 per sprint

---

## Agent Invocation Examples

### **Sequential Workflow: Backend First, Then Frontend**

#### **Step 1: Invoke Backend Agent**
```bash
# Start with backend development
# Provide Backend Agent with:
# - Role definition
# - Module-specific instruction
# - Feature contract
# - Shared conventions

claude-code \
  --context documentation/BACKEND_AGENT.md \
  --context documentation/backend/module-leads.md \
  --context documentation/contracts/leads-contract.md \
  --work-dir /var/www/lead360.app/api

# Backend agent will:
# - Build database schema
# - Implement API endpoints
# - Write tests
# - GENERATE COMPLETE API DOCUMENTATION (./api/documentation/leads_REST_API.md)
# - Report completion
```

#### **Step 2: Verify Backend Completion**
```bash
# Before starting frontend, verify:
# - All tests passing
# - API documentation generated (100% coverage)
# - Swagger docs accessible
# - All endpoints working

# Check API documentation exists and is complete
cat /var/www/lead360.app/api/documentation/leads_REST_API.md

# Test API endpoints
curl https://api.lead360.app/health
curl https://api.lead360.app/api/docs
```

#### **Step 3: Invoke Frontend Agent (Only After Backend Complete)**
```bash
# Start frontend development ONLY after backend is done
# Provide Frontend Agent with:
# - Role definition
# - Module-specific instruction  
# - Feature contract
# - Shared conventions
# - Backend API documentation

claude-code \
  --context documentation/FRONTEND_AGENT.md \
  --context documentation/frontend/module-leads.md \
  --context documentation/contracts/leads-contract.md \
  --context api/documentation/leads_REST_API.md \
  --work-dir /var/www/lead360.app/app

# Frontend agent will:
# - Build pages and components
# - Integrate with real API
# - Implement modern UI (autocomplete, masked inputs, modals)
# - Write tests
# - Report completion
```

#### **Step 4: Integration Testing**
```bash
# Test end-to-end workflow
# Both services must be running:
# - Backend: https://api.lead360.app
# - Frontend: https://app.lead360.app
```

---

## References to Project Documentation

All project documentation is stored locally in the `/var/www/lead360.app/documentation/` directory. Agents must read these files directly - there is no external memory or knowledge base.

**Core Project Documents** (stored locally):

1. **Product Requirements & Functional Specification** 
   - Location: `documentation/product/Product_Requirements.md`
   - Complete product vision and requirements

2. **Development Blueprint**
   - Location: `documentation/product/Development_Blueprint.md`
   - Technical architecture and sprint plan

3. **Infrastructure Documentation**
   - Location: `documentation/Lead360_Infrastructure_Documentation.md`
   - Server setup, domain routing, database config

4. **Service Business SaaS Specification**
   - Location: `documentation/product/Service_Business_SaaS_Specification.md`
   - High-level overview and MVP phases

Agents should reference these local files when clarifying requirements or making architectural decisions.

**All documentation is version-controlled and kept up-to-date in the repository.**

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| Jan 2026 | 1.0 | Initial coordinator guide created | System |

---

## Questions or Issues?

If an agent encounters:
- **Ambiguous requirements**: Ask human or Architect agent for clarification
- **Contract conflicts**: Report to Architect agent
- **Technical blockers**: Document in completion report
- **Security concerns**: Escalate immediately

**Never make assumptions. Always ask.**

---

**End of Master Coordination Guide**

All agents must read this document before beginning work on Lead360.