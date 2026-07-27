'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import {
  getCrewMemberDeletePreview,
  hardDeleteCrewMember,
} from '@/lib/api/crew';
import type { CrewDeletePreview } from '@/lib/types/crew';

interface HardDeleteCrewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  crewMember: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface ImpactRow {
  label: string;
  value: number;
  variant: 'destroy' | 'unlink';
}

export default function HardDeleteCrewMemberModal({
  isOpen,
  onClose,
  onSuccess,
  crewMember,
}: HardDeleteCrewMemberModalProps) {
  const [preview, setPreview] = useState<CrewDeletePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !crewMember) {
      return;
    }
    setPreview(null);
    setPreviewError(null);
    setTypedName('');
    setSubmitError(null);
    setSubmitting(false);

    let cancelled = false;
    setPreviewLoading(true);
    getCrewMemberDeletePreview(crewMember.id)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const apiError = err as { message?: string };
        setPreviewError(
          apiError.message || 'Could not load delete preview.',
        );
      })
      .finally(() => {
        if (cancelled) return;
        setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, crewMember]);

  if (!crewMember) return null;

  const expectedName = `${crewMember.first_name} ${crewMember.last_name}`.trim();
  const nameMatches =
    typedName.trim().toLowerCase() === expectedName.toLowerCase();

  const impactRows: ImpactRow[] = preview
    ? [
        {
          label: 'Crew payment records',
          value: preview.impact.payment_records,
          variant: 'destroy',
        },
        {
          label: 'Manual hour log entries',
          value: preview.impact.hour_logs,
          variant: 'destroy',
        },
        {
          label: 'Financial entries — crew_member_id cleared',
          value: preview.impact.financial_entries_set_null,
          variant: 'unlink',
        },
        {
          label: 'Financial entries — purchased_by cleared',
          value: preview.impact.financial_entries_purchased_by_set_null,
          variant: 'unlink',
        },
        {
          label: 'Task assignments — unlinked',
          value: preview.impact.task_assignments_set_null,
          variant: 'unlink',
        },
        {
          label: 'Punch-list assignments — unlinked',
          value: preview.impact.punch_list_assignments_set_null,
          variant: 'unlink',
        },
        {
          label: 'Employee profiles — decoupled (timesheet history kept)',
          value: preview.impact.employee_profiles_decoupled,
          variant: 'unlink',
        },
      ]
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!crewMember || !nameMatches || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await hardDeleteCrewMember(crewMember.id, typedName.trim());
      toast.success(`${expectedName} permanently deleted`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };
      if (apiError.status === 400) {
        setSubmitError(
          apiError.message ||
            'The confirmation name did not match. Try again.',
        );
      } else if (apiError.status === 403) {
        setSubmitError(
          apiError.message ||
            'You do not have permission to permanently delete crew members.',
        );
      } else if (apiError.status === 404) {
        setSubmitError(
          apiError.message || 'This crew member no longer exists.',
        );
      } else {
        setSubmitError(
          apiError.message ||
            'An unexpected error occurred. Please try again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => undefined : onClose}
      title="Permanently delete crew member"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                    This action cannot be undone
                  </p>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    <strong>{expectedName}</strong> and the records below will
                    be permanently destroyed. Timesheet history (clock sessions,
                    breaks, disputes, work shifts, project assignments) on any
                    linked employee profile is preserved.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-900/40 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  What will happen
                </p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {previewLoading && (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                    Loading delete preview…
                  </div>
                )}
                {previewError && !previewLoading && (
                  <div className="px-4 py-6 text-sm text-red-600 dark:text-red-400">
                    {previewError}
                  </div>
                )}
                {!previewLoading && !previewError && preview && (
                  <>
                    {impactRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between px-4 py-2.5 text-sm"
                      >
                        <span className="text-gray-700 dark:text-gray-300">
                          {row.label}
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            row.variant === 'destroy'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        Profile photo
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          preview.impact.has_profile_photo
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {preview.impact.has_profile_photo ? 'will be deleted' : 'none'}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/40 px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Red rows are deleted permanently. Other rows have their crew
                  reference cleared but the parent record stays intact.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Type{' '}
                <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                  {expectedName}
                </span>{' '}
                to confirm
              </label>
              <input
                id="confirm-name"
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                disabled={submitting || previewLoading || !!previewError}
                autoComplete="off"
                spellCheck={false}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-60"
                placeholder={expectedName}
                aria-describedby="confirm-name-hint"
              />
              <p
                id="confirm-name-hint"
                className="mt-1 text-xs text-gray-500 dark:text-gray-400"
              >
                Case-insensitive. The delete button stays disabled until the
                name matches.
              </p>
            </div>

            {submitError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                {submitError}
              </div>
            )}
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            loading={submitting}
            disabled={!nameMatches || previewLoading || !!previewError}
          >
            <Trash2 className="w-4 h-4" />
            Permanently delete
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
