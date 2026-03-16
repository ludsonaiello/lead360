import { IsString, IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PortalLoginDto {
  @ApiProperty({
    description: 'Tenant subdomain (e.g., "acmeplumbing" from acmeplumbing.lead360.app)',
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

  @ApiProperty({
    description: 'Portal account password',
    example: 'MyP@ssw0rd',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
