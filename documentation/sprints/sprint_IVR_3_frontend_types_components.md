# Sprint IVR-3: Frontend Types & Basic Components

**Sprint Goal**: Update frontend TypeScript types and create recursive MenuTreeBuilder component for multi-level IVR UI.

**Duration**: 4-5 hours
**Priority**: HIGH (required before UI integration)
**Dependencies**: Sprint IVR-2 (backend TwiML generation complete)

---

## Context

The backend now supports multi-level IVR with recursive structures. This sprint updates the frontend to:
- Add missing `voice_ai` action type (currently missing!)
- Add new `submenu` action type
- Create recursive data types for nested menus
- Build reusable MenuTreeBuilder component with tree/accordion UI
- Implement frontend validation for depth and circular references

**Current Frontend State** (from exploration):
- Location: `/var/www/lead360.app/app/src/app/(dashboard)/communications/twilio/ivr/`
- Types: `app/src/lib/types/ivr.ts` (MISSING `voice_ai`)
- Edit Page: 1,110 lines with React Hook Form + dnd-kit
- View Page: 758 lines with card grid layout

---

## Sprint Tasks

### Task 1: Update Frontend TypeScript Types

**File**: `/var/www/lead360.app/app/src/lib/types/ivr.ts`

#### Changes Required:

```typescript
// BEFORE (current - 4 actions)
export type IVRActionType =
  | "route_to_number"
  | "route_to_default"
  | "trigger_webhook"
  | "voicemail";

// AFTER (add 2 missing actions)
export type IVRActionType =
  | "route_to_number"
  | "route_to_default"
  | "trigger_webhook"
  | "voicemail"
  | "voice_ai"     // MISSING from frontend but exists in backend!
  | "submenu";     // NEW for multi-level IVR
```

#### Add New Interfaces:

```typescript
/**
 * IVR Submenu Configuration
 * Used for nested multi-level IVR menus
 */
export interface IVRSubmenu {
  greeting_message: string;          // 5-500 characters
  options: IVRMenuOption[];         // Recursive array
  timeout_seconds?: number;          // Optional override (5-60)
}

/**
 * IVR Menu Option (updated for multi-level support)
 */
export interface IVRMenuOption {
  id: string;                        // NEW: UUID for circular reference detection
  digit: string;                     // "0"-"9"
  action: IVRActionType;
  label: string;                     // 1-100 characters
  config: IVRActionConfig;
  submenu?: IVRSubmenu;             // NEW: Only present if action === "submenu"
}

/**
 * IVR Action Configuration
 */
export interface IVRActionConfig {
  phone_number?: string;             // E.164 format for route_to_number/voice_ai
  webhook_url?: string;              // HTTPS for trigger_webhook
  max_duration_seconds?: number;     // 60-300 for voicemail
}

/**
 * Full IVR Configuration (updated)
 */
export interface IVRConfiguration {
  id: string;
  tenant_id: string;
  twilio_config_id: string | null;
  ivr_enabled: boolean;
  greeting_message: string;          // 5-500 characters
  menu_options: IVRMenuOption[];    // 1-10 options (now supports nesting)
  default_action: IVRDefaultAction;
  timeout_seconds: number;           // 5-60 seconds
  max_retries: number;              // 1-5 attempts
  max_depth: number;                // NEW: 1-5 levels
  status: IVRStatus;                // "active" | "inactive"
  created_at: string;
  updated_at: string;
}

/**
 * Default Action (unchanged)
 */
export interface IVRDefaultAction {
  action: Exclude<IVRActionType, "submenu">; // Submenu cannot be default action
  config: IVRActionConfig;
}

/**
 * IVR Status
 */
export type IVRStatus = "active" | "inactive";

/**
 * Form data type (for React Hook Form)
 */
export interface IVRFormData {
  ivr_enabled: boolean;
  greeting_message: string;
  menu_options: IVRMenuOption[];
  default_action: IVRDefaultAction;
  timeout_seconds: number;
  max_retries: number;
  max_depth: number;
}
```

#### Add Constants:

```typescript
/**
 * IVR Constants
 */
export const IVR_CONSTANTS = {
  MAX_OPTIONS_PER_LEVEL: 10,
  MAX_DEPTH: 5,
  MIN_DEPTH: 1,
  DEFAULT_DEPTH: 4,
  MIN_TIMEOUT: 5,
  MAX_TIMEOUT: 60,
  DEFAULT_TIMEOUT: 10,
  MIN_RETRIES: 1,
  MAX_RETRIES: 5,
  DEFAULT_RETRIES: 3,
  MIN_GREETING_LENGTH: 5,
  MAX_GREETING_LENGTH: 500,
  MAX_TOTAL_NODES: 100,
} as const;

/**
 * Action type labels for UI
 */
export const ACTION_TYPE_LABELS: Record<IVRActionType, string> = {
  route_to_number: "Route to Phone Number",
  route_to_default: "Route to Default Number",
  trigger_webhook: "Trigger Webhook",
  voicemail: "Voicemail",
  voice_ai: "Voice AI Assistant",
  submenu: "Navigate to Submenu",
};

/**
 * Action type descriptions
 */
export const ACTION_TYPE_DESCRIPTIONS: Record<IVRActionType, string> = {
  route_to_number: "Forward the call to a specific phone number",
  route_to_default: "Forward to the default company phone number",
  trigger_webhook: "Send a webhook notification to an external URL",
  voicemail: "Record a voicemail message",
  voice_ai: "Connect to AI-powered voice assistant",
  submenu: "Navigate to a nested submenu with more options",
};
```

---

### Task 2: Create Validation Utilities

**File**: `/var/www/lead360.app/app/src/lib/utils/ivr-validation.ts` (NEW)

```typescript
import { IVRMenuOption, IVR_CONSTANTS } from "@/lib/types/ivr";

/**
 * Validation utilities for IVR configuration
 */

/**
 * Validate menu tree depth
 * @returns true if depth is within limits, false otherwise
 */
export function validateMenuDepth(
  options: IVRMenuOption[],
  maxDepth: number,
  currentDepth: number = 1
): { isValid: boolean; errorMessage?: string } {
  if (currentDepth > maxDepth) {
    return {
      isValid: false,
      errorMessage: `Menu depth exceeds maximum of ${maxDepth} levels. Current depth: ${currentDepth}.`,
    };
  }

  for (const option of options) {
    if (option.action === "submenu" && option.submenu) {
      const result = validateMenuDepth(
        option.submenu.options,
        maxDepth,
        currentDepth + 1
      );
      if (!result.isValid) {
        return result;
      }
    }
  }

  return { isValid: true };
}

/**
 * Detect circular references in menu tree
 * @returns true if no circular refs, false otherwise
 */
export function validateNoCircularReferences(
  options: IVRMenuOption[],
  visitedIds: Set<string> = new Set()
): { isValid: boolean; errorMessage?: string; duplicateId?: string } {
  for (const option of options) {
    if (visitedIds.has(option.id)) {
      return {
        isValid: false,
        errorMessage: `Circular reference detected: Option ID "${option.id}" appears multiple times in the menu tree.`,
        duplicateId: option.id,
      };
    }

    visitedIds.add(option.id);

    if (option.action === "submenu" && option.submenu) {
      const result = validateNoCircularReferences(
        option.submenu.options,
        visitedIds
      );
      if (!result.isValid) {
        return result;
      }
    }
  }

  return { isValid: true };
}

/**
 * Count total nodes in tree
 */
export function countTotalNodes(options: IVRMenuOption[]): number {
  let count = 0;

  for (const option of options) {
    count++;
    if (option.action === "submenu" && option.submenu) {
      count += countTotalNodes(option.submenu.options);
    }
  }

  return count;
}

/**
 * Validate total node count
 */
export function validateTotalNodeCount(
  options: IVRMenuOption[],
  maxNodes: number = IVR_CONSTANTS.MAX_TOTAL_NODES
): { isValid: boolean; errorMessage?: string; totalNodes?: number } {
  const totalNodes = countTotalNodes(options);

  if (totalNodes > maxNodes) {
    return {
      isValid: false,
      errorMessage: `Total menu options (${totalNodes}) exceeds maximum of ${maxNodes}. Please simplify your menu structure.`,
      totalNodes,
    };
  }

  return { isValid: true, totalNodes };
}

/**
 * Validate unique digits at each level
 */
export function validateUniqueDigits(
  options: IVRMenuOption[]
): { isValid: boolean; errorMessage?: string } {
  const digits = options.map((opt) => opt.digit);
  const uniqueDigits = new Set(digits);

  if (digits.length !== uniqueDigits.size) {
    return {
      isValid: false,
      errorMessage: "Digits must be unique within each menu level",
    };
  }

  // Recursively validate submenus
  for (const option of options) {
    if (option.action === "submenu" && option.submenu) {
      const result = validateUniqueDigits(option.submenu.options);
      if (!result.isValid) {
        return result;
      }
    }
  }

  return { isValid: true };
}

/**
 * Validate submenu configuration consistency
 * - If action is "submenu", must have submenu config
 * - If action is NOT "submenu", must NOT have submenu config
 */
export function validateSubmenuConsistency(
  options: IVRMenuOption[]
): { isValid: boolean; errorMessage?: string } {
  for (const option of options) {
    if (option.action === "submenu") {
      if (!option.submenu || !option.submenu.options || option.submenu.options.length === 0) {
        return {
          isValid: false,
          errorMessage: `Option "${option.label}" (digit ${option.digit}) is set to "submenu" but has no submenu configuration or empty options.`,
        };
      }

      // Recursively validate nested submenus
      const result = validateSubmenuConsistency(option.submenu.options);
      if (!result.isValid) {
        return result;
      }
    } else {
      if (option.submenu) {
        return {
          isValid: false,
          errorMessage: `Option "${option.label}" (digit ${option.digit}) has submenu configuration but action is not "submenu".`,
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Comprehensive validation (runs all checks)
 */
export function validateIVRMenuTree(
  options: IVRMenuOption[],
  maxDepth: number = IVR_CONSTANTS.DEFAULT_DEPTH
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check depth
  const depthResult = validateMenuDepth(options, maxDepth);
  if (!depthResult.isValid && depthResult.errorMessage) {
    errors.push(depthResult.errorMessage);
  }

  // Check circular references
  const circularResult = validateNoCircularReferences(options);
  if (!circularResult.isValid && circularResult.errorMessage) {
    errors.push(circularResult.errorMessage);
  }

  // Check total nodes
  const nodeCountResult = validateTotalNodeCount(options);
  if (!nodeCountResult.isValid && nodeCountResult.errorMessage) {
    errors.push(nodeCountResult.errorMessage);
  }

  // Check unique digits
  const uniqueDigitsResult = validateUniqueDigits(options);
  if (!uniqueDigitsResult.isValid && uniqueDigitsResult.errorMessage) {
    errors.push(uniqueDigitsResult.errorMessage);
  }

  // Check submenu consistency
  const submenuResult = validateSubmenuConsistency(options);
  if (!submenuResult.isValid && submenuResult.errorMessage) {
    errors.push(submenuResult.errorMessage);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

---

### Task 3: Create MenuTreeBuilder Component

**File**: `/var/www/lead360.app/app/src/components/ivr/MenuTreeBuilder.tsx` (NEW)

**Component Architecture**: Recursive component with nested accordions

```typescript
"use client";

import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Plus, Trash2, ChevronRight } from "lucide-react";
import { IVRFormData, IVRActionType, IVR_CONSTANTS, ACTION_TYPE_LABELS } from "@/lib/types/ivr";

interface MenuTreeBuilderProps {
  parentPath: string;       // e.g., "menu_options" or "menu_options.0.submenu.options"
  level: number;            // Depth level (1, 2, 3, etc.)
  maxDepth: number;         // Maximum allowed depth
  onRemove?: () => void;    // Callback for removing this entire submenu
}

export function MenuTreeBuilder({
  parentPath,
  level,
  maxDepth,
  onRemove,
}: MenuTreeBuilderProps) {
  const { control, watch, register, formState: { errors } } = useFormContext<IVRFormData>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: parentPath as any,
  });

  const options = watch(parentPath);

  // Get available digits (0-9) excluding already used ones
  const getAvailableDigits = (currentIndex: number) => {
    const usedDigits = new Set(
      fields
        .map((_, idx) => watch(`${parentPath}.${idx}.digit` as any))
        .filter((d, idx) => idx !== currentIndex && d)
    );

    return Array.from({ length: 10 }, (_, i) => i.toString()).filter(
      (digit) => !usedDigits.has(digit)
    );
  };

  const addOption = () => {
    const availableDigits = getAvailableDigits(-1);
    append({
      id: uuidv4(),
      digit: availableDigits[0] || "",
      action: "route_to_number" as IVRActionType,
      label: "",
      config: {},
    } as any);
  };

  return (
    <div
      className="space-y-4"
      style={{ paddingLeft: level > 1 ? "2rem" : "0" }}
    >
      {/* Level Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={level === 1 ? "default" : "secondary"}>
            Level {level}
          </Badge>
          {level > 1 && (
            <span className="text-sm text-muted-foreground">
              Submenu Options
            </span>
          )}
        </div>
        {onRemove && level > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Remove Submenu
          </Button>
        )}
      </div>

      {/* Submenu Greeting (if not root level) */}
      {level > 1 && (
        <div className="space-y-2">
          <Label htmlFor={`${parentPath.replace(".options", "")}.greeting_message`}>
            Submenu Greeting Message
          </Label>
          <Textarea
            id={`${parentPath.replace(".options", "")}.greeting_message`}
            {...register(`${parentPath.replace(".options", "")}.greeting_message` as any)}
            placeholder="e.g., Sales Department. Press 1 for new customers or 2 for existing customers."
            className="min-h-[80px]"
          />
          <p className="text-sm text-muted-foreground">
            This message will be spoken when users navigate to this submenu.
          </p>
        </div>
      )}

      {/* Menu Options */}
      <div className="space-y-4">
        {fields.map((field, index) => {
          const optionPath = `${parentPath}.${index}`;
          const action = watch(`${optionPath}.action` as any);

          return (
            <Card key={field.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    Option {index + 1}
                    {action === "submenu" && (
                      <Badge variant="outline">
                        <ChevronRight className="h-3 w-3 mr-1" />
                        Submenu
                      </Badge>
                    )}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Digit Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`${optionPath}.digit`}>Digit</Label>
                    <Select
                      value={watch(`${optionPath}.digit` as any) || ""}
                      onValueChange={(value) => {
                        // Update form value
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select digit" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableDigits(index).map((digit) => (
                          <SelectItem key={digit} value={digit}>
                            {digit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor={`${optionPath}.label`}>Label</Label>
                    <Input
                      id={`${optionPath}.label`}
                      {...register(`${optionPath}.label` as any)}
                      placeholder="e.g., Sales Department"
                    />
                  </div>
                </div>

                {/* Action Type Selection */}
                <div>
                  <Label htmlFor={`${optionPath}.action`}>Action Type</Label>
                  <Select
                    value={action || "route_to_number"}
                    onValueChange={(value) => {
                      // Update form value
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_TYPE_LABELS) as IVRActionType[])
                        .filter((a) => level < maxDepth || a !== "submenu") // Hide submenu option at max depth
                        .map((actionType) => (
                          <SelectItem key={actionType} value={actionType}>
                            {ACTION_TYPE_LABELS[actionType]}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action-Specific Configuration */}
                {action === "route_to_number" && (
                  <div>
                    <Label htmlFor={`${optionPath}.config.phone_number`}>
                      Phone Number
                    </Label>
                    <Input
                      id={`${optionPath}.config.phone_number`}
                      {...register(`${optionPath}.config.phone_number` as any)}
                      placeholder="+1234567890"
                      type="tel"
                    />
                  </div>
                )}

                {action === "trigger_webhook" && (
                  <div>
                    <Label htmlFor={`${optionPath}.config.webhook_url`}>
                      Webhook URL (HTTPS)
                    </Label>
                    <Input
                      id={`${optionPath}.config.webhook_url`}
                      {...register(`${optionPath}.config.webhook_url` as any)}
                      placeholder="https://example.com/webhook"
                      type="url"
                    />
                  </div>
                )}

                {action === "voicemail" && (
                  <div>
                    <Label htmlFor={`${optionPath}.config.max_duration_seconds`}>
                      Max Duration (seconds)
                    </Label>
                    <Input
                      id={`${optionPath}.config.max_duration_seconds`}
                      {...register(`${optionPath}.config.max_duration_seconds` as any, {
                        valueAsNumber: true,
                      })}
                      type="number"
                      min={60}
                      max={300}
                      placeholder="180"
                    />
                  </div>
                )}

                {/* Recursive Submenu Section */}
                {action === "submenu" && level < maxDepth && (
                  <Accordion type="single" collapsible className="border-l-2 border-primary/20 pl-4">
                    <AccordionItem value="submenu">
                      <AccordionTrigger className="text-sm font-medium">
                        Configure Submenu Options
                        <Badge variant="secondary" className="ml-2">
                          Level {level + 1}
                        </Badge>
                      </AccordionTrigger>
                      <AccordionContent>
                        <MenuTreeBuilder
                          parentPath={`${optionPath}.submenu.options`}
                          level={level + 1}
                          maxDepth={maxDepth}
                          onRemove={() => {
                            // Clear submenu when removing
                          }}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                {level >= maxDepth && action === "submenu" && (
                  <p className="text-sm text-muted-foreground">
                    Maximum depth reached. Cannot add more submenus.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Option Button */}
      {fields.length < IVR_CONSTANTS.MAX_OPTIONS_PER_LEVEL && (
        <Button
          type="button"
          variant="outline"
          onClick={addOption}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Option (Level {level})
        </Button>
      )}

      {fields.length >= IVR_CONSTANTS.MAX_OPTIONS_PER_LEVEL && (
        <p className="text-sm text-muted-foreground text-center">
          Maximum {IVR_CONSTANTS.MAX_OPTIONS_PER_LEVEL} options reached for this level
        </p>
      )}
    </div>
  );
}
```

---

## Testing Instructions

### Prerequisites
- Backend Sprint IVR-2 complete (TwiML generation working)
- Frontend types updated
- Validation utilities created

### Component Testing

#### Test 1: Render Component in Isolation
```bash
cd /var/www/lead360.app/app

# Create test page
mkdir -p src/app/test-ivr
```

Create `/var/www/lead360.app/app/src/app/test-ivr/page.tsx`:
```typescript
"use client";

import { FormProvider, useForm } from "react-hook-form";
import { MenuTreeBuilder } from "@/components/ivr/MenuTreeBuilder";
import { IVRFormData } from "@/lib/types/ivr";

export default function TestIVRPage() {
  const methods = useForm<IVRFormData>({
    defaultValues: {
      menu_options: [],
      max_depth: 4,
    },
  });

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">IVR Menu Tree Builder Test</h1>
      <FormProvider {...methods}>
        <form>
          <MenuTreeBuilder
            parentPath="menu_options"
            level={1}
            maxDepth={4}
          />
        </form>
      </FormProvider>
    </div>
  );
}
```

Navigate to: `http://localhost:3000/test-ivr`

**What to Test**:
- [ ] Add option button works
- [ ] Digit selector shows 0-9 (excluding used digits)
- [ ] Action type selector shows all 6 actions
- [ ] Submenu action shows accordion
- [ ] Accordion expands to show nested MenuTreeBuilder
- [ ] Nested level shows "Level 2" badge
- [ ] Can add options at nested level
- [ ] Max depth prevents further nesting

---

## Acceptance Criteria

- [ ] Frontend types updated:
  - [ ] `voice_ai` action added to IVRActionType
  - [ ] `submenu` action added to IVRActionType
  - [ ] IVRSubmenu interface created with recursive structure
  - [ ] IVRMenuOption updated with `id` and `submenu?` fields
  - [ ] IVRConfiguration updated with `max_depth` field
  - [ ] Constants exported (MAX_DEPTH, MAX_OPTIONS_PER_LEVEL, etc.)
- [ ] Validation utilities created:
  - [ ] validateMenuDepth() works recursively
  - [ ] validateNoCircularReferences() detects duplicate IDs
  - [ ] countTotalNodes() counts correctly across tree
  - [ ] validateUniqueDigits() validates at each level
  - [ ] validateSubmenuConsistency() catches mismatches
  - [ ] validateIVRMenuTree() runs all checks and returns errors array
- [ ] MenuTreeBuilder component:
  - [ ] Renders correctly at root level (level 1)
  - [ ] Shows level badge (Level 1, Level 2, etc.)
  - [ ] Add option button works
  - [ ] Digit selector filters used digits
  - [ ] Action selector shows all actions (except submenu at max depth)
  - [ ] Submenu action shows accordion
  - [ ] Accordion contains nested MenuTreeBuilder (recursion works)
  - [ ] Visual indentation increases with depth
  - [ ] Remove option button works
  - [ ] Max options per level enforced (10)
  - [ ] Max depth enforced (submenu option hidden at max depth)

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

1. **Recursive Components**: MenuTreeBuilder calls itself for submenus. Ensure proper TypeScript typing with `as any` where needed for dynamic paths.

2. **Form State**: React Hook Form handles nested arrays well, but use `useFieldArray` for each level. Path notation like `menu_options.0.submenu.options` works.

3. **Performance**: With max 100 nodes, performance is not a concern. Don't over-optimize.

4. **UI Libraries**: Using shadcn/ui components (Accordion, Card, Badge, etc.). Ensure these are installed.

5. **UUID Generation**: Use `uuid` package for generating option IDs. Install if needed: `npm install uuid @types/uuid`

---

## Next Sprint

**Sprint IVR-4**: Frontend UI Integration - integrate MenuTreeBuilder into edit page, update view page for multi-level display, and implement end-to-end testing.
