import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateBundleDto } from './create-bundle.dto';

// Update bundle metadata only (not items)
export class UpdateBundleDto extends PartialType(
  OmitType(CreateBundleDto, ['items'] as const),
) {}
