import React, { useState } from 'react';
import { AlertTriangle, Phone, Clock, Building } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import type { ActiveRoom } from '@/lib/types/voice-ai';

interface ForceEndCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  call: ActiveRoom | null;
  onConfirm: (roomName: string) => Promise<void>;
}

/**
 * Force End Call Modal
 * Confirmation dialog for emergency call termination
 */
export default function ForceEndCallModal({
  isOpen,
  onClose,
  call,
  onConfirm,
}: ForceEndCallModalProps) {
  const [isEnding, setIsEnding] = useState(false);

  const handleConfirm = async () => {
    if (!call || !call.room_name) return;

    try {
      setIsEnding(true);
      await onConfirm(call.room_name);
      onClose();
    } catch (error) {
      // Error handling done in parent
    } finally {
      setIsEnding(false);
    }
  };

  if (!call) return null;

  // Calculate current duration
  const durationSeconds = Math.floor(
    (Date.now() - new Date(call.started_at).getTime()) / 1000
  );
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent
        title="Force End Active Call?"
        icon={<AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />}
      >
        <div className="space-y-4">
          {/* Warning Banner */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-900 dark:text-red-200">
                  Emergency Operation
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  This will immediately disconnect the call and mark it as 'failed'. This action
                  cannot be undone.
                </p>
              </div>
            </div>
          </div>

          {/* Call Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tenant</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {call.company_name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Caller</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {call.from_number}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">To</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {call.to_number}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {minutes}m {seconds}s
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-4 w-4 flex items-center justify-center">
                <span className="text-xs">🔒</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Room Name</p>
                <p className="text-xs font-mono text-gray-700 dark:text-gray-300">
                  {call.room_name || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="outline" onClick={onClose} disabled={isEnding}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleConfirm} disabled={isEnding || !call.room_name}>
          {isEnding ? 'Ending Call...' : 'Force End Call'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
