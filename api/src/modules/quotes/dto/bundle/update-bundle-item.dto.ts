import { PartialType } from '@nestjs/swagger';
import { BundleItemDto } from './create-bundle.dto';

export class UpdateBundleItemDto extends PartialType(BundleItemDto) {}
