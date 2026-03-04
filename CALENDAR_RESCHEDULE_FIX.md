# Calendar Reschedule Fix - Multiple Reschedules Support

## Problem Summary

Users were unable to reschedule appointments multiple times because the calendar was displaying BOTH old rescheduled appointments AND new active appointments. When users clicked on an old rescheduled appointment (which has terminal status), the backend correctly rejected the reschedule request.

### Error Message
```
Cannot modify appointment {id}. Status 'rescheduled' is a terminal state and cannot be changed.
```

## Root Cause

1. **Calendar displayed ALL appointments** regardless of status (scheduled, confirmed, rescheduled, cancelled, completed, no_show)
2. **No default filtering** - status filter was set to `'all'` by default
3. **Backend correctly marked old appointments as terminal** - this is correct behavior
4. **Users could click on historical appointments** that shouldn't be modified

## How Rescheduling Should Work (CORRECT FLOW)

```
Original Appointment A (3/5 @ 9:00 AM) - status: 'scheduled'
   ↓ User reschedules
   ├─→ Appointment A becomes status: 'rescheduled' (terminal/historical)
   └─→ NEW Appointment B created (3/5 @ 2:00 PM) - status: 'scheduled'
      ↓ User reschedules AGAIN
      ├─→ Appointment B becomes status: 'rescheduled' (terminal/historical)
      └─→ NEW Appointment C created (3/6 @ 10:00 AM) - status: 'scheduled'
         ↓ Can reschedule infinite times...
```

**Key Point**: You reschedule the LATEST appointment (status: 'scheduled' or 'confirmed'), NOT the old historical ones.

## Solution Implemented

### Frontend Changes (app/src/app/(dashboard)/calendar/page.tsx)

#### 1. Added New State Variables
```typescript
const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all' | 'active'>('active');
const [showInactive, setShowInactive] = useState(false);
```

#### 2. Client-Side Filtering
**For Calendar Views (Week/Day):**
- Default: Only show **active** appointments (status: 'scheduled' or 'confirmed')
- Toggle available: Users can enable "Show inactive" to see historical appointments
- Historical appointments (rescheduled, cancelled, completed, no_show) are hidden by default

**For List View:**
- New "Active" filter option (default) - shows only scheduled and confirmed
- Individual status filters available: Scheduled, Confirmed, Completed, Cancelled, Rescheduled, No Show
- "All" option to see everything

#### 3. Filter Logic
```typescript
// For calendar views (week/day), filter out inactive appointments unless user wants to see them
if (view === 'week' || view === 'day') {
  if (!showInactive) {
    // Only show active appointments (scheduled and confirmed)
    filteredAppointments = appointmentsRes.items.filter(
      (apt) => apt.status === 'scheduled' || apt.status === 'confirmed'
    );
  }
} else if (view === 'list' && statusFilter === 'active') {
  // For list view with 'active' filter, show only scheduled and confirmed
  filteredAppointments = appointmentsRes.items.filter(
    (apt) => apt.status === 'scheduled' || apt.status === 'confirmed'
  );
}
```

#### 4. Updated UI

**Calendar Views (Week/Day):**
```
[Filter] Show inactive appointments (cancelled, rescheduled, completed): [Toggle Switch]
                                                                          Active only / Showing all
```

**List View:**
```
[Filter] Filter by status: [Active] [All] [Scheduled] [Confirmed] [Completed] [Cancelled] [Rescheduled] [No Show]
```

## Backend (No Changes Needed)

The backend business logic is **CORRECT** and remains unchanged:

### Terminal States (Cannot be Modified)
```typescript
private readonly TERMINAL_STATES = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.RESCHEDULED, // ← Correct - old rescheduled appointments are historical
];
```

### State Transitions (Correct)
```
scheduled ──> confirmed ──> completed
   │              │
   ├─────> cancelled (reason required)
   ├─────> no_show (reason = no_show)
   └─────> rescheduled (auto-set by reschedule action)
```

### Reschedule Logic (Correct)
```typescript
async rescheduleAppointment() {
  // 1. Validate old appointment can be rescheduled (must be 'scheduled' or 'confirmed')
  // 2. Mark OLD appointment as 'rescheduled' (terminal state)
  // 3. Create NEW appointment with status 'scheduled'
  // 4. Link new to old via rescheduled_from_id
  // 5. Return the NEW appointment
}
```

## Result

✅ **Users can now reschedule appointments infinite times**
- Only the ACTIVE/LATEST appointment is shown in calendar views
- Old rescheduled appointments are hidden by default (but can be viewed if needed)
- Each reschedule creates a NEW active appointment
- Historical appointments are preserved for audit trail

✅ **No accidental clicks on historical appointments**
- Users can't accidentally try to reschedule an old rescheduled appointment
- Clear visual separation between active and historical appointments

✅ **Flexible filtering**
- Calendar views: Toggle to show/hide inactive appointments
- List view: Granular status filters for reporting and history review

## Testing Checklist

- [x] Create appointment A (3/5 @ 9:00 AM)
- [x] Reschedule to 3/5 @ 2:00 PM → Creates appointment B, marks A as 'rescheduled'
- [x] Calendar should only show appointment B (not A)
- [x] Reschedule B to 3/6 @ 10:00 AM → Creates appointment C, marks B as 'rescheduled'
- [x] Calendar should only show appointment C (not A or B)
- [x] Toggle "Show inactive" → Should show A, B, and C
- [x] Toggle off "Show inactive" → Should show only C
- [x] List view with "Active" filter → Shows only appointments with status 'scheduled' or 'confirmed'
- [x] List view with "Rescheduled" filter → Shows only historical rescheduled appointments
- [x] Appointment detail modal should hide action buttons for rescheduled appointments

## File Changes

### Modified Files
1. **app/src/app/(dashboard)/calendar/page.tsx**
   - Added `showInactive` toggle state
   - Changed default `statusFilter` from `'all'` to `'active'`
   - Added client-side filtering logic
   - Updated filter UI with toggle for calendar views
   - Added more status options for list view

### No Backend Changes Required
- Business logic is correct as-is
- Terminal states are properly enforced
- Reschedule creates new appointments correctly

## Migration Notes

**No database migration needed** - this is a frontend-only fix.

**No API changes needed** - backend behavior is correct.

**User Impact**: Users will immediately see cleaner calendar views with only active appointments by default.

## Future Enhancements (Optional)

1. **Reschedule History View**: Show chain of rescheduled appointments in detail modal
   - Original appointment → Rescheduled to X → Rescheduled to Y → Current appointment

2. **Reschedule Reason Tracking**: Currently optional, could be made more prominent

3. **Notification on Multiple Reschedules**: Alert tenant if a lead reschedules more than 2-3 times
