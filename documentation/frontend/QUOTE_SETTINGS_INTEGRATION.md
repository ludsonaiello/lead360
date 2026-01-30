# Quote Settings API Integration

## Summary

Integrated the Quote Settings page with the real backend API, replacing mock functions with actual API calls.

## Files Created

### 1. `/app/src/lib/api/quote-settings.ts`
**Purpose**: API client for quote settings management

**Exports**:
- `getQuoteSettings()` - GET /quotes/settings
- `updateQuoteSettings(dto)` - PATCH /quotes/settings
- `resetQuoteSettings()` - POST /quotes/settings/reset
- `getApprovalThresholds()` - GET /quotes/settings/approval-thresholds
- `updateApprovalThresholds(dto)` - PATCH /quotes/settings/approval-thresholds

## Files Modified

### 1. `/app/src/lib/types/quotes.ts`
**Changes**:
- Updated `QuoteSettings` interface to match actual API response structure
- Added `UpdateQuoteSettingsDto` for PATCH requests
- Updated `ApprovalThreshold` interface
- Added `ApprovalThresholdsResponse` interface
- Added `UpdateApprovalThresholdsDto` interface
- Added `ResetSettingsResponse` interface

**Key Field Changes**:
- ✅ Added `default_contingency_percent`
- ✅ Renamed `default_tax_percent` → `default_tax_rate_percent`
- ✅ Renamed `quote_number_format` → `quote_number_prefix`
- ✅ Added `auto_generate_quote_numbers`
- ✅ Changed `require_approval` (boolean) → `require_approval_over_amount` (number)
- ✅ Added `show_line_items_by_default`
- ✅ Added `show_cost_breakdown_by_default`

### 2. `/app/src/app/(dashboard)/settings/quotes/page.tsx`
**Changes**:
- Replaced mock API functions with real API client imports
- Updated state object to use `QuoteSettings` type
- Updated all form fields to match API structure
- Added new fields:
  - Default Contingency %
  - Auto-generate Quote Numbers toggle
  - Require Approval Over Amount (as monetary value)
  - Display Options section (show line items, show cost breakdown)
- Updated validation to include new fields
- Updated save handler to use real API and handle responses
- Updated reset handler to use real API
- Improved error handling with proper error messages

## API Endpoints Integrated

### Quote Settings
- ✅ `GET /quotes/settings` - Load current settings
- ✅ `PATCH /quotes/settings` - Save updated settings
- ✅ `POST /quotes/settings/reset` - Reset to system defaults

### Approval Thresholds
- ⏳ `GET /quotes/settings/approval-thresholds` - API client ready (UI not yet built)
- ⏳ `PATCH /quotes/settings/approval-thresholds` - API client ready (UI not yet built)

## Testing Checklist

- [ ] Settings page loads without errors
- [ ] Form displays all fields with correct initial values from API
- [ ] Validation works for all percentage fields (0-100)
- [ ] Validation works for expiration days (min 1)
- [ ] Validation works for quote prefix (required)
- [ ] Validation works for approval amount (non-negative)
- [ ] Save button calls real API and updates settings
- [ ] Success modal shows after successful save
- [ ] Error modal shows with proper error message on failure
- [ ] Reset button calls real API and reverts to defaults
- [ ] Auto-generate toggle enables/disables prefix field
- [ ] Display options toggles work correctly
- [ ] All sections expand/collapse correctly

## Known Issues

The page at `/app/src/app/(dashboard)/settings/quotes/approvals/page.tsx` has a build error (missing `use-toast` hook) - this is a pre-existing issue unrelated to the settings integration.

## Next Steps

1. Fix the broken approvals page (missing hook)
2. Build UI for approval thresholds configuration (API client already ready)
3. Test end-to-end with backend API

## API Documentation Reference

Backend API documentation: `/api/documentation/quotes_REST_API.md` (lines 4179-4256)
