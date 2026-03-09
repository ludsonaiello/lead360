import { PartialType } from '@nestjs/swagger';
import { CreateGlobalAgentProfileDto } from './create-global-agent-profile.dto';

/**
 * UpdateGlobalAgentProfileDto
 *
 * DTO for updating a global voice agent profile (system admin only).
 * All fields are optional — only fields explicitly sent will be updated.
 */
export class UpdateGlobalAgentProfileDto extends PartialType(
  CreateGlobalAgentProfileDto,
) {}
