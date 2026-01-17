/**
 * Create Lead Page
 * Comprehensive form for creating new leads
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { Modal } from '@/components/ui/Modal';
import { createLead } from '@/lib/api/leads';
import { createLeadSchema, type CreateLeadFormData } from '@/lib/utils/validation';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';

export default function CreateLeadPage() {
  const router = useRouter();
  const { canPerform } = useRBAC();
  const [loading, setLoading] = useState(false);
  const [showServiceRequest, setShowServiceRequest] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
    linkText?: string;
    linkUrl?: string;
  } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateLeadFormData>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      language_spoken: 'EN',
      accept_sms: false,
      preferred_communication: 'email',
      source: 'manual',
      emails: [{ email: '', is_primary: true }],
      phones: [{ phone: '', phone_type: 'mobile', is_primary: true }],
      addresses: [],
      service_request: undefined,
    },
  });

  const {
    fields: emailFields,
    append: appendEmail,
    remove: removeEmail,
  } = useFieldArray({
    control,
    name: 'emails',
  });

  const {
    fields: phoneFields,
    append: appendPhone,
    remove: removePhone,
  } = useFieldArray({
    control,
    name: 'phones',
  });

  const {
    fields: addressFields,
    append: appendAddress,
    remove: removeAddress,
  } = useFieldArray({
    control,
    name: 'addresses',
  });

  const canCreate = canPerform('leads', 'create');

  if (!canCreate) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to create leads.</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: CreateLeadFormData) => {
    try {
      setLoading(true);

      // Filter out empty emails and phones
      const cleanedData = {
        ...data,
        emails: data.emails?.filter((e) => e.email.trim() !== ''),
        phones: data.phones?.filter((p) => p.phone.trim() !== ''),
      };

      console.log('[Create Lead] Submitting data:', cleanedData);

      const lead = await createLead(cleanedData);
      toast.success('Lead created successfully!');
      router.push(`/leads/${lead.id}`);
    } catch (error: any) {
      console.error('[Create Lead] Error:', error);

      if (error.status === 409) {
        // Phone duplicate
        setErrorDetails({
          title: 'Duplicate Phone Number',
          message: error.message || 'This phone number already exists in the system.',
          linkText: 'View existing lead',
          linkUrl: error.data?.lead_id ? `/leads/${error.data.lead_id}` : undefined,
        });
        setShowErrorModal(true);
      } else {
        setErrorDetails({
          title: 'Error Creating Lead',
          message: error.message || 'An unexpected error occurred. Please try again.',
        });
        setShowErrorModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/leads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-5 h-5" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Create New Lead</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Fill in the lead information below
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Basic Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('first_name')}
                type="text"
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  placeholder:text-gray-400 dark:placeholder:text-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="John"
              />
              {errors.first_name && (
                <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('last_name')}
                type="text"
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  placeholder:text-gray-400 dark:placeholder:text-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Doe"
              />
              {errors.last_name && (
                <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Language Spoken
              </label>
              <select
                {...register('language_spoken')}
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="EN">English</option>
                <option value="ES">Spanish</option>
                <option value="PT">Portuguese</option>
                <option value="FR">French</option>
                <option value="DE">German</option>
                <option value="ZH">Chinese</option>
                <option value="JA">Japanese</option>
                <option value="KO">Korean</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Source
              </label>
              <select
                {...register('source')}
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="manual">Manual</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="phone_call">Phone Call</option>
                <option value="walk_in">Walk-in</option>
                <option value="social_media">Social Media</option>
                <option value="email">Email</option>
                <option value="webhook">Webhook</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Preferred Communication
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    {...register('preferred_communication')}
                    type="radio"
                    value="email"
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    {...register('preferred_communication')}
                    type="radio"
                    value="phone"
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Phone</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    {...register('preferred_communication')}
                    type="radio"
                    value="sms"
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">SMS</span>
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register('accept_sms')}
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Accept SMS notifications
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Contact Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Contact Information
          </h2>

          {/* Emails */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Email Addresses <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              {emailFields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <div className="flex-1">
                    <input
                      {...register(`emails.${index}.email` as const)}
                      type="email"
                      placeholder="john@example.com"
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                        placeholder:text-gray-400 dark:placeholder:text-gray-500
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.emails?.[index]?.email && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.emails[index]?.email?.message}
                      </p>
                    )}
                  </div>
                  <label className="flex items-center gap-2 whitespace-nowrap">
                    <input
                      {...register(`emails.${index}.is_primary` as const)}
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Primary</span>
                  </label>
                  {emailFields.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeEmail(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => appendEmail({ email: '', is_primary: false })}
              className="mt-2"
            >
              <Plus className="w-4 h-4" />
              Add Another Email
            </Button>
            {errors.emails && 'root' in errors.emails && (
              <p className="text-red-500 text-xs mt-1">{(errors.emails as any).root?.message}</p>
            )}
          </div>

          {/* Phones */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Phone Numbers <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              {phoneFields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  <div className="md:col-span-5">
                    <Controller
                      name={`phones.${index}.phone`}
                      control={control}
                      render={({ field }) => (
                        <PhoneInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="(555) 123-4567"
                          className="w-full"
                        />
                      )}
                    />
                    {errors.phones?.[index]?.phone && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.phones[index]?.phone?.message}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-3">
                    <select
                      {...register(`phones.${index}.phone_type` as const)}
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="mobile">Mobile</option>
                      <option value="home">Home</option>
                      <option value="work">Work</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 h-full">
                      <input
                        {...register(`phones.${index}.is_primary` as const)}
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Primary</span>
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    {phoneFields.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removePhone(index)}
                        className="w-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => appendPhone({ phone: '', phone_type: 'mobile', is_primary: false })}
              className="mt-2"
            >
              <Plus className="w-4 h-4" />
              Add Another Phone
            </Button>
          </div>
        </div>

        {/* Section 3: Addresses */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Addresses</h2>

          <div className="space-y-4">
            {addressFields.map((field, index) => (
              <div key={field.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Address {index + 1}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeAddress(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <Controller
                    name={`addresses.${index}`}
                    control={control}
                    render={({ field }) => (
                      <AddressAutocomplete
                        onSelect={(address) => {
                          field.onChange({
                            ...field.value,
                            address_line1: address.line1,
                            address_line2: address.line2,
                            city: address.city,
                            state: address.state,
                            zip_code: address.zip_code,
                            latitude: address.lat,
                            longitude: address.long,
                          });
                        }}
                      />
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <select
                        {...register(`addresses.${index}.address_type` as const)}
                        className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="service">Service</option>
                        <option value="billing">Billing</option>
                        <option value="mailing">Mailing</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 h-full">
                        <input
                          {...register(`addresses.${index}.is_primary` as const)}
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Primary Address
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                appendAddress({
                  address_line1: '',
                  address_line2: '',
                  city: '',
                  state: '',
                  zip_code: '',
                  address_type: 'service',
                  is_primary: addressFields.length === 0,
                })
              }
            >
              <Plus className="w-4 h-4" />
              Add Address
            </Button>
          </div>
        </div>

        {/* Section 4: Service Request (Optional, Collapsible) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
          <button
            type="button"
            onClick={() => setShowServiceRequest(!showServiceRequest)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Service Request (Optional)
            </h2>
            {showServiceRequest ? (
              <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>

          {showServiceRequest && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Service Name
                </label>
                <input
                  {...register('service_request.service_name')}
                  type="text"
                  placeholder="e.g., Plumbing Repair"
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    placeholder:text-gray-400 dark:placeholder:text-gray-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Service Type
                </label>
                <input
                  {...register('service_request.service_type')}
                  type="text"
                  placeholder="e.g., Emergency Repair"
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    placeholder:text-gray-400 dark:placeholder:text-gray-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Urgency
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      {...register('service_request.urgency')}
                      type="radio"
                      value="low"
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Low</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      {...register('service_request.urgency')}
                      type="radio"
                      value="medium"
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Medium</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      {...register('service_request.urgency')}
                      type="radio"
                      value="high"
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">High</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      {...register('service_request.urgency')}
                      type="radio"
                      value="emergency"
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Emergency</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  {...register('service_request.service_description')}
                  rows={4}
                  placeholder="Describe the service needed..."
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    placeholder:text-gray-400 dark:placeholder:text-gray-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 justify-end">
          <Link href="/leads">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Lead...
              </>
            ) : (
              'Create Lead'
            )}
          </Button>
        </div>
      </form>

      {/* Error Modal */}
      {errorDetails && (
        <Modal
          isOpen={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          title={errorDetails.title}
        >
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">{errorDetails.message}</p>
            {errorDetails.linkUrl && errorDetails.linkText && (
              <Link href={errorDetails.linkUrl}>
                <Button className="w-full">{errorDetails.linkText}</Button>
              </Link>
            )}
            <Button variant="ghost" onClick={() => setShowErrorModal(false)} className="w-full">
              Close
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
