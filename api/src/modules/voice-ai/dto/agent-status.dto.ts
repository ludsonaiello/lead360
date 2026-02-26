import { ApiProperty } from '@nestjs/swagger';

/**
 * AgentStatusDto
 *
 * Response DTO for GET /api/v1/system/voice-ai/agent/status
 * Returns the health status and metrics of the Voice AI agent worker.
 *
 * Sprint BAS25 — Admin Monitoring
 */
export class AgentStatusDto {
  @ApiProperty({
    description: 'Whether the LiveKit agent worker is running',
    example: true,
  })
  is_running: boolean;

  @ApiProperty({
    description: 'Whether Voice AI agent is enabled in global config',
    example: true,
  })
  agent_enabled: boolean;

  @ApiProperty({
    description: 'Whether the agent is actually connected to LiveKit',
    example: true,
  })
  livekit_connected: boolean;

  @ApiProperty({
    description: 'Number of calls currently in progress',
    example: 3,
  })
  active_calls: number;

  @ApiProperty({
    description: 'Total number of calls initiated today',
    example: 47,
  })
  today_calls: number;

  @ApiProperty({
    description: 'Total number of calls initiated this month',
    example: 342,
  })
  this_month_calls: number;
}
