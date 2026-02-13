# Sprint 4: Call History & Playback

**Developer**: Developer 4
**Dependencies**: Sprint 1 (API client, types)
**Duration**: 1 sprint

---

## 🎯 Sprint Goal

Build a comprehensive call history interface with pagination, filtering, search, recording playback, and CSV export functionality.

---

## 📋 Test Credentials

- **API Base URL**: `http://localhost:8000/api/v1`
- **Test Email**: `contact@honeydo4you.com`
- **Test Password**: `978@F32c`

---

## 📚 Backend API Endpoints

**Test ALL endpoints with curl BEFORE implementation. If response differs from docs, STOP and report.**

### 1. Get Paginated Call History
**`GET /api/v1/communication/twilio/call-history`**

Query Parameters:
- `page` (optional, default: 1, min: 1) - Page number
- `limit` (optional, default: 20, min: 1, max: 100) - Items per page

Response Structure:
```
{
  data: CallRecord[],
  meta: { total, page, limit, totalPages }
}
```

Each CallRecord includes:
- Basic info: id, twilio_call_sid, direction, from_number, to_number
- Status: status, call_type, call_reason
- Recording: recording_url, recording_duration_seconds, recording_status
- Timestamps: started_at, ended_at, created_at
- Related: lead (object with id, first_name, last_name, phone), initiated_by_user

**RBAC**: Owner, Admin, Manager, Sales (Employee CANNOT view)

### 2. Get Call Details by ID
**`GET /api/v1/communication/twilio/calls/:id`**

Returns single CallRecord (same structure as in history array).

**RBAC**: Owner, Admin, Manager, Sales

### 3. Get Call Recording URL
**`GET /api/v1/communication/twilio/calls/:id/recording`**

Response:
```
{
  url: string (relative path),
  duration_seconds: number,
  transcription_available: boolean
}
```

**RBAC**: Owner, Admin, Manager, Sales

**Error**: 404 if recording not available

---

## 🏗️ Required Implementation

### Page: `/app/src/app/(dashboard)/communications/twilio/calls/page.tsx`

**Layout Requirements**:
1. **Header**: Title, description, date range filter, search input
2. **Filters** (above table):
   - Direction: All, Inbound, Outbound
   - Status: All, Completed, Failed, No Answer, Busy, Canceled
   - Call Type: All, Customer Call, Office Bypass, IVR Routed
   - Date Range Picker (from/to)
3. **Call History Table** (or cards on mobile):
   - Columns: Lead Name, Phone, Direction, Status, Duration, Recording, Date/Time, Actions
   - Pagination controls (prev/next, page numbers)
   - Per-page selector (10, 20, 50, 100)
4. **Export Button**: Export to CSV
5. **Empty State**: When no calls found
6. **Loading State**: Skeleton table rows

**Table Features**:
- Sort by date (newest first)
- Status badges with colors (completed=green, failed=red, etc.)
- Direction badges (inbound=blue, outbound=purple)
- Duration formatted (MM:SS)
- Recording play button (if available)
- Lead name links to lead detail page
- Click row to open detail modal

**Mobile Responsiveness**:
- Table converts to card layout on <768px
- Cards show: Lead, phone, status, duration, recording button
- Filters collapse into dropdown/drawer

### Component: `/app/src/components/twilio/CallDetailsModal.tsx`

**Purpose**: Display full call details in modal

**Content**:
- Call SID, direction, status, call type
- From/to phone numbers
- Lead information (if matched)
- Initiated by user (if outbound)
- Call reason (if provided)
- Recording player (HTML5 audio element if available)
- Transcription status
- Timestamps: created, started, ended
- Duration calculation

### Component: `/app/src/components/twilio/CallRecordCard.tsx`

**Purpose**: Reusable card for mobile/list view

**Content**:
- Lead name + phone
- Direction + status badges
- Duration
- Date/time
- Recording play button
- Click to open details modal

---

## 🔍 Search & Filter Logic

**Search**: Filter by:
- Lead first name
- Lead last name
- Lead phone number
- From number
- To number

**Filters**: Combine with AND logic (all active filters must match)

**Implementation Note**: Frontend filtering on fetched data OR backend filtering via query params (check if backend supports filter params - if not, filter client-side)

---

## 🎵 Recording Playback

**Audio Player Requirements**:
- HTML5 `<audio>` element with controls
- Display duration
- Loading state while audio loads
- Error handling if recording fails to load
- Full URL construction: Base URL + recording_url from API

**Recording URL Format**: `/public/tenant-id/communication/recordings/2026/02/call-id.mp3`

**Construct Full URL**:
```
const recordingFullUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}${recording.url}`
```

---

## 📊 CSV Export

**Export Fields**:
- Date/Time
- Lead Name
- Lead Phone
- Direction
- Status
- Call Type
- Duration (seconds)
- Recording Available (Yes/No)
- Initiated By (user name)
- Call Reason

**Library**: Use existing CSV export pattern from `/app/src/app/(dashboard)/communications/history/page.tsx`

---

## ✅ Sprint 4 Completion Checklist

### API Testing
- [ ] All 3 call endpoints tested with curl
- [ ] Pagination tested (page 1, 2, limit 20, 50)
- [ ] Response structure matches documentation
- [ ] Recording URL endpoint tested
- [ ] RBAC tested (Employee gets 403)
- [ ] Any discrepancies documented and reported

### Page Implementation
- [ ] Call history table displays with pagination
- [ ] Filters work (direction, status, call type, date range)
- [ ] Search works (lead name, phone numbers)
- [ ] Pagination controls work (prev/next, page select)
- [ ] Per-page selector works
- [ ] Empty state displays when no calls
- [ ] Loading state displays correctly

### Call Details Modal
- [ ] Modal opens when clicking row
- [ ] All call details display correctly
- [ ] Recording plays if available
- [ ] Lead information shows (if matched)
- [ ] Timestamps formatted correctly
- [ ] Duration calculated correctly

### Recording Playback
- [ ] Audio player renders
- [ ] Recording plays successfully
- [ ] Duration displays
- [ ] Loading state works
- [ ] Error handling for failed recordings

### CSV Export
- [ ] Export button works
- [ ] CSV includes all required fields
- [ ] Filename includes date/time
- [ ] Data formats correctly in Excel/Sheets

### RBAC
- [ ] Page accessible to Owner, Admin, Manager, Sales
- [ ] Employee role gets 403 or redirected
- [ ] Backend enforces permissions

### Mobile Responsiveness
- [ ] Table converts to cards on mobile
- [ ] Filters work on mobile
- [ ] Audio player works on mobile
- [ ] Pagination controls work on mobile

### Dark Mode
- [ ] All components support dark mode
- [ ] Audio player controls visible in dark mode

---

## 📤 Deliverables

1. Call history page with table/cards
2. Call details modal
3. Call record card component
4. CSV export functionality
5. API testing report

---

## 🚦 Next Sprint

**Sprint 5: Initiate Outbound Calls**
- Integration with Lead pages
- Call button component
- User phone number input
- Call reason tracking

---

## ⚠️ Critical Requirements

1. **Test API endpoints with curl FIRST**
2. **Recording URLs**: Construct full URL from relative path
3. **Pagination**: Server-side pagination (20 per page default)
4. **RBAC**: Employee cannot access call history
5. **Audio Format**: MP3 files from Twilio
6. **Date Formatting**: Use date-fns for consistent formatting
7. **Performance**: Virtualize table if >100 rows (use TanStack React Table)

---

**Sprint 4 Status**: Ready to Start (after Sprint 1 complete)
**Estimated Duration**: 1 week
