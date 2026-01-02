/**
 * Session Card Component
 * Displays active session information
 */

'use client';

import React, { useState } from 'react';
import { Monitor, Smartphone, MapPin, Calendar, Clock } from 'lucide-react';
import { Session } from '@/lib/types/auth';
import { Button } from '@/components/ui/Button';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';

interface SessionCardProps {
  session: Session;
  onRevoke: (sessionId: string) => Promise<void>;
}

export function SessionCard({ session, onRevoke }: SessionCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const handleRevoke = async () => {
    try {
      setIsRevoking(true);
      await onRevoke(session.id);
      setShowConfirm(false);
    } catch (error) {
      console.error('Failed to revoke session:', error);
    } finally {
      setIsRevoking(false);
    }
  };

  // Parse device info
  const isMobile = session.device_name?.toLowerCase().includes('iphone') ||
    session.device_name?.toLowerCase().includes('android') ||
    session.device_name?.toLowerCase().includes('mobile');

  const DeviceIcon = isMobile ? Smartphone : Monitor;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {/* Device Icon */}
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <DeviceIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>

            {/* Session Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {session.device_name || 'Unknown Device'}
                </h3>
                {session.is_current && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                    Current
                  </span>
                )}
              </div>

              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 font-medium">
                {session.ip_address && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{session.ip_address}</span>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    Signed in {new Date(session.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    Expires {new Date(session.expires_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          {!session.is_current && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirm(true)}
            >
              Logout
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Logout Session"
      >
        <ModalContent>
          <p className="text-gray-900 dark:text-gray-100">
            Are you sure you want to logout from{' '}
            <strong className="font-semibold">{session.device_name || 'this device'}</strong>?
          </p>
        </ModalContent>
        <ModalActions>
          <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={isRevoking}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRevoke} loading={isRevoking}>
            Logout
          </Button>
        </ModalActions>
      </Modal>
    </>
  );
}

export default SessionCard;
