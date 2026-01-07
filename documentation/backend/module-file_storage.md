# Backend Module: File Storage

**Module Name**: File Storage  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/file-storage-contract.md`  
**Agent**: Backend Specialist  
**Status**: Ready for Development

---

## Overview

This module implements centralized file storage with support for local storage (current) and S3-compatible providers (future). You will build an abstraction layer that works seamlessly with both storage types, plus image optimization, thumbnail generation, and comprehensive file management.

**Read First**:
- `/documentation/contracts/file-storage-contract.md` (complete file storage requirements)
- `/documentation/shared/security-rules.md` (security requirements)
- `/documentation/shared/api-conventions.md` (REST patterns)

---

## Database Tables Structure

### **Tables to Create**

1. **file** - File metadata and relationships
2. **file_share_link** - Temporary public share links
3. **storage_config** - Storage provider configuration (single row, Platform Admin managed)

---

## Table Design

### **file Table**

**Purpose**: Track all uploaded files with metadata and relationships

**Key Fields**:
- id (UUID, primary key)
- tenant_id (UUID, foreign key to tenant)
- uploaded_by_user_id (UUID, foreign key to user)
- original_filename (VARCHAR(255) - user's filename)
- stored_filename (VARCHAR(255) - UUID + extension on disk)
- file_category (ENUM: logo, user_photo, signature, quote_image, project_photo, receipt, permit, inspection_report, material_quote, invoice_attachment, other)
- related_entity_type (ENUM: tenant, user, quote, project, invoice, expense)
- related_entity_id (UUID - ID of related entity)
- mime_type (VARCHAR(100) - image/webp, application/pdf, etc.)
- file_size (BIGINT - bytes, optimized size)
- original_size (BIGINT - bytes, before optimization)
- storage_provider (ENUM: local, s3, spaces, r2 - which storage used)
- storage_path (TEXT - relative path: {tenant_id}/images/original/{uuid}.webp)
- variant (ENUM: original, thumbnail)
- original_file_id (UUID, foreign key to file - if this is thumbnail, points to original)
- custom_tags (JSONB - user-defined tags like ["exterior", "before"])
- metadata_json (JSONB - EXIF data, dimensions, etc.)
- uploaded_at (TIMESTAMP)
- deleted_at (TIMESTAMP, nullable - soft delete)
- created_at, updated_at

**Indexes**:
- Primary key on id
- Composite index: (tenant_id, deleted_at) - list tenant files
- Index: (related_entity_type, related_entity_id) - find files for entity
- Index: (file_category) - filter by category
- Index: (uploaded_at DESC) - sort by date
- Index: (original_file_id) - find thumbnails

**Business Rules**:
- stored_filename is UUID + original extension (uuid.webp, uuid.pdf)
- variant: "original" for main file, "thumbnail" for thumbnail
- Thumbnail has original_file_id pointing to original
- Soft delete (deleted_at)
- Hard delete after 90 days (background job)

---

### **file_share_link Table**

**Purpose**: Temporary public share links for external access

**Key Fields**:
- id (UUID, primary key)
- file_id (UUID, foreign key to file)
- token (UUID, unique - used in URL)
- created_by_user_id (UUID, foreign key to user)
- expires_at (TIMESTAMP)
- password_hash (TEXT, nullable - bcrypt hash if password protected)
- max_downloads (INTEGER, nullable - null = unlimited)
- access_count (INTEGER, default 0)
- created_at, updated_at

**Indexes**:
- Unique index on token
- Index: (file_id) - find links for file
- Index: (expires_at) - cleanup expired links

**Business Rules**:
- Token is UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)
- Share URL: https://domain.com/shared/files/{token}
- Increment access_count on each download
- If max_downloads reached: Deny access
- If expires_at passed: Deny access (410 Gone)

---

## Share Link Access Tracking

Share links track two separate metrics to differentiate between viewing file information and actually downloading files:

### View Count
- **Endpoint**: `POST /public/share/:token/access`
- **Purpose**: User previews file info, checks metadata, views thumbnail
- **Behavior**:
  - Increments `view_count` field
  - Does NOT increment `download_count`
  - Does NOT count toward `max_downloads` limit
  - Always allowed (even after max downloads reached)
- **Use Cases**:
  - User checks file size before downloading
  - User views file details
  - User previews thumbnail
  - Checking if link is still valid

### Download Count
- **Endpoint**: `POST /public/share/:token/download`
- **Purpose**: User actually downloads the file to their device
- **Behavior**:
  - Increments `download_count` field
  - Does NOT increment `view_count`
  - DOES count toward `max_downloads` limit (if set)
  - Blocked if `max_downloads` reached
- **Use Cases**:
  - User clicks download button
  - File is saved to user's device
  - Counts toward usage limits

### Password Protection
Both endpoints support password-protected links:
- Password sent in request body: `{ "password": "user-password" }`
- Returns 401 if password required but not provided
- Returns 401 if password is incorrect
- Password validation happens before counter increments

### Implementation Details

**Service Methods**:
```typescript
// View a file (increments view_count)
async viewShareLink(shareToken: string, dto: AccessShareLinkDto)

// Download a file (increments download_count, checks max_downloads)
async downloadShareLink(shareToken: string, dto: AccessShareLinkDto)

// Shared validation logic
private async validateShareLink(
  shareToken: string,
  password?: string,
  checkDownloadLimit: boolean = false
)
```

**Response Format**:
```json
{
  "message": "Access granted",
  "file": {
    "file_id": "abc123",
    "original_filename": "document.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 1024000,
    "url": "https://...",
    "has_thumbnail": true,
    "width": 1920,
    "height": 1080
  },
  "share_info": {
    "view_count": 15,
    "download_count": 3,
    "max_downloads": 5,
    "expires_at": "2026-01-15T00:00:00Z"
  }
}
```

**Why Separate Tracking?**
- **Analytics**: Understand user behavior (views vs actual downloads)
- **Fair Limits**: Don't penalize users for checking file details
- **Better UX**: Users can preview without wasting download quota
- **Security**: Track both metrics for audit purposes

---

### **storage_config Table**

**Purpose**: Storage provider configuration (single row)

**Key Fields**:
- id (UUID, primary key)
- storage_provider (ENUM: local, s3, spaces, r2)
- local_base_path (TEXT, nullable - e.g., "app/uploads/public")
- local_public_url_base (TEXT, nullable - e.g., "https://domain.com/uploads/public")
- s3_bucket_name (TEXT, nullable)
- s3_region (TEXT, nullable)
- s3_endpoint (TEXT, nullable - custom endpoint for Spaces/R2)
- s3_access_key (TEXT, nullable - encrypted)
- s3_secret_key (TEXT, nullable - encrypted)
- s3_public_url_base (TEXT, nullable - CDN URL)
- updated_at (TIMESTAMP)
- updated_by_user_id (UUID, foreign key to user)

**Seed Data** (Initial configuration):
```
storage_provider: local
local_base_path: app/uploads/public
local_public_url_base: https://yourdomain.com/uploads/public
(all S3 fields null)
```

**Business Rules**:
- Only one row exists (singleton pattern)
- Platform Admin updates via admin panel
- S3 keys encrypted at rest
- Changing provider requires data migration (manual process)

---

## NestJS Module Structure

**Directory**:
```
src/modules/files/
├── files.module.ts
├── files.controller.ts
├── files.service.ts
├── storage/
│   ├── storage.interface.ts
│   ├── local-storage.service.ts
│   ├── s3-storage.service.ts
│   └── storage.factory.ts
├── processors/
│   ├── image-optimizer.service.ts
│   ├── pdf-processor.service.ts
│   └── thumbnail-generator.service.ts
├── dto/
│   ├── upload-file.dto.ts
│   ├── file-query.dto.ts
│   ├── create-share-link.dto.ts
│   └── file-response.dto.ts
├── jobs/
│   ├── file-retention.job.ts
│   └── zip-creator.job.ts
└── files.service.spec.ts
```

---

## Storage Abstraction Layer

### **StorageInterface**

**Purpose**: Abstract storage operations to work with local OR S3

**Location**: `storage/storage.interface.ts`

**Methods**:
1. `upload(file: Buffer, path: string): Promise<string>` - Upload file, return storage path
2. `download(path: string): Promise<Buffer>` - Download file as buffer
3. `delete(path: string): Promise<void>` - Delete file
4. `getPublicUrl(path: string, expiresIn?: number): Promise<string>` - Get public URL
5. `exists(path: string): Promise<boolean>` - Check if file exists

---

### **LocalStorageService**

**Purpose**: Implement storage interface for local filesystem

**Location**: `storage/local-storage.service.ts`

**Implementation**:

1. **upload(file: Buffer, path: string)**
   - Full path: `{local_base_path}/{path}`
   - Example: `app/uploads/public/{tenant_id}/images/original/{uuid}.webp`
   - Create directories if not exist (recursive)
   - Write file to disk
   - Return path

2. **download(path: string)**
   - Full path: `{local_base_path}/{path}`
   - Read file from disk
   - Return buffer

3. **delete(path: string)**
   - Full path: `{local_base_path}/{path}`
   - Delete file from disk (fs.unlink)
   - No error if file doesn't exist

4. **getPublicUrl(path: string)**
   - Return: `{local_public_url_base}/{path}`
   - Example: `https://domain.com/uploads/public/{tenant_id}/images/original/{uuid}.webp`
   - No expiry for local (files are public via Nginx)

5. **exists(path: string)**
   - Check if file exists on disk
   - Return boolean

---

### **S3StorageService**

**Purpose**: Implement storage interface for S3-compatible providers

**Location**: `storage/s3-storage.service.ts`

**Dependencies**: AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)

**Implementation**:

1. **upload(file: Buffer, path: string)**
   - Use PutObjectCommand
   - Bucket: from storage_config
   - Key: path
   - Body: file buffer
   - Return path

2. **download(path: string)**
   - Use GetObjectCommand
   - Return file buffer

3. **delete(path: string)**
   - Use DeleteObjectCommand
   - No error if file doesn't exist

4. **getPublicUrl(path: string, expiresIn = 300)**
   - Generate presigned URL using getSignedUrl
   - Expires in 5 minutes (default)
   - Return signed URL

5. **exists(path: string)**
   - Use HeadObjectCommand
   - Return true if exists, false if not

**S3 Client Configuration**:
```typescript
const s3Client = new S3Client({
  region: storage_config.s3_region,
  endpoint: storage_config.s3_endpoint, // For Spaces/R2
  credentials: {
    accessKeyId: decrypt(storage_config.s3_access_key),
    secretAccessKey: decrypt(storage_config.s3_secret_key)
  }
});
```

---

### **StorageFactory**

**Purpose**: Return appropriate storage service based on config

**Location**: `storage/storage.factory.ts`

**Method**:
```typescript
getStorageService(): StorageInterface {
  const config = getStorageConfig(); // From database
  
  switch (config.storage_provider) {
    case 'local':
      return new LocalStorageService(config);
    case 's3':
    case 'spaces':
    case 'r2':
      return new S3StorageService(config);
    default:
      throw new Error('Invalid storage provider');
  }
}
```

**Usage**: All file operations use StorageFactory, never directly access LocalStorage or S3Storage

---

## Image Optimization

### **ImageOptimizerService**

**Purpose**: Optimize images (convert to WebP, compress, strip EXIF)

**Location**: `processors/image-optimizer.service.ts`

**Dependencies**: `sharp` (image processing library)

**Methods**:

1. **optimize(file: Buffer, quality = 85): Promise<Buffer>**
   - Convert to WebP
   - Quality: 85 (good balance between size and quality)
   - Strip EXIF data
   - Return optimized buffer

2. **generateThumbnail(file: Buffer, size = 200): Promise<Buffer>**
   - Resize to 200x200 (cover, crop center)
   - Convert to WebP
   - Quality: 80
   - Return thumbnail buffer

3. **convertHeicToJpg(file: Buffer): Promise<Buffer>**
   - Convert HEIC to JPG
   - Then convert to WebP
   - Return WebP buffer

**Example**:
```typescript
const originalBuffer = req.file.buffer;

// Optimize original
const optimizedBuffer = await imageOptimizer.optimize(originalBuffer);

// Generate thumbnail
const thumbnailBuffer = await imageOptimizer.generateThumbnail(originalBuffer);
```

---

## PDF Processing

### **PdfProcessorService**

**Purpose**: Generate thumbnails from PDF first page

**Location**: `processors/pdf-processor.service.ts`

**Dependencies**: `pdf-poppler` or `pdf-to-img`

**Methods**:

1. **generateThumbnail(pdfBuffer: Buffer, size = 200): Promise<Buffer>**
   - Extract first page
   - Convert to JPG
   - Resize to 200x200
   - Return thumbnail buffer

**Example**:
```typescript
const pdfBuffer = req.file.buffer;
const thumbnailBuffer = await pdfProcessor.generateThumbnail(pdfBuffer);
```

---

## Core Service Methods

### **FilesService**

1. **upload(file, uploadDto, userId, tenantId)**
   - Validate MIME type (whitelist: image/*, application/pdf, application/msword, etc.)
   - Validate file size (based on file_category limits)
   - Generate UUID filename
   - Process file:
     - If image:
       - Convert HEIC to JPG (if HEIC)
       - Optimize to WebP
       - Generate thumbnail
     - If PDF:
       - Keep as PDF
       - Generate thumbnail (first page as JPG)
     - If DOC/DOCX:
       - Keep as-is (no processing)
   - Upload original to storage
   - Upload thumbnail to storage
   - Create 2 database records (original + thumbnail)
   - Audit log: "File uploaded"
   - Return file metadata

2. **findAll(filters, pagination, tenantId)**
   - Apply tenant filter (if not Platform Admin)
   - Apply filters (entity_type, entity_id, category, file_type, date range, search)
   - Apply pagination
   - Return paginated results with thumbnails

3. **findOne(id, tenantId)**
   - Fetch file by ID
   - Validate tenant access
   - Return file metadata

4. **download(id, userId, tenantId)**
   - Fetch file metadata
   - Validate access (same tenant OR Platform Admin)
   - Get storage service
   - If local: Return public URL or file stream
   - If S3: Generate presigned URL
   - Audit log: "File downloaded"
   - Return file or URL

5. **delete(id, userId, tenantId)**
   - Validate user can delete (Owner/Admin)
   - Soft delete: Set deleted_at
   - Also soft delete thumbnail (if exists)
   - Audit log: "File deleted"
   - Return success

6. **createShareLink(fileId, shareLinkDto, userId)**
   - Generate unique token (UUID)
   - Hash password if provided (bcrypt)
   - Create share_link record
   - Audit log: "Share link created"
   - Return share URL

7. **downloadViaShareLink(token, password?)**
   - Find share link by token
   - Validate not expired
   - Validate max downloads not exceeded
   - Validate password (if protected)
   - Increment access_count
   - Audit log: "File accessed via share link"
   - Return file

8. **bulkDownload(fileIds, userId, tenantId)**
   - Validate user has access to all files
   - Queue background job (ZipCreatorJob)
   - Return job_id
   - Job creates ZIP, stores temporarily
   - User polls for completion

9. **bulkDelete(fileIds, userId, tenantId)**
   - Validate user can delete (Owner/Admin)
   - Soft delete all files + thumbnails
   - Audit log: One entry per file
   - Return deleted count

---

### **Background Jobs**

#### **FileRetentionJob**

**Purpose**: Hard delete files soft-deleted >90 days ago

**Trigger**: Cron (runs daily at 2am)

**Process**:
1. Find files where `deleted_at < NOW() - 90 days`
2. For each file:
   - Delete from storage (local or S3)
   - Delete thumbnail from storage
   - Hard delete database record
   - Audit log: "File permanently deleted"

---

#### **ZipCreatorJob**

**Purpose**: Create ZIP of selected files for bulk download

**Trigger**: Queued by bulkDownload()

**Process**:
1. Receive list of file IDs
2. Download all files from storage
3. Create ZIP file using `archiver` library
4. Store ZIP in temp directory (or S3)
5. Mark job as completed
6. Return download URL (expires in 24 hours)

**Cleanup Job**: Delete ZIPs older than 24 hours (runs hourly)

---

## MIME Type Validation

**Whitelist** (Accept these MIME types):

**Images**:
- image/png
- image/jpeg
- image/jpg
- image/webp
- image/heic
- image/heif

**Documents**:
- application/pdf
- application/msword (DOC)
- application/vnd.openxmlformats-officedocument.wordprocessingml.document (DOCX)

**Validation**:
```typescript
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
  throw new BadRequestException('Invalid file type');
}
```

---

## File Size Limits

**Validation by Category**:
```typescript
const FILE_SIZE_LIMITS = {
  logo: 5 * 1024 * 1024, // 5MB
  user_photo: 2 * 1024 * 1024, // 2MB
  signature: 500 * 1024, // 500KB
  quote_image: 10 * 1024 * 1024, // 10MB
  project_photo: 10 * 1024 * 1024, // 10MB
  receipt: 10 * 1024 * 1024, // 10MB
  permit: 20 * 1024 * 1024, // 20MB
  inspection_report: 20 * 1024 * 1024, // 20MB
  material_quote: 20 * 1024 * 1024, // 20MB
  invoice_attachment: 10 * 1024 * 1024, // 10MB
  other: 10 * 1024 * 1024 // 10MB
};

const maxSize = FILE_SIZE_LIMITS[uploadDto.file_category];
if (file.size > maxSize) {
  throw new PayloadTooLargeException(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
}
```

---

## Integration with Business Settings

**Current Implementation** (Tenant module):
- Logo upload at `/settings/business` (branding tab)
- Backend: TenantService.updateBranding(logoFile)

**Updated Implementation**:

**TenantService.updateBranding()**:
```typescript
async updateBranding(tenantId, logoFile, userId) {
  // Upload logo via FilesService
  const uploadedFile = await filesService.upload(logoFile, {
    related_entity_type: 'tenant',
    related_entity_id: tenantId,
    file_category: 'logo'
  }, userId, tenantId);
  
  // Update tenant table with file_id
  await tenantRepository.update(tenantId, {
    logo_file_id: uploadedFile.id
  });
  
  return uploadedFile;
}
```

**Tenant Table Update**:
- Add column: `logo_file_id` (UUID, foreign key to file)
- Remove column: `logo_path` (old column, deprecated)

**Migration**: Copy existing logos to file table (one-time script)

---

## API Controller

**Location**: `files.controller.ts`

**Routes**:

1. **POST /files/upload**
   - @UseGuards(JwtAuthGuard)
   - @UseInterceptors(FileInterceptor('file'))
   - Multipart form data
   - Calls FilesService.upload()

2. **GET /files**
   - @UseGuards(JwtAuthGuard, RolesGuard)
   - @RequirePermission('files', 'view_gallery')
   - Query params: filters, pagination
   - Calls FilesService.findAll()

3. **GET /files/:id**
   - @UseGuards(JwtAuthGuard)
   - Calls FilesService.findOne()

4. **GET /files/:id/download**
   - @UseGuards(JwtAuthGuard)
   - Calls FilesService.download()
   - Returns file stream or presigned URL

5. **DELETE /files/:id**
   - @UseGuards(JwtAuthGuard, RolesGuard)
   - @Roles('Owner', 'Admin')
   - Calls FilesService.delete()

6. **POST /files/:id/share**
   - @UseGuards(JwtAuthGuard, RolesGuard)
   - @Roles('Owner', 'Admin')
   - Calls FilesService.createShareLink()

7. **GET /files/shared/:token**
   - No authentication (public)
   - Query param: password (if password protected)
   - Calls FilesService.downloadViaShareLink()

8. **POST /files/bulk/download**
   - @UseGuards(JwtAuthGuard, RolesGuard)
   - @RequirePermission('files', 'view_gallery')
   - Body: { file_ids: [] }
   - Calls FilesService.bulkDownload()
   - Returns job_id

9. **GET /files/bulk/download/:jobId**
   - @UseGuards(JwtAuthGuard)
   - Check job status
   - If completed: Return download URL

10. **DELETE /files/bulk/delete**
    - @UseGuards(JwtAuthGuard, RolesGuard)
    - @Roles('Owner', 'Admin')
    - Body: { file_ids: [] }
    - Calls FilesService.bulkDelete()

---

## Audit Logging

**Log These Actions**:
- File uploaded → action_type: created, entity_type: file
- File downloaded → action_type: accessed, entity_type: file
- File deleted → action_type: deleted, entity_type: file, before_json: file metadata
- Share link created → action_type: created, entity_type: file_share_link
- File accessed via share link → action_type: accessed, entity_type: file, metadata_json: { via_share_link: true, token: uuid }

**Example**:
```typescript
await auditLogger.log({
  action_type: 'created',
  entity_type: 'file',
  entity_id: file.id,
  actor_user_id: userId,
  tenant_id: tenantId,
  description: `Uploaded ${file.original_filename}`,
  after_json: {
    filename: file.original_filename,
    category: file.file_category,
    size: file.file_size
  },
  metadata_json: {
    related_entity_type: file.related_entity_type,
    related_entity_id: file.related_entity_id
  }
});
```

---

## Testing Requirements

### **Unit Tests** (>80% coverage)

1. **StorageService**
   - ✅ Local upload/download/delete
   - ✅ S3 upload/download/delete
   - ✅ Generate presigned URL

2. **ImageOptimizerService**
   - ✅ Convert to WebP
   - ✅ Generate thumbnail
   - ✅ Convert HEIC to JPG
   - ✅ Strip EXIF data

3. **PdfProcessorService**
   - ✅ Generate PDF thumbnail

4. **FilesService**
   - ✅ Upload file (image)
   - ✅ Upload file (PDF)
   - ✅ Validate MIME type
   - ✅ Validate file size
   - ✅ Find files with filters
   - ✅ Download file
   - ✅ Delete file
   - ✅ Create share link
   - ✅ Download via share link
   - ✅ Bulk download
   - ✅ Bulk delete

---

### **Integration Tests**

1. **Upload Flow**
   - ✅ Upload image → Optimize → Generate thumbnail → Store → Create records
   - ✅ Upload PDF → Generate thumbnail → Store → Create records
   - ✅ Upload to local storage
   - ✅ Upload to S3 (if configured)

2. **Download Flow**
   - ✅ Download file (local)
   - ✅ Download file (S3 presigned URL)

3. **Share Link Flow**
   - ✅ Create share link
   - ✅ Download via share link
   - ✅ Expired share link returns 410
   - ✅ Max downloads exceeded returns 403
   - ✅ Password protected link requires password

4. **Business Settings Integration**
   - ✅ Upload logo → File record created → Tenant updated

---

## Completion Checklist

- [ ] file table created
- [ ] file_share_link table created
- [ ] storage_config table created
- [ ] StorageInterface defined
- [ ] LocalStorageService implemented
- [ ] S3StorageService implemented
- [ ] StorageFactory implemented
- [ ] ImageOptimizerService (WebP conversion, thumbnails)
- [ ] PdfProcessorService (thumbnail generation)
- [ ] FilesService (all methods)
- [ ] FileRetentionJob (hard delete after 90 days)
- [ ] ZipCreatorJob (bulk download)
- [ ] API controller (all endpoints)
- [ ] Integration with TenantService (logo upload)
- [ ] Audit logging (all file operations)
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] API documentation complete (Swagger)

---

## Common Pitfalls to Avoid

1. **Don't hardcode storage paths** - Use StorageFactory
2. **Don't skip image optimization** - Always convert to WebP
3. **Don't forget thumbnails** - Both for images AND PDFs
4. **Don't skip MIME type validation** - Security risk
5. **Don't allow unlimited file sizes** - Validate per category
6. **Don't break business settings** - Keep existing logo upload working
7. **Don't skip audit logging** - All file operations must be logged
8. **Don't hard delete immediately** - Soft delete with 90-day retention

---

**End of Backend Module Documentation**

File storage is critical for all business modules. Must be reliable, fast, and ready for S3 migration.