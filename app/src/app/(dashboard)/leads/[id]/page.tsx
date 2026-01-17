/**
 * Lead Details Page
 * Display complete lead information with all related data
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Plus,
  Calendar,
  User,
  FileText,
  Trash2,
  Pin,
  PinOff,
  Save,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import { LeadSourceBadge } from '@/components/leads/LeadSourceBadge';
import { FastActionButtons } from '@/components/leads/FastActionButtons';
import { ServiceRequestCard } from '@/components/leads/ServiceRequestCard';
import { ServiceRequestCardExpanded } from '@/components/leads/ServiceRequestCardExpanded';
import { AddServiceRequestModal, type ServiceRequestFormData } from '@/components/leads/AddServiceRequestModal';
import { ActivityTimeline } from '@/components/leads/ActivityTimeline';
import { NotesList } from '@/components/leads/NotesList';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { AddressesMap } from '@/components/leads/AddressesMap';
import {
  getLeadById,
  formatPhone,
  getPrimaryContact,
  updateLeadStatus,
  addEmail,
  updateEmail,
  deleteEmail,
  addPhone,
  updatePhone,
  deletePhone,
  addAddress,
  updateAddress,
  deleteAddress,
  updateServiceRequest,
  createServiceRequest,
  deleteServiceRequest,
  deleteLead,
} from '@/lib/api/leads';
import type { Lead, LeadEmail, LeadPhone, LeadAddress } from '@/lib/types/leads';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';

export default function LeadDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { canPerform } = useRBAC();
  const leadId = params?.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [lostReason, setLostReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Contact method inline add forms
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneType, setNewPhoneType] = useState<'mobile' | 'home' | 'work' | 'other'>('mobile');
  const [newAddress, setNewAddress] = useState<any>(null);
  const [newAddressType, setNewAddressType] = useState<'service' | 'billing' | 'mailing' | 'other'>('service');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  // Map toggle
  const [showMap, setShowMap] = useState(false);

  // Service Request modal
  const [showAddServiceRequestModal, setShowAddServiceRequestModal] = useState(false);

  // Confirmation modals
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteAction, setDeleteAction] = useState<{ type: 'email' | 'phone' | 'address'; id: string } | null>(null);
  const [showDeleteLeadModal, setShowDeleteLeadModal] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);

  // Collapsible sections state
  const [showEmails, setShowEmails] = useState(true);
  const [showPhones, setShowPhones] = useState(true);
  const [showAddresses, setShowAddresses] = useState(true);
  const [showServiceRequests, setShowServiceRequests] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);

  // Check permissions
  const canView = canPerform('leads', 'view');
  const canEdit = canPerform('leads', 'edit');
  const canDelete = canPerform('leads', 'delete');

  useEffect(() => {
    if (leadId) {
      loadLead();
    }
  }, [leadId]);

  const loadLead = async () => {
    try {
      setLoading(true);
      const data = await getLeadById(leadId);
      setLead(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load lead');
      router.push('/leads');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedStatus) return;

    try {
      setStatusLoading(true);
      await updateLeadStatus(leadId, selectedStatus, selectedStatus === 'lost' ? lostReason : undefined);
      toast.success('Status updated successfully');
      setShowStatusModal(false);
      setLostReason('');
      await loadLead();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDeleteEmail = (emailId: string) => {
    setDeleteAction({ type: 'email', id: emailId });
    setShowConfirmDelete(true);
  };

  const handleDeletePhone = (phoneId: string) => {
    setDeleteAction({ type: 'phone', id: phoneId });
    setShowConfirmDelete(true);
  };

  const handleDeleteAddress = (addressId: string) => {
    setDeleteAction({ type: 'address', id: addressId });
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteAction) return;

    try {
      switch (deleteAction.type) {
        case 'email':
          await deleteEmail(leadId, deleteAction.id);
          toast.success('Email deleted successfully');
          break;
        case 'phone':
          await deletePhone(leadId, deleteAction.id);
          toast.success('Phone deleted successfully');
          break;
        case 'address':
          await deleteAddress(leadId, deleteAction.id);
          toast.success('Address deleted successfully');
          break;
      }
      await loadLead();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    } finally {
      setShowConfirmDelete(false);
      setDeleteAction(null);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    setIsSubmittingContact(true);
    try {
      const isPrimary = lead?.emails.length === 0;
      await addEmail(leadId, {
        email: newEmail.trim(),
        is_primary: isPrimary,
      });
      toast.success('Email added successfully');
      setNewEmail('');
      setShowAddEmail(false);
      await loadLead();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add email');
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleAddPhone = async () => {
    if (!newPhone.trim()) {
      toast.error('Phone is required');
      return;
    }

    setIsSubmittingContact(true);
    try {
      // Phone is already in E.164 format from PhoneInput, strip +1
      const cleaned = newPhone.replace(/^\+1/, '').replace(/\D/g, '');
      if (cleaned.length !== 10) {
        toast.error('Phone must be 10 digits');
        setIsSubmittingContact(false);
        return;
      }
      const isPrimary = lead?.phones.length === 0;
      await addPhone(leadId, {
        phone: cleaned,
        phone_type: newPhoneType,
        is_primary: isPrimary,
      });
      toast.success('Phone added successfully');
      setNewPhone('');
      setShowAddPhone(false);
      await loadLead();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add phone');
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress) {
      toast.error('Please select an address from Google Maps autocomplete');
      return;
    }

    setIsSubmittingContact(true);
    try {
      const isPrimary = lead?.addresses.length === 0;
      await addAddress(leadId, {
        address_line1: newAddress.address_line1,
        address_line2: newAddress.address_line2,
        city: newAddress.city,
        state: newAddress.state,
        zip_code: newAddress.zip_code,
        latitude: newAddress.latitude,
        longitude: newAddress.longitude,
        address_type: newAddressType,
        is_primary: isPrimary,
      });
      toast.success('Address added successfully');
      setNewAddress(null);
      setShowAddAddress(false);
      await loadLead();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add address');
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleToggleEmailPrimary = async (emailId: string) => {
    try {
      await updateEmail(leadId, emailId, { is_primary: true });
      toast.success('Primary email updated');
      await loadLead();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update primary email');
    }
  };

  const handleTogglePhonePrimary = async (phoneId: string) => {
    try {
      await updatePhone(leadId, phoneId, { is_primary: true });
      toast.success('Primary phone updated');
      await loadLead();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update primary phone');
    }
  };

  const handleToggleAddressPrimary = async (addressId: string) => {
    try {
      await updateAddress(leadId, addressId, { is_primary: true });
      toast.success('Primary address updated');
      await loadLead();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update primary address');
    }
  };

  const handleUpdateServiceRequest = async (requestId: string, updates: any) => {
    try {
      await updateServiceRequest(requestId, updates);
      await loadLead(); // Reload to get updated service requests
    } catch (error: any) {
      // Re-throw so child component can catch and display the error
      throw error;
    }
  };

  const handleCreateServiceRequest = async (data: ServiceRequestFormData) => {
    try {
      let addressId = data.addressId;

      // If new address, create it first
      if (data.newAddress && !addressId) {
        const isPrimary = lead?.addresses.length === 0;
        const createdAddress = await addAddress(leadId, {
          ...data.newAddress,
          is_primary: isPrimary,
        });
        addressId = createdAddress.id;
      }

      if (!addressId) {
        throw new Error('Address ID is required');
      }

      // Create service request
      await createServiceRequest(leadId, addressId, {
        service_name: data.service_name,
        service_type: data.service_type,
        service_description: data.service_description,
        urgency: data.urgency,
        requested_date: data.requested_date,
        estimated_value: data.estimated_value,
        notes: data.notes,
      });

      toast.success('Service request created successfully');
      await loadLead(); // Reload to show new service request
    } catch (error: any) {
      throw error; // Let modal handle the error
    }
  };

  const handleDeleteServiceRequest = async (requestId: string) => {
    try {
      await deleteServiceRequest(requestId);
      await loadLead(); // Reload to remove deleted service request
    } catch (error: any) {
      // Axios interceptor returns structured error: { status, message, error, data }
      throw error; // Pass through the error, component will handle display
    }
  };

  const handleDeleteLeadClick = () => {
    setShowDeleteLeadModal(true);
  };

  const handleConfirmDeleteLead = async () => {
    setIsDeletingLead(true);
    try {
      await deleteLead(leadId);
      toast.success('Lead deleted successfully');
      setShowDeleteLeadModal(false);
      router.push('/leads'); // Redirect to leads list
    } catch (error: any) {
      // Axios interceptor returns structured error: { status, message, error, data }
      const errorMessage = error?.message || 'Failed to delete lead';

      toast.error(errorMessage, {
        duration: 5000,
        style: {
          maxWidth: '500px',
        },
      });
      setIsDeletingLead(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to view leads.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-500" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Lead Not Found</h1>
          <Link href="/leads">
            <Button variant="ghost">Back to Leads</Button>
          </Link>
        </div>
      </div>
    );
  }

  const primaryEmail = lead.emails.find((e) => e.is_primary);
  const primaryPhone = lead.phones.find((p) => p.is_primary);
  const primaryAddress = lead.addresses.find((a) => a.is_primary);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/leads">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {lead.first_name} {lead.last_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 sm:mt-1">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Created {format(new Date(lead.created_at), 'MMM d, yyyy')}
              </p>
              {lead.external_source_id && (
                <>
                  <span className="text-gray-400 dark:text-gray-600">•</span>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Source ID:{' '}
                    <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">
                      {lead.external_source_id}
                    </code>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons - Stack on mobile */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex-1 sm:flex-initial">
            <FastActionButtons
              primaryPhone={primaryPhone?.phone}
              primaryEmail={primaryEmail?.email}
              size="lg"
            />
          </div>
          {canEdit && (
            <>
              <Link href={`/leads/${leadId}/edit`} className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">
                  <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                  Edit Lead
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={handleDeleteLeadClick}
                className="w-full sm:w-auto text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                Delete Lead
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status and Source Row */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Status
            </label>
            <div className="flex items-center gap-2">
              <LeadStatusBadge status={lead.status as any} />
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedStatus(lead.status);
                    setShowStatusModal(true);
                  }}
                  className="flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Change
                </Button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Source
            </label>
            <LeadSourceBadge source={lead.source as any} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Preferred Communication
            </label>
            <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
              {lead.preferred_communication || 'Not set'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Contact Information */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Emails Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 border-b-2 border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowEmails(!showEmails)}
                className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                Email Addresses ({lead.emails.length})
                {showEmails ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
              {canEdit && !showAddEmail && showEmails && (
                <Button size="sm" onClick={() => setShowAddEmail(true)} className="self-start sm:self-auto">
                  <Plus className="w-4 h-4" />
                  Add Email
                </Button>
              )}
            </div>

            {showEmails && (
              <div className="p-3 sm:p-4">

            {/* Add Email Form */}
            {showAddEmail && canEdit && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex flex-col gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddEmail}
                      disabled={isSubmittingContact}
                      className="flex-1 sm:flex-initial"
                    >
                      {isSubmittingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowAddEmail(false);
                        setNewEmail('');
                      }}
                      disabled={isSubmittingContact}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {lead.emails.length === 0 && !showAddEmail ? (
              <p className="text-gray-500 dark:text-gray-500 text-sm">No email addresses</p>
            ) : (
              <div className="space-y-2">
                {lead.emails.map((email) => (
                  <div
                    key={email.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0 flex-1">
                      {email.is_primary && (
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 self-start px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                          PRIMARY
                        </span>
                      )}
                      <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100 break-all">{email.email}</span>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 self-start sm:self-auto">
                        {!email.is_primary && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleEmailPrimary(email.id)}
                            title="Set as primary"
                          >
                            <Pin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteEmail(email.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
              </div>
            )}
          </div>

          {/* Phones Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 border-b-2 border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowPhones(!showPhones)}
                className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                Phone Numbers ({lead.phones.length})
                {showPhones ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
              {canEdit && !showAddPhone && showPhones && (
                <Button size="sm" onClick={() => setShowAddPhone(true)} className="self-start sm:self-auto">
                  <Plus className="w-4 h-4" />
                  Add Phone
                </Button>
              )}
            </div>

            {showPhones && (
              <div className="p-3 sm:p-4">

            {/* Add Phone Form */}
            {showAddPhone && canEdit && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex flex-col gap-2">
                  <PhoneInput
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="text-sm py-2"
                  />
                  <select
                    value={newPhoneType}
                    onChange={(e) => setNewPhoneType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="mobile">Mobile</option>
                    <option value="home">Home</option>
                    <option value="work">Work</option>
                    <option value="other">Other</option>
                  </select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddPhone}
                      disabled={isSubmittingContact}
                      className="flex-1 sm:flex-initial"
                    >
                      {isSubmittingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowAddPhone(false);
                        setNewPhone('');
                        setNewPhoneType('mobile');
                      }}
                      disabled={isSubmittingContact}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {lead.phones.length === 0 && !showAddPhone ? (
              <p className="text-gray-500 dark:text-gray-500 text-sm">No phone numbers</p>
            ) : (
              <div className="space-y-2">
                {lead.phones.map((phone) => (
                  <div
                    key={phone.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-1">
                      {phone.is_primary && (
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 self-start px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                          PRIMARY
                        </span>
                      )}
                      <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100">
                        {formatPhone(phone.phone)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-500 capitalize">
                        {phone.phone_type}
                      </span>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 self-start sm:self-auto">
                        {!phone.is_primary && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTogglePhonePrimary(phone.id)}
                            title="Set as primary"
                          >
                            <Pin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeletePhone(phone.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
              </div>
            )}
          </div>

          {/* Addresses Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 border-b-2 border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAddresses(!showAddresses)}
                className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                Addresses ({lead.addresses.length})
                {showAddresses ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
              {canEdit && !showAddAddress && showAddresses && (
                <Button size="sm" onClick={() => setShowAddAddress(true)} className="self-start sm:self-auto">
                  <Plus className="w-4 h-4" />
                  Add Address
                </Button>
              )}
            </div>

            {showAddresses && (
              <div className="p-3 sm:p-4">

            {/* Add Address Form */}
            {showAddAddress && canEdit && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex flex-col gap-2">
                  <AddressAutocomplete
                    onSelect={(address) => setNewAddress({
                      address_line1: address.line1,
                      address_line2: address.line2,
                      city: address.city,
                      state: address.state,
                      zip_code: address.zip_code,
                      latitude: address.lat,
                      longitude: address.long,
                    })}
                  />
                  <select
                    value={newAddressType}
                    onChange={(e) => setNewAddressType(e.target.value as 'service' | 'billing' | 'mailing' | 'other')}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="service">Service Address</option>
                    <option value="billing">Billing Address</option>
                    <option value="mailing">Mailing Address</option>
                    <option value="other">Other</option>
                  </select>
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm"
                      onClick={handleAddAddress}
                      disabled={isSubmittingContact || !newAddress}
                      className="flex-1"
                    >
                      {isSubmittingContact ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowAddAddress(false);
                        setNewAddress(null);
                      }}
                      disabled={isSubmittingContact}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {lead.addresses.length === 0 && !showAddAddress ? (
              <p className="text-gray-500 dark:text-gray-500 text-sm">No addresses</p>
            ) : (
              <div className="space-y-3">
                {/* Address List */}
                {lead.addresses.map((address) => (
                  <div
                    key={address.id}
                    className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {address.is_primary && (
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                            PRIMARY
                          </span>
                        )}
                        <span className="text-xs text-gray-600 dark:text-gray-400 capitalize px-2 py-0.5 bg-gray-200 dark:bg-gray-800 rounded">
                          {address.address_type}
                        </span>
                      </div>
                      <div className="text-sm sm:text-base">
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                          {address.address_line1}
                          {address.address_line2 && <>, {address.address_line2}</>}
                        </p>
                        <p className="text-gray-700 dark:text-gray-300">
                          {address.city}, {address.state} {address.zip_code}
                        </p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 self-start sm:self-auto">
                        {!address.is_primary && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleAddressPrimary(address.id)}
                            title="Set as primary"
                          >
                            <Pin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteAddress(address.id)}>
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Show Map Toggle Button */}
                {lead.addresses.length > 0 && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowMap(!showMap)}
                      className="w-full sm:w-auto"
                    >
                      <MapPin className="w-4 h-4" />
                      {showMap ? 'Hide Map' : 'Show Map'}
                    </Button>
                  </div>
                )}

                {/* Single Map with All Addresses */}
                {showMap && lead.addresses.length > 0 && (
                  <div className="relative w-full h-64 sm:h-80 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                    <AddressesMap addresses={lead.addresses} />
                  </div>
                )}
              </div>
            )}
              </div>
            )}
          </div>

          {/* Service Requests Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 border-b-2 border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowServiceRequests(!showServiceRequests)}
                className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                Service Requests ({lead.service_requests.length})
                {showServiceRequests ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
              {canEdit && showServiceRequests && (
                <Button
                  size="sm"
                  onClick={() => setShowAddServiceRequestModal(true)}
                  className="self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  Add Service Request
                </Button>
              )}
            </div>

            {showServiceRequests && (
              <div className="p-3 sm:p-4">
            {lead.service_requests.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-500 text-sm">No service requests</p>
            ) : (
              <div className="space-y-3">
                {lead.service_requests.map((request) => (
                  <ServiceRequestCardExpanded
                    key={request.id}
                    serviceRequest={request}
                    onUpdate={handleUpdateServiceRequest}
                    onDelete={handleDeleteServiceRequest}
                    canEdit={canEdit}
                    canDelete={canEdit}
                  />
                ))}
              </div>
            )}
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-3 sm:p-4 border-b-2 border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                Notes
                {showNotes ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
            </div>

            {showNotes && (
              <div className="p-3 sm:p-4">
                <NotesList leadId={leadId} canEdit={canEdit} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Activity Timeline */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden lg:sticky lg:top-6">
            <div className="p-3 sm:p-4 border-b-2 border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowTimeline(!showTimeline)}
                className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                Activity Timeline
                {showTimeline ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
            </div>

            {showTimeline && (
              <div className="p-3 sm:p-4">
                <ActivityTimeline leadId={leadId} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Change Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Change Lead Status"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              New Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="lead">Lead</option>
              <option value="prospect">Prospect</option>
              <option value="customer">Customer</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          {selectedStatus === 'lost' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Lost Reason
              </label>
              <textarea
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Why was this lead lost?"
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  placeholder:text-gray-400 dark:placeholder:text-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowStatusModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} disabled={statusLoading}>
              {statusLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false);
          setDeleteAction(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Confirm Delete"
        message={`Are you sure you want to delete this ${deleteAction?.type}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Add Service Request Modal */}
      <AddServiceRequestModal
        isOpen={showAddServiceRequestModal}
        onClose={() => setShowAddServiceRequestModal(false)}
        onSubmit={handleCreateServiceRequest}
        addresses={lead?.addresses || []}
      />

      {/* Delete Lead Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteLeadModal}
        onClose={() => setShowDeleteLeadModal(false)}
        onConfirm={handleConfirmDeleteLead}
        title="Delete Lead"
        message={`Are you sure you want to DELETE this lead?\n\nLead: ${lead?.first_name} ${lead?.last_name}\n\nThis will permanently delete:\n- All contact information\n- All addresses\n- All service requests\n- All notes\n- All activity history\n\nThis action CANNOT be undone!`}
        confirmText="Delete Lead"
        cancelText="Cancel"
        variant="danger"
        loading={isDeletingLead}
      />
    </div>
  );
}
