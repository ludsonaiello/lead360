# Frontend Module: File Storage

**Module Name**: File Storage  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/file-storage-contract.md`  
**Backend Module**: `/documentation/backend/module-file-storage.md`  
**Agent**: Frontend Specialist  
**Status**: Ready for Development (AFTER backend complete)

---

## Overview

This module implements file upload, management, and gallery functionality. You will build a drag-drop upload component, dual-view gallery (grid + list), advanced filtering, and file sharing features.

**CRITICAL**: Do NOT start until backend File Storage module is 100% complete and API documentation is available.

**Read First**:
- `/documentation/contracts/file-storage-contract.md` (file storage requirements)
- `/documentation/backend/module-file-storage.md` (API endpoints)
- Backend API documentation (Swagger)

---

## Technology Stack

**Required Libraries**:
- react-dropzone (drag-drop file upload)
- react-hook-form + zod (forms)
- date-fns or dayjs (date handling)
- react-datepicker (date range picker)
- @headlessui/react (modals, dropdowns)
- lucide-react (icons)
- axios (API calls)
- file-saver (download files)

---

## Project Structure

```
app/
├── (dashboard)/
│   ├── files/
│   │   └── page.tsx (file gallery - Owner/Admin/Bookkeeper only)
│   ├── settings/
│   │   └── business/
│   │       └── page.tsx (existing - update to use FileUploader)
│   └── layout.tsx
├── (admin)/
│   ├── files/
│   │   └── page.tsx (Platform Admin file gallery)
│   └── tenants/
│       └── [id]/
│           └── files/
│               └── page.tsx (tenant-specific file gallery)
├── components/
│   ├── files/
│   │   ├── FileUploader.tsx (drag-drop upload)
│   │   ├── FileGallery.tsx (main gallery component)
│   │   ├── FileGalleryGrid.tsx (grid view)
│   │   ├── FileGalleryList.tsx (list view)
│   │   ├── FileFilters.tsx (filter controls)
│   │   ├── FileDetailModal.tsx (file details + actions)
│   │   ├── ShareLinkModal.tsx (create share link)
│   │   ├── BulkActionsMenu.tsx (bulk operations)
│   │   ├── FileCard.tsx (grid item)
│   │   ├── FileRow.tsx (list item)
│   │   ├── FileThumbnail.tsx (show thumbnail or icon)
│   │   └── EmptyFileState.tsx (no files found)
│   └── ui/
├── lib/
│   ├── api/
│   │   └── files.ts
│   ├── hooks/
│   │   ├── useFileUpload.ts
│   │   ├── useFileGallery.ts
│   │   └── useFileShare.ts
│   ├── utils/
│   │   ├── file-helpers.ts (format size, validate, etc.)
│   │   └── download.ts (download file utilities)
│   └── types/
│       └── files.ts
└── public/
    └── shared/
        └── files/
            └── [token]/
                └── page.tsx (public share link page)
```

---

## TypeScript Interfaces

**Location**: `lib/types/files.ts`

Define interfaces for:
- File (full file metadata)
- FileFilters (filter parameters)
- ShareLink (share link details)
- UploadOptions (upload configuration)

Developer will create based on API documentation.

---

## API Client

**Location**: `lib/api/files.ts`

**Methods to Implement**:

1. **uploadFile(file, metadata, onProgress)** - POST /files/upload
2. **getFiles(filters, pagination)** - GET /files
3. **getFile(id)** - GET /files/:id
4. **downloadFile(id)** - GET /files/:id/download
5. **deleteFile(id)** - DELETE /files/:id
6. **createShareLink(fileId, options)** - POST /files/:id/share
7. **downloadViaShareLink(token, password)** - GET /files/shared/:token
8. **bulkDownload(fileIds)** - POST /files/bulk/download
9. **bulkDelete(fileIds)** - DELETE /files/bulk/delete
10. **pollBulkDownloadStatus(jobId)** - GET /files/bulk/download/:jobId

---

## Custom Hooks

### **useFileUpload()**

**Location**: `lib/hooks/useFileUpload.ts`

**Purpose**: Handle file upload with progress tracking

**Usage**:
```typescript
const {
  uploadFile,
  uploadProgress,
  isUploading,
  error,
  resetError
} = useFileUpload();

await uploadFile(file, {
  related_entity_type: 'project',
  related_entity_id: projectId,
  file_category: 'project_photo'
});
```

**Returns**:
- uploadFile (function)
- uploadProgress (0-100)
- isUploading (boolean)
- error (Error or null)
- resetError (function)

**Implementation Logic**:
1. Validate file (type, size) client-side
2. Create FormData
3. Upload via axios with progress tracking
4. Handle success/error
5. Return uploaded file metadata

---

### **useFileGallery()**

**Location**: `lib/hooks/useFileGallery.ts`

**Purpose**: Manage file gallery state and operations

**Usage**:
```typescript
const {
  files,
  pagination,
  filters,
  viewMode, // 'grid' or 'list'
  selectedFiles,
  isLoading,
  error,
  setFilters,
  setViewMode,
  toggleFileSelection,
  selectAll,
  deselectAll,
  nextPage,
  previousPage,
  refresh
} = useFileGallery();
```

**Implementation Logic**:
1. Manage filter state
2. Manage pagination
3. Fetch files from API
4. Handle view mode toggle
5. Manage multi-select state
6. Update URL query params

---

### **useFileShare()**

**Location**: `lib/hooks/useFileShare.ts`

**Purpose**: Handle share link creation and management

**Usage**:
```typescript
const {
  createShareLink,
  shareLink,
  isCreating,
  error
} = useFileShare();

await createShareLink(fileId, {
  expires_in_days: 7,
  password: 'optional'
});
```

---

## Using Share Links: View vs Download

Share links support two distinct operations with separate tracking:

### Viewing a Shared File (Without Downloading)

**Purpose**: Preview file information without downloading
**Increments**: `view_count` only

```typescript
import { accessSharedFile } from '@/lib/api/files';

// Access file info (increments view_count)
const response = await accessSharedFile(token, password);

console.log(response.share_info.view_count);      // Incremented
console.log(response.share_info.download_count);  // Unchanged
console.log(response.file.original_filename);
console.log(response.file.size_bytes);
```

**Use Cases**:
- User previews file before downloading
- Checking file size/type
- Viewing thumbnail
- Verifying link is still valid
- Does NOT count toward `max_downloads` limit

### Downloading a Shared File

**Purpose**: Actually download the file to user's device
**Increments**: `download_count` only

```typescript
import { downloadSharedFile } from '@/lib/api/files';

// Download file (increments download_count)
const response = await downloadSharedFile(token, password);

// Trigger browser download
window.location.href = response.file.url;

console.log(response.share_info.download_count);  // Incremented
console.log(response.share_info.view_count);      // Unchanged
```

**Use Cases**:
- User clicks "Download" button
- File saved to device
- Counts toward `max_downloads` limit (if set)
- Blocked if max downloads reached

### Password-Protected Links

Both endpoints accept optional password:

```typescript
// With password
const response = await accessSharedFile(token, 'myPassword123');

// Without password (public link)
const response = await accessSharedFile(token);
```

**Error Handling**:
```typescript
try {
  const response = await accessSharedFile(token, password);
} catch (error) {
  if (error.status === 401) {
    if (error.message.includes('Password required')) {
      // Show password input form
    } else if (error.message.includes('Invalid password')) {
      // Show error: wrong password
    }
  } else if (error.status === 400) {
    // Link expired, revoked, or max downloads reached (downloads only)
  } else if (error.status === 404) {
    // Link not found
  }
}
```

### Implementation Example: Public Share Page

```typescript
// app/public/share/[token]/page.tsx
import { accessSharedFile, downloadSharedFile } from '@/lib/api/files';

export default function ShareLinkPage({ params }: { params: { token: string } }) {
  const [fileInfo, setFileInfo] = useState(null);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');

  // Initial load - view file info (increments view_count)
  useEffect(() => {
    async function loadFile() {
      try {
        const response = await accessSharedFile(params.token);
        setFileInfo(response);
      } catch (error) {
        if (error.status === 401 && error.message.includes('Password required')) {
          setShowPasswordInput(true);
        }
      }
    }
    loadFile();
  }, [params.token]);

  // Handle password submission
  const handlePasswordSubmit = async () => {
    try {
      const response = await accessSharedFile(params.token, password);
      setFileInfo(response);
      setShowPasswordInput(false);
    } catch (error) {
      alert('Invalid password');
    }
  };

  // Handle download button click (increments download_count)
  const handleDownload = async () => {
    try {
      const response = await downloadSharedFile(params.token, password);
      window.location.href = response.file.url;
    } catch (error) {
      if (error.message.includes('Maximum download limit reached')) {
        alert('This file has reached its download limit');
      }
    }
  };

  return (
    <div>
      {showPasswordInput ? (
        <PasswordForm onSubmit={handlePasswordSubmit} />
      ) : fileInfo ? (
        <>
          <h1>{fileInfo.file.original_filename}</h1>
          <p>Size: {fileInfo.file.size_bytes} bytes</p>
          <p>Views: {fileInfo.share_info.view_count}</p>
          <p>Downloads: {fileInfo.share_info.download_count} / {fileInfo.share_info.max_downloads || '∞'}</p>
          <button onClick={handleDownload}>Download File</button>
        </>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}
```

### Key Differences: View vs Download

| Aspect | View (`/access`) | Download (`/download`) |
|--------|------------------|------------------------|
| **Increments** | `view_count` | `download_count` |
| **Counts toward limit** | ❌ No | ✅ Yes (if `max_downloads` set) |
| **Blocked at limit** | ❌ Never | ✅ Yes |
| **Use case** | Preview/check info | Save to device |
| **Button label** | "View Details" | "Download" |

### Why Separate Tracking?

1. **Better Analytics**: Understand how many people viewed vs downloaded
2. **Fair Limits**: Don't penalize users for checking file size
3. **Better UX**: Users can preview without wasting quota
4. **Audit Trail**: Track both metrics for compliance

---

## Main Components

### **FileUploader Component**

**Location**: `components/files/FileUploader.tsx`

**Purpose**: Drag-drop file upload with validation

**Props**:
- relatedEntityType (string)
- relatedEntityId (string)
- fileCategory (string)
- maxSize (number, optional - defaults based on category)
- accept (string[], optional - MIME types)
- onUploadComplete (function)
- showPreview (boolean, default: true)
- multiple (boolean, default: false)

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│        📁 Drag and drop files here                      │
│           or click to browse                            │
│                                                          │
│     Accepted: Images, PDFs, DOC/DOCX                    │
│     Max size: 10MB                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘

[If files selected - show preview:]
┌─────────────────────────────────────────────────────────┐
│ [Thumbnail] filename.jpg - 2.4 MB [X Remove]            │
│ [Progress Bar ████████░░ 80%]                           │
└─────────────────────────────────────────────────────────┘
```

**Features**:
- Drag-drop zone (react-dropzone)
- Click to browse
- File validation (MIME type, size) before upload
- Preview selected files
- Progress bar per file
- Upload button
- Error messages (invalid type, too large)
- Success toast on upload complete

**States**:
- Idle (empty drop zone)
- File selected (show preview + upload button)
- Uploading (progress bar, disable drop zone)
- Success (show success toast, clear preview)
- Error (show error message, allow retry)

---

### **FileGallery Component**

**Location**: `components/files/FileGallery.tsx`

**Purpose**: Main gallery component (orchestrates grid/list views)

**Props**:
- entityType (optional - pre-filter by entity)
- entityId (optional - pre-filter by specific entity)
- showFilters (boolean, default: true)
- showBulkActions (boolean, default: true)

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ [FileFilters]                                            │
├─────────────────────────────────────────────────────────┤
│ [View Toggle: Grid ● | List ○] [Upload] [Bulk Actions] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [FileGalleryGrid OR FileGalleryList]                    │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ [Pagination]                                             │
└─────────────────────────────────────────────────────────┘
```

**Behavior**:
- Toggle between grid and list views
- Apply filters (delegates to FileFilters)
- Handle file selection (multi-select)
- Show bulk actions menu when files selected
- Pagination controls

---

### **FileGalleryGrid Component**

**Location**: `components/files/FileGalleryGrid.tsx`

**Purpose**: Grid view layout

**Layout**:
```
┌────────┬────────┬────────┬────────┬────────┬────────┐
│ [Card] │ [Card] │ [Card] │ [Card] │ [Card] │ [Card] │
├────────┼────────┼────────┼────────┼────────┼────────┤
│ [Card] │ [Card] │ [Card] │ [Card] │ [Card] │ [Card] │
└────────┴────────┴────────┴────────┴────────┴────────┘
```

**FileCard** (single item):
```
┌─────────────────────┐
│ [☐]          [...]  │ (checkbox, menu)
│                     │
│  [📷 Thumbnail]     │
│                     │
│ filename.jpg        │
│ 2.4 MB              │
│ Project #123        │
│ Jan 5, 2025         │
└─────────────────────┘
```

**Features**:
- Responsive grid (6 columns desktop → 3 tablet → 2 mobile)
- Hover: Show checkbox, quick actions menu
- Click: Open detail modal
- Multi-select: Checkboxes
- Loading: Skeleton cards
- Empty: EmptyFileState component

---

### **FileGalleryList Component**

**Location**: `components/files/FileGalleryList.tsx`

**Purpose**: List/table view layout

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ [☐] | Thumb | Filename | Category | Entity | Size | Date│
├────────────────────────────────────────────────────────┤
│ [☐] | [IMG] | logo.png | Logo | Business | 1.2MB | Jan 5│
│ [☐] | [PDF] | permit.pdf | Permit | Project#1 | 2.5MB | 4│
│ [☐] | [IMG] | receipt.jpg | Receipt | Expense#2 | 800KB | 3│
└────────────────────────────────────────────────────────┘
```

**Features**:
- Sortable columns (filename, size, date)
- Click row: Open detail modal
- Checkbox column: Multi-select
- Hover row: Highlight
- Loading: Skeleton rows
- Empty: EmptyFileState component

---

### **FileFilters Component**

**Location**: `components/files/FileFilters.tsx`

**Purpose**: Filter controls

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ [Entity Type ▾] [Entity ▾] [Category ▾] [File Type ▾]  │
│ [Date Range Picker] [Search...              ] [Reset]  │
└─────────────────────────────────────────────────────────┘
```

**Filters**:
1. **Entity Type Dropdown**: All, Projects, Quotes, Invoices, Expenses, Business, Users
2. **Entity Dropdown** (Conditional): If entity type selected, show specific entity dropdown
   - Example: If "Projects" selected, show project dropdown (searchable)
3. **Category Dropdown**: All, Logos, Signatures, Photos, Receipts, Permits, etc.
4. **File Type Dropdown**: All, Images, PDFs, Documents
5. **Date Range Picker**: All Time, Today, Last 7 Days, Last 30 Days, Custom
6. **Search Field**: Search filename (debounced 500ms)
7. **Reset Button**: Clear all filters

**Behavior**:
- Filters update immediately
- Search debounced
- Show active filter count badge
- Mobile: Collapse into modal or accordion

---

### **FileDetailModal Component**

**Location**: `components/files/FileDetailModal.tsx`

**Purpose**: Show file details and actions

**Props**:
- isOpen (boolean)
- onClose (function)
- fileId (string)

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ [Close X]                                                │
│                                                          │
│ [Large Preview - Image or PDF thumbnail]                │
│                                                          │
│ Filename: before-painting.jpg                           │
│ Category: Project Photo                                 │
│ Entity: Project #123 - ABC Painting Job                 │
│ Uploaded by: John Doe                                   │
│ Uploaded at: January 5, 2025 at 10:30 AM                │
│ File size: 1.8 MB (original: 4.2 MB, 57% smaller)       │
│ Tags: exterior, before                                  │
│                                                          │
│ [Download] [Share Link] [Delete]                        │
└─────────────────────────────────────────────────────────┘
```

**Actions**:
- **Download**: Download original file
- **Share Link**: Open ShareLinkModal
- **Delete**: Confirmation modal → Delete file

**Features**:
- Lazy load file details on open
- Image preview (show optimized version)
- PDF preview (show thumbnail)
- File metadata display
- Action buttons (role-based visibility)

---

### **ShareLinkModal Component**

**Location**: `components/files/ShareLinkModal.tsx`

**Purpose**: Create temporary share link

**Props**:
- isOpen (boolean)
- onClose (function)
- file (File object)

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Share: filename.pdf                                      │
│                                                          │
│ Expires in:                                              │
│ ○ 1 day                                                  │
│ ● 7 days                                                 │
│ ○ 30 days                                                │
│                                                          │
│ Password protect (optional):                            │
│ [Password input] [👁 Show]                              │
│                                                          │
│ Max downloads (optional):                               │
│ [Number input] (leave blank for unlimited)              │
│                                                          │
│ [Cancel] [Generate Link]                                │
│                                                          │
│ [If link created:]                                       │
│ ✓ Share link created!                                   │
│                                                          │
│ https://domain.com/shared/files/abc123...               │
│ [Copy Link] [Send Email]                                │
│                                                          │
│ Expires: January 12, 2025                               │
│ Access count: 0 / 10                                    │
└─────────────────────────────────────────────────────────┘
```

**Flow**:
1. User sets expiry, password (optional), max downloads (optional)
2. Click "Generate Link"
3. API creates share link
4. Show share URL with copy button
5. Show send email option (opens email client with link)

---

### **BulkActionsMenu Component**

**Location**: `components/files/BulkActionsMenu.tsx`

**Purpose**: Actions for multiple selected files

**Props**:
- selectedFiles (File[])
- onDownloadZip (function)
- onDelete (function)
- onDeselect (function)

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ X selected: 5 files                                      │
│ [Download ZIP] [Delete Selected] [Deselect All]         │
└─────────────────────────────────────────────────────────┘
```

**Actions**:

**Download ZIP**:
1. Click "Download ZIP"
2. Show loading: "Creating ZIP file..."
3. API queues background job
4. Poll job status every 2 seconds
5. When complete: Auto-download ZIP
6. Success toast: "ZIP file downloaded"

**Delete Selected**:
1. Click "Delete Selected"
2. Confirmation modal: "Delete 5 files? This cannot be undone."
3. User confirms
4. API bulk delete
5. Refresh gallery
6. Success toast: "5 files deleted"

---

### **FileThumbnail Component**

**Location**: `components/files/FileThumbnail.tsx`

**Purpose**: Display file thumbnail or icon

**Props**:
- file (File object)
- size ('sm' | 'md' | 'lg')

**Rendering**:
- If image: Show thumbnail image
- If PDF: Show PDF thumbnail (first page)
- If DOC/DOCX: Show document icon
- Loading: Skeleton
- Error loading: Placeholder icon

**Sizes**:
- sm: 40x40px (list view)
- md: 200x200px (grid view)
- lg: 400x400px (detail modal)

---

## Pages

### **File Gallery Page** (Tenant Users)

**Route**: `/files`

**Access**: Owner, Admin, Bookkeeper only (permission: files:view_gallery)

**Purpose**: Main file gallery for tenant users

**Layout**:
```
[Header: "Files"]
[Subtitle: "Manage all your files"]

[FileGallery component - full featured]
```

**Features**:
- Full gallery with all filters
- Upload button
- Bulk operations
- Auto-filtered to current tenant

---

### **Platform Admin: File Gallery**

**Route**: `/admin/files`

**Access**: Platform Admin only

**Purpose**: View all files across all tenants

**Layout**:
```
[Header: "System Files"]

[Additional Filter: Tenant Selector]

[FileGallery component]
```

**Features**:
- Can filter by tenant
- See all tenants' files
- Additional column in list view: Tenant name

---

### **Public Share Link Page**

**Route**: `/shared/files/[token]`

**Access**: Public (no authentication)

**Purpose**: Download file via share link

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│                 🔗 Shared File                          │
│                                                          │
│ [File Preview or Icon]                                  │
│                                                          │
│ filename.pdf                                            │
│ 2.5 MB                                                  │
│                                                          │
│ Shared by: ABC Painting                                │
│                                                          │
│ [If password protected:]                                │
│ Password:                                               │
│ [Password input]                                        │
│                                                          │
│ [Download File]                                         │
│                                                          │
│ Downloads: 3 / 10                                       │
│ Expires: January 12, 2025                               │
└─────────────────────────────────────────────────────────┘
```

**Flow**:
1. User visits share link
2. If password protected: Prompt for password
3. Validate password → Show file info
4. Click "Download" → Download file
5. Increment access count
6. Show updated download count

**Error States**:
- Invalid token: "Link not found"
- Expired: "This link has expired"
- Max downloads exceeded: "Download limit reached"
- Wrong password: "Invalid password"

---

## Integration with Business Settings

**Current Page**: `/settings/business` (branding tab)

**Update Required**:

Replace inline logo upload with FileUploader component:

```typescript
<FileUploader
  relatedEntityType="tenant"
  relatedEntityId={tenantId}
  fileCategory="logo"
  accept={['image/png', 'image/jpeg', 'image/webp']}
  maxSize={5 * 1024 * 1024} // 5MB
  onUploadComplete={(file) => {
    // Update tenant logo_file_id
    updateTenant({ logo_file_id: file.id });
  }}
  showPreview={true}
  multiple={false}
/>
```

**Display Current Logo**:
- Show thumbnail from file record
- Click thumbnail → Open FileDetailModal
- "Change Logo" button → Open FileUploader

---

## File Helpers

**Location**: `lib/utils/file-helpers.ts`

**Utility Functions**:

1. **formatFileSize(bytes: number): string**
   - Converts bytes to human-readable (KB, MB, GB)
   - Example: 1843200 → "1.76 MB"

2. **getFileIcon(mimeType: string): ReactNode**
   - Returns appropriate icon for file type
   - PDF: 📄, Image: 🖼️, DOC: 📝

3. **validateFile(file: File, category: string): ValidationResult**
   - Client-side validation (type, size)
   - Returns: { valid: boolean, error?: string }

4. **formatFileCategory(category: string): string**
   - Formats enum to display name
   - Example: "project_photo" → "Project Photo"

5. **getFileCategoryColor(category: string): string**
   - Returns Tailwind color for category badge
   - Example: "receipt" → "yellow", "permit" → "blue"

---

## Download Helpers

**Location**: `lib/utils/download.ts`

**Functions**:

1. **downloadFile(url: string, filename: string)**
   - Trigger browser download
   - Uses file-saver library or anchor trick

2. **downloadViaApi(fileId: string)**
   - Call API → Get presigned URL (if S3) or file stream (if local)
   - Trigger download

3. **copyToClipboard(text: string)**
   - Copy share link to clipboard
   - Show success toast

---

## Error Handling

**Common Errors**:

1. **File too large**:
   - Show error: "File exceeds 10MB limit"
   - Don't upload, stay on uploader

2. **Invalid file type**:
   - Show error: "File type not supported. Accepted: Images, PDFs, DOC/DOCX"
   - Don't upload

3. **403 Forbidden** (accessing gallery without permission):
   - Redirect to 403 page
   - Message: "You don't have permission to view the file gallery"

4. **Download failed**:
   - Error toast: "Failed to download file. Please try again."
   - Retry button

5. **Share link expired**:
   - Show: "This link has expired"
   - Contact info: "Please contact ABC Painting for a new link"

---

## Testing Requirements

### **Component Tests** (>70% coverage)

1. **FileUploader**
   - ✅ Accepts drag-drop
   - ✅ Validates file type
   - ✅ Validates file size
   - ✅ Shows progress bar during upload
   - ✅ Calls onUploadComplete on success

2. **FileGallery**
   - ✅ Renders grid view
   - ✅ Toggles to list view
   - ✅ Applies filters
   - ✅ Paginates correctly

3. **FileFilters**
   - ✅ All filters render
   - ✅ Changing filters updates gallery
   - ✅ Reset clears all filters
   - ✅ Search is debounced

4. **FileDetailModal**
   - ✅ Loads file details
   - ✅ Shows file preview
   - ✅ Download button works
   - ✅ Share link button opens modal

5. **ShareLinkModal**
   - ✅ Creates share link
   - ✅ Copies link to clipboard
   - ✅ Shows password field if enabled

6. **BulkActionsMenu**
   - ✅ Shows selected count
   - ✅ Download ZIP triggers job
   - ✅ Delete confirms before deleting

---

### **Integration Tests (E2E)**

1. **Upload File**
   - ✅ User uploads image
   - ✅ File appears in gallery
   - ✅ Thumbnail generated

2. **View Gallery**
   - ✅ Owner navigates to /files
   - ✅ Files load and display
   - ✅ Can toggle grid/list view

3. **Apply Filters**
   - ✅ Select entity type
   - ✅ Gallery updates
   - ✅ Search filename
   - ✅ Results filter correctly

4. **Download File**
   - ✅ Click download button
   - ✅ File downloads

5. **Create Share Link**
   - ✅ Click "Share Link"
   - ✅ Set expiry
   - ✅ Generate link
   - ✅ Copy link works

6. **Bulk Download**
   - ✅ Select multiple files
   - ✅ Click "Download ZIP"
   - ✅ ZIP downloads

7. **Public Share Link**
   - ✅ Visit share link URL
   - ✅ Download file
   - ✅ Access count increments

---

## Completion Checklist

- [ ] All TypeScript interfaces defined
- [ ] Files API client implemented
- [ ] useFileUpload hook
- [ ] useFileGallery hook
- [ ] useFileShare hook
- [ ] FileUploader component (drag-drop)
- [ ] FileGallery component
- [ ] FileGalleryGrid component
- [ ] FileGalleryList component
- [ ] FileFilters component
- [ ] FileDetailModal component
- [ ] ShareLinkModal component
- [ ] BulkActionsMenu component
- [ ] FileThumbnail component
- [ ] File helpers (format size, validate, etc.)
- [ ] Download helpers
- [ ] File gallery page (/files)
- [ ] Platform Admin file gallery
- [ ] Public share link page
- [ ] Integration with business settings
- [ ] Loading states (skeletons)
- [ ] Empty states
- [ ] Error handling (all error states)
- [ ] Component tests >70% coverage
- [ ] E2E tests passing
- [ ] No TypeScript errors
- [ ] No console errors

---

## Modern UI/UX Checklist

- [ ] Drag-drop upload (smooth animation)
- [ ] Progress bars during upload
- [ ] Skeleton loading (not just spinners)
- [ ] Smooth view toggle (grid ↔ list)
- [ ] Debounced search (500ms)
- [ ] Hover effects (cards, rows)
- [ ] Multi-select checkboxes
- [ ] Success toasts (upload, delete, share)
- [ ] Error modals (not alerts)
- [ ] Loading indicators (ZIP creation)
- [ ] Responsive grid (6 → 3 → 2 columns)
- [ ] Mobile-friendly (touch-friendly buttons)
- [ ] Keyboard accessible
- [ ] Aria labels for screen readers
- [ ] Copy-to-clipboard with feedback

---

## Performance Considerations

**Lazy Loading**:
- Load thumbnails on scroll (infinite scroll or pagination)
- Don't preload all file details
- Load large preview only when modal opens

**Image Optimization**:
- Use `<img loading="lazy">` for thumbnails
- Serve WebP from backend (already optimized)

**Pagination**:
- Default: 50 files per page
- Max: 200 files per page
- Never load all files at once

**Debouncing**:
- Search: 500ms delay
- Filters: Immediate (but debounce if search included)

---

## Accessibility Requirements

- [ ] Drag-drop also works with click (keyboard users)
- [ ] All interactive elements keyboard accessible
- [ ] Screen reader announces upload progress
- [ ] File list has table semantics (if list view)
- [ ] Modal can be closed with Escape key
- [ ] Focus management (modal traps focus)
- [ ] Color contrast meets WCAG AA
- [ ] Error messages associated with inputs
- [ ] Success toasts announced to screen readers

---

## Common Pitfalls to Avoid

1. **Don't forget file validation** - Always validate client-side before upload
2. **Don't block on upload** - Show progress, allow navigation
3. **Don't forget empty states** - "No files found" is common
4. **Don't skip thumbnails** - Users expect visual previews
5. **Don't forget mobile** - Gallery must work on small screens
6. **Don't hardcode file categories** - Use enums from backend
7. **Don't skip share link expiry** - Show expired state clearly
8. **Don't forget download tracking** - Audit log requires this

---

**End of Frontend Module Documentation**

File storage UI is critical for user experience. Upload must be smooth, gallery must be fast, sharing must be intuitive.