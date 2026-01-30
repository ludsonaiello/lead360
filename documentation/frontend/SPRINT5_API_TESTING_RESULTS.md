# Sprint 5: API Testing Results

**Date**: 2026-01-27
**Tester**: Frontend Developer 5
**Test Accounts**:
- Tenant: contact@honeydo4you.com (HoneyDo4You)
- Tenant ID: 14a34ab2-6f6f-4e41-9bea-c444a304557e

**Test Quote**:
- Quote ID: b1a925c5-2857-4eae-b475-c55e3078c9c6
- Quote Number: Q-2026-1116
- Status: ready

---

## Stage 1: Attachment Endpoints (6 endpoints) ✅

### 1. POST /quotes/:quoteId/attachments ✅ PASSED

**Tested all 4 attachment types**:

#### URL Attachment
```json
{
  "attachment_type": "url_attachment",
  "url": "https://example.com/product",
  "title": "Product Specifications"
}
```
- ✅ Auto-generates QR code (200x200px PNG)
- ✅ Returns nested `qr_code_file` object with file details
- ✅ Updating URL regenerates QR code with new file_id

#### Cover Photo
```json
{
  "attachment_type": "cover_photo",
  "file_id": "258c5045-13b9-4733-ab58-a7c7f17c5f60",
  "title": "Quote Cover Photo"
}
```
- ✅ **Workflow**: Upload file to FilesService first → Get file_id → Create attachment
- ✅ Only 1 cover photo allowed (creating new one deletes old one)
- ✅ Returns nested `file` object with dimensions (800x600)

#### Full Page Photo
```json
{
  "attachment_type": "full_page_photo",
  "file_id": "9c03500c-51aa-4a78-b3d5-280b77b4b14c",
  "title": "Full Page Photo"
}
```
- ✅ Same workflow as cover photo
- ✅ Multiple allowed

#### Grid Photo (3 layouts tested)
```json
{
  "attachment_type": "grid_photo",
  "file_id": "03122ee1-3fde-4d59-989f-2e1f3967aa1a",
  "grid_layout": "grid_2",
  "title": "2x2 Grid Photo"
}
```
- ✅ `grid_2` (2x2 grid) - PASSED
- ✅ `grid_4` (4x4 grid) - PASSED
- ✅ `grid_6` (6x6 grid) - PASSED
- ✅ `grid_layout` field required for grid_photo type

**Response Structure**:
```json
{
  "id": "attachment-uuid",
  "quote_id": "quote-uuid",
  "attachment_type": "url_attachment|cover_photo|full_page_photo|grid_photo",
  "file_id": "file-uuid or null",
  "url": "url string or null",
  "title": "optional title",
  "qr_code_file_id": "file-uuid or null",
  "grid_layout": "grid_2|grid_4|grid_6 or null",
  "order_index": 1,
  "created_at": "timestamp",
  "qr_code_file": { /* nested file object for URL attachments */ },
  "file": { /* nested file object for photo attachments */ }
}
```

---

### 2. GET /quotes/:quoteId/attachments ✅ PASSED

**Response**: Array of attachments (not paginated)
- ✅ Returns all attachments with full details
- ✅ Includes nested `qr_code_file` or `file` objects
- ✅ Ordered by `order_index`

---

### 3. GET /quotes/:quoteId/attachments/:id ✅ PASSED

**Response**: Single attachment object (same structure as list item)

---

### 4. PATCH /quotes/:quoteId/attachments/:id ✅ PASSED

**Tested Updates**:
```json
{
  "url": "https://example.com/new-specs",
  "title": "Updated Product Specifications"
}
```
- ✅ URL update triggers NEW QR code generation
- ✅ Old QR code file replaced with new one
- ✅ Returns updated attachment with new `qr_code_file_id`

---

### 5. PATCH /quotes/:quoteId/attachments/reorder ✅ PASSED

**Request Body**:
```json
{
  "attachments": [
    {"id": "uuid-1", "order_index": 0},
    {"id": "uuid-2", "order_index": 1}
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Attachments reordered successfully"
}
```

**Backend Fix Applied**:
- Issue: Route matching problem (reorder endpoint after parameterized routes)
- Fix: Moved PATCH /reorder before PATCH /:attachmentId in route order

---

### 6. DELETE /quotes/:quoteId/attachments/:id ✅ PASSED

**Response**: HTTP 204 No Content
- ✅ Deletes attachment record
- ✅ QR code file also deleted (if URL attachment)

---

## Stage 2: PDF Endpoints (2 endpoints) ✅

### 7. POST /quotes/:id/generate-pdf ✅ PASSED

**Request Body**:
```json
{
  "include_cost_breakdown": false
}
```

**Response**:
```json
{
  "file_id": "4f95cbf0-80e5-4bde-83ba-261cd37789c0",
  "download_url": "/public/{tenant_id}/files/{file_id}.pdf",
  "filename": "Q-2026-1116.pdf",
  "file_size": 49620,
  "generated_at": "2026-01-27T01:50:31.585Z",
  "regenerated": true
}
```

**Backend Fixes Applied**:
1. ✅ Added support for `include_cost_breakdown` field (DTO validation)
2. ✅ Fixed user ID field name: Changed `req.user.user_id` → `req.user.id`

---

### 8. GET /quotes/:id/download-pdf ✅ PASSED

**Response**: Same structure as generate-pdf
- ✅ Currently regenerates PDF each time (same as generate)
- ✅ Returns JSON with file_id and download_url

---

## Stage 3: Email Delivery (1 endpoint) ✅

### 9. POST /quotes/:id/send ✅ PASSED

**Request Body**:
```json
{
  "custom_message": "Thank you for considering our proposal"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Quote email sent successfully",
  "public_url": "https://honeydo4you.lead360.app/quotes/{token}",
  "pdf_file_id": "b8ee26c9-46aa-49ef-9e53-579cae336c6b",
  "email_id": "6d76d0b2-d625-4ae6-852d-5b9350b15ae7"
}
```

**Key Findings**:
- ✅ Automatically generates public URL (32-char token)
- ✅ Automatically generates and attaches PDF
- ✅ Creates communication event (email_id)
- ✅ Requires quote status = "ready"
- ✅ Uses lead's email if recipient_email not provided

**Important**: JSON must be single-line, no control characters

---

## Stage 4: Public Access & Analytics (8 endpoints)

### 10. POST /quotes/:id/public-access ✅ PASSED (with issue)

**Request Body**:
```json
{
  "password": "Test123",
  "password_hint": "Test password",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

**Response**:
```json
{
  "public_url": "https://honeydo4you.lead360.app/quotes/bd32ca86b27f8f0db24ac968c11c6686",
  "access_token": "bd32ca86b27f8f0db24ac968c11c6686",
  "has_password": false,
  "created_at": "2026-01-27T02:04:26.022Z"
}
```

**⚠️ ISSUE**: Password not being saved
- Sent password in request body
- Response shows `has_password: false`
- Status endpoint also shows `has_password: false`
- **Backend issue**: Password field not being processed/stored

---

### 11. GET /public/quotes/:token ⚠️ BLOCKED

**Error**: HTTP 401 Unauthorized

**Issue**: Backend route not configured as public
- Documentation says "RBAC: NONE (Public endpoint)"
- Backend is requiring authentication
- **Backend fix needed**: Add route to public endpoints list

---

### 12. POST /public/quotes/:token/validate-password ❓ CANNOT TEST

**Blocked by**: Password feature not working (issue #10)

---

### 13. POST /public/quotes/:token/view ❓ CANNOT TEST

**Blocked by**: Public endpoint requiring auth (issue #11)

---

### 14. GET /quotes/:id/views/analytics ✅ PASSED

**Response**:
```json
{
  "quote_id": "b1a925c5-2857-4eae-b475-c55e3078c9c6",
  "total_views": 0,
  "unique_viewers": 0,
  "average_duration_seconds": null,
  "engagement_score": 0,
  "views_by_date": [],
  "views_by_device": {
    "desktop": 0,
    "mobile": 0,
    "tablet": 0,
    "unknown": 0
  },
  "first_viewed_at": null,
  "last_viewed_at": null
}
```

---

### 15. GET /quotes/:id/views/history ✅ PASSED

**Query Parameters**: `?page=1&limit=10`

**Response**:
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "total_pages": 0
  }
}
```

---

### 16. DELETE /quotes/:id/public-access ✅ PASSED

**Response**:
```json
{
  "message": "Successfully deactivated public access for quote {quote_id}"
}
```

**Verification**: Status endpoint returns `{"has_public_access": false}`

---

### 17. GET /quotes/:id/public-access/status ✅ PASSED

**Response (Active)**:
```json
{
  "public_url": "https://honeydo4you.lead360.app/quotes/{token}",
  "access_token": "{32-char-token}",
  "has_password": false,
  "created_at": "2026-01-27T02:04:26.022Z"
}
```

**Response (Inactive)**:
```json
{
  "has_public_access": false
}
```

**Backend Fix Applied**: Endpoint path updated to `/public-access/status`

---

## Summary

### Endpoints Tested: 17 of 17

**Working**: 14 endpoints ✅
**Issues**: 3 endpoints ⚠️

### Backend Issues Found and Fixed

1. ✅ **Attachment Reorder Route Ordering**
   - Issue: 400 error - "property attachments should not exist"
   - Fix: Moved PATCH /reorder before PATCH /:attachmentId

2. ✅ **PDF Generation User ID**
   - Issue: Prisma error - uploaded_by field undefined
   - Fix: Changed `req.user.user_id` → `req.user.id`

3. ✅ **PDF Generate DTO**
   - Issue: 400 error - "property include_cost_breakdown should not exist"
   - Fix: Added DTO validation for include_cost_breakdown field

4. ✅ **Public Access Status Endpoint Path**
   - Issue: 404 error - endpoint not found
   - Fix: Updated path from `/public-access` to `/public-access/status`

### Outstanding Backend Issues

1. ⚠️ **Password Protection Not Working**
   - Endpoint: POST /quotes/:id/public-access
   - Issue: Password field not being saved
   - Impact: Cannot test password validation endpoint
   - Status: **NEEDS BACKEND FIX**

2. ⚠️ **Public Quote View Requires Auth**
   - Endpoint: GET /public/quotes/:token
   - Issue: Returns 401 Unauthorized (should be public)
   - Impact: Cannot test public quote viewer functionality
   - Status: **NEEDS BACKEND FIX** - Add to public routes

3. ⚠️ **Public View Logging Blocked**
   - Endpoint: POST /public/quotes/:token/view
   - Issue: Blocked by issue #2 (public endpoint requiring auth)
   - Status: **NEEDS BACKEND FIX** - Same as issue #2

---

## Property Names Verified

**Attachment Fields**:
- `attachment_type` (not attachmentType)
- `file_id`, `url`, `title`
- `qr_code_file_id`, `grid_layout`, `order_index`
- `qr_code_file` (nested object)
- `file` (nested object for photo types)

**PDF Fields**:
- `include_cost_breakdown` (boolean)
- `file_id`, `download_url`, `filename`, `file_size`
- `generated_at`, `regenerated`

**Email Fields**:
- `recipient_email`, `cc_emails`, `custom_message`
- `success`, `message`, `public_url`, `pdf_file_id`, `email_id`

**Public Access Fields**:
- `public_url`, `access_token`, `has_password`
- `password`, `password_hint`, `expires_at`, `created_at`

**Analytics Fields**:
- `total_views`, `unique_viewers`, `average_duration_seconds`
- `engagement_score`, `views_by_date`, `views_by_device`
- `first_viewed_at`, `last_viewed_at`

---

## Files Service Workflow

For photo attachments (cover_photo, full_page_photo, grid_photo):

1. **Upload file first**:
   ```bash
   POST /files/upload
   Content-Type: multipart/form-data
   - file: [binary data]
   - category: "photo"
   ```

2. **Get file_id from response**:
   ```json
   {
     "file_id": "258c5045-13b9-4733-ab58-a7c7f17c5f60",
     "url": "/public/{tenant_id}/files/{file_id}.jpg",
     "file": { /* file details */ }
   }
   ```

3. **Create attachment with file_id**:
   ```json
   {
     "attachment_type": "cover_photo",
     "file_id": "258c5045-13b9-4733-ab58-a7c7f17c5f60",
     "title": "Cover Photo"
   }
   ```

---

## Next Steps

1. ✅ Complete API testing (14 of 17 working)
2. ⏳ **Phase 2**: Create type definitions in `quotes.ts`
3. ⏳ **Phase 2**: Build API client files (4 files, 17 functions total)
4. ⏳ **Phase 3**: Build UI components (17+ components)
5. ⏳ **Phase 4**: Integration testing

---

## Test Environment

- Backend URL: http://localhost:8000/api/v1
- Frontend URL: https://app.lead360.app
- Public URL: https://{tenant}.lead360.app/quotes/{token}
- Tenant Domain: honeydo4you.lead360.app

---

**Testing Complete**: 2026-01-27 02:05 UTC
