import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { LeadsService } from '../../leads/services/leads.service';
import {
  CreateLeadDto,
  CreateAddressDto,
  LeadSource,
  PhoneType,
  AddressType,
} from '../../leads/dto/lead.dto';
import { ToolCreateLeadDto } from '../dto/tool-create-lead.dto';
import { ToolCheckAvailabilityDto } from '../dto/tool-check-availability.dto';
import { ToolBookAppointmentDto } from '../dto/tool-book-appointment.dto';
import { ToolTransferCallDto } from '../dto/tool-transfer-call.dto';

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface CreateLeadResult {
  lead_id: string;
  created: boolean;
}

export interface AvailabilitySlot {
  slot_id: string;
  date: string;
  time: string;
  label: string;
}

export interface CheckAvailabilityResult {
  slots: AvailabilitySlot[];
}

export interface BookAppointmentResult {
  appointment_id: string;
  status: string;
  appointment_date: string;
  appointment_time: string;
  error?: string;
}

export interface TransferCallResult {
  success: boolean;
  phone_number: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip all non-digit characters and return the last 10 digits. */
function sanitizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.slice(-10);
}

/** Returns short day/month label, e.g. "Mon Mar 3". */
function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Advance date by N calendar days. */
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Return the next business day (Mon–Fri) after `date`, skipping weekends. */
function nextBusinessDay(from: Date): Date {
  const d = addDays(from, 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Format Date as YYYY-MM-DD string (local date, no timezone shift). */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Reconstruct an ISO datetime string from a preferred_date + slot_id.
 * slot_1 → preferred_date at 09:00
 * slot_2 → next business day from preferred_date at 13:00
 * slot_3 → business day after slot_2 at 16:00
 */
function reconstructAppointmentDateTime(
  preferredDate: string,
  slotId: 'slot_1' | 'slot_2' | 'slot_3',
): { date: string; time: string } {
  const base = new Date(preferredDate + 'T00:00:00');

  if (slotId === 'slot_1') {
    return { date: toDateString(base), time: '09:00' };
  }
  if (slotId === 'slot_2') {
    const d = nextBusinessDay(base);
    return { date: toDateString(d), time: '13:00' };
  }
  // slot_3
  const d2 = nextBusinessDay(base);
  const d3 = nextBusinessDay(d2);
  return { date: toDateString(d3), time: '16:00' };
}

/**
 * Build a human-readable description of the call for the service_request record.
 * Combines notes (reason for call) + raw address text so nothing is lost.
 */
function buildServiceDescription(notes?: string, rawAddress?: string): string {
  const parts: string[] = [];
  if (notes) parts.push(`Service notes: ${notes}`);
  if (rawAddress) parts.push(`Caller address (unverified): ${rawAddress}`);
  return parts.length > 0 ? parts.join(' | ') : 'Inbound phone call inquiry';
}

/**
 * Collect whatever address text the agent captured into a single string.
 * Returns null when no address fields were provided at all.
 */
function buildRawAddressText(dto: ToolCreateLeadDto): string | null {
  const parts = [dto.address_line1, dto.city, dto.state, dto.zip_code].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * VoiceAiToolsService — Sprint B06c
 *
 * Business logic for the four LLM tool endpoints exposed to the Python voice agent:
 *   - createLead       — find or create a CRM lead from phone number
 *   - checkAvailability — return 3 mocked appointment slots (real scheduling TBD)
 *   - bookAppointment  — create a service_request record as an appointment placeholder
 *   - transferCall     — look up the tenant's transfer phone number
 *
 * Lead creation uses LeadsService.create() (the standard flow) to ensure
 * consistency, geocoding, and automatic adoption of future improvements.
 * A tenant_address is used as a placeholder when the caller's address
 * was not collected — staff confirm the real address on follow-up.
 */
@Injectable()
export class VoiceAiToolsService {
  private readonly logger = new Logger(VoiceAiToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
  ) {}

  // -------------------------------------------------------------------------
  // create_lead
  // -------------------------------------------------------------------------

  /**
   * Find or create a lead for the caller's phone number.
   *
   * Uses the standard LeadsService.create() flow so that:
   *   - Address geocoding (Google Maps) is applied consistently
   *   - Future improvements to lead creation benefit voice-agent leads
   *   - Audit log, activity records, and phone uniqueness checks work correctly
   *
   * When the agent did not collect an address, the tenant's default business
   * address is used as a placeholder.  Staff confirm the actual service address
   * on follow-up.  Any raw address text captured by the agent is preserved in
   * the service_request notes.
   *
   * Always returns HTTP 200 with { lead_id, created: bool }.
   * The agent reads `created` to distinguish new vs. existing leads.
   */
  async createLead(tenantId: string, dto: ToolCreateLeadDto): Promise<CreateLeadResult> {
    const sanitized = sanitizePhone(dto.phone_number);

    this.logger.log(
      `create_lead: tenant=${tenantId}, phone_raw=${dto.phone_number}, phone_sanitized=${sanitized}`,
    );

    // -- Existing lead check (fast path, avoids a full LeadsService round-trip) -------
    const existingPhone = await this.prisma.lead_phone.findFirst({
      where: {
        phone: sanitized,
        lead: { tenant_id: tenantId },
      },
      select: { lead_id: true },
    });

    if (existingPhone) {
      this.logger.log(
        `create_lead: found existing lead_id=${existingPhone.lead_id} for phone=${sanitized}`,
      );
      return { lead_id: existingPhone.lead_id, created: false };
    }

    // -- Resolve address -----------------------------------------------------------
    const address = await this.resolveAddress(tenantId, dto);

    if (!address) {
      this.logger.error(
        `create_lead: no address available for tenant=${tenantId} — ` +
          'neither agent-collected nor tenant default address found.',
      );
      throw new NotFoundException(
        'No address available for this tenant. Configure a default business address first.',
      );
    }

    // -- Build service_request with raw address text + call notes ------------------
    const rawAddress = buildRawAddressText(dto);
    const serviceDescription = buildServiceDescription(dto.notes, rawAddress ?? undefined);

    // -- Assemble CreateLeadDto and delegate to the standard leads flow ------------
    const createLeadDto: CreateLeadDto = {
      first_name: dto.first_name || 'Unknown',
      last_name: dto.last_name || 'Caller',
      source: LeadSource.PHONE_CALL,
      phones: [
        {
          phone: sanitized,
          phone_type: PhoneType.MOBILE,
          is_primary: true,
        },
      ],
      emails: dto.email
        ? [{ email: dto.email, is_primary: true }]
        : [],
      addresses: [address],
      service_request: {
        service_name: dto.service_type || 'Phone Call Inquiry',
        service_description: serviceDescription,
        notes: rawAddress ?? undefined,
      },
    };

    // userId = null → system/agent action; leads service handles null gracefully
    const created = await this.leadsService.create(tenantId, null, createLeadDto);

    this.logger.log(
      `create_lead: created lead_id=${created.id} for phone=${sanitized}, tenant=${tenantId}`,
    );

    return { lead_id: created.id, created: true };
  }

  // -------------------------------------------------------------------------
  // check_availability (MOCKED — real scheduling module TBD)
  // -------------------------------------------------------------------------

  /**
   * Return 3 mocked availability slots for the requested service.
   *
   * Slots are relative to preferred_date (or tomorrow if not provided):
   *   slot_1 — base date at 09:00
   *   slot_2 — next business day at 13:00
   *   slot_3 — business day after slot_2 at 16:00
   */
  checkAvailability(dto: ToolCheckAvailabilityDto): CheckAvailabilityResult {
    // Determine base date
    let base: Date;
    if (dto.preferred_date) {
      base = new Date(dto.preferred_date + 'T00:00:00');
    } else {
      base = addDays(new Date(), 1); // tomorrow
    }

    const slot2Date = nextBusinessDay(base);
    const slot3Date = nextBusinessDay(slot2Date);

    const slots: AvailabilitySlot[] = [
      {
        slot_id: 'slot_1',
        date: toDateString(base),
        time: '09:00',
        label: `${formatDateLabel(base)}, 9:00 AM`,
      },
      {
        slot_id: 'slot_2',
        date: toDateString(slot2Date),
        time: '13:00',
        label: `${formatDateLabel(slot2Date)}, 1:00 PM`,
      },
      {
        slot_id: 'slot_3',
        date: toDateString(slot3Date),
        time: '16:00',
        label: `${formatDateLabel(slot3Date)}, 4:00 PM`,
      },
    ];

    this.logger.log(
      `check_availability: service=${dto.service_type || 'any'}, base=${toDateString(base)}, ` +
        `slots=[${slots.map((s) => s.label).join(' | ')}]`,
    );

    return { slots };
  }

  // -------------------------------------------------------------------------
  // book_appointment
  // -------------------------------------------------------------------------

  /**
   * Create a service_request record as an appointment placeholder.
   *
   * Reconstructs the actual appointment date/time from preferred_date + slot_id.
   * Stores slot details in extra_data since service_request has no dedicated
   * scheduled_at field (real appointment module is a future sprint).
   */
  async bookAppointment(tenantId: string, dto: ToolBookAppointmentDto): Promise<BookAppointmentResult> {
    const { date: appointmentDate, time: appointmentTime } = reconstructAppointmentDateTime(
      dto.preferred_date,
      dto.slot_id as 'slot_1' | 'slot_2' | 'slot_3',
    );

    this.logger.log(
      `book_appointment: tenant=${tenantId}, slot=${dto.slot_id}, ` +
        `date=${appointmentDate} ${appointmentTime}, lead=${dto.lead_id || 'none'}`,
    );

    if (!dto.lead_id) {
      this.logger.warn(
        `book_appointment: no lead_id for tenant=${tenantId} — agent must call save_lead first`,
      );
      return {
        appointment_id: '',
        status: 'error',
        error: 'Lead not saved. Call save_lead first to collect caller details before booking.',
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
      };
    }

    // Verify lead belongs to this tenant
    const lead = await this.prisma.lead.findFirst({
      where: { id: dto.lead_id, tenant_id: tenantId },
      select: { id: true },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${dto.lead_id} not found for tenant ${tenantId}`);
    }

    const serviceRequestId = randomUUID();

    const serviceRequest = await this.prisma.service_request.create({
      data: {
        id: serviceRequestId,
        tenant_id: tenantId,
        lead_id: dto.lead_id,
        service_name: dto.service_type || 'Service Appointment',
        description: dto.service_description,
        extra_data: {
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          slot_id: dto.slot_id,
          notes: dto.notes,
          source: 'voice_agent',
          call_log_id: dto.call_log_id,
        },
      },
      select: { id: true },
    });

    // Update call log actions_taken (non-blocking, best-effort)
    this.updateCallLogActions(dto.call_log_id, 'appointment_booked').catch((err) => {
      this.logger.warn(`book_appointment: failed to update call log actions: ${err}`);
    });

    this.logger.log(
      `book_appointment: created service_request=${serviceRequest.id} for ` +
        `${appointmentDate} ${appointmentTime}, tenant=${tenantId}`,
    );

    return {
      appointment_id: serviceRequest.id,
      status: 'pending',
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
    };
  }

  // -------------------------------------------------------------------------
  // transfer_call
  // -------------------------------------------------------------------------

  /**
   * Look up the phone number to transfer the call to.
   *
   * Uses transfer_number_id if provided, otherwise falls back to the tenant's
   * default transfer number (is_default = true).
   */
  async transferCall(tenantId: string, dto: ToolTransferCallDto): Promise<TransferCallResult> {
    this.logger.log(
      `transfer_call: tenant=${tenantId}, transfer_number_id=${dto.transfer_number_id || 'default'}`,
    );

    const where = dto.transfer_number_id
      ? { id: dto.transfer_number_id, tenant_id: tenantId }
      : { tenant_id: tenantId, is_default: true };

    const record = await this.prisma.tenant_voice_transfer_number.findFirst({
      where,
      select: { phone_number: true, label: true },
    });

    if (!record) {
      this.logger.warn(`transfer_call: no transfer number found for tenant=${tenantId}`);
      return { success: false, phone_number: '' };
    }

    // Update call log actions_taken (non-blocking, best-effort)
    this.updateCallLogActions(dto.call_log_id, 'call_transferred').catch((err) => {
      this.logger.warn(`transfer_call: failed to update call log actions: ${err}`);
    });

    this.logger.log(
      `transfer_call: found number=${record.phone_number} (${record.label}), tenant=${tenantId}`,
    );

    return { success: true, phone_number: record.phone_number };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Resolve the address to use for lead creation.
   *
   * Priority:
   *   1. Agent collected address_line1 + zip_code → use directly (Google geocodes)
   *   2. Agent collected only partial address → use tenant default (raw text saved in notes)
   *   3. No address at all → use tenant default
   *
   * Returns null only when no address can be resolved (tenant has no addresses configured).
   */
  private async resolveAddress(
    tenantId: string,
    dto: ToolCreateLeadDto,
  ): Promise<CreateAddressDto | null> {
    // Prefer agent-collected address if it has the minimum required fields
    if (dto.address_line1 && dto.zip_code) {
      const addr: CreateAddressDto = {
        address_line1: dto.address_line1,
        zip_code: dto.zip_code,
        is_primary: true,
        address_type: AddressType.SERVICE,
      };
      if (dto.city) addr.city = dto.city;
      if (dto.state) addr.state = dto.state;
      this.logger.log(`create_lead: using agent-collected address for tenant=${tenantId}`);
      return addr;
    }

    // Fallback: use the tenant's default business address as a placeholder
    const tenantAddr = await this.prisma.tenant_address.findFirst({
      where: { tenant_id: tenantId, is_default: true },
    }) ?? await this.prisma.tenant_address.findFirst({
      where: { tenant_id: tenantId },
    });

    if (!tenantAddr) {
      return null;
    }

    const addr: CreateAddressDto = {
      address_line1: tenantAddr.line1,
      zip_code: tenantAddr.zip_code,
      city: tenantAddr.city,
      state: tenantAddr.state,
      is_primary: true,
      address_type: AddressType.SERVICE,
    };

    // If tenant address already has geocoded coordinates, pass them to skip the API call
    if (tenantAddr.lat && tenantAddr.long) {
      addr.latitude = Number(tenantAddr.lat);
      addr.longitude = Number(tenantAddr.long);
    }

    this.logger.log(
      `create_lead: using tenant default address as placeholder for tenant=${tenantId} ` +
        `(real address to be confirmed on follow-up)`,
    );

    return addr;
  }

  /** Append an action string to voice_call_log.actions_taken (JSON array stored as Text). */
  private async updateCallLogActions(callLogId: string, action: string): Promise<void> {
    const callLog = await this.prisma.voice_call_log.findFirst({
      where: { id: callLogId },
      select: { id: true, actions_taken: true },
    });

    if (!callLog) return;

    let actions: string[] = [];
    if (callLog.actions_taken) {
      try {
        actions = JSON.parse(callLog.actions_taken);
      } catch {
        actions = [callLog.actions_taken];
      }
    }

    if (!actions.includes(action)) {
      actions.push(action);
    }

    await this.prisma.voice_call_log.update({
      where: { id: callLog.id },
      data: { actions_taken: JSON.stringify(actions) },
    });
  }
}
