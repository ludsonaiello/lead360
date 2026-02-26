import React, { useState, useEffect } from 'react';
import { Phone, ArrowDownLeft, ArrowUpRight, Clock, Building, AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import type { ActiveRoom } from '@/lib/types/voice-ai';

interface ActiveCallsListProps {
  calls: ActiveRoom[];
  onForceEnd: (call: ActiveRoom) => void;
}

/**
 * Active Calls List Component
 * Real-time table of in-progress Voice AI calls
 */
export default function ActiveCallsList({ calls, onForceEnd }: ActiveCallsListProps) {
  // Track current time for duration calculations
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update time every second for live duration counter
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (startedAt: string): string => {
    const durationSeconds = Math.floor((currentTime - new Date(startedAt).getTime()) / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  const formatPhoneNumber = (phone: string): string => {
    // Simple formatting: +1 (555) 123-4567
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  if (calls.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <Phone className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">No Active Calls</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          All Voice AI calls are currently idle
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tenant
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Caller
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                To
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Direction
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {calls.map((call) => (
              <tr
                key={call.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                {/* Tenant */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {call.company_name}
                    </span>
                  </div>
                </td>

                {/* Caller */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {formatPhoneNumber(call.from_number)}
                    </span>
                  </div>
                </td>

                {/* To */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {formatPhoneNumber(call.to_number)}
                  </span>
                </td>

                {/* Direction */}
                <td className="px-4 py-4 whitespace-nowrap">
                  {call.direction === 'inbound' ? (
                    <Badge variant="success" className="flex items-center gap-1 w-fit">
                      <ArrowDownLeft className="h-3 w-3" />
                      Inbound
                    </Badge>
                  ) : (
                    <Badge variant="info" className="flex items-center gap-1 w-fit">
                      <ArrowUpRight className="h-3 w-3" />
                      Outbound
                    </Badge>
                  )}
                </td>

                {/* Duration */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-mono font-medium text-blue-600 dark:text-blue-400">
                      {formatDuration(call.started_at)}
                    </span>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onForceEnd(call)}
                    disabled={!call.room_name}
                    title={
                      call.room_name
                        ? 'Force end this call'
                        : 'Cannot end call - no room name'
                    }
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Force End
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
