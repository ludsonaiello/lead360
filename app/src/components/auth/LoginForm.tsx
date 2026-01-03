/**
 * Login Form Component
 * Email/password login with remember me option
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { loginSchema, LoginFormData } from '@/lib/utils/validation';
import { formatErrorForDisplay } from '@/lib/utils/errors';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';

export function LoginForm() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setErrorModal(null);
      await login({ ...data, remember_me: rememberMe });
    } catch (error: any) {
      const errorInfo = formatErrorForDisplay(error, 'login');
      setErrorModal({ title: errorInfo.title, message: errorInfo.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email */}
        <Input
          {...register('email')}
          id="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          error={errors.email?.message}
          leftIcon={<Mail className="h-5 w-5" />}
          required
          autoFocus
          disabled={isLoading}
        />

        {/* Password */}
        <Input
          {...register('password')}
          id="password"
          type={showPassword ? 'text' : 'password'}
          label="Password"
          placeholder="••••••••"
          error={errors.password?.message}
          leftIcon={<Lock className="h-5 w-5" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          }
          required
          disabled={isLoading}
        />

        {/* Remember Me */}
        <div className="flex items-center justify-between">
          <ToggleSwitch
            enabled={rememberMe}
            onChange={setRememberMe}
            label="Remember me"
            disabled={isLoading}
          />

          <Link
            href="/forgot-password"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit Button */}
        <Button type="submit" fullWidth loading={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>

        {/* Register Link */}
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </form>

      {/* Error Modal */}
      <Modal isOpen={!!errorModal} onClose={() => setErrorModal(null)} title={errorModal?.title || 'Error'}>
        <ModalContent>
          <p className="text-gray-700 dark:text-gray-300">{errorModal?.message}</p>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setErrorModal(null)}>Try Again</Button>
        </ModalActions>
      </Modal>
    </>
  );
}

export default LoginForm;
