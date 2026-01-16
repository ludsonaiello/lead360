/**
 * Impersonation Context
 * Allows platform admins to view the platform as a specific tenant
 */

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface ImpersonationContextType {
  impersonatedTenantId: string | null;
  impersonatedTenantName: string | null;
  isImpersonating: boolean;
  startImpersonation: (tenantId: string, tenantName: string) => void;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

interface ImpersonationProviderProps {
  children: ReactNode;
}

export function ImpersonationProvider({ children }: ImpersonationProviderProps) {
  const [impersonatedTenantId, setImpersonatedTenantId] = useState<string | null>(null);
  const [impersonatedTenantName, setImpersonatedTenantName] = useState<string | null>(null);
  const router = useRouter();

  const startImpersonation = useCallback((tenantId: string, tenantName: string) => {
    console.log('[IMPERSONATION] Starting impersonation', {
      tenantId,
      tenantName,
      timestamp: new Date().toISOString(),
    });

    setImpersonatedTenantId(tenantId);
    setImpersonatedTenantName(tenantName);
    // Store in sessionStorage for persistence across page refreshes
    sessionStorage.setItem('impersonatedTenantId', tenantId);
    sessionStorage.setItem('impersonatedTenantName', tenantName);

    console.log('[IMPERSONATION] SessionStorage updated', {
      storedTenantId: sessionStorage.getItem('impersonatedTenantId'),
      storedTenantName: sessionStorage.getItem('impersonatedTenantName'),
    });

    // Redirect to tenant dashboard
    router.push('/dashboard');
  }, [router]);

  const stopImpersonation = useCallback(() => {
    console.log('[IMPERSONATION] Stopping impersonation', {
      previousTenantId: impersonatedTenantId,
      previousTenantName: impersonatedTenantName,
      timestamp: new Date().toISOString(),
    });

    setImpersonatedTenantId(null);
    setImpersonatedTenantName(null);
    sessionStorage.removeItem('impersonatedTenantId');
    sessionStorage.removeItem('impersonatedTenantName');

    console.log('[IMPERSONATION] SessionStorage cleared', {
      storedTenantId: sessionStorage.getItem('impersonatedTenantId'),
      storedTenantName: sessionStorage.getItem('impersonatedTenantName'),
    });

    // Redirect back to admin
    router.push('/admin/tenants');
  }, [router, impersonatedTenantId, impersonatedTenantName]);

  // Restore impersonation state from sessionStorage on mount
  React.useEffect(() => {
    const storedTenantId = sessionStorage.getItem('impersonatedTenantId');
    const storedTenantName = sessionStorage.getItem('impersonatedTenantName');

    console.log('[IMPERSONATION] Restoring state from sessionStorage', {
      storedTenantId,
      storedTenantName,
      timestamp: new Date().toISOString(),
    });

    if (storedTenantId && storedTenantName) {
      setImpersonatedTenantId(storedTenantId);
      setImpersonatedTenantName(storedTenantName);
      console.log('[IMPERSONATION] State restored successfully');
    } else {
      console.log('[IMPERSONATION] No stored state found');
    }
  }, []);

  const isImpersonating = impersonatedTenantId !== null;

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedTenantId,
        impersonatedTenantName,
        isImpersonating,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within ImpersonationProvider');
  }
  return context;
}
