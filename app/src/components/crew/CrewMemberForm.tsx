/**
 * Crew Member Create/Edit Form
 * Multi-section form with masked inputs for sensitive data,
 * payment method conditional fields, US state dropdown, photo upload
 */

'use client';

import React, { useState, useRef } from 'react';
import { Loader2, Upload, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MaskedInput } from '@/components/ui/MaskedInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Modal } from '@/components/ui/Modal';
import type {
  CrewMember,
  CreateCrewMemberDto,
  UpdateCrewMemberDto,
} from '@/lib/types/crew';
import { US_STATES, PAYMENT_METHODS } from '@/lib/types/crew';

interface CrewMemberFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCrewMemberDto | UpdateCrewMemberDto, photoFile?: File | null) => Promise<void>;
  initialData?: CrewMember | null;
  mode: 'create' | 'edit';
}

type FormSection = 'personal' | 'address' | 'sensitive' | 'employment' | 'payment';

const SECTIONS: { id: FormSection; label: string }[] = [
  { id: 'personal', label: 'Personal Info' },
  { id: 'address', label: 'Address' },
  { id: 'sensitive', label: 'Sensitive Data' },
  { id: 'employment', label: 'Employment' },
  { id: 'payment', label: 'Payment Info' },
];

export function CrewMemberForm({ isOpen, onClose, onSubmit, initialData, mode }: CrewMemberFormProps) {
  const [activeSection, setActiveSection] = useState<FormSection>('personal');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<CreateCrewMemberDto>({
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    address_line1: initialData?.address_line1 || '',
    address_line2: initialData?.address_line2 || '',
    address_city: initialData?.address_city || '',
    address_state: initialData?.address_state || '',
    address_zip: initialData?.address_zip || '',
    date_of_birth: initialData?.date_of_birth || '',
    ssn: '',
    itin: '',
    has_drivers_license: initialData?.has_drivers_license || false,
    drivers_license_number: '',
    default_hourly_rate: initialData?.default_hourly_rate || undefined,
    weekly_hours_schedule: initialData?.weekly_hours_schedule || undefined,
    overtime_enabled: initialData?.overtime_enabled || false,
    overtime_rate_multiplier: initialData?.overtime_rate_multiplier || undefined,
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
    if (!form.first_name?.trim()) newErrors.first_name = 'First name is required';
    if (!form.last_name?.trim()) newErrors.last_name = 'Last name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (form.address_state && form.address_state.length !== 2) {
      newErrors.address_state = 'State must be 2-letter code';
    }
    if (form.default_hourly_rate !== undefined && form.default_hourly_rate !== null && form.default_hourly_rate <= 0) {
      newErrors.default_hourly_rate = 'Hourly rate must be greater than 0';
    }
    if (form.overtime_enabled && form.overtime_rate_multiplier !== undefined && form.overtime_rate_multiplier <= 1) {
      newErrors.overtime_rate_multiplier = 'Overtime multiplier must be greater than 1';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      // Navigate to the section with the first error
      const errorField = Object.keys(newErrors)[0];
      if (['first_name', 'last_name', 'email', 'phone', 'date_of_birth'].includes(errorField)) {
        setActiveSection('personal');
      } else if (errorField.startsWith('address')) {
        setActiveSection('address');
      } else if (['ssn', 'itin', 'drivers_license_number'].includes(errorField)) {
        setActiveSection('sensitive');
      } else if (['default_hourly_rate', 'weekly_hours_schedule', 'overtime_rate_multiplier'].includes(errorField)) {
        setActiveSection('employment');
      } else {
        setActiveSection('payment');
      }
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Build the DTO - only include fields that have values
      const dto: Record<string, any> = {};
      if (form.first_name) dto.first_name = form.first_name.trim();
      if (form.last_name) dto.last_name = form.last_name.trim();
      if (form.email) dto.email = form.email.trim();
      if (form.phone) dto.phone = form.phone;
      if (form.address_line1) dto.address_line1 = form.address_line1.trim();
      if (form.address_line2) dto.address_line2 = form.address_line2.trim();
      if (form.address_city) dto.address_city = form.address_city.trim();
      if (form.address_state) dto.address_state = form.address_state.toUpperCase();
      if (form.address_zip) dto.address_zip = form.address_zip.trim();
      if (form.date_of_birth) dto.date_of_birth = form.date_of_birth;
      if (form.ssn) dto.ssn = form.ssn;
      if (form.itin) dto.itin = form.itin;
      dto.has_drivers_license = form.has_drivers_license;
      if (form.drivers_license_number) dto.drivers_license_number = form.drivers_license_number;
      if (form.default_hourly_rate) dto.default_hourly_rate = Number(form.default_hourly_rate);
      if (form.weekly_hours_schedule) dto.weekly_hours_schedule = Number(form.weekly_hours_schedule);
      dto.overtime_enabled = form.overtime_enabled;
      if (form.overtime_enabled && form.overtime_rate_multiplier) {
        dto.overtime_rate_multiplier = Number(form.overtime_rate_multiplier);
      }
      if (form.default_payment_method) dto.default_payment_method = form.default_payment_method;
      if (form.bank_name) dto.bank_name = form.bank_name.trim();
      if (form.bank_routing_number) dto.bank_routing_number = form.bank_routing_number;
      if (form.bank_account_number) dto.bank_account_number = form.bank_account_number;
      if (form.venmo_handle) dto.venmo_handle = form.venmo_handle.trim();
      if (form.zelle_contact) dto.zelle_contact = form.zelle_contact.trim();
      if (form.notes) dto.notes = form.notes.trim();

      await onSubmit(dto, photoFile);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors(prev => ({ ...prev, photo: 'Only JPEG, PNG, and WebP images are allowed' }));
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setErrors(prev => {
      const next = { ...prev };
      delete next.photo;
      return next;
    });
  };

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'personal':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={form.first_name || ''}
                onChange={e => updateField('first_name', e.target.value)}
                error={errors.first_name}
                required
                placeholder="John"
              />
              <Input
                label="Last Name"
                value={form.last_name || ''}
                onChange={e => updateField('last_name', e.target.value)}
                error={errors.last_name}
                required
                placeholder="Doe"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={form.email || ''}
                onChange={e => updateField('email', e.target.value)}
                error={errors.email}
                placeholder="john@example.com"
              />
              <PhoneInput
                label="Phone"
                value={form.phone || ''}
                onChange={e => updateField('phone', e.target.value)}
                error={errors.phone}
              />
            </div>
            <Input
              label="Date of Birth"
              type="date"
              value={form.date_of_birth || ''}
              onChange={e => updateField('date_of_birth', e.target.value)}
              error={errors.date_of_birth}
            />
            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Profile Photo
              </label>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <Camera className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    {photoPreview ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                  {errors.photo && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.photo}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'address':
        return (
          <div className="space-y-4">
            <Input
              label="Street Address"
              value={form.address_line1 || ''}
              onChange={e => updateField('address_line1', e.target.value)}
              placeholder="123 Main St"
            />
            <Input
              label="Address Line 2"
              value={form.address_line2 || ''}
              onChange={e => updateField('address_line2', e.target.value)}
              placeholder="Apt 4B"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="City"
                value={form.address_city || ''}
                onChange={e => updateField('address_city', e.target.value)}
                placeholder="Boston"
              />
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  State
                </label>
                <select
                  value={form.address_state || ''}
                  onChange={e => updateField('address_state', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select State</option>
                  {US_STATES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {errors.address_state && (
                  <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{errors.address_state}</p>
                )}
              </div>
              <Input
                label="ZIP Code"
                value={form.address_zip || ''}
                onChange={e => updateField('address_zip', e.target.value)}
                placeholder="02101"
              />
            </div>
          </div>
        );

      case 'sensitive':
        return (
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                Sensitive data is encrypted before storage. In edit mode, leave fields blank to keep existing values.
              </p>
            </div>
            <MaskedInput
              label="Social Security Number (SSN)"
              mask="999-99-9999"
              value={form.ssn || ''}
              onAccept={value => updateField('ssn', value)}
              placeholder={mode === 'edit' && initialData?.has_ssn ? '***-**-' + (initialData.ssn_masked?.slice(-4) || '****') : 'XXX-XX-XXXX'}
            />
            <MaskedInput
              label="ITIN"
              mask="999-99-9999"
              value={form.itin || ''}
              onAccept={value => updateField('itin', value)}
              placeholder={mode === 'edit' && initialData?.has_itin ? '***-**-' + (initialData.itin_masked?.slice(-4) || '****') : 'XXX-XX-XXXX'}
            />
            <div className="flex items-center gap-4">
              <ToggleSwitch
                label="Has Driver's License"
                enabled={form.has_drivers_license || false}
                onChange={val => updateField('has_drivers_license', val)}
              />
            </div>
            {form.has_drivers_license && (
              <Input
                label="Driver's License Number"
                value={form.drivers_license_number || ''}
                onChange={e => updateField('drivers_license_number', e.target.value)}
                placeholder={mode === 'edit' && initialData?.has_drivers_license_number ? '****' + (initialData.drivers_license_masked?.slice(-4) || '****') : 'Enter license number'}
              />
            )}
          </div>
        );

      case 'employment':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Default Hourly Rate ($)"
                type="number"
                step="0.01"
                min="0"
                value={form.default_hourly_rate?.toString() || ''}
                onChange={e => updateField('default_hourly_rate', e.target.value ? parseFloat(e.target.value) : undefined)}
                error={errors.default_hourly_rate}
                placeholder="25.00"
              />
              <Input
                label="Weekly Hours Schedule"
                type="number"
                min="1"
                max="168"
                value={form.weekly_hours_schedule?.toString() || ''}
                onChange={e => updateField('weekly_hours_schedule', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="40"
              />
            </div>
            <ToggleSwitch
              label="Overtime Enabled"
              enabled={form.overtime_enabled || false}
              onChange={val => updateField('overtime_enabled', val)}
            />
            {form.overtime_enabled && (
              <Input
                label="Overtime Rate Multiplier"
                type="number"
                step="0.01"
                min="1.01"
                value={form.overtime_rate_multiplier?.toString() || ''}
                onChange={e => updateField('overtime_rate_multiplier', e.target.value ? parseFloat(e.target.value) : undefined)}
                error={errors.overtime_rate_multiplier}
                placeholder="1.50"
                helperText="e.g., 1.5 = time and a half"
              />
            )}
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

            {/* Conditional bank fields */}
            {form.default_payment_method === 'bank_transfer' && (
              <>
                <Input
                  label="Bank Name"
                  value={form.bank_name || ''}
                  onChange={e => updateField('bank_name', e.target.value)}
                  placeholder="Bank of America"
                />
                <Input
                  label="Routing Number"
                  value={form.bank_routing_number || ''}
                  onChange={e => updateField('bank_routing_number', e.target.value)}
                  placeholder={mode === 'edit' && initialData?.has_bank_routing ? '****' + (initialData.bank_routing_masked?.slice(-4) || '****') : '9 digit routing number'}
                />
                <Input
                  label="Account Number"
                  value={form.bank_account_number || ''}
                  onChange={e => updateField('bank_account_number', e.target.value)}
                  placeholder={mode === 'edit' && initialData?.has_bank_account ? '****' + (initialData.bank_account_masked?.slice(-4) || '****') : 'Account number'}
                />
              </>
            )}

            {form.default_payment_method === 'venmo' && (
              <Input
                label="Venmo Handle"
                value={form.venmo_handle || ''}
                onChange={e => updateField('venmo_handle', e.target.value)}
                placeholder="@johndoe"
              />
            )}

            {form.default_payment_method === 'zelle' && (
              <Input
                label="Zelle Contact"
                value={form.zelle_contact || ''}
                onChange={e => updateField('zelle_contact', e.target.value)}
                placeholder="john@email.com or phone"
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
      title={mode === 'create' ? 'Add Crew Member' : 'Edit Crew Member'}
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
            {activeSection !== 'personal' && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const idx = SECTIONS.findIndex(s => s.id === activeSection);
                  if (idx > 0) setActiveSection(SECTIONS[idx - 1].id);
                }}
              >
                Previous
              </Button>
            )}
            {activeSection !== 'payment' && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const idx = SECTIONS.findIndex(s => s.id === activeSection);
                  if (idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].id);
                }}
              >
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
                mode === 'create' ? 'Create Crew Member' : 'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default CrewMemberForm;
