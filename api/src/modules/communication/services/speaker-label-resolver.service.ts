import { Injectable, Logger } from '@nestjs/common';

export interface SpeakerLabels {
  speaker1Label: string;
  speaker2Label: string;
}

export interface CallRecordForLabeling {
  direction: string;
  lead?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  tenant: {
    company_name: string;
  } | null;
}

/**
 * Service for resolving speaker labels based on call direction
 * Implements the dual-channel speaker identification logic
 */
@Injectable()
export class SpeakerLabelResolverService {
  private readonly logger = new Logger(SpeakerLabelResolverService.name);

  /**
   * Determines speaker labels based on call direction and participants
   *
   * Channel mapping:
   * - Outbound calls: Channel 1 = Business/Tenant, Channel 2 = Lead
   * - Inbound calls: Channel 1 = Lead, Channel 2 = Business/Tenant
   *
   * @param callRecord - Call record with direction and participant information
   * @returns Object with speaker1Label and speaker2Label
   */
  resolveSpeakerLabels(callRecord: CallRecordForLabeling): SpeakerLabels {
    this.logger.debug(
      `Resolving speaker labels for ${callRecord.direction} call`,
    );

    // Get business name from tenant (fallback to "Business" if not set)
    const businessName = callRecord.tenant?.company_name || 'Business';

    // Get lead name (fallback to "Lead" if not found or incomplete)
    let leadName = 'Lead';
    if (callRecord.lead) {
      const firstName = callRecord.lead.first_name?.trim() || '';
      const lastName = callRecord.lead.last_name?.trim() || '';
      const fullName = `${firstName} ${lastName}`.trim();

      if (fullName) {
        leadName = fullName;
      }
    }

    // Determine labels based on call direction
    if (callRecord.direction === 'outbound-api') {
      // Outbound call: Channel 1 = Business, Channel 2 = Lead
      this.logger.debug(
        `Outbound call - Channel 1: ${businessName}, Channel 2: ${leadName}`,
      );

      return {
        speaker1Label: businessName,
        speaker2Label: leadName,
      };
    } else {
      // Inbound call (or unknown direction): Channel 1 = Lead, Channel 2 = Business
      this.logger.debug(
        `Inbound call - Channel 1: ${leadName}, Channel 2: ${businessName}`,
      );

      return {
        speaker1Label: leadName,
        speaker2Label: businessName,
      };
    }
  }
}
