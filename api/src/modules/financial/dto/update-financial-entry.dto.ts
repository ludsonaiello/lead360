import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFinancialEntryDto } from './create-financial-entry.dto';

// project_id is NOT updatable — entries cannot be moved between projects.
export class UpdateFinancialEntryDto extends PartialType(
  OmitType(CreateFinancialEntryDto, ['project_id'] as const),
) {}
