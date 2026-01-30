/**
 * Dashboard Layout
 * Protected layout for authenticated users with professional sidebar and header
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  console.log('[DASHBOARD LAYOUT] Render:', {
    isAuthenticated,
    isLoading,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    console.log('[DASHBOARD LAYOUT] useEffect triggered:', {
      isLoading,
      isAuthenticated,
      timestamp: new Date().toISOString()
    });

    if (!isLoading && !isAuthenticated) {
      console.log('[DASHBOARD LAYOUT] !!! REDIRECTING TO /login - NOT AUTHENTICATED !!!');
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
