import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * UpdatePlanVoiceConfigDto
 *
 * Updates the Voice AI fields on a subscription_plan row.
 * All fields are optional — PATCH semantics.
 */
export class UpdatePlanVoiceConfigDto {
  @ApiPropertyOptional({
    description:
      'Enable or disable Voice AI feature for this subscription tier',
  })
  @IsOptional()
  @IsBoolean()
  voice_ai_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Monthly minutes of Voice AI included in the plan (0 = none)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  voice_ai_minutes_included?: number;

  @ApiPropertyOptional({
    description:
      'Cost per minute over the included limit in USD. ' +
      'Set to null to block calls when quota is exceeded. ' +
      'Set to a positive number to allow overage at that rate.',
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  // Only validate as number when the value is not null — null is a valid state meaning "block overage"
  @ValidateIf((o: UpdatePlanVoiceConfigDto) => o.voice_ai_overage_rate !== null)
  @IsNumber()
  @Min(0)
  voice_ai_overage_rate?: number | null;

  @ApiPropertyOptional({
    description: 'Maximum number of voice agent profiles allowed for this plan',
    example: 3,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  voice_ai_max_agent_profiles?: number;
}
