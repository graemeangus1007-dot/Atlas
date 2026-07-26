import type { VercelFileReference } from "@/lib/deployment/vercel-files";

/**
 * Project settings for generated customer static sites.
 *
 * Important Vercel semantics:
 * - `framework: null` → Framework Preset "Other" (no Next.js).
 * - `buildCommand` / `installCommand` / `outputDirectory`:
 *   `null` means *auto-detect* (would inherit the target project's Next.js
 *   settings). Empty string `""` disables / overrides detection so no install
 *   or build runs and files are served from the deployment root.
 */
export const STATIC_SITE_PROJECT_SETTINGS = {
  framework: null,
  buildCommand: "",
  installCommand: "",
  outputDirectory: "",
  /** Not used for static HTML; keep null so nothing invents a Next.js root. */
  rootDirectory: null,
  devCommand: null,
} as const;

export type VercelStaticSiteProjectSettings = {
  framework: null;
  buildCommand: "";
  installCommand: "";
  outputDirectory: "";
  rootDirectory: null;
  devCommand: null;
};

export type VercelCreateStaticDeploymentBody = {
  name: string;
  project: string;
  files: VercelFileReference[];
  projectSettings: VercelStaticSiteProjectSettings;
};

/** Filenames that must never ship in a customer-site deployment. */
export const FORBIDDEN_APP_SOURCE_FILES = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "tsconfig.json",
] as const;

/**
 * vercel.json baked into every customer-site upload.
 * Forces Other/no-framework + clean URLs so `/` serves index.html.
 */
export function buildStaticSiteVercelJson(): string {
  return `${JSON.stringify(
    {
      $schema: "https://openapi.vercel.sh/vercel.json",
      framework: null,
      buildCommand: "",
      installCommand: "",
      outputDirectory: "",
      cleanUrls: true,
    },
    null,
    2,
  )}\n`;
}

/**
 * Build the create-deployment JSON for a generated static customer site.
 * Never includes file bodies — only SHA refs — and never Next.js settings.
 */
export function buildStaticSiteCreateDeploymentBody(input: {
  slug: string;
  projectId: string;
  files: VercelFileReference[];
}): VercelCreateStaticDeploymentBody {
  assertNoAppSourceFiles(input.files.map((f) => f.file));

  return {
    name: `atlas-${input.slug}`.slice(0, 64),
    project: input.projectId,
    files: input.files,
    projectSettings: { ...STATIC_SITE_PROJECT_SETTINGS },
  };
}

export function assertNoAppSourceFiles(paths: string[]): void {
  const forbidden = new Set(
    FORBIDDEN_APP_SOURCE_FILES.map((name) => name.toLowerCase()),
  );
  for (const path of paths) {
    const base = path.replace(/^\/+/, "").split("/").pop()?.toLowerCase() ?? "";
    const normalized = path.replace(/^\/+/, "").toLowerCase();
    if (forbidden.has(base) || forbidden.has(normalized)) {
      throw new Error(
        `Refusing to deploy application source file "${path}". ` +
          "Customer sites must be static HTML/CSS/assets only.",
      );
    }
  }
}

/**
 * True when projectSettings cannot select Next.js or run a Next.js build.
 */
export function isStaticNoFrameworkDeployment(
  body: VercelCreateStaticDeploymentBody,
): boolean {
  const settings = body.projectSettings;
  if (settings.framework !== null) return false;
  if (settings.buildCommand !== "") return false;
  if (settings.installCommand !== "") return false;
  // Empty output directory = deployment root (static files as uploaded).
  if (settings.outputDirectory !== "") return false;
  if (body.files.some((f) => "data" in f || "encoding" in f)) return false;
  try {
    assertNoAppSourceFiles(body.files.map((f) => f.file));
  } catch {
    return false;
  }
  return true;
}
