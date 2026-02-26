/**
 * IVR Validation Utilities
 * Comprehensive validation for multi-level IVR menu structures
 * Sprint IVR-3
 */

import { IVRMenuOption, IVR_CONSTANTS } from "@/lib/types/ivr";

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
