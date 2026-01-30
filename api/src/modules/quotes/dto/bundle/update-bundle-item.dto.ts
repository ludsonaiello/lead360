import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';
import { BundleItemDto } from './create-bundle.dto';

export class UpdateBundleItemDto extends PartialType(BundleItemDto) {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716',
    description: 'Library item ID reference'
  })
  @IsUUID()
  @IsOptional()
  library_item_id?: string;
}
