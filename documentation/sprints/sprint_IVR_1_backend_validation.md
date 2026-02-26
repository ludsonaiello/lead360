# Sprint IVR-1: Backend Validation & Service Layer

**Sprint Goal**: Implement recursive validation logic for multi-level IVR menu trees in the backend service layer.

**Duration**: 2-3 hours
**Priority**: CRITICAL (blocks all other sprints)
**Dependencies**: None (foundation work complete)

---

## Context

The database schema and DTOs now support multi-level IVR with recursive submenu structures. This sprint adds the critical validation logic to ensure:
- Menu depth doesn't exceed limits
- No circular references exist in the tree
- Total node count is reasonable (prevent abuse)
- Submenu actions have proper configuration

**Files Already Updated**:
- ✅ Database: `max_depth` column added to `ivr_configuration` table
- ✅ DTOs: `IvrSubmenuDto` created, `IvrMenuOptionDto` enhanced with `id` and `submenu`
- ✅ Action types: `'submenu'` added to `IVR_ACTION_TYPES`

---

## Sprint Tasks

### Task 1: Add Recursive Validation Methods to Service

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`

**Methods to Add**:

#### 1.1 `validateMenuTree()`
```typescript
/**
 * Recursively validate menu tree structure
 * - Checks depth limit
 * - Detects circular references
 * - Validates unique IDs across tree
 * - Counts total nodes
 *
 * @param menuOptions - Array of menu options to validate
 * @param maxDepth - Maximum allowed depth (from config, default 4)
 * @param currentDepth - Current depth level (starts at 1)
 * @param visitedIds - Set of visited option IDs (for circular detection)
 * @throws BadRequestException if validation fails
 */
private validateMenuTree(
  menuOptions: IvrMenuOptionDto[],
  maxDepth: number,
  currentDepth: number = 1,
  visitedIds: Set<string> = new Set(),
): { totalNodes: number } {
  // Implementation:
  // 1. Check if currentDepth > maxDepth → throw error
  // 2. Loop through each option:
  //    - Check if option.id already in visitedIds → throw "Circular reference detected"
  //    - Add option.id to visitedIds
  //    - Increment totalNodes counter
  //    - If action === 'submenu':
  //      - Validate submenu exists and has options
  //      - Recursively call validateMenuTree(submenu.options, maxDepth, currentDepth + 1, visitedIds)
  //    - If action !== 'submenu' but submenu exists:
  //      - Throw "Action is not submenu but submenu config exists"
  // 3. Return { totalNodes }
}
```

**Error Messages**:
- `"Menu depth exceeds maximum of {maxDepth} levels. Current depth: {currentDepth}. Please reduce nesting."`
- `"Circular reference detected: Option ID '{id}' appears multiple times in the menu tree."`
- `"Option '{label}' (digit {digit}) is set to 'submenu' action but has no submenu configuration or empty options array."`
- `"Option '{label}' has submenu configuration but action is not 'submenu'. Either change action to 'submenu' or remove submenu config."`

#### 1.2 `validateTotalNodeCount()`
```typescript
/**
 * Validate total node count doesn't exceed limit
 * @param totalNodes - Total nodes in tree
 * @param maxNodes - Maximum allowed nodes (default 100)
 * @throws BadRequestException if exceeds limit
 */
private validateTotalNodeCount(totalNodes: number, maxNodes: number = 100): void {
  if (totalNodes > maxNodes) {
    throw new BadRequestException(
      `Total menu options (${totalNodes}) exceeds maximum of ${maxNodes} across entire tree. Please simplify your menu structure.`
    );
  }
}
```

#### 1.3 Update `validateMenuOptions()` Method

**Current Location**: Line ~150-200 in ivr-configuration.service.ts

**Changes Needed**:
```typescript
private validateMenuOptions(
  menuOptions: IvrMenuOptionDto[],
  maxDepth: number = 4, // NEW parameter
): void {
  // Existing validation for duplicate digits at root level (keep this)
  const digits = menuOptions.map((opt) => opt.digit);
  const uniqueDigits = new Set(digits);
  if (digits.length !== uniqueDigits.size) {
    throw new BadRequestException('Menu options must have unique digits at each level');
  }

  // NEW: Add recursive tree validation
  const visitedIds = new Set<string>();
  const { totalNodes } = this.validateMenuTree(
    menuOptions,
    maxDepth,
    1, // Start at depth 1
    visitedIds
  );

  // NEW: Validate total node count
  this.validateTotalNodeCount(totalNodes);

  // Existing action-specific validation (keep this)
  for (const option of menuOptions) {
    this.validateActionConfig(option.action, option.config);

    // NEW: If submenu action, recursively validate digits at each level
    if (option.action === 'submenu' && option.submenu) {
      this.validateSubmenuDigitsUnique(option.submenu.options);
    }
  }
}
```

#### 1.4 Add `validateSubmenuDigitsUnique()` Helper

```typescript
/**
 * Recursively validate digit uniqueness at each submenu level
 * @param options - Menu options at this level
 */
private validateSubmenuDigitsUnique(options: IvrMenuOptionDto[]): void {
  const digits = options.map((opt) => opt.digit);
  const uniqueDigits = new Set(digits);

  if (digits.length !== uniqueDigits.size) {
    throw new BadRequestException(
      'Menu options must have unique digits within each submenu level'
    );
  }

  // Recurse into submenus
  for (const option of options) {
    if (option.action === 'submenu' && option.submenu) {
      this.validateSubmenuDigitsUnique(option.submenu.options);
    }
  }
}
```

---

### Task 2: Update `createOrUpdate()` to Use max_depth

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`

**Current Method Location**: Line ~50-100

**Change**:
```typescript
async createOrUpdate(
  tenantId: string,
  dto: CreateIvrConfigDto,
): Promise<any> {
  this.logger.log(`Creating/updating IVR config for tenant: ${tenantId}`);

  // Existing validation calls...

  // Update this line to pass max_depth:
  this.validateMenuOptions(dto.menu_options, dto.max_depth || 4);

  // Existing Prisma upsert...
  const config = await this.prisma.ivr_configuration.upsert({
    where: { tenant_id: tenantId },
    update: {
      ivr_enabled: dto.ivr_enabled,
      greeting_message: dto.greeting_message,
      menu_options: dto.menu_options as any,
      default_action: dto.default_action as any,
      timeout_seconds: dto.timeout_seconds,
      max_retries: dto.max_retries,
      max_depth: dto.max_depth || 4, // NEW: Add this field
      status: dto.ivr_enabled ? 'active' : 'inactive',
    },
    create: {
      tenant_id: tenantId,
      ivr_enabled: dto.ivr_enabled,
      greeting_message: dto.greeting_message,
      menu_options: dto.menu_options as any,
      default_action: dto.default_action as any,
      timeout_seconds: dto.timeout_seconds,
      max_retries: dto.max_retries,
      max_depth: dto.max_depth || 4, // NEW: Add this field
      status: dto.ivr_enabled ? 'active' : 'inactive',
    },
  });

  return config;
}
```

---

### Task 3: Unit Tests for Validation

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.spec.ts`

**Test Cases to Add**:

#### 3.1 Depth Validation Tests
```typescript
describe('Multi-Level IVR Validation', () => {
  it('should accept valid 2-level menu', async () => {
    const config = {
      ivr_enabled: true,
      greeting_message: 'Welcome',
      menu_options: [
        {
          id: '1',
          digit: '1',
          action: 'submenu',
          label: 'Sales',
          config: {},
          submenu: {
            greeting_message: 'Sales department',
            options: [
              { id: '1-1', digit: '1', action: 'route_to_number', label: 'New', config: { phone_number: '+19781234567' } }
            ]
          }
        }
      ],
      default_action: { action: 'voicemail', config: { max_duration_seconds: 180 } },
      timeout_seconds: 10,
      max_retries: 3,
      max_depth: 4,
    };

    await expect(service.createOrUpdate('tenant-123', config)).resolves.toBeDefined();
  });

  it('should reject menu exceeding max depth', async () => {
    const config = {
      // ... nested 6 levels deep (exceeds max_depth: 5)
    };

    await expect(service.createOrUpdate('tenant-123', config))
      .rejects
      .toThrow('Menu depth exceeds maximum');
  });

  it('should reject circular reference in menu tree', async () => {
    const config = {
      menu_options: [
        { id: 'opt-1', digit: '1', action: 'submenu', label: 'Sales', config: {}, submenu: {
          greeting_message: 'Sales',
          options: [
            { id: 'opt-1', digit: '1', action: 'route_to_number', label: 'Test', config: {} } // Duplicate ID!
          ]
        }}
      ],
      // ...
    };

    await expect(service.createOrUpdate('tenant-123', config))
      .rejects
      .toThrow('Circular reference detected');
  });

  it('should reject total nodes exceeding 100', async () => {
    // Generate config with 101 total nodes
    const config = {
      menu_options: generateDeepMenu(101), // helper function
      // ...
    };

    await expect(service.createOrUpdate('tenant-123', config))
      .rejects
      .toThrow('Total menu options');
  });

  it('should reject submenu action without submenu config', async () => {
    const config = {
      menu_options: [
        { id: 'opt-1', digit: '1', action: 'submenu', label: 'Sales', config: {} } // Missing submenu!
      ],
      // ...
    };

    await expect(service.createOrUpdate('tenant-123', config))
      .rejects
      .toThrow('submenu action but has no submenu configuration');
  });

  it('should reject non-submenu action with submenu config', async () => {
    const config = {
      menu_options: [
        {
          id: 'opt-1',
          digit: '1',
          action: 'route_to_number', // Not submenu
          label: 'Sales',
          config: { phone_number: '+1234567890' },
          submenu: { greeting_message: 'Test', options: [] } // Shouldn't be here!
        }
      ],
      // ...
    };

    await expect(service.createOrUpdate('tenant-123', config))
      .rejects
      .toThrow('has submenu configuration but action is not');
  });

  it('should validate unique digits within each submenu level', async () => {
    const config = {
      menu_options: [
        {
          id: 'opt-1',
          digit: '1',
          action: 'submenu',
          label: 'Sales',
          config: {},
          submenu: {
            greeting_message: 'Sales',
            options: [
              { id: 'opt-1-1', digit: '1', action: 'voicemail', label: 'A', config: {} },
              { id: 'opt-1-2', digit: '1', action: 'voicemail', label: 'B', config: {} } // Duplicate digit!
            ]
          }
        }
      ],
      // ...
    };

    await expect(service.createOrUpdate('tenant-123', config))
      .rejects
      .toThrow('unique digits within each submenu level');
  });
});
```

---

## Testing Instructions

### Prerequisites
- Database migration already applied (max_depth column exists)
- DTOs already updated with recursive structure

### Run Unit Tests
```bash
cd /var/www/lead360.app/api

# Run IVR service tests specifically
npm run test -- ivr-configuration.service.spec.ts

# Check coverage
npm run test:cov -- ivr-configuration.service.spec.ts
```

### Manual API Testing with Postman/cURL

#### Test Case 1: Valid Multi-Level Menu
```bash
# Login as admin to get token
curl -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ludsonaiello@gmail.com",
    "password": "978@F32c"
  }'

# Save the access_token from response

# Create multi-level IVR config
curl -X POST https://api.lead360.app/api/v1/communication/twilio/ivr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "ivr_enabled": true,
    "greeting_message": "Thank you for calling. Press 1 for Sales or 2 for Support.",
    "menu_options": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "digit": "1",
        "action": "submenu",
        "label": "Sales Department",
        "config": {},
        "submenu": {
          "greeting_message": "Sales Department. Press 1 for new customers or 2 for existing customers.",
          "options": [
            {
              "id": "550e8400-e29b-41d4-a716-446655440002",
              "digit": "1",
              "action": "route_to_number",
              "label": "New Customers",
              "config": { "phone_number": "+19781234567" }
            },
            {
              "id": "550e8400-e29b-41d4-a716-446655440003",
              "digit": "2",
              "action": "voice_ai",
              "label": "Existing Customers",
              "config": {}
            }
          ]
        }
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440004",
        "digit": "2",
        "action": "voicemail",
        "label": "Support",
        "config": { "max_duration_seconds": 180 }
      }
    ],
    "default_action": {
      "action": "voicemail",
      "config": { "max_duration_seconds": 180 }
    },
    "timeout_seconds": 10,
    "max_retries": 3,
    "max_depth": 4
  }'
```

**Expected**: 200 OK with created config

#### Test Case 2: Depth Limit Exceeded
```bash
# Create menu with 6 levels (exceeds max_depth: 5)
curl -X POST https://api.lead360.app/api/v1/communication/twilio/ivr \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{ ... 6-level nested menu ... }'
```

**Expected**: 400 Bad Request with error "Menu depth exceeds maximum"

#### Test Case 3: Circular Reference
```bash
# Create menu with duplicate option IDs
curl -X POST https://api.lead360.app/api/v1/communication/twilio/ivr \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "menu_options": [
      {
        "id": "duplicate-id",
        "digit": "1",
        "action": "submenu",
        "submenu": {
          "options": [
            { "id": "duplicate-id", ... } // Same ID!
          ]
        }
      }
    ]
  }'
```

**Expected**: 400 Bad Request with error "Circular reference detected"

---

## Acceptance Criteria

- [ ] `validateMenuTree()` method added and correctly detects:
  - [ ] Depth exceeding max_depth
  - [ ] Circular references (duplicate IDs)
  - [ ] Missing submenu config when action is 'submenu'
  - [ ] Unexpected submenu config when action is not 'submenu'
- [ ] `validateTotalNodeCount()` method added and rejects > 100 nodes
- [ ] `validateSubmenuDigitsUnique()` recursively validates digit uniqueness at each level
- [ ] `createOrUpdate()` method updated to:
  - [ ] Accept and store `max_depth` field
  - [ ] Pass `max_depth` to validation methods
- [ ] All unit tests passing (minimum 6 new tests)
- [ ] Test coverage > 85% for new validation methods
- [ ] Manual API testing confirms all validation rules work
- [ ] Error messages are clear and actionable

---

## Database Credentials

**MySQL Connection**:
- Host: `127.0.0.1`
- Port: `3306`
- Database: `lead360`
- User: `lead360_user`
- Password: `978@F32c`

**Test Users**:
- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Notes for Developer

1. **Recursive Validation**: The key challenge is traversing the tree correctly. Use a Set to track visited IDs as you recurse.

2. **Error Messages**: Be specific about which option has the problem (include label and digit in error messages).

3. **Performance**: With max 100 nodes and max 5 levels, performance won't be an issue. Don't over-optimize.

4. **Backward Compatibility**: Existing single-level configs (without submenu) should continue to work perfectly.

5. **Testing Strategy**: Write tests that cover edge cases (exactly at limits, just over limits, circular refs at different depths).

---

## Next Sprint

**Sprint IVR-2**: Backend TwiML Generation & Routing - implement path-based navigation and multi-level TwiML generation.
