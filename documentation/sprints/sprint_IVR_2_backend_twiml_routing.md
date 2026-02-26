# Sprint IVR-2: Backend TwiML Generation & Routing

**Sprint Goal**: Implement path-based navigation and multi-level TwiML generation for IVR menus.

**Duration**: 3-4 hours
**Priority**: HIGH (required before frontend implementation)
**Dependencies**: Sprint IVR-1 (validation must be complete)

---

## Context

Sprint 1 implemented recursive validation. This sprint adds the runtime logic to:
- Generate TwiML for different menu levels based on navigation path
- Navigate through menu tree using path notation (e.g., "1.2.1")
- Handle submenu actions (redirect to deeper levels)
- Maintain stateless navigation using URL query parameters

**Path Notation Examples**:
- Root level: no path or `path=""`
- First submenu: `path="1"` (user pressed 1 at root)
- Second level submenu: `path="1.2"` (pressed 1, then 2)
- Third level: `path="1.2.3"` (pressed 1, then 2, then 3)

---

## Sprint Tasks

### Task 1: Add Path-Based Menu Navigation Method

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`

#### Method: `navigateToMenuLevel()`

```typescript
/**
 * Navigate to specific menu level using path notation
 *
 * @param rootOptions - Root level menu options
 * @param rootGreeting - Root level greeting message
 * @param path - Navigation path (e.g., "1.2.1" means: digit 1 → digit 2 → digit 1)
 * @returns Current menu level with greeting, options, and timeout
 * @throws NotFoundException if path is invalid
 * @throws BadRequestException if path points to non-submenu option
 *
 * @example
 * // Navigate to root
 * navigateToMenuLevel(options, "Welcome", null)
 * // Returns: { greeting: "Welcome", options: [...], timeout: undefined }
 *
 * @example
 * // Navigate to submenu after pressing 1
 * navigateToMenuLevel(options, "Welcome", "1")
 * // Returns: { greeting: "Sales Dept...", options: [...], timeout: 10 }
 *
 * @example
 * // Navigate to sub-submenu after pressing 1, then 2
 * navigateToMenuLevel(options, "Welcome", "1.2")
 * // Returns: { greeting: "New Customers...", options: [...] }
 */
private navigateToMenuLevel(
  rootOptions: IvrMenuOptionDto[],
  rootGreeting: string,
  path?: string,
): {
  greeting: string;
  options: IvrMenuOptionDto[];
  timeout?: number;
} {
  // Base case: no path = root level
  if (!path || path === '') {
    return {
      greeting: rootGreeting,
      options: rootOptions,
      timeout: undefined, // Use default from config
    };
  }

  // Split path into digits (e.g., "1.2.3" → ["1", "2", "3"])
  const digits = path.split('.');
  let currentOptions = rootOptions;
  let currentGreeting = rootGreeting;
  let currentTimeout: number | undefined;

  // Traverse tree by following digit path
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[i];

    // Find option matching this digit at current level
    const option = currentOptions.find((opt) => opt.digit === digit);

    if (!option) {
      throw new NotFoundException(
        `Invalid menu path: digit "${digit}" not found at level ${i + 1} (path: "${path}")`,
      );
    }

    // Verify this option is a submenu
    if (option.action !== 'submenu' || !option.submenu) {
      throw new BadRequestException(
        `Invalid menu path: option at digit "${digit}" (${option.label}) is not a submenu. Cannot navigate deeper. Path: "${path}"`,
      );
    }

    // Move to submenu
    currentOptions = option.submenu.options;
    currentGreeting = option.submenu.greeting_message;
    currentTimeout = option.submenu.timeout_seconds;
  }

  return {
    greeting: currentGreeting,
    options: currentOptions,
    timeout: currentTimeout,
  };
}
```

**Error Handling**:
- Invalid path (digit not found): NotFoundException
- Path points to terminal action: BadRequestException
- Empty submenu: Should never happen (validation prevents this)

---

### Task 2: Update TwiML Generation for Multi-Level Menus

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`

#### Method: `generateIvrMenuTwiML()` (UPDATE EXISTING)

**Current Location**: Line ~200-250

**Changes**:

```typescript
/**
 * Generate IVR menu TwiML with support for multi-level navigation
 *
 * @param tenantId - Tenant UUID
 * @param path - Navigation path (e.g., "1.2" for submenu)
 * @returns TwiML XML string
 */
async generateIvrMenuTwiML(tenantId: string, path?: string): Promise<string> {
  const config = await this.findByTenantId(tenantId);

  if (!config || !config.ivr_enabled) {
    throw new BadRequestException('IVR is not enabled for this tenant');
  }

  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new NotFoundException(`Tenant not found: ${tenantId}`);
  }

  this.logger.log(
    `Generating IVR menu TwiML for tenant: ${tenantId}, path: ${path || 'root'}`,
  );

  // Navigate to correct menu level based on path
  const currentMenu = this.navigateToMenuLevel(
    config.menu_options as IvrMenuOptionDto[],
    config.greeting_message,
    path,
  );

  const twiml = new twilio.twiml.VoiceResponse();

  // Consent message (only on root level)
  if (!path || path === '') {
    twiml.say(
      { voice: 'Polly.Joanna', language: 'en-US' },
      'This call will be recorded for quality and training purposes.',
    );
  }

  // Greeting message for current level
  twiml.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    currentMenu.greeting,
  );

  // Build menu options text (e.g., "Press 1 for Sales. Press 2 for Support.")
  const menuText = currentMenu.options
    .map((opt) => `Press ${opt.digit} for ${opt.label}.`)
    .join(' ');

  // Determine timeout (submenu override or config default)
  const timeoutSeconds = currentMenu.timeout || config.timeout_seconds;

  // Gather DTMF digit input
  const gather = twiml.gather({
    numDigits: 1,
    timeout: timeoutSeconds,
    action: `https://${tenant.subdomain}.lead360.app/api/v1/communication/twilio/ivr/input${path ? `?path=${path}` : ''}`,
    method: 'POST',
  });

  gather.say({ voice: 'Polly.Joanna', language: 'en-US' }, menuText);

  // Default action on timeout/no input
  twiml.redirect(
    { method: 'POST' },
    `https://${tenant.subdomain}.lead360.app/api/v1/communication/twilio/ivr/default`,
  );

  return twiml.toString();
}
```

**Key Changes**:
1. Add `path?: string` parameter
2. Call `navigateToMenuLevel()` to get current menu
3. Only play consent message at root level (not on every submenu)
4. Use submenu timeout override if present
5. Include `path` query parameter in action URL

---

### Task 3: Update Action Execution to Handle Submenus

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`

#### Method: `executeIvrAction()` (UPDATE EXISTING)

**Current Location**: Line ~300-400

**Changes**:

```typescript
/**
 * Execute IVR action based on digit input
 *
 * @param tenantId - Tenant UUID
 * @param digit - Pressed digit (0-9)
 * @param callSid - Twilio call SID
 * @param path - Current menu path (optional)
 * @returns TwiML XML string
 */
async executeIvrAction(
  tenantId: string,
  digit: string,
  callSid: string,
  path?: string, // NEW PARAMETER
): Promise<string> {
  const config = await this.findByTenantId(tenantId);
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new NotFoundException(`Tenant not found: ${tenantId}`);
  }

  this.logger.log(
    `Executing IVR action for tenant: ${tenantId}, digit: ${digit}, path: ${path || 'root'}`,
  );

  // Navigate to current menu level
  const currentMenu = this.navigateToMenuLevel(
    config.menu_options as IvrMenuOptionDto[],
    config.greeting_message,
    path,
  );

  // Find selected option at current level
  const selectedOption = currentMenu.options.find((opt) => opt.digit === digit);

  const twiml = new twilio.twiml.VoiceResponse();

  if (!selectedOption) {
    // Invalid digit at this level
    this.logger.warn(
      `Invalid IVR digit: ${digit} at path: ${path || 'root'} for tenant: ${tenantId}`,
    );
    twiml.say(
      { voice: 'Polly.Joanna', language: 'en-US' },
      'Invalid option. Please try again.',
    );
    // Redirect back to current menu level
    twiml.redirect(
      { method: 'POST' },
      `https://${tenant.subdomain}.lead360.app/api/v1/communication/twilio/ivr/menu${path ? `?path=${path}` : ''}`,
    );
    return twiml.toString();
  }

  // Handle submenu action (navigate deeper)
  if (selectedOption.action === 'submenu') {
    const newPath = path ? `${path}.${digit}` : digit;
    this.logger.log(`Navigating to submenu: ${newPath}`);

    twiml.redirect(
      { method: 'POST' },
      `https://${tenant.subdomain}.lead360.app/api/v1/communication/twilio/ivr/menu?path=${newPath}`,
    );
    return twiml.toString();
  }

  // Handle voice_ai action (special routing)
  if (selectedOption.action === 'voice_ai') {
    return this.executeVoiceAiAction(tenantId, callSid, selectedOption);
  }

  // Execute terminal action (route_to_number, voicemail, webhook, etc.)
  await this.executeActionTwiML(twiml, selectedOption, tenant.subdomain);
  return twiml.toString();
}
```

**Key Changes**:
1. Add `path?: string` parameter
2. Navigate to current level before finding option
3. Handle submenu action: build new path and redirect
4. Include path in redirect URLs for invalid input

---

### Task 4: Update Controller Endpoints

**File**: `/var/www/lead360.app/api/src/modules/communication/controllers/ivr-configuration.controller.ts`

**Note**: Based on exploration, IVR endpoints might be in a different controller. Find the correct file with:
```bash
cd /var/www/lead360.app/api
grep -r "generateIvrMenuTwiML" src/modules/communication/controllers/
```

#### Update Endpoints:

```typescript
/**
 * GET /api/v1/communication/twilio/ivr/menu
 * Generate IVR menu TwiML (supports multi-level with path parameter)
 */
@Get('menu')
@ApiOperation({ summary: 'Generate IVR menu TwiML' })
@ApiQuery({
  name: 'path',
  required: false,
  description: 'Menu navigation path (e.g., "1.2" for submenu)',
  example: '1.2',
})
async getIvrMenu(
  @Req() req: any, // TwilioWebhookRequest type
  @Query('path') path?: string, // NEW PARAMETER
): Promise<string> {
  const tenantId = req.tenant?.id || req.body.tenantId;

  if (!tenantId) {
    throw new NotFoundException('Tenant not found in request');
  }

  return this.ivrConfigService.generateIvrMenuTwiML(tenantId, path);
}

/**
 * POST /api/v1/communication/twilio/ivr/input
 * Handle DTMF digit input from user
 */
@Post('input')
@ApiOperation({ summary: 'Handle IVR digit input' })
@ApiQuery({
  name: 'path',
  required: false,
  description: 'Current menu path',
  example: '1',
})
async handleIvrInput(
  @Req() req: any,
  @Body('Digits') digits: string,
  @Body('CallSid') callSid: string,
  @Query('path') path?: string, // NEW PARAMETER
): Promise<string> {
  const tenantId = req.tenant?.id || req.body.tenantId;

  if (!tenantId) {
    throw new NotFoundException('Tenant not found in request');
  }

  return this.ivrConfigService.executeIvrAction(
    tenantId,
    digits,
    callSid,
    path,
  );
}
```

---

### Task 5: Integration Tests

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.spec.ts`

**Add Integration Test Suite**:

```typescript
describe('Multi-Level IVR Navigation', () => {
  let service: IvrConfigurationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    // Setup test module...
  });

  it('should navigate to root level with no path', () => {
    const options = [
      { id: '1', digit: '1', action: 'voicemail', label: 'VM', config: {} },
    ];
    const result = service['navigateToMenuLevel'](options, 'Welcome', null);

    expect(result.greeting).toBe('Welcome');
    expect(result.options).toEqual(options);
    expect(result.timeout).toBeUndefined();
  });

  it('should navigate to first-level submenu', () => {
    const options = [
      {
        id: '1',
        digit: '1',
        action: 'submenu',
        label: 'Sales',
        config: {},
        submenu: {
          greeting_message: 'Sales Department',
          options: [
            { id: '1-1', digit: '1', action: 'voicemail', label: 'New', config: {} },
          ],
          timeout_seconds: 15,
        },
      },
    ];

    const result = service['navigateToMenuLevel'](options, 'Welcome', '1');

    expect(result.greeting).toBe('Sales Department');
    expect(result.options).toHaveLength(1);
    expect(result.timeout).toBe(15);
  });

  it('should navigate to second-level submenu', () => {
    const options = [
      {
        id: '1',
        digit: '1',
        action: 'submenu',
        label: 'Sales',
        config: {},
        submenu: {
          greeting_message: 'Sales',
          options: [
            {
              id: '1-1',
              digit: '1',
              action: 'submenu',
              label: 'Type',
              config: {},
              submenu: {
                greeting_message: 'Customer Type',
                options: [
                  { id: '1-1-1', digit: '1', action: 'voicemail', label: 'New', config: {} },
                ],
              },
            },
          ],
        },
      },
    ];

    const result = service['navigateToMenuLevel'](options, 'Welcome', '1.1');

    expect(result.greeting).toBe('Customer Type');
    expect(result.options).toHaveLength(1);
  });

  it('should throw NotFoundException for invalid path digit', () => {
    const options = [
      { id: '1', digit: '1', action: 'voicemail', label: 'VM', config: {} },
    ];

    expect(() =>
      service['navigateToMenuLevel'](options, 'Welcome', '2'),
    ).toThrow(NotFoundException);
  });

  it('should throw BadRequestException for non-submenu in path', () => {
    const options = [
      { id: '1', digit: '1', action: 'voicemail', label: 'VM', config: {} },
    ];

    expect(() =>
      service['navigateToMenuLevel'](options, 'Welcome', '1.2'),
    ).toThrow(BadRequestException);
  });

  it('should generate TwiML with submenu redirect on submenu action', async () => {
    // Mock findByTenantId to return config with submenu
    // Mock prisma tenant lookup

    const twiml = await service.executeIvrAction('tenant-123', '1', 'call-123', null);

    expect(twiml).toContain('<Redirect');
    expect(twiml).toContain('path=1');
  });
});
```

---

## Testing Instructions

### Prerequisites
- Sprint IVR-1 complete (validation methods working)
- Database has multi-level IVR config saved

### Unit Tests
```bash
cd /var/www/lead360.app/api

# Run all IVR tests
npm run test -- ivr-configuration.service.spec.ts

# Run specific test suite
npm run test -- ivr-configuration.service.spec.ts -t "Multi-Level IVR Navigation"
```

### Manual TwiML Generation Testing

#### Test 1: Generate Root Level TwiML
```bash
# Login as tenant user
curl -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@honeydo4you.com",
    "password": "978@F32c"
  }'

# Get IVR menu TwiML (root level)
curl -X GET "https://api.lead360.app/api/v1/communication/twilio/ivr/menu" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected TwiML**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    This call will be recorded for quality and training purposes.
  </Say>
  <Say voice="Polly.Joanna" language="en-US">
    Thank you for calling...
  </Say>
  <Gather numDigits="1" timeout="10" action="https://subdomain.lead360.app/api/v1/communication/twilio/ivr/input" method="POST">
    <Say voice="Polly.Joanna" language="en-US">
      Press 1 for Sales. Press 2 for Support.
    </Say>
  </Gather>
  <Redirect method="POST">
    https://subdomain.lead360.app/api/v1/communication/twilio/ivr/default
  </Redirect>
</Response>
```

#### Test 2: Generate Submenu TwiML
```bash
# Get submenu TwiML (path=1)
curl -X GET "https://api.lead360.app/api/v1/communication/twilio/ivr/menu?path=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**:
- No consent message (only at root)
- Submenu greeting message
- Submenu options
- Action URL includes `?path=1`

#### Test 3: Simulate Digit Input (Navigate to Submenu)
```bash
# Simulate pressing digit 1 at root level
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/ivr/input" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Digits=1&CallSid=CA1234567890abcdef"
```

**Expected TwiML** (if digit 1 is submenu):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">
    https://subdomain.lead360.app/api/v1/communication/twilio/ivr/menu?path=1
  </Redirect>
</Response>
```

#### Test 4: Invalid Path
```bash
# Try to access non-existent path
curl -X GET "https://api.lead360.app/api/v1/communication/twilio/ivr/menu?path=9.9.9" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: 404 Not Found with error message "Invalid menu path: digit '9' not found"

---

### End-to-End Twilio Testing

**Setup**:
1. Configure Twilio phone number to point to your IVR webhook:
   - Voice & Fax → Configure → A CALL COMES IN: Webhook
   - URL: `https://[subdomain].lead360.app/api/v1/communication/twilio/ivr/menu`
   - Method: HTTP POST

**Test Flow**:
1. Call the Twilio number
2. Listen to consent message and greeting
3. Press 1 (should hear submenu greeting if configured as submenu)
4. Press digit at submenu level
5. Verify routing to correct action (phone, Voice AI, voicemail)

**What to Verify**:
- [ ] Consent message plays only once (at root)
- [ ] Each submenu has its own greeting
- [ ] Navigation works across multiple levels
- [ ] Invalid digit at any level says "Invalid option" and replays current menu
- [ ] Terminal actions execute correctly at any level

---

## Acceptance Criteria

- [ ] `navigateToMenuLevel()` method:
  - [ ] Returns root menu when path is null/empty
  - [ ] Correctly traverses path notation (e.g., "1.2.3")
  - [ ] Returns submenu greeting and options
  - [ ] Returns submenu timeout override if set
  - [ ] Throws NotFoundException for invalid digit in path
  - [ ] Throws BadRequestException for non-submenu in path
- [ ] `generateIvrMenuTwiML()` updated:
  - [ ] Accepts optional path parameter
  - [ ] Calls navigateToMenuLevel() to get current menu
  - [ ] Consent message only at root level
  - [ ] Uses submenu timeout if provided
  - [ ] Action URL includes path query parameter
- [ ] `executeIvrAction()` updated:
  - [ ] Accepts optional path parameter
  - [ ] Navigates to current level before finding option
  - [ ] Handles submenu action: redirects to deeper path
  - [ ] Path accumulates correctly (e.g., "1" + "2" = "1.2")
  - [ ] Invalid digit redirects to current level (preserves path)
- [ ] Controller endpoints updated:
  - [ ] Both GET /menu and POST /input accept path query parameter
  - [ ] Path is passed to service methods
- [ ] Integration tests passing (minimum 6 new tests)
- [ ] Manual TwiML generation tests successful
- [ ] End-to-end Twilio call test successful with multi-level navigation

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

1. **Stateless Navigation**: Path is encoded in URL query parameters. No session storage or Redis required. This keeps the system simple and scalable.

2. **Error Recovery**: If path becomes invalid (e.g., config changed during call), throw appropriate error and Twilio will use default action.

3. **Logging**: Log every navigation step with path for debugging. Example: `"Navigating to submenu: 1.2.1"`

4. **TwiML Format**: Ensure TwiML is valid XML. Use Twilio's online TwiML validator if needed.

5. **Voice**: Using Polly.Joanna for consistency. Can be made configurable later.

---

## Next Sprint

**Sprint IVR-3**: Frontend Types & Basic Components - update frontend types to add missing actions and create recursive MenuTreeBuilder component.
