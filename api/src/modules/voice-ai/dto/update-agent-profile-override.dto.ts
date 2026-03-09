import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAgentProfileOverrideDto } from './create-agent-profile-override.dto';

/**
 * UpdateAgentProfileOverrideDto
 *
 * DTO for updating a tenant override.
 * All fields optional except agent_profile_id cannot be changed after creation.
 */
export class UpdateAgentProfileOverrideDto extends PartialType(
  OmitType(CreateAgentProfileOverrideDto, ['agent_profile_id'] as const),
) {}
