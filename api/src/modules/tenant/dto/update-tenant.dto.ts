import { PartialType } from '@nestjs/swagger';
import { CreateTenantDto } from './create-tenant.dto';

// All fields from CreateTenantDto are allowed in updates
// Protected fields (subdomain, ein, legal_business_name, business_entity_type)
// are validated but marked as optional - business logic will handle protection
export class UpdateTenantDto extends PartialType(CreateTenantDto) {}
