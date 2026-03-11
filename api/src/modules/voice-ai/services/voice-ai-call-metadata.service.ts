import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Call metadata stored temporarily for voice agent retrieval
 */
export interface CallMetadata {
  tenant_id: string;
  agent_profile_id?: string | null;
  call_record_id?: string | null;
  parent_call_sid?: string | null;
  timestamp: number;
}

/**
 * VoiceAiCallMetadataService
 *
 * Stores temporary call metadata in Redis for voice agent retrieval.
 * Used to pass agent profile ID from IVR → voice agent without using SIP protocol.
 *
 * Why Redis instead of SIP headers/query params:
 * - Eliminates risk of SIP protocol concatenation issues
 * - Reliable, deterministic storage
 * - Auto-expiring (TTL) for cleanup
 * - No dependency on Twilio/LiveKit SIP quirks
 *
 * Flow:
 * 1. IVR stores metadata: storeCallMetadata(callSid, {tenant_id, agent_profile_id})
 * 2. Voice agent retrieves: getCallMetadata(callSid) → agent_profile_id
 * 3. Auto-expires after 5 minutes
 */
@Injectable()
export class VoiceAiCallMetadataService {
  private readonly logger = new Logger(VoiceAiCallMetadataService.name);
  private redis: Redis;

  constructor() {
    // Use existing Redis connection (same as BullMQ)
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected for call metadata storage');
    });
  }

  /**
   * Store call metadata for voice agent retrieval
   *
   * @param callSid Twilio call SID
   * @param metadata Call metadata (tenant ID, agent profile ID)
   */
  async storeCallMetadata(
    callSid: string,
    metadata: CallMetadata,
  ): Promise<void> {
    const key = `voice-ai:call-metadata:${callSid}`;
    try {
      // Store with 5 minute TTL (calls shouldn't take longer than this)
      await this.redis.setex(key, 300, JSON.stringify(metadata));
      this.logger.log(
        `Stored call metadata for ${callSid} (agent_profile_id: ${metadata.agent_profile_id || 'none'})`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to store call metadata for ${callSid}: ${error.message}`,
      );
      // Don't throw - metadata storage failure shouldn't block the call
    }
  }

  /**
   * Retrieve call metadata for voice agent
   *
   * @param callSid Twilio call SID
   * @returns Call metadata or null if not found/expired
   */
  async getCallMetadata(callSid: string): Promise<CallMetadata | null> {
    const key = `voice-ai:call-metadata:${callSid}`;
    try {
      const data = await this.redis.get(key);
      if (!data) {
        this.logger.warn(`No metadata found for call ${callSid}`);
        return null;
      }
      return JSON.parse(data);
    } catch (error: any) {
      this.logger.error(
        `Failed to retrieve call metadata for ${callSid}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Delete call metadata (cleanup after call completes)
   *
   * @param callSid Twilio call SID
   */
  async deleteCallMetadata(callSid: string): Promise<void> {
    const key = `voice-ai:call-metadata:${callSid}`;
    try {
      await this.redis.del(key);
      this.logger.log(`Deleted call metadata for ${callSid}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to delete call metadata for ${callSid}: ${error.message}`,
      );
      // TTL will handle cleanup if this fails
    }
  }

  /**
   * Store call SID mapping (child → parent)
   *
   * When Twilio dials to LiveKit via <Dial><Sip>, it creates:
   * - Parent CallSid: Original inbound call
   * - Child DialCallSid: Outbound SIP leg to LiveKit
   *
   * Voice agent only knows the Child CallSid, but metadata is stored with Parent CallSid.
   * This mapping allows voice agent to resolve Parent → retrieve metadata.
   *
   * @param childCallSid Twilio DialCallSid (outbound SIP leg)
   * @param parentCallSid Original Twilio CallSid (inbound call)
   */
  async storeCallSidMapping(
    childCallSid: string,
    parentCallSid: string,
  ): Promise<void> {
    const key = `voice-ai:call-sid-map:${childCallSid}`;
    try {
      // Store with 5 minute TTL (same as metadata)
      await this.redis.setex(key, 300, parentCallSid);
      this.logger.log(
        `Stored call SID mapping: ${childCallSid} → ${parentCallSid}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to store call SID mapping for ${childCallSid}: ${error.message}`,
      );
      // Don't throw - mapping failure shouldn't block the call
    }
  }

  /**
   * Get parent call SID from child call SID
   *
   * Resolves child DialCallSid (SIP outbound) → parent CallSid (inbound)
   *
   * @param childCallSid Twilio DialCallSid (SIP outbound leg)
   * @returns Parent CallSid or null if mapping not found
   */
  async getParentCallSid(childCallSid: string): Promise<string | null> {
    const key = `voice-ai:call-sid-map:${childCallSid}`;
    try {
      const parentCallSid = await this.redis.get(key);
      if (!parentCallSid) {
        this.logger.warn(`No parent mapping found for child ${childCallSid}`);
        return null;
      }
      this.logger.log(
        `Retrieved parent call SID for ${childCallSid}: ${parentCallSid}`,
      );
      return parentCallSid;
    } catch (error: any) {
      this.logger.error(
        `Failed to retrieve parent call SID for ${childCallSid}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.redis.quit();
  }
}
