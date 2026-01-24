import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectQuoteDto {
  @ApiProperty({
    description:
      'Required comments explaining why the quote was rejected (minimum 10 characters)',
    example: 'Pricing is too high - need to reduce materials cost',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(10, {
    message: 'comments required for rejection (minimum 10 characters)',
  })
  @MaxLength(1000, { message: 'comments must be at most 1000 characters' })
  comments: string;
}
