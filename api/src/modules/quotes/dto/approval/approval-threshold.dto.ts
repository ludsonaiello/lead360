import {
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ThresholdLevelDto {
  @ApiProperty({
    description: 'Approval level (1, 2, 3...)',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1, { message: 'level must be >= 1' })
  level: number;

  @ApiProperty({
    description: 'Quote total amount threshold',
    example: 10000.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'amount must be >= 0' })
  amount: number;

  @ApiProperty({
    description: 'User role that can approve at this level',
    example: 'Manager',
    enum: ['Manager', 'Admin', 'Owner'],
  })
  @IsString()
  approver_role: string;
}

export class UpdateApprovalThresholdsDto {
  @ApiProperty({
    description:
      'Array of approval thresholds (1-5 levels, amounts must be ascending)',
    type: [ThresholdLevelDto],
    example: [
      { level: 1, amount: 10000.0, approver_role: 'Manager' },
      { level: 2, amount: 50000.0, approver_role: 'Owner' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'thresholds must have at least 1 level' })
  @ArrayMaxSize(5, { message: 'thresholds can have maximum 5 levels' })
  @ValidateNested({ each: true })
  @Type(() => ThresholdLevelDto)
  thresholds: ThresholdLevelDto[];
}
