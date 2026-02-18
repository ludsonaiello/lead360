'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

const breadcrumbMap: Record<string, string> = {
  '/admin/voice-ai': 'Voice AI',
  '/admin/voice-ai/providers': 'Providers',
  '/admin/voice-ai/credentials': 'Credentials',
  '/admin/voice-ai/config': 'Configuration',
  '/admin/voice-ai/tenants': 'Tenants & Plans',
  '/admin/voice-ai/logs': 'Call Logs',
  '/admin/voice-ai/usage': 'Usage',
};

export default function VoiceAiAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const buildBreadcrumbs = () => {
    const breadcrumbs = [
      { label: 'Admin', href: '/admin/dashboard' },
      { label: 'Voice AI', href: '/admin/voice-ai' },
    ];

    if (pathname !== '/admin/voice-ai' && pathname !== '/admin/voice-ai/tenants') {
      const currentLabel = breadcrumbMap[pathname] || pathname.split('/').pop() || '';
      breadcrumbs.push({ label: currentLabel, href: pathname });
    } else if (pathname === '/admin/voice-ai/tenants') {
      breadcrumbs.push({ label: 'Tenants & Plans', href: pathname });
    }

    return breadcrumbs;
  };

  const breadcrumbs = buildBreadcrumbs();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center space-x-2 text-sm">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            >
              <Home className="h-4 w-4" />
            </Link>
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center space-x-2">
                <ChevronRight className="h-4 w-4 text-gray-400" />
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
