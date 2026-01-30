import { PartialType } from '@nestjs/swagger';
import { CreateBundleDto } from './create-bundle.dto';

/**
 * DTO for full bundle replacement (PUT request)
 * Allows updating metadata AND items in one request
 *
 * All fields are optional (inherited from CreateBundleDto via PartialType):
 * - name?: string
 * - description?: string
 * - discount_type?: DiscountType
 * - discount_value?: number
 * - items?: BundleItemDto[]
 */
export class UpdateBundleWithItemsDto extends PartialType(CreateBundleDto) {}
