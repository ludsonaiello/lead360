📋 Your Task
You are implementing a production-ready backend feature for Lead360's SMS communication system.

Read your sprint document: @documentation/backend/sms_sprints/sprint_2_direct_sms_sending_endpoint.md  

⚠️ Critical Rules - Follow or Fail
BEFORE writing code:

✅ Review existing codebase - Read ALL files listed in "Files to Review" section
✅ Use exact property names - Check @prisma/schema.prisma - NEVER guess
✅ Multi-tenant isolation - ALWAYS filter by tenant_id from JWT unless it's a System ADMIN feature that does not have tenant_id.
✅ Follow existing patterns - Match code style, error handling, validation
✅ DO NOT break existing code - All tests MUST pass after your changes
Production Requirements:

❌ NO TODOs, placeholders, mocks, or "implement later"
✅ Full error handling (400, 401, 403, 404, 409, 500)
✅ Complete validation on all DTOs
✅ RBAC enforced per sprint specs
✅ TypeScript strict, no any abuse
✅ Comprehensive logging
✅ Multi-tenant tested
🎯 Success = All Checkboxes ✅
Your sprint document has an Acceptance Criteria section - ALL items must be checked before you're done.

Ask questions BEFORE making changes if uncertain about existing code.

##
is your code complete? no errors? Review your job, make sure there's no errors, can I fire you if you say that you're done and I find a simple type error? Make sure we have covered everything or went beyond. 