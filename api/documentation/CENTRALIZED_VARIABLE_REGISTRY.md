# Centralized Template Variable Registry

**Version**: 1.0
**Last Updated**: January 19, 2026
**Location**: `/api/src/shared/`

---

## Overview

The **Centralized Template Variable Registry** is a shared service that provides a single source of truth for ALL template variables across the Lead360 platform.

### Purpose

- **Single Source of Truth**: All modules use the same variable definitions
- **Consistency**: Ensures variable names, types, and examples are consistent
- **Maintainability**: Update variables in one place, available everywhere
- **Extensibility**: Easy to add new variables or categories

---

## Architecture

### File Structure

```
/api/src/shared/
├── shared.module.ts                              # Global module (auto-imported)
├── types/
│   └── template-variable.types.ts                # Type definitions
└── services/
    └── template-variable-registry.service.ts     # Centralized registry service
```

### Modules Using This Service

1. **Communication Module** (`/modules/communication/`)
   - Email templates
   - SMS templates
   - Notification templates

2. **Jobs Module** (`/modules/jobs/`)
   - Scheduled email campaigns
   - Automated email jobs

3. **Future Modules** (any module needing template variables)

---

## Variable Categories

The registry organizes variables into **11 categories**:

| Category | Description | Example Variables |
|----------|-------------|-------------------|
| `user` | User account information | `user_email`, `user_name`, `user_role_name` |
| `tenant` | Company/business information | `company_name`, `company_email`, `company_logo_url` |
| `lead` | Lead-specific data | `lead_name`, `lead_email`, `lead_source`, `lead_status` |
| `customer` | Customer-specific data | `customer_name`, `customer_email`, `customer_address` |
| `quote` | Quote/estimate data | `quote_number`, `quote_total`, `quote_link`, `quote_pdf_url` |
| `invoice` | Invoice data | `invoice_number`, `invoice_total`, `payment_link` |
| `appointment` | Appointment/job scheduling | `appointment_date`, `technician_name`, `job_address` |
| `job` | Job-specific data | (Reserved for future use) |
| `payment` | Payment information | `payment_amount`, `payment_date`, `payment_method` |
| `system` | Platform/system variables | `platform_name`, `current_year`, `activation_link` |
| `custom` | Tenant-specific custom variables | (Future: admin-defined variables) |

**Total Variables**: 90+ variables across all categories

---

## Usage Examples

### In Communication Module

```typescript
import { TemplateVariableRegistryService } from '../../../shared/services/template-variable-registry.service';

@Injectable()
export class EmailTemplatesService {
  constructor(
    private readonly variableRegistry: TemplateVariableRegistryService,
  ) {}

  async getVariableRegistry() {
    // Get all variables organized by category
    return this.variableRegistry.getAllVariables();
  }

  async getCustomerVariables() {
    // Get only customer-related variables
    return this.variableRegistry.getVariablesByCategory(VariableCategory.CUSTOMER);
  }

  async validateTemplate(variables: string[]) {
    // Validate that all variables exist
    const validation = this.variableRegistry.validateVariables(variables);
    if (!validation.valid) {
      throw new Error(`Unknown variables: ${validation.unknown.join(', ')}`);
    }
  }

  async getSampleData(variables: string[]) {
    // Get sample data for preview
    return this.variableRegistry.getSampleData(variables);
  }
}
```

### In Jobs Module

```typescript
import { TemplateVariableRegistryService } from '../../../shared/services/template-variable-registry.service';

@Injectable()
export class EmailCampaignService {
  constructor(
    private readonly variableRegistry: TemplateVariableRegistryService,
  ) {}

  async getAvailableVariables() {
    // Same registry, same variables
    return this.variableRegistry.getAllVariables();
  }
}
```

---

## API Methods

### `getAllVariables()`
Returns all variables organized by category.

**Response Format**:
```typescript
{
  user: {
    user_email: { type: 'email', description: '...', example: '...' },
    user_name: { type: 'string', description: '...', example: '...' },
    // ...
  },
  tenant: {
    company_name: { type: 'string', description: '...', example: '...' },
    // ...
  },
  // ... other categories
}
```

### `getVariablesByCategory(category: VariableCategory)`
Returns only variables for a specific category.

**Example**:
```typescript
const customerVars = variableRegistry.getVariablesByCategory(VariableCategory.CUSTOMER);
// Returns: { customer_name: {...}, customer_email: {...}, ... }
```

### `getAllVariableNames()`
Returns flat array of all variable names.

**Example**:
```typescript
const names = variableRegistry.getAllVariableNames();
// Returns: ['user_email', 'user_name', 'company_name', ...]
```

### `getSampleData(variableNames: string[])`
Returns sample data for specified variables (useful for template previews).

**Example**:
```typescript
const sample = variableRegistry.getSampleData(['customer_name', 'invoice_total']);
// Returns: { customer_name: 'John Doe', invoice_total: '$1,250.00' }
```

### `validateVariables(variableNames: string[])`
Validates that all variables exist in the registry.

**Example**:
```typescript
const validation = variableRegistry.validateVariables(['customer_name', 'invalid_var']);
// Returns: { valid: false, unknown: ['invalid_var'] }
```

### `searchVariables(query: string)`
Search variables by name or description.

**Example**:
```typescript
const results = variableRegistry.searchVariables('email');
// Returns all variables with 'email' in name or description
```

### `getCategories()`
Returns all available categories.

**Example**:
```typescript
const categories = variableRegistry.getCategories();
// Returns: ['user', 'tenant', 'customer', 'lead', 'quote', ...]
```

### `getVariableCountByCategory()`
Returns count of variables per category.

**Example**:
```typescript
const counts = variableRegistry.getVariableCountByCategory();
// Returns: { user: 9, tenant: 11, customer: 8, ... }
```

---

## Variable Data Types

Variables are strongly typed using the `VariableDataType` enum:

| Type | Description | Example |
|------|-------------|---------|
| `STRING` | Plain text | `'John Doe'` |
| `NUMBER` | Numeric value | `2026` |
| `BOOLEAN` | True/false | `true` |
| `DATE` | Date value | `'2026-01-19'` |
| `EMAIL` | Email address | `'user@example.com'` |
| `PHONE` | Phone number | `'+1-555-0123'` |
| `URL` | Web URL | `'https://example.com'` |
| `CURRENCY` | Formatted money | `'$1,250.00'` |

---

## Variable Definition Structure

Each variable in the registry follows this structure:

```typescript
{
  name: string;                      // Variable name (used in templates)
  type: VariableDataType;            // Data type
  category: VariableCategory;        // Category
  description: string;               // Human-readable description
  example: any;                      // Example value
  required?: boolean;                // Is it required?
  format?: string;                   // Format hint (e.g., 'ISO 8601')
  is_custom?: boolean;               // Is it tenant-defined?
  tenant_id?: string | null;         // Tenant owner (if custom)
}
```

**Example**:
```typescript
user_email: {
  name: 'user_email',
  type: VariableDataType.EMAIL,
  category: VariableCategory.USER,
  description: 'User email address',
  example: 'john.doe@example.com',
  required: false,
}
```

---

## Adding New Variables

To add new system-wide variables:

1. Open `/api/src/shared/services/template-variable-registry.service.ts`
2. Add the variable to `getSystemVariables()` method
3. Follow the existing structure
4. Choose appropriate category and data type
5. Provide clear description and realistic example

**Example**:
```typescript
customer_loyalty_points: {
  name: 'customer_loyalty_points',
  type: VariableDataType.NUMBER,
  category: VariableCategory.CUSTOMER,
  description: 'Customer loyalty reward points',
  example: 1250,
},
```

No need to update individual modules - the new variable is immediately available everywhere!

---

## Future Enhancements

### Phase 1: Database-Backed Custom Variables (Planned)
- Allow admins to define tenant-specific custom variables
- Store in database table: `custom_template_variables`
- Merge with system variables at runtime

### Phase 2: Dynamic Data Injection (Planned)
- Automatically populate variables from database (e.g., fetch actual tenant data)
- Cache tenant data for performance
- Support for conditional variables based on context

### Phase 3: Variable Validation Rules (Planned)
- Add regex patterns for validation
- Min/max length constraints
- Required vs optional enforcement

---

## Benefits

### Before (Duplicated Registries)
- Communication module had its own registry
- Jobs module had its own registry
- Variables could differ between modules
- Hard to keep in sync
- Updates needed in multiple places

### After (Centralized Registry)
✅ **Single source of truth**
✅ **Consistent across all modules**
✅ **Easy to maintain and extend**
✅ **Type-safe with TypeScript**
✅ **Self-documenting with examples**
✅ **Searchable and filterable**
✅ **Ready for admin management**

---

## Integration Status

| Module | Status | Location |
|--------|--------|----------|
| Communication | ✅ Integrated | `/modules/communication/services/email-templates.service.ts` |
| Jobs | 🔄 Migration Needed | `/modules/jobs/services/variable-registry.service.ts` |
| Future Modules | ⏳ Ready to Use | Import from `/shared/services/` |

---

## Migration Notes

### Jobs Module Migration (TODO)

The Jobs module currently has its own `VariableRegistryService`. To migrate:

1. Update `JobsModule` to import `SharedModule` (if not already global)
2. Replace `VariableRegistryService` with `TemplateVariableRegistryService`
3. Update all imports
4. Remove old `/jobs/services/variable-registry.service.ts` file
5. Test all job templates still work

---

## Contact

For questions or issues with the variable registry:
- Check this documentation first
- Review `/api/src/shared/types/template-variable.types.ts` for type definitions
- Review `/api/src/shared/services/template-variable-registry.service.ts` for implementation

---

**End of Documentation**
