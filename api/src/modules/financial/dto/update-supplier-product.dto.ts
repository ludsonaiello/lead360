import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSupplierProductDto } from './create-supplier-product.dto';

export class UpdateSupplierProductDto extends PartialType(CreateSupplierProductDto) {
  @ApiPropertyOptional({
    description: 'Active status — deactivating hides from product list but preserves historical references',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
