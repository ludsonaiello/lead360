/**
 * Public Layout
 * Minimal layout for public pages (no authentication required)
 * Bypasses AuthProvider and RBACProvider
 */

'use client';

import { ThemeProvider } from '@/contexts/ThemeContext';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Public pages don't need authentication or RBAC
  // Only provide theme support
  return <ThemeProvider>{children}</ThemeProvider>;
}
