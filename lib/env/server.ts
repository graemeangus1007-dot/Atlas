/**
 * Server-only environment loader.
 * Never import this module from client components or shared client bundles.
 */

import { formatEnvIssues, validateEnv } from "@/lib/env/validate";
import type { EnvIssue, EnvValidationResult, ServerEnv } from "@/lib/env/types";

let cached: EnvValidationResult | null = null;

function isBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  );
}

/** Validate (and cache) server env from process.env. */
export function loadServerEnv(
  source: NodeJS.ProcessEnv = process.env,
  options?: { requireProductionSecrets?: boolean; bustCache?: boolean },
): EnvValidationResult {
  if (!options?.bustCache && cached && source === process.env) {
    return cached;
  }
  const result = validateEnv(source, {
    requireProductionSecrets: options?.requireProductionSecrets,
  });
  if (source === process.env) {
    cached = result;
  }
  return result;
}

/** Reset cache (tests). */
export function resetServerEnvCacheForTests(): void {
  cached = null;
}

/**
 * Return validated server env or throw a safe Error (no secret values).
 */
export function requireServerEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  const result = loadServerEnv(source);
  if (!result.ok) {
    throw new Error(
      `Invalid Atlas server environment:\n${formatEnvIssues(result.errors)}`,
    );
  }
  return result.env;
}

/**
 * Startup validation for instrumentation.
 * - Logs warnings in development
 * - Logs errors in production (does not crash the build phase)
 * - Never logs secret values
 */
export function validateEnvAtStartup(
  source: NodeJS.ProcessEnv = process.env,
): { errors: EnvIssue[]; warnings: EnvIssue[] } {
  const result = loadServerEnv(source, { bustCache: true });
  const errors = result.ok ? [] : result.errors;
  const warnings = result.warnings;

  for (const warning of warnings) {
    console.warn(`[atlas.env] ${warning.key}: ${warning.message}`);
  }

  if (errors.length > 0) {
    const formatted = formatEnvIssues(errors);
    if (isBuildPhase()) {
      console.warn(
        `[atlas.env] Environment incomplete during build (runtime will re-check):\n${formatted}`,
      );
    } else if (
      source.NODE_ENV === "production" ||
      source.VERCEL === "1"
    ) {
      console.error(
        `[atlas.env] Critical environment configuration errors:\n${formatted}`,
      );
    } else {
      console.warn(
        `[atlas.env] Environment configuration errors (dev — some features degraded):\n${formatted}`,
      );
    }
  }

  return { errors, warnings };
}

/** True when env is valid enough for customer testing. */
export function isServerEnvHealthy(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return loadServerEnv(source).ok;
}
