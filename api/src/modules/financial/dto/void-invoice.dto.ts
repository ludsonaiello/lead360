import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoidInvoiceDto {
  @ApiProperty({
    description: 'Reason for voiding — required',
    example: 'Customer requested cancellation',
  })
  @IsString()
  @MinLength(1, { message: 'Voided reason is required' })
  @MaxLength(500)
  voided_reason: string;
}
