# Sprint 5: PDF Generation Optimization - Frontend Updates

**Date**: January 27, 2026
**Status**: ✅ Complete
**Backend Changes**: Smart caching with automatic cleanup implemented

---

## Overview

The backend implemented smart PDF caching to eliminate wasteful regeneration on every preview/download. The frontend has been updated to leverage these optimizations.

---

## Backend Architecture Changes

### New Endpoints

1. **POST `/quotes/:id/generate-pdf`** (Enhanced with caching)
   - Now accepts `force_regenerate?: boolean` parameter
   - Returns cached PDF if quote unchanged and params match
   - Automatically deletes old PDFs when regenerating
   - Response includes `regenerated: boolean` flag

2. **GET `/quotes/:id/preview-pdf`** (NEW - Optimized for speed)
   - Query param: `include_cost_breakdown` (boolean)
   - ALWAYS returns cached PDF if available (<100ms)
   - Generates only if cache missing or stale
   - NEVER forces regeneration

3. **GET `/quotes/:id/download-pdf`** (Enhanced with caching)
   - Returns cached PDF if available and up-to-date
   - Regenerates only if cache missing or quote modified

### Database Schema Addition

```prisma
model Quote {
  // Existing fields...
  latest_pdf_file_id  String?   // Cached PDF file
  pdf_generated_at    DateTime? // When PDF was generated
  pdf_content_hash    String?   // Hash to detect changes
  pdf_generation_params Json?   // Parameters used (cost breakdown, etc.)
}
```

### Performance Improvements

**Before (Broken System)**:
- ❌ Every request creates new PDF (2-5 seconds each)
- ❌ 3+ PDFs per quote preview (storage bloat)
- ❌ PDFs become orphans and deleted after 30 days
- ❌ Unlimited accumulation until cleanup

**After (Optimized System)**:
- ✅ First generation: 2-5 seconds (same as before)
- ✅ Cached previews: <100ms (20-50x faster)
- ✅ Storage: 1 PDF per quote (67% reduction)
- ✅ PDFs never orphaned (always linked to quotes)
- ✅ Automatic cleanup of old PDFs when regenerating

---

## Frontend Changes Summary

### 1. Type Definitions Updated

**File**: `/app/src/lib/types/quotes.ts`

**Change**: Added `force_regenerate` to `GeneratePdfDto`

```typescript
export interface GeneratePdfDto {
  include_cost_breakdown?: boolean;
  force_regenerate?: boolean; // NEW: Force regeneration even if cached
}

export interface PdfResponse {
  file_id: string;
  download_url: string;
  filename: string;
  file_size: number;
  generated_at: string;
  regenerated?: boolean; // Already existed
}
```

---

### 2. API Client Enhanced

**File**: `/app/src/lib/api/quote-pdf.ts`

**Changes**:
1. Added new `previewPdf()` function for optimized preview
2. Updated documentation to reflect caching behavior
3. Enhanced JSDoc comments with performance notes

**New Function**:
```typescript
/**
 * Preview PDF (optimized for speed)
 * @endpoint GET /quotes/:id/preview-pdf
 * @note First preview: 2-5 seconds (generates)
 * @note Subsequent previews: <100ms (cached)
 */
export const previewPdf = async (
  quoteId: string,
  includeCostBreakdown: boolean = false
): Promise<PdfResponse> => {
  const { data } = await apiClient.get<PdfResponse>(
    `/quotes/${quoteId}/preview-pdf`,
    { params: { include_cost_breakdown: includeCostBreakdown } }
  );
  return data;
};
```

**Updated Documentation**:
- `generatePdf()` - Now documents smart caching behavior
- `downloadPdf()` - Notes that it returns cached if available

---

### 3. PDF Actions Menu Enhanced

**File**: `/app/src/components/quotes/pdf/PDFActionsMenu.tsx`

**Changes**:

1. **Imports**: Added `previewPdf` function
2. **State**: Added `forceRegenerate` state variable
3. **Handlers**: Updated all three handlers with smart feedback

**Handler Changes**:

```typescript
// handlePreviewPdf - NOW USES OPTIMIZED ENDPOINT
const handlePreviewPdf = async () => {
  setIsGenerating(true);
  try {
    const pdf = await previewPdf(quoteId, includeCostBreakdown); // NEW
    setCurrentPdf(pdf);
    setShowPreview(true);

    // Show performance feedback
    if (pdf.regenerated) {
      toast.success('PDF preview generated');
    } else {
      toast.success('PDF preview loaded from cache (instant)'); // NEW
    }
  } catch (error: any) {
    toast.error(error.message || 'Failed to load PDF preview');
  } finally {
    setIsGenerating(false);
  }
};

// handleGeneratePdf - NOW SUPPORTS FORCE REGENERATE
const handleGeneratePdf = async () => {
  setIsGenerating(true);
  try {
    const pdf = await generatePdf(quoteId, {
      include_cost_breakdown: includeCostBreakdown,
      force_regenerate: forceRegenerate, // NEW
    });
    setCurrentPdf(pdf);

    // Show appropriate success message
    if (pdf.regenerated) {
      toast.success('PDF generated successfully');
    } else {
      toast.success('PDF returned from cache (no changes detected)'); // NEW
    }
  } catch (error: any) {
    toast.error(error.message || 'Failed to generate PDF');
  } finally {
    setIsGenerating(false);
  }
};

// handleDownloadPdf - NOW SHOWS CACHE STATUS
const handleDownloadPdf = async () => {
  setIsDownloading(true);
  try {
    const pdf = await downloadPdf(quoteId);
    downloadPdfFile(pdf, `${quoteNumber}.pdf`);

    if (pdf.regenerated) {
      toast.success('PDF downloaded (newly generated)'); // NEW
    } else {
      toast.success('PDF downloaded from cache'); // NEW
    }
  } catch (error: any) {
    toast.error(error.message || 'Failed to download PDF');
  } finally {
    setIsDownloading(false);
  }
};
```

---

### 4. PDF Settings Form Enhanced

**File**: `/app/src/components/quotes/pdf/PDFSettingsForm.tsx`

**Changes**: Added "Force Regenerate" toggle as advanced option

**New Props**:
```typescript
interface PDFSettingsFormProps {
  includeCostBreakdown: boolean;
  onToggleCostBreakdown: (include: boolean) => void;
  forceRegenerate?: boolean; // NEW
  onToggleForceRegenerate?: (force: boolean) => void; // NEW
  disabled?: boolean;
}
```

**New UI Section**:
```tsx
{/* Force Regenerate Toggle (Advanced Option) */}
{onToggleForceRegenerate && (
  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Force Regenerate
          </h4>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Bypass cache and regenerate PDF even if no changes detected. Use this
          if the cached PDF appears outdated.
        </p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        {/* Toggle switch */}
      </label>
    </div>
  </div>
)}
```

---

## User Experience Improvements

### Before Optimization

1. **Preview Button**: Generates new PDF every time (2-5 seconds each)
2. **Download Button**: Regenerates PDF every time (2-5 seconds)
3. **Storage**: Multiple PDFs created per quote (bloat)
4. **Feedback**: Generic "PDF generated" message

### After Optimization

1. **Preview Button**:
   - First time: 2-5 seconds (generates)
   - Subsequent: <100ms (cached) ⚡
   - Toast shows "loaded from cache (instant)" for cached results

2. **Download Button**:
   - Returns cached if available (fast)
   - Regenerates only if quote changed
   - Toast shows cache status

3. **Generate Button**:
   - Smart caching (returns cached if no changes)
   - Force regenerate option in settings
   - Toast shows whether regenerated or cached

4. **Storage**: 1 PDF per quote (automatic cleanup)

---

## Testing Workflow

### Manual Testing Checklist

1. **First Preview**:
   - [ ] Click Preview button
   - [ ] Wait 2-5 seconds for generation
   - [ ] See toast: "PDF preview generated"
   - [ ] PDF opens in modal

2. **Cached Preview**:
   - [ ] Click Preview again immediately
   - [ ] See instant response (<100ms)
   - [ ] See toast: "PDF preview loaded from cache (instant)"
   - [ ] Same PDF opens

3. **After Quote Modification**:
   - [ ] Edit quote (change title or item)
   - [ ] Click Preview
   - [ ] See regeneration (2-5 seconds)
   - [ ] See toast: "PDF preview generated"
   - [ ] Updated PDF reflects changes

4. **Force Regenerate**:
   - [ ] Open settings dropdown (gear icon)
   - [ ] Enable "Force Regenerate" toggle
   - [ ] Click Generate PDF
   - [ ] See regeneration even if no changes
   - [ ] See toast: "PDF generated successfully"

5. **Cost Breakdown Toggle**:
   - [ ] Open settings dropdown
   - [ ] Enable "Include Cost Breakdown"
   - [ ] Click Preview
   - [ ] See regeneration (different params)
   - [ ] PDF includes cost breakdown

6. **Download Button**:
   - [ ] Click Download
   - [ ] See instant download if cached
   - [ ] See toast with cache status
   - [ ] File downloads correctly

---

## Cache Invalidation

The backend automatically invalidates cache when:
- Quote title/description changes
- Items added/removed/modified
- Groups reordered
- Customer info updated
- Attachments added/removed
- Any quote update that changes `updated_at` timestamp

**Frontend does NOT need to handle cache invalidation** - backend handles it automatically.

---

## API Response Examples

### Regenerated Response
```json
{
  "file_id": "uuid-1234",
  "download_url": "/uploads/public/tenant-id/files/quote-123.pdf",
  "filename": "quote-123.pdf",
  "file_size": 524288,
  "generated_at": "2026-01-27T10:30:00Z",
  "regenerated": true
}
```

### Cached Response
```json
{
  "file_id": "uuid-1234",
  "download_url": "/uploads/public/tenant-id/files/quote-123.pdf",
  "filename": "quote-123.pdf",
  "file_size": 524288,
  "generated_at": "2026-01-27T10:30:00Z",
  "regenerated": false
}
```

---

## Files Modified

1. `/app/src/lib/types/quotes.ts` - Added `force_regenerate` to DTO
2. `/app/src/lib/api/quote-pdf.ts` - Added `previewPdf()`, updated docs
3. `/app/src/components/quotes/pdf/PDFActionsMenu.tsx` - Updated handlers
4. `/app/src/components/quotes/pdf/PDFSettingsForm.tsx` - Added force regenerate toggle

---

## Success Criteria

- [x] Preview button uses optimized endpoint
- [x] Toast messages show cache status
- [x] Force regenerate option available in settings
- [x] All three actions (Generate, Preview, Download) provide appropriate feedback
- [x] No TypeScript errors
- [x] Consistent with existing component patterns

---

## Performance Metrics

**Expected Performance** (after cache warm-up):

| Action | Before | After | Improvement |
|--------|--------|-------|-------------|
| Preview (first) | 2-5s | 2-5s | Same |
| Preview (cached) | 2-5s | <100ms | **20-50x faster** |
| Download (cached) | 2-5s | <100ms | **20-50x faster** |
| Generate (no changes) | 2-5s | <100ms | **20-50x faster** |
| Storage per quote | 3-10 PDFs | 1 PDF | **67-90% reduction** |

---

## Next Steps

1. Monitor backend logs for cache hit rates
2. Gather user feedback on performance improvements
3. Consider adding cache statistics to admin dashboard
4. Optional: Add "Last generated" timestamp display in UI

---

**Status**: ✅ Frontend optimization complete - ready for testing
