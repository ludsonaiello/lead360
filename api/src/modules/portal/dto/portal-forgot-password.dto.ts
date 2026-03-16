import { IsString, IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PortalForgotPasswordDto {
  @ApiProperty({
    description: 'Tenant subdomain',
    example: 'acmeplumbing',
  })
  @IsString()
  @IsNotEmpty()
  tenant_slug: string;

  @ApiProperty({
    description: 'Portal account email address',
    example: 'john@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
