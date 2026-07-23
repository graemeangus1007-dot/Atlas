/** Simulated generation checklist shown on /generating (no AI yet). */

export const GENERATION_STEPS = [
  "Understanding your business",
  "Selecting colors",
  "Designing your homepage",
  "Creating your navigation",
  "Optimizing for mobile",
  "Preparing your dashboard",
] as const;

/** Time spent on each checklist item before advancing. */
export const GENERATION_STEP_INTERVAL_MS = 2500;

/** Total simulated generation duration (steps × interval). */
export const GENERATION_DURATION_MS =
  GENERATION_STEPS.length * GENERATION_STEP_INTERVAL_MS;
