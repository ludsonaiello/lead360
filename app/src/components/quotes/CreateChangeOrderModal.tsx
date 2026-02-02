/**
 * Create Change Order Modal Component
 * Modal for creating change orders on approved quotes
 * Creates a new child quote - items are added separately after creation
 * Supports all 8 CreateChangeOrderDto fields per backend API
 */

'use client';

import React, { useState } from 'react';
import { FileText, AlertCircle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { createChangeOrder } from '@/lib/api/change-orders';
import type { CreateChangeOrderDto, JobsiteAddressDto } from '@/lib/types/quotes';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface CreateChangeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentQuoteId: string;
  onCreated: () => void;
}

export function CreateChangeOrderModal({
  isOpen,
  onClose,
  parentQuoteId,
  onCreated,
}: CreateChangeOrderModalProps) {
  const router = useRouter();

  // Basic fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Advanced options toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced fields
  const [expirationDays, setExpirationDays] = useState<string>('');
  const [customProfitPercent, setCustomProfitPercent] = useState<string>('');
  const [customOverheadPercent, setCustomOverheadPercent] = useState<string>('');
  const [customContingencyPercent, setCustomContingencyPercent] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>('');

  // Jobsite address override
  const [overrideJobsite, setOverrideJobsite] = useState(false);
  const [jobsiteAddress, setJobsiteAddress] = useState<Partial<JobsiteAddressDto>>({});

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required: title
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    // Optional numeric validations
    if (expirationDays) {
      const days = parseInt(expirationDays);
      if (isNaN(days) || days < 1 || days > 365) {
        newErrors.expirationDays = 'Expiration days must be between 1 and 365';
      }
    }

    if (customProfitPercent) {
      const percent = parseFloat(customProfitPercent);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        newErrors.customProfitPercent = 'Profit percent must be between 0 and 100';
      }
    }

    if (customOverheadPercent) {
      const percent = parseFloat(customOverheadPercent);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        newErrors.customOverheadPercent = 'Overhead percent must be between 0 and 100';
      }
    }

    if (customContingencyPercent) {
      const percent = parseFloat(customContingencyPercent);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        newErrors.customContingencyPercent = 'Contingency percent must be between 0 and 100';
      }
    }

    // Jobsite address validation (if override enabled)
    if (overrideJobsite) {
      if (!jobsiteAddress.address_line1?.trim()) {
        newErrors.address_line1 = 'Address line 1 is required';
      }
      if (!jobsiteAddress.zip_code?.trim()) {
        newErrors.zip_code = 'ZIP code is required';
      } else if (!/^\d{5}(-\d{4})?$/.test(jobsiteAddress.zip_code)) {
        newErrors.zip_code = 'Invalid ZIP code format (12345 or 12345-6789)';
      }
      if (jobsiteAddress.state && jobsiteAddress.state.length !== 2) {
        newErrors.state = 'State must be exactly 2 characters';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle create
  const handleCreate = async () => {
    if (!validate()) return;

    setLoading(true);

    try {
      // Build DTO with only provided fields
      const dto: CreateChangeOrderDto = {
        title: title.trim(),
      };

      if (description.trim()) {
        dto.description = description.trim();
      }

      if (expirationDays) {
        dto.expiration_days = parseInt(expirationDays);
      }

      if (customProfitPercent) {
        dto.custom_profit_percent = parseFloat(customProfitPercent);
      }

      if (customOverheadPercent) {
        dto.custom_overhead_percent = parseFloat(customOverheadPercent);
      }

      if (customContingencyPercent) {
        dto.custom_contingency_percent = parseFloat(customContingencyPercent);
      }

      if (vendorId) {
        dto.vendor_id = vendorId;
      }

      if (overrideJobsite && jobsiteAddress.address_line1 && jobsiteAddress.zip_code) {
        dto.jobsite_address = {
          address_line1: jobsiteAddress.address_line1,
          zip_code: jobsiteAddress.zip_code,
          address_line2: jobsiteAddress.address_line2,
          city: jobsiteAddress.city,
          state: jobsiteAddress.state,
          latitude: jobsiteAddress.latitude,
          longitude: jobsiteAddress.longitude,
        };
      }

      const response = await createChangeOrder(parentQuoteId, dto);

      toast.success('Change order has been created');

      // Navigate to the child quote to add items
      router.push(`/quotes/${response.id}`);

      handleClose();
      onCreated();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create change order');
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    if (!loading) {
      setTitle('');
      setDescription('');
      setExpirationDays('');
      setCustomProfitPercent('');
      setCustomOverheadPercent('');
      setCustomContingencyPercent('');
      setVendorId('');
      setOverrideJobsite(false);
      setJobsiteAddress({});
      setShowAdvanced(false);
      setErrors({});
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalContent
        icon={<FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
        title="Create Change Order"
        description="Create a change order for this approved quote"
      >
        {/* Info Message */}
        <div className="flex items-start gap-3 mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              How Change Orders Work
            </p>
            <ul className="text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>A new child quote will be created for the changes</li>
              <li>Add/remove items on the child quote after creation</li>
              <li>Approve the change order to merge changes into parent quote</li>
              <li>All changes are tracked and audited</li>
            </ul>
          </div>
        </div>

        {/* Title Field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Change Order Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) {
                const { title: _, ...rest } = errors;
                setErrors(rest);
              }
            }}
            placeholder="Additional tile work, Change in scope, etc."
            className={`w-full px-3 py-2 border rounded-lg ${
              errors.title
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>
          )}
        </div>

        {/* Description Field */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Customer requested additional tile in bathroom, expanding project scope..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4"
        >
          {showAdvanced ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide Advanced Options
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show Advanced Options
            </>
          )}
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-3">
              Advanced Configuration
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Expiration Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expiration Days
                </label>
                <input
                  type="number"
                  value={expirationDays}
                  onChange={(e) => {
                    setExpirationDays(e.target.value);
                    if (errors.expirationDays) {
                      const { expirationDays: _, ...rest } = errors;
                      setErrors(rest);
                    }
                  }}
                  placeholder="30"
                  min="1"
                  max="365"
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.expirationDays
                      ? 'border-red-300 dark:border-red-700'
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                />
                {errors.expirationDays && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.expirationDays}
                  </p>
                )}
              </div>

              {/* Custom Profit % */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Profit %
                </label>
                <input
                  type="number"
                  value={customProfitPercent}
                  onChange={(e) => {
                    setCustomProfitPercent(e.target.value);
                    if (errors.customProfitPercent) {
                      const { customProfitPercent: _, ...rest } = errors;
                      setErrors(rest);
                    }
                  }}
                  placeholder="20.0"
                  min="0"
                  max="100"
                  step="0.1"
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.customProfitPercent
                      ? 'border-red-300 dark:border-red-700'
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                />
                {errors.customProfitPercent && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.customProfitPercent}
                  </p>
                )}
              </div>

              {/* Custom Overhead % */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Overhead %
                </label>
                <input
                  type="number"
                  value={customOverheadPercent}
                  onChange={(e) => {
                    setCustomOverheadPercent(e.target.value);
                    if (errors.customOverheadPercent) {
                      const { customOverheadPercent: _, ...rest } = errors;
                      setErrors(rest);
                    }
                  }}
                  placeholder="15.0"
                  min="0"
                  max="100"
                  step="0.1"
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.customOverheadPercent
                      ? 'border-red-300 dark:border-red-700'
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                />
                {errors.customOverheadPercent && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.customOverheadPercent}
                  </p>
                )}
              </div>

              {/* Custom Contingency % */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Contingency %
                </label>
                <input
                  type="number"
                  value={customContingencyPercent}
                  onChange={(e) => {
                    setCustomContingencyPercent(e.target.value);
                    if (errors.customContingencyPercent) {
                      const { customContingencyPercent: _, ...rest } = errors;
                      setErrors(rest);
                    }
                  }}
                  placeholder="5.0"
                  min="0"
                  max="100"
                  step="0.1"
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.customContingencyPercent
                      ? 'border-red-300 dark:border-red-700'
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                />
                {errors.customContingencyPercent && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.customContingencyPercent}
                  </p>
                )}
              </div>
            </div>

            {/* Override Jobsite Checkbox */}
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideJobsite}
                  onChange={(e) => setOverrideJobsite(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Override Jobsite Address
                </span>
              </label>
            </div>

            {/* Jobsite Address Fields */}
            {overrideJobsite && (
              <div className="mt-4 space-y-4 pl-6 border-l-2 border-blue-200 dark:border-blue-800">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address Line 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobsiteAddress.address_line1 || ''}
                    onChange={(e) => {
                      setJobsiteAddress({ ...jobsiteAddress, address_line1: e.target.value });
                      if (errors.address_line1) {
                        const { address_line1: _, ...rest } = errors;
                        setErrors(rest);
                      }
                    }}
                    placeholder="123 Main St"
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.address_line1
                        ? 'border-red-300 dark:border-red-700'
                        : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                  />
                  {errors.address_line1 && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.address_line1}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={jobsiteAddress.address_line2 || ''}
                    onChange={(e) =>
                      setJobsiteAddress({ ...jobsiteAddress, address_line2: e.target.value })
                    }
                    placeholder="Suite 100"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={jobsiteAddress.city || ''}
                      onChange={(e) =>
                        setJobsiteAddress({ ...jobsiteAddress, city: e.target.value })
                      }
                      placeholder="Boston"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={jobsiteAddress.state || ''}
                      onChange={(e) => {
                        setJobsiteAddress({ ...jobsiteAddress, state: e.target.value });
                        if (errors.state) {
                          const { state: _, ...rest } = errors;
                          setErrors(rest);
                        }
                      }}
                      placeholder="MA"
                      maxLength={2}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        errors.state
                          ? 'border-red-300 dark:border-red-700'
                          : 'border-gray-300 dark:border-gray-600'
                      } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                    />
                    {errors.state && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.state}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ZIP Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobsiteAddress.zip_code || ''}
                    onChange={(e) => {
                      setJobsiteAddress({ ...jobsiteAddress, zip_code: e.target.value });
                      if (errors.zip_code) {
                        const { zip_code: _, ...rest } = errors;
                        setErrors(rest);
                      }
                    }}
                    placeholder="02101"
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.zip_code
                        ? 'border-red-300 dark:border-red-700'
                        : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                  />
                  {errors.zip_code && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.zip_code}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next Steps Info */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <ArrowRight className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Next Steps
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                After creating the change order, you'll be redirected to the child quote where you can add items, adjust quantities, and configure the changes needed.
              </p>
            </div>
          </div>
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          loading={loading}
          disabled={loading || !title.trim()}
        >
          <FileText className="w-4 h-4" />
          Create Change Order
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default CreateChangeOrderModal;
