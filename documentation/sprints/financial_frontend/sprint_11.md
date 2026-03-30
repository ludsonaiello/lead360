# Sprint 11 — Financial Entry CSV Export
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_11.md
**Type:** Frontend — Feature Enhancement
**Depends On:** Sprint 1, Sprint 8
**Gate:** NONE
**Estimated Complexity:** Low

---

## Objective

Add CSV export functionality to the Financial Entries list page. Users can export filtered entries as a CSV file for external analysis or record-keeping.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 6.11.
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Export entries as CSV
curl -s "http://localhost:8000/api/v1/financial/entries/export" \
  -H "Authorization: Bearer $TOKEN" --output test_export.csv

cat test_export.csv | head -5
```

---

## Tasks

### Task 1 — Add Export Button to Entries List

On the Financial Entries list page (Sprint 8), add an "Export CSV" button next to the "New Entry" button.

**RBAC:** Only visible to Owner, Admin, Bookkeeper.

**Behavior:**
1. Click "Export CSV" button
2. Show loading spinner on button
3. Call `exportEntries(currentFilters)` — using the same filter params currently active on the list
4. Receive Blob response
5. Create download link and trigger download:
```typescript
const handleExport = async () => {
  setExporting(true);
  try {
    const blob = await exportEntries(currentFilters);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Export downloaded successfully');
  } catch (err) {
    toast.error('Export failed. Make sure there are entries matching your filters.');
  } finally {
    setExporting(false);
  }
};
```

6. Toast success on download
7. Toast error if no matching entries (API returns 400)

**Button design:** Secondary variant with Download icon from lucide-react.

**Note:** The export uses the same filters as the current list view. The user filters → sees preview → exports those exact results. Max 10,000 rows.

---

### Task 2 — Export Confirmation Modal (Optional Enhancement)

Before exporting, show a quick confirmation modal:
- Title: "Export Entries"
- Message: "Export {X} entries matching your current filters as CSV?"
- Show active filter summary
- "Export" button + "Cancel" button

This gives the user confidence about what they're exporting. Use the entry_count from the current list summary.

---

## Acceptance Criteria
- [ ] Export button visible to Owner/Admin/Bookkeeper
- [ ] Export uses current active filters
- [ ] CSV file downloads with correct filename
- [ ] Loading state on export button during download
- [ ] Error handling if no entries match
- [ ] Toast notifications
- [ ] No backend code modified

---

## Handoff Notes
- Export endpoint returns `Content-Type: text/csv` with `Content-Disposition` header
- Max 10,000 rows per export
- API returns 400 if no records match the filters
- CSV columns: Date, Time, Type, Category, Classification, Project, Task, Supplier, Vendor Name, Amount, Tax Amount, Payment Method, Payment Account, Purchased By, Submitted By, Status, Notes, Created At
