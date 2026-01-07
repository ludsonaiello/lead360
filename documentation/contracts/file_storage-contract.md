# Feature Contract: File Storage

**Feature Name**: File Storage  
**Module**: Media & Documents  
**Sprint**: Sprint 0 - Platform Foundation  
**Status**: Draft

---

## Purpose

**What problem does this solve?**

Provides centralized file management for all tenant assets and documents (logos, signatures, receipts, permits, project photos, etc.) with support for local storage (current) and future migration to S3-compatible services.

**Who is this for?**

- **Primary Users**: All tenant users (upload files based on module permissions)
- **Admins**: View and manage all files in file gallery
- **Platform Admin**: View files across all tenants
- **Use Cases**: 
  - Upload business logo and manage branding
  - Upload signatures for quotes
  - Attach before/after photos to quotes
  - Upload receipts for expenses
  - Store permits and inspection reports for projects
  - Upload progress photos for projects
  - Store material quotes from suppliers

---

## Scope

### **In Scope**

- ✅ Local file storage (`app/uploads/public/{tenant_id}/files` and `/images`)
- ✅ S3-compatible interface (ready for AWS S3, DigitalOcean Spaces, Cloudflare R2)
- ✅ Admin-configurable storage settings (local vs remote with credentials)
- ✅ Image optimization (convert all to WebP)
- ✅ Thumbnail generation (images + PDF first page)
- ✅ File categories (logo, signature, receipt, permit, inspection, material_quote, project_photo, quote_image, etc.)
- ✅ File relationships (track which entity owns the file)
- ✅ File gallery (grid + list views)
- ✅ Advanced filtering (by entity, category, date, tenant)
- ✅ Bulk download (ZIP all files for project/quote)
- ✅ Share links (send file to customer without login)
- ✅ MIME type validation (PDF, DOC/DOCX, images only)
- ✅ File size limits (per category)
- ✅ Audit logging (all file operations)
- ✅ Integration with existing business settings upload
- ✅ Soft delete with retention period

### **Out of Scope**

- ❌ File versioning (update = replace, delete = hard delete)
- ❌ Complex permission matrix (module-level permissions only)
- ❌ Virus scanning (not needed, server doesn't execute files)
- ❌ Watermarking (not necessary)
- ❌ OCR text extraction (handled in Financial module - MUST DO later)
- ❌ Video file support (images and PDFs only for now)
- ❌ Real-time collaborative editing (Phase 2)
- ❌ File comments/annotations (Phase 2)

---

## Dependencies

### **Requires (must be complete first)**

- [x] Authentication module (user tracking)
- [x] Tenant module (tenant isolation)
- [x] RBAC module (gallery access permissions)
- [x] Audit Log module (log all file operations)

### **Blocks (must complete before)**

- Quotes module (quote images)
- Projects module (project photos, permits)
- Invoices module (invoice attachments)
- Expenses module (receipt uploads)

---

## Data Model

### **Tables Required**

1. **file** - Main file metadata table
2. **file_share_link** - Temporary share links for customer access
3. **storage_config** - Storage provider configuration (Platform Admin managed)

---

## File Categories

**Supported File Categories**:

| Category | Description | Max Size | Used By |
|----------|-------------|----------|---------|
| logo | Business logo | 5MB | Tenant (business settings) |
| user_photo | User profile photo | 2MB | User (profile settings) |
| signature | User signature | 500KB | User (estimators) |
| quote_image | Before/after photos for quotes | 10MB | Quote (multiple per quote) |
| project_photo | Project progress photos | 10MB | Project (multiple per project) |
| receipt | Financial receipts (PDF or photo) | 10MB | Expense (multiple per expense) |
| permit | Building permits (PDF) | 20MB | Project (multiple per project) |
| inspection_report | Inspection reports (PDF) | 20MB | Project (multiple per project) |
| material_quote | Supplier quotes (PDF) | 20MB | Quote/Project (multiple) |
| invoice_attachment | Invoice attachments | 10MB | Invoice (multiple per invoice) |
| other | Miscellaneous files | 10MB | Any entity |

---

## File Relationships

**Track What File Belongs To**:

Every file is linked to an entity:

| Entity Type | Example | File Categories |
|-------------|---------|-----------------|
| tenant | Business profile | logo |
| user | User account | user_photo, signature |
| quote | Quote #123 | quote_image, material_quote |
| project | Project #456 | project_photo, permit, inspection_report, material_quote |
| invoice | Invoice #789 | invoice_attachment |
| expense | Expense #101 | receipt |

**Database Fields**:
- `related_entity_type` (enum: tenant, user, quote, project, invoice, expense)
- `related_entity_id` (UUID of the entity)
- `file_category` (enum from table above)

**Benefits**:
- "Show all files for Project #123" → Filter by `related_entity_type=project AND related_entity_id=project_123`
- "Show all receipts" → Filter by `file_category=receipt`
- "Show all photos for Quote #456" → Filter by `related_entity_type=quote AND related_entity_id=quote_456 AND file_category IN (quote_image)`

---

## Storage Architecture

### **Current Setup (Local Storage)**

**Path Structure**:
```
app/uploads/public/
├── {tenant_id}/
│   ├── images/          (logos, photos)
│   │   ├── original/
│   │   │   └── {uuid}.webp
│   │   └── thumbnails/
│   │       └── {uuid}.webp
│   └── files/           (PDFs, documents)
│       ├── original/
│       │   └── {uuid}.pdf
│       └── thumbnails/
│           └── {uuid}.jpg  (PDF first page)
```

**Served by Nginx**: `app/uploads/public` is publicly accessible

**URL Pattern**: `https://your-domain.com/uploads/public/{tenant_id}/images/original/{uuid}.webp`

---

### **Future Setup (S3-Compatible)**

**When migrated to S3**:
```
s3://bucket-name/
├── {tenant_id}/
│   ├── images/
│   │   ├── original/{uuid}.webp
│   │   └── thumbnails/{uuid}.webp
│   └── files/
│       ├── original/{uuid}.pdf
│       └── thumbnails/{uuid}.jpg
```

**Access**: Via presigned URLs (temporary, secure)

---

### **Storage Provider Configuration**

**Admin Settings** (Platform Admin only):

| Setting | Local Value | S3 Value |
|---------|-------------|----------|
| storage_provider | local | s3 / spaces / r2 |
| base_path | app/uploads/public | (null) |
| bucket_name | (null) | my-bucket |
| region | (null) | us-east-1 |
| endpoint | (null) | https://s3.amazonaws.com |
| access_key | (null) | AKIAIOSFODNN7EXAMPLE |
| secret_key | (null) | wJalrXUtnFEMI/K7MDENG/... |
| public_url_base | https://domain.com/uploads/public | https://cdn.domain.com |

**Abstraction Layer**: Backend uses `StorageService` interface:
- `StorageService.upload(file, path)` → Works with local OR S3
- `StorageService.download(path)` → Works with local OR S3
- `StorageService.delete(path)` → Works with local OR S3
- `StorageService.getPublicUrl(path)` → Returns URL (local or presigned)

**Benefits**:
- Switch from local to S3 without code changes
- Just update admin settings
- Test locally with local storage
- Deploy with S3 in production

---

## File Operations

### **Upload Flow**

**1. User uploads file via frontend**:
- Frontend validates: File type, size
- Calls API: POST /files/upload

**2. Backend validates and processes**:
- Validate MIME type (PDF, DOC/DOCX, PNG, JPG, JPEG, WEBP, HEIC)
- Validate file size (per category limits)
- Generate UUID filename
- If image:
  - Convert HEIC to JPG (if needed)
  - Convert to WebP (optimized quality 85%)
  - Generate thumbnail (200x200, WebP)
  - Strip EXIF data
- If PDF:
  - Generate thumbnail from first page (200x200, JPG)
- Store files:
  - Local: Save to `app/uploads/public/{tenant_id}/{type}/original/{uuid}.webp`
  - S3: Upload to `{tenant_id}/{type}/original/{uuid}.webp`
- Create database record
- Audit log: "File uploaded"
- Return file metadata

**3. Frontend receives file record**:
- Display thumbnail in UI
- Store file_id for entity association

---

### **Download Flow**

**1. User clicks download**:
- Calls API: GET /files/:id/download

**2. Backend validates and serves**:
- Check user has access (same tenant OR Platform Admin)
- If local: Return file stream or redirect to Nginx public URL
- If S3: Generate presigned URL (expires in 5 minutes)
- Audit log: "File downloaded"
- Return file or URL

---

### **Delete Flow**

**1. User deletes file**:
- Calls API: DELETE /files/:id

**2. Backend soft deletes**:
- Set `deleted_at = NOW()`
- Audit log: "File deleted"
- Return success

**3. Background job (nightly)**:
- Find files deleted >90 days ago
- Hard delete from disk/S3
- Hard delete database record
- Audit log: "File permanently deleted"

---

## Permissions

**Simplified Permission Model**:

### **Upload Permissions**

**Handled at module level** (not in file storage):
- Can edit quote → Can upload quote images
- Can manage project → Can upload project photos
- Can manage expenses → Can upload receipts
- Can edit business settings → Can upload logo

**File Storage module does NOT enforce upload permissions**. It trusts that the calling module has already validated the user's permission.

---

### **Gallery Access**

**Who can access file gallery**:
- Owner: Yes
- Admin: Yes
- Bookkeeper: Yes
- Estimator: No
- Project Manager: No
- Employee: No
- Read-only: No

**Permission Check**: `canPerform('files', 'view_gallery')`

**If user can access gallery**: They see ALL files (no further filtering by role)

**Rationale**: If Owner trusts Bookkeeper with gallery access, Bookkeeper sees everything. Simple and clear.

---

### **Individual File Access** (Download)

**Anyone in the same tenant can download any file** (if they know the file_id).

**Platform Admin**: Can download any file across all tenants.

**No role-based filtering on individual files**. Gallery access is the only permission gate.

---

## File Gallery

### **Gallery Filters**

**Available Filters**:

1. **Entity Type**:
   - All
   - Projects
   - Quotes
   - Invoices
   - Expenses
   - Business (tenant files)
   - Users

2. **Entity** (Dropdown):
   - If "Projects" selected: Show project dropdown
   - If "Quotes" selected: Show quote dropdown
   - etc.

3. **File Category**:
   - All
   - Logos
   - Signatures
   - Photos
   - Receipts
   - Permits
   - Inspection Reports
   - Material Quotes
   - Invoices
   - Other

4. **Date Range**:
   - All Time
   - Today
   - Last 7 Days
   - Last 30 Days
   - Custom Range

5. **File Type**:
   - All
   - Images
   - PDFs
   - Documents (DOC/DOCX)

6. **Search**:
   - Search by original filename

**Filter Examples**:
- "Show all photos for Project #123" → Entity Type: Projects, Entity: Project #123, Category: Photos
- "Show all receipts from last month" → Category: Receipts, Date Range: Last 30 Days
- "Show all PDFs" → File Type: PDFs

---

### **Gallery Views**

**Grid View** (Default):
```
┌─────────────────────────────────────────────────────────────┐
│ [Filters] [Search] [View: Grid ● | List ○]  [Upload] [Bulk] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐       │
│ │ IMG │  │ IMG │  │ PDF │  │ IMG │  │ IMG │  │ PDF │       │
│ │     │  │     │  │     │  │     │  │     │  │     │       │
│ └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘       │
│ File 1   File 2   File 3   File 4   File 5   File 6        │
│ 1.2 MB   800 KB   2.5 MB   1.8 MB   3.1 MB   5.2 MB        │
│                                                              │
│ ┌─────┐  ┌─────┐  ┌─────┐  ...                             │
│ │ IMG │  │ PDF │  │ IMG │                                   │
│ └─────┘  └─────┘  └─────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Thumbnail preview
- Filename (truncated)
- File size
- Hover: Show full filename, upload date, category
- Click: Open detail modal
- Checkbox: Multi-select for bulk operations
- Responsive: 6 columns (desktop) → 3 columns (tablet) → 2 columns (mobile)

---

**List View**:
```
┌─────────────────────────────────────────────────────────────┐
│ [☐] Thumbnail | Filename | Category | Entity | Size | Date  │
├─────────────────────────────────────────────────────────────┤
│ [☐] [IMG] logo.png        Logo    Business  1.2 MB  Jan 5   │
│ [☐] [PDF] permit.pdf      Permit  Project#1 2.5 MB  Jan 4   │
│ [☐] [IMG] receipt.jpg     Receipt Expense#2 800 KB  Jan 3   │
│ [☐] [IMG] before.jpg      Photo   Quote#3   1.8 MB  Jan 2   │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Sortable columns (filename, size, date)
- Multi-select checkboxes
- Click row: Open detail modal
- More compact than grid (see more files at once)

---

### **File Detail Modal**

**Click file in gallery → Modal opens**:

```
┌─────────────────────────────────────────────────────────────┐
│ [Close X]                                                    │
│                                                              │
│ [Large Thumbnail or PDF Preview]                            │
│                                                              │
│ Filename: before-painting.jpg                               │
│ Category: Project Photo                                     │
│ Entity: Project #123 - ABC Painting Job                     │
│ Uploaded by: John Doe                                       │
│ Uploaded at: January 5, 2025 at 10:30 AM                    │
│ File size: 1.8 MB (original: 4.2 MB)                        │
│ File type: Image (WebP)                                     │
│                                                              │
│ [Download Original] [Share Link] [Delete]                   │
└─────────────────────────────────────────────────────────────┘
```

**Actions**:
- **Download Original**: Download full-size file
- **Share Link**: Generate temporary share link (opens modal)
- **Delete**: Soft delete file (confirmation modal)

---

### **Bulk Operations**

**Select multiple files → Bulk actions menu appears**:

```
[X selected: 5 files] [Download ZIP] [Delete Selected] [Cancel]
```

**Download ZIP**:
1. User selects 5 files
2. Clicks "Download ZIP"
3. Backend queues background job
4. Job creates ZIP file: `files-{timestamp}.zip`
5. Job stores ZIP temporarily (expires in 24 hours)
6. User receives download link
7. User downloads ZIP
8. After 24 hours: ZIP auto-deleted

**Delete Selected**:
1. User selects 5 files
2. Clicks "Delete Selected"
3. Confirmation modal: "Delete 5 files? This cannot be undone."
4. User confirms
5. All 5 files soft deleted
6. Audit log: 5 entries (one per file)
7. Success toast: "5 files deleted"

---

## Share Links

**Purpose**: Send file to customer without requiring login

**Use Case**:
- Send material quote to customer
- Share inspection report with insurance
- Send permit to subcontractor

---

### **View vs Download Tracking**

Share links track two separate metrics to distinguish between viewing/previewing files and actually downloading them:

**View Count** (`view_count`):
- Incremented via `POST /public/share/:token/access`
- Used when user wants to preview file info or check file details
- Does NOT count toward `max_downloads` limit
- Unlimited views allowed (even after max_downloads is reached)
- Use case: Customer previews file before downloading

**Download Count** (`download_count`):
- Incremented via `POST /public/share/:token/download`
- Used when user actually downloads the file
- DOES count toward `max_downloads` limit (if set)
- Use case: Customer downloads file to their device

**Why Separate Tracking?**
- Prevents unfair penalties: Viewing file info shouldn't consume download quota
- Better analytics: Know how many people viewed vs downloaded
- User experience: Allow unlimited previews while limiting actual downloads

**Example Workflow**:
1. Customer receives share link
2. Customer clicks link → Frontend calls `/access` endpoint (view_count: 1, download_count: 0)
3. Customer previews file info
4. Customer clicks "Download" button → Frontend calls `/download` endpoint (view_count: 1, download_count: 1)
5. Customer shares link with colleague
6. Colleague clicks link → Frontend calls `/access` endpoint (view_count: 2, download_count: 1)
7. If `max_downloads: 1`, colleague can still view but cannot download

---

### **Share Link Creation Flow**

1. User clicks "Share Link" on file
2. Modal opens:
   ```
   ┌─────────────────────────────────────────────┐
   │ Share File: permit.pdf                      │
   │                                             │
   │ Link expires in:                            │
   │ ○ 1 day                                     │
   │ ○ 7 days (default)                          │
   │ ○ 30 days                                   │
   │                                             │
   │ Password protect (optional):                │
   │ [Password input]                            │
   │                                             │
   │ Max downloads (optional):                   │
   │ [Number input]                              │
   │                                             │
   │ [Cancel] [Generate Link]                    │
   └─────────────────────────────────────────────┘
   ```

3. Backend generates share link:
   - Create unique token (UUID)
   - Store in `file_share_link` table
   - Set expiry date
   - Hash password if provided
   - Return link: `https://domain.com/shared/files/{token}`

4. User copies link and sends to customer

5. Customer clicks link:
   - If password protected: Prompt for password
   - If max downloads reached: Show error
   - If expired: Show error
   - Otherwise: Download file
   - Increment access count
   - Audit log: "File accessed via share link"

**Share Link Management**:
- View active share links for file
- Revoke share link (soft delete)
- See access count per link

---

## API Specification

### **Endpoints Overview**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | /files/upload | Upload file | Yes | All |
| GET | /files | List files (gallery) | Yes | files:view_gallery |
| GET | /files/:id | Get file metadata | Yes | Same tenant |
| GET | /files/:id/download | Download file | Yes | Same tenant |
| DELETE | /files/:id | Delete file | Yes | Owner, Admin |
| POST | /files/:id/share | Generate share link | Yes | Owner, Admin |
| POST | /public/share/:token/access | View share link (increments view_count) | No | Public |
| POST | /public/share/:token/download | Download via share link (increments download_count) | No | Public |
| POST | /files/bulk/download | Bulk download (ZIP) | Yes | files:view_gallery |
| DELETE | /files/bulk/delete | Bulk delete | Yes | Owner, Admin |

---

### **Endpoint Details**

#### **1. Upload File**

**POST** `/files/upload`

**Purpose**: Upload file and create metadata record

**Request**: Multipart form data
- `file` (file, required)
- `related_entity_type` (string, required - tenant, user, quote, project, invoice, expense)
- `related_entity_id` (UUID, required)
- `file_category` (string, required - logo, signature, receipt, etc.)
- `custom_tags` (JSON array, optional - ["exterior", "before"])

**Success Response (201)**:
```json
{
  "id": "uuid",
  "original_filename": "before-painting.jpg",
  "stored_filename": "uuid.webp",
  "file_category": "project_photo",
  "related_entity_type": "project",
  "related_entity_id": "project_uuid",
  "mime_type": "image/webp",
  "file_size": 1843200,
  "original_size": 4200000,
  "thumbnail_url": "/uploads/public/{tenant_id}/images/thumbnails/uuid.webp",
  "original_url": "/uploads/public/{tenant_id}/images/original/uuid.webp",
  "uploaded_at": "2025-01-05T10:30:00Z"
}
```

**Business Logic**:
1. Validate file type (MIME type check)
2. Validate file size (per category limit)
3. Generate UUID filename
4. Process file:
   - Images: Convert to WebP, generate thumbnail
   - PDFs: Generate thumbnail from first page
   - HEIC: Convert to JPG first, then WebP
5. Store files (local or S3 based on config)
6. Create database record
7. Audit log: "File uploaded"
8. Return metadata

**Error Responses**:
- 400: Invalid file type
- 400: File size exceeds limit
- 413: Payload too large

---

#### **2. List Files (Gallery)**

**GET** `/files`

**Purpose**: Get paginated list of files with filters

**Query Parameters**:
- `page` (integer, default: 1)
- `limit` (integer, default: 50, max: 200)
- `entity_type` (tenant, user, quote, project, invoice, expense)
- `entity_id` (UUID)
- `file_category` (logo, signature, receipt, etc.)
- `file_type` (image, pdf, document)
- `start_date` (ISO date)
- `end_date` (ISO date)
- `search` (search filename)
- `sort_by` (uploaded_at, file_size, filename)
- `sort_order` (asc, desc)

**Success Response (200)**:
```json
{
  "files": [
    {
      "id": "uuid",
      "original_filename": "logo.png",
      "file_category": "logo",
      "related_entity_type": "tenant",
      "related_entity_id": "tenant_uuid",
      "entity_name": "ABC Painting",
      "mime_type": "image/webp",
      "file_size": 1200000,
      "thumbnail_url": "/uploads/public/{tenant_id}/images/thumbnails/uuid.webp",
      "uploaded_by_name": "John Doe",
      "uploaded_at": "2025-01-05T10:30:00Z"
    },
    // ... more files
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 10,
    "total_count": 487,
    "limit": 50
  }
}
```

**Business Logic**:
- Tenant users: Only see files for their tenant
- Platform Admin: Can see all files (add tenant filter)
- Apply all filters
- Return paginated results

---

#### **3. Download File**

**GET** `/files/:id/download`

**Purpose**: Download file or get presigned URL

**Success Response (200)**:
- **Local**: File stream or redirect to Nginx URL
- **S3**: JSON with presigned URL
  ```json
  {
    "url": "https://s3.amazonaws.com/bucket/path?signature=...",
    "expires_at": "2025-01-05T10:35:00Z"
  }
  ```

**Business Logic**:
1. Validate user has access (same tenant OR Platform Admin)
2. If local: Stream file or redirect
3. If S3: Generate presigned URL (5 min expiry)
4. Audit log: "File downloaded"
5. Return file or URL

---

#### **4. Generate Share Link**

**POST** `/files/:id/share`

**Purpose**: Create temporary share link for external access

**Request Body**:
```json
{
  "expires_in_days": 7,
  "password": "optional-password",
  "max_downloads": 10
}
```

**Success Response (201)**:
```json
{
  "token": "uuid",
  "share_url": "https://domain.com/shared/files/uuid",
  "expires_at": "2025-01-12T10:30:00Z",
  "password_protected": true,
  "max_downloads": 10,
  "download_count": 0,
  "view_count": 0
}
```

**Business Logic**:
1. Generate unique token (UUID)
2. Hash password if provided (bcrypt)
3. Create share link record
4. Audit log: "Share link created"
5. Return share URL

---

#### **5. Access Share Link (View File Info)**

**POST** `/public/share/:token/access`

**Purpose**: View shared file information without downloading (increments view_count, not download_count)

**Request Body**:
```json
{
  "password": "optional-password"
}
```

**Success Response (200)**:
```json
{
  "message": "Access granted",
  "file": {
    "file_id": "uuid",
    "original_filename": "permit.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 2500000,
    "url": "https://domain.com/uploads/public/{tenant_id}/files/original/uuid.pdf",
    "has_thumbnail": true,
    "width": null,
    "height": null
  },
  "share_info": {
    "view_count": 15,
    "download_count": 3,
    "max_downloads": 10,
    "expires_at": "2025-01-12T10:30:00Z"
  }
}
```

**Business Logic**:
1. Find share link by token
2. Check if active (if inactive: 400 Bad Request)
3. Check expiry (if expired: 400 Bad Request)
4. Check password (if protected and wrong: 401 Unauthorized)
5. **Increment view_count** (not download_count)
6. Update last_accessed_at
7. Return file info and share stats

**Error Responses**:
- 404: Invalid token
- 400: Link expired or revoked
- 401: Password required or invalid password

---

#### **6. Download via Share Link**

**POST** `/public/share/:token/download`

**Purpose**: Download shared file (increments download_count, enforces max_downloads limit)

**Request Body**:
```json
{
  "password": "optional-password"
}
```

**Success Response (200)**:
```json
{
  "message": "Download granted",
  "file": {
    "file_id": "uuid",
    "original_filename": "permit.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 2500000,
    "url": "https://domain.com/uploads/public/{tenant_id}/files/original/uuid.pdf",
    "has_thumbnail": true,
    "width": null,
    "height": null
  },
  "share_info": {
    "view_count": 15,
    "download_count": 4,
    "max_downloads": 10,
    "expires_at": "2025-01-12T10:30:00Z"
  }
}
```

**Business Logic**:
1. Find share link by token
2. Check if active (if inactive: 400 Bad Request)
3. Check expiry (if expired: 400 Bad Request)
4. **Check max_downloads limit** (if exceeded: 400 Bad Request)
5. Check password (if protected and wrong: 401 Unauthorized)
6. **Increment download_count**
7. Update last_accessed_at
8. Return file URL and share stats

**Error Responses**:
- 404: Invalid token
- 400: Link expired, revoked, or maximum downloads reached
- 401: Password required or invalid password

**Key Differences from Access Endpoint**:
- Increments `download_count` instead of `view_count`
- Enforces `max_downloads` limit (access endpoint does not)
- Intended for actual file downloads, not just previews

---

#### **7. Bulk Download (ZIP)**

**POST** `/files/bulk/download`

**Purpose**: Create ZIP of selected files

**Request Body**:
```json
{
  "file_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Success Response (202)**:
```json
{
  "job_id": "uuid",
  "status": "processing",
  "message": "ZIP file is being created. You will receive a download link shortly."
}
```

**Background Job**:
1. Create ZIP file
2. Store temporarily (expires 24 hours)
3. Notify user (or polling endpoint)
4. Return download URL

**Polling Endpoint**: GET /files/bulk/download/:job_id
- Returns status: processing / completed / failed
- If completed: Returns download URL

---

#### **8. Bulk Delete**

**DELETE** `/files/bulk/delete`

**Purpose**: Delete multiple files

**Request Body**:
```json
{
  "file_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Success Response (200)**:
```json
{
  "deleted_count": 3,
  "file_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Business Logic**:
1. Validate user can delete (Owner/Admin)
2. Soft delete all files
3. Audit log: One entry per file
4. Return count

---

## Integration with Existing Modules

### **Business Settings (Already Working)**

**Current Implementation**:
- Logo upload exists at `/settings/business` (branding tab)
- Uploads to `app/uploads/public/{tenant_id}/images/`

**File Storage Integration**:
- Keep existing upload UI working
- Update backend to create file record in `file` table
- Set `related_entity_type=tenant`, `file_category=logo`
- Return file metadata (including file_id)
- Store file_id in `tenant` table

**No Breaking Changes**: Existing logo upload continues to work, just adds database tracking.

---

### **User Signatures**

**New Feature** (doesn't exist yet):
- Add signature upload to user profile settings
- Upload signature image (PNG with transparent background)
- Store as `related_entity_type=user`, `file_category=signature`
- Used on quotes

---

### **Future Module Integration**

**Quotes Module**:
- Upload before/after photos
- API: POST /files/upload with `related_entity_type=quote`, `file_category=quote_image`
- Display photos on quote detail page
- Include in quote PDF sent to customer

**Projects Module**:
- Upload permits, inspection reports, progress photos
- Multiple categories: permit, inspection_report, project_photo
- Show in project detail page
- Filter gallery by project

**Expenses Module**:
- Upload receipt (PDF or photo)
- `related_entity_type=expense`, `file_category=receipt`
- OCR text extraction (in Financial module)

---

## Testing Requirements

### **Backend Tests**

**Unit Tests**:
- ✅ Upload file (local storage)
- ✅ Upload file (S3 storage)
- ✅ Convert HEIC to JPG
- ✅ Convert image to WebP
- ✅ Generate thumbnail (image)
- ✅ Generate thumbnail (PDF)
- ✅ Validate MIME type
- ✅ Validate file size
- ✅ Soft delete file
- ✅ Hard delete file (retention job)
- ✅ Generate share link
- ✅ Access via share link
- ✅ Share link expiry
- ✅ Share link max downloads
- ✅ Tenant isolation

**Integration Tests**:
- ✅ Upload → Process → Store → Create record
- ✅ List files with filters
- ✅ Download file
- ✅ Delete file
- ✅ Bulk download (ZIP)
- ✅ Bulk delete
- ✅ Audit log created on all operations

---

### **Frontend Tests**

**Component Tests**:
- ✅ FileUploader component
- ✅ FileGallery (grid view)
- ✅ FileGallery (list view)
- ✅ File filters
- ✅ FileDetailModal
- ✅ ShareLinkModal
- ✅ BulkActionsMenu

**Integration Tests**:
- ✅ Upload file
- ✅ View file gallery
- ✅ Apply filters
- ✅ Download file
- ✅ Generate share link
- ✅ Bulk download
- ✅ Bulk delete

---

## Acceptance Criteria

**Feature is complete when**:

### **Backend**
- [ ] file table created
- [ ] file_share_link table created
- [ ] storage_config table created
- [ ] StorageService interface (works with local + S3)
- [ ] Image optimization (WebP conversion)
- [ ] Thumbnail generation (images + PDFs)
- [ ] MIME type validation
- [ ] File size validation
- [ ] Upload API endpoint
- [ ] List/filter API endpoint
- [ ] Download API endpoint
- [ ] Share link generation
- [ ] Public share link download
- [ ] Bulk download (ZIP)
- [ ] Bulk delete
- [ ] Audit logging (all operations)
- [ ] Retention job (hard delete after 90 days)
- [ ] Integration with business settings (logo)
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] API documentation complete

### **Frontend**
- [ ] File gallery page (grid + list views)
- [ ] File filters (entity, category, date, type, search)
- [ ] File upload component
- [ ] File detail modal
- [ ] Share link modal
- [ ] Bulk actions (select, download ZIP, delete)
- [ ] Integration with business settings (logo upload)
- [ ] Loading states
- [ ] Error handling
- [ ] Component tests >70% coverage
- [ ] E2E tests passing

### **Integration**
- [ ] Business settings logo upload creates file record
- [ ] Files appear in gallery
- [ ] Filters work correctly
- [ ] Download works (local storage)
- [ ] Share links work
- [ ] Tenant isolation verified

---

## Timeline Estimate

**Backend Development**: 3-4 days
- Storage abstraction layer: 0.5 day
- Image optimization (WebP, thumbnails): 1 day
- API endpoints (upload, list, download, share): 1 day
- Bulk operations: 0.5 day
- Integration with business settings: 0.5 day
- Testing: 1 day

**Frontend Development**: 2-3 days
- File gallery (grid + list): 1 day
- File upload component: 0.5 day
- Filters and search: 0.5 day
- Share link modal: 0.5 day
- Bulk operations UI: 0.5 day
- Testing: 0.5 day

**Integration & Testing**: 0.5 day

**Total**: 5.5-7.5 days

---

## Notes

- **Keep existing upload working**: Business settings logo upload must continue functioning
- **S3-ready**: Code must support S3 migration without rewrite
- **No versioning**: Update = replace file, delete = hard delete
- **Simple permissions**: Gallery access = see all files
- **Audit everything**: All file operations logged
- **WebP conversion**: All images converted for optimization

---

**End of File Storage Contract**