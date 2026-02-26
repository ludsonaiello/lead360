import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterVoiceAiProvidersDto {
  @ApiPropertyOptional({
    description: 'Filter by provider type',
    enum: ['STT', 'LLM', 'TTS'],
    example: 'STT',
  })
  @IsOptional()
  @IsEnum(['STT', 'LLM', 'TTS'])
  provider_type?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status (defaults to true if not specified)',
    type: Boolean,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  is_active?: boolean;
}
