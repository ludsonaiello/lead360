/**
 * Quote Create Page
 * Multi-step wizard for creating new quotes
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { LeadSelector } from '@/components/quotes/LeadSelector';
import { VendorSelector } from '@/components/quotes/VendorSelector';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { createQuoteFromLead, createQuoteWithNewCustomer } from '@/lib/api/quotes';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  FileText,
  MapPin,
  Eye,
  Percent,
  AlertCircle,
} from 'lucide-react';
import type { LeadListItem } from '@/lib/types/leads';
import type { VendorSummary, CreateQuoteDto, CreateQuoteWithCustomerDto } from '@/lib/types/quotes';

interface NewLeadData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name?: string;
  isNew: true;
}

const STEPS = [
  { id: 1, label: 'Customer', icon: User },
  { id: 2, label: 'Quote Details', icon: FileText },
  { id: 3, label: 'Jobsite Address', icon: MapPin },
  { id: 4, label: 'Review', icon: Eye },
];

export default function CreateQuotePage() {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  // Form data
  const [leadData, setLeadData] = useState<(LeadListItem | NewLeadData) | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<VendorSummary | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState({
    title: '',
    po_number: '',
    expiration_days: 30,
    use_default_settings: true,
    custom_profit_percent: undefined as number | undefined,
    custom_overhead_percent: undefined as number | undefined,
    private_notes: '',
  });
  const [addressData, setAddressData] = useState<{
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    zip_code: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const [addressMode, setAddressMode] = useState<'existing' | 'new'>('existing');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!leadData) {
        newErrors.lead = 'Please select or create a customer';
      }
    }

    if (step === 2) {
      if (!quoteData.title.trim()) {
        newErrors.title = 'Title is required';
      }
      if (!vendorId) {
        newErrors.vendor = 'Please select a vendor';
      }
      if (!quoteData.use_default_settings) {
        if (
          quoteData.custom_profit_percent === undefined ||
          quoteData.custom_profit_percent < 0 ||
          quoteData.custom_profit_percent > 100
        ) {
          newErrors.profit = 'Profit must be between 0-100%';
        }
        if (
          quoteData.custom_overhead_percent === undefined ||
          quoteData.custom_overhead_percent < 0 ||
          quoteData.custom_overhead_percent > 100
        ) {
          newErrors.overhead = 'Overhead must be between 0-100%';
        }
      }
    }

    if (step === 3) {
      // Check if address is selected (either existing or new)
      if (addressMode === 'existing' && !selectedAddressId) {
        newErrors.address = 'Please select an address from the list';
      } else if (addressMode === 'new' && (!addressData || !addressData.address_line1 || !addressData.zip_code)) {
        newErrors.address = 'Please enter a complete address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);
    try {
      let quote;

      if (leadData && 'isNew' in leadData && leadData.isNew) {
        // Create quote with new customer
        // Clean phone: remove non-digits, then strip leading "1" if present (country code)
        const cleanedPhone = leadData.phone.replace(/\D/g, '');
        const phoneDigits = cleanedPhone.startsWith('1') && cleanedPhone.length === 11
          ? cleanedPhone.substring(1) // Remove leading 1 from +15551234567 → 5551234567
          : cleanedPhone;

        const dto: CreateQuoteWithCustomerDto = {
          customer: {
            first_name: leadData.first_name,
            last_name: leadData.last_name,
            email: leadData.email,
            phone: phoneDigits,
            company_name: leadData.company_name,
          },
          vendor_id: vendorId!,
          title: quoteData.title,
          jobsite_address: {
            address_line1: addressData!.address_line1,
            address_line2: addressData!.address_line2,
            city: addressData!.city,
            state: addressData!.state,
            zip_code: addressData!.zip_code,
            latitude: addressData!.latitude,
            longitude: addressData!.longitude,
          },
          po_number: quoteData.po_number || undefined,
          expiration_days: quoteData.expiration_days,
        };
        quote = await createQuoteWithNewCustomer(dto);
      } else {
        // Create quote from existing lead
        // Note: lead_id is NOT in the DTO - it's passed as a URL path parameter
        const dto: CreateQuoteDto = {
          vendor_id: vendorId!,
          title: quoteData.title,
          jobsite_address: {
            address_line1: addressData!.address_line1,
            address_line2: addressData!.address_line2,
            city: addressData!.city,
            state: addressData!.state,
            zip_code: addressData!.zip_code,
            latitude: addressData!.latitude,
            longitude: addressData!.longitude,
          },
          po_number: quoteData.po_number || undefined,
          expiration_days: quoteData.expiration_days,
          use_default_settings: quoteData.use_default_settings,
          custom_profit_percent: quoteData.use_default_settings
            ? undefined
            : quoteData.custom_profit_percent,
          custom_overhead_percent: quoteData.use_default_settings
            ? undefined
            : quoteData.custom_overhead_percent,
          private_notes: quoteData.private_notes || undefined,
        };
        quote = await createQuoteFromLead(leadId!, dto);
      }

      // Validate response before navigation
      if (!quote || !quote.id) {
        console.error('Invalid quote response:', quote);
        throw new Error('Quote was created but response is invalid. Please refresh the page.');
      }

      // Success - redirect to quote detail
      router.push(`/quotes/${quote.id}`);
    } catch (err: any) {
      console.error('Quote creation error:', err);
      setErrorMessage(err.message || 'Failed to create quote');
      setErrorModalOpen(true);
      setLoading(false);
    }
  };

  const handleLeadChange = (id: string | null, data: LeadListItem | NewLeadData | null) => {
    setLeadId(id);
    setLeadData(data);
    setErrors({ ...errors, lead: '' });

    // Reset address selection when changing lead
    setSelectedAddressId(null);
    setAddressData(null);

    // Set address mode based on whether lead has addresses
    if (data && 'addresses' in data && data.addresses && data.addresses.length > 0) {
      setAddressMode('existing');
    } else {
      setAddressMode('new');
    }
  };

  const handleExistingAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);

    // Find the address from leadData
    if (leadData && 'addresses' in leadData && leadData.addresses) {
      const address = leadData.addresses.find((a) => a.id === addressId);
      if (address) {
        setAddressData({
          address_line1: address.address_line1,
          address_line2: address.address_line2 || undefined,
          city: address.city,
          state: address.state,
          zip_code: address.zip_code,
          latitude: parseFloat(address.latitude),
          longitude: parseFloat(address.longitude),
        });
        setErrors({ ...errors, address: '' });
      }
    }
  };

  const handleVendorChange = (id: string | null, data: VendorSummary | null) => {
    setVendorId(id);
    setVendorData(data);
    setErrors({ ...errors, vendor: '' });
  };

  const handleAddressSelect = (address: any) => {
    setAddressData({
      address_line1: address.line1,
      address_line2: address.line2,
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      latitude: address.lat,
      longitude: address.long,
    });
    setErrors({ ...errors, address: '' });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/quotes">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Quotes
          </Button>
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Create New Quote
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Follow the steps below to create a new quote
        </p>
      </div>

      {/* Progress Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm
                      transition-all duration-200
                      ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }
                    `}
                  >
                    {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                  </div>
                  <span
                    className={`
                      mt-2 text-xs font-medium text-center
                      ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : isCompleted
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }
                    `}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {index < STEPS.length - 1 && (
                  <div
                    className={`
                      h-1 flex-1 -mt-6
                      transition-all duration-200
                      ${isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card className="p-6 mb-6">
        {/* Step 1: Customer Selection */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Select Customer
            </h2>
            <LeadSelector
              value={leadId || undefined}
              leadData={leadData}
              onChange={handleLeadChange}
              error={errors.lead}
              required
            />
          </div>
        )}

        {/* Step 2: Quote Details */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Quote Details
            </h2>

            <Input
              label="Title"
              placeholder="e.g., Kitchen Renovation Quote"
              value={quoteData.title}
              onChange={(e) =>
                setQuoteData({ ...quoteData, title: e.target.value })
              }
              error={errors.title}
              required
            />

            <VendorSelector
              value={vendorId || undefined}
              onChange={handleVendorChange}
              error={errors.vendor}
              required
              showDetails
            />

            <Input
              label="PO Number (Optional)"
              placeholder="PO-12345"
              value={quoteData.po_number}
              onChange={(e) =>
                setQuoteData({ ...quoteData, po_number: e.target.value })
              }
            />

            <Input
              label="Expiration Days"
              type="number"
              placeholder="30"
              value={quoteData.expiration_days}
              onChange={(e) =>
                setQuoteData({
                  ...quoteData,
                  expiration_days: parseInt(e.target.value) || 30,
                })
              }
              helperText="Number of days until quote expires"
              required
            />

            {/* Default Settings Toggle */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quoteData.use_default_settings}
                  onChange={(e) =>
                    setQuoteData({
                      ...quoteData,
                      use_default_settings: e.target.checked,
                    })
                  }
                  className="w-5 h-5 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Use Default Profit & Overhead Settings
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Uncheck to set custom percentages for this quote
                  </p>
                </div>
              </label>
            </div>

            {/* Custom Profit/Overhead */}
            {!quoteData.use_default_settings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <Input
                  label="Custom Profit %"
                  type="number"
                  placeholder="25"
                  value={quoteData.custom_profit_percent ?? ''}
                  onChange={(e) =>
                    setQuoteData({
                      ...quoteData,
                      custom_profit_percent: parseFloat(e.target.value),
                    })
                  }
                  error={errors.profit}
                  rightIcon={<Percent className="w-4 h-4" />}
                  required
                />

                <Input
                  label="Custom Overhead %"
                  type="number"
                  placeholder="15"
                  value={quoteData.custom_overhead_percent ?? ''}
                  onChange={(e) =>
                    setQuoteData({
                      ...quoteData,
                      custom_overhead_percent: parseFloat(e.target.value),
                    })
                  }
                  error={errors.overhead}
                  rightIcon={<Percent className="w-4 h-4" />}
                  required
                />
              </div>
            )}

            <div className="pt-4">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Private Notes (Optional)
              </label>
              <textarea
                rows={4}
                className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600"
                placeholder="Internal notes (not visible to customer)"
                value={quoteData.private_notes}
                onChange={(e) =>
                  setQuoteData({ ...quoteData, private_notes: e.target.value })
                }
              />
            </div>
          </div>
        )}

        {/* Step 3: Jobsite Address */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Jobsite Address
            </h2>

            {/* Show address mode selector only if customer has existing addresses */}
            {leadData && 'addresses' in leadData && leadData.addresses && leadData.addresses.length > 0 && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="addressMode"
                      checked={addressMode === 'existing'}
                      onChange={() => {
                        setAddressMode('existing');
                        setAddressData(null);
                        setSelectedAddressId(null);
                      }}
                      className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Use Existing Address
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="addressMode"
                      checked={addressMode === 'new'}
                      onChange={() => {
                        setAddressMode('new');
                        setAddressData(null);
                        setSelectedAddressId(null);
                      }}
                      className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Add New Address
                    </span>
                  </label>
                </div>

                {/* Existing addresses list */}
                {addressMode === 'existing' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Select Address <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {leadData.addresses.map((address) => (
                        <label
                          key={address.id}
                          className={`
                            block p-4 border-2 rounded-lg cursor-pointer transition-all
                            ${
                              selectedAddressId === address.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                            }
                          `}
                        >
                          <input
                            type="radio"
                            name="existingAddress"
                            checked={selectedAddressId === address.id}
                            onChange={() => handleExistingAddressSelect(address.id)}
                            className="sr-only"
                          />
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <MapPin className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {address.address_line1}
                                  {address.address_line2 && `, ${address.address_line2}`}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 ml-6">
                                {address.city}, {address.state} {address.zip_code}
                              </p>
                              <div className="flex items-center gap-2 mt-1 ml-6">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                  {address.address_type}
                                </span>
                                {address.is_primary && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                    Primary
                                  </span>
                                )}
                              </div>
                            </div>
                            {selectedAddressId === address.id && (
                              <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    {errors.address && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errors.address}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* New address form */}
            {addressMode === 'new' && (
              <div>
                <AddressAutocomplete
                  onSelect={handleAddressSelect}
                  error={errors.address}
                  required
                />

                {addressData && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                      Selected Address:
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {addressData.address_line1}
                      {addressData.address_line2 && <>, {addressData.address_line2}</>}
                      <br />
                      {addressData.city}, {addressData.state} {addressData.zip_code}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Review & Create
            </h2>

            {/* Customer Summary */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Customer
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)}>
                  Edit
                </Button>
              </div>
              {leadData && (
                <div className="text-sm space-y-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {'first_name' in leadData
                      ? `${leadData.first_name} ${leadData.last_name}`
                      : 'Unknown'}
                    {'company_name' in leadData && leadData.company_name && (
                      <span className="text-gray-600 dark:text-gray-400">
                        {' '}
                        ({leadData.company_name})
                      </span>
                    )}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {'email' in leadData && leadData.email}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {'phone' in leadData && leadData.phone}
                  </p>
                  {'isNew' in leadData && leadData.isNew && (
                    <p className="text-blue-600 dark:text-blue-400 text-xs font-semibold">
                      New Customer (will be created)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Quote Details Summary */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Quote Details
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)}>
                  Edit
                </Button>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Title:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {quoteData.title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Vendor:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {vendorData?.name || 'Not selected'}
                  </span>
                </div>
                {quoteData.po_number && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">PO Number:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {quoteData.po_number}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Expires In:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {quoteData.expiration_days} days
                  </span>
                </div>
                {!quoteData.use_default_settings && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Profit %:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {quoteData.custom_profit_percent}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Overhead %:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {quoteData.custom_overhead_percent}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Address Summary */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Jobsite Address
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep(3)}>
                  Edit
                </Button>
              </div>
              {addressData && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <p>{addressData.address_line1}</p>
                    {addressData.address_line2 && <p>{addressData.address_line2}</p>}
                    <p>
                      {addressData.city}, {addressData.state} {addressData.zip_code}
                    </p>
                  </div>
                  {addressMode === 'existing' && selectedAddressId && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                      Using existing customer address
                    </p>
                  )}
                  {addressMode === 'new' && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
                      New address (will be added to customer)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 1 && (
            <Button variant="ghost" onClick={handleBack} disabled={loading}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          )}
        </div>

        <div>
          {currentStep < 4 ? (
            <Button onClick={handleNext} disabled={loading}>
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} loading={loading}>
              <Check className="w-4 h-4" />
              Create Quote
            </Button>
          )}
        </div>
      </div>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        size="md"
      >
        <ModalContent>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-gray-900 dark:text-gray-100">{errorMessage}</p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setErrorModalOpen(false)}>Close</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
