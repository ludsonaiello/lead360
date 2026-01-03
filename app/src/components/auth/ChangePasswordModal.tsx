/**
 * Change Password Modal Component
 * Modal for changing user password (for logged-in users)
 */

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { getUserFriendlyError } from '@/lib/utils/errors';
import { authApi } from '@/lib/api/auth';
import toast from 'react-hot-toast';

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be less than 72 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{}|;':",./<>?])/,
        'Password must include uppercase, lowercase, and special character'
      ),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const newPassword = watch('new_password');

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      setIsLoading(true);
      await authApi.changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      toast.success('Password changed successfully');
      reset();
      onClose();
    } catch (error: any) {
      const errorMessage = getUserFriendlyError(error, 'change-password');
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Change Password" size="md">
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <div className="space-y-6">
            <Input
              label="Current Password"
              type="password"
              {...register('current_password')}
              error={errors.current_password?.message}
              required
              autoFocus
              disabled={isLoading}
            />

            <div>
              <Input
                label="New Password"
                type="password"
                {...register('new_password')}
                error={errors.new_password?.message}
                required
                disabled={isLoading}
              />
              <PasswordStrengthMeter password={newPassword || ''} />
            </div>

            <Input
              label="Confirm New Password"
              type="password"
              {...register('confirm_password')}
              error={errors.confirm_password?.message}
              required
              disabled={isLoading}
            />
          </div>
        </ModalContent>

        <ModalActions>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {isLoading ? 'Changing...' : 'Change Password'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

export default ChangePasswordModal;
