/**
 * PhoneNumberCard Component
 * Displays phone number information with action buttons
 */

'use client';

import React from 'react';
import { MoreVertical, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { PhoneNumber } from '@/lib/types/twilio-admin';
import { format } from 'date-fns';

export interface PhoneNumberCardProps {
  number: PhoneNumber;
  onAllocate: (sid: string) => void;
  onDeallocate: (sid: string) => void;
  onRelease: (sid: string) => void;
}

export function PhoneNumberCard({
  number,
  onAllocate,
  onDeallocate,
  onRelease
}: PhoneNumberCardProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const isAllocated = number.status === 'allocated';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Phone Number */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {number.friendly_name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
            {number.phone_number}
          </p>

          {/* Status and SID */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant={isAllocated ? 'success' : 'neutral'}>
              {number.status}
            </Badge>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              SID: {number.sid.substring(0, 15)}...
            </span>
          </div>

          {/* Allocation Info */}
          {isAllocated && number.allocated_to_tenant && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Allocated To
                </p>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {number.allocated_to_tenant.company_name}
              </p>
              {number.allocated_for && number.allocated_for.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {number.allocated_for.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Capabilities */}
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Capabilities
            </p>
            <div className="flex flex-wrap gap-2">
              {number.capabilities.voice && (
                <Badge variant="neutral">Voice</Badge>
              )}
              {number.capabilities.sms && (
                <Badge variant="neutral">SMS</Badge>
              )}
              {number.capabilities.mms && (
                <Badge variant="neutral">MMS</Badge>
              )}
            </div>
          </div>

          {/* Created Date */}
          <div className="mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Created {format(new Date(number.date_created), 'PPP')}
            </p>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20 border border-gray-200 dark:border-gray-700">
                {!isAllocated && (
                  <button
                    onClick={() => {
                      onAllocate(number.sid);
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-md"
                  >
                    Allocate to Tenant
                  </button>
                )}
                {isAllocated && (
                  <button
                    onClick={() => {
                      onDeallocate(number.sid);
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-md"
                  >
                    Deallocate from Tenant
                  </button>
                )}
                <div className="border-t border-gray-200 dark:border-gray-700"></div>
                <button
                  onClick={() => {
                    if (!isAllocated) {
                      onRelease(number.sid);
                      setIsMenuOpen(false);
                    }
                  }}
                  disabled={isAllocated}
                  className={`block w-full text-left px-4 py-2 text-sm rounded-b-md ${
                    isAllocated
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  }`}
                >
                  Release Number
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
