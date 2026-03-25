import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRecurringRuleDto } from './create-recurring-rule.dto';

export class UpdateRecurringRuleDto extends PartialType(
  OmitType(CreateRecurringRuleDto, ['start_date'] as const),
) {}
