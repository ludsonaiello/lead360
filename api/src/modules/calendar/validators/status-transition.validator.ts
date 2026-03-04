import { BadRequestException } from '@nestjs/common';
import { AppointmentStatus, CancellationReason } from '../dto';

/**
 * Sprint 06: Status Transition Validator
 *
 * Validates appointment status transitions and enforces state machine rules.
 * This is a helper class used by AppointmentLifecycleService.
 *
 * State Machine Rules:
 * - scheduled → confirmed, completed, cancelled, no_show, rescheduled
 * - confirmed → completed, cancelled, no_show, rescheduled
 * - Terminal states (completed, cancelled, no_show, rescheduled) cannot transition
 */
export class StatusTransitionValidator {
  // Terminal states that prevent further modifications
  static readonly TERMINAL_STATES = [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
  ];

  // Valid transitions from each status
  static readonly ALLOWED_TRANSITIONS: Record<string, AppointmentStatus[]> = {
    [AppointmentStatus.SCHEDULED]: [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.RESCHEDULED,
    ],
    [AppointmentStatus.CONFIRMED]: [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.RESCHEDULED,
    ],
  };

  /**
   * Check if a status is a terminal state
   */
  static isTerminalState(status: string): boolean {
    return this.TERMINAL_STATES.includes(status as AppointmentStatus);
  }

  /**
   * Check if transition from currentStatus to newStatus is allowed
   */
  static isTransitionAllowed(
    currentStatus: string,
    newStatus: AppointmentStatus,
  ): boolean {
    const allowedTransitions = this.ALLOWED_TRANSITIONS[currentStatus];
    return allowedTransitions ? allowedTransitions.includes(newStatus) : false;
  }

  /**
   * Validate transition and throw BadRequestException if invalid
   * @throws {BadRequestException} If transition is not allowed
   */
  static validateTransition(
    currentStatus: string,
    newStatus: AppointmentStatus,
    appointmentId?: string,
  ): void {
    const idInfo = appointmentId ? ` (${appointmentId})` : '';

    // Check if current status is terminal
    if (this.isTerminalState(currentStatus)) {
      throw new BadRequestException(
        `Cannot modify appointment${idInfo}. Status '${currentStatus}' is a terminal state and cannot be changed.`,
      );
    }

    // Check if transition is allowed
    if (!this.isTransitionAllowed(currentStatus, newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'${idInfo}`,
      );
    }
  }

  /**
   * Validate cancellation data
   * @throws {BadRequestException} If validation fails
   */
  static validateCancellation(
    cancellationReason: CancellationReason,
    cancellationNotes?: string,
  ): void {
    // Cancellation notes required if reason is "other"
    if (
      cancellationReason === CancellationReason.OTHER &&
      (!cancellationNotes || cancellationNotes.trim().length === 0)
    ) {
      throw new BadRequestException(
        'cancellation_notes is required when cancellation_reason is "other"',
      );
    }
  }

  /**
   * Validate reschedule date
   * @throws {BadRequestException} If date is in the past
   */
  static validateRescheduleDate(newScheduledDate: string): void {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (newScheduledDate < today) {
      throw new BadRequestException(
        'Cannot reschedule to a past date. New date must be today or in the future.',
      );
    }
  }

  /**
   * Get list of allowed transitions for a given status
   */
  static getAllowedTransitions(
    currentStatus: string,
  ): AppointmentStatus[] | null {
    return this.ALLOWED_TRANSITIONS[currentStatus] || null;
  }

  /**
   * Get human-readable description of allowed transitions
   */
  static getTransitionDescription(currentStatus: string): string {
    if (this.isTerminalState(currentStatus)) {
      return `Status '${currentStatus}' is terminal. No further transitions allowed.`;
    }

    const allowed = this.getAllowedTransitions(currentStatus);
    if (!allowed || allowed.length === 0) {
      return `No transitions allowed from status '${currentStatus}'.`;
    }

    return `From '${currentStatus}', allowed transitions: ${allowed.join(', ')}`;
  }
}
