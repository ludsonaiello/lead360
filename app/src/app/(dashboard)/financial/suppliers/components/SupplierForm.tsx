/**
 * SupplierForm Component
 * Shared single-page form used by both Create and Edit supplier pages
 * Sprint 6 — Financial Frontend
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Globe,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Star,
  ArrowLeft,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import Card from '@/components/ui/Card';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import {
  createSupplier,
  updateSupplier,
  getSupplierCategories,
} from '@/lib/api/financial';
import type {
  Supplier,
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierCategory,
} from '@/lib/types/financial';

// ========== US STATES ==========

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// ========== ZIP CODE MASK ==========

function formatZipCode(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// ========== TYPES ==========

interface SupplierFormProps {
  supplier?: Supplier | null; // null or undefined = create mode
}

interface FormErrors {
  name?: string;
  email?: string;
  website?: string;
  legal_name?: string;
  contact_name?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
}

// ========== COMPONENT ==========

export default function SupplierForm({ supplier }: SupplierFormProps) {
  const router = useRouter();
  const isEdit = !!supplier;

  // Form state
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [website, setWebsite] = useState('');
  const [isPreferred, setIsPreferred] = useState(false);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  // Categories
  const [supplierCategories, setSupplierCategories] = useState<SupplierCategory[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Load categories
  useEffect(() => {
    getSupplierCategories({ is_active: true })
      .then(setSupplierCategories)
      .catch((err) => console.error('Failed to load supplier categories:', err));
  }, []);

  // Populate form on edit
  useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setLegalName(supplier.legal_name || '');
      setWebsite(supplier.website || '');
      setIsPreferred(supplier.is_preferred);
      setContactName(supplier.contact_name || '');
      setPhone(supplier.phone || '');
      setEmail(supplier.email || '');
      setAddressLine1(supplier.address_line1 || '');
      setAddressLine2(supplier.address_line2 || '');
      setCity(supplier.city || '');
      setState(supplier.state || '');
      setZipCode(supplier.zip_code || '');
      setNotes(supplier.notes || '');
      setCategoryIds(supplier.categories.map((c) => c.id));
    }
  }, [supplier]);

  // Validation
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Supplier name is required';
    } else if (name.trim().length > 200) {
      newErrors.name = 'Name must be 200 characters or fewer';
    }

    if (legalName && legalName.length > 200) {
      newErrors.legal_name = 'Legal name must be 200 characters or fewer';
    }

    if (website && website.length > 500) {
      newErrors.website = 'Website must be 500 characters or fewer';
    }

    if (contactName && contactName.length > 150) {
      newErrors.contact_name = 'Contact name must be 150 characters or fewer';
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (addressLine1 && addressLine1.length > 255) {
      newErrors.address_line1 = 'Address must be 255 characters or fewer';
    }

    if (addressLine2 && addressLine2.length > 255) {
      newErrors.address_line2 = 'Address must be 255 characters or fewer';
    }

    if (city && city.length > 100) {
      newErrors.city = 'City must be 100 characters or fewer';
    }

    if (state && !/^[A-Z]{2}$/.test(state)) {
      newErrors.state = 'Please select a valid state';
    }

    const cleanZip = zipCode.replace(/-/g, '');
    if (cleanZip && !/^\d{5}(\d{4})?$/.test(cleanZip)) {
      newErrors.zip_code = 'ZIP code must be 5 or 9 digits (e.g., 02101 or 02101-1234)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Clear individual field error on change
  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      // Scroll to first error
      const firstErrorField = document.querySelector('[data-error="true"]');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setSaving(true);

    // Format zip code for API
    const cleanZip = zipCode.replace(/-/g, '');
    const formattedZip = cleanZip.length === 9 ? `${cleanZip.slice(0, 5)}-${cleanZip.slice(5)}` : cleanZip;

    try {
      if (isEdit && supplier) {
        // In edit mode, send all fields so cleared values are properly updated.
        // Empty strings are sent so the backend can clear previously-set fields.
        const dto: UpdateSupplierDto = {
          name: name.trim(),
          legal_name: legalName.trim(),
          website: website.trim(),
          is_preferred: isPreferred,
          contact_name: contactName.trim(),
          phone: phone,
          email: email.trim(),
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim(),
          city: city.trim(),
          state: state,
          zip_code: formattedZip,
          notes: notes.trim(),
          category_ids: categoryIds,
        };
        const result = await updateSupplier(supplier.id, dto);
        toast.success(`Supplier "${name.trim()}" updated successfully`);
        router.push(`/financial/suppliers/${result.id}`);
      } else {
        const dto: CreateSupplierDto = {
          name: name.trim(),
          legal_name: legalName.trim() || undefined,
          website: website.trim() || undefined,
          is_preferred: isPreferred,
          contact_name: contactName.trim() || undefined,
          phone: phone || undefined,
          email: email.trim() || undefined,
          address_line1: addressLine1.trim() || undefined,
          address_line2: addressLine2.trim() || undefined,
          city: city.trim() || undefined,
          state: state || undefined,
          zip_code: formattedZip || undefined,
          notes: notes.trim() || undefined,
          category_ids: categoryIds.length > 0 ? categoryIds : undefined,
        };
        const result = await createSupplier(dto);
        toast.success(`Supplier "${name.trim()}" created successfully`);
        router.push(`/financial/suppliers/${result.id}`);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'An unexpected error occurred';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Category options for multi-select
  const categoryOptions = supplierCategories.map((cat) => ({
    value: cat.id,
    label: cat.name,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/financial/suppliers"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Suppliers
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          {isEdit ? 'Edit Supplier' : 'New Supplier'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {isEdit ? `Editing "${supplier?.name}"` : 'Add a new vendor to your supplier registry'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1 — Basic Information */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Basic Information
          </h2>
          <div className="space-y-4">
            <div data-error={!!errors.name || undefined}>
              <Input
                label="Supplier Name"
                placeholder="e.g., Home Depot"
                value={name}
                onChange={(e) => { setName(e.target.value); clearError('name'); }}
                error={errors.name}
                maxLength={200}
                required
              />
            </div>
            <div data-error={!!errors.legal_name || undefined}>
              <Input
                label="Legal Name"
                placeholder="Legal business name (optional)"
                value={legalName}
                onChange={(e) => { setLegalName(e.target.value); clearError('legal_name'); }}
                error={errors.legal_name}
                maxLength={200}
              />
            </div>
            <div data-error={!!errors.website || undefined}>
              <Input
                label="Website"
                placeholder="https://www.example.com"
                value={website}
                onChange={(e) => { setWebsite(e.target.value); clearError('website'); }}
                error={errors.website}
                leftIcon={<Globe className="w-5 h-5" />}
                maxLength={500}
              />
            </div>
            <ToggleSwitch
              enabled={isPreferred}
              onChange={setIsPreferred}
              label="Preferred Supplier"
              description="Mark this supplier as a preferred vendor"
            />
          </div>
        </Card>

        {/* Section 2 — Contact Information */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Contact Information
          </h2>
          <div className="space-y-4">
            <div data-error={!!errors.contact_name || undefined}>
              <Input
                label="Contact Name"
                placeholder="Primary contact person"
                value={contactName}
                onChange={(e) => { setContactName(e.target.value); clearError('contact_name'); }}
                error={errors.contact_name}
                leftIcon={<User className="w-5 h-5" />}
                maxLength={150}
              />
            </div>
            <div data-error={!!errors.phone || undefined}>
              <PhoneInput
                label="Phone"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); clearError('phone'); }}
                error={errors.phone}
                leftIcon={<Phone className="w-5 h-5" />}
              />
            </div>
            <div data-error={!!errors.email || undefined}>
              <Input
                label="Email"
                placeholder="contact@supplier.com"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                error={errors.email}
                leftIcon={<Mail className="w-5 h-5" />}
              />
            </div>
          </div>
        </Card>

        {/* Section 3 — Address */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Address
          </h2>
          <div className="space-y-4">
            {/* Google Maps Address Autocomplete */}
            <AddressAutocomplete
              label="Search Address"
              helperText="Search for an address to autofill the fields below, or enter manually"
              defaultValue={addressLine1 ? `${addressLine1}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}${zipCode ? ` ${zipCode}` : ''}` : ''}
              onSelect={(data) => {
                setAddressLine1(data.line1);
                setCity(data.city);
                setState(data.state);
                setZipCode(data.zip_code);
                clearError('address_line1');
                clearError('city');
                clearError('state');
                clearError('zip_code');
              }}
            />

            <div data-error={!!errors.address_line1 || undefined}>
              <Input
                label="Address Line 1"
                placeholder="123 Main Street"
                value={addressLine1}
                onChange={(e) => { setAddressLine1(e.target.value); clearError('address_line1'); }}
                error={errors.address_line1}
                maxLength={255}
              />
            </div>
            <div data-error={!!errors.address_line2 || undefined}>
              <Input
                label="Address Line 2"
                placeholder="Suite, Apt, Unit (optional)"
                value={addressLine2}
                onChange={(e) => { setAddressLine2(e.target.value); clearError('address_line2'); }}
                error={errors.address_line2}
                maxLength={255}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div data-error={!!errors.city || undefined}>
                <Input
                  label="City"
                  placeholder="Boston"
                  value={city}
                  onChange={(e) => { setCity(e.target.value); clearError('city'); }}
                  error={errors.city}
                  maxLength={100}
                />
              </div>
              <div data-error={!!errors.state || undefined}>
                <Select
                  label="State"
                  options={US_STATES}
                  value={state}
                  onChange={(val) => { setState(val); clearError('state'); }}
                  placeholder="Select state"
                  searchable
                />
                {errors.state && (
                  <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{errors.state}</p>
                )}
              </div>
              <div data-error={!!errors.zip_code || undefined}>
                <Input
                  label="ZIP Code"
                  placeholder="02101"
                  value={zipCode}
                  onChange={(e) => {
                    const formatted = formatZipCode(e.target.value);
                    setZipCode(formatted);
                    clearError('zip_code');
                  }}
                  error={errors.zip_code}
                  maxLength={10}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Section 4 — Categories */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Categories
          </h2>
          <MultiSelect
            label="Supplier Categories"
            options={categoryOptions}
            value={categoryIds}
            onChange={setCategoryIds}
            placeholder="Select categories..."
            searchable
            helperText="Organize this supplier by assigning relevant categories"
          />
        </Card>

        {/* Section 5 — Notes */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Notes
          </h2>
          <Textarea
            label="Notes"
            placeholder="Additional notes about this supplier (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            resize="vertical"
          />
        </Card>

        {/* Form Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pb-8">
          <Link href="/financial/suppliers">
            <Button variant="ghost" type="button" className="w-full sm:w-auto" disabled={saving}>
              Cancel
            </Button>
          </Link>
          <Button
            variant="primary"
            type="submit"
            loading={saving}
            className="w-full sm:w-auto"
          >
            <Save className="w-4 h-4" />
            {isEdit ? 'Save Changes' : 'Create Supplier'}
          </Button>
        </div>
      </form>
    </div>
  );
}
