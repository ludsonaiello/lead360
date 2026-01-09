# Background Jobs - Debugging Information

## Logging Added

I've added comprehensive logging to help diagnose any issues with the job dashboard:

### 1. API Client Logging (`/src/lib/api/jobs.ts`)

**Location**: `getJobs()` function

**Logs**:
- `[API] GET Jobs - URL:` - Shows the exact API endpoint being called with query parameters
- `[API] GET Jobs - Raw Response:` - Shows the raw API response including:
  - HTTP status code
  - Complete response data
  - Data type validation
  - Checks if `data` and `pagination` fields exist

### 2. Hook Logging (`/src/lib/hooks/useJobs.ts`)

**Location**: `useJobs` hook

**Logs**:
- `[useJobs] Effect triggered - fetching jobs` - When the useEffect runs
- `[useJobs] Fetching jobs with filters:` - Shows current filter values
- `[useJobs] API Response:` - Shows parsed response with:
  - Job count
  - Pagination info
  - First job data (if any)
- `[useJobs] Setting up auto-refresh with interval:` - Shows refresh interval
- `[useJobs] Auto-refresh triggered` - When auto-refresh executes
- `[useJobs] Cleaning up interval` - When component unmounts
- `[useJobs] Error fetching jobs:` - If an error occurs

## How to View Logs

### Browser Console
1. Open the page `/admin/jobs`
2. Open browser DevTools (F12)
3. Go to **Console** tab
4. You should see logs like:

```
[useJobs] Effect triggered - fetching jobs
[useJobs] Fetching jobs with filters: {page: 1, limit: 50}
[API] GET Jobs - URL: /admin/jobs?page=1&limit=50
[API] GET Jobs - Raw Response: {status: 200, data: {...}, ...}
[useJobs] API Response: {jobsCount: 0, pagination: {...}, firstJob: undefined}
```

## Potential Issues to Watch For

### 1. Infinite Loop
**Symptom**: Console shows rapid, continuous API calls (multiple per second)

**Cause**: The `fetchJobs` callback dependency changes cause the useEffect to re-run continuously.

**What to look for**:
```
[useJobs] Effect triggered - fetching jobs
[API] GET Jobs - URL: ...
[useJobs] Effect triggered - fetching jobs  // ← Too soon!
[API] GET Jobs - URL: ...
[useJobs] Effect triggered - fetching jobs  // ← Loop detected!
```

**Current Implementation**:
- The hook uses `useCallback` with `[filters, failedOnly]` dependencies
- The effect has `[fetchJobs, autoRefresh, refreshInterval]` dependencies
- This should be safe, but if `filters` object changes on every render, it will cause re-fetching

**Fix if needed**: We may need to memoize the filters object or use a different approach.

### 2. API Response Issues
**Symptom**: No jobs displayed, or errors shown

**Check**:
```
[API] GET Jobs - Raw Response: {
  status: 200,  // ← Should be 200
  hasData: true,  // ← Should be true
  hasPagination: true,  // ← Should be true
}
```

**Common issues**:
- `status` not 200 - API error
- `hasData` false - Response missing `data` field
- `hasPagination` false - Response missing `pagination` field
- Empty `data` array - No jobs in database

### 3. Auto-Refresh Issues
**Symptom**: Jobs don't update automatically

**Check logs for**:
```
[useJobs] Setting up auto-refresh with interval: 5000
[useJobs] Auto-refresh triggered  // ← Should appear every 5 seconds
```

**If not appearing**: Auto-refresh may not be enabled or interval is being cleared prematurely.

## Expected Behavior

### Normal Operation
1. **Initial Load**:
   ```
   [useJobs] Effect triggered - fetching jobs
   [useJobs] Fetching jobs with filters: {}
   [API] GET Jobs - URL: /admin/jobs?
   [API] GET Jobs - Raw Response: {...}
   [useJobs] API Response: {jobsCount: X, ...}
   [useJobs] Setting up auto-refresh with interval: 5000
   ```

2. **Auto-Refresh (every 5 seconds)**:
   ```
   [useJobs] Auto-refresh triggered
   [useJobs] Fetching jobs with filters: {}
   [API] GET Jobs - URL: /admin/jobs?
   [API] GET Jobs - Raw Response: {...}
   [useJobs] API Response: {jobsCount: X, ...}
   ```

3. **Filter Change**:
   ```
   [useJobs] Cleaning up interval
   [useJobs] Effect triggered - fetching jobs
   [useJobs] Fetching jobs with filters: {status: 'failed'}
   [API] GET Jobs - URL: /admin/jobs?status=failed
   ...
   ```

4. **Unmount**:
   ```
   [useJobs] Cleaning up interval
   ```

## Troubleshooting

### Too Many API Calls
**Problem**: API calls happening more than once per 5 seconds

**Solutions**:
1. Check if filters are changing unexpectedly
2. Check if multiple instances of the hook are running
3. Check if the component is re-mounting frequently

**Debug**:
- Count how many times `[API] GET Jobs` appears in console per 5 seconds
- Should be exactly 1 time per 5 seconds (when auto-refresh is enabled)
- If more, there's a loop or multiple instances

### No Data Displayed
**Problem**: No jobs shown in the UI

**Check**:
1. API response status: Should be 200
2. Response structure: Should have `data` and `pagination`
3. Jobs array: `response.data.data` should be an array
4. Database: Are there actually jobs in the database?

**Debug**:
```javascript
// Check this in console logs:
[API] GET Jobs - Raw Response: {
  status: 200,
  data: {
    data: [...],  // ← This array should have items
    pagination: {...}
  }
}
```

### Performance Issues
**Problem**: Page is slow or unresponsive

**Check**:
1. Number of jobs being fetched (pagination limit)
2. Frequency of auto-refresh
3. Size of individual job objects

**Optimize**:
- Reduce `refreshInterval` if page is slow
- Reduce `limit` in filters to fetch fewer jobs per page
- Consider disabling `autoRefresh` if not needed

## Removing Logs

Once debugging is complete, you can remove the console.log statements:

### Files to clean:
1. `/app/src/lib/api/jobs.ts` - Remove logs from `getJobs()` function
2. `/app/src/lib/hooks/useJobs.ts` - Remove all `console.log()` calls

Or keep them for production debugging (they don't affect functionality).

## Next Steps

1. **Load the page** `/admin/jobs`
2. **Open browser console** (F12)
3. **Check the logs** - Look for patterns described above
4. **Report findings**:
   - Is there a loop? (multiple calls per second)
   - Are API calls successful? (status 200)
   - Is data being returned? (hasData: true)
   - Any error messages?

Based on the logs, we can identify the exact issue and fix it.
