import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTenantDto } from './create-tenant.dto';

// Protected fields that require admin approval to change
// These fields are omitted from the update DTO
export class UpdateTenantDto extends PartialType(
  OmitType(CreateTenantDto, [
    'subdomain',
    'ein',
    'legal_business_name',
    'business_entity_type',
  ] as const),
) {}
