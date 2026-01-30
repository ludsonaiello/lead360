# Sprint 4: Workflow, Approvals & Versions

**Agent**: Frontend Developer 4  
**Duration**: 8 days  
**Prerequisites**: Sprint 1-3 complete  
**Read First**: `QUOTE_FRONTEND_GLOBAL_INSTRUCTIONS.md`

---

## YOUR DOCUMENTATION

**API Sections to Read**:
- `api/documentation/quotes_REST_API.md` - Approval Workflow (9 endpoints)
- `api/documentation/quotes_REST_API.md` - Version History (8 endpoints)
- `api/documentation/quotes_REST_API.md` - Change Orders (6 endpoints)

Total: 23 endpoints

---

## YOUR MISSION

Build workflow and change tracking:
- Multi-level approval workflow
- Version history and comparison
- Change orders for approved quotes
- Approval dashboards

---

## COMPONENTS TO BUILD

### Approval Workflow

1. **Approval Status Display** (on quote detail)
   - Current approval level
   - Progress indicator (step tracker)
   - Pending approvers list
   - Approval history

2. **Submit for Approval Action**
   - Button on quote detail
   - Confirmation dialog
   - Status change to pending_approval

3. **Approve/Reject Modal**
   - Approve button
   - Reject button with comment field
   - Confirmation

4. **Pending Approvals Dashboard Widget**
   - List quotes pending current user's approval
   - Quick approve/reject actions
   - Link to quote detail

5. **Approval Configuration** (`/settings/approvals`)
   - Define approval levels
   - Set thresholds (amount triggers)
   - Assign approvers per level

6. **Owner Bypass**
   - Special action for Owner role
   - Skip approval levels
   - Confirmation dialog with warning

### Version History

7. **Version Timeline** (on quote detail)
   - List all versions with timestamps
   - Show what changed per version
   - Created by user
   - Actions: view, compare, restore

8. **Version Comparison Modal**
   - Side-by-side diff view
   - Highlight added/removed/modified fields
   - Color coding (green=added, red=removed, yellow=modified)

9. **Version Restore**
   - Select version to restore
   - Preview changes
   - Confirmation dialog
   - Creates new version

### Change Orders

10. **Change Order List** (on quote detail)
    - All change orders for quote
    - Status badges
    - Impact summary (+/- amounts)
    - Actions: view, approve

11. **Create Change Order Form**
    - Available only on approved quotes
    - Title, description, justification
    - Items to add/remove/modify
    - Calculate impact

12. **Change Order Approval**
    - Similar to quote approval
    - Shows before/after comparison
    - Approve/reject actions

13. **Change Order Timeline**
    - Chronological view of all change orders
    - Visual impact graph

---

## KEY REQUIREMENTS

### Approval Workflow Logic
Read API documentation for approval rules:
- Sequential levels (must approve in order)
- Threshold-based triggering
- Role-based permissions
- Owner bypass capability

### Version Creation Triggers
API creates new version when:
- Quote edited after approval
- Change order approved
- Significant changes made

UI should indicate when action will create version.

### Version Comparison
Diff logic (from API):
- Field-level comparison
- Nested object changes
- Array modifications
- Timestamp differences

Display clearly with color coding.

### Change Order Restrictions
API rules (check documentation):
- Only on approved quotes
- Requires justification
- May trigger re-approval
- Cannot modify certain locked fields

Enforce these restrictions in UI.

---

## TESTING CHECKLIST

Test with both accounts:
- [ ] Submit quote for approval
- [ ] View pending approvals dashboard
- [ ] Approve quote at level 1
- [ ] Approve quote at level 2 (if multi-level)
- [ ] Reject quote with comment
- [ ] Owner bypass approval
- [ ] Configure approval thresholds
- [ ] View version history
- [ ] Compare two versions
- [ ] Restore previous version
- [ ] Create change order on approved quote
- [ ] View change order impact
- [ ] Approve change order
- [ ] Reject change order
- [ ] View change order timeline
- [ ] Test version creation on edit after approval

---

## COMPLETION CRITERIA

Sprint 4 complete when:
- All 23 endpoints have working UI
- Approval workflow functional (submit, approve, reject)
- Pending approvals dashboard works
- Approval configuration works
- Version history displays correctly
- Version comparison works
- Version restore functional
- Change orders can be created
- Change order approval works
- All endpoints tested with both accounts
- Sequential approval logic enforced

---

**Next Sprint**: Developer 5 builds attachments, email, PDF, and public sharing.