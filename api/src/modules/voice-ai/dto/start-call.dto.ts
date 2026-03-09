import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartCallDto {
  @ApiProperty({ description: 'Tenant UUID', example: 'uuid-of-tenant' })
  @IsString()
  @IsNotEmpty()
  tenant_id: string;

  @ApiProperty({ description: 'Twilio CallSid', example: 'CA1234567890abcdef' })
  @IsString()
  @IsNotEmpty()
  call_sid: string;

  @ApiPropertyOptional({
    description: 'LiveKit room name',
    example: 'room-uuid-1234',
  })
  @IsOptional()
  @IsString()
  room_name?: string;

  @ApiProperty({
    description: "Caller's E.164 phone number",
    example: '+15551234567',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'from_number must be E.164 format' })
  from_number: string;

  @ApiProperty({
    description: "Tenant's Twilio number in E.164 or SIP format",
    example: '+15559999999',
  })
  @IsString()
  @IsNotEmpty()
  to_number: string;

  @ApiPropertyOptional({
    description: 'Call direction',
    enum: ['inbound', 'outbound'],
    default: 'inbound',
  })
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiPropertyOptional({
    description: 'Language used for the call (ISO 639-1)',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language_used?: string;

  @ApiPropertyOptional({
    description: 'Intent selected from IVR menu',
    example: 'sales',
  })
  @IsOptional()
  @IsString()
  intent?: string;

  @ApiPropertyOptional({
    description: 'STT provider UUID used for this call (from context)',
  })
  @IsOptional()
  @IsString()
  stt_provider_id?: string;

  @ApiPropertyOptional({
    description: 'LLM provider UUID used for this call (from context)',
  })
  @IsOptional()
  @IsString()
  llm_provider_id?: string;

  @ApiPropertyOptional({
    description: 'TTS provider UUID used for this call (from context)',
  })
  @IsOptional()
  @IsString()
  tts_provider_id?: string;
}
