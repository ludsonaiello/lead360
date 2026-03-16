/**
 * Crew Member Detail Page
 * Profile header with photo, masked sensitive fields with reveal,
 * tabbed sections (Profile, Payment, Hours), edit capability
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit2,
  Loader2,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Eye,
  Shield,
  Camera,
  Trash2,
  User,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonPage } from '@/components/ui/Skeleton';
import { CrewMemberForm } from '@/components/crew/CrewMemberForm';
import {
  getCrewMemberById,
  updateCrewMember,
  revealCrewField,
  uploadCrewPhoto,
  deleteCrewPhoto,
  deactivateCrewMember,
  getCrewHoursSummary,
  formatCrewName,
  formatCrewPhone,
  formatHourlyRate,
  getCrewPhotoUrl,
} from '@/lib/api/crew';
import type {
  CrewMember,
  UpdateCrewMemberDto,
  RevealableCrewField,
  CrewHoursSummary,
} from '@/lib/types/crew';
import { PAYMENT_METHODS } from '@/lib/types/crew';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';

const DETAIL_TABS: TabItem[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'payment', label: 'Payment Info', icon: CreditCard },
  { id: 'hours', label: 'Hours', icon: BarChart3 },
];

interface RevealedField {
  field: RevealableCrewField;
  value: string;
  expiresAt: number;
}

export default function CrewMemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { canPerform } = useRBAC();
  const memberId = params?.id as string;

  const [member, setMember] = useState<CrewMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [hoursSummary, setHoursSummary] = useState<CrewHoursSummary | null>(null);
  const [hoursLoading, setHoursLoading] = useState(false);

  // Edit state
  const [showEditForm, setShowEditForm] = useState(false);

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Reveal state
  const [revealedFields, setRevealedFields] = useState<Map<RevealableCrewField, RevealedField>>(new Map());
  const [revealConfirmField, setRevealConfirmField] = useState<RevealableCrewField | null>(null);
  const [revealing, setRevealing] = useState(false);

  // Deactivate
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const canEdit = canPerform('projects', 'edit');
  const canDelete = canPerform('projects', 'create'); // Owner/Admin

  const loadMember = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCrewMemberById(memberId);
      setMember(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load crew member');
      router.push('/crew');
    } finally {
      setLoading(false);
    }
  }, [memberId, router]);

  useEffect(() => {
    loadMember();
  }, [loadMember]);

  // Load hours when tab changes
  useEffect(() => {
    if (activeTab === 'hours' && !hoursSummary && memberId) {
      loadHours();
    }
  }, [activeTab, memberId]);

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

  const loadHours = async () => {
    setHoursLoading(true);
    try {
      const data = await getCrewHoursSummary(memberId);
      setHoursSummary(data);
    } catch (error: any) {
      console.error('Failed to load hours:', error);
    } finally {
      setHoursLoading(false);
    }
  };

  const handleEdit = async (dto: UpdateCrewMemberDto, photoFile?: File | null) => {
    await updateCrewMember(memberId, dto);
    if (photoFile) {
      await uploadCrewPhoto(memberId, photoFile);
    }
    toast.success('Crew member updated');
    setShowEditForm(false);
    loadMember();
  };

  const handleRevealConfirm = async () => {
    if (!revealConfirmField) return;
    setRevealing(true);
    try {
      const result = await revealCrewField(memberId, revealConfirmField);
      setRevealedFields(prev => {
        const next = new Map(prev);
        next.set(revealConfirmField, {
          field: revealConfirmField,
          value: result.value,
          expiresAt: Date.now() + 10000, // 10 seconds
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      await uploadCrewPhoto(memberId, file);
      toast.success('Photo uploaded');
      loadMember();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      await deleteCrewPhoto(memberId);
      toast.success('Photo deleted');
      loadMember();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete photo');
    }
  };

  const handleDeactivate = async () => {
    setIsDeactivating(true);
    try {
      await deactivateCrewMember(memberId);
      toast.success('Crew member deactivated');
      router.push('/crew');
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate');
    } finally {
      setIsDeactivating(false);
    }
  };

  const getFieldDisplay = (field: RevealableCrewField, maskedValue: string | null, hasField: boolean): string => {
    if (!hasField) return 'Not provided';
    const revealed = revealedFields.get(field);
    if (revealed) return revealed.value;
    return maskedValue || '****';
  };

  const getFieldRevealed = (field: RevealableCrewField): boolean => {
    return revealedFields.has(field);
  };

  if (loading) {
    return <div className="p-6"><SkeletonPage /></div>;
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400">Crew member not found.</p>
          <Link href="/crew">
            <Button variant="ghost" className="mt-4">Back to Crew</Button>
          </Link>
        </div>
      </div>
    );
  }

  const photoUrl = getCrewPhotoUrl(member.profile_photo_url);

  return (
    <div className="space-y-6 p-6">
      {/* Back + Actions Header */}
      <div className="flex items-center justify-between">
        <Link href="/crew" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Crew</span>
        </Link>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="ghost" onClick={() => setShowEditForm(true)}>
              <Edit2 className="w-4 h-4" /> Edit
            </Button>
          )}
          {canDelete && member.is_active && (
            <Button variant="ghost" onClick={() => setShowDeactivateModal(true)} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4" /> Deactivate
            </Button>
          )}
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* Photo */}
          <div className="relative group">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={formatCrewName(member)}
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {member.first_name[0]}{member.last_name[0]}
                </span>
              </div>
            )}
            {canEdit && (
              <label className="absolute bottom-0 right-0 p-1.5 bg-blue-600 text-white rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCrewName(member)}
              </h1>
              <Badge variant={member.is_active ? 'success' : 'neutral'}>
                {member.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
              {member.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4" />
                  {formatCrewPhone(member.phone)}
                </span>
              )}
              {member.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  {member.email}
                </span>
              )}
              {member.address_city && member.address_state && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {member.address_city}, {member.address_state}
                </span>
              )}
              {member.default_hourly_rate && (
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  {formatHourlyRate(member.default_hourly_rate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={DETAIL_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Personal Information</h3>
            <dl className="space-y-3">
              <InfoRow label="Full Name" value={formatCrewName(member)} />
              <InfoRow label="Email" value={member.email || 'Not provided'} />
              <InfoRow label="Phone" value={member.phone ? formatCrewPhone(member.phone) : 'Not provided'} />
              <InfoRow label="Date of Birth" value={member.date_of_birth ? format(parseISO(member.date_of_birth), 'MMMM d, yyyy') : 'Not provided'} />
              {member.notes && <InfoRow label="Notes" value={member.notes} />}
            </dl>
          </div>

          {/* Address */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Address</h3>
            <dl className="space-y-3">
              <InfoRow label="Street" value={member.address_line1 || 'Not provided'} />
              {member.address_line2 && <InfoRow label="Line 2" value={member.address_line2} />}
              <InfoRow label="City" value={member.address_city || 'Not provided'} />
              <InfoRow label="State" value={member.address_state || 'Not provided'} />
              <InfoRow label="ZIP" value={member.address_zip || 'Not provided'} />
            </dl>
          </div>

          {/* Sensitive Fields */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sensitive Information</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              These fields are encrypted. Revealing values is audit-logged.
            </p>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SensitiveFieldRow
                label="SSN"
                value={getFieldDisplay('ssn', member.ssn_masked, member.has_ssn)}
                hasValue={member.has_ssn}
                isRevealed={getFieldRevealed('ssn')}
                onReveal={() => setRevealConfirmField('ssn')}
                canReveal={canDelete} // Owner/Admin only
              />
              <SensitiveFieldRow
                label="ITIN"
                value={getFieldDisplay('itin', member.itin_masked, member.has_itin)}
                hasValue={member.has_itin}
                isRevealed={getFieldRevealed('itin')}
                onReveal={() => setRevealConfirmField('itin')}
                canReveal={canDelete}
              />
              <SensitiveFieldRow
                label="Driver's License"
                value={getFieldDisplay('drivers_license_number', member.drivers_license_masked, member.has_drivers_license_number)}
                hasValue={member.has_drivers_license_number}
                isRevealed={getFieldRevealed('drivers_license_number')}
                onReveal={() => setRevealConfirmField('drivers_license_number')}
                canReveal={canDelete}
              />
            </dl>
          </div>

          {/* Employment */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Employment Details</h3>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoRow label="Hourly Rate" value={formatHourlyRate(member.default_hourly_rate)} />
              <InfoRow label="Weekly Hours" value={member.weekly_hours_schedule ? `${member.weekly_hours_schedule} hrs/week` : 'Not set'} />
              <InfoRow label="Overtime" value={member.overtime_enabled ? `Enabled (${member.overtime_rate_multiplier}x)` : 'Disabled'} />
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'payment' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Payment Information</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow
              label="Default Method"
              value={PAYMENT_METHODS.find(pm => pm.value === member.default_payment_method)?.label || 'Not set'}
            />
            {member.default_payment_method === 'bank_transfer' && (
              <>
                <InfoRow label="Bank Name" value={member.bank_name || 'Not provided'} />
                <SensitiveFieldRow
                  label="Routing Number"
                  value={getFieldDisplay('bank_routing', member.bank_routing_masked, member.has_bank_routing)}
                  hasValue={member.has_bank_routing}
                  isRevealed={getFieldRevealed('bank_routing')}
                  onReveal={() => setRevealConfirmField('bank_routing')}
                  canReveal={canDelete}
                />
                <SensitiveFieldRow
                  label="Account Number"
                  value={getFieldDisplay('bank_account', member.bank_account_masked, member.has_bank_account)}
                  hasValue={member.has_bank_account}
                  isRevealed={getFieldRevealed('bank_account')}
                  onReveal={() => setRevealConfirmField('bank_account')}
                  canReveal={canDelete}
                />
              </>
            )}
            {member.default_payment_method === 'venmo' && (
              <InfoRow label="Venmo Handle" value={member.venmo_handle || 'Not provided'} />
            )}
            {member.default_payment_method === 'zelle' && (
              <InfoRow label="Zelle Contact" value={member.zelle_contact || 'Not provided'} />
            )}
          </dl>
        </div>
      )}

      {activeTab === 'hours' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Hours Summary</h3>
          {hoursLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : hoursSummary ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Regular Hours</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{hoursSummary.total_regular_hours.toFixed(1)}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Overtime Hours</p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{hoursSummary.total_overtime_hours.toFixed(1)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Hours</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{hoursSummary.total_hours.toFixed(1)}</p>
                </div>
              </div>

              {/* Per-Project Breakdown */}
              {hoursSummary.logs_by_project.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-3">By Project</h4>
                  <div className="space-y-2">
                    {hoursSummary.logs_by_project.map(proj => (
                      <div
                        key={proj.project_id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">{proj.project_name}</span>
                        <div className="flex gap-4 text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{proj.regular_hours.toFixed(1)} reg</span>
                          <span className="text-gray-600 dark:text-gray-400">{proj.overtime_hours.toFixed(1)} OT</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{proj.total_hours.toFixed(1)} total</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hours logged yet</p>
              )}
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hours data available</p>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {showEditForm && (
        <CrewMemberForm
          isOpen={showEditForm}
          onClose={() => setShowEditForm(false)}
          onSubmit={handleEdit}
          initialData={member}
          mode="edit"
        />
      )}

      {/* Reveal Confirmation Modal */}
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
        title="Deactivate Crew Member"
        message="Are you sure you want to deactivate this crew member? Their records will be preserved but they will no longer appear in active lists."
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="danger"
        loading={isDeactivating}
      />
    </div>
  );
}

// ========== HELPER COMPONENTS ==========

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

function SensitiveFieldRow({
  label,
  value,
  hasValue,
  isRevealed,
  onReveal,
  canReveal,
}: {
  label: string;
  value: string;
  hasValue: boolean;
  isRevealed: boolean;
  onReveal: () => void;
  canReveal: boolean;
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
        <button
          onClick={onReveal}
          className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
          title="Reveal value"
        >
          <Eye className="w-4 h-4" />
        </button>
      )}
      {isRevealed && (
        <span className="text-xs text-green-600 dark:text-green-400 font-medium animate-pulse">
          Visible
        </span>
      )}
    </div>
  );
}
