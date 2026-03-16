'use client';

import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { inviteUser, listRoles } from '@/lib/api/users';
import type { RoleInfo } from '@/lib/types/users';

// =============================================================================
// Types
// =============================================================================

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormErrors {
  email?: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
}

// =============================================================================
// Helpers
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(email: string, firstName: string, lastName: string, roleId: string): FormErrors {
  const errors: FormErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

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

  if (!roleId) {
    errors.roleId = 'Please select a role';
  }

  return errors;
}

// =============================================================================
// Component
// =============================================================================

export default function InviteUserModal({ isOpen, onClose, onSuccess }: InviteUserModalProps) {
  // Form fields
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleId, setRoleId] = useState('');

  // Roles data
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  // ---------------------------------------------------------------------------
  // Reset form + fetch roles when modal opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      // Reset all form state
      setEmail('');
      setFirstName('');
      setLastName('');
      setRoleId('');
      setError(null);
      setFieldErrors({});
      setSubmitting(false);

      // Fetch roles
      fetchRoles();
    }
  }, [isOpen]);

  async function fetchRoles() {
    try {
      setLoadingRoles(true);
      const data = await listRoles();
      setRoles(data);
    } catch {
      setError('Failed to load roles. Please close and try again.');
    } finally {
      setLoadingRoles(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validation
    const errors = validateForm(email, firstName, lastName, roleId);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await inviteUser({
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role_id: roleId,
      });

      toast.success(`Invitation sent to ${email.trim().toLowerCase()}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };

      if (apiError.status === 409) {
        setError(apiError.message || 'This email already has an active membership in this organization.');
      } else if (apiError.status === 404) {
        setError(apiError.message || 'Role not found. Please select a different role.');
      } else if (apiError.status === 400) {
        setError(apiError.message || 'Please check the form fields and try again.');
      } else {
        setError(apiError.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Clear field errors on input change
  // ---------------------------------------------------------------------------

  function clearServerError() {
    if (error) setError(null);
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    clearServerError();
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: undefined }));
    }
  }

  function handleFirstNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFirstName(e.target.value);
    clearServerError();
    if (fieldErrors.firstName) {
      setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
    }
  }

  function handleLastNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLastName(e.target.value);
    clearServerError();
    if (fieldErrors.lastName) {
      setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
    }
  }

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRoleId(e.target.value);
    clearServerError();
    if (fieldErrors.roleId) {
      setFieldErrors((prev) => ({ ...prev, roleId: undefined }));
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Team Member" size="lg">
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Server error banner */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Email */}
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="jane.doe@example.com"
              error={fieldErrors.email}
              required
              autoFocus
              autoComplete="email"
            />

            {/* First Name / Last Name — side by side on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                type="text"
                value={firstName}
                onChange={handleFirstNameChange}
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
                onChange={handleLastNameChange}
                placeholder="Doe"
                maxLength={100}
                error={fieldErrors.lastName}
                required
                autoComplete="family-name"
              />
            </div>

            {/* Role dropdown */}
            <div>
              <label
                htmlFor="invite-role-select"
                className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
              >
                Role <span className="text-red-500 dark:text-red-400 ml-1">*</span>
              </label>

              {loadingRoles ? (
                <div className="flex items-center gap-2 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Loading roles...</span>
                </div>
              ) : (
                <select
                  id="invite-role-select"
                  className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                  value={roleId}
                  onChange={handleRoleChange}
                  required
                >
                  <option value="">Select a role...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              )}

              {fieldErrors.roleId && (
                <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{fieldErrors.roleId}</p>
              )}
            </div>
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
            variant="primary"
            loading={submitting}
            disabled={loadingRoles || roles.length === 0}
          >
            {!submitting && <Send className="w-4 h-4" />}
            Send Invite
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
