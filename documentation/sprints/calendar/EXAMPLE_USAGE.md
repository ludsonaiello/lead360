# Example: How to Use the Developer Prompt Template

## Quick Start Guide

### Step 1: Get the Template
```bash
cat DEVELOPER_PROMPT_TEMPLATE.md
```

### Step 2: Get the Sprint Content
```bash
cat sprint_01a_database_schema_core.md
```

### Step 3: Combine Them
Replace `{SPRINT_FILE_CONTENT}` in the template with the sprint content.

---

## Example for Sprint 01A

Here's what the final prompt looks like (abbreviated for example):

```
You are a SENIOR SOFTWARE ENGINEER at a tier-1 tech company (Google/Amazon/Apple level).

Your code quality, attention to detail, and execution precision are EXCEPTIONAL...

[... full prompt ...]

## 📄 SPRINT SPECIFICATION

# Sprint 01A: Database Schema - Core Tables

**Sprint**: Backend Phase 1 - Sprint 1A of 42
**Module**: Calendar & Scheduling
**Estimated Duration**: 4-6 hours

## 🎯 Sprint Goal

Design and implement Prisma schema for the 4 core calendar tables...

[... rest of sprint content ...]

## 🎯 BEGIN IMPLEMENTATION

Read the sprint specification above carefully. Review the codebase patterns. Plan your approach. Then execute with PRECISION.

Your reputation as a tier-1 engineer is on the line. Make it count.

Good luck. 🚀
```

---

## Workflow for Each Sprint

### For Backend Sprints (01A - 26):

1. **Open terminal in API directory**:
   ```bash
   cd /var/www/lead360.app/api
   ```

2. **Launch claude-code**:
   ```bash
   # Use claude-code CLI or your AI development tool
   ```

3. **Paste the combined prompt** (template + sprint file content)

4. **Wait for acknowledgment**:
   Developer must type: "I acknowledge and commit to excellence"

5. **Monitor progress**:
   - Developer will read existing patterns
   - Developer will implement the sprint
   - Developer will write tests
   - Developer will report completion

6. **Verify completion**:
   ```bash
   # Run tests
   npm run test
   
   # Check coverage
   npm run test:cov
   
   # Start server
   npm run start:dev
   
   # Verify in Swagger
   open http://localhost:8000/api/docs
   ```

7. **Review completion report**:
   - All Definition of Done items checked?
   - All tests passing?
   - No console errors?
   - Code follows existing patterns?

8. **If PASS**: Move to next sprint
   **If FAIL**: Provide feedback, restart sprint

---

### For Frontend Sprints (27 - 42):

Same process, but:

1. **Open terminal in APP directory**:
   ```bash
   cd /var/www/lead360.app/app
   ```

2. **Verify backend is running first**:
   ```bash
   # Backend must be running at http://localhost:8000
   # Frontend will call backend APIs
   ```

3. **Launch claude-code** with combined prompt

4. **Verify completion**:
   ```bash
   # Run tests
   npm run test
   
   # Start dev server
   npm run dev
   
   # Verify in browser
   open http://localhost:3000
   ```

---

## Quality Control Checklist

After each sprint, verify:

### Code Quality
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No console warnings in terminal
- [ ] No console errors in browser (frontend)
- [ ] Code follows existing patterns
- [ ] Proper file structure and naming

### Multi-Tenant Isolation
- [ ] All queries filter by `tenant_id`
- [ ] Tests verify tenant A cannot access tenant B data
- [ ] Composite indexes include `tenant_id` first

### RBAC
- [ ] `@Roles()` decorator on all protected endpoints
- [ ] Tests verify each role's access
- [ ] Unauthorized access returns 403

### Testing
- [ ] Unit tests >80% coverage
- [ ] Integration tests for all endpoints
- [ ] All tests passing (100%)
- [ ] Edge cases covered

### Documentation
- [ ] Swagger decorators on all endpoints
- [ ] Request/response schemas documented
- [ ] Error responses documented
- [ ] Inline comments for complex logic

### Database
- [ ] Migrations applied successfully
- [ ] Indexes created correctly
- [ ] Foreign keys set properly
- [ ] Can query tables in Prisma Studio

---

## Common Issues & Solutions

### Issue: Developer says "I can't find the file"
**Solution**: Remind developer to READ existing codebase first. Provide exact file path.

### Issue: Tests failing
**Solution**: Do not accept. Send back for rework. ALL tests must pass.

### Issue: Developer skipped Definition of Done items
**Solution**: Do not accept. Every checkbox must be complete.

### Issue: Code doesn't follow existing patterns
**Solution**: Point to specific existing file to reference. Restart if needed.

### Issue: Missing tenant_id filtering
**Solution**: CRITICAL SECURITY ISSUE. Terminate immediately. This is unacceptable.

---

## Sprint Progress Tracking

Use a spreadsheet or checklist:

| Sprint | Status | Developer | Date | Tests Pass | Quality OK | Notes |
|--------|--------|-----------|------|------------|------------|-------|
| 01A | ✅ Complete | Dev-001 | 2026-03-02 | Yes | Yes | Clean implementation |
| 01B | 🔄 In Progress | Dev-002 | 2026-03-02 | — | — | Working on migrations |
| 02 | ⏳ Pending | — | — | — | — | Blocked by 01B |
| ... | | | | | | |

---

## Emergency Procedures

### If Developer Introduces Security Vulnerability

1. **STOP immediately**
2. Revert all changes: `git reset --hard HEAD~1`
3. Document the vulnerability
4. Restart sprint with new developer instance
5. Add specific warning to prompt for next developer

### If Tests Start Failing in Later Sprints

1. Identify which sprint introduced the regression
2. Review the changes from that sprint
3. Fix the regression
4. Re-run all tests
5. Document the issue in sprint notes

### If Multiple Sprints Block on External Dependency

1. Identify the dependency (e.g., Google Cloud setup)
2. Escalate to platform team
3. Continue with non-blocked sprints
4. Return to blocked sprints once resolved

---

## Success Metrics

After all 42 sprints:

- ✅ All 405+ tests passing
- ✅ All 45+ API endpoints working
- ✅ 100% API documentation complete
- ✅ Swagger UI fully functional
- ✅ Multi-tenant isolation verified
- ✅ RBAC enforced everywhere
- ✅ No security vulnerabilities
- ✅ No console errors or warnings
- ✅ Backend Completion Report approved
- ✅ Frontend Completion Report approved

**Total Implementation Time**: 30-36 development days (estimated)

---

**Last Updated**: 2026-03-02
**Status**: Ready for Use
