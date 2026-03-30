import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';
import { CreateRecurringRuleDto } from './create-recurring-rule.dto';

export class UpdateRecurringRuleDto extends PartialType(
  OmitType(CreateRecurringRuleDto, ['start_date'] as const),
) {
  @ApiPropertyOptional({
    description:
      'Override next_due_date directly (YYYY-MM-DD). Use this to correct the schedule after deleting an entry or triggering early.',
    example: '2026-04-01',
  })
  @IsOptional()
  @IsDateString()
  next_due_date?: string;
}
