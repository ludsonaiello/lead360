/**
 * MenuTreeBuilder Component
 * Recursive menu builder for multi-level IVR configurations
 * Sprint IVR-3
 *
 * Features:
 * - Recursive rendering up to max_depth
 * - Nested accordion UI for submenus
 * - Digit filtering (ensures unique digits per level)
 * - Action-specific configuration fields
 * - Add/remove menu options
 * - Visual depth indicators
 */

"use client";

import React, { useState } from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  PhoneCall,
  Voicemail,
  Link as LinkIcon,
  ArrowRight,
  Bot,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/Textarea";
import Card from "@/components/ui/Card";
import { PhoneInput } from "@/components/ui/PhoneInput";

import {
  IVRFormData,
  IVRActionType,
  IVR_CONSTANTS,
  ACTION_TYPE_LABELS
} from "@/lib/types/ivr";

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
  const { control, watch, register, formState: { errors }, setValue } = useFormContext<IVRFormData>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: parentPath as any,
  });

  const options = watch(parentPath as any);

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
      id: crypto.randomUUID(),
      digit: availableDigits[0] || "",
      action: "route_to_number" as IVRActionType,
      label: "",
      config: {},
    } as any);
  };

  return (
    <div
      className="space-y-4"
      style={{ paddingLeft: level > 1 ? "1.5rem" : "0" }}
    >
      {/* Level Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant={level === 1 ? "blue" : "gray"}
          >
            Level {level}
          </Badge>
          {level > 1 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Submenu Options
            </span>
          )}
        </div>
        {onRemove && level > 1 && (
          <Button
            type="button"
            variant="secondary"
            onClick={onRemove}
            className="text-red-600 hover:text-red-700 dark:text-red-400"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Submenu
          </Button>
        )}
      </div>

      {/* Submenu Greeting (if not root level) */}
      {level > 1 && (
        <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <Label htmlFor={`${parentPath.replace(".options", "")}.greeting_message`}>
            Submenu Greeting Message
          </Label>
          <Textarea
            id={`${parentPath.replace(".options", "")}.greeting_message`}
            {...register(`${parentPath.replace(".options", "")}.greeting_message` as any)}
            placeholder="e.g., Sales Department. Press 1 for new customers or 2 for existing customers."
            className="min-h-[80px]"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">
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
            <MenuOptionCard
              key={field.id}
              optionPath={optionPath}
              index={index}
              level={level}
              maxDepth={maxDepth}
              action={action}
              control={control}
              register={register}
              errors={errors}
              watch={watch}
              setValue={setValue}
              onRemove={() => remove(index)}
              availableDigits={getAvailableDigits(index)}
              currentDigit={watch(`${optionPath}.digit` as any)}
            />
          );
        })}
      </div>

      {/* Add Option Button */}
      {fields.length < IVR_CONSTANTS.MAX_OPTIONS_PER_LEVEL && (
        <Button
          type="button"
          variant="secondary"
          onClick={addOption}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Option (Level {level})
        </Button>
      )}

      {fields.length >= IVR_CONSTANTS.MAX_OPTIONS_PER_LEVEL && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Maximum {IVR_CONSTANTS.MAX_OPTIONS_PER_LEVEL} options reached for this level
        </p>
      )}
    </div>
  );
}

/**
 * Menu Option Card Component
 * Individual option with accordion for submenus
 */
interface MenuOptionCardProps {
  optionPath: string;
  index: number;
  level: number;
  maxDepth: number;
  action: IVRActionType;
  control: any;
  register: any;
  errors: any;
  watch: any;
  setValue: any;
  onRemove: () => void;
  availableDigits: string[];
  currentDigit: string;
}

function MenuOptionCard({
  optionPath,
  index,
  level,
  maxDepth,
  action,
  control,
  register,
  errors,
  watch,
  setValue,
  onRemove,
  availableDigits,
  currentDigit,
}: MenuOptionCardProps) {
  const [isSubmenuExpanded, setIsSubmenuExpanded] = useState(false);

  const getActionIcon = (actionType: IVRActionType) => {
    switch (actionType) {
      case "route_to_number":
        return <PhoneCall className="h-4 w-4" />;
      case "voicemail":
        return <Voicemail className="h-4 w-4" />;
      case "trigger_webhook":
        return <LinkIcon className="h-4 w-4" />;
      case "route_to_default":
        return <ArrowRight className="h-4 w-4" />;
      case "voice_ai":
        return <Bot className="h-4 w-4" />;
      case "submenu":
        return <ChevronRight className="h-4 w-4" />;
    }
  };

  // When action changes, initialize/clear submenu data
  const handleActionChange = (newAction: IVRActionType) => {
    setValue(`${optionPath}.action`, newAction);

    if (newAction === "submenu") {
      // Initialize submenu if it doesn't exist
      const currentSubmenu = watch(`${optionPath}.submenu`);
      if (!currentSubmenu) {
        setValue(`${optionPath}.submenu`, {
          greeting_message: "",
          options: [],
        });
      }
    } else {
      // Clear submenu if action is not submenu
      setValue(`${optionPath}.submenu`, undefined);
    }
  };

  return (
    <Card className="relative">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag Handle (visual only) */}
          <div className="cursor-grab text-gray-400 mt-2">
            <GripVertical className="h-5 w-5" />
          </div>

          <div className="flex-1 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center">
                  {getActionIcon(action)}
                  <span className="ml-2">Option {index + 1}</span>
                </h3>
                {action === "submenu" && (
                  <Badge
                    variant="blue"
                  >
                    Submenu
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={onRemove}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Digit and Label Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`${optionPath}.digit`}>Digit</Label>
                <select
                  id={`${optionPath}.digit`}
                  {...register(`${optionPath}.digit` as any)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value={currentDigit}>{currentDigit}</option>
                  {availableDigits.map((digit) => (
                    <option key={digit} value={digit}>
                      {digit}
                    </option>
                  ))}
                </select>
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
              <select
                id={`${optionPath}.action`}
                value={action || "route_to_number"}
                onChange={(e) => handleActionChange(e.target.value as IVRActionType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {(Object.keys(ACTION_TYPE_LABELS) as IVRActionType[])
                  .filter((a) => level < maxDepth || a !== "submenu") // Hide submenu option at max depth
                  .map((actionType) => (
                    <option key={actionType} value={actionType}>
                      {ACTION_TYPE_LABELS[actionType]}
                    </option>
                  ))}
              </select>
              {level >= maxDepth && action === "submenu" && (
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                  Maximum depth reached. Cannot add more submenus.
                </p>
              )}
            </div>

            {/* Action-Specific Configuration */}
            {action === "route_to_number" && (
              <div>
                <Label htmlFor={`${optionPath}.config.phone_number`}>
                  Phone Number
                </Label>
                <Controller
                  name={`${optionPath}.config.phone_number` as any}
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      {...field}
                      id={`${optionPath}.config.phone_number`}
                      helperText="US phone number (automatically formatted)"
                    />
                  )}
                />
              </div>
            )}

            {action === "voice_ai" && (
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1">Voice AI Assistant</p>
                      <p>
                        Connects to your configured AI voice assistant. Routing is handled automatically
                        using your Voice AI settings.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor={`${optionPath}.config.phone_number`}>
                    Fallback Transfer Number (Optional)
                  </Label>
                  <Controller
                    name={`${optionPath}.config.phone_number` as any}
                    control={control}
                    render={({ field }) => (
                      <PhoneInput
                        {...field}
                        id={`${optionPath}.config.phone_number`}
                        helperText="Optional fallback number if Voice AI is unavailable"
                      />
                    )}
                  />
                </div>
              </div>
            )}

            {action === "trigger_webhook" && (
              <div>
                <Label htmlFor={`${optionPath}.config.webhook_url`}>
                  Webhook URL (HTTPS only)
                </Label>
                <Input
                  id={`${optionPath}.config.webhook_url`}
                  {...register(`${optionPath}.config.webhook_url` as any)}
                  placeholder="https://api.example.com/webhook"
                  type="url"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Must use HTTPS protocol
                </p>
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
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Between 60 and 300 seconds
                </p>
              </div>
            )}

            {action === "route_to_default" && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No additional configuration needed for default routing
                </p>
              </div>
            )}

            {/* Recursive Submenu Section */}
            {action === "submenu" && level < maxDepth && (
              <div className="border-l-2 border-blue-500 pl-4 mt-4">
                <button
                  type="button"
                  onClick={() => setIsSubmenuExpanded(!isSubmenuExpanded)}
                  className="flex items-center justify-between w-full text-left py-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {isSubmenuExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Configure Submenu Options
                  </span>
                  <Badge
                    variant="blue"
                  >
                    Level {level + 1}
                  </Badge>
                </button>

                {isSubmenuExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <MenuTreeBuilder
                      parentPath={`${optionPath}.submenu.options`}
                      level={level + 1}
                      maxDepth={maxDepth}
                      onRemove={() => {
                        // Clear submenu when removing
                        setValue(`${optionPath}.submenu`, undefined);
                        setValue(`${optionPath}.action`, "route_to_number");
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
