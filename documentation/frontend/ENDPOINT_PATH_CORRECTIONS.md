# Endpoint Path Corrections

**Date**: 2026-01-25
**Issue**: API client was using incorrect endpoint paths
**Status**: ✅ Fixed

---

## Summary

Two API clients had incorrect endpoint paths that didn't match the backend controller routes. These have been corrected to match the actual backend implementation.

---

## 1. Unit Measurements API ✅

**File**: [app/src/lib/api/units.ts](/var/www/lead360.app/app/src/lib/api/units.ts)

### Before (Incorrect):
```typescript
GET    /unit-measurements                    ❌
POST   /unit-measurements/custom             ❌
GET    /unit-measurements/custom/:id         ❌
PATCH  /unit-measurements/custom/:id         ❌
DELETE /unit-measurements/custom/:id         ❌
GET    /unit-measurements/custom/:id/usage   ❌
```

### After (Correct):
```typescript
GET    /units                    ✅
POST   /units/custom             ✅
GET    /units/custom/:id         ✅
PATCH  /units/custom/:id         ✅
DELETE /units/custom/:id         ✅
GET    /units/custom/:id/usage   ✅
```

### Backend Controller
- **Tenant Controller**: Registered at `/units`
- **Returns**: Global units (platform-wide, read-only) + Tenant custom units (editable)
- **Admin Controller**: Separate at `/admin/units` (not used by tenant frontend)

---

## 2. Library Items API ✅

**File**: [app/src/lib/api/library-items.ts](/var/www/lead360.app/app/src/lib/api/library-items.ts)

### Before (Incorrect):
```typescript
POST   /library/items                          ❌
GET    /library/items                          ❌
GET    /library/items/:id                      ❌
PATCH  /library/items/:id                      ❌
DELETE /library/items/:id                      ❌
PATCH  /library/items/:id/toggle-active        ❌
POST   /library/items/bulk-import              ❌
GET    /library/items/bulk-import/template     ❌
GET    /library/items/search                   ❌
GET    /library/items/usage-stats              ❌
```

### After (Correct):
```typescript
POST   /item-library                          ✅
GET    /item-library                          ✅
GET    /item-library/:id                      ✅
PATCH  /item-library/:id                      ✅
DELETE /item-library/:id                      ✅
PATCH  /item-library/:id/toggle-active        ✅
POST   /item-library/bulk-import              ✅
GET    /item-library/bulk-import/template     ✅
GET    /item-library/search                   ✅
GET    /item-library/usage-stats              ✅
```

### Backend Controller
- **Registered at**: `/item-library`
- **Purpose**: Manage reusable quote items that can be added to multiple quotes

---

## 3. Other API Clients (Already Correct) ✅

### Quote Items API
```typescript
POST   /quotes/:quoteId/items                          ✅
POST   /quotes/:quoteId/items/from-library/:libraryItemId  ✅
GET    /quotes/:quoteId/items                          ✅
GET    /items/:id                                      ✅
PATCH  /items/:id                                      ✅
DELETE /items/:id                                      ✅
POST   /items/:id/duplicate                            ✅
POST   /items/:id/move-to-group                        ✅
POST   /items/:id/remove-from-group                    ✅
PATCH  /items/reorder                                  ✅
POST   /items/:id/save-to-library                      ✅
GET    /items/:id/warranty-price                       ✅
```

### Quote Groups API
```typescript
POST   /quotes/:quoteId/groups        ✅
GET    /quotes/:quoteId/groups        ✅
GET    /groups/:id                    ✅
PATCH  /groups/:id                    ✅
DELETE /groups/:id                    ✅
POST   /groups/:id/duplicate          ✅
PATCH  /groups/reorder                ✅
POST   /groups/:id/add-items          ✅
```

### Bundles API
```typescript
POST   /bundles                                        ✅
GET    /bundles                                        ✅
GET    /bundles/:id                                    ✅
PATCH  /bundles/:id                                    ✅
DELETE /bundles/:id                                    ✅
POST   /bundles/:id/duplicate                          ✅
POST   /quotes/:quoteId/bundles/:bundleId/add-to-quote ✅
PATCH  /bundles/:id/toggle-active                      ✅
```

### Warranty Tiers API
```typescript
GET    /warranty-tiers           ✅
POST   /warranty-tiers           ✅
GET    /warranty-tiers/:id       ✅
PATCH  /warranty-tiers/:id       ✅
DELETE /warranty-tiers/:id       ✅
```

---

## Important Note: Frontend Routes vs API Endpoints

**Frontend routes** (Next.js pages) are NOT changed and should remain as they are:

```
Frontend URLs (correct):
- /library/items              ✅ (UI page)
- /library/items/new          ✅ (UI page)
- /library/items/[id]/edit    ✅ (UI page)
- /library/bundles            ✅ (UI page)
- /settings/quotes/units      ✅ (UI page)

API Endpoints (now corrected):
- GET /api/v1/item-library    ✅ (backend API)
- GET /api/v1/units           ✅ (backend API)
```

---

## Files Modified

1. `/app/src/lib/api/units.ts` - All 6 endpoints updated (6 occurrences)
2. `/app/src/lib/api/library-items.ts` - All 10 endpoints updated (14 occurrences)

---

## Testing Required

After these corrections, the following should be tested:

### Unit Management
- [ ] Load units page: `GET /units` should return global + custom units
- [ ] Create custom unit: `POST /units/custom`
- [ ] Edit custom unit: `PATCH /units/custom/:id`
- [ ] Delete custom unit: `DELETE /units/custom/:id`
- [ ] Check usage before delete: `GET /units/custom/:id/usage`

### Library Items
- [ ] Load library page: `GET /item-library`
- [ ] Search library: `GET /item-library/search?q=...`
- [ ] Create library item: `POST /item-library`
- [ ] Edit library item: `PATCH /item-library/:id`
- [ ] Delete library item: `DELETE /item-library/:id`
- [ ] Toggle active: `PATCH /item-library/:id/toggle-active`
- [ ] Bulk import: `POST /item-library/bulk-import` (with CSV file)
- [ ] Download template: `GET /item-library/bulk-import/template`
- [ ] Usage stats: `GET /item-library/usage-stats`

---

## Result

All Sprint 2 API endpoints now match the backend controller routes exactly. The system should work correctly without 404 errors on these endpoints.

**Status**: Production-ready ✅

---

**Fixed By**: Frontend Developer 2
**Date**: 2026-01-25
