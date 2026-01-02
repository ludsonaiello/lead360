/**
 * Reset Password Form Component
 * Reset password using token from email
 */

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { authApi } from '@/lib/api/auth';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be less than 72 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{}|;':",./<>?])/,
        'Password must include uppercase, lowercase, and special character'
      ),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const password = watch('password');

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      setIsLoading(true);
      await authApi.resetPassword(token, data.password);
      setSuccessModal(true);
    } catch (error: any) {
      setErrorModal(
        error.response?.data?.message || 'Failed to reset password. The link may be invalid or expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModal(false);
    router.push('/login');
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
          Enter your new password below.
        </p>

        <div>
          <Input
            label="New Password"
            type="password"
            {...register('password')}
            error={errors.password?.message}
            required
            autoFocus
            disabled={isLoading}
          />
          <PasswordStrengthMeter password={password || ''} />
        </div>

        <Input
          label="Confirm Password"
          type="password"
          {...register('confirm_password')}
          error={errors.confirm_password?.message}
          required
          disabled={isLoading}
        />

        <Button type="submit" fullWidth loading={isLoading}>
          {isLoading ? 'Resetting Password...' : 'Reset Password'}
        </Button>
      </form>

      {/* Error Modal */}
      <Modal isOpen={!!errorModal} onClose={() => setErrorModal(null)} title="Reset Failed">
        <ModalContent>
          <p className="text-gray-900 dark:text-gray-100">{errorModal}</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
            You can request a new password reset link if this one has expired.
          </p>
        </ModalContent>
        <ModalActions>
          <Button variant="ghost" onClick={() => router.push('/forgot-password')}>
            Request New Link
          </Button>
          <Button onClick={() => setErrorModal(null)}>Try Again</Button>
        </ModalActions>
      </Modal>

      {/* Success Modal */}
      <Modal isOpen={successModal} onClose={handleSuccessClose} title="Password Reset Successful!">
        <ModalContent>
          <p className="text-gray-900 dark:text-gray-100">
            Your password has been reset successfully. You can now log in with your new password.
          </p>
        </ModalContent>
        <ModalActions>
          <Button onClick={handleSuccessClose}>Go to Login</Button>
        </ModalActions>
      </Modal>
    </>
  );
}

export default ResetPasswordForm;
