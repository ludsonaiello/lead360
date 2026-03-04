'use client';

import { useState } from 'react';
import { LeadAutocomplete } from '@/components/calendar';
import type { Lead } from '@/lib/types/leads';

export default function LeadAutocompleteDemoPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [secondLead, setSecondLead] = useState<Lead | null>(null);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Lead Autocomplete Component Demo
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Sprint 32: Reusable lead autocomplete with debounced search (300ms), keyboard navigation
        </p>
      </div>

      {/* Feature List */}
      <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          ✨ Features Implemented
        </h2>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>✅ Debounced search (300ms) - searches by name, phone, or email</li>
          <li>✅ Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)</li>
          <li>✅ Loading states with spinner</li>
          <li>✅ Error handling and user feedback</li>
          <li>✅ Click outside to close dropdown</li>
          <li>✅ Selected lead display with clear button</li>
          <li>✅ Dark mode support</li>
          <li>✅ Mobile responsive</li>
          <li>✅ Accessibility (ARIA labels, keyboard support)</li>
          <li>✅ Shows lead name, email, phone, and status</li>
        </ul>
      </div>

      {/* Demo Section 1 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Demo 1: Basic Usage
        </h2>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Select a lead
          </label>
          <LeadAutocomplete
            value={selectedLead}
            onChange={setSelectedLead}
            placeholder="Search for a lead by name, phone, or email..."
          />

          {/* Selected Lead Info */}
          {selectedLead && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Selected Lead Data:
              </h3>
              <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                {JSON.stringify(
                  {
                    id: selectedLead.id,
                    name: `${selectedLead.first_name} ${selectedLead.last_name}`,
                    status: selectedLead.status,
                    emails: selectedLead.emails,
                    phones: selectedLead.phones,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Demo Section 2 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Demo 2: With Custom Placeholder
        </h2>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Find customer for appointment
          </label>
          <LeadAutocomplete
            value={secondLead}
            onChange={setSecondLead}
            placeholder="Type customer name, phone, or email to search..."
          />
        </div>
      </div>

      {/* Demo Section 3 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Demo 3: Disabled State
        </h2>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Disabled autocomplete
          </label>
          <LeadAutocomplete
            value={null}
            onChange={() => {}}
            disabled
            placeholder="This field is disabled"
          />
        </div>
      </div>

      {/* Demo Section 4 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Demo 4: With Error State
        </h2>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Lead selection (with validation error)
          </label>
          <LeadAutocomplete
            value={null}
            onChange={() => {}}
            error="Please select a lead to continue"
            placeholder="Search for a lead..."
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          💡 Try These Actions:
        </h3>
        <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <li>1. Type &quot;Test&quot; to search for test leads</li>
          <li>2. Use ⬆️ ⬇️ arrow keys to navigate results</li>
          <li>3. Press Enter to select a highlighted result</li>
          <li>4. Press Escape to close the dropdown or clear selection</li>
          <li>5. Click outside the dropdown to close it</li>
          <li>6. Click the X button to clear your selection</li>
        </ul>
      </div>
    </div>
  );
}
