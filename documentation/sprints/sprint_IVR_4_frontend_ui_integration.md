# Sprint IVR-4: Frontend UI Integration

**Sprint Goal**: Integrate MenuTreeBuilder into edit page, update view page for hierarchical display, and implement end-to-end testing.

**Duration**: 4-5 hours
**Priority**: HIGH (user-facing features)
**Dependencies**: Sprint IVR-3 (MenuTreeBuilder component complete)

---

## Context

Sprint 3 created the recursive MenuTreeBuilder component. This sprint integrates it into the existing IVR pages:
- **Edit Page**: Replace flat menu options builder with MenuTreeBuilder
- **View Page**: Update to display multi-level menu hierarchy with proper nesting
- **API Integration**: Ensure form submission and data loading works with nested structure
- **End-to-End Testing**: Test complete workflow from UI to backend to Twilio

**Current Files** (from exploration):
- Edit Page: `/var/www/lead360.app/app/src/app/(dashboard)/communications/twilio/ivr/edit/page.tsx` (1,110 lines)
- View Page: `/var/www/lead360.app/app/src/app/(dashboard)/communications/twilio/ivr/page.tsx` (758 lines)
- API Client: `/var/www/lead360.app/app/src/lib/api/ivr.ts`

---

## Sprint Tasks

### Task 1: Update API Client for Multi-Level Support

**File**: `/var/www/lead360.app/app/src/lib/api/ivr.ts`

**Current Methods**:
- `getIVRConfiguration(token)`
- `upsertIVRConfiguration(token, data)`
- `disableIVRConfiguration(token)`

**Updates Needed**:

```typescript
import { IVRConfiguration, IVRFormData } from "@/lib/types/ivr";

// ... existing imports ...

/**
 * Get IVR Configuration
 * Now supports multi-level menu structures
 */
export async function getIVRConfiguration(
  token: string
): Promise<IVRConfiguration | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/communication/twilio/ivr`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 404) {
      return null; // No config exists yet
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch IVR configuration");
    }

    const config: IVRConfiguration = await response.json();

    // Ensure max_depth exists (backward compatibility)
    if (!config.max_depth) {
      config.max_depth = 4; // Default
    }

    return config;
  } catch (error) {
    console.error("Error fetching IVR configuration:", error);
    throw error;
  }
}

/**
 * Create or Update IVR Configuration
 * Supports multi-level menu structures with validation
 */
export async function upsertIVRConfiguration(
  token: string,
  data: IVRFormData
): Promise<IVRConfiguration> {
  try {
    // Client-side validation before sending
    const { isValid, errors } = validateIVRMenuTree(
      data.menu_options,
      data.max_depth || 4
    );

    if (!isValid) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    const response = await fetch(
      `${API_BASE_URL}/communication/twilio/ivr`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ivr_enabled: data.ivr_enabled,
          greeting_message: data.greeting_message,
          menu_options: data.menu_options,
          default_action: data.default_action,
          timeout_seconds: data.timeout_seconds,
          max_retries: data.max_retries,
          max_depth: data.max_depth || 4,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to save IVR configuration");
    }

    return await response.json();
  } catch (error) {
    console.error("Error saving IVR configuration:", error);
    throw error;
  }
}

// ... existing disableIVRConfiguration method unchanged ...
```

---

### Task 2: Update Edit Page to Use MenuTreeBuilder

**File**: `/var/www/lead360.app/app/src/app/(dashboard)/communications/twilio/ivr/edit/page.tsx`

**Current Structure** (from exploration):
- 1,110 lines
- Uses React Hook Form + Zod validation
- Has flat menu options builder with drag-and-drop (dnd-kit)
- Sections: Status, Greeting, Menu Options, Default Action, Advanced Settings

**Changes Required**:

#### 2.1 Update Imports
```typescript
// Add new imports
import { MenuTreeBuilder } from "@/components/ivr/MenuTreeBuilder";
import { validateIVRMenuTree } from "@/lib/utils/ivr-validation";
import { IVR_CONSTANTS } from "@/lib/types/ivr";

// Remove old imports
// - Remove dnd-kit imports (no longer needed for flat structure)
// - Keep React Hook Form, Zod, etc.
```

#### 2.2 Update Zod Schema for Recursive Structure

**Find and Update** (around line 50-150):

```typescript
import { z } from "zod";

// Recursive menu option schema
const ivrMenuOptionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    digit: z.string().regex(/^[0-9]$/),
    action: z.enum([
      "route_to_number",
      "route_to_default",
      "trigger_webhook",
      "voicemail",
      "voice_ai",
      "submenu",
    ]),
    label: z.string().min(1).max(100),
    config: z.object({
      phone_number: z.string().optional(),
      webhook_url: z.string().url().optional(),
      max_duration_seconds: z.number().min(60).max(300).optional(),
    }),
    submenu: z
      .object({
        greeting_message: z.string().min(5).max(500),
        options: z.array(ivrMenuOptionSchema).min(1).max(10),
        timeout_seconds: z.number().min(5).max(60).optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      // If action is submenu, must have submenu config
      if (data.action === "submenu") {
        return !!data.submenu && data.submenu.options.length > 0;
      }
      // If action is NOT submenu, must NOT have submenu config
      return !data.submenu;
    },
    { message: "Submenu config must match action type" }
  )
);

const ivrFormSchema = z
  .object({
    ivr_enabled: z.boolean(),
    greeting_message: z.string().min(5).max(500),
    menu_options: z.array(ivrMenuOptionSchema).min(1).max(10),
    default_action: z.object({
      action: z.enum([
        "route_to_number",
        "route_to_default",
        "trigger_webhook",
        "voicemail",
        "voice_ai",
      ]),
      config: z.object({
        phone_number: z.string().optional(),
        webhook_url: z.string().url().optional(),
        max_duration_seconds: z.number().optional(),
      }),
    }),
    timeout_seconds: z.number().min(5).max(60),
    max_retries: z.number().min(1).max(5),
    max_depth: z.number().min(1).max(5).optional(),
  })
  .refine(
    (data) => {
      // Custom validation using our validation utilities
      const { isValid, errors } = validateIVRMenuTree(
        data.menu_options,
        data.max_depth || 4
      );
      return isValid;
    },
    {
      message: "Menu tree validation failed",
      path: ["menu_options"],
    }
  );
```

#### 2.3 Replace Menu Options Builder Section

**Find** (around line 400-800):
```typescript
{/* OLD: Flat menu options with drag-and-drop */}
<div>
  <h3>Menu Options</h3>
  {/* Old flat menu builder code */}
</div>
```

**Replace With**:
```typescript
{/* Menu Options Builder - Multi-Level Support */}
<Card>
  <CardHeader>
    <CardTitle>Menu Options</CardTitle>
    <CardDescription>
      Configure your IVR menu structure. You can create up to {watch("max_depth") || 4} levels of nested submenus.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <MenuTreeBuilder
      parentPath="menu_options"
      level={1}
      maxDepth={watch("max_depth") || 4}
    />

    {/* Show validation errors */}
    {errors.menu_options && (
      <Alert variant="destructive" className="mt-4">
        <AlertTitle>Menu Validation Error</AlertTitle>
        <AlertDescription>
          {errors.menu_options.message}
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

#### 2.4 Add Max Depth Setting

**Add to Advanced Settings Section** (around line 900-1000):

```typescript
{/* Advanced Settings */}
<Card>
  <CardHeader>
    <CardTitle>Advanced Settings</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Existing timeout and max_retries fields */}

    {/* NEW: Max Depth Setting */}
    <div>
      <Label htmlFor="max_depth">
        Maximum Menu Depth
        <InfoIcon tooltip="Controls how many levels of nested submenus are allowed (1-5)" />
      </Label>
      <Input
        id="max_depth"
        type="number"
        min={1}
        max={5}
        defaultValue={4}
        {...register("max_depth", { valueAsNumber: true })}
      />
      <p className="text-sm text-muted-foreground mt-1">
        Recommended: 4 levels. Higher depths may confuse callers.
      </p>
    </div>
  </CardContent>
</Card>
```

#### 2.5 Update Form Submission Logic

**Find** (around line 1000-1050):
```typescript
const onSubmit = async (data: IVRFormData) => {
  try {
    setIsSubmitting(true);

    const token = await getAccessToken();

    // Add client-side validation
    const { isValid, errors } = validateIVRMenuTree(
      data.menu_options,
      data.max_depth || 4
    );

    if (!isValid) {
      toast({
        title: "Validation Error",
        description: errors.join("\n"),
        variant: "destructive",
      });
      return;
    }

    await upsertIVRConfiguration(token, data);

    toast({
      title: "Success",
      description: "IVR configuration saved successfully",
    });

    router.push("/communications/twilio/ivr");
  } catch (error) {
    console.error("Error saving IVR config:", error);
    toast({
      title: "Error",
      description: error.message || "Failed to save IVR configuration",
      variant: "destructive",
    });
  } finally {
    setIsSubmitting(false);
  }
};
```

---

### Task 3: Update View Page for Multi-Level Display

**File**: `/var/www/lead360.app/app/src/app/(dashboard)/communications/twilio/ivr/page.tsx`

**Current Structure** (from exploration):
- 758 lines
- Displays IVR config in cards
- Flat grid layout for menu options

**Changes Required**:

#### 3.1 Create Recursive Menu Display Component

**Add New Component** (at bottom of file):

```typescript
/**
 * Recursive component to display multi-level menu options
 */
function MenuOptionDisplay({
  option,
  level = 1,
}: {
  option: IVRMenuOption;
  level?: number;
}) {
  const getActionIcon = (action: IVRActionType) => {
    switch (action) {
      case "route_to_number":
        return <Phone className="h-4 w-4" />;
      case "voice_ai":
        return <Bot className="h-4 w-4" />;
      case "voicemail":
        return <Voicemail className="h-4 w-4" />;
      case "trigger_webhook":
        return <Link className="h-4 w-4" />;
      case "submenu":
        return <ChevronRight className="h-4 w-4" />;
      default:
        return <ArrowRight className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: IVRActionType) => {
    switch (action) {
      case "route_to_number":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "voice_ai":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      case "voicemail":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "trigger_webhook":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
      case "submenu":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div
      className="space-y-3"
      style={{ marginLeft: level > 1 ? `${(level - 1) * 1.5}rem` : "0" }}
    >
      <Card className={level > 1 ? "border-l-4 border-l-primary/30" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Digit Badge */}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${getActionColor(
                  option.action
                )}`}
              >
                {option.digit}
              </div>

              <div>
                <CardTitle className="text-base">{option.label}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {getActionIcon(option.action)}
                    <span className="ml-1">
                      {ACTION_TYPE_LABELS[option.action]}
                    </span>
                  </Badge>
                  {level > 1 && (
                    <Badge variant="outline" className="text-xs">
                      Level {level}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Action-Specific Details */}
          {option.action === "route_to_number" && option.config.phone_number && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono">{option.config.phone_number}</span>
            </div>
          )}

          {option.action === "trigger_webhook" && option.config.webhook_url && (
            <div className="flex items-center gap-2 text-sm">
              <Link className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{option.config.webhook_url}</span>
            </div>
          )}

          {option.action === "voicemail" && option.config.max_duration_seconds && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Max duration: {option.config.max_duration_seconds}s</span>
            </div>
          )}

          {/* Submenu Section */}
          {option.action === "submenu" && option.submenu && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <ChevronRight className="h-3 w-3 mr-1" />
                  Submenu
                </Badge>
              </div>

              {/* Submenu Greeting */}
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Submenu Greeting:
                </p>
                <p className="text-sm">{option.submenu.greeting_message}</p>
              </div>

              {/* Recursive: Display submenu options */}
              <div className="space-y-2">
                {option.submenu.options.map((subOption) => (
                  <MenuOptionDisplay
                    key={subOption.id}
                    option={subOption}
                    level={level + 1}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 3.2 Update Main Display Section

**Find** (around line 300-500):
```typescript
{/* OLD: Flat grid of menu option cards */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {config.menu_options.map((option) => (
    <Card key={option.digit}>
      {/* Old flat display */}
    </Card>
  ))}
</div>
```

**Replace With**:
```typescript
{/* Menu Options - Hierarchical Display */}
<Card>
  <CardHeader>
    <CardTitle>Menu Structure</CardTitle>
    <CardDescription>
      {config.max_depth > 1
        ? `Multi-level menu with up to ${config.max_depth} levels`
        : "Single-level menu"}
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {config.menu_options.map((option) => (
        <MenuOptionDisplay key={option.id} option={option} level={1} />
      ))}
    </div>
  </CardContent>
</Card>
```

#### 3.3 Add Max Depth Display to Settings Card

**Find Settings Card** (around line 600-650):

```typescript
{/* Settings Card */}
<Card>
  <CardHeader>
    <CardTitle>Settings</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    {/* Existing timeout and max_retries */}

    {/* NEW: Max Depth */}
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium">Maximum Menu Depth:</span>
      <Badge variant="secondary">{config.max_depth || 4} levels</Badge>
    </div>
  </CardContent>
</Card>
```

---

### Task 4: End-to-End Testing

#### Test 1: Create Multi-Level IVR via UI

**Steps**:
1. Login to tenant account: `contact@honeydo4you.com` / `978@F32c`
2. Navigate to Communications → Twilio → IVR
3. Click "Configure IVR" or "Edit"
4. Enable IVR
5. Enter greeting: "Thank you for calling"
6. Add Option 1:
   - Digit: 1
   - Action: Submenu
   - Label: "Sales"
7. Expand submenu accordion
8. Enter submenu greeting: "Sales Department. Press 1 for new customers."
9. Add sub-option 1-1:
   - Digit: 1
   - Action: Route to Phone Number
   - Label: "New Customers"
   - Phone: +19781234567
10. Add sub-option 1-2:
    - Digit: 2
    - Action: Voice AI
    - Label: "Existing Customers"
11. Back at root level, add Option 2:
    - Digit: 2
    - Action: Voicemail
    - Label: "Support"
    - Duration: 180
12. Set default action: Voicemail, 180s
13. Save

**Expected Result**:
- ✅ Form validates successfully
- ✅ API returns 200 OK
- ✅ Redirect to view page
- ✅ View page displays hierarchical menu with indentation
- ✅ Submenu is shown nested under Option 1

#### Test 2: View Multi-Level IVR

**Steps**:
1. After saving, verify view page displays:
   - Option 1 card with "Submenu" badge
   - Submenu greeting shown
   - Sub-options indented/nested
   - Option 2 card at root level
   - Settings card shows "Max Depth: 4 levels"

**Expected Result**:
- ✅ Hierarchical display with proper indentation
- ✅ Level badges show correctly (Level 1, Level 2)
- ✅ Submenu greeting displayed
- ✅ All action icons correct

#### Test 3: Edit Existing Multi-Level IVR

**Steps**:
1. Click "Edit" on view page
2. Verify form loads with:
   - All menu options populated
   - Submenu accordion exists and can be expanded
   - Nested options visible when accordion expanded
3. Make a change (e.g., change label)
4. Save

**Expected Result**:
- ✅ Form loads existing multi-level structure
- ✅ Changes save successfully
- ✅ View page reflects changes

#### Test 4: Validation Tests

**Test 4a: Max Depth Exceeded**
1. Create menu with 5 levels when max_depth = 4
2. Try to save

**Expected**: Error message "Menu depth exceeds maximum"

**Test 4b: Circular Reference**
1. Manually edit form data (via browser console if needed) to create duplicate IDs
2. Try to save

**Expected**: Error message "Circular reference detected"

**Test 4c: Total Node Limit**
1. Create menu with 101 total nodes
2. Try to save

**Expected**: Error message "Total menu options exceeds maximum of 100"

#### Test 5: Twilio Integration (Full E2E)

**Setup**:
- Configure Twilio number to point to: `https://[subdomain].lead360.app/api/v1/communication/twilio/ivr/menu`

**Steps**:
1. Call the Twilio number
2. Listen to greeting
3. Press 1 (navigate to submenu)
4. Listen to submenu greeting
5. Press 1 at submenu (route to phone)
6. Verify call connects to +19781234567

**Expected Flow**:
1. "This call will be recorded..."
2. "Thank you for calling. Press 1 for Sales or 2 for Support."
3. [Press 1]
4. "Sales Department. Press 1 for new customers or 2 for existing customers."
5. [Press 1]
6. Call connects to +19781234567

---

## Acceptance Criteria

- [ ] API Client updated:
  - [ ] Handles nested menu structures
  - [ ] Client-side validation before submission
  - [ ] Backward compatibility with existing configs
- [ ] Edit Page updated:
  - [ ] MenuTreeBuilder integrated successfully
  - [ ] Zod schema supports recursive validation
  - [ ] Max depth setting added to Advanced Settings
  - [ ] Form submission includes max_depth
  - [ ] Validation errors displayed clearly
  - [ ] Existing single-level configs load correctly
- [ ] View Page updated:
  - [ ] MenuOptionDisplay component shows hierarchy
  - [ ] Visual indentation for nested levels
  - [ ] Level badges display correctly
  - [ ] Submenu greeting displayed
  - [ ] Action icons and colors correct
  - [ ] Max depth shown in settings card
- [ ] End-to-End Tests:
  - [ ] Can create multi-level IVR via UI
  - [ ] View page displays correctly
  - [ ] Can edit existing multi-level config
  - [ ] Validation errors caught and displayed
  - [ ] Twilio call flow works end-to-end
  - [ ] Navigation through submenus works
  - [ ] Terminal actions execute correctly at any level

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

**Test Twilio Number**: [Your Twilio number from dashboard]

---

## Notes for Developer

1. **Form State Complexity**: React Hook Form handles nested structures well, but debugging can be tricky. Use React DevTools to inspect form state.

2. **Accordion State**: Consider using `defaultOpen` for first submenu to improve UX during editing.

3. **Mobile Responsiveness**: Test on mobile - nested accordions should collapse appropriately.

4. **Error Handling**: Show clear error messages for validation failures. Consider showing which specific option/submenu has the issue.

5. **Performance**: With max 100 nodes, performance should be fine. If issues arise, consider virtualization (react-window).

---

## Next Sprint

**Sprint IVR-5**: Documentation & Polish - update REST API docs, add internal endpoint documentation, create user guide, and final testing/bug fixes.
