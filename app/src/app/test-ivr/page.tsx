/**
 * IVR MenuTreeBuilder Test Page
 * Sprint IVR-3 - Test page for isolated component testing
 *
 * Test URL: http://localhost:7000/test-ivr
 *
 * Tests:
 * - Component renders at root level
 * - Add/remove options work
 * - Digit filtering (unique per level)
 * - Action type changes
 * - Submenu accordion expansion
 * - Recursive nesting up to max_depth
 * - Visual depth indicators
 */

"use client";

import { FormProvider, useForm } from "react-hook-form";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { MenuTreeBuilder } from "@/components/ivr/MenuTreeBuilder";
import { IVRFormData } from "@/lib/types/ivr";
import { validateIVRMenuTree } from "@/lib/utils/ivr-validation";
import { Button } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AlertCircle, CheckCircle } from "lucide-react";

export default function TestIVRPage() {
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
  } | null>(null);

  const methods = useForm<IVRFormData>({
    defaultValues: {
      ivr_enabled: true,
      greeting_message: "Thank you for calling. Please select an option.",
      menu_options: [],
      default_action: {
        action: "voicemail",
        config: {
          max_duration_seconds: 180,
        },
      },
      timeout_seconds: 10,
      max_retries: 3,
      max_depth: 4,
    },
  });

  const onSubmit = (data: IVRFormData) => {
    console.log("Form Data:", JSON.stringify(data, null, 2));

    // Run validation
    const result = validateIVRMenuTree(data.menu_options, data.max_depth);
    setValidationResult(result);

    if (result.isValid) {
      toast.success("✅ Validation passed! Check console for form data.");
    } else {
      toast.error(`❌ Validation failed! ${result.errors.length} errors found.`);
    }
  };

  const currentMaxDepth = methods.watch("max_depth");
  const currentMenuOptions = methods.watch("menu_options");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            IVR Menu Tree Builder Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sprint IVR-3 - Component isolation testing page
          </p>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
            {/* Controls Card */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Test Controls
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Max Depth Control */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Depth (1-5)
                    </label>
                    <input
                      type="number"
                      {...methods.register("max_depth", { valueAsNumber: true })}
                      min={1}
                      max={5}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Current Stats */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Total Options
                    </label>
                    <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <Badge variant="blue">
                        {currentMenuOptions?.length || 0} root options
                      </Badge>
                    </div>
                  </div>

                  {/* Validation Button */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Actions
                    </label>
                    <Button type="submit" className="w-full">
                      Validate Menu Tree
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Validation Result */}
            {validationResult && (
              <Card>
                <div className="p-6">
                  <div
                    className={`flex items-start gap-3 ${
                      validationResult.isValid
                        ? "text-green-800 dark:text-green-200"
                        : "text-red-800 dark:text-red-200"
                    }`}
                  >
                    {validationResult.isValid ? (
                      <CheckCircle className="h-6 w-6 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-6 w-6 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">
                        {validationResult.isValid
                          ? "✅ Validation Passed"
                          : "❌ Validation Failed"}
                      </h3>
                      {!validationResult.isValid && (
                        <ul className="list-disc list-inside space-y-1">
                          {validationResult.errors.map((error, idx) => (
                            <li key={idx} className="text-sm">
                              {error}
                            </li>
                          ))}
                        </ul>
                      )}
                      {validationResult.isValid && (
                        <p className="text-sm">
                          All validation checks passed. Form data logged to console.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* MenuTreeBuilder Component */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Menu Options Builder
                </h2>

                <MenuTreeBuilder
                  parentPath="menu_options"
                  level={1}
                  maxDepth={currentMaxDepth}
                />
              </div>
            </Card>

            {/* Instructions */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Test Instructions
                </h2>

                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                  <div>
                    <h3 className="font-semibold mb-2">✅ What to Test:</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Click "Add Option" to create menu options</li>
                      <li>Verify digit selector shows 0-9 (excluding used digits)</li>
                      <li>Change action type and verify config fields appear</li>
                      <li>Select "Navigate to Submenu" action</li>
                      <li>Click "Configure Submenu Options" to expand accordion</li>
                      <li>Verify nested level shows "Level 2" badge</li>
                      <li>Add options at nested level</li>
                      <li>Test depth limiting (change max_depth slider)</li>
                      <li>Verify submenu option hidden when at max depth</li>
                      <li>Click "Validate Menu Tree" to run all validation checks</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">🔍 Validation Checks:</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Menu depth within max_depth limit</li>
                      <li>No circular references (duplicate IDs)</li>
                      <li>Total nodes under 100</li>
                      <li>Digits unique at each level</li>
                      <li>Submenu config consistency</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">📊 Expected Behavior:</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Max 10 options per level</li>
                      <li>Visual indentation increases with depth</li>
                      <li>Accordion expands/collapses for submenus</li>
                      <li>Remove buttons work at all levels</li>
                      <li>Form data preserves recursive structure</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            {/* Debug Output */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Debug: Current Form State
                </h2>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto text-xs">
                  {JSON.stringify(currentMenuOptions, null, 2)}
                </pre>
              </div>
            </Card>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
