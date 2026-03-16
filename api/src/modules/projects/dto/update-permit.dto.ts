import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PermitStatusEnum } from './create-permit.dto';

export class UpdatePermitDto {
  @ApiPropertyOptional({
    description: 'Permit number assigned by the issuing authority',
    example: 'BP-2026-0001',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  permit_number?: string;

  @ApiPropertyOptional({
    description: 'Type of permit',
    example: 'Building',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  permit_type?: string;

  @ApiPropertyOptional({
    description: 'Permit status',
    example: 'approved',
    enum: PermitStatusEnum,
  })
  @IsEnum(PermitStatusEnum, { message: 'Invalid permit status' })
  @IsOptional()
  status?: PermitStatusEnum;

  @ApiPropertyOptional({
    description: 'Date the permit was submitted (ISO date: YYYY-MM-DD)',
    example: '2026-03-01',
  })
  @IsDateString()
  @IsOptional()
  submitted_date?: string;

  @ApiPropertyOptional({
    description: 'Date the permit was approved (ISO date: YYYY-MM-DD)',
    example: '2026-03-15',
  })
  @IsDateString()
  @IsOptional()
  approved_date?: string;

  @ApiPropertyOptional({
    description: 'Permit expiry date (ISO date: YYYY-MM-DD)',
    example: '2027-03-15',
  })
  @IsDateString()
  @IsOptional()
  expiry_date?: string;

  @ApiPropertyOptional({
    description: 'Authority that issued the permit',
    example: 'City of Boston',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  issuing_authority?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the permit',
    example: 'Requires structural engineer approval before issuance',
  })
  @IsString()
  @IsOptional()
  @MaxLength(65535)
  notes?: string;
}
