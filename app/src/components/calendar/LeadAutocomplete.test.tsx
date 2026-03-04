/**
 * LeadAutocomplete Component Tests
 * Sprint 32: Lead Autocomplete Component
 *
 * Tests cover:
 * - Component rendering
 * - Debounced search functionality
 * - Keyboard navigation
 * - Selection and clearing
 * - Error states
 * - Accessibility
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import LeadAutocomplete from './LeadAutocomplete';
import * as leadsApi from '@/lib/api/leads';
import type { Lead } from '@/lib/types/leads';

// Mock the leads API
vi.mock('@/lib/api/leads', () => ({
  getLeads: vi.fn(),
  formatPhone: (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) return phone;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  },
}));

// Mock lead data
const mockLeads: Lead[] = [
  {
    id: 'lead-1',
    tenant_id: 'tenant-1',
    first_name: 'John',
    last_name: 'Doe',
    language_spoken: 'EN',
    accept_sms: false,
    sms_opt_out: false,
    preferred_communication: 'email',
    status: 'lead',
    source: 'manual',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    emails: [
      {
        id: 'email-1',
        lead_id: 'lead-1',
        email: 'john.doe@example.com',
        is_primary: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    phones: [
      {
        id: 'phone-1',
        lead_id: 'lead-1',
        phone: '5551234567',
        phone_type: 'mobile',
        is_primary: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    addresses: [],
    service_requests: [],
  },
  {
    id: 'lead-2',
    tenant_id: 'tenant-1',
    first_name: 'Jane',
    last_name: 'Smith',
    language_spoken: 'EN',
    accept_sms: true,
    sms_opt_out: false,
    preferred_communication: 'phone',
    status: 'prospect',
    source: 'website',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    emails: [
      {
        id: 'email-2',
        lead_id: 'lead-2',
        email: 'jane.smith@example.com',
        is_primary: true,
        created_at: '2026-01-02T00:00:00Z',
      },
    ],
    phones: [
      {
        id: 'phone-2',
        lead_id: 'lead-2',
        phone: '5559876543',
        phone_type: 'work',
        is_primary: true,
        created_at: '2026-01-02T00:00:00Z',
      },
    ],
    addresses: [],
    service_requests: [],
  },
];

describe('LeadAutocomplete', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders search input when no lead is selected', () => {
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      expect(screen.getByPlaceholderText(/search for a lead/i)).toBeInTheDocument();
    });

    it('renders selected lead when value is provided', () => {
      render(<LeadAutocomplete value={mockLeads[0]} onChange={mockOnChange} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
    });

    it('applies custom placeholder', () => {
      render(
        <LeadAutocomplete
          value={null}
          onChange={mockOnChange}
          placeholder="Find customer"
        />
      );

      expect(screen.getByPlaceholderText('Find customer')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <LeadAutocomplete
          value={null}
          onChange={mockOnChange}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Search Functionality', () => {
    it('does not search with less than 2 characters', async () => {
      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'J');

      await waitFor(() => {
        expect(leadsApi.getLeads).not.toHaveBeenCalled();
      });
    });

    it('performs debounced search after 300ms', async () => {
      vi.mocked(leadsApi.getLeads).mockResolvedValueOnce({
        data: mockLeads,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'John');

      // Should not call immediately
      expect(leadsApi.getLeads).not.toHaveBeenCalled();

      // Should call after debounce
      await waitFor(
        () => {
          expect(leadsApi.getLeads).toHaveBeenCalledWith({
            search: 'John',
            limit: 10,
          });
        },
        { timeout: 500 }
      );
    });

    it('displays search results in dropdown', async () => {
      vi.mocked(leadsApi.getLeads).mockResolvedValueOnce({
        data: mockLeads,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it.skip('shows no results message when search returns empty', async () => {
      vi.mocked(leadsApi.getLeads).mockResolvedValueOnce({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'nonexistent');

      await waitFor(
        () => {
          expect(screen.getByText(/no leads found/i)).toBeInTheDocument();
        },
        { timeout: 1000 } // Increase timeout to account for debounce (300ms) + API call
      );
    });

    it('shows loading state during search', async () => {
      vi.mocked(leadsApi.getLeads).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  data: mockLeads,
                  meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
                }),
              1000
            );
          })
      );

      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'test');

      await waitFor(() => {
        // Check for loading spinner (animate-spin class)
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
    });
  });

  describe('Selection', () => {
    it('calls onChange when lead is selected', async () => {
      vi.mocked(leadsApi.getLeads).mockResolvedValueOnce({
        data: mockLeads,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.click(screen.getByText('John Doe'));

      expect(mockOnChange).toHaveBeenCalledWith(mockLeads[0]);
    });

    it('clears search after selection', async () => {
      vi.mocked(leadsApi.getLeads).mockResolvedValueOnce({
        data: mockLeads,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      const user = userEvent.setup();
      const { rerender } = render(
        <LeadAutocomplete value={null} onChange={mockOnChange} />
      );

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.click(screen.getByText('John Doe'));

      // Rerender with selected value
      rerender(<LeadAutocomplete value={mockLeads[0]} onChange={mockOnChange} />);

      // Search input should be replaced with selected lead display
      expect(screen.queryByPlaceholderText(/search for a lead/i)).not.toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('clears selection when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<LeadAutocomplete value={mockLeads[0]} onChange={mockOnChange} />);

      const clearButton = screen.getByLabelText(/clear selection/i);
      await user.click(clearButton);

      expect(mockOnChange).toHaveBeenCalledWith(null);
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates down with ArrowDown key', async () => {
      vi.mocked(leadsApi.getLeads).mockResolvedValueOnce({
        data: mockLeads,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.keyboard('{ArrowDown}');

      // First item should be highlighted (has bg-blue-50 or bg-blue-900/20)
      const firstOption = screen.getByText('John Doe').closest('button');
      expect(firstOption).toHaveClass('bg-blue-50');
    });

    it('selects highlighted item with Enter key', async () => {
      vi.mocked(leadsApi.getLeads).mockResolvedValueOnce({
        data: mockLeads,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.keyboard('{ArrowDown}{Enter}');

      expect(mockOnChange).toHaveBeenCalledWith(mockLeads[0]);
    });

    it('closes dropdown with Escape key', async () => {
      vi.mocked(leadsApi.getLeads).mockResolvedValueOnce({
        data: mockLeads,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error prop', () => {
      render(
        <LeadAutocomplete
          value={null}
          onChange={mockOnChange}
          error="Please select a lead"
        />
      );

      expect(screen.getByText('Please select a lead')).toBeInTheDocument();
    });

    it('shows error message when API call fails', async () => {
      vi.mocked(leadsApi.getLeads).mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText(/failed to search leads/i)).toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      render(<LeadAutocomplete value={null} onChange={mockOnChange} disabled />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      expect(input).toBeDisabled();
    });

    it('disables clear button when disabled', () => {
      render(<LeadAutocomplete value={mockLeads[0]} onChange={mockOnChange} disabled />);

      const clearButton = screen.getByLabelText(/clear selection/i);
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByLabelText(/search for lead/i);
      expect(input).toBeInTheDocument();
    });

    it('sets aria-invalid when error is present', () => {
      render(
        <LeadAutocomplete
          value={null}
          onChange={mockOnChange}
          error="Required field"
        />
      );

      const input = screen.getByPlaceholderText(/search for a lead/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('links error message with aria-describedby', () => {
      render(
        <LeadAutocomplete
          value={null}
          onChange={mockOnChange}
          error="Required field"
        />
      );

      const input = screen.getByPlaceholderText(/search for a lead/i);
      const errorId = input.getAttribute('aria-describedby');
      expect(errorId).toBe('lead-autocomplete-error');

      const errorMessage = document.getElementById(errorId!);
      expect(errorMessage).toHaveTextContent('Required field');
    });

    it('uses role="listbox" on dropdown', async () => {
      vi.mocked(leadsApi.getLeads).mockResolvedValueOnce({
        data: mockLeads,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      const user = userEvent.setup();
      render(<LeadAutocomplete value={null} onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/search for a lead/i);
      await user.type(input, 'test');

      await waitFor(() => {
        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
      });
    });
  });
});
