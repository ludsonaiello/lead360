import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateSubcontractorDto } from './create-subcontractor.dto';

export class UpdateSubcontractorDto extends PartialType(
  CreateSubcontractorDto,
) {
  @ApiPropertyOptional({
    description: 'Whether the subcontractor is active (soft deactivation)',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
