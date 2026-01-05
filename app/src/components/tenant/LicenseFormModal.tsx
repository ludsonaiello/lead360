/**
 * LicenseFormModal Component
 * Modal form for creating/editing professional licenses
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { Award, FileText } from 'lucide-react';
import { licenseSchema, type LicenseFormData } from '@/lib/utils/validation';
import { tenantApi } from '@/lib/api/tenant';
import { License, LicenseType, CreateLicenseData, UpdateLicenseData } from '@/lib/types/tenant';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select, SelectOption } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FileUpload } from '@/components/ui/FileUpload';

interface LicenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  license?: License | null;
}

const US_STATES: SelectOption[] = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
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

// Helper to extract date from datetime string
const extractDate = (datetime: string | null | undefined): string => {
  if (!datetime) return '';
  return datetime.split('T')[0];
};

// Helper to get file extension from filename
const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
};

export function LicenseFormModal({ isOpen, onClose, onSuccess, license }: LicenseFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [licenseTypes, setLicenseTypes] = useState<LicenseType[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [showCustomType, setShowCustomType] = useState(false);
  const [currentFileUrl, setCurrentFileUrl] = useState<string | undefined>(undefined);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [currentFileMimeType, setCurrentFileMimeType] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      license_type_id: license?.license_type_id || undefined,
      custom_license_type: license?.custom_license_type || '',
      license_number: license?.license_number || '',
      issuing_state: license?.issuing_state || '',
      issue_date: extractDate(license?.issue_date),
      expiry_date: extractDate(license?.expiry_date),
      document_file_id: license?.document_file_id || undefined,
    },
  });

  useEffect(() => {
    loadLicenseTypes();
  }, []);

  // Reset form when license changes
  useEffect(() => {
    if (license) {
      reset({
        license_type_id: license.license_type_id || undefined,
        custom_license_type: license.custom_license_type || '',
        license_number: license.license_number,
        issuing_state: license.issuing_state,
        issue_date: extractDate(license.issue_date),
        expiry_date: extractDate(license.expiry_date),
        document_file_id: license.document_file_id || undefined,
      });
      setShowCustomType(!!license.custom_license_type);

      // Set file info from license
      if (license.document_file) {
        const uploadBaseUrl = process.env.NEXT_PUBLIC_UPLOAD_DIR || 'https://app.lead360.app/uploads/public';
        setCurrentFileUrl(`${uploadBaseUrl}/${license.tenant_id}/files/${license.document_file.file_id}${getFileExtension(license.document_file.original_filename)}`);
        setCurrentFileName(license.document_file.original_filename);
        setCurrentFileMimeType(license.document_file.mime_type);
      } else {
        setCurrentFileUrl(undefined);
        setCurrentFileName(undefined);
        setCurrentFileMimeType(undefined);
      }
    } else {
      reset({
        license_type_id: undefined,
        custom_license_type: '',
        license_number: '',
        issuing_state: '',
        issue_date: '',
        expiry_date: '',
        document_file_id: undefined,
      });
      setShowCustomType(false);
      setCurrentFileUrl(undefined);
      setCurrentFileName(undefined);
      setCurrentFileMimeType(undefined);
    }
  }, [license, reset]);

  const loadLicenseTypes = async () => {
    try {
      setIsLoadingTypes(true);
      const types = await tenantApi.getLicenseTypes();
      setLicenseTypes(types);
    } catch (error: any) {
      toast.error('Failed to load license types');
    } finally {
      setIsLoadingTypes(false);
    }
  };

  const onSubmit = async (data: LicenseFormData) => {
    try {
      setIsSubmitting(true);

      if (license) {
        // Update existing license
        const updateData: UpdateLicenseData = {
          license_type_id: showCustomType ? null : data.license_type_id || null,
          custom_license_type: showCustomType ? data.custom_license_type || null : null,
          license_number: data.license_number,
          issuing_state: data.issuing_state,
          issue_date: data.issue_date,
          expiry_date: data.expiry_date,
          document_file_id: data.document_file_id || null,
        };
        await tenantApi.updateLicense(license.id, updateData);
        toast.success('License updated successfully');
      } else {
        // Create new license
        const createData: CreateLicenseData = {
          license_type_id: showCustomType ? undefined : data.license_type_id || undefined,
          custom_license_type: showCustomType ? data.custom_license_type || undefined : undefined,
          license_number: data.license_number,
          issuing_state: data.issuing_state,
          issue_date: data.issue_date,
          expiry_date: data.expiry_date,
          document_file_id: data.document_file_id || undefined,
        };
        await tenantApi.createLicense(createData);
        toast.success('License created successfully');
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save license');
    } finally {
      setIsSubmitting(false);
    }
  };

  const licenseTypeOptions: SelectOption[] = [
    ...licenseTypes.map((type) => ({
      value: type.id,
      label: type.name,
    })),
    { value: 'other', label: 'Other (Custom Type)' },
  ];

  const handleLicenseTypeChange = (value: string) => {
    if (value === 'other') {
      setShowCustomType(true);
      setValue('license_type_id', undefined);
    } else {
      setShowCustomType(false);
      setValue('license_type_id', value);
      setValue('custom_license_type', '');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <>
          <Award className="w-5 h-5" />
          {license ? 'Edit License' : 'Add License'}
        </>
      }
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          {isLoadingTypes ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* License Type */}
              {!showCustomType ? (
                <Select
                  label="License Type"
                  options={licenseTypeOptions}
                  value={watch('license_type_id') || 'other'}
                  onChange={handleLicenseTypeChange}
                  error={errors.license_type_id?.message}
                  searchable
                  required
                />
              ) : (
                <div className="space-y-4">
                  <Input
                    {...register('custom_license_type')}
                    label="Custom License Type"
                    error={errors.custom_license_type?.message}
                    placeholder="Enter license type name"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomType(false);
                      setValue('custom_license_type', '');
                    }}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Select from standard types instead
                  </button>
                </div>
              )}

              {/* License Number */}
              <Input
                {...register('license_number')}
                label="License Number"
                error={errors.license_number?.message}
                placeholder="Enter license number"
                required
              />

              {/* Issuing State */}
              <Select
                label="Issuing State"
                options={US_STATES}
                value={watch('issuing_state')}
                onChange={(value) => setValue('issuing_state', value)}
                error={errors.issuing_state?.message}
                searchable
                required
              />

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Controller
                  name="issue_date"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      value={field.value || ''}
                      label="Issue Date"
                      error={errors.issue_date?.message}
                      required
                    />
                  )}
                />

                <Controller
                  name="expiry_date"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      value={field.value || ''}
                      label="Expiry Date"
                      error={errors.expiry_date?.message}
                      min={watch('issue_date')}
                      required
                    />
                  )}
                />
              </div>

              {/* Document Upload */}
              {license && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <FileUpload
                    label="License Document"
                    accept=".pdf,.png,.jpg,.jpeg"
                    maxSize={10}
                    onUpload={async (file) => {
                      const response = await tenantApi.uploadLicenseDocument(license.id, file);

                      // Extract file_id from URL: /uploads/public/{tenant_id}/files/{file_id}.ext
                      const urlParts = response.url.split('/');
                      const fileWithExt = urlParts[urlParts.length - 1]; // e.g., "abc123.pdf"
                      const fileId = fileWithExt.split('.')[0]; // e.g., "abc123"

                      // Update form field with the uploaded file ID
                      setValue('document_file_id', fileId);

                      // Build full URL using environment variable
                      const uploadBaseUrl = process.env.NEXT_PUBLIC_UPLOAD_DIR || 'https://app.lead360.app/uploads/public';

                      // If response URL is absolute, use it; otherwise construct from base URL + relative path
                      let normalizedUrl: string;
                      if (response.url.startsWith('http')) {
                        normalizedUrl = response.url;
                      } else {
                        // API returns /public/{tenant_id}/files/{file_id}.ext (missing /uploads)
                        // Remove /public/ prefix and construct full URL
                        const relativePath = response.url.replace(/^\/public\//, '');
                        normalizedUrl = `${uploadBaseUrl}/${relativePath}`;
                      }

                      setCurrentFileUrl(normalizedUrl);
                      setCurrentFileName(file.name);
                      setCurrentFileMimeType(file.type);
                      toast.success('License document uploaded successfully');
                    }}
                    onDelete={async () => {
                      await tenantApi.deleteLicenseDocument(license.id);
                      // Clear form field
                      setValue('document_file_id', undefined);
                      // Clear local state
                      setCurrentFileUrl(undefined);
                      setCurrentFileName(undefined);
                      setCurrentFileMimeType(undefined);
                      toast.success('License document deleted successfully');
                    }}
                    currentFileUrl={currentFileUrl}
                    currentFileName={currentFileName}
                    currentFileMimeType={currentFileMimeType}
                    helperText="Upload PDF, PNG, or JPG (max 10MB)"
                  />
                </div>
              )}
            </div>
          )}
        </ModalContent>

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={isLoadingTypes}>
            {isSubmitting ? 'Saving...' : license ? 'Update License' : 'Add License'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

export default LicenseFormModal;
