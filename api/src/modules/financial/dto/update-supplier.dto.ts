import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSupplierDto } from './create-supplier.dto';

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  @ApiPropertyOptional({
    description: 'Active status — deactivating hides from supplier picker but preserves historical references',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
