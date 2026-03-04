# LeadAutocomplete Component

**Sprint 32** - Reusable lead autocomplete component with debounced search

## Overview

A production-ready autocomplete component for searching and selecting leads by name, phone, or email. Features debounced search, keyboard navigation, and full accessibility support.

## Features

- ✅ **Debounced Search** - 300ms debounce to reduce API calls
- ✅ **Search Flexibility** - Searches by name, phone, or email
- ✅ **Keyboard Navigation** - Full keyboard support (ArrowUp, ArrowDown, Enter, Escape)
- ✅ **Loading States** - Visual feedback during search
- ✅ **Error Handling** - Graceful error messages and retry
- ✅ **Selected State** - Clear display of selected lead with details
- ✅ **Dark Mode** - Full dark mode support
- ✅ **Mobile Responsive** - Works on all screen sizes
- ✅ **Accessibility** - ARIA labels, keyboard navigation, screen reader support
- ✅ **Click Outside** - Auto-close dropdown when clicking outside

## Usage

### Basic Example

```tsx
'use client';

import { useState } from 'react';
import { LeadAutocomplete } from '@/components/calendar';
import type { Lead } from '@/lib/types/leads';

export default function MyComponent() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  return (
    <LeadAutocomplete
      value={selectedLead}
      onChange={setSelectedLead}
      placeholder="Search for a lead..."
    />
  );
}
```

### With Form Integration

```tsx
'use client';

import { useState } from 'react';
import { LeadAutocomplete } from '@/components/calendar';
import type { Lead } from '@/lib/types/leads';

export default function AppointmentForm() {
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!lead) {
      setError('Please select a lead');
      return;
    }

    // Process form with lead.id
    console.log('Creating appointment for lead:', lead.id);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block mb-2 text-sm font-medium">
          Select Lead *
        </label>
        <LeadAutocomplete
          value={lead}
          onChange={(newLead) => {
            setLead(newLead);
            setError(''); // Clear error on selection
          }}
          error={error}
          placeholder="Search by name, phone, or email..."
        />
      </div>

      <button type="submit" className="btn-primary">
        Create Appointment
      </button>
    </form>
  );
}
```

### With Disabled State

```tsx
<LeadAutocomplete
  value={selectedLead}
  onChange={setSelectedLead}
  disabled={isProcessing}
  placeholder="Search for a lead..."
/>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `Lead \| null` | No | `null` | Currently selected lead |
| `onChange` | `(lead: Lead \| null) => void` | Yes | - | Callback when selection changes |
| `placeholder` | `string` | No | `'Search for a lead by name, phone, or email...'` | Input placeholder text |
| `className` | `string` | No | `''` | Additional CSS classes for container |
| `error` | `string` | No | - | Error message to display |
| `disabled` | `boolean` | No | `false` | Whether the component is disabled |

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `ArrowDown` | Move selection down in dropdown |
| `ArrowUp` | Move selection up in dropdown |
| `Enter` | Select highlighted lead |
| `Escape` | Close dropdown or clear selection |

## API Integration

The component uses the `getLeads` function from `/lib/api/leads.ts`:

```typescript
const response = await getLeads({
  search: query,
  limit: 10
});
```

This searches across:
- Lead first name
- Lead last name
- Email addresses
- Phone numbers

## Display Format

Each search result shows:
- **Lead Name** - First name + Last name
- **Primary Email** - With mail icon
- **Primary Phone** - Formatted as (XXX) XXX-XXXX
- **Status** - Current lead status (lead, prospect, customer, lost)

Selected lead displays the same information in a compact card format.

## Styling

The component uses Tailwind CSS classes and supports:
- Light mode (default)
- Dark mode (automatic via `dark:` classes)
- Custom styling via `className` prop

## Accessibility

- ARIA labels on all interactive elements
- `role="listbox"` on dropdown
- `role="option"` on results
- `aria-selected` for keyboard navigation
- `aria-invalid` for error states
- `aria-describedby` linking errors to input

## Performance

- **Debounce**: 300ms delay before API call
- **Minimum Query**: 2 characters required
- **Result Limit**: 10 leads maximum
- **Auto-cleanup**: Timers cleared on unmount

## Error Handling

The component handles:
- Network errors (shows user-friendly message)
- Empty results (shows "No leads found")
- API validation errors (displays error prop)

## Testing

A demo page is available at:
```
/calendar/lead-autocomplete-demo
```

Test with:
- Admin user: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant user: `contact@honeydo4you.com` / `978@F32c`

## Example Use Cases

1. **Appointment Booking** - Select lead when creating appointments
2. **Service Request Forms** - Link service request to lead
3. **Quick Lead Lookup** - Find lead details quickly
4. **Quote Creation** - Select customer for new quote

## Dependencies

- React 18+
- lucide-react (icons)
- @/lib/api/leads (API client)
- @/lib/types/leads (TypeScript types)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Related Components

- `SearchAutocomplete` - Quote search autocomplete
- `AddressAutocomplete` - Google Places autocomplete
- `CityAutocomplete` - City search autocomplete

## Future Enhancements

Potential improvements for future sprints:
- Recent searches cache
- Fuzzy search scoring
- Result grouping by status
- Infinite scroll for large result sets
- Custom result rendering via render prop

## Support

For issues or questions:
- Check the demo page at `/calendar/lead-autocomplete-demo`
- Review API documentation at `/api/documentation/leads_REST_API.md`
- Test API endpoint: `GET /api/v1/leads?search={query}`
