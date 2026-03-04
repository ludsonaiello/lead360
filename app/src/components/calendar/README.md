# Calendar Components

This directory contains the frontend calendar components for displaying and managing appointments in the Lead360 platform.

## Components

### AppointmentBlock

A reusable appointment display block component that renders appointments as colored blocks with status-based styling.

**Features:**
- ✅ Status-based color coding (scheduled, confirmed, completed, cancelled, etc.)
- ✅ Three display variants (compact, standard, detailed)
- ✅ Position calculation from appointment time
- ✅ Click handlers for interaction
- ✅ Keyboard navigation support (Enter and Space keys)
- ✅ ARIA labels for accessibility
- ✅ Hover tooltips with full appointment details (compact variant)
- ✅ Responsive design
- ✅ Dark mode support
- ✅ Focus states for keyboard navigation

**Variants:**

1. **Compact** - For week view with minimal space
   - Displays: Customer name, appointment type, time
   - Hover tooltip shows full details
   - Minimum height: 30px

2. **Standard** - For day view with more space
   - Displays: Time, customer name, appointment type
   - Shows additional info (phone, assigned user) for taller appointments
   - Minimum height: 60px

3. **Detailed** - For list view or modal display
   - Full card layout with all appointment details
   - Customer info, date/time, assigned user, notes
   - No height restrictions

**Usage:**

```tsx
import { AppointmentBlock } from '@/components/calendar';

// Compact variant (Week View)
<AppointmentBlock
  appointment={appointmentData}
  variant="compact"
  onClick={handleClick}
  showTooltip={true}
  style={{ top: '120px', height: '90px' }}
/>

// Standard variant (Day View)
<AppointmentBlock
  appointment={appointmentData}
  variant="standard"
  onClick={handleClick}
  style={{ top: '240px', height: '120px' }}
/>

// Detailed variant (List View)
<AppointmentBlock
  appointment={appointmentData}
  variant="detailed"
  onClick={handleClick}
/>
```

**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `appointment` | `AppointmentWithRelations` | Yes | - | Appointment data from API |
| `variant` | `'compact' \| 'standard' \| 'detailed'` | No | `'standard'` | Display variant |
| `onClick` | `(appointment) => void` | No | - | Click handler |
| `className` | `string` | No | `''` | Additional CSS classes |
| `style` | `React.CSSProperties` | No | `{}` | Inline styles (for positioning) |
| `showTooltip` | `boolean` | No | `true` | Show hover tooltip (compact variant only) |

**Status Colors:**

| Status | Color | Description |
|--------|-------|-------------|
| `scheduled` | Blue | Appointment scheduled, awaiting confirmation |
| `confirmed` | Green | Appointment confirmed by customer |
| `in_progress` | Yellow | Appointment currently in progress |
| `completed` | Gray | Appointment completed successfully |
| `cancelled` | Red | Appointment cancelled |
| `no_show` | Orange | Customer did not show up |
| `rescheduled` | Purple | Appointment has been rescheduled |

### WeekViewCalendar

Displays appointments in a 7-day week grid with time slots from 6 AM to 9 PM.

**Features:**
- Week navigation (previous/next/today)
- Status-based appointment blocks
- Responsive design
- Mobile scrollable view
- Dark mode support

**Usage:**

```tsx
import { WeekViewCalendar } from '@/components/calendar';

<WeekViewCalendar
  appointments={appointments}
  currentWeekStart={weekStartDate}
  onNavigatePrevious={handlePrevious}
  onNavigateNext={handleNext}
  onNavigateToday={handleToday}
  onAppointmentClick={handleClick}
  loading={isLoading}
/>
```

### DayViewCalendar

Displays appointments for a single day with time slots from 6 AM to 9 PM.

**Features:**
- Day navigation (previous/next/today)
- Mobile swipe navigation (left/right to change days)
- Current time indicator (red line when viewing today)
- Auto-scroll to current time on load
- Empty state display
- Stats bar with appointment counts

**Usage:**

```tsx
import { DayViewCalendar } from '@/components/calendar';

<DayViewCalendar
  appointments={appointments}
  currentDate={currentDate}
  onNavigatePrevious={handlePrevious}
  onNavigateNext={handleNext}
  onNavigateToday={handleToday}
  onAppointmentClick={handleClick}
  loading={isLoading}
/>
```

## Utility Functions

The `calendar.utils.ts` file provides shared utilities for calendar components:

### Time Utilities

- `formatTime(hour)` - Format hour number to 12-hour time string
- `parseTime(timeStr)` - Parse time string (HH:mm) to hours and minutes
- `calculateTopPosition(timeStr, hoursHeight)` - Calculate top position for appointment block
- `calculateHeight(startTime, endTime, hoursHeight)` - Calculate height for appointment block
- `isTimeInVisibleRange(timeStr)` - Check if time is within visible range (6 AM - 10 PM)

### Date Utilities

- `formatDateHeader(date)` - Format date header for display (e.g., "Mar 15")
- `formatFullDate(date)` - Format full date for display (e.g., "Saturday, March 15, 2026")
- `isToday(date)` - Check if date is today
- `getWeekDates(weekStart)` - Get array of dates for a week
- `getSundayOfWeek(date)` - Get Sunday of the current week
- `formatDateKey(date)` - Format date to YYYY-MM-DD string

### Status Utilities

- `getStatusColor(status)` - Get color classes for appointment status
- `getStatusBadgeColor(status)` - Get badge color classes (lighter colors)
- `formatStatusLabel(status)` - Format status for display (e.g., "No Show")

### Grouping Utilities

- `groupAppointmentsByDate(appointments, dates)` - Group appointments by date
- `getCurrentTimePosition(hoursHeight)` - Calculate position for current time indicator

## Constants

```ts
TIME_SLOTS - Array of hours from 6 AM to 9 PM
DAYS_OF_WEEK - Array of day names
HOURS_HEIGHT_WEEK - Height per hour in week view (60px)
HOURS_HEIGHT_DAY - Height per hour in day view (80px)
SWIPE_THRESHOLD - Minimum swipe distance for mobile navigation (50px)
```

## Accessibility

All calendar components follow WCAG 2.1 AA standards:

- **Keyboard Navigation**: All interactive elements are keyboard accessible (Tab, Enter, Space)
- **ARIA Labels**: Descriptive labels for screen readers
- **Focus Indicators**: Clear focus states for keyboard navigation
- **Semantic HTML**: Proper use of roles and attributes
- **Color Contrast**: All text meets WCAG contrast requirements

**Screen Reader Support:**

Appointment blocks announce:
- Appointment type
- Customer name
- Date and time
- Current status

Example: "Quote Visit with John Doe on 2026-03-15 from 09:00 to 10:30 - Confirmed"

## Performance Considerations

- **Memoization**: All calendar views use React.useMemo for expensive calculations
- **Minimal Re-renders**: Components only re-render when props change
- **Virtual Scrolling**: Not needed for current use case (max 16 hours × 7 days)
- **Lazy Loading**: Appointments loaded on-demand per date range

## Mobile Responsiveness

- **Week View**: Horizontal scrollable on mobile (min-width: 800px)
- **Day View**: Mobile swipe gestures for navigation
- **Touch Targets**: Minimum 44×44px tap areas
- **Responsive Typography**: Font sizes scale appropriately

## Testing

To test the appointment block components:

1. **Visual Testing**: Check all status colors render correctly
2. **Interaction Testing**: Verify click and keyboard navigation work
3. **Accessibility Testing**: Test with screen readers (NVDA, JAWS, VoiceOver)
4. **Mobile Testing**: Test swipe navigation on mobile devices
5. **Edge Cases**: Test with:
   - Appointments outside visible range (before 6 AM, after 10 PM)
   - Overlapping appointments
   - Very short appointments (<30 minutes)
   - Very long appointments (>4 hours)
   - Empty states (no appointments)

## Future Enhancements

Potential improvements for future sprints:

- [ ] Drag-and-drop to reschedule appointments
- [ ] Conflict detection and visualization (overlapping appointments)
- [ ] Multi-day appointment support
- [ ] Recurring appointment patterns
- [ ] Calendar export (iCal, Google Calendar)
- [ ] Time zone support for multi-region businesses
- [ ] Month view calendar
- [ ] Appointment reminders/notifications

## Integration with Backend

All components consume the Calendar REST API documented at:
`/var/www/lead360.app/api/documentation/calendar_REST_API.md`

**Key Endpoints Used:**
- `GET /calendar/appointments` - List appointments with filtering
- `GET /calendar/appointments/:id` - Get single appointment details
- `POST /calendar/appointments/:id/confirm` - Confirm appointment
- `POST /calendar/appointments/:id/cancel` - Cancel appointment
- `POST /calendar/appointments/:id/reschedule` - Reschedule appointment

## Support

For questions or issues with calendar components:
- Check the API documentation: `/api/documentation/calendar_REST_API.md`
- Review the feature contract: `/documentation/contracts/calendar-contract.md`
- Contact the development team

---

**Last Updated**: March 2026
**Sprint**: 30 - Appointment Display Blocks
