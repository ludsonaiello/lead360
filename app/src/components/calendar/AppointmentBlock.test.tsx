/**
 * AppointmentBlock Component Tests
 * Sprint 41: Calendar Frontend Testing
 *
 * Tests cover:
 * - All three variants (compact, standard, detailed)
 * - Status-based styling
 * - Tooltip functionality
 * - Click and keyboard interactions
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Conditional rendering based on height
 * - Source icons
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppointmentBlock from './AppointmentBlock';
import type { AppointmentWithRelations } from '@/lib/types/calendar';

// ============================================================================
// Mock Data
// ============================================================================

const createMockAppointment = (overrides?: Partial<AppointmentWithRelations>): AppointmentWithRelations => ({
  id: 'apt-123',
  tenant_id: 'tenant-1',
  appointment_type_id: 'type-1',
  lead_id: 'lead-1',
  service_request_id: null,
  scheduled_date: '2026-03-15',
  start_time: '09:00',
  end_time: '10:30',
  start_datetime_utc: '2026-03-15T14:00:00Z',
  end_datetime_utc: '2026-03-15T15:30:00Z',
  status: 'scheduled',
  cancellation_reason: null,
  cancellation_notes: null,
  notes: null,
  source: 'manual',
  external_calendar_event_id: null,
  rescheduled_from_id: null,
  assigned_user_id: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  created_by_user_id: 'user-1',
  cancelled_at: null,
  cancelled_by_user_id: null,
  completed_at: null,
  acknowledged_at: null,
  appointment_type: {
    id: 'type-1',
    name: 'Quote Visit',
    slot_duration_minutes: 90,
  },
  lead: {
    id: 'lead-1',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '(555) 123-4567',
    company_name: 'Acme Corp',
  },
  ...overrides,
});

// ============================================================================
// Compact Variant Tests
// ============================================================================

describe('AppointmentBlock - Compact Variant', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders compact variant correctly', () => {
    const appointment = createMockAppointment();
    render(<AppointmentBlock appointment={appointment} variant="compact" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Quote Visit')).toBeInTheDocument();
    expect(screen.getByText(/09:00 - 10:30/)).toBeInTheDocument();
  });

  it('applies correct status color classes for scheduled', () => {
    const appointment = createMockAppointment({ status: 'scheduled' });
    const { container } = render(<AppointmentBlock appointment={appointment} variant="compact" />);

    const block = container.querySelector('[role="button"]');
    expect(block).toHaveClass('bg-blue-500');
  });

  it('applies correct status color classes for confirmed', () => {
    const appointment = createMockAppointment({ status: 'confirmed' });
    const { container } = render(<AppointmentBlock appointment={appointment} variant="compact" />);

    const block = container.querySelector('[role="button"]');
    expect(block).toHaveClass('bg-green-500');
  });

  it('applies correct status color classes for cancelled', () => {
    const appointment = createMockAppointment({ status: 'cancelled' });
    const { container } = render(<AppointmentBlock appointment={appointment} variant="compact" />);

    const block = container.querySelector('[role="button"]');
    expect(block).toHaveClass('bg-red-500');
  });

  it('shows assigned user when height > 60', () => {
    const appointment = createMockAppointment({
      assigned_user: {
        id: 'user-1',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
      },
    });

    render(
      <AppointmentBlock
        appointment={appointment}
        variant="compact"
        style={{ height: '80px' }}
      />
    );

    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it('hides assigned user when height <= 60', () => {
    const appointment = createMockAppointment({
      assigned_user: {
        id: 'user-1',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
      },
    });

    render(
      <AppointmentBlock
        appointment={appointment}
        variant="compact"
        style={{ height: '50px' }}
      />
    );

    expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
  });

  it('shows tooltip on hover', async () => {
    const appointment = createMockAppointment();
    const user = userEvent.setup();

    render(<AppointmentBlock appointment={appointment} variant="compact" showTooltip={true} />);

    const block = screen.getByRole('button');
    await user.hover(block);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  it('hides tooltip when showTooltip is false', async () => {
    const appointment = createMockAppointment();
    const user = userEvent.setup();

    render(<AppointmentBlock appointment={appointment} variant="compact" showTooltip={false} />);

    const block = screen.getByRole('button');
    await user.hover(block);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('tooltip shows all appointment details', async () => {
    const appointment = createMockAppointment({
      notes: 'Customer requested morning appointment',
    });
    const user = userEvent.setup();

    render(<AppointmentBlock appointment={appointment} variant="compact" showTooltip={true} />);

    const block = screen.getByRole('button');
    await user.hover(block);

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('Quote Visit');
      expect(tooltip).toHaveTextContent('John Doe');
      expect(tooltip).toHaveTextContent('(555) 123-4567');
      expect(tooltip).toHaveTextContent('Acme Corp');
      expect(tooltip).toHaveTextContent('09:00 - 10:30');
      expect(tooltip).toHaveTextContent('Customer requested morning appointment');
    });
  });

  it('truncates long notes in tooltip', async () => {
    const longNotes = 'A'.repeat(150);
    const appointment = createMockAppointment({ notes: longNotes });
    const user = userEvent.setup();

    render(<AppointmentBlock appointment={appointment} variant="compact" showTooltip={true} />);

    const block = screen.getByRole('button');
    await user.hover(block);

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('...');
      // Should only show first 100 characters + ellipsis
      expect(tooltip.textContent?.includes(longNotes.substring(0, 100))).toBe(true);
    });
  });

  it('calls onClick handler when clicked', async () => {
    const appointment = createMockAppointment();
    const user = userEvent.setup();

    render(<AppointmentBlock appointment={appointment} variant="compact" onClick={mockOnClick} />);

    await user.click(screen.getByRole('button'));

    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(mockOnClick).toHaveBeenCalledWith(appointment);
  });

  it('calls onClick on Enter key press', () => {
    const appointment = createMockAppointment();

    render(<AppointmentBlock appointment={appointment} variant="compact" onClick={mockOnClick} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(mockOnClick).toHaveBeenCalledWith(appointment);
  });

  it('calls onClick on Space key press', () => {
    const appointment = createMockAppointment();

    render(<AppointmentBlock appointment={appointment} variant="compact" onClick={mockOnClick} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick on other key presses', () => {
    const appointment = createMockAppointment();

    render(<AppointmentBlock appointment={appointment} variant="compact" onClick={mockOnClick} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' });

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('has correct ARIA label', () => {
    const appointment = createMockAppointment();

    render(<AppointmentBlock appointment={appointment} variant="compact" />);

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Quote Visit with John Doe on 2026-03-15 from 09:00 to 10:30 - Scheduled'
    );
  });

  it('is keyboard focusable when onClick is provided', () => {
    const appointment = createMockAppointment();

    render(<AppointmentBlock appointment={appointment} variant="compact" onClick={mockOnClick} />);

    expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '0');
  });

  it('is not keyboard focusable when onClick is not provided', () => {
    const appointment = createMockAppointment();

    render(<AppointmentBlock appointment={appointment} variant="compact" />);

    expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '-1');
  });

  it('applies custom className', () => {
    const appointment = createMockAppointment();
    const { container } = render(
      <AppointmentBlock
        appointment={appointment}
        variant="compact"
        className="custom-class"
      />
    );

    expect(container.querySelector('[role="button"]')).toHaveClass('custom-class');
  });

  it('applies custom style', () => {
    const appointment = createMockAppointment();
    const { container } = render(
      <AppointmentBlock
        appointment={appointment}
        variant="compact"
        style={{ top: '100px', left: '50px' }}
      />
    );

    const block = container.querySelector('[role="button"]');
    expect(block).toHaveStyle({ top: '100px', left: '50px' });
  });
});

// ============================================================================
// Standard Variant Tests
// ============================================================================

describe('AppointmentBlock - Standard Variant', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders standard variant correctly', () => {
    const appointment = createMockAppointment();
    render(<AppointmentBlock appointment={appointment} variant="standard" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Quote Visit')).toBeInTheDocument();
    expect(screen.getByText(/09:00 - 10:30/)).toBeInTheDocument();
  });

  it('shows additional info when height > 100', () => {
    const appointment = createMockAppointment({
      assigned_user: {
        id: 'user-1',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
      },
    });

    render(
      <AppointmentBlock
        appointment={appointment}
        variant="standard"
        style={{ height: '120px' }}
      />
    );

    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('hides additional info when height <= 100', () => {
    const appointment = createMockAppointment({
      assigned_user: {
        id: 'user-1',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
      },
    });

    render(
      <AppointmentBlock
        appointment={appointment}
        variant="standard"
        style={{ height: '80px' }}
      />
    );

    expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
    expect(screen.queryByText('(555) 123-4567')).not.toBeInTheDocument();
  });

  it('shows status badge when height > 150', () => {
    const appointment = createMockAppointment({ status: 'confirmed' });

    render(
      <AppointmentBlock
        appointment={appointment}
        variant="standard"
        style={{ height: '160px' }}
      />
    );

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('shows source icon when height > 180', () => {
    const appointment = createMockAppointment({ source: 'voice_ai' });

    const { container } = render(
      <AppointmentBlock
        appointment={appointment}
        variant="standard"
        style={{ height: '200px' }}
      />
    );

    expect(container.textContent).toContain('🤖');
  });
});

// ============================================================================
// Detailed Variant Tests
// ============================================================================

describe('AppointmentBlock - Detailed Variant', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders detailed variant correctly', () => {
    const appointment = createMockAppointment();
    render(<AppointmentBlock appointment={appointment} variant="detailed" />);

    expect(screen.getByText('Quote Visit')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('shows status badge with correct styling', () => {
    const appointment = createMockAppointment({ status: 'confirmed' });
    const { container } = render(<AppointmentBlock appointment={appointment} variant="detailed" />);

    const badge = screen.getByText('Confirmed');
    expect(badge).toHaveClass('bg-green-100');
    expect(badge).toHaveClass('text-green-800');
  });

  it('shows voice AI source label', () => {
    const appointment = createMockAppointment({ source: 'voice_ai' });
    render(<AppointmentBlock appointment={appointment} variant="detailed" />);

    expect(screen.getByText(/Voice AI/)).toBeInTheDocument();
    expect(screen.getByText(/🤖/)).toBeInTheDocument();
  });

  it('shows manual source label', () => {
    const appointment = createMockAppointment({ source: 'manual' });
    render(<AppointmentBlock appointment={appointment} variant="detailed" />);

    expect(screen.getByText(/Manual/)).toBeInTheDocument();
    expect(screen.getByText(/✍️/)).toBeInTheDocument();
  });

  it('shows assigned user section', () => {
    const appointment = createMockAppointment({
      assigned_user: {
        id: 'user-1',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
      },
    });

    render(<AppointmentBlock appointment={appointment} variant="detailed" />);

    expect(screen.getByText(/Assigned to: Jane Smith/)).toBeInTheDocument();
  });

  it('shows notes section', () => {
    const appointment = createMockAppointment({
      notes: 'Customer prefers morning appointments',
    });

    render(<AppointmentBlock appointment={appointment} variant="detailed" />);

    expect(screen.getByText('Customer prefers morning appointments')).toBeInTheDocument();
  });

  it('formats date correctly', () => {
    const appointment = createMockAppointment({ scheduled_date: '2026-03-15' });

    render(<AppointmentBlock appointment={appointment} variant="detailed" />);

    // Should display formatted date like "Sunday, March 15, 2026"
    expect(screen.getByText(/March 15, 2026/)).toBeInTheDocument();
  });

  it('handles missing lead gracefully', () => {
    const appointment = createMockAppointment({ lead: undefined });

    render(<AppointmentBlock appointment={appointment} variant="detailed" />);

    // Lead section should not be rendered when lead is missing
    expect(screen.queryByText('john.doe@example.com')).not.toBeInTheDocument();
    // But appointment type should still be shown
    expect(screen.getByText('Quote Visit')).toBeInTheDocument();
  });
});

// ============================================================================
// Status and Source Tests
// ============================================================================

describe('AppointmentBlock - Status and Source', () => {
  it.each([
    ['scheduled', 'bg-blue-500'],
    ['confirmed', 'bg-green-500'],
    ['completed', 'bg-gray-500'],
    ['cancelled', 'bg-red-500'],
    ['no_show', 'bg-orange-500'],
    ['rescheduled', 'bg-purple-500'],
    ['in_progress', 'bg-yellow-500'],
  ])('applies correct color for %s status', (status, expectedClass) => {
    const appointment = createMockAppointment({ status: status as any });
    const { container } = render(<AppointmentBlock appointment={appointment} variant="compact" />);

    expect(container.querySelector('[role="button"]')).toHaveClass(expectedClass);
  });

  it.each([
    ['scheduled', 'Scheduled'],
    ['confirmed', 'Confirmed'],
    ['no_show', 'No Show'],
    ['in_progress', 'In Progress'],
  ])('formats status label correctly: %s -> %s', (status, expectedLabel) => {
    const appointment = createMockAppointment({ status: status as any });
    render(<AppointmentBlock appointment={appointment} variant="detailed" />);

    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it.each([
    ['voice_ai', '🤖'],
    ['manual', '✍️'],
    ['system', '⚙️'],
  ])('shows correct icon for %s source', (source, expectedIcon) => {
    const appointment = createMockAppointment({ source: source as any });
    const { container } = render(<AppointmentBlock appointment={appointment} variant="detailed" />);

    expect(container.textContent).toContain(expectedIcon);
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

describe('AppointmentBlock - Accessibility', () => {
  it('has role="button"', () => {
    const appointment = createMockAppointment();
    render(<AppointmentBlock appointment={appointment} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has descriptive ARIA label with all key info', () => {
    const appointment = createMockAppointment();
    render(<AppointmentBlock appointment={appointment} />);

    const ariaLabel = screen.getByRole('button').getAttribute('aria-label');
    expect(ariaLabel).toContain('Quote Visit');
    expect(ariaLabel).toContain('John Doe');
    expect(ariaLabel).toContain('2026-03-15');
    expect(ariaLabel).toContain('09:00');
    expect(ariaLabel).toContain('10:30');
    expect(ariaLabel).toContain('Scheduled');
  });

  it('is keyboard focusable with onClick', () => {
    const appointment = createMockAppointment();
    const onClick = vi.fn();

    render(<AppointmentBlock appointment={appointment} onClick={onClick} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('tabIndex', '0');

    button.focus();
    expect(button).toHaveFocus();
  });

  it('prevents default on Space key to avoid page scroll', () => {
    const appointment = createMockAppointment();
    const onClick = vi.fn();

    render(<AppointmentBlock appointment={appointment} onClick={onClick} />);

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    screen.getByRole('button').dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
