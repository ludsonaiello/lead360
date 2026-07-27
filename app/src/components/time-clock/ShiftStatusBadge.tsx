/**
 * ShiftStatusBadge — renders a colored badge for a WorkShift status.
 *
 * Color mapping is the established convention for Sprint 7/8:
 *   scheduled   → info (blue)
 *   in_progress → warning (amber)
 *   completed   → success (green)
 *   missed      → danger (red)
 *   cancelled   → neutral (gray)
 */

'use client';

import React from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  OctagonAlert,
  Timer,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import type { WorkShiftStatus } from '@/lib/types/time-clock';

interface ShiftStatusBadgeProps {
  status: WorkShiftStatus;
  className?: string;
}

type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

const STATUS_META: Record<
  WorkShiftStatus,
  { label: string; variant: BadgeVariant; icon: LucideIcon }
> = {
  scheduled: { label: 'Scheduled', variant: 'info', icon: CalendarClock },
  in_progress: { label: 'In Progress', variant: 'warning', icon: Timer },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle2 },
  missed: { label: 'Missed', variant: 'danger', icon: OctagonAlert },
  cancelled: { label: 'Cancelled', variant: 'neutral', icon: CircleSlash },
};

export function ShiftStatusBadge({ status, className }: ShiftStatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.scheduled;
  return (
    <Badge variant={meta.variant} icon={meta.icon} className={className}>
      {meta.label}
    </Badge>
  );
}

export const SHIFT_STATUS_LABELS: Record<WorkShiftStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  missed: 'Missed',
  cancelled: 'Cancelled',
};

export default ShiftStatusBadge;
