/**
 * LeadSelector Component
 * Searchable dropdown to select existing lead OR create new lead inline
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Select, SelectOption } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Button } from '@/components/ui/Button';
import { getLeads } from '@/lib/api/leads';
import { UserPlus, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { LeadListItem } from '@/lib/types/leads';

interface LeadSelectorProps {
  value?: string; // Lead ID
  leadData?: LeadListItem | NewLeadData | null; // Current lead data from parent
  onChange: (leadId: string | null, leadData: LeadListItem | NewLeadData | null) => void;
  error?: string;
  required?: boolean;
  className?: string;
}

interface NewLeadData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name?: string;
  isNew: true;
}

export function LeadSelector({
  value,
  leadData,
  onChange,
  error,
  required = false,
  className = '',
}: LeadSelectorProps) {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadListItem | null>(null);

  // New lead form state
  const [newLead, setNewLead] = useState<Omit<NewLeadData, 'isNew'>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load leads on mount
  useEffect(() => {
    loadLeads();
  }, []);

  // Restore state from leadData prop (when navigating back to this step)
  useEffect(() => {
    if (leadData && 'isNew' in leadData && leadData.isNew) {
      // Restore new customer form
      setShowCreateForm(true);
      setNewLead({
        first_name: leadData.first_name,
        last_name: leadData.last_name,
        email: leadData.email,
        phone: leadData.phone,
        company_name: leadData.company_name,
      });
      setSelectedLead(null);
    } else if (leadData && 'id' in leadData) {
      // Restore existing lead selection
      setShowCreateForm(false);
      setSelectedLead(leadData);
    }
  }, [leadData]);

  // Load selected lead data when value changes
  useEffect(() => {
    if (value && !showCreateForm) {
      const lead = leads.find((l) => l.id === value);
      if (lead) {
        setSelectedLead(lead);
      }
    } else if (!value) {
      setSelectedLead(null);
    }
  }, [value, leads, showCreateForm]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const response = await getLeads({ limit: 100 });
      setLeads(response.data);
    } catch (err: any) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const leadOptions: SelectOption[] = leads.map((lead) => ({
    value: lead.id,
    label: `${lead.first_name} ${lead.last_name}${lead.company_name ? ` (${lead.company_name})` : ''}`,
  }));

  const handleLeadSelect = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      setSelectedLead(lead);
      setShowCreateForm(false);
      onChange(leadId, lead);
    }
  };

  const handleCreateNewClick = () => {
    setShowCreateForm(!showCreateForm);
    setSelectedLead(null);
    onChange(null, null);
    setFormErrors({});
  };

  const validateNewLeadForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!newLead.first_name.trim()) {
      errors.first_name = 'First name is required';
    }
    if (!newLead.last_name.trim()) {
      errors.last_name = 'Last name is required';
    }
    if (!newLead.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLead.email)) {
      errors.email = 'Invalid email format';
    }
    if (!newLead.phone.trim()) {
      errors.phone = 'Phone is required';
    } else {
      const cleanedPhone = newLead.phone.replace(/\D/g, '');
      if (cleanedPhone.length < 10) {
        errors.phone = 'Phone must be at least 10 digits';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNewLeadChange = (field: keyof typeof newLead, value: string) => {
    const updated = { ...newLead, [field]: value };
    setNewLead(updated);

    // Clear error for this field
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: '' });
    }

    // Validate and emit if all required fields are filled
    if (updated.first_name && updated.last_name && updated.email && updated.phone) {
      onChange(null, { ...updated, isNew: true });
    }
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setNewLead({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company_name: '',
    });
    setFormErrors({});
    onChange(null, null);
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="space-y-4">
        {/* Lead Selection or Create Button */}
        {!showCreateForm && (
          <>
            <Select
              label="Customer"
              options={leadOptions}
              value={value}
              onChange={handleLeadSelect}
              placeholder={loading ? 'Loading leads...' : 'Select a customer'}
              searchable
              required={required}
              error={error}
              disabled={loading}
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCreateNewClick}
              className="w-full"
            >
              <UserPlus className="w-4 h-4" />
              Create New Customer
              <ChevronDown className="w-4 h-4" />
            </Button>
          </>
        )}

        {/* Inline Lead Creation Form */}
        {showCreateForm && (
          <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                New Customer
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelCreate}
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="John"
                value={newLead.first_name}
                onChange={(e) => handleNewLeadChange('first_name', e.target.value)}
                error={formErrors.first_name}
                required
              />

              <Input
                label="Last Name"
                placeholder="Doe"
                value={newLead.last_name}
                onChange={(e) => handleNewLeadChange('last_name', e.target.value)}
                error={formErrors.last_name}
                required
              />

              <Input
                label="Email"
                type="email"
                placeholder="john@example.com"
                value={newLead.email}
                onChange={(e) => handleNewLeadChange('email', e.target.value)}
                error={formErrors.email}
                required
              />

              <PhoneInput
                label="Phone"
                placeholder="(555) 123-4567"
                value={newLead.phone}
                onChange={(e) => handleNewLeadChange('phone', e.target.value)}
                error={formErrors.phone}
                required
              />

              <div className="md:col-span-2">
                <Input
                  label="Company (Optional)"
                  placeholder="ABC Company"
                  value={newLead.company_name}
                  onChange={(e) => handleNewLeadChange('company_name', e.target.value)}
                />
              </div>
            </div>

            {/* Show selected new lead summary */}
            {newLead.first_name && newLead.last_name && (
              <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Customer: {newLead.first_name} {newLead.last_name}
                  {newLead.company_name && ` (${newLead.company_name})`}
                </p>
                {newLead.email && (
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {newLead.email} • {newLead.phone}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Selected Lead Summary (when existing lead selected) */}
        {selectedLead && !showCreateForm && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Selected: {selectedLead.first_name} {selectedLead.last_name}
              {selectedLead.company_name && ` (${selectedLead.company_name})`}
            </p>
            {selectedLead.emails && selectedLead.emails.length > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {selectedLead.emails.find((e) => e.is_primary)?.email || selectedLead.emails[0]?.email}
                {selectedLead.phones && selectedLead.phones.length > 0 &&
                  ` • ${selectedLead.phones.find((p) => p.is_primary)?.phone || selectedLead.phones[0]?.phone}`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LeadSelector;
