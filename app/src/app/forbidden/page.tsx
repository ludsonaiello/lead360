// ============================================================================
// 403 Forbidden Page
// ============================================================================
// Page displayed when user tries to access a resource without proper permissions.
// ============================================================================

import React from 'react';
import Forbidden403 from '@/components/rbac/shared/Forbidden403';

export const metadata = {
  title: '403 - Access Denied | Lead360',
  description: 'You do not have permission to access this page.',
};

export default function ForbiddenPage() {
  return <Forbidden403 />;
}
