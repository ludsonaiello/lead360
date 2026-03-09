import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UsageRecordDto {
  @ApiProperty({ description: 'Provider UUID from voice_ai_provider table' })
  @IsString()
  provider_id: string;

  @ApiProperty({ description: 'Provider type', enum: ['STT', 'LLM', 'TTS'] })
  @IsString()
  @IsIn(['STT', 'LLM', 'TTS'])
  provider_type: string;

  @ApiProperty({
    description: 'Consumption amount (seconds | tokens | characters)',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  usage_quantity: number;

  @ApiProperty({
    description: 'Unit of measurement',
    enum: ['seconds', 'tokens', 'characters'],
  })
  @IsString()
  @IsIn(['seconds', 'tokens', 'characters'])
  usage_unit: string;

  @ApiPropertyOptional({ description: 'Estimated cost in USD', minimum: 0 })
  @IsOptional()
  @IsNumber()
  estimated_cost?: number;
}

export class CompleteCallDto {
  @ApiProperty({
    description: 'Twilio CallSid — must match the :callSid path parameter',
    example: 'CA1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  call_sid: string;

  @ApiProperty({
    description: 'Final call status',
    enum: ['completed', 'failed', 'transferred'],
  })
  @IsString()
  @IsIn(['completed', 'failed', 'transferred'])
  status: string;

  @ApiPropertyOptional({
    description: 'Total call duration in seconds',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration_seconds?: number;

  @ApiPropertyOptional({
    description: 'Call outcome',
    enum: ['lead_created', 'transferred', 'abandoned'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['lead_created', 'transferred', 'abandoned'])
  outcome?: string;

  @ApiPropertyOptional({ description: 'AI-generated transcript summary' })
  @IsOptional()
  @IsString()
  transcript_summary?: string;

  @ApiPropertyOptional({ description: 'Full STT transcript output' })
  @IsOptional()
  @IsString()
  full_transcript?: string;

  @ApiPropertyOptional({
    description: 'List of actions taken during the call',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actions_taken?: string[];

  @ApiPropertyOptional({
    description: 'UUID of the lead matched or created during this call',
  })
  @IsOptional()
  @IsString()
  lead_id?: string;

  @ApiPropertyOptional({
    description: 'Phone number the call was transferred to (E.164 format)',
  })
  @IsOptional()
  @IsString()
  transferred_to?: string;

  @ApiPropertyOptional({ description: 'Error message if call failed' })
  @IsOptional()
  @IsString()
  error_message?: string;

  @ApiPropertyOptional({
    description:
      'True if this call consumed overage minutes beyond the plan limit',
  })
  @IsOptional()
  @IsBoolean()
  is_overage?: boolean;

  @ApiPropertyOptional({
    description: 'Per-provider usage records (1–3 entries: STT, LLM, TTS)',
    type: [UsageRecordDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UsageRecordDto)
  usage_records?: UsageRecordDto[];
}
