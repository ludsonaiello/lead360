/**
 * Vendor Management Page
 * CRUD operations for vendor management with search and filtering
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import Card from '@/components/ui/Card';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { FileUpload } from '@/components/ui/FileUpload';
import { uploadFile, deleteFile, getFile, buildFileUrl } from '@/lib/api/files';
import {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  setVendorAsDefault,
  getVendorStatistics,
  formatVendorPhone,
  formatVendorAddress,
} from '@/lib/api/vendors';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Star,
  Upload,
  BarChart3,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { Vendor, VendorSummary, VendorStatistics, CreateVendorDto } from '@/lib/types/quotes';

export default function VendorsPage() {
  // State
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorToDelete, setVendorToDelete] = useState<string | null>(null);
  const [vendorStats, setVendorStats] = useState<VendorStatistics | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<CreateVendorDto>>({
    name: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    latitude: undefined,
    longitude: undefined,
    signature_file_id: '',
    is_active: true,
    is_default: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showManualAddress, setShowManualAddress] = useState(false);

  // Signature file state
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureFileName, setSignatureFileName] = useState<string | null>(null);
  const [signatureMimeType, setSignatureMimeType] = useState<string | null>(null);

  // Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [messageModalOpen, setMessageModalOpen] = useState(false);

  useEffect(() => {
    loadVendors();
  }, [searchQuery, page]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const response = await getVendors({
        page,
        limit: 50,
        search: searchQuery || undefined,
      });
      setVendors(response?.data || []);
      setTotalPages(response?.meta?.total_pages || 1);
    } catch (err: any) {
      showError(err.message || 'Failed to load vendors');
      setVendors([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVendor = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip_code: '',
      latitude: undefined,
      longitude: undefined,
      signature_file_id: undefined,
      is_active: true,
      is_default: false,
    });
    setFormErrors({});
    setShowManualAddress(false);
    setSignatureUrl(null);
    setSignatureFileName(null);
    setSignatureMimeType(null);
    setVendorModalOpen(true);
  };

  const handleEditVendor = async (id: string) => {
    try {
      const vendor = await getVendorById(id);
      setEditingVendor(vendor);
      setFormData({
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address_line1: vendor.address_line1,
        address_line2: vendor.address_line2,
        city: vendor.city,
        state: vendor.state,
        zip_code: vendor.zip_code,
        latitude: vendor.latitude ? Number(vendor.latitude) : undefined,
        longitude: vendor.longitude ? Number(vendor.longitude) : undefined,
        signature_file_id: vendor.signature_file_id,
        is_active: vendor.is_active,
        is_default: vendor.is_default,
      });
      setFormErrors({});

      // Load signature file if exists
      if (vendor.signature_file_id) {
        try {
          const file = await getFile(vendor.signature_file_id);
          setSignatureUrl(buildFileUrl(file.url));
          setSignatureFileName(file.original_filename);
          setSignatureMimeType(file.mime_type);
        } catch (err) {
          console.error('Failed to load signature file:', err);
          setSignatureUrl(null);
          setSignatureFileName(null);
          setSignatureMimeType(null);
        }
      } else {
        setSignatureUrl(null);
        setSignatureFileName(null);
        setSignatureMimeType(null);
      }

      setShowManualAddress(false);
      setVendorModalOpen(true);
    } catch (err: any) {
      showError(err.message || 'Failed to load vendor');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setVendorAsDefault(id);
      showSuccess('Default vendor updated');
      await loadVendors();
    } catch (err: any) {
      showError(err.message || 'Failed to set default vendor');
    }
  };

  const handleViewStats = async (id: string) => {
    try {
      const stats = await getVendorStatistics(id);
      setVendorStats(stats);
      setStatsModalOpen(true);
    } catch (err: any) {
      showError(err.message || 'Failed to load statistics');
    }
  };

  const handleDeleteClick = (id: string) => {
    setVendorToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!vendorToDelete) return;

    try {
      await deleteVendor(vendorToDelete);
      showSuccess('Vendor deleted successfully');
      setDeleteModalOpen(false);
      setVendorToDelete(null);
      await loadVendors();
    } catch (err: any) {
      showError(err.message || 'Failed to delete vendor');
    }
  };

  const handleAddressSelect = (address: any) => {
    setFormData({
      ...formData,
      address_line1: address.line1,          // Fixed: was address.address_line1
      address_line2: address.line2,          // Fixed: was address.address_line2
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      latitude: address.lat,                 // Fixed: was address.latitude
      longitude: address.long,               // Fixed: was address.longitude
    });
    // Clear address errors when autocomplete selects an address
    setFormErrors({ ...formErrors, address: '', zip_code: '' });
  };

  const handleSignatureUpload = async (file: File) => {
    try {
      const response = await uploadFile(file, {
        category: 'license',
      });

      setFormData({ ...formData, signature_file_id: response.file_id });
      setSignatureUrl(buildFileUrl(response.url));
      setSignatureFileName(response.file.original_filename);
      setSignatureMimeType(response.file.mime_type);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to upload signature');
    }
  };

  const handleSignatureDelete = async () => {
    if (!formData.signature_file_id) return;

    try {
      await deleteFile(formData.signature_file_id);
      setFormData({ ...formData, signature_file_id: undefined });
      setSignatureUrl(null);
      setSignatureFileName(null);
      setSignatureMimeType(null);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete signature');
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) errors.name = 'Name is required';
    if (!formData.email?.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = 'Invalid email';

    // Phone validation - handle E.164 format from PhoneInput (+15551234567)
    const cleanedPhone = formData.phone?.replace(/\D/g, '') || '';
    if (!cleanedPhone) errors.phone = 'Phone is required';
    else if (cleanedPhone.length < 10) errors.phone = 'Phone must be at least 10 digits';

    if (!formData.address_line1?.trim()) errors.address = 'Address is required';
    if (!formData.zip_code?.trim()) errors.zip_code = 'ZIP code is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveVendor = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Clean phone: remove non-digits, then strip leading "1" if present (country code)
      const cleanedPhone = formData.phone!.replace(/\D/g, '');
      const phoneDigits = cleanedPhone.startsWith('1') && cleanedPhone.length === 11
        ? cleanedPhone.substring(1) // Remove leading 1 from +15551234567 → 5551234567
        : cleanedPhone;

      const dto: CreateVendorDto = {
        name: formData.name!,
        email: formData.email!,
        phone: phoneDigits,
        address_line1: formData.address_line1!,
        address_line2: formData.address_line2,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code!,
        is_active: formData.is_active,
        is_default: formData.is_default,
      };

      // Only include latitude/longitude if they are valid numbers
      if (typeof formData.latitude === 'number' && !isNaN(formData.latitude)) {
        dto.latitude = formData.latitude;
      }
      if (typeof formData.longitude === 'number' && !isNaN(formData.longitude)) {
        dto.longitude = formData.longitude;
      }

      // Only include signature_file_id if a signature was uploaded
      if (formData.signature_file_id) {
        dto.signature_file_id = formData.signature_file_id;
      }

      if (editingVendor) {
        await updateVendor(editingVendor.id, dto);
        showSuccess('Vendor updated successfully');
      } else {
        await createVendor(dto);
        showSuccess('Vendor created successfully');
      }

      setVendorModalOpen(false);
      await loadVendors();
    } catch (err: any) {
      showError(err.message || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setMessageModalOpen(true);
    setTimeout(() => setMessageModalOpen(false), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setMessageModalOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Vendors</h1>
        <Button onClick={handleAddVendor}>
          <Plus className="w-5 h-5" />
          Add Vendor
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search vendors by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-5 h-5" />}
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                Contact
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                Quotes
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                Default
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="animate-pulse">Loading vendors...</div>
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No vendors found
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {vendor.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Mail className="w-3.5 h-3.5 text-gray-500" />
                        {vendor.email}
                      </div>
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Phone className="w-3.5 h-3.5 text-gray-500" />
                        {formatVendorPhone(vendor.phone)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {vendor.quote_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={vendor.is_active ? 'green' : 'gray'}>
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {vendor.is_default ? (
                      <Badge variant="blue">
                        <Star className="w-3 h-3" />
                        Default
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(vendor.id)}
                        title="Set as default"
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditVendor(vendor.id)}
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewStats(vendor.id)}
                        title="View Stats"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(vendor.id)}
                        title="Delete"
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden grid grid-cols-1 gap-4">
        {vendors.map((vendor) => (
          <Card key={vendor.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">
                  {vendor.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={vendor.is_active ? 'green' : 'gray'}>
                    {vendor.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {vendor.is_default && (
                    <Badge variant="blue">
                      <Star className="w-3 h-3" />
                      Default
                    </Badge>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {vendor.quote_count} quotes
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                {vendor.email}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                {formatVendorPhone(vendor.phone)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => handleEditVendor(vendor.id)}
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewStats(vendor.id)}
              >
                <BarChart3 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(vendor.id)}
                className="text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create/Edit Vendor Modal */}
      <Modal
        isOpen={vendorModalOpen}
        onClose={() => !saving && setVendorModalOpen(false)}
        title={editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
        size="lg"
      >
        <ModalContent>
          <div className="space-y-4">
            <Input
              label="Vendor Name"
              placeholder="ABC Company"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="vendor@example.com"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={formErrors.email}
                required
              />

              <PhoneInput
                label="Phone"
                placeholder="(555) 123-4567"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                error={formErrors.phone}
                required
              />
            </div>

            {/* Address Section */}
            <div className="space-y-4">
              <AddressAutocomplete
                onSelect={handleAddressSelect}
                error={formErrors.address}
                defaultValue={formData.address_line1}
                required
              />

              {/* Toggle for Manual Address Fields */}
              <button
                type="button"
                onClick={() => setShowManualAddress(!showManualAddress)}
                className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                {showManualAddress ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide Manual Address Entry
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Enter Address Manually
                  </>
                )}
              </button>

              {/* Manual Address Fields (collapsible) */}
              {showManualAddress && (
                <div className="space-y-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10">
                  <Input
                    label="Address Line 1"
                    placeholder="123 Main St"
                    value={formData.address_line1 || ''}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        address_line1: e.target.value,
                        latitude: undefined,
                        longitude: undefined,
                      });
                      setFormErrors({ ...formErrors, address: '' });
                    }}
                    error={formErrors.address}
                    required
                    helperText="Street address"
                  />

                  <Input
                    label="Address Line 2"
                    placeholder="Suite 100"
                    value={formData.address_line2 || ''}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    helperText="Apartment, suite, unit, etc. (optional)"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="City"
                      placeholder="Boston"
                      value={formData.city || ''}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />

                    <Input
                      label="State"
                      placeholder="MA"
                      value={formData.state || ''}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      maxLength={2}
                      helperText="2-letter code"
                    />

                    <Input
                      label="ZIP Code"
                      placeholder="02101"
                      value={formData.zip_code || ''}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          zip_code: e.target.value,
                          latitude: undefined,
                          longitude: undefined,
                        });
                        setFormErrors({ ...formErrors, zip_code: '' });
                      }}
                      error={formErrors.zip_code}
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <FileUpload
              label="Vendor Signature"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              maxSize={5}
              onUpload={handleSignatureUpload}
              onDelete={handleSignatureDelete}
              preview
              helperText="Upload vendor's signature (optional). PNG, JPG, or WEBP. Max 5MB."
              currentFileUrl={signatureUrl || undefined}
              currentFileName={signatureFileName || undefined}
              currentFileMimeType={signatureMimeType || undefined}
            />

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active !== false}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="w-5 h-5 text-green-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-green-500"
              />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Vendor is active
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_default || false}
                onChange={(e) =>
                  setFormData({ ...formData, is_default: e.target.checked })
                }
                className="w-5 h-5 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Set as default vendor
              </span>
            </label>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="ghost"
            onClick={() => setVendorModalOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSaveVendor} loading={saving}>
            {editingVendor ? 'Update' : 'Create'} Vendor
          </Button>
        </ModalActions>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Delete"
        size="md"
      >
        <ModalContent>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                Are you sure you want to delete this vendor?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This action cannot be undone.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete Vendor
          </Button>
        </ModalActions>
      </Modal>

      {/* Stats Modal */}
      <Modal
        isOpen={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        title="Vendor Statistics"
        size="lg"
      >
        <ModalContent>
          {vendorStats && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Quotes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {vendorStats.total_quotes || 0}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Accepted</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {vendorStats.accepted_count || 0}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ${(vendorStats.total_revenue || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Quote</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  ${(vendorStats.avg_quote_value || 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setStatsModalOpen(false)}>Close</Button>
        </ModalActions>
      </Modal>

      {/* Message Modal */}
      <Modal
        isOpen={messageModalOpen}
        onClose={() => !successMessage && setMessageModalOpen(false)}
        title={successMessage ? 'Success' : 'Error'}
        size="sm"
        showCloseButton={!!errorMessage}
      >
        <ModalContent>
          <p
            className={
              successMessage
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }
          >
            {successMessage || errorMessage}
          </p>
        </ModalContent>
        {errorMessage && (
          <ModalActions>
            <Button onClick={() => setMessageModalOpen(false)}>Close</Button>
          </ModalActions>
        )}
      </Modal>
    </div>
  );
}
