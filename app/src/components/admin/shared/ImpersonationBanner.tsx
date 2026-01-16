/**
 * Impersonation Banner
 * Shows when admin is viewing the platform as a tenant
 */

'use client';

import React from 'react';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ImpersonationBanner() {
  const { isImpersonating, impersonatedTenantName, stopImpersonation } = useImpersonation();

  return (
    <AnimatePresence>
      {isImpersonating && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm font-medium">Viewing as Tenant</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-90">You are viewing the platform as:</span>
                  <span className="text-sm font-bold">{impersonatedTenantName}</span>
                </div>
              </div>
              <button
                onClick={stopImpersonation}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                <span className="text-sm font-medium">Exit Impersonation</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
