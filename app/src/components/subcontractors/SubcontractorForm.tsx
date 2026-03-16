/**
 * Subcontractor Create/Edit Form
 * Business info, insurance info, payment info with conditional bank fields
 */

'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Modal } from '@/components/ui/Modal';
import type {
  Subcontractor,
  CreateSubcontractorDto,
  UpdateSubcontractorDto,
} from '@/lib/types/subcontractor';
import { PAYMENT_METHODS } from '@/lib/types/crew';
import type { PaymentMethod } from '@/lib/types/crew';

interface SubcontractorFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSubcontractorDto | UpdateSubcontractorDto) => Promise<void>;
  initialData?: Subcontractor | null;
  mode: 'create' | 'edit';
}

type FormSection = 'business' | 'insurance' | 'payment';

const SECTIONS: { id: FormSection; label: string }[] = [
  { id: 'business', label: 'Business Info' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'payment', label: 'Payment Info' },
];

export function SubcontractorForm({ isOpen, onClose, onSubmit, initialData, mode }: SubcontractorFormProps) {
  const [activeSection, setActiveSection] = useState<FormSection>('business');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<CreateSubcontractorDto>({
    business_name: initialData?.business_name || '',
    trade_specialty: initialData?.trade_specialty || '',
    email: initialData?.email || '',
    website: initialData?.website || '',
    insurance_provider: initialData?.insurance_provider || '',
    insurance_policy_number: initialData?.insurance_policy_number || '',
    insurance_expiry_date: initialData?.insurance_expiry_date?.split('T')[0] || '',
    coi_on_file: initialData?.coi_on_file || false,
    default_payment_method: initialData?.default_payment_method || undefined,
    bank_name: initialData?.bank_name || '',
    bank_routing_number: '',
    bank_account_number: '',
    venmo_handle: initialData?.venmo_handle || '',
    zelle_contact: initialData?.zelle_contact || '',
    notes: initialData?.notes || '',
  });

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.business_name?.trim()) newErrors.business_name = 'Business name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email address';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setActiveSection('business');
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const dto: Record<string, any> = {};
      if (form.business_name) dto.business_name = form.business_name.trim();
      if (form.trade_specialty) dto.trade_specialty = form.trade_specialty.trim();
      if (form.email) dto.email = form.email.trim();
      if (form.website) dto.website = form.website.trim();
      if (form.insurance_provider) dto.insurance_provider = form.insurance_provider.trim();
      if (form.insurance_policy_number) dto.insurance_policy_number = form.insurance_policy_number.trim();
      if (form.insurance_expiry_date) dto.insurance_expiry_date = form.insurance_expiry_date;
      dto.coi_on_file = form.coi_on_file;
      if (form.default_payment_method) dto.default_payment_method = form.default_payment_method;
      if (form.bank_name) dto.bank_name = form.bank_name.trim();
      if (form.bank_routing_number) dto.bank_routing_number = form.bank_routing_number;
      if (form.bank_account_number) dto.bank_account_number = form.bank_account_number;
      if (form.venmo_handle) dto.venmo_handle = form.venmo_handle.trim();
      if (form.zelle_contact) dto.zelle_contact = form.zelle_contact.trim();
      if (form.notes) dto.notes = form.notes.trim();

      await onSubmit(dto);
    } finally {
      setSubmitting(false);
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'business':
        return (
          <div className="space-y-4">
            <Input
              label="Business Name"
              value={form.business_name || ''}
              onChange={e => updateField('business_name', e.target.value)}
              error={errors.business_name}
              required
              placeholder="ABC Electrical"
            />
            <Input
              label="Trade Specialty"
              value={form.trade_specialty || ''}
              onChange={e => updateField('trade_specialty', e.target.value)}
              placeholder="Electrical, Plumbing, HVAC..."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={form.email || ''}
                onChange={e => updateField('email', e.target.value)}
                error={errors.email}
                placeholder="info@company.com"
              />
              <Input
                label="Website"
                value={form.website || ''}
                onChange={e => updateField('website', e.target.value)}
                placeholder="https://company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Notes
              </label>
              <textarea
                value={form.notes || ''}
                onChange={e => updateField('notes', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium
                  placeholder:text-gray-400 dark:placeholder:text-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any relevant notes..."
              />
            </div>
          </div>
        );

      case 'insurance':
        return (
          <div className="space-y-4">
            <Input
              label="Insurance Provider"
              value={form.insurance_provider || ''}
              onChange={e => updateField('insurance_provider', e.target.value)}
              placeholder="State Farm, Geico..."
            />
            <Input
              label="Policy Number"
              value={form.insurance_policy_number || ''}
              onChange={e => updateField('insurance_policy_number', e.target.value)}
              placeholder="POL-12345"
            />
            <Input
              label="Insurance Expiry Date"
              type="date"
              value={form.insurance_expiry_date || ''}
              onChange={e => updateField('insurance_expiry_date', e.target.value)}
            />
            <ToggleSwitch
              label="Certificate of Insurance (COI) on File"
              enabled={form.coi_on_file || false}
              onChange={val => updateField('coi_on_file', val)}
            />
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Default Payment Method
              </label>
              <select
                value={form.default_payment_method || ''}
                onChange={e => updateField('default_payment_method', e.target.value || undefined)}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select method...</option>
                {PAYMENT_METHODS.map(pm => (
                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                ))}
              </select>
            </div>
            {form.default_payment_method === 'bank_transfer' && (
              <>
                <Input
                  label="Bank Name"
                  value={form.bank_name || ''}
                  onChange={e => updateField('bank_name', e.target.value)}
                  placeholder="Chase, Bank of America..."
                />
                <Input
                  label="Routing Number"
                  value={form.bank_routing_number || ''}
                  onChange={e => updateField('bank_routing_number', e.target.value)}
                  placeholder={mode === 'edit' && initialData?.has_bank_routing ? '****' + (initialData.bank_routing_masked?.slice(-4) || '') : '9 digit routing number'}
                />
                <Input
                  label="Account Number"
                  value={form.bank_account_number || ''}
                  onChange={e => updateField('bank_account_number', e.target.value)}
                  placeholder={mode === 'edit' && initialData?.has_bank_account ? '****' + (initialData.bank_account_masked?.slice(-4) || '') : 'Account number'}
                />
              </>
            )}
            {form.default_payment_method === 'venmo' && (
              <Input
                label="Venmo Handle"
                value={form.venmo_handle || ''}
                onChange={e => updateField('venmo_handle', e.target.value)}
                placeholder="@businessname"
              />
            )}
            {form.default_payment_method === 'zelle' && (
              <Input
                label="Zelle Contact"
                value={form.zelle_contact || ''}
                onChange={e => updateField('zelle_contact', e.target.value)}
                placeholder="email or phone"
              />
            )}
          </div>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add Subcontractor' : 'Edit Subcontractor'}
      size="lg"
    >
      <div className="flex flex-col h-full max-h-[80vh]">
        {/* Section Navigation */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700 pb-0 mb-4 -mx-1">
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-3 py-2 text-sm font-semibold whitespace-nowrap rounded-t-lg border-b-2 transition-colors
                ${activeSection === section.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}
              `}
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-1 pb-4">
          {renderSection()}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            {activeSection !== 'business' && (
              <Button type="button" variant="ghost" onClick={() => {
                const idx = SECTIONS.findIndex(s => s.id === activeSection);
                if (idx > 0) setActiveSection(SECTIONS[idx - 1].id);
              }}>
                Previous
              </Button>
            )}
            {activeSection !== 'payment' && (
              <Button type="button" variant="ghost" onClick={() => {
                const idx = SECTIONS.findIndex(s => s.id === activeSection);
                if (idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].id);
              }}>
                Next
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'create' ? 'Creating...' : 'Saving...'}
                </>
              ) : (
                mode === 'create' ? 'Create Subcontractor' : 'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default SubcontractorForm;
