import { Injectable, Logger } from '@nestjs/common';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface TaggedSegment extends TranscriptSegment {
  speaker: string;
}

/**
 * Service for merging two timestamped transcriptions into a single speaker-labeled transcript
 */
@Injectable()
export class TranscriptMergerService {
  private readonly logger = new Logger(TranscriptMergerService.name);

  /**
   * Merges two timestamped transcriptions into a single speaker-labeled transcript
   *
   * @param segments1 - Channel 1 segments with timestamps
   * @param segments2 - Channel 2 segments with timestamps
   * @param speaker1Label - Label for channel 1 speaker (e.g., "Business", "Maria Silva")
   * @param speaker2Label - Label for channel 2 speaker (e.g., "Lead", "John Doe")
   * @returns Formatted transcript with timestamps and speaker labels
   *
   * @example
   * Output format:
   * [00:00:00] Business: Hello, this is John from Solar Solutions.
   * [00:00:03] Lead: Hi, I'm interested in solar panels.
   * [00:00:08] Business: We can schedule a visit next week.
   */
  mergeTranscriptions(
    segments1: TranscriptSegment[],
    segments2: TranscriptSegment[],
    speaker1Label: string,
    speaker2Label: string,
  ): string {
    this.logger.debug(
      `Merging transcriptions: ${segments1.length} segments (${speaker1Label}) + ${segments2.length} segments (${speaker2Label})`,
    );

    // Handle empty segments
    if (segments1.length === 0 && segments2.length === 0) {
      this.logger.warn('Both segment arrays are empty');
      return '';
    }

    // Tag segments with speaker labels
    const taggedSegments1: TaggedSegment[] = segments1.map((seg) => ({
      ...seg,
      speaker: speaker1Label,
    }));

    const taggedSegments2: TaggedSegment[] = segments2.map((seg) => ({
      ...seg,
      speaker: speaker2Label,
    }));

    // Combine and sort by start time
    const allSegments = [...taggedSegments1, ...taggedSegments2].sort(
      (a, b) => a.start - b.start,
    );

    this.logger.debug(`Total merged segments: ${allSegments.length}`);

    // Format as timestamped transcript
    const lines = allSegments.map((segment) => {
      const timestamp = this.formatTimestamp(segment.start);
      const text = segment.text.trim();

      // Skip empty text segments
      if (!text) {
        return null;
      }

      return `[${timestamp}] ${segment.speaker}: ${text}`;
    });

    // Filter out null entries (empty text segments)
    const validLines = lines.filter((line) => line !== null);

    const mergedTranscript = validLines.join('\n');

    this.logger.debug(
      `Merged transcript created: ${validLines.length} lines, ${mergedTranscript.length} characters`,
    );

    return mergedTranscript;
  }

  /**
   * Formats seconds to HH:MM:SS timestamp
   *
   * @param seconds - Number of seconds (can include decimals)
   * @returns Formatted timestamp string (e.g., "00:05:42")
   */
  private formatTimestamp(seconds: number): string {
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0'),
    ].join(':');
  }
}
