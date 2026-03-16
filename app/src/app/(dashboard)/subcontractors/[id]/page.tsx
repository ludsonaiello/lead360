/**
 * Subcontractor Detail Page
 * Business info, contacts management, documents, payment info with masked fields,
 * compliance display with countdown, tabbed layout
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit2,
  Loader2,
  Mail,
  Globe,
  Shield,
  Building2,
  User,
  Phone,
  Plus,
  Trash2,
  FileText,
  Upload,
  Download,
  Eye,
  CreditCard,
  AlertTriangle,
  Star,
  File,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonPage } from '@/components/ui/Skeleton';
import { SubcontractorForm } from '@/components/subcontractors/SubcontractorForm';
import {
  getSubcontractorById,
  updateSubcontractor,
  deactivateSubcontractor,
  revealSubcontractorField,
  addSubcontractorContact,
  removeSubcontractorContact,
  uploadSubcontractorDocument,
  deleteSubcontractorDocument,
  getDaysUntilExpiry,
} from '@/lib/api/subcontractors';
import { buildFileUrl } from '@/lib/api/files';
import type {
  Subcontractor,
  UpdateSubcontractorDto,
  SubcontractorContact,
  SubcontractorDocument,
  SubcontractorDocumentType,
  RevealableSubcontractorField,
  AddContactDto,
} from '@/lib/types/subcontractor';
import { COMPLIANCE_STATUS_CONFIG, DOCUMENT_TYPE_LABELS } from '@/lib/types/subcontractor';
import { PAYMENT_METHODS } from '@/lib/types/crew';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';

const DETAIL_TABS: TabItem[] = [
  { id: 'profile', label: 'Profile', icon: Building2 },
  { id: 'contacts', label: 'Contacts', icon: User },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'payment', label: 'Payment', icon: CreditCard },
];

interface RevealedField {
  field: RevealableSubcontractorField;
  value: string;
  expiresAt: number;
}

export default function SubcontractorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { canPerform } = useRBAC();
  const subId = params?.id as string;

  const [sub, setSub] = useState<Subcontractor | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  // Edit
  const [showEditForm, setShowEditForm] = useState(false);

  // Contacts
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState<AddContactDto>({ contact_name: '', phone: '' });
  const [addingContact, setAddingContact] = useState(false);
  const [removingContactId, setRemovingContactId] = useState<string | null>(null);

  // Documents
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<SubcontractorDocumentType>('other');
  const [docDescription, setDocDescription] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reveal
  const [revealedFields, setRevealedFields] = useState<Map<RevealableSubcontractorField, RevealedField>>(new Map());
  const [revealConfirmField, setRevealConfirmField] = useState<RevealableSubcontractorField | null>(null);
  const [revealing, setRevealing] = useState(false);

  // Deactivate
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const canEdit = canPerform('projects', 'edit');
  const canDelete = canPerform('projects', 'create'); // Owner/Admin

  const loadSubcontractor = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSubcontractorById(subId);
      setSub(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load subcontractor');
      router.push('/subcontractors');
    } finally {
      setLoading(false);
    }
  }, [subId, router]);

  useEffect(() => {
    loadSubcontractor();
  }, [loadSubcontractor]);

  // Auto-hide revealed fields after 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRevealedFields(prev => {
        const next = new Map(prev);
        let changed = false;
        for (const [key, val] of next) {
          if (val.expiresAt <= now) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEdit = async (dto: UpdateSubcontractorDto) => {
    await updateSubcontractor(subId, dto);
    toast.success('Subcontractor updated');
    setShowEditForm(false);
    loadSubcontractor();
  };

  const handleAddContact = async () => {
    if (!contactForm.contact_name.trim() || !contactForm.phone.trim()) {
      toast.error('Name and phone are required');
      return;
    }
    setAddingContact(true);
    try {
      await addSubcontractorContact(subId, contactForm);
      toast.success('Contact added');
      setShowAddContact(false);
      setContactForm({ contact_name: '', phone: '' });
      loadSubcontractor();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add contact');
    } finally {
      setAddingContact(false);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    setRemovingContactId(contactId);
    try {
      await removeSubcontractorContact(subId, contactId);
      toast.success('Contact removed');
      loadSubcontractor();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove contact');
    } finally {
      setRemovingContactId(null);
    }
  };

  const handleUploadDocument = async () => {
    if (!docFile) {
      toast.error('Please select a file');
      return;
    }
    setUploadingDoc(true);
    try {
      await uploadSubcontractorDocument(subId, docFile, docType, docDescription || undefined);
      toast.success('Document uploaded');
      setShowUploadDoc(false);
      setDocFile(null);
      setDocDescription('');
      loadSubcontractor();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    setDeletingDocId(docId);
    try {
      await deleteSubcontractorDocument(subId, docId);
      toast.success('Document deleted');
      loadSubcontractor();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleRevealConfirm = async () => {
    if (!revealConfirmField) return;
    setRevealing(true);
    try {
      const result = await revealSubcontractorField(subId, revealConfirmField);
      setRevealedFields(prev => {
        const next = new Map(prev);
        next.set(revealConfirmField, {
          field: revealConfirmField,
          value: result.value,
          expiresAt: Date.now() + 10000,
        });
        return next;
      });
      setRevealConfirmField(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reveal field');
    } finally {
      setRevealing(false);
    }
  };

  const handleDeactivate = async () => {
    setIsDeactivating(true);
    try {
      await deactivateSubcontractor(subId);
      toast.success('Subcontractor deactivated');
      router.push('/subcontractors');
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate');
    } finally {
      setIsDeactivating(false);
    }
  };

  const getFieldDisplay = (field: RevealableSubcontractorField, maskedValue: string | null, hasField: boolean): string => {
    if (!hasField) return 'Not provided';
    const revealed = revealedFields.get(field);
    if (revealed) return revealed.value;
    return maskedValue || '****';
  };

  const getDocIcon = (type: SubcontractorDocumentType) => {
    switch (type) {
      case 'insurance':
      case 'coi':
        return Shield;
      case 'license':
        return Award;
      default:
        return File;
    }
  };

  if (loading) return <div className="p-6"><SkeletonPage /></div>;

  if (!sub) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Not Found</h1>
          <Link href="/subcontractors"><Button variant="ghost" className="mt-4">Back to Subcontractors</Button></Link>
        </div>
      </div>
    );
  }

  const complianceConfig = COMPLIANCE_STATUS_CONFIG[sub.compliance_status];
  const daysUntil = getDaysUntilExpiry(sub.insurance_expiry_date);

  return (
    <div className="space-y-6 p-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link href="/subcontractors" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Subcontractors</span>
        </Link>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="ghost" onClick={() => setShowEditForm(true)}>
              <Edit2 className="w-4 h-4" /> Edit
            </Button>
          )}
          {canDelete && sub.is_active && (
            <Button variant="ghost" onClick={() => setShowDeactivateModal(true)} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4" /> Deactivate
            </Button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{sub.business_name}</h1>
              <Badge variant={sub.is_active ? 'success' : 'neutral'}>
                {sub.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant={complianceConfig.variant}>
                <Shield className="w-3.5 h-3.5" />
                {complianceConfig.label}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
              {sub.trade_specialty && <span>{sub.trade_specialty}</span>}
              {sub.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" /> {sub.email}
                </span>
              )}
              {sub.website && (
                <a
                  href={sub.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <Globe className="w-4 h-4" /> Website
                </a>
              )}
            </div>
            {/* Insurance countdown */}
            {daysUntil !== null && (
              <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${
                daysUntil < 0 ? 'text-red-600 dark:text-red-400'
                : daysUntil <= 30 ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-green-600 dark:text-green-400'
              }`}>
                <AlertTriangle className="w-4 h-4" />
                {daysUntil < 0
                  ? `Insurance expired ${Math.abs(daysUntil)} days ago`
                  : daysUntil === 0
                  ? 'Insurance expires today'
                  : `Insurance expires in ${daysUntil} days`
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={DETAIL_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Business Information</h3>
            <dl className="space-y-3">
              <InfoRow label="Business Name" value={sub.business_name} />
              <InfoRow label="Trade Specialty" value={sub.trade_specialty || 'Not specified'} />
              <InfoRow label="Email" value={sub.email || 'Not provided'} />
              <InfoRow label="Website" value={sub.website || 'Not provided'} />
              {sub.notes && <InfoRow label="Notes" value={sub.notes} />}
            </dl>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Insurance & Compliance</h3>
            <dl className="space-y-3">
              <InfoRow label="Insurance Provider" value={sub.insurance_provider || 'Not provided'} />
              <InfoRow label="Policy Number" value={sub.insurance_policy_number || 'Not provided'} />
              <InfoRow label="Expiry Date" value={sub.insurance_expiry_date ? format(parseISO(sub.insurance_expiry_date), 'MMMM d, yyyy') : 'Not provided'} />
              <InfoRow label="COI on File" value={sub.coi_on_file ? 'Yes' : 'No'} />
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Compliance Status</dt>
                <dd className="mt-1">
                  <Badge variant={complianceConfig.variant}>
                    {complianceConfig.label}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Contacts</h3>
            {canEdit && (
              <Button variant="ghost" onClick={() => setShowAddContact(true)}>
                <Plus className="w-4 h-4" /> Add Contact
              </Button>
            )}
          </div>
          {sub.contacts && sub.contacts.length > 0 ? (
            <div className="space-y-3">
              {sub.contacts.map(contact => (
                <div key={contact.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{contact.contact_name}</span>
                        {contact.is_primary && (
                          <Badge variant="info"><Star className="w-3 h-3" /> Primary</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {contact.phone}</span>
                        {contact.role && <span>{contact.role}</span>}
                        {contact.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {contact.email}</span>}
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveContact(contact.id)}
                      disabled={removingContactId === contact.id}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Remove contact"
                    >
                      {removingContactId === contact.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No contacts added yet</p>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Documents</h3>
            {canEdit && (
              <Button variant="ghost" onClick={() => setShowUploadDoc(true)}>
                <Upload className="w-4 h-4" /> Upload Document
              </Button>
            )}
          </div>
          {sub.documents && sub.documents.length > 0 ? (
            <div className="space-y-3">
              {sub.documents.map(doc => {
                const DocIcon = getDocIcon(doc.document_type);
                return (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <DocIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{doc.file_name}</div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Badge variant="neutral">{DOCUMENT_TYPE_LABELS[doc.document_type]}</Badge>
                          {doc.description && <span>{doc.description}</span>}
                          <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={buildFileUrl(doc.file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={deletingDocId === doc.id}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          {deletingDocId === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No documents uploaded yet</p>
          )}
        </div>
      )}

      {/* Payment Tab */}
      {activeTab === 'payment' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Payment Information</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow
              label="Default Method"
              value={PAYMENT_METHODS.find(pm => pm.value === sub.default_payment_method)?.label || 'Not set'}
            />
            {sub.default_payment_method === 'bank_transfer' && (
              <>
                <InfoRow label="Bank Name" value={sub.bank_name || 'Not provided'} />
                <SensitiveFieldRow
                  label="Routing Number"
                  value={getFieldDisplay('bank_routing', sub.bank_routing_masked, sub.has_bank_routing)}
                  hasValue={sub.has_bank_routing}
                  isRevealed={revealedFields.has('bank_routing')}
                  onReveal={() => setRevealConfirmField('bank_routing')}
                  canReveal={canDelete}
                />
                <SensitiveFieldRow
                  label="Account Number"
                  value={getFieldDisplay('bank_account', sub.bank_account_masked, sub.has_bank_account)}
                  hasValue={sub.has_bank_account}
                  isRevealed={revealedFields.has('bank_account')}
                  onReveal={() => setRevealConfirmField('bank_account')}
                  canReveal={canDelete}
                />
              </>
            )}
            {sub.default_payment_method === 'venmo' && (
              <InfoRow label="Venmo Handle" value={sub.venmo_handle || 'Not provided'} />
            )}
            {sub.default_payment_method === 'zelle' && (
              <InfoRow label="Zelle Contact" value={sub.zelle_contact || 'Not provided'} />
            )}
          </dl>
        </div>
      )}

      {/* Edit Modal */}
      {showEditForm && (
        <SubcontractorForm
          isOpen={showEditForm}
          onClose={() => setShowEditForm(false)}
          onSubmit={handleEdit}
          initialData={sub}
          mode="edit"
        />
      )}

      {/* Add Contact Modal */}
      <Modal
        isOpen={showAddContact}
        onClose={() => setShowAddContact(false)}
        title="Add Contact"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Contact Name"
            value={contactForm.contact_name}
            onChange={e => setContactForm(prev => ({ ...prev, contact_name: e.target.value }))}
            required
            placeholder="Mike Johnson"
          />
          <Input
            label="Phone"
            value={contactForm.phone}
            onChange={e => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
            required
            placeholder="555-0101"
          />
          <Input
            label="Role"
            value={contactForm.role || ''}
            onChange={e => setContactForm(prev => ({ ...prev, role: e.target.value }))}
            placeholder="Owner, Manager, Foreman..."
          />
          <Input
            label="Email"
            type="email"
            value={contactForm.email || ''}
            onChange={e => setContactForm(prev => ({ ...prev, email: e.target.value }))}
            placeholder="mike@company.com"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={contactForm.is_primary || false}
              onChange={e => setContactForm(prev => ({ ...prev, is_primary: e.target.checked }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_primary" className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Primary Contact
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setShowAddContact(false)}>Cancel</Button>
            <Button onClick={handleAddContact} disabled={addingContact}>
              {addingContact ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : 'Add Contact'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Document Modal */}
      <Modal
        isOpen={showUploadDoc}
        onClose={() => setShowUploadDoc(false)}
        title="Upload Document"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Document Type <span className="text-red-500">*</span>
            </label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value as SubcontractorDocumentType)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {(Object.entries(DOCUMENT_TYPE_LABELS) as [SubcontractorDocumentType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              File <span className="text-red-500">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={e => setDocFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <Input
            label="Description"
            value={docDescription}
            onChange={e => setDocDescription(e.target.value)}
            placeholder="Certificate of Insurance 2026"
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setShowUploadDoc(false)}>Cancel</Button>
            <Button onClick={handleUploadDocument} disabled={uploadingDoc || !docFile}>
              {uploadingDoc ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reveal Confirmation */}
      <ConfirmModal
        isOpen={!!revealConfirmField}
        onClose={() => setRevealConfirmField(null)}
        onConfirm={handleRevealConfirm}
        title="Reveal Sensitive Data"
        message="This action is logged for audit purposes. The value will be visible for 10 seconds, then automatically re-masked. Continue?"
        confirmText="Reveal"
        cancelText="Cancel"
        variant="danger"
        loading={revealing}
      />

      {/* Deactivate Modal */}
      <ConfirmModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Subcontractor"
        message="Are you sure you want to deactivate this subcontractor? Their records will be preserved."
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="danger"
        loading={isDeactivating}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

function SensitiveFieldRow({
  label, value, hasValue, isRevealed, onReveal, canReveal,
}: {
  label: string; value: string; hasValue: boolean; isRevealed: boolean;
  onReveal: () => void; canReveal: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div>
        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
        <dd className={`mt-1 text-sm font-mono ${isRevealed ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
          {value}
        </dd>
      </div>
      {hasValue && canReveal && !isRevealed && (
        <button onClick={onReveal} className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors" title="Reveal value">
          <Eye className="w-4 h-4" />
        </button>
      )}
      {isRevealed && <span className="text-xs text-green-600 dark:text-green-400 font-medium animate-pulse">Visible</span>}
    </div>
  );
}
