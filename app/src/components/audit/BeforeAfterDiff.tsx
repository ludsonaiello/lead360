// Before/After Diff Component
// Visual comparison of JSON changes

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { isRedacted } from '@/lib/utils/audit-helpers';

interface BeforeAfterDiffProps {
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  className?: string;
}

type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

interface DiffEntry {
  key: string;
  beforeValue: any;
  afterValue: any;
  changeType: ChangeType;
  isNested: boolean;
}

/**
 * Visual JSON diff component with color coding
 *
 * Features:
 * - Side-by-side comparison (desktop)
 * - Stacked layout (mobile)
 * - Color coding: Green (added), Red (removed), Yellow (changed), Gray (unchanged)
 * - Toggle: Show only changed fields
 * - Expand/collapse nested objects
 *
 * @example
 * ```tsx
 * <BeforeAfterDiff
 *   before={{ name: "John", age: 30 }}
 *   after={{ name: "John", age: 31, email: "john@example.com" }}
 * />
 * ```
 */
export function BeforeAfterDiff({
  before,
  after,
  className = ''
}: BeforeAfterDiffProps) {
  const [showOnlyChanged, setShowOnlyChanged] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Handle case where both are null
  if (!before && !after) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No change data available
      </div>
    );
  }

  // Calculate diff entries
  const diffEntries = calculateDiff(before, after);

  // Filter entries if "show only changed" is enabled
  const filteredEntries = showOnlyChanged
    ? diffEntries.filter(entry => entry.changeType !== 'unchanged')
    : diffEntries;

  if (filteredEntries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No changes detected
      </div>
    );
  }

  const toggleExpanded = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className={className}>
      {/* Controls */}
      <div className="mb-4 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyChanged}
            onChange={(e) => setShowOnlyChanged(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          Show only changed fields
        </label>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          {filteredEntries.filter(e => e.changeType !== 'unchanged').length} change(s)
        </div>
      </div>

      {/* Diff Display */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        {/* Desktop: Side-by-side */}
        <div className="hidden md:grid md:grid-cols-2">
          {/* Headers */}
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-700 dark:text-gray-300">
            Before
          </div>
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-700 dark:text-gray-300">
            After
          </div>

          {/* Rows */}
          {filteredEntries.map((entry, index) => (
            <DiffRow
              key={`${entry.key}-${index}`}
              entry={entry}
              isExpanded={expandedKeys.has(entry.key)}
              onToggleExpand={() => toggleExpanded(entry.key)}
            />
          ))}
        </div>

        {/* Mobile: Stacked */}
        <div className="md:hidden">
          {filteredEntries.map((entry, index) => (
            <DiffRowMobile
              key={`${entry.key}-${index}`}
              entry={entry}
              isExpanded={expandedKeys.has(entry.key)}
              onToggleExpand={() => toggleExpanded(entry.key)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-200 dark:bg-green-900/30 rounded"></div>
          <span>Added</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-200 dark:bg-red-900/30 rounded"></div>
          <span>Removed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-200 dark:bg-yellow-900/30 rounded"></div>
          <span>Modified</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <span>Unchanged</span>
        </div>
      </div>
    </div>
  );
}

// Desktop diff row (side-by-side)
function DiffRow({
  entry,
  isExpanded,
  onToggleExpand
}: {
  entry: DiffEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const bgClass = getBackgroundClass(entry.changeType);

  return (
    <>
      {/* Before column */}
      <div className={`px-4 py-2 border-b border-gray-200 dark:border-gray-700 ${bgClass}`}>
        <DiffValue
          label={entry.key}
          value={entry.beforeValue}
          isNested={entry.isNested}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          showToggle={entry.changeType !== 'added'}
        />
      </div>

      {/* After column */}
      <div className={`px-4 py-2 border-b border-l border-gray-200 dark:border-gray-700 ${bgClass}`}>
        <DiffValue
          label={entry.key}
          value={entry.afterValue}
          isNested={entry.isNested}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          showToggle={entry.changeType !== 'removed'}
        />
      </div>
    </>
  );
}

// Mobile diff row (stacked)
function DiffRowMobile({
  entry,
  isExpanded,
  onToggleExpand
}: {
  entry: DiffEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const bgClass = getBackgroundClass(entry.changeType);

  return (
    <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${bgClass}`}>
      <div className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
        {entry.key}
      </div>

      {entry.changeType !== 'added' && (
        <div className="mb-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Before:</div>
          <DiffValue
            value={entry.beforeValue}
            isNested={entry.isNested}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            showToggle
          />
        </div>
      )}

      {entry.changeType !== 'removed' && (
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">After:</div>
          <DiffValue
            value={entry.afterValue}
            isNested={entry.isNested}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            showToggle
          />
        </div>
      )}
    </div>
  );
}

// Display a single value
function DiffValue({
  label,
  value,
  isNested,
  isExpanded,
  onToggleExpand,
  showToggle
}: {
  label?: string;
  value: any;
  isNested: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  showToggle: boolean;
}) {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 italic text-sm">null</span>;
  }

  // Check if redacted
  if (isRedacted(value)) {
    return <span className="text-yellow-600 dark:text-yellow-400 font-mono text-sm">[REDACTED]</span>;
  }

  // Nested object
  if (isNested && typeof value === 'object') {
    return (
      <div>
        {showToggle && (
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {isExpanded ? 'Collapse' : 'Expand'} object
          </button>
        )}

        {isExpanded && (
          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  // Primitive value
  return (
    <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
      {typeof value === 'string' ? `"${value}"` : String(value)}
    </span>
  );
}

// Helper: Calculate diff entries
function calculateDiff(
  before: Record<string, any> | null,
  after: Record<string, any> | null
): DiffEntry[] {
  const entries: DiffEntry[] = [];

  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {})
  ]);

  allKeys.forEach(key => {
    const beforeValue = before?.[key];
    const afterValue = after?.[key];

    let changeType: ChangeType;

    if (beforeValue === undefined && afterValue !== undefined) {
      changeType = 'added';
    } else if (beforeValue !== undefined && afterValue === undefined) {
      changeType = 'removed';
    } else if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changeType = 'modified';
    } else {
      changeType = 'unchanged';
    }

    const isNested =
      typeof beforeValue === 'object' && beforeValue !== null ||
      typeof afterValue === 'object' && afterValue !== null;

    entries.push({
      key,
      beforeValue,
      afterValue,
      changeType,
      isNested
    });
  });

  return entries;
}

// Helper: Get background color class based on change type
function getBackgroundClass(changeType: ChangeType): string {
  switch (changeType) {
    case 'added':
      return 'bg-green-50 dark:bg-green-900/10';
    case 'removed':
      return 'bg-red-50 dark:bg-red-900/10';
    case 'modified':
      return 'bg-yellow-50 dark:bg-yellow-900/10';
    case 'unchanged':
    default:
      return 'bg-white dark:bg-gray-800';
  }
}
