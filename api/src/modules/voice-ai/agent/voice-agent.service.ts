import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { AgentServer, ServerOptions, JobRequest, initializeLogger } from '@livekit/agents';
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
import { setAgentServiceRegistry } from './voice-agent-entrypoint';

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

    // Set up global service registry for the entrypoint file
    setAgentServiceRegistry({
      contextBuilder: this.contextBuilder,
      callLogService: this.callLogService,
      usageService: this.usageService,
      buildTools: () => this.buildTools(),
    });

    // Path to the entrypoint file
    const entrypointPath = join(__dirname, 'voice-agent-entrypoint.js');

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
   * This is called by the AgentServer's requestFunc to check if the job should be accepted.
   * Performs quota checking and call log initialization.
   *
   * Flow:
   *   1. Extract tenant_id and call_sid from job metadata
   *   2. Check quota via VoiceUsageService.checkAndReserveMinute()
   *   3. Reject if quota exceeded
   *   4. Start call log via VoiceCallLogService.startCall()
   *   5. Accept the job
   */
  private async vetJobRequest(jobRequest: JobRequest): Promise<void> {
    try {
      this.logger.log(`Vetting job request: ${jobRequest.id}`);

      // Extract tenant_id and call_sid from job metadata
      const { tenantId, callSid } = this.extractCallParams(jobRequest);

      if (!tenantId || !callSid) {
        this.logger.error('Missing tenant_id or call_sid in job request');
        await jobRequest.reject();
        return;
      }

      // Check quota
      const quota = await this.usageService.checkAndReserveMinute(tenantId);

      if (!quota.allowed) {
        this.logger.warn(`Call rejected — quota exceeded for tenant: ${tenantId}`);
        await jobRequest.reject();
        return;
      }

      // Build context to get provider IDs
      const context = await this.contextBuilder.buildContext(tenantId, callSid);

      // Start call log
      const fromNumber = this.extractFromNumber(jobRequest);
      const toNumber = this.extractToNumber(jobRequest);

      await this.callLogService.startCall({
        tenantId,
        callSid,
        fromNumber,
        toNumber,
        roomName: jobRequest.room?.name || '',
        direction: 'inbound',
        sttProviderId: context.providers.stt?.provider_id,
        llmProviderId: context.providers.llm?.provider_id,
        ttsProviderId: context.providers.tts?.provider_id,
      });

      // Accept the job
      await jobRequest.accept(
        'lead360-agent',
        `agent-${callSid}`,
        JSON.stringify({ tenant_id: tenantId, call_sid: callSid }),
      );

      this.logger.log(`Job accepted: ${jobRequest.id}`);

    } catch (error) {
      this.logger.error(`Error vetting job request: ${error.message}`, error.stack);
      await jobRequest.reject();
    }
  }

  /**
   * Extract tenant_id and call_sid from job request.
   *
   * NOTE: The exact location of these parameters depends on how LiveKit SIP
   * is configured and how the call is routed. Common locations:
   *   - job.room.metadata (JSON string)
   *   - job.publisher.metadata (JSON string)
   *   - job.room.name (encoded as part of room name)
   *
   * For now, this is a placeholder implementation.
   */
  private extractCallParams(jobRequest: JobRequest): { tenantId: string; callSid: string } {
    // Try to extract from room metadata
    try {
      if (jobRequest.room?.metadata) {
        const metadata = JSON.parse(jobRequest.room.metadata);
        if (metadata.tenant_id && metadata.call_sid) {
          return { tenantId: metadata.tenant_id, callSid: metadata.call_sid };
        }
      }
    } catch (e) {
      // Metadata not valid JSON
    }

    // Try to extract from publisher metadata
    try {
      if (jobRequest.publisher?.metadata) {
        const metadata = JSON.parse(jobRequest.publisher.metadata);
        if (metadata.tenant_id && metadata.call_sid) {
          return { tenantId: metadata.tenant_id, callSid: metadata.call_sid };
        }
      }
    } catch (e) {
      // Metadata not valid JSON
    }

    // Fallback: extract from room name (e.g., "tenant_123_call_456")
    if (jobRequest.room?.name) {
      const match = jobRequest.room.name.match(/tenant_([^_]+)_call_(.+)/);
      if (match) {
        return { tenantId: match[1], callSid: match[2] };
      }
    }

    return { tenantId: '', callSid: '' };
  }

  /**
   * Extract caller phone number from job request.
   */
  private extractFromNumber(jobRequest: JobRequest): string {
    // Try to extract from publisher metadata
    try {
      if (jobRequest.publisher?.metadata) {
        const metadata = JSON.parse(jobRequest.publisher.metadata);
        if (metadata.from_number) {
          return metadata.from_number;
        }
      }
    } catch (e) {
      // Metadata not valid JSON
    }

    // Fallback to publisher identity
    return jobRequest.publisher?.identity || 'unknown';
  }

  /**
   * Extract called phone number from job request.
   */
  private extractToNumber(jobRequest: JobRequest): string {
    // Try to extract from room metadata
    try {
      if (jobRequest.room?.metadata) {
        const metadata = JSON.parse(jobRequest.room.metadata);
        if (metadata.to_number) {
          return metadata.to_number;
        }
      }
    } catch (e) {
      // Metadata not valid JSON
    }

    // Fallback to room name
    return jobRequest.room?.name || 'unknown';
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
