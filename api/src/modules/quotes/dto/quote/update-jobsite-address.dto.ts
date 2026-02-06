import { ApiProperty } from '@nestjs/swagger';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JobsiteAddressDto } from './jobsite-address.dto';

export class UpdateJobsiteAddressDto {
  @ApiProperty({
    type: JobsiteAddressDto,
    description:
      'Updated jobsite address (will be re-validated via Google Maps)',
  })
  @ValidateNested()
  @Type(() => JobsiteAddressDto)
  jobsite_address: JobsiteAddressDto;
}
