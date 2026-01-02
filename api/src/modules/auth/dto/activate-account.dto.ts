import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateAccountDto {
  @ApiProperty({
    description: 'Account activation token from email',
    example: 'xyz789...',
  })
  @IsString()
  token: string;
}
