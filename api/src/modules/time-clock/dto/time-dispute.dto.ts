import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Canonical dispute types. Must match the `dispute_type` Prisma enum.
 *
 * - `flag_only` — Employee is raising a concern but does not propose
 *   specific changes. No fields are applied on approval.
 * - `correction_request` — Employee is proposing specific field changes
 *   that will be applied to the clock session on approval.
 */
export enum DisputeTypeEnum {
  FLAG_ONLY = 'flag_only',
  CORRECTION_REQUEST = 'correction_request',
}

/**
 * Canonical dispute statuses. Must match the `dispute_status` Prisma enum.
 */
export enum DisputeStatusEnum {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RESOLVED = 'resolved',
}

/**
 * Payload for `POST /time-clock/sessions/:sessionId/disputes`.
 *
 * Submitted by the employee (or any authenticated user acting on the
 * session). Every proposed field is optional individually, but a
 * `correction_request` dispute must supply at least one proposed value —
 * that rule is enforced in the service layer because class-validator
 * cannot express cross-field conditional requirements cleanly.
 */
export class CreateTimeDisputeDto {
  @ApiProperty({
    description: 'Type of dispute',
    enum: DisputeTypeEnum,
    example: DisputeTypeEnum.CORRECTION_REQUEST,
  })
  @IsEnum(DisputeTypeEnum)
  dispute_type: DisputeTypeEnum;

  @ApiProperty({
    description: 'Human-readable description of the dispute',
    maxLength: 2000,
    example:
      'I forgot to clock in this morning. My actual start time was 7:00 AM.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Dispute description is required' })
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({
    description: 'Proposed corrected clock-in time (ISO 8601 UTC)',
    example: '2026-04-10T07:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  proposed_clock_in_at?: string;

  @ApiPropertyOptional({
    description: 'Proposed corrected clock-out time (ISO 8601 UTC)',
    example: '2026-04-10T15:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  proposed_clock_out_at?: string;

  @ApiPropertyOptional({
    description: 'Proposed corrected project ID',
    example: '6d4f6e3e-1c2b-4c4e-9f2d-2b9c9e9a9b1a',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  proposed_project_id?: string;

  @ApiPropertyOptional({
    description: 'Proposed corrected task ID',
    example: '7e5c7f4f-2d3c-4d4f-8f3e-3c0d0f0b0c2b',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  proposed_task_id?: string;

  @ApiPropertyOptional({
    description: 'Proposed corrected notes',
    maxLength: 2000,
    example: 'Arrived on-site at 7 AM per security footage.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  proposed_notes?: string;
}

/**
 * Query parameters for `GET /time-clock/disputes` and
 * `GET /time-clock/disputes/mine`.
 */
export class ListTimeDisputesDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by dispute status',
    enum: DisputeStatusEnum,
  })
  @IsOptional()
  @IsEnum(DisputeStatusEnum)
  status?: DisputeStatusEnum;

  @ApiPropertyOptional({
    description: 'Filter by employee profile ID (admin list only)',
    example: '11111111-2222-3333-4444-555555555555',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;
}

/**
 * Payload for `PATCH /time-clock/disputes/:id/approve`.
 * Review notes are optional for approvals.
 */
export class ApproveDisputeDto {
  @ApiPropertyOptional({
    description: 'Reviewer notes (optional)',
    maxLength: 2000,
    example: 'Confirmed with security camera footage.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  review_notes?: string;
}

/**
 * Payload for `PATCH /time-clock/disputes/:id/reject`.
 * Review notes are REQUIRED when rejecting a dispute so the employee
 * receives actionable feedback about why their request was denied.
 */
export class RejectDisputeDto {
  @ApiProperty({
    description:
      'Reason for rejection — REQUIRED, must not be empty or whitespace.',
    maxLength: 2000,
    example: 'GPS logs show you were at home during that period.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Review notes are required when rejecting a dispute' })
  @MaxLength(2000)
  review_notes: string;
}
