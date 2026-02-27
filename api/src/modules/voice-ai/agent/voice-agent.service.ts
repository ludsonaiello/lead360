import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { AgentServer, ServerOptions, JobRequest, initializeLogger } from '@livekit/agents';
import { ParticipantKind } from '@livekit/rtc-node';
import { join } from 'path';
import { VoiceAiGlobalConfigService } from '../services/voice-ai-global-config.service';
import { VoiceAiContextBuilderService } from '../services/voice-ai-context-builder.service';
import { VoiceCallLogService } from '../services/voice-call-log.service';
import { VoiceUsageService } from '../services/voice-usage.service';
import { VoiceTransferNumbersService } from '../services/voice-transfer-numbers.service';
import { LeadsService } from '../../leads/services/leads.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AgentTool } from './tools/tool.interface';
import { FindLeadTool } from './tools/find-lead.tool';
import { CreateLeadTool } from './tools/create-lead.tool';
import { CheckServiceAreaTool } from './tools/check-service-area.tool';
import { TransferCallTool } from './tools/transfer-call.tool';
// REMOVED: setAgentServiceRegistry - no longer needed (VAB-04)
// Agent now uses HTTP API instead of service registry
import { createVoiceAILogger, VoiceAILogCategory, VoiceAILogger, VoiceAILogLevel } from '../utils/voice-ai-logger.util';

/**
 * VoiceAgentService
 *
 * Sprint BAS19: Agent Worker Setup
 * Sprint BAS24: Agent Pipeline (STT→LLM→TTS full flow)
 *
 * Manages the LiveKit agent worker lifecycle within NestJS.
 * Starts on module init if agent_enabled = true in global config.
 * Connects to LiveKit and dispatches voice agent sessions.
 *
 * Architecture:
 *   NestJS starts → onModuleInit()
 *     → Reads LiveKit config from DB (getLiveKitConfig())
 *     → If agent_enabled = true: starts LiveKit AgentServer
 *     → Worker listens for job requests (room dispatch events)
 *     → Per call: creates VoiceAgentSession to handle conversation
 *
 * CRITICAL: Never crashes the NestJS API. All errors caught and logged.
 */
@Injectable()
export class VoiceAgentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VoiceAgentService.name);
  private worker: AgentServer | null = null;

  constructor(
    private readonly globalConfigService: VoiceAiGlobalConfigService,
    private readonly contextBuilder: VoiceAiContextBuilderService,
    private readonly callLogService: VoiceCallLogService,
    private readonly usageService: VoiceUsageService,
    private readonly transferNumbersService: VoiceTransferNumbersService,
    private readonly leadsService: LeadsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * OnModuleInit lifecycle hook.
   *
   * Executes after the NestJS module has been initialized.
   * Attempts to start the LiveKit worker if agent_enabled = true.
   *
   * NEVER throws — all errors are caught and logged.
   * API continues running even if voice agent fails to start.
   */
  async onModuleInit(): Promise<void> {
    try {
      const config = await this.globalConfigService.getConfig();

      if (!config.agent_enabled) {
        this.logger.log('Voice AI agent disabled — skipping worker start');
        return;
      }

      const livekitConfig = await this.globalConfigService.getLiveKitConfig();

      if (!livekitConfig.url || !livekitConfig.apiKey || !livekitConfig.apiSecret) {
        this.logger.warn('LiveKit credentials not configured — voice agent not started');
        return;
      }

      await this.startWorker(livekitConfig);
      this.logger.log('Voice AI agent worker started successfully');

    } catch (error) {
      // CRITICAL: Never crash the NestJS API if voice agent fails to start
      this.logger.error(
        `Voice agent failed to start — API continues without voice AI: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * OnModuleDestroy lifecycle hook.
   *
   * Executes when the NestJS application is shutting down.
   * Gracefully stops the LiveKit worker.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.stopWorker();
      this.logger.log('Voice AI agent worker stopped');
    }
  }

  /**
   * Start the LiveKit worker — Sprint BAS24 implementation.
   *
   * Creates an AgentServer that listens for job requests (room dispatch events).
   * Sets up a global service registry so the entrypoint file can access NestJS services.
   *
   * @param config Decrypted LiveKit connection details
   */
  private async startWorker(config: { url: string; apiKey: string; apiSecret: string }): Promise<void> {
    this.logger.log(`Starting LiveKit AgentServer: ${config.url}`);

    // Initialize LiveKit's internal logger (required before AgentServer creation)
    initializeLogger({
      pretty: process.env.NODE_ENV !== 'production', // Pretty-printed logs in development
      level: process.env.LIVEKIT_LOG_LEVEL || 'info', // Configurable log level (debug/info/warn/error)
    });

    // REMOVED (VAB-04): Service registry no longer needed
    // Agent now uses HTTP API calls instead of direct service access
    // The agent runs in a separate child process and cannot access NestJS services
    //
    // setAgentServiceRegistry({
    //   contextBuilder: this.contextBuilder,
    //   callLogService: this.callLogService,
    //   usageService: this.usageService,
    //   buildTools: () => this.buildTools(),
    //   livekitConfig: config,
    //   waitForSipParticipant: (ctx: any) => this.waitForSipParticipantFromContext(ctx),
    //   lookupTenantByPhoneNumber: (phoneNumber: string) => this.lookupTenantByPhoneNumber(phoneNumber),
    // });

    // Path to the ESM wrapper file (bridges CommonJS -> ESM for LiveKit)
    // At runtime, __dirname is: /var/www/lead360.app/api/dist/src/modules/voice-ai/agent/
    // We need to reach: /var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent-entrypoint.mjs
    // Go up 5 levels (agent/ -> voice-ai/ -> modules/ -> src/ -> dist/ -> api/) then into src/
    const entrypointPath = join(__dirname, '../../../../../src/modules/voice-ai/agent/voice-agent-entrypoint.mjs');

    this.logger.log(`Using voice agent entrypoint: ${entrypointPath}`);

    // Create worker options with entrypoint file and quota check
    const options = new ServerOptions({
      agent: entrypointPath,
      wsURL: config.url,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      agentName: 'lead360-voice-ai',
      requestFunc: async (jobRequest: JobRequest) => {
        // Vet the job before accepting (quota check)
        await this.vetJobRequest(jobRequest);
      },
    });

    // Create and start the worker
    this.worker = new AgentServer(options);

    // Run worker in background without blocking NestJS initialization
    // .run() is a long-running process that never resolves
    this.worker.run().catch((error) => {
      this.logger.error(`LiveKit AgentServer error: ${error.message}`, error.stack);
    });

    this.logger.log('LiveKit AgentServer started and listening for jobs');
  }

  /**
   * Stop the LiveKit worker — Sprint BAS24 implementation.
   *
   * Gracefully closes the LiveKit worker connection.
   */
  private async stopWorker(): Promise<void> {
    if (this.worker) {
      this.logger.log('Stopping LiveKit AgentServer...');
      await this.worker.close();
      this.worker = null;
      this.logger.log('LiveKit AgentServer stopped');
    }
  }

  /**
   * Vet a job request before accepting it.
   *
   * NEW APPROACH (Sprint B08 - SIP Integration Fix):
   *
   * We now accept ALL jobs immediately. The tenant lookup happens AFTER connecting
   * to the room in the entrypoint, where we can access SIP participant attributes.
   *
   * @see https://docs.livekit.io/reference/telephony/sip-participant/
   */
  private async vetJobRequest(jobRequest: JobRequest): Promise<void> {
    try {
      this.logger.log(`🔍 Vetting job request: ${jobRequest.id}`);
      this.logger.log(`✅ Accepting all SIP jobs immediately (tenant lookup happens after room connection)`);

      // Accept the job immediately
      // Tenant/quota validation will happen in the entrypoint after we can read SIP participant attributes
      await jobRequest.accept(
        'lead360-agent',
        `agent-${jobRequest.id}`,
        JSON.stringify({ job_id: jobRequest.id }),
      );

      this.logger.log(`✅ Job accepted: ${jobRequest.id}`);

    } catch (error) {
      this.logger.error(`❌ Error accepting job request: ${error.message}`, error.stack);
      await jobRequest.reject();
    }
  }

  /**
   * Wait for SIP participant to connect to the room (from JobContext).
   *
   * Polls the room's remote participants for up to 10 seconds looking for a SIP participant.
   * LiveKit creates a SIP participant when a call comes in via SIP trunk.
   *
   * @param ctx - JobContext from entrypoint
   * @returns SIP participant if found, null otherwise
   */
  async waitForSipParticipantFromContext(ctx: any): Promise<any | null> {
    const timeout = 10000; // 10 seconds
    const startTime = Date.now();
    const pollInterval = 100; // 100ms

    this.logger.log('Waiting for SIP participant to connect...');

    while (Date.now() - startTime < timeout) {
      const participants = ctx.room?.remoteParticipants;

      if (participants) {
        for (const participant of participants.values()) {
          // Check if this is a SIP participant
          if (participant.kind === ParticipantKind.SIP) {
            this.logger.log(`SIP participant found: ${participant.identity}`);
            return participant;
          }
        }
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    this.logger.warn('Timeout waiting for SIP participant');
    return null;
  }

  /**
   * Look up tenant ID by phone number.
   *
   * Searches for the tenant that owns a given Twilio phone number.
   * This is used to determine which tenant a call belongs to based on
   * the trunk phone number (the Twilio number that was called).
   *
   * @param phoneNumber - E.164 formatted phone number (e.g., +19781234567)
   * @returns Tenant ID if found, null otherwise
   */
  async lookupTenantByPhoneNumber(phoneNumber: string): Promise<string | null> {
    this.logger.log(`Looking up tenant for phone number: ${phoneNumber}`);

    // Query tenant_sms_config table to find which tenant owns this phone number
    const config = await this.prisma.tenant_sms_config.findFirst({
      where: {
        from_phone: phoneNumber,
        is_active: true,
      },
      select: {
        tenant_id: true,
        tenant: {
          select: {
            company_name: true,
          },
        },
      },
    });

    if (config) {
      this.logger.log(
        `Found tenant: ${config.tenant_id} (${config.tenant.company_name}) for phone number: ${phoneNumber}`,
      );
      return config.tenant_id;
    }

    this.logger.warn(`No tenant found for phone number: ${phoneNumber}`);
    return null;
  }

  /**
   * Build tool instances for the agent.
   *
   * Creates instances of all 4 tools from Sprint BAS23:
   *   - FindLeadTool
   *   - CreateLeadTool
   *   - CheckServiceAreaTool
   *   - TransferCallTool
   */
  private buildTools(): AgentTool[] {
    return [
      new FindLeadTool(this.prisma),
      new CreateLeadTool(this.leadsService),
      new CheckServiceAreaTool(this.prisma),
      new TransferCallTool(this.transferNumbersService),
    ];
  }

  /**
   * Check if the worker is running.
   *
   * Used by BAS25 monitoring endpoint to report agent status.
   *
   * @returns true if worker is connected and running, false otherwise
   */
  isRunning(): boolean {
    return this.worker !== null;
  }
}
