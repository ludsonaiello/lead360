import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * AttachmentOrderItem
 *
 * Individual attachment with new order_index
 */
export class AttachmentOrderItem {
  @ApiProperty({
    description: 'Attachment ID',
    example: 'abc123-def456-789',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'New order index',
    example: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  order_index: number;
}

/**
 * ReorderAttachmentsDto
 *
 * Bulk reorder attachments for a quote.
 * All attachment IDs must belong to the same quote.
 *
 * @author Backend Developer
 */
export class ReorderAttachmentsDto {
  @ApiProperty({
    description: 'Array of attachments with new order indices',
    type: [AttachmentOrderItem],
    example: [
      { id: 'abc123', order_index: 0 },
      { id: 'def456', order_index: 1 },
      { id: 'ghi789', order_index: 2 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one attachment must be provided' })
  @ValidateNested({ each: true })
  @Type(() => AttachmentOrderItem)
  attachments: AttachmentOrderItem[];
}
