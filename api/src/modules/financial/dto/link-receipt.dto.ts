import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for linking a receipt to a financial entry.
 * Once linked:
 *  - receipt.financial_entry_id is set
 *  - receipt.is_categorized becomes true
 *  - financial_entry.has_receipt becomes true
 * Business rule: one receipt → one financial entry (validated in service).
 */
export class LinkReceiptDto {
  @ApiProperty({
    description: 'Financial entry UUID to link this receipt to',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsNotEmpty()
  @IsUUID()
  financial_entry_id: string;
}
