'use client';

// ============================================================================
// Forbidden403 Component
// ============================================================================
// 403 Forbidden error page component. Shows friendly message when user
// lacks required permissions to access a resource.
// ============================================================================

import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Home, Mail } from 'lucide-react';
import Button from '@/components/ui/Button';

/**
 * Forbidden403 - 403 Forbidden error page
 *
 * Displays when user tries to access a resource they don't have permission for.
 * Provides helpful actions: go home, request access.
 *
 * @example
 * // Used in /forbidden/page.tsx
 * export default function ForbiddenPage() {
 *   return <Forbidden403 />;
 * }
 */
export default function Forbidden403() {
  const router = useRouter();

  /**
   * Navigate back to home/dashboard
   */
  const handleGoHome = () => {
    router.push('/dashboard');
  };

  /**
   * Open email client to request access
   */
  const handleRequestAccess = () => {
    // Get current page URL to include in request
    const currentUrl = window.location.href;
    const subject = encodeURIComponent('Access Request - Lead360');
    const body = encodeURIComponent(
      `I would like to request access to the following page:\n\n${currentUrl}\n\nPlease grant me the necessary permissions.\n\nThank you!`
    );

    // Open email client
    window.location.href = `mailto:support@lead360.app?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-6">
            <ShieldAlert className="w-16 h-16 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-gray-900 mb-4">403</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Access Denied
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-8">
          You don't have permission to access this page. If you believe this is
          an error, please contact your administrator or request access below.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleGoHome}
            variant="primary"
            className="flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Go to Dashboard
          </Button>

          <Button
            onClick={handleRequestAccess}
            variant="secondary"
            className="flex items-center justify-center gap-2"
          >
            <Mail className="w-5 h-5" />
            Request Access
          </Button>
        </div>

        {/* Additional Help */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help?{' '}
            <a
              href="mailto:support@lead360.app"
              className="text-blue-600 hover:underline"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
