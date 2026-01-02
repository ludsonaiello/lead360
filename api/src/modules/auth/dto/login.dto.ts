import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'MySecure@Pass123',
  })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    description: 'Extend refresh token to 30 days',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  remember_me?: boolean;
}
