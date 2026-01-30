import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateVendorDto } from './create-vendor.dto';

export class UpdateVendorDto extends PartialType(CreateVendorDto) {
  @ApiPropertyOptional({
    description: 'Active status of the vendor',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
