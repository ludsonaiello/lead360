# Sprint 5: Attachments, Email & PDF

**Agent**: Frontend Developer 5  
**Duration**: 7 days  
**Prerequisites**: Sprint 1-4 complete  
**Read First**: `QUOTE_FRONTEND_GLOBAL_INSTRUCTIONS.md`

---

## YOUR DOCUMENTATION

**API Sections to Read**:
- `api/documentation/quotes_REST_API.md` - Quote Attachments (6 endpoints)
- `api/documentation/quotes_REST_API.md` - Email Delivery (1 endpoint)
- `api/documentation/quotes_REST_API.md` - PDF Generation (2 endpoints)
- `api/documentation/quotes_REST_API.md` - Public Access & Analytics (8 endpoints)

Total: 17 endpoints

---

## YOUR MISSION

Build delivery and sharing features:
- Photo attachments (cover, full-page, grid layouts)
- URL attachments with QR codes
- Email quote delivery
- PDF generation
- Public quote links with password protection
- View analytics

---

## COMPONENTS TO BUILD

### Attachments

1. **Attachments Section** (on quote detail)
   - List all attachments in order
   - Display by type (cover photo, full-page, grid, URL)
   - Grid layouts show preview
   - QR codes display for URL attachments
   - Drag-and-drop reordering
   - Actions: edit, delete

2. **Add Attachment Modal/Form**
   - Attachment type selector (4 types - check API docs)
   - File upload (drag-and-drop)
   - Grid layout selector (2x2, 4x4, 6x6) for grid_photo type
   - URL input with QR code preview for url_attachment type
   - Caption field
   - Upload progress indicator

3. **Photo Upload**
   - Drag-and-drop zone
   - File preview
   - Validate file type (images only)
   - Upload progress
   - Integration with FilesService (API handles)

4. **QR Code Display**
   - Auto-generated for URL attachments
   - Display QR code image
   - URL preview

### Email & PDF

5. **Send Quote Modal**
   - Recipient email field
   - CC field (optional, multiple emails)
   - Custom message (textarea, max 1000 chars)
   - "Attach PDF" checkbox (default checked)
   - Preview public URL option
   - Send button with loading state

6. **PDF Actions**
   - "Generate PDF" button
   - PDF preview modal
   - Download PDF button
   - Loading states during generation

### Public Access

7. **Public URL Generator Modal**
   - Generate public link button
   - Password option (optional)
   - Expiration days (default 30)
   - Copy link button
   - Deactivate link button

8. **Public Quote Viewer** (`/public/quotes/:token`)
   - NO authentication required
   - Clean, branded layout
   - Display quote details
   - Display items and totals
   - Display attachments
   - Password prompt if protected
   - "Accept Quote" button (if enabled)
   - View tracking (automatic via API)

9. **View Analytics Dashboard** (on quote detail)
   - Total views count
   - Unique viewers count
   - View history timeline
   - Geographic data (if available)
   - Device types
   - Chart visualization

---

## KEY REQUIREMENTS

### Attachment Types
Read API documentation for 4 attachment types:
1. cover_photo - Single cover image (limit 1 per quote)
2. full_page_photo - Full page photo
3. grid_photo - Grid layout (2x2, 4x4, or 6x6)
4. url_attachment - URL with auto-generated QR code

Each type has specific validation rules.

### Cover Photo Rule
API enforces: Only 1 cover photo per quote
- Creating new cover photo deletes old one
- UI should warn user when replacing

### Grid Layouts
Three grid options (from API):
- grid_2: 2x2 grid
- grid_4: 4x4 grid  
- grid_6: 6x6 grid

Show visual selector for user to choose.

### QR Code Generation
API automatically generates QR code for url_attachment type:
- UI displays generated QR code
- QR code links to provided URL
- Cannot manually upload QR code

### Email Delivery
Check API documentation for:
- Template used
- PDF attachment behavior
- Public URL generation
- Communication event tracking
- Status change (ready → sent)

### Public URL Rules
From API documentation:
- Default expiry: 30 days
- Optional password protection
- Tracks views automatically
- Can be deactivated
- Anonymous access (no auth)

### View Analytics
API provides:
- View count
- View timestamps
- Viewer metadata (if available)
- Geographic info
- Device info

Display in chart/timeline format.

---

## TESTING CHECKLIST

Test with both accounts:
- [ ] Upload cover photo
- [ ] Replace cover photo (verify old deleted)
- [ ] Upload full-page photo
- [ ] Upload multiple photos for grid
- [ ] Select grid layout (2x2, 4x4, 6x6)
- [ ] Add URL attachment (verify QR code generated)
- [ ] Reorder attachments
- [ ] Delete attachment
- [ ] Edit attachment caption
- [ ] Send email with PDF
- [ ] Send email with CC recipients
- [ ] Send email with custom message
- [ ] Generate PDF
- [ ] Download PDF
- [ ] Preview PDF
- [ ] Generate public URL
- [ ] Generate public URL with password
- [ ] Copy public link
- [ ] View public quote (in incognito browser)
- [ ] Enter password on protected public quote
- [ ] Deactivate public URL
- [ ] View analytics dashboard
- [ ] Test view tracking (verify views increment)

---

## COMPLETION CRITERIA

Sprint 5 complete when:
- All 17 endpoints have working UI
- Photo upload works (all types)
- Grid layouts display correctly
- QR codes generate and display
- Email sending functional
- PDF generation works
- Public URL generation works
- Public viewer page functional (no auth)
- Password protection works
- View analytics displays
- All endpoints tested with both accounts
- File uploads handle errors gracefully

---

**Next Sprint**: Developer 6 builds dashboard, search, tags, and warranty tiers.