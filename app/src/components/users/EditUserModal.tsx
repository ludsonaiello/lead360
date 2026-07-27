'use client';

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { editUser } from '@/lib/api/users';
import type { MembershipItem, EditUserDto } from '@/lib/types/users';

// =============================================================================
// Types
// =============================================================================

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MembershipItem | null;
}

interface FormErrors {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

// =============================================================================
// Helpers
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(
  email: string,
  firstName: string,
  lastName: string,
  phone: string,
): FormErrors {
  const errors: FormErrors = {};

  if (!firstName.trim()) {
    errors.firstName = 'First name is required';
  } else if (firstName.trim().length > 100) {
    errors.firstName = 'First name must be 100 characters or less';
  }

  if (!lastName.trim()) {
    errors.lastName = 'Last name is required';
  } else if (lastName.trim().length > 100) {
    errors.lastName = 'Last name must be 100 characters or less';
  }

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

  if (phone.trim().length > 20) {
    errors.phone = 'Phone must be 20 characters or less';
  }

  return errors;
}

function buildPatch(
  member: MembershipItem,
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
): EditUserDto {
  const patch: EditUserDto = {};
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();
  const currentPhone = member.phone ?? '';

  if (trimmedFirst !== member.first_name) patch.first_name = trimmedFirst;
  if (trimmedLast !== member.last_name) patch.last_name = trimmedLast;
  if (trimmedEmail !== member.email.toLowerCase()) patch.email = trimmedEmail;
  if (trimmedPhone !== currentPhone) patch.phone = trimmedPhone;

  return patch;
}

// =============================================================================
// Component
// =============================================================================

export default function EditUserModal({
  isOpen,
  onClose,
  onSuccess,
  member,
}: EditUserModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  // ---------------------------------------------------------------------------
  // Pre-populate when modal opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen && member) {
      setFirstName(member.first_name);
      setLastName(member.last_name);
      setEmail(member.email);
      setPhone(member.phone ?? '');
      setError(null);
      setFieldErrors({});
      setSubmitting(false);
    }
  }, [isOpen, member]);

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!member) return;

    const errors = validateForm(email, firstName, lastName, phone);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const patch = buildPatch(member, firstName, lastName, email, phone);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await editUser(member.id, patch);
      toast.success(`Updated ${firstName.trim()} ${lastName.trim()}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };

      if (apiError.status === 409) {
        setFieldErrors((prev) => ({
          ...prev,
          email: apiError.message || 'Email address is already in use.',
        }));
      } else if (apiError.status === 404) {
        setError(apiError.message || 'Membership not found.');
      } else if (apiError.status === 400) {
        setError(apiError.message || 'Please check the form fields and try again.');
      } else {
        setError(apiError.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function clearServerError() {
    if (error) setError(null);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!member) return null;

  const hasChanges =
    firstName.trim() !== member.first_name ||
    lastName.trim() !== member.last_name ||
    email.trim().toLowerCase() !== member.email.toLowerCase() ||
    phone.trim() !== (member.phone ?? '');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User" size="lg">
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Editing{' '}
              <strong className="text-gray-900 dark:text-gray-100">
                {member.first_name} {member.last_name}
              </strong>{' '}
              <span className="text-gray-500 dark:text-gray-400">({member.role.name})</span>
            </p>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  clearServerError();
                  if (fieldErrors.firstName) {
                    setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                  }
                }}
                placeholder="Jane"
                maxLength={100}
                error={fieldErrors.firstName}
                required
                autoComplete="given-name"
              />
              <Input
                label="Last Name"
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  clearServerError();
                  if (fieldErrors.lastName) {
                    setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                  }
                }}
                placeholder="Doe"
                maxLength={100}
                error={fieldErrors.lastName}
                required
                autoComplete="family-name"
              />
            </div>

            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearServerError();
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="jane.doe@example.com"
              error={fieldErrors.email}
              required
              autoComplete="email"
            />

            <Input
              label="Phone (optional)"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearServerError();
                if (fieldErrors.phone) {
                  setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                }
              }}
              placeholder="+1 (555) 555-5555"
              maxLength={20}
              error={fieldErrors.phone}
              autoComplete="tel"
            />
          </div>
        </ModalContent>

        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={!hasChanges}
          >
            {!submitting && <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
